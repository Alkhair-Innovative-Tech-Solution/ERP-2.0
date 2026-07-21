from rest_framework import status, views, permissions, viewsets
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from rest_framework.pagination import PageNumberPagination
import uuid
import logging

from .models import Test, TestAttempt, EntranceLead, Interview, ReceiptCode, AdminActionLog, Question
from .serializers import (
    TestSerializer, 
    TestWriteSerializer,
    TestAttemptSerializer, 
    AnswerSubmissionSerializer, 
    TestResultSerializer,
    EntranceLeadSerializer,
    InterviewSerializer,
    ReceiptCodeSerializer,
    QuestionWriteSerializer,
    QuestionAdminSerializer,
)
from .services import TestService, LMSService, EmailService

logger = logging.getLogger(__name__)

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 1000

class CheckRequirementView(views.APIView):
    permission_classes = [permissions.AllowAny] 

    def post(self, request):
        course_id = request.data.get('course_id')
        specialization_id = request.data.get('specialization_id')
        
        if not course_id:
            return Response({"error": "course_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        test = TestService.check_test_requirement(course_id, specialization_id)
        
        if test:
            return Response({
                "test_required": True,
                "test_id": test.id,
                "test_title": test.title,
                "passing_marks": test.passing_marks,
                "duration": test.duration
            })
        else:
            return Response({"test_required": False})

class GenerateTestLinkView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user_id = request.data.get('user_id')
        user_email = request.data.get('user_email')
        test_id = request.data.get('test_id')

        if not all([user_id, user_email, test_id]):
            return Response({"error": "Missing required fields"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from django.conf import settings
            token, attempt_id = TestService.generate_test_token(user_id, user_email, test_id)
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            test_url = f"{frontend_url}/test?token={token}" 
            
            return Response({
                "access_token": token,
                "test_url": test_url,
                "expires_in": 7200, 
                "attempt_id": attempt_id
            }, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class StartTestView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        attempt_id = request.auth.get('attempt_id')
        if not attempt_id:
             return Response({"error": "Invalid token claims"}, status=status.HTTP_401_UNAUTHORIZED)
        
        is_valid, error_msg = TestService.check_attempt_validity(attempt_id)
        if not is_valid:
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        attempt = get_object_or_404(TestAttempt, id=attempt_id)
        test = attempt.test
        serializer = TestSerializer(test)
        
        elapsed = timezone.now() - attempt.start_time
        time_remaining = max(0, (test.duration * 60) - elapsed.total_seconds())

        return Response({
            "attempt_id": attempt.id,
            "test_title": test.title,
            "duration": test.duration,
            "total_marks": test.total_marks,
            "questions": serializer.data['questions'],
            "start_time": attempt.start_time,
            "time_remaining": int(time_remaining)
        })

class SubmitTestView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = AnswerSubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        attempt_id = serializer.validated_data['attempt_id']
        answers = serializer.validated_data['answers']
        
        if str(request.auth.get('attempt_id')) != str(attempt_id):
            return Response({"error": "Attempt ID mismatch with token"}, status=status.HTTP_403_FORBIDDEN)

        is_valid, error_msg = TestService.check_attempt_validity(attempt_id)
        if not is_valid:
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        score, percentage, is_passed, enrollment_id = TestService.calculate_score(attempt_id, answers)
        attempt = TestAttempt.objects.get(id=attempt_id)

        return Response({
            "attempt_id": attempt.id,
            "score": score,
            "total_marks": attempt.test.total_marks,
            "percentage": round(percentage, 2),
            "passed": is_passed,
            "passing_marks": attempt.test.passing_marks,
            "enrollment_id": enrollment_id,
            "message": "Congratulations! You passed the test." if is_passed else "Sorry, you did not pass."
        })

class TestResultView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, attempt_id):
        user_id = request.user.id if hasattr(request.user, 'id') else request.auth.get('user_id')
        attempt = get_object_or_404(TestAttempt, id=attempt_id, user_id=user_id)
        
        if attempt.status == 'ongoing':
             return Response({"error": "Test is still ongoing"}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            "attempt_id": attempt.id,
            "test_title": attempt.test.title,
            "score": attempt.score,
            "total_marks": attempt.test.total_marks,
            "percentage": round(attempt.percentage, 2) if attempt.percentage else 0,
            "passed": attempt.is_passed,
            "status": attempt.status,
            "start_time": attempt.start_time,
            "end_time": attempt.end_time,
            "enrollment_status": attempt.enrollment_status,
            "lms_enrollment_id": attempt.lms_enrollment_id
        })

class LeadView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = EntranceLeadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        course_id = serializer.validated_data.get('course_id')
        email = serializer.validated_data.get('email')

        if email and course_id:
            existing = EntranceLead.objects.filter(
                email__iexact=email,
                course_id=course_id,
                is_deleted=False
            ).exclude(status='failed').order_by('-created_at').first()
            if existing:
                msg = (
                    "You already have a pending registration for this course."
                    if existing.status == 'pending'
                    else "You are already registered for this course. Please login."
                )
                return Response({
                    "error": msg,
                    "existing_lead_id": str(existing.id),
                    "status": existing.status,
                    "code": "DUPLICATE_LEAD"
                }, status=status.HTTP_409_CONFLICT)
        test = None
        test_required = False
        if course_id:
            test = Test.objects.filter(course_id=course_id, is_required=True).first()
            test_required = True
            if not test:
                test = Test.objects.filter(course_id=course_id).first()
                if not test or not test.is_required:
                    test_required = False

        with transaction.atomic():
            scheduled_class_id = request.data.get('scheduled_class_id')
            lead = serializer.save()
            if scheduled_class_id:
                try:
                    lead.scheduled_class_id = uuid.UUID(str(scheduled_class_id))
                    lead.save(update_fields=['scheduled_class_id'])
                except Exception as e:
                    logger.warning(f"Failed to set scheduled_class_id on lead {lead.id}: {e}")

            skip_email = request.data.get('skip_email', False)
            if not skip_email:
                if not test_required:
                    lead.status = 'passed'
                    lead.save()
                    EmailService.send_deposit_instructions(lead.name, lead.email)
                else:
                    EmailService.send_registration_confirmation(lead.name, lead.email)
            elif not test_required:
                lead.status = 'passed'
                lead.save()

        logger.info(f"Lead created: {lead.id}, course={course_id}, test_required={test_required}")
        return Response({
            "lead_id": lead.id,
            "test_id": test.id if test else None,
            "test_required": test_required,
            "status": lead.status,
            "message": "Lead created successfully"
        }, status=status.HTTP_201_CREATED)

class LeadStatusView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, lead_id):
        lead = get_object_or_404(EntranceLead, id=lead_id)
        data = EntranceLeadSerializer(lead).data
        test = Test.objects.filter(course_id=lead.course_id, is_required=True).first()
        data['test_required'] = test is not None
        data['passed'] = lead.status == 'passed'
        return Response(data)

class LeadLookupView(views.APIView):
    """Primary public lookup: find a lead by sequential ID + optional name/CNIC verification."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        seq_id = request.data.get('seq_id') or request.data.get('lead_auto_id')
        email = request.data.get('email')
        cnic = request.data.get('cnic_number')

        if not seq_id and not email:
            return Response({"error": "Provide seq_id (lead reference number) or email"}, status=status.HTTP_400_BAD_REQUEST)

        # Prefer lookup by sequential ID
        if seq_id:
            try:
                lead = EntranceLead.objects.get(lead_auto_id=int(seq_id))
            except (EntranceLead.DoesNotExist, ValueError):
                return Response({"error": "No lead found with this reference number"}, status=status.HTTP_404_NOT_FOUND)
        else:
            # Email lookup — return the most recent non-deleted lead
            # (caller disambiguates if multiple exist)
            lead = EntranceLead.objects.filter(email__iexact=email, is_deleted=False).order_by('-created_at').first()
            if not lead:
                return Response({"error": "No registration found for this email"}, status=status.HTTP_404_NOT_FOUND)

        data = EntranceLeadSerializer(lead).data
        test = Test.objects.filter(course_id=lead.course_id, is_required=True).first()
        data['test_required'] = test is not None
        data['passed'] = lead.status == 'passed'
        return Response(data)

class EntranceTestQuestionsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, lead_id):
        lead = get_object_or_404(EntranceLead, id=lead_id)
        test = Test.objects.filter(course_id=lead.course_id).first()
        
        if not test:
            return Response({"error": "No test found for this course"}, status=status.HTTP_404_NOT_FOUND)
        
        questions = test.questions.all()
        questions_data = []
        for q in questions:
            questions_data.append({
                "id": str(q.id),
                "question_text": q.question_text,
                "question_type": q.question_type,
                "marks": q.marks,
                "image": q.image.url if q.image else None,
                "options": [
                    {"id": "A", "option_text": q.option_a, "image": q.option_a_image.url if q.option_a_image else None},
                    {"id": "B", "option_text": q.option_b, "image": q.option_b_image.url if q.option_b_image else None},
                    {"id": "C", "option_text": q.option_c, "image": q.option_c_image.url if q.option_c_image else None},
                    {"id": "D", "option_text": q.option_d, "image": q.option_d_image.url if q.option_d_image else None},
                ]
            })
            
        return Response({
            "test_title": test.title,
            "questions_data": questions_data
        })

class EntranceTestSubmitView(views.APIView):
    permission_classes = [permissions.AllowAny]
    MAX_ATTEMPTS = 3

    def post(self, request, lead_id):
        lead = get_object_or_404(EntranceLead, id=lead_id)
        question_attempts = request.data.get('question_attempts', [])
        
        test = Test.objects.filter(course_id=lead.course_id).first()
        if not test:
            return Response({"error": "No assessment found for this course"}, status=status.HTTP_404_NOT_FOUND)
        
        questions = list(test.questions.all())
        if not questions:
            return Response({"error": "Test has no questions"}, status=status.HTTP_400_BAD_REQUEST)

        # --- Count existing attempts & enforce max ---
        existing_count = TestAttempt.objects.filter(
            user_email=lead.email,
            test=test
        ).count()

        if existing_count >= self.MAX_ATTEMPTS:
            return Response({
                "error": f"You have used all {self.MAX_ATTEMPTS} attempts. Please contact the admissions office."
            }, status=status.HTTP_403_FORBIDDEN)

        attempt_number = existing_count + 1

        questions_map = {str(q.id): q for q in questions}

        # --- Marks-based scoring ---
        total_score = 0
        total_marks = test.total_marks or sum(q.marks for q in questions)
        correct_count = 0

        answers_dict = {}
        for attempt in question_attempts:
            q_id = str(attempt.get('question_id'))
            raw = attempt.get('selected_option')
            selected = str(raw).upper() if raw else ''
            if isinstance(raw, list):
                selected = ','.join(sorted(str(s).upper() for s in raw))
            answers_dict[q_id] = selected
            if q_id in questions_map:
                question = questions_map[q_id]
                if question.question_type == 'multiple_choice':
                    expected = question.correct_answers or question.correct_answer
                    expected_set = set(expected.upper().split(','))
                    actual_set = set(selected.split(','))
                    if actual_set == expected_set:
                        total_score += question.marks
                        correct_count += 1
                else:
                    if selected == question.correct_answer.upper():
                        total_score += question.marks
                        correct_count += 1

        percentage = (total_score / total_marks * 100) if total_marks > 0 else 0
        is_passed = total_score >= test.passing_marks

        with transaction.atomic():
            # --- Create TestAttempt record ---
            attempt = TestAttempt.objects.create(
                user_id=lead.lms_user_id or uuid.uuid4(),
                user_email=lead.email,
                test=test,
                start_time=timezone.now(),
                end_time=timezone.now(),
                answers=answers_dict,
                score=total_score,
                percentage=round(percentage, 2),
                status='completed',
                is_passed=is_passed,
                attempt_number=attempt_number,
            )

            # --- Update lead ---
            lead.status = 'passed' if is_passed else 'failed'
            lead.test_score = total_score
            lead.test_attempt_id = attempt.id
            lead.save(update_fields=['status', 'test_score', 'test_attempt_id'])

            # --- Enrollment trigger on pass ---
            enrollment_id = None
            if is_passed:
                if lead.lms_user_id:
                    enrollment_id = LMSService.create_enrollment(
                        str(lead.lms_user_id), test.course_id, attempt.id
                    )
                    if enrollment_id:
                        attempt.enrollment_status = 'success'
                        attempt.lms_enrollment_id = enrollment_id
                        lead.status = 'enrolled'
                        lead.converted_to_student = True
                        lead.save(update_fields=['status', 'converted_to_student'])
                    else:
                        attempt.enrollment_status = 'pending'
                        lead.status = 'passed'
                        lead.save(update_fields=['status'])
                else:
                    attempt.enrollment_status = 'pending'
                    lead.status = 'passed'
                    lead.save(update_fields=['status'])

                attempt.save(update_fields=['enrollment_status', 'lms_enrollment_id'])

            EmailService.send_deposit_instructions(lead.name, lead.email, test.title) if is_passed else None
            if not is_passed:
                attempt.enrollment_status = 'none'
                attempt.save(update_fields=['enrollment_status'])

        remaining = self.MAX_ATTEMPTS - attempt_number
        logger.info(f"Test submitted: lead={lead_id}, test={test.id}, passed={is_passed}, score={total_score}/{total_marks}, attempt={attempt_number}/{self.MAX_ATTEMPTS}")
        return Response({
            "status": "PASSED" if is_passed else "FAILED",
            "score": total_score,
            "total_marks": total_marks,
            "percentage": round(percentage, 2),
            "correct_count": correct_count,
            "total_questions": len(questions),
            "passed": is_passed,
            "enrollment_id": str(enrollment_id) if enrollment_id else None,
            "attempt_id": str(attempt.id),
            "attempt_number": attempt_number,
            "max_attempts": self.MAX_ATTEMPTS,
            "attempts_remaining": remaining,
            "message": (
                "Congratulations! You passed the entrance test. Your enrollment is being processed."
                if is_passed else
                f"Sorry, you did not pass. You have {remaining} attempt(s) remaining." if remaining > 0 else
                "You have used all 3 attempts. Please contact the admissions office."
            )
        })

class LeadListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        show_archived = request.query_params.get('archived') == 'true'
        search = request.query_params.get('search', '')
        branch_id = request.query_params.get('branch_id')
        leads = EntranceLead.objects.filter(is_deleted=show_archived).order_by('-created_at')
        if branch_id:
            leads = leads.filter(branch_id=branch_id)
        if search:
            leads = leads.filter(
                Q(name__icontains=search) | 
                Q(email__icontains=search) | 
                Q(phone__icontains=search) |
                Q(course_name_requested__icontains=search)
            )
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(leads, request)
        if page is not None:
            serializer = EntranceLeadSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        serializer = EntranceLeadSerializer(leads, many=True)
        return Response(serializer.data)

class LeadListPaginatedView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        show_archived = request.query_params.get('archived') == 'true'
        search = request.query_params.get('search', '')
        branch_id = request.query_params.get('branch_id')
        leads = EntranceLead.objects.filter(is_deleted=show_archived).order_by('-created_at')
        if branch_id:
            leads = leads.filter(branch_id=branch_id)
        if search:
            leads = leads.filter(
                Q(name__icontains=search) | 
                Q(email__icontains=search) | 
                Q(phone__icontains=search) |
                Q(course_name_requested__icontains=search)
            )
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(leads, request)
        if page is not None:
            serializer = EntranceLeadSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        serializer = EntranceLeadSerializer(leads, many=True)
        return Response(serializer.data)

class LeadDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, lead_id):
        lead = get_object_or_404(EntranceLead, id=lead_id)
        serializer = EntranceLeadSerializer(lead, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            AdminActionLog.objects.create(
                admin_user_id=request.user.id if hasattr(request.user, 'id') else uuid.uuid4(),
                admin_name=request.user.full_name if hasattr(request.user, 'full_name') else "Admin",
                action_type="UPDATE",
                model_name="EntranceLead",
                object_id=str(lead.id),
                details={"changes": request.data}
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, lead_id):
        lead = get_object_or_404(EntranceLead, id=lead_id)
        lead.is_deleted = True
        lead.deleted_at = timezone.now()
        lead.save()
        AdminActionLog.objects.create(
            admin_user_id=request.user.id if hasattr(request.user, 'id') else uuid.uuid4(),
            admin_name=request.user.full_name if hasattr(request.user, 'full_name') else "Admin",
            action_type="DELETE",
            model_name="EntranceLead",
            object_id=str(lead.id)
        )
        return Response({"message": "Lead archived successfully"})

class LeadRestoreView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lead_id):
        lead = get_object_or_404(EntranceLead, id=lead_id)
        lead.is_deleted = False
        lead.deleted_at = None
        lead.save()
        AdminActionLog.objects.create(
            admin_user_id=request.user.id if hasattr(request.user, 'id') else uuid.uuid4(),
            admin_name=request.user.full_name if hasattr(request.user, 'full_name') else "Admin",
            action_type="RESTORE",
            model_name="EntranceLead",
            object_id=str(lead.id)
        )
        return Response({"message": "Lead restored successfully"})

class LeadByEmailView(views.APIView):
    """
    Returns ALL leads matching an email (as a list).
    Used internally by auth-service as fallback when receipt.lead FK is missing.
    The public-facing lookup should use LeadLookupView (seq_id based).
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        email = request.query_params.get('email')
        if not email:
            return Response({"error": "email is required"}, status=status.HTTP_400_BAD_REQUEST)
        leads = EntranceLead.objects.filter(email__iexact=email, is_deleted=False).order_by('-created_at')
        if not leads.exists():
            return Response({"error": "Lead not found"}, status=status.HTTP_404_NOT_FOUND)
        # Return lightweight list so auth-service can pick the most recent
        results = [{
            "id": str(l.id),
            "lead_auto_id": l.lead_auto_id,
            "name": l.name,
            "email": l.email,
            "status": l.status,
            "converted_to_student": l.converted_to_student,
            "course_id": str(l.course_id) if l.course_id else None,
            "scheduled_class_id": str(l.scheduled_class_id) if l.scheduled_class_id else None,
        } for l in leads]
        return Response(results)


class LeadBySeqIdView(views.APIView):
    """
    Public lookup by sequential reference number (lead_auto_id).
    This is the primary way students retrieve their record without requiring a unique email.
    GET /api/tests/lead/by-seq-id/?seq_id=1234
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        seq_id = request.query_params.get('seq_id')
        if not seq_id:
            return Response({"error": "seq_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            lead = EntranceLead.objects.get(lead_auto_id=int(seq_id), is_deleted=False)
        except (EntranceLead.DoesNotExist, ValueError):
            return Response({"error": "No lead found with this reference number"}, status=status.HTTP_404_NOT_FOUND)

        data = EntranceLeadSerializer(lead).data
        test = Test.objects.filter(course_id=lead.course_id, is_required=True).first()
        data['test_required'] = test is not None
        data['passed'] = lead.status in ('passed', 'enrolled')
        return Response(data)

class InterviewViewSet(viewsets.ModelViewSet):
    queryset = Interview.objects.all().order_by('-interview_date')
    serializer_class = InterviewSerializer
    permission_classes = [permissions.IsAuthenticated]


class ReceiptCodeListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        show_archived = request.query_params.get('archived') == 'true'
        search = request.query_params.get('search', '')
        page_size = int(request.query_params.get('page_size', 50))
        
        codes = ReceiptCode.objects.filter(is_deleted=show_archived)
        if search:
            codes = codes.filter(
                Q(student_name__icontains=search) | 
                Q(student_email__icontains=search) | 
                Q(code__icontains=search) |
                Q(receipt_number__icontains=search)
            )
        codes = codes.order_by('-generated_at')
        
        paginator = StandardResultsSetPagination()
        paginator.page_size = page_size
        page = paginator.paginate_queryset(codes, request)
        if page is not None:
            serializer = ReceiptCodeSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        serializer = ReceiptCodeSerializer(codes, many=True)
        return Response(serializer.data)

class ReceiptCodeCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data.copy()
        if ReceiptCode.objects.filter(code=data.get('code')).exists():
            return Response({"detail": "Receipt code already exists"}, status=status.HTTP_400_BAD_REQUEST)
        
        data['added_by_admin'] = str(request.user.id) if hasattr(request.user, 'id') else None
        data['added_to_system_at'] = timezone.now()
        
        # --- Auto-link to EntranceLead ---
        student_email = data.get('student_email', '')
        lead = None
        if student_email:
            lead = (
                EntranceLead.objects
                .filter(email__iexact=student_email, is_deleted=False)
                .order_by('-created_at')
                .first()
            )
            if lead:
                data['lead'] = str(lead.id)
                # Copy CNIC from lead if not provided
                if not data.get('cnic_number') and lead.cnic_number:
                    data['cnic_number'] = lead.cnic_number

        serializer = ReceiptCodeSerializer(data=data)
        if serializer.is_valid():
            receipt = serializer.save()
            # Sync the linked lead
            if lead:
                try:
                    update_fields = []
                    if lead.status not in ('passed', 'enrolled'):
                        lead.status = 'passed'
                        update_fields.append('status')
                    lead.has_paid_deposit = True
                    update_fields.append('has_paid_deposit')
                    if update_fields:
                        lead.save(update_fields=update_fields)
                except Exception as e:
                    logger.warning(f"Failed to sync lead for receipt {receipt.code}: {e}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ReceiptCodeDetailView(views.APIView):
    # 🔹 AllowAny for internal service-to-service calls (auth-service syncs receipt status)
    permission_classes = [permissions.AllowAny]

    def patch(self, request, code_id):
        receipt = get_object_or_404(ReceiptCode, id=code_id)
        serializer = ReceiptCodeSerializer(receipt, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, code_id):
        receipt = get_object_or_404(ReceiptCode, id=code_id)
        receipt.is_deleted = True
        receipt.deleted_at = timezone.now()
        receipt.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

class ReceiptCodeRestoreView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, code_id):
        receipt = get_object_or_404(ReceiptCode, id=code_id)
        receipt.is_deleted = False
        receipt.deleted_at = None
        receipt.save()
        return Response({"status": "restored"})

class ReceiptCodeProcessReturnView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, code_id):
        receipt = get_object_or_404(ReceiptCode, id=code_id)
        remarks = request.data.get('remarks', '')
        receipt.is_returned = True
        receipt.amount_returned = receipt.calculate_refund()
        receipt.returned_at = timezone.now()
        receipt.remarks = remarks
        receipt.save()
        serializer = ReceiptCodeSerializer(receipt)
        return Response(serializer.data)

class ReceiptCodeVerifyView(views.APIView):
    """Returns receipt code data by code string. Used by auth-service to look up deposit info."""
    permission_classes = [permissions.AllowAny]
    def get(self, request, code_str):
        receipt = get_object_or_404(ReceiptCode, code=code_str, is_deleted=False)
        serializer = ReceiptCodeSerializer(receipt)
        return Response(serializer.data)


class LeadConvertView(views.APIView):
    """
    Called by auth-service after a student successfully creates their LMS account.
    Marks the EntranceLead as converted and stores the LMS user UUID.
    """
    permission_classes = [permissions.AllowAny]  # Internal service-to-service call

    def post(self, request, lead_id):
        lead = get_object_or_404(EntranceLead, id=lead_id)
        lms_user_id = request.data.get('lms_user_id')

        if not lms_user_id:
            return Response({"error": "lms_user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        lead.converted_to_student = True
        lead.lms_user_id = lms_user_id
        lead.converted_at = timezone.now()
        lead.status = 'enrolled'
        lead.save(update_fields=['converted_to_student', 'lms_user_id', 'converted_at', 'status'])

        # Also mark all receipt codes for this lead as lms_account_created
        ReceiptCode.objects.filter(lead=lead).update(
            lms_account_created=True,
            lms_user_id=uuid.UUID(str(lms_user_id))
        )

        logger.info(f"Lead {lead_id} converted to student. LMS user: {lms_user_id}")
        return Response({
            "message": "Lead marked as converted",
            "lead_id": str(lead.id),
            "lms_user_id": str(lms_user_id),
        })


class LeadStatsView(views.APIView):
    """
    Returns admission pipeline funnel counts for the admin dashboard.
    GET /api/tests/lead-stats/
    Optional query param: branch_id=<uuid>
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        branch_id = request.query_params.get('branch_id')
        base_qs = EntranceLead.objects.filter(is_deleted=False)
        if branch_id:
            base_qs = base_qs.filter(branch_id=branch_id)
        total_leads = base_qs.count()
        passed_test = base_qs.filter(status__in=['passed', 'enrolled']).count()
        deposit_paid = base_qs.filter(has_paid_deposit=True).count()
        converted = base_qs.filter(converted_to_student=True).count()

        # Receipt code counts
        total_receipts = ReceiptCode.objects.filter(is_deleted=False).count()
        verified_receipts = ReceiptCode.objects.filter(is_deleted=False, verified=True).count()
        lms_accounts_created = ReceiptCode.objects.filter(is_deleted=False, lms_account_created=True).count()

        return Response({
            "pipeline": {
                "total_leads": total_leads,
                "passed_test": passed_test,
                "deposit_paid": deposit_paid,
                "converted_to_student": converted,
            },
            "receipts": {
                "total": total_receipts,
                "verified": verified_receipts,
                "lms_accounts_created": lms_accounts_created,
            }
        })

# ────────────────────────────────────────────────────────────────────────────
# ADMIN TEST MANAGEMENT
# ────────────────────────────────────────────────────────────────────────────

class TestListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tests = Test.objects.all().order_by('-created_at')
        serializer = TestSerializer(tests, many=True)
        return Response(serializer.data, status=200)

    def post(self, request):
        serializer = TestWriteSerializer(data=request.data)
        if serializer.is_valid():
            test = serializer.save()
            return Response(TestSerializer(test).data, status=201)
        return Response(serializer.errors, status=400)

class TestDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk):
        return get_object_or_404(Test, pk=pk)

    def get(self, request, pk):
        test = self.get_object(pk)
        serializer = TestSerializer(test)
        return Response(serializer.data, status=200)

    def put(self, request, pk):
        test = self.get_object(pk)
        serializer = TestWriteSerializer(test, data=request.data, partial=True)
        if serializer.is_valid():
            test = serializer.save()
            return Response(TestSerializer(test).data, status=200)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        test = self.get_object(pk)
        test.delete()
        return Response({"message": "Test deleted successfully."}, status=200)


# ────────────────────────────────────────────────────────────────────────────
# QUESTION MANAGEMENT
# ────────────────────────────────────────────────────────────────────────────

class QuestionListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, test_id):
        test = get_object_or_404(Test, pk=test_id)
        questions = test.questions.all().order_by('difficulty', 'id')
        serializer = QuestionAdminSerializer(questions, many=True)
        return Response(serializer.data, status=200)

    def post(self, request, test_id):
        test = get_object_or_404(Test, pk=test_id)
        data = request.data.copy()
        if isinstance(data, list):
            serializer = QuestionWriteSerializer(data=data, many=True)
            if serializer.is_valid():
                questions = serializer.save(test=test)
                return Response(QuestionAdminSerializer(questions, many=True).data, status=201)
            return Response(serializer.errors, status=400)
        else:
            data['test'] = test_id
            serializer = QuestionWriteSerializer(data=data)
            if serializer.is_valid():
                question = serializer.save()
                return Response(QuestionAdminSerializer(question).data, status=201)
            return Response(serializer.errors, status=400)

class QuestionDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk):
        return get_object_or_404(Question, pk=pk)

    def put(self, request, pk):
        question = self.get_object(pk)
        serializer = QuestionWriteSerializer(question, data=request.data, partial=True)
        if serializer.is_valid():
            question = serializer.save()
            return Response(QuestionAdminSerializer(question).data, status=200)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        question = self.get_object(pk)
        question.delete()
        return Response({"message": "Question deleted successfully."}, status=200)


# ────────────────────────────────────────────────────────────────────────────
# TEST ATTEMPTS (admin view, filterable by user_id)
# ────────────────────────────────────────────────────────────────────────────

class TestAttemptListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = TestAttempt.objects.all().order_by('-start_time')
        user_id = request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)
        test_id = request.query_params.get('test_id')
        if test_id:
            qs = qs.filter(test_id=test_id)
        status_param = request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        serializer = TestAttemptSerializer(qs, many=True)
        return Response({"attempts": serializer.data}, status=200)


# ────────────────────────────────────────────────────────────────────────────
# QUESTION IMAGE UPLOAD
# ────────────────────────────────────────────────────────────────────────────

class QuestionImageUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, question_id):
        question = get_object_or_404(Question, pk=question_id)
        field = request.data.get('field', 'image')
        file = request.FILES.get('file')
        if not file:
            return Response({"error": "No file provided"}, status=400)
        allowed_fields = ['image', 'option_a_image', 'option_b_image', 'option_c_image', 'option_d_image']
        if field not in allowed_fields:
            return Response({"error": f"Invalid field. Must be one of: {', '.join(allowed_fields)}"}, status=400)
        setattr(question, field, file)
        question.save()
        serializer = QuestionAdminSerializer(question)
        return Response(serializer.data, status=200)


