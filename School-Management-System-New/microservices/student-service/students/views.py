# views.py
import os
import tempfile


def _notify_attendance_sync():
    """Tell attendance-service to re-sync students so new students appear in attendance sheets."""
    import requests as req_lib
    url = os.environ.get('ATTENDANCE_SERVICE_URL', 'http://attendance-service:8006')
    secret = os.environ.get('INTERNAL_SERVICE_SECRET', '')
    try:
        resp = req_lib.post(
            f"{url}/api/internal/sync-students/",
            headers={'X-Internal-Secret': secret},
            timeout=10,
        )
        if resp.status_code != 200:
            print(f"[STUDENT SYNC] attendance-service returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[STUDENT SYNC] Could not reach attendance-service: {e}")


def _get_teacher_classroom_ids(user):
    """Resolve all classroom IDs a teacher is associated with — live, no sync.

    A teacher should see/assign to students of EVERY class they teach (from the
    timetable, set by the coordinator) PLUS their homeroom (class_teacher). We
    read both from their source-of-truth DBs by employee_code (JWT username):
      - campus_db.classes_classroom.class_teacher_id  → homeroom
      - timetable_db.timetable_teachertimetable        → all taught classes
    Returns the union (de-duplicated). Empty on error.
    """
    username = getattr(user, 'username', None)
    if not username:
        return []
    import psycopg2
    ids = set()
    teacher_id = None

    # 1) Resolve teacher entity id + homeroom (class_teacher) from campus_db
    try:
        conn = psycopg2.connect(
            host=os.environ.get('CAMPUS_DB_HOST', 'postgres-campus'),
            dbname=os.environ.get('CAMPUS_DB_NAME', 'campus_db'),
            user=os.environ.get('CAMPUS_DB_USER', 'campus_user'),
            password=os.environ.get('CAMPUS_DB_PASSWORD', 'campus_pass'),
            connect_timeout=5,
        )
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM teachers_teacher WHERE employee_code = %s AND is_deleted = false LIMIT 1",
                    (username,),
                )
                row = cur.fetchone()
                teacher_id = row[0] if row else None
                if teacher_id:
                    cur.execute(
                        "SELECT id FROM classes_classroom WHERE class_teacher_id = %s",
                        (teacher_id,),
                    )
                    ids.update(r[0] for r in cur.fetchall())
        finally:
            conn.close()
    except Exception:
        pass

    # 2) All taught classes from the teacher's timetable (by resolved teacher_id)
    if teacher_id:
        try:
            conn = psycopg2.connect(
                host=os.environ.get('TIMETABLE_DB_HOST', 'postgres-timetable'),
                dbname=os.environ.get('TIMETABLE_DB_NAME', 'timetable_db'),
                user=os.environ.get('TIMETABLE_DB_USER', 'timetable_user'),
                password=os.environ.get('TIMETABLE_DB_PASSWORD', 'timetable_pass'),
                connect_timeout=5,
            )
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT DISTINCT classroom_id FROM timetable_teachertimetable "
                        "WHERE teacher_id = %s AND classroom_id IS NOT NULL",
                        (teacher_id,),
                    )
                    ids.update(r[0] for r in cur.fetchall())
            finally:
                conn.close()
        except Exception:
            pass

    return list(ids)


def _get_coordinator_level_ids(user):
    """
    Returns list of level IDs managed by this coordinator.
    Tries local student_db first, then falls back to staff_db.
    Returns None if coordinator not found at all.
    Returns [] if coordinator found but no levels assigned.
    """
    from coordinator.models import Coordinator
    coordinator_obj = Coordinator.get_for_user(user)
    if coordinator_obj:
        level_ids = []
        if coordinator_obj.shift == 'both' and coordinator_obj.assigned_levels.exists():
            level_ids = list(coordinator_obj.assigned_levels.values_list('id', flat=True))
        elif coordinator_obj.level_id:
            level_ids = [coordinator_obj.level_id]
        return level_ids

    # Fallback: query staff_db
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=os.environ.get('STAFF_DB_HOST', 'postgres-staff'),
            dbname=os.environ.get('STAFF_DB_NAME', 'staff_db'),
            user=os.environ.get('STAFF_DB_USER', 'staff_user'),
            password=os.environ.get('STAFF_DB_PASSWORD', 'staff_pass'),
            connect_timeout=5,
        )
        with conn.cursor() as cur:
            username = getattr(user, 'username', None)
            email = getattr(user, 'email', None)
            row = None
            for val, col in [(username, 'employee_code'), (email, 'email')]:
                if val and not row:
                    cur.execute(
                        f"SELECT id, shift, level_id FROM coordinator_coordinator WHERE {col}=%s AND is_deleted=false LIMIT 1",
                        (val,)
                    )
                    row = cur.fetchone()
            if not row:
                conn.close()
                return None
            coord_id, shift, level_id = row
            if shift == 'both':
                cur.execute(
                    "SELECT level_id FROM coordinator_coordinator_assigned_levels WHERE coordinator_id=%s",
                    (coord_id,)
                )
                level_ids = [r[0] for r in cur.fetchall()]
            else:
                level_ids = [level_id] if level_id else []
        conn.close()
        return level_ids
    except Exception:
        return None


