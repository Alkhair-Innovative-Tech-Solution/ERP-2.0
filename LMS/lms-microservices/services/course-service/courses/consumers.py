import sys
if "/app" not in sys.path:
    sys.path.insert(0, "/app")

import logging
from django.db import transaction
import time

logger = logging.getLogger(__name__)

def handle_student_enrolled_event(routing_key, message):
    """
    Callback function that gets triggered when auth-service publishes a 'student.enrolled' event.
    Automatically enrolls the student into the appropriate course and scheduled class.
    """
    logger.info(f"🎧 Processing student.enrolled event: {message}")
    
    student_id = message.get("student_id")
    course_id = message.get("course_id")
    scheduled_class_id = message.get("scheduled_class_id")  # Student's chosen session
    branch_id = message.get("branch_id")

    if not student_id or not course_id:
        logger.error("❌ Missing student_id or course_id in event message")
        return

    # Import locally to avoid Apps not loaded issues at startup
    from courses.models import Course, CourseRegistrationHistory, ScheduledClass, Branch

    try:
        # Get course
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            logger.error(f"❌ Course {course_id} not found for enrollment of {student_id}")
            return

        # Resolve which scheduled class to use
        scheduled_class = None
        if scheduled_class_id:
            try:
                scheduled_class = ScheduledClass.objects.get(id=scheduled_class_id)
                logger.info(f"✅ Using student-selected session {scheduled_class_id}")
            except ScheduledClass.DoesNotExist:
                logger.warning(f"⚠️ Student-selected session {scheduled_class_id} not found, falling back to first active")

        if not scheduled_class:
            scheduled_class = ScheduledClass.objects.filter(course=course, active=True).first()
            if scheduled_class:
                logger.info(f"✅ Fallback: using first active session {scheduled_class.id}")
            else:
                logger.warning(f"⚠️ No active session found for course {course_id}")

        # Resolve branch
        branch = None
        if branch_id:
            try:
                branch = Branch.objects.get(id=branch_id)
            except Branch.DoesNotExist:
                logger.warning(f"[consumer] branch_id {branch_id} not found for enrollment of student {student_id}")
        if not branch and scheduled_class and scheduled_class.branch:
            branch = scheduled_class.branch
            if branch_id:
                logger.warning(f"[consumer] Falling back to scheduled_class.branch ({branch.id}) for student {student_id}")

        # Check class capacity before enrolling
        if scheduled_class:
            from courses.services import CourseService
            is_full, msg = CourseService.check_class_capacity(scheduled_class.id)
            if is_full:
                logger.warning(f"⛔ Capacity full for class {scheduled_class.id}: {msg}. Skipping enrollment for {student_id}")
                return

        with transaction.atomic():
            # Create/update enrollment record
            enrollment, created = CourseRegistrationHistory.objects.get_or_create(
                student_id=student_id,
                course=course,
                defaults={
                    "scheduled_class": scheduled_class,
                    "branch": branch,
                    "status": "enrolled"
                }
            )

            if not created:
                if scheduled_class:
                    enrollment.scheduled_class = scheduled_class
                if branch:
                    enrollment.branch = branch
                enrollment.status = "enrolled"
                enrollment.save()

            if scheduled_class:
                # Re-check capacity after enrollment (last seat filled)
                from courses.services import CourseService
                CourseService.check_class_capacity(scheduled_class.id)
                logger.info(f"✅ Enrolled student {student_id} in course {course.name}, session {scheduled_class.id}")
            else:
                logger.info(f"✅ Enrolled student {student_id} in course {course.name} (no session)")

            logger.info(f"🎉 Enrollment complete for student {student_id} in course {course.name}")
            
    except Exception as e:
        logger.error(f"❌ Error processing enrollment event: {str(e)}")


def start_rabbitmq_listeners():
    """Starts consumer threads for course-service"""
    from shared.common.rabbitmq_client import RabbitMQClient
    try:
        # Pre-declare the exchange and queue to ensure messages are not lost
        mq = RabbitMQClient()
        
        # Ensure exchange exists
        mq.channel.exchange_declare(exchange='lms_events', exchange_type='topic', durable=True)
        
        # Start the background thread
        mq.start_consumer_thread(
            exchange='lms_events',
            queue_name='course_service_enrollments_queue',
            routing_keys=['student.enrolled'],
            callback=handle_student_enrolled_event
        )
        logger.info("🚀 Course Service RabbitMQ listeners started and queue bound")
    except Exception as e:
        logger.error(f"❌ Failed to start RabbitMQ listeners: {str(e)}")

if __name__ == "__main__":
    # Allow running as a standalone script
    import django
    import os
    import sys
    sys.path.append('/app')
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
    django.setup()
    
    logger.info("🌀 Starting course-service consumer in standalone mode...")
    start_rabbitmq_listeners()
    # Keep it alive
    while True:
        time.sleep(10)