# ────────────────────────────────────────────────────────────────────────────
# QUESTION REORDER
# ────────────────────────────────────────────────────────────────────────────

class QuestionReorderView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, test_id):
        test = get_object_or_404(Test, pk=test_id)
        order_data = request.data.get('order', [])
        if not isinstance(order_data, list) or not order_data:
            return Response({"error": "order must be a non-empty list of question IDs"}, status=400)

        question_ids = [str(q.id) for q in test.questions.all()]
        updated = 0
        for idx, qid in enumerate(order_data):
            if str(qid) in question_ids:
                Question.objects.filter(id=qid, test=test).update(order=idx)
                updated += 1

        questions = test.questions.all().order_by('order', 'id')
        serializer = QuestionAdminSerializer(questions, many=True)
        return Response({"message": f"Reordered {updated} questions", "questions": serializer.data}, status=200)


# ────────────────────────────────────────────────────────────────────────────
# ADMIN LEAD SCORE OVERRIDE
# ────────────────────────────────────────────────────────────────────────────

class LeadScoreOverrideView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lead_id):
        lead = get_object_or_404(EntranceLead, id=lead_id)
        score = request.data.get('score')
        status_override = request.data.get('status')
        reason = request.data.get('reason', '')

        prev_score = lead.test_score
        prev_status = lead.status

        if score is not None:
            try:
                lead.test_score = int(score)
            except (ValueError, TypeError):
                return Response({"error": "Invalid score value"}, status=400)

        if status_override:
            allowed_statuses = ['pending', 'passed', 'failed', 'enrolled']
            if status_override not in allowed_statuses:
                return Response({"error": f"Status must be one of: {', '.join(allowed_statuses)}"}, status=400)
            lead.status = status_override
            if status_override in ['passed', 'enrolled'] and not lead.converted_to_student:
                lead.converted_to_student = True

        lead.save()

        AdminActionLog.objects.create(
            admin_user_id=request.user.id if hasattr(request.user, 'id') else uuid.uuid4(),
            admin_name=request.user.full_name if hasattr(request.user, 'full_name') else "Admin",
            action_type="SCORE_OVERRIDE",
            model_name="EntranceLead",
            object_id=str(lead.id),
            details={
                "score": score,
                "status": status_override,
                "reason": reason,
                "previous_score": prev_score,
                "previous_status": prev_status,
            }
        )

        serializer = EntranceLeadSerializer(lead)
        return Response(serializer.data, status=200)