def _get_result_student_ids(user, role='teacher'):
    """Student IDs the user has results for — read live from result_db.

    A teacher keeps access to students they AUTHORED a result for, and a
    coordinator to students whose results are ASSIGNED to them, even after the
    student moved classroom (e.g. promoted to Section E) or left. Joined by
    employee_code inside result_db so no cross-DB ID assumptions are needed.
    Empty list on any error.
    """
    username = getattr(user, 'username', None)
    if not username:
        return []
    if role == 'coordinator':
        sql = (
            "SELECT DISTINCT r.student_id FROM result_result r "
            "JOIN coordinator_coordinator c ON r.coordinator_id = c.id "
            "WHERE c.employee_code = %s"
        )
    else:
        sql = (
            "SELECT DISTINCT r.student_id FROM result_result r "
            "JOIN teachers_teacher t ON r.teacher_id = t.id "
            "WHERE t.employee_code = %s"
        )
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=os.environ.get('RESULT_DB_HOST', 'postgres-result'),
            dbname=os.environ.get('RESULT_DB_NAME', 'result_db'),
            user=os.environ.get('RESULT_DB_USER', 'result_user'),
            password=os.environ.get('RESULT_DB_PASSWORD', 'result_pass'),
            connect_timeout=5,
        )
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (username,))
                return [r[0] for r in cur.fetchall()]
        finally:
            conn.close()
    except Exception:
        return []
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from users.permissions import IsSuperAdminOrPrincipal, IsTeacherOrAbove, IsCoordinatorOrAbove, HasDynamicPermission
from rest_framework.decorators import action
from rest_framework import status
from rest_framework.response import Response
from django.db.models import Count, Q
from .models import Student
from .serializers import StudentSerializer
from .filters import StudentFilter
from teachers.models import Teacher

from rest_framework.decorators import api_view, permission_classes
from users.permissions import IsStudent

@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsStudent])
def student_upload_photo(request):
    """
    Student can upload/update their own profile photo.
    """
    from django.db.models.query import QuerySet
    try:
        student = (
            QuerySet(Student)
            .get(student_id=request.user.username, is_deleted=False)
        )
        photo = request.FILES.get('photo')
        if not photo:
            return Response({'error': 'No photo provided'}, status=status.HTTP_400_BAD_REQUEST)
        student.photo = photo
        student.save(update_fields=['photo'])
        photo_url = request.build_absolute_uri(student.photo.url) if student.photo else None
        return Response({'photo': photo_url})
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsStudent])
def student_my_profile(request):
    """
    Student can view their own profile.
    Uses raw QuerySet to bypass OrganizationManager filtering.
    """
    from django.db.models.query import QuerySet
    try:
        # Bypass OrganizationManager — student can only see their own record
        student = (
            QuerySet(Student)
            .select_related('campus', 'classroom', 'classroom__grade')
            .get(student_id=request.user.username, is_deleted=False)
        )
        serializer = StudentSerializer(student, context={'request': request})
        return Response(serializer.data)
    except Student.DoesNotExist:
        return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)


class StudentPagination(PageNumberPagination):
    """Custom pagination for students - default 25 per page"""
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 5000

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated, (IsTeacherOrAbove | IsStudent)]
    pagination_class = StudentPagination
    
    # Filtering, search, and ordering
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = StudentFilter
    search_fields = ['name', 'student_code', 'gr_no', 'father_name', 'student_id']
    ordering_fields = ['name', 'created_at', 'enrollment_year', 'student_code']
    ordering = ['-created_at']  # Default ordering
    
    def get_queryset(self):
        """Override to handle role-based filtering for list views and stats actions"""
        queryset = Student.objects.all().filter(is_deleted=False).select_related('campus', 'classroom')
        
        # For dashboard/stats actions, only count active enrolled students with a classroom
        # (excludes alumni and students without classroom assignments)
        if self.action in {
            'gender_stats', 'campus_stats', 'grade_distribution', 'enrollment_trend',
            'mother_tongue_distribution', 'religion_distribution', 'age_distribution',
            'total_students', 'new_admissions_stats', 'zakat_status', 'house_ownership',
        }:
            queryset = queryset.filter(is_active=True, classroom__isnull=False).exclude(current_grade__iexact='Alumni')

        # Default filtering for list action: Hide Alumni and Unassigned students
        # unless specifically requested via filters. This ensures the main list
        # only shows students currently enrolled and assigned to classes.
        if self.action == 'list' and self.request:
            query_params = self.request.query_params
            # If no explicit filters for special categories are provided, apply defaults
            has_special_filter = any(param in query_params for param in [
                'campus', 'classroom', 'classroom__isnull', 'current_grade',
                'is_active', 'shift', 'section', 'level', 'search', 'is_new_admission'
            ])
            
            if not has_special_filter:
                # Default view: Only show active students with an assigned classroom
                queryset = queryset.filter(is_active=True, classroom__isnull=False).exclude(current_grade__iexact='Alumni')
            elif 'current_grade' in query_params and query_params.get('current_grade', '').lower() == 'alumni':
                # If they specifically asked for Alumni, show them (usually inactive)
                pass
            elif 'is_active' not in query_params:
                # Otherwise, if they didn't explicitly ask for inactive students, keep excluding Alumni
                queryset = queryset.exclude(current_grade__iexact='Alumni')
        
        if self.action in [
            'list',
            'retrieve',
            'update',
            'partial_update',
            'destroy',
            'gender_stats',
            'campus_stats',
            'grade_distribution',
            'enrollment_trend',
            'mother_tongue_distribution',
            'religion_distribution',
            'age_distribution',
            'total_students',
            'new_admissions_stats',
            'zakat_status',
            'house_ownership',
        ] and self.request:
            user = self.request.user
            
            if user.is_superadmin():
                return queryset
                
            if user.role == 'admin':
                # Partner Admin: Filter by organizations they created
                return queryset.filter(organization__created_by=user)

            if user.role == 'org_admin':
                # Org Admin: Filter by organization
                org_id = getattr(user.organization, 'pk', None) or getattr(user, 'org_id', None)
                if org_id:
                    return queryset.filter(organization_id=org_id)
                return queryset.none()

            if user.is_principal():
                campus_id = getattr(getattr(user, 'campus', None), 'id', None) or getattr(user, 'campus_id', None)
                campus = None
                if campus_id:
                    try:
                        from campus.models import Campus
                        campus = Campus.objects.get(id=campus_id)
                    except Exception:
                        pass

                if campus:
                    queryset = queryset.filter(campus=campus)
                else:
                    org_id = getattr(user.organization, 'pk', None) or getattr(user, 'org_id', None)
                    if org_id:
                        queryset = queryset.filter(organization_id=org_id)
                    else:
                        queryset = queryset.none()
            elif user.is_teacher():
                # Resolve the teacher's classroom(s) live from campus_db (source of
                # truth) so we don't depend on synced teacher/class_teacher data.
                classroom_ids = _get_teacher_classroom_ids(user)
                # Also match students the teacher has authored a result for, so
                # access survives the student moving classroom (e.g. promotion).
                result_student_ids = _get_result_student_ids(user, role='teacher')
                if classroom_ids or result_student_ids:
                    queryset = queryset.filter(
                        Q(classroom_id__in=classroom_ids)
                        | Q(id__in=result_student_ids)
                    ).distinct()
                else:
                    queryset = queryset.none()
            elif user.is_coordinator():
                # Coordinator: Show students from classrooms under their assigned level
                try:
                    managed_level_ids = _get_coordinator_level_ids(user)
                    # Also match students with a result assigned to this
                    # coordinator, so review access survives classroom moves.
                    result_student_ids = _get_result_student_ids(user, role='coordinator')
                    if not managed_level_ids and not result_student_ids:
                        queryset = queryset.none()
                    else:
                        from classes.models import ClassRoom
                        coordinator_classrooms = ClassRoom.objects.filter(
                            grade__level__in=managed_level_ids or []
                        ).values_list('id', flat=True)
                        queryset = queryset.filter(
                            Q(classroom__in=coordinator_classrooms)
                            | Q(id__in=result_student_ids)
                        ).distinct()
                except Exception:
                    queryset = queryset.none()
            
            elif user.role == 'student':
                # Student: Can only see their own record
                queryset = queryset.filter(student_id=user.username)
            
            # Shift filtering is now handled by StudentFilter class
            # No need for manual shift filtering here
        
        return queryset

    def get_object(self):
        """Override to handle individual student retrieval with proper permissions"""
        # For destroy action, we need to get the object even if it's soft deleted
        # So we use with_deleted() to bypass the manager's default filter
        if self.action == 'destroy':
            # Get object using with_deleted() to allow deleting already soft-deleted items if needed
            lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
            lookup_value = self.kwargs[lookup_url_kwarg]
            filter_kwargs = {self.lookup_field: lookup_value}
            obj = Student.objects.with_deleted().get(**filter_kwargs)
        else:
            # For other actions, use normal queryset (excludes deleted)
            obj = super().get_object()
        
        # Apply role-based access control for individual objects
        user = self.request.user
        
        if user.is_teacher():
            # Teacher: Check if student is in their assigned classrooms
            from teachers.models import Teacher
            try:
                teacher_obj = Teacher.objects.get(employee_code=user.username)

                assigned_classrooms = []

                if teacher_obj.assigned_classroom:
                    assigned_classrooms.append(teacher_obj.assigned_classroom)

                assigned_classrooms.extend(list(teacher_obj.classroom_set.all()))
                assigned_classrooms.extend(list(teacher_obj.assigned_classrooms.all()))
                assigned_classrooms = list(set([c for c in assigned_classrooms if c]))

                if assigned_classrooms and obj.classroom not in assigned_classrooms:
                    # Still allow if the teacher authored a result for this
                    # student (e.g. the student was promoted out of the class).
                    if obj.id not in _get_result_student_ids(user, role='teacher'):
                        from rest_framework.exceptions import PermissionDenied
                        raise PermissionDenied("You don't have permission to view this student.")

            except Teacher.DoesNotExist:
                # Teacher not synced to this service — check org_id only
                org_id = getattr(user, 'org_id', None)
                student_org_id = getattr(obj.organization, 'pk', None) if obj.organization else None
                if not org_id or student_org_id != org_id:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")

        elif user.role == 'org_admin':
            # Org Admin: Check if student belongs to their organization
            org_id = getattr(user.organization, 'pk', None) or getattr(user, 'org_id', None)
            student_org_id = getattr(obj.organization, 'pk', None) if obj.organization else None
            if not org_id or student_org_id != org_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to view this student.")
                
        elif user.is_principal():
            # Principal: Check if student is from their campus or organization
            campus_id = getattr(getattr(user, 'campus', None), 'id', None) or getattr(user, 'campus_id', None)
            campus = None
            if campus_id:
                try:
                    from campus.models import Campus
                    campus = Campus.objects.get(id=campus_id)
                except Exception:
                    pass

            if campus:
                if obj.campus != campus:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")
            else:
                org_id = getattr(user.organization, 'pk', None) or getattr(user, 'org_id', None)
                student_org_id = getattr(obj.organization, 'pk', None) if obj.organization else None
                if not org_id or student_org_id != org_id:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You don't have permission to view this student.")
                
        elif user.is_coordinator():
            # Coordinator: Check if student is from their assigned level
            try:
                managed_level_ids = _get_coordinator_level_ids(user)
                if managed_level_ids is None:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Coordinator profile not found.")
                if managed_level_ids and obj.classroom:
                    from classes.models import Level
                    student_level_id = obj.classroom.grade.level_id if obj.classroom.grade_id else None
                    if student_level_id and student_level_id not in managed_level_ids:
                        # Still allow if a result for this student is assigned
                        # to this coordinator (review access survives moves).
                        if obj.id not in _get_result_student_ids(user, role='coordinator'):
                            from rest_framework.exceptions import PermissionDenied
                            raise PermissionDenied("You don't have permission to view this student.")
            except PermissionDenied:
                raise
            except Exception:
                pass  # allow access rather than block on lookup error
        elif user.role == 'student':
            # Student: Can only view their own profile
            if obj.student_id != user.username:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to view this student.")
        
        return obj
    
    def perform_create(self, serializer):
        """Set actor and organization before creating student, with quota enforcement."""
        from rest_framework.exceptions import PermissionDenied

        user = self.request.user

        save_kwargs = {}
        org = getattr(user, 'organization', None)
        if org is None:
            from users.middleware import get_current_organization
            org = get_current_organization()

        if not user.is_superadmin() and org:
            # ── Student Quota Enforcement ──────────────────────────────────
            current_count = Student.objects.filter(organization=org).count()
            if current_count >= org.max_students:
                raise PermissionDenied(
                    f"Student quota exceeded. Your plan allows a maximum of "
                    f"{org.max_students} student(s). You currently have {current_count}. "
                    f"Please upgrade your subscription to enroll more students."
                )
            # ──────────────────────────────────────────────────────────────

            save_kwargs['organization'] = org
        
        # Explicitly set is_draft to False for new admissions via form
        save_kwargs['is_draft'] = False

        instance = serializer.save(**save_kwargs)
        instance._actor = user
        instance.save()
        self._ensure_student_user_account(instance)
        _notify_attendance_sync()

    def _ensure_student_user_account(self, student):
        """
        Auto-create a User account for the student if one does not exist yet.
        Username = student_id, default password = '12345'.
        Only runs when student_id is set (i.e., student is not a draft without an ID).
        """
        if not student.student_id:
            return
        
        from users.models import User
        
        # Determine the email to use: priority to student.email, fallback to placeholder
        actual_email = student.email if student.email else f"{student.student_id}@student.portal"
        
        user_obj = User.objects.filter(username=student.student_id).first()
        
        if user_obj:
            # If user exists, sync email if it changed or was placeholder and student now has one
            if student.email and user_obj.email != student.email:
                user_obj.email = student.email
                user_obj.save()
            return

        # Check if email is already taken by another user
        if User.objects.filter(email__iexact=actual_email).exists():
            # If the placeholder email is taken, we might have a collision, but for now we skip
            return
            
        try:
            u = User(
                username=student.student_id,
                email=actual_email,
                role='student',
                organization=student.organization,
                campus=student.campus,
                has_changed_default_password=False,
                is_verified=True,
            )
            u.set_password('12345')
            u.save()
            print(f"[STUDENT USER] Created user account for {student.student_id} with email {actual_email}")
        except Exception as e:
            print(f"[STUDENT USER] Could not create user account for {student.student_id}: {e}")

    def perform_update(self, serializer):
        """Set actor before updating student"""
        user = self.request.user
        instance = serializer.save()
        instance._actor = user
        instance.save()
        self._ensure_student_user_account(instance)
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure soft delete is used - NEVER calls default delete"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"[DESTROY] destroy() method called for DELETE request")
        
        # Get the instance
        instance = self.get_object()
        student_id = instance.id
        student_name = instance.name
        
        logger.info(f"[DESTROY] Got student instance: ID={student_id}, Name={student_name}, is_deleted={instance.is_deleted}")
        
        # Check if already deleted
        if instance.is_deleted:
            logger.warning(f"[DESTROY] Student {student_id} is already soft deleted")
            from rest_framework.exceptions import NotFound
            raise NotFound("Student is already deleted.")
        
        # IMPORTANT: Call perform_destroy which does soft delete
        # DO NOT call super().destroy() as it would do hard delete
        logger.info(f"[DESTROY] Calling perform_destroy() for soft delete")
        self.perform_destroy(instance)
        
        # Verify the student still exists in database (soft deleted, not hard deleted)
        try:
            from .models import Student
            # Use with_deleted() to check if student exists (even if soft deleted)
            still_exists = Student.objects.with_deleted().filter(pk=student_id).exists()
            if not still_exists:
                logger.error(f"[DESTROY] CRITICAL: Student {student_id} was HARD DELETED! This should not happen!")
                raise Exception(f"CRITICAL ERROR: Student {student_id} was permanently deleted instead of soft deleted!")
            else:
                # Check if it's soft deleted
                student_check = Student.objects.with_deleted().get(pk=student_id)
                if student_check.is_deleted:
                    logger.info(f"[DESTROY] SUCCESS: Student {student_id} is soft deleted (is_deleted=True)")
                else:
                    logger.error(f"[DESTROY] ERROR: Student {student_id} exists but is_deleted is False!")
        except Student.DoesNotExist:
            logger.error(f"[DESTROY] CRITICAL: Student {student_id} does not exist in database - was HARD DELETED!")
            raise Exception(f"CRITICAL ERROR: Student {student_id} was permanently deleted!")
        
        logger.info(f"[DESTROY] destroy() completed successfully")
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def perform_destroy(self, instance):
        """Soft delete student and create audit log"""
        # IMPORTANT: Do NOT call super().perform_destroy() as it would do hard delete
        # Store student info BEFORE soft delete (in case instance gets modified)
        student_id = instance.id
        student_name = instance.name
        student_campus = instance.campus
        
        # Get user name for audit log
        user = self.request.user
        user_name = user.get_full_name() if hasattr(user, 'get_full_name') else (user.username or 'Unknown')
        user_role = user.get_role_display() if hasattr(user, 'get_role_display') else (user.role or 'User')
        
        # Set actor for potential signal use (though soft_delete uses update() which bypasses signals)
        instance._actor = user
        
        # Log before soft delete
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[SOFT_DELETE] Starting soft delete for student ID: {student_id}, Name: {student_name}")
        logger.info(f"[SOFT_DELETE] Student is_deleted before: {instance.is_deleted}")
        
        # Soft delete the student (instead of hard delete)
        # This uses update() to directly modify database, does NOT call .delete()
        # This ensures no post_delete signal is triggered
        try:
            instance.soft_delete()
            logger.info(f"[SOFT_DELETE] soft_delete() method called successfully")
            
            # Verify soft delete worked
            instance.refresh_from_db()
            logger.info(f"[SOFT_DELETE] Student is_deleted after refresh: {instance.is_deleted}")
            
            if not instance.is_deleted:
                logger.error(f"[SOFT_DELETE] CRITICAL ERROR: Soft delete failed! Student {student_id} is_deleted is still False!")
                raise Exception(f"Soft delete failed for student {student_id} - is_deleted is still False after soft_delete() call")
            
            logger.info(f"[SOFT_DELETE] Soft delete successful for student {student_id}")
        except Exception as e:
            logger.error(f"[SOFT_DELETE] ERROR during soft_delete(): {str(e)}")
            raise
        
        dest_name = f"{classroom.grade.name} - {classroom.section}" if classroom else "No Classroom"
        return Response({
            'message': f'Successfully moved {updated_count} students to {dest_name}'
        })

    @action(detail=False, methods=['post'], url_path='bulk_mark_alumni')
    def bulk_mark_alumni(self, request):
        """
        Bulk mark students as Alumni.
        Removes classroom assignment, sets current_grade to 'Alumni',
        and marks the student as inactive.
        Expects: student_ids (list)
        """
        student_ids = request.data.get('student_ids', [])
        if not student_ids:
            return Response({'error': 'Missing student_ids'}, status=status.HTTP_400_BAD_REQUEST)

        students = Student.objects.filter(id__in=student_ids)
        updated_count = 0
        for student in students:
            prev_classroom = student.classroom
            student.classroom = None
            student.current_grade = 'Alumni'
            student.section = None
            student.is_active = False
            student.save()
            updated_count += 1

            # Audit log
        return Response({
            'message': f'Successfully marked {updated_count} student(s) as Alumni'
        })

    @action(detail=False, methods=['get'], url_path='zakat_status')
    def zakat_status(self, request):
        """Get zakat eligibility distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        status_data = queryset.values('zakat_status').annotate(
            count=Count('id')
        ).order_by('-count')
        
        data = []
        for item in status_data:
            s_raw = item['zakat_status']
            status_label = (s_raw or "").replace('_', ' ').title() or 'Not Specified'
            data.append({
                'name': status_label,
                'value': item['count']
            })
        
        return Response(data)

    @action(detail=False, methods=['get'], url_path='house_ownership')
    def house_ownership(self, request):
        """Get house ownership distribution"""
        queryset = self.filter_queryset(self.get_queryset())
        
        # Note: Model field is house_owned ('yes'/'no')
        ownership_data = queryset.values('house_owned').annotate(
            count=Count('id')
        ).order_by('-count')
        
        data = []
        for item in ownership_data:
            o_raw = item['house_owned']
            label = 'Owned' if o_raw == 'yes' else 'Rented' if o_raw == 'no' else 'Not Specified'
            data.append({
                'name': label,
                'value': item['count']
            })
        
        return Response(data)

    @action(detail=False, methods=['get'], url_path='total')
    def total_students(self, request):
        """Total active enrolled student count (honours dashboard filters)."""
        qs = self.filter_queryset(self.get_queryset())
        return Response({'totalStudents': qs.count()})

    @action(detail=False, methods=['get'], url_path='gender_stats')
    def gender_stats(self, request):
        qs = self.filter_queryset(self.get_queryset())
        counts = {row['gender']: row['count'] for row in qs.values('gender').annotate(count=Count('id'))}
        male = sum(v for k, v in counts.items() if (k or '').lower() == 'male')
        female = sum(v for k, v in counts.items() if (k or '').lower() == 'female')
        other = qs.count() - male - female
        return Response({'male': male, 'female': female, 'other': max(other, 0)})

    @action(detail=False, methods=['get'], url_path='campus_stats')
    def campus_stats(self, request):
        qs = self.filter_queryset(self.get_queryset())
        rows = qs.values('campus__campus_name').annotate(count=Count('id')).order_by('-count')
        return Response([
            {'campus': r['campus__campus_name'] or 'Unassigned', 'count': r['count']}
            for r in rows
        ])

    @action(detail=False, methods=['get'], url_path='grade_distribution')
    def grade_distribution(self, request):
        qs = self.filter_queryset(self.get_queryset())
        rows = qs.values('current_grade').annotate(count=Count('id')).order_by('current_grade')
        return Response([
            {'grade': (r['current_grade'] or 'Unassigned'), 'count': r['count']}
            for r in rows
        ])

    @action(detail=False, methods=['get'], url_path='religion_distribution')
    def religion_distribution(self, request):
        qs = self.filter_queryset(self.get_queryset())
        rows = qs.values('religion').annotate(count=Count('id')).order_by('-count')
        return Response([
            {'name': (r['religion'] or 'Not Specified').replace('_', ' ').title(), 'value': r['count']}
            for r in rows
        ])

    @action(detail=False, methods=['get'], url_path='mother_tongue_distribution')
    def mother_tongue_distribution(self, request):
        qs = self.filter_queryset(self.get_queryset())
        rows = qs.values('mother_tongue').annotate(count=Count('id')).order_by('-count')
        return Response([
            {'name': (r['mother_tongue'] or 'Not Specified').replace('_', ' ').title(), 'value': r['count']}
            for r in rows
        ])

    @action(detail=False, methods=['get'], url_path='enrollment_trend')
    def enrollment_trend(self, request):
        qs = self.filter_queryset(self.get_queryset())
        trend_mode = request.query_params.get('trend_mode')
        if trend_mode == 'month':
            from django.db.models.functions import ExtractMonth
            try:
                year = int(request.query_params.get('trend_year') or 0)
            except (TypeError, ValueError):
                year = 0
            if year:
                qs = qs.filter(created_at__year=year)
            rows = qs.annotate(m=ExtractMonth('created_at')).values('m').annotate(count=Count('id')).order_by('m')
            months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            by_month = {r['m']: r['count'] for r in rows if r['m']}
            return Response([{'month': months[i - 1], 'count': by_month.get(i, 0)} for i in range(1, 13)])
        rows = qs.values('enrollment_year').annotate(count=Count('id')).order_by('enrollment_year')
        return Response([
            {'year': r['enrollment_year'], 'count': r['count']}
            for r in rows if r['enrollment_year']
        ])

    @action(detail=False, methods=['get'], url_path='age_distribution')
    def age_distribution(self, request):
        from datetime import date
        qs = self.filter_queryset(self.get_queryset())
        today = date.today()
        buckets = {}
        for dob, gender in qs.values_list('dob', 'gender'):
            if not dob:
                continue
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            if age < 0 or age > 30:
                continue
            b = buckets.setdefault(age, {'age': age, 'male': 0, 'female': 0})
            if (gender or '').lower() == 'female':
                b['female'] += 1
            else:
                b['male'] += 1
        return Response([buckets[a] for a in sorted(buckets)])

    @action(detail=False, methods=['get'], url_path='form_options')
    def form_options(self, request):
        """
        Returns hardcoded lists of choices for dropdowns in frontend forms.
        This provides a single source of truth for choices across the system.
        """
        from students.models import FormOption
        from users.middleware import get_current_organization

        # Prefer org from middleware context (works for _TokenUser stateless JWT).
        # Falls back to request.user.organization for DB-backed user objects.
        org = get_current_organization()
        if org is None:
            org = getattr(request.user, 'organization', None)

        qs = FormOption.objects.filter(is_active=True)
        if org:
            qs = qs.filter(organization=org)
        else:
            qs = qs.filter(organization__isnull=True)

        default_seeds = {
            'gender': [('male', 'Male'), ('female', 'Female')],
            'religion': [('islam', 'Islam'), ('hinduism', 'Hinduism'), ('christianity', 'Christianity'), ('other', 'Other')],
            'mother_tongue': [('brohi', 'Brohi'), ('urdu', 'Urdu'), ('sindhi', 'Sindhi'), ('balochi', 'Balochi'), ('saraiki', 'Saraiki'), ('punjabi', 'Punjabi'), ('pashhto', 'Pashhto'), ('kashmiri', 'Kashmiri'), ('bangali', 'Bangali'), ('other', 'Other')],
            'nationality': [('pakistani', 'Pakistani'), ('foreign', 'Foreign')],
            'blood_group': [('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'), ('O+', 'O+'), ('O-', 'O-'), ('AB+', 'AB+'), ('AB-', 'AB-'), ('Unknown', 'Unknown')],
            'special_needs': [('none', 'None'), ('visual', 'Visual Impairment'), ('hearing', 'Hearing Impairment'), ('physical', 'Physical Disability'), ('learning', 'Learning Disability'), ('other', 'Other')],
            'emergency_relationship': [('father', 'Father'), ('mother', 'Mother'), ('guardian', 'Guardian'), ('relative', 'Other Relative')],
            'father_status': [('alive', 'Alive'), ('dead', 'Dead')],
            'mother_status': [('alive', 'Alive'), ('dead', 'Dead'), ('widowed', 'Widowed'), ('divorced', 'Divorced'), ('married', 'Married')],
            'marital_status': [('single', 'Single'), ('married', 'Married'), ('divorced', 'Divorced'), ('widowed', 'Widowed')],
            'shift': [('morning', 'Morning'), ('afternoon', 'Afternoon')],
            'section': [('A', 'A'), ('B', 'B'), ('C', 'C'), ('D', 'D'), ('E', 'E'), ('F', 'F')],
        }

        # Seed any missing categories individually so partial data never leaves gaps
        existing_categories = set(qs.values_list('category', flat=True))
        for cat, values in default_seeds.items():
            if cat not in existing_categories:
                for v, l in values:
                    FormOption.objects.get_or_create(
                        organization=org,
                        category=cat,
                        value=v,
                        defaults={'label': l, 'is_active': True}
                    )

        qs = FormOption.objects.filter(is_active=True)
        if org:
            qs = qs.filter(organization=org)
        else:
            qs = qs.filter(organization__isnull=True)

        options = {cat[0]: [] for cat in FormOption.OPTION_CATEGORIES}
        
        for opt in qs:
            options[opt.category].append({'value': opt.value, 'label': opt.label})
        return Response(options)


class StudentBulkUploadView(APIView):
    """Upload a CSV file to create multiple students at once."""
    permission_classes = [IsAuthenticated, IsSuperAdminOrPrincipal | HasDynamicPermission]
    required_permission = 'add_student'
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from .services.student_csv_import import import_students_from_csv

        upload = request.FILES.get('file')
        if not upload:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
        try:
            for chunk in upload.chunks():
                tmp.write(chunk)
            tmp.flush()
            tmp.close()
            reports = import_students_from_csv(tmp.name, request.user)

            # Audit log — one summary entry for the entire bulk upload
            return Response({'reports': reports}, status=status.HTTP_200_OK)
        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass


class StudentBulkUploadTemplateView(APIView):
    """Return a CSV template for bulk student upload."""
    permission_classes = [IsAuthenticated, IsSuperAdminOrPrincipal | HasDynamicPermission]
    required_permission = 'add_student'

    def get(self, request):
        from .services.student_csv_import import TEMPLATE_HEADERS, SAMPLE_ROW
        from django.http import HttpResponse

        # Build an Excel-friendly HTML table template
        html = ['<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/></head><body>']
        html.append('<table border="1"><tr>')
        
        # Header Row
        for h in TEMPLATE_HEADERS:
            html.append(f'<th style="background-color: #f2f2f2; font-weight: bold;">{h}</th>')
        html.append('</tr>')

        # Sample Row for guidance
        html.append('<tr>')
        for h in TEMPLATE_HEADERS:
            val = SAMPLE_ROW.get(h, '')
            html.append(f'<td>{val}</td>')
        html.append('</tr>')

        # Empty row for user to start
        html.append('<tr>')
        for _ in TEMPLATE_HEADERS:
            html.append('<td></td>')
        html.append('</tr>')
        
        html.append('</table></body></html>')
        content = ''.join(html)

        response = HttpResponse(content, content_type='application/vnd.ms-excel; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="student_bulk_upload_template.xls"'
        return response


# ── Enrollment status-change request workflow ────────────────────────────────
# Ported from the monolith into the microservice. Two adaptations for our
# structure: (1) request.user is a stateless _TokenUser, so we resolve it to a
# local users.User row before touching any User FK; (2) the KPI academic-year
# fallback is date-derived (the monolith read it from the result app, which is
# not part of student-service).
REVIEW_STATUS_ROLES = ('principal', 'org_admin', 'admin', 'superadmin')


def _local_user(request):
    """Resolve the stateless JWT _TokenUser to a local users.User row (or None)."""
    from users.models import User
    uid = getattr(request.user, 'id', None)
    if uid is None:
        return None
    return User.objects.filter(id=uid).first()


def _default_academic_year():
    """Current academic year 'YYYY-YY' with an April rollover."""
    from django.utils import timezone
    today = timezone.now().date()
    start = today.year if today.month >= 4 else today.year - 1
    return f"{start}-{str(start + 1)[-2:]}"


class TeacherEnrollmentRequestListView(APIView):
    """GET /api/students/enrollment-requests/mine/ — the current user's own
    enrollment-status change requests (any status), newest first."""
    permission_classes = [IsAuthenticated, IsTeacherOrAbove]

    def get(self, request):
        from .models import EnrollmentStatusRequest
        from .serializers import EnrollmentStatusRequestSerializer
        qs = EnrollmentStatusRequest.objects.filter(
            requested_by_id=getattr(request.user, 'id', None)
        ).select_related(
            'student', 'student__campus', 'requested_by', 'reviewed_by'
        ).order_by('-created_at')
        return Response(EnrollmentStatusRequestSerializer(qs, many=True).data)


class CoordinatorEnrollmentRequestListView(APIView):
    """GET /api/students/enrollment-requests/pending/ — pending requests for the
    coordinator's campus + managed levels. `?all=1` includes decided ones too."""
    permission_classes = [IsAuthenticated, IsCoordinatorOrAbove]

    def get(self, request):
        from coordinator.models import Coordinator
        from .models import EnrollmentStatusRequest
        from .serializers import EnrollmentStatusRequestSerializer

        coord = Coordinator.get_for_user(request.user)
        if not coord or not coord.campus:
            # Principal / admin without a coordinator profile: no extra scoping.
            if getattr(request.user, 'role', None) in REVIEW_STATUS_ROLES:
                qs = EnrollmentStatusRequest.objects.all()
            else:
                return Response({'error': 'No coordinator profile / campus.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            managed = [l for l in (list(coord.assigned_levels.all()) or ([coord.level] if coord.level else [])) if l]
            qs = EnrollmentStatusRequest.objects.filter(student__campus=coord.campus)
            if managed:
                # Match the student's current classroom level OR (for left/inactive
                # students whose classroom was cleared) their former classroom level.
                qs = qs.filter(
                    Q(student__classroom__grade__level__in=managed)
                    | Q(student__last_classroom__grade__level__in=managed)
                )

        if request.query_params.get('all') not in ('1', 'true', 'True'):
            qs = qs.filter(status='pending')
        qs = qs.select_related('student', 'student__campus', 'requested_by', 'reviewed_by').distinct()
        return Response(EnrollmentStatusRequestSerializer(qs, many=True).data)


class CoordinatorEnrollmentRequestApproveView(APIView):
    """POST /api/students/enrollment-requests/<pk>/approve/ (body: response?) —
    applies the requested change via Student.change_status()."""
    permission_classes = [IsAuthenticated, IsCoordinatorOrAbove]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        from django.utils import timezone
        from django.core.exceptions import ValidationError as DjangoValidationError
        from coordinator.models import Coordinator
        from notifications.services import create_notification
        from .models import EnrollmentStatusRequest
        from .serializers import EnrollmentStatusRequestSerializer

        req = get_object_or_404(EnrollmentStatusRequest, id=pk)
        coord = Coordinator.get_for_user(request.user)
        role = getattr(request.user, 'role', None)
        if not coord and role not in REVIEW_STATUS_ROLES:
            return Response({'error': 'Only a coordinator or above can review requests.'}, status=status.HTTP_403_FORBIDDEN)
        # A coordinator may only act within their own campus.
        if coord and req.student.campus_id != coord.campus_id:
            return Response({'error': 'This request is outside your campus.'}, status=status.HTTP_403_FORBIDDEN)
        if req.status != 'pending':
            return Response({'error': f'Request already {req.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        reviewer = _local_user(request)
        try:
            req.student.change_status(
                req.requested_status, req.event_date,
                reason=req.reason, reason_code=req.reason_code, user=reviewer,
            )
        except DjangoValidationError as e:
            detail = e.message_dict if hasattr(e, 'message_dict') else {'error': e.messages}
            return Response(detail, status=status.HTTP_400_BAD_REQUEST)

        req.status = 'approved'
        req.reviewed_by = reviewer
        req.coordinator_response = (request.data.get('response') or '').strip() or None
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'reviewed_by', 'coordinator_response', 'reviewed_at'])

        if req.requested_by_id:
            create_notification(
                recipient=req.requested_by, actor=reviewer,
                verb='enrollment_status_approved',
                target_text=f"Status change approved — {req.student.name} is now {req.get_requested_status_display()}.",
                data={'enrollment_request_id': req.id, 'student_id': req.student.id},
            )
        return Response(EnrollmentStatusRequestSerializer(req).data)


class CoordinatorEnrollmentRequestRejectView(APIView):
    """POST /api/students/enrollment-requests/<pk>/reject/ (body: response) —
    rejects the request (a reason is required)."""
    permission_classes = [IsAuthenticated, IsCoordinatorOrAbove]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        from django.utils import timezone
        from coordinator.models import Coordinator
        from notifications.services import create_notification
        from .models import EnrollmentStatusRequest
        from .serializers import EnrollmentStatusRequestSerializer

        req = get_object_or_404(EnrollmentStatusRequest, id=pk)
        coord = Coordinator.get_for_user(request.user)
        role = getattr(request.user, 'role', None)
        if not coord and role not in REVIEW_STATUS_ROLES:
            return Response({'error': 'Only a coordinator or above can review requests.'}, status=status.HTTP_403_FORBIDDEN)
        if coord and req.student.campus_id != coord.campus_id:
            return Response({'error': 'This request is outside your campus.'}, status=status.HTTP_403_FORBIDDEN)
        if req.status != 'pending':
            return Response({'error': f'Request already {req.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        response_reason = (request.data.get('response') or '').strip()
        if not response_reason:
            return Response({'error': 'A reason is required to reject the request.'}, status=status.HTTP_400_BAD_REQUEST)

        reviewer = _local_user(request)
        req.status = 'rejected'
        req.reviewed_by = reviewer
        req.coordinator_response = response_reason
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'reviewed_by', 'coordinator_response', 'reviewed_at'])

        if req.requested_by_id:
            create_notification(
                recipient=req.requested_by, actor=reviewer,
                verb='enrollment_status_rejected',
                target_text=f"Status change rejected for {req.student.name}: {response_reason}",
                data={'enrollment_request_id': req.id, 'student_id': req.student.id, 'reason': response_reason},
            )
        return Response(EnrollmentStatusRequestSerializer(req).data)


class EnrollmentKPIView(APIView):
    """Enrollment KPIs (Retention / Leavers / Dropout) from the status history.

    GET ?academic_year=2026-27[&campus_id=]
      - No campus_id  → whole org (org-scoped) — Org Admin view.
      - campus_id     → that campus only — Principal / campus view.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .enrollment_kpis import (
            calculate_retention_rate, calculate_leavers, calculate_dropout_rate,
            calculate_progression_rate,
        )
        academic_year = request.query_params.get('academic_year') or _default_academic_year()
        campus_id = request.query_params.get('campus_id')

        # A principal without an explicit campus_id is scoped to their own campus.
        is_principal = getattr(request.user, 'is_principal', None)
        if not campus_id and callable(is_principal) and is_principal():
            campus_id = getattr(request.user, 'campus_id', None)

        students = Student.objects.filter(
            is_deleted=False, is_draft=False
        ).prefetch_related('enrollment_events')
        if campus_id:
            students = students.filter(campus_id=campus_id)

        # A coordinator sees only their assigned levels — not the whole org.
        # Without this a coordinator hitting the endpoint would get org-wide
        # numbers, the same over-broad scope the attendance module closes.
        is_coordinator = getattr(request.user, 'is_coordinator', None)
        if callable(is_coordinator) and is_coordinator():
            level_ids = _get_coordinator_level_ids(request.user)
            if level_ids:
                students = students.filter(classroom__grade__level_id__in=level_ids)
            else:
                students = students.none()

        students_list = list(students)
        return Response({
            'academic_year': academic_year,
            'campus_id': int(campus_id) if campus_id else None,
            'retention': calculate_retention_rate(students_list, academic_year),
            'leavers': calculate_leavers(students_list, academic_year),
            'dropout': calculate_dropout_rate(students_list, academic_year),
            'progression': calculate_progression_rate(students_list, academic_year),
        })