# ────────────────────────────────────────────────────────────────────────────
# LEAD TEST SCORING (admin-triggered manual scoring)
# ────────────────────────────────────────────────────────────────────────────

class LeadManualScoreView(views.APIView):
    """Admin/coordinator manually scores a lead's test and updates the lead record."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lead_id):
        lead = get_object_or_404(EntranceLead, id=lead_id)
        score = request.data.get('score')
        total_marks = request.data.get('total_marks', 100)
        set_passed = request.data.get('set_passed', None)

        if score is None:
            return Response({"error": "score is required"}, status=400)

        try:
            score = int(score)
            total_marks = int(total_marks)
        except (ValueError, TypeError):
            return Response({"error": "Invalid numeric value"}, status=400)

        percentage = (score / total_marks * 100) if total_marks > 0 else 0
        test = Test.objects.filter(course_id=lead.course_id).first()
        passing_threshold = test.passing_marks if test else 50
        is_passed = set_passed if set_passed is not None else (percentage >= passing_threshold)

        lead.test_score = score
        lead.status = 'passed' if is_passed else 'failed'
        if is_passed and not lead.converted_to_student:
            lead.converted_to_student = True
        lead.save()

        AdminActionLog.objects.create(
            admin_user_id=request.user.id if hasattr(request.user, 'id') else uuid.uuid4(),
            admin_name=request.user.full_name if hasattr(request.user, 'full_name') else "Admin",
            action_type="MANUAL_SCORE",
            model_name="EntranceLead",
            object_id=str(lead.id),
            details={"score": score, "total_marks": total_marks, "percentage": round(percentage, 2), "passed": is_passed}
        )

        return Response({
            "id": str(lead.id),
            "test_score": lead.test_score,
            "percentage": round(percentage, 2),
            "status": lead.status,
            "passed": is_passed,
            "message": f"Lead score updated to {score}/{total_marks} ({round(percentage, 1)}%). Status: {lead.status}"
        }, status=200)
