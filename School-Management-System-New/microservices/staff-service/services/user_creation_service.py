from django.contrib.auth.hashers import make_password
from django.db import transaction
from users.models import User
from utils.id_generator import IDGenerator

class UserCreationService:
    DEFAULT_PASSWORD = '12345'
    
    @staticmethod
    def validate_entity_data(entity, entity_type):
        """Validate required fields for entity"""
        required_fields = {
            'teacher': ['full_name', 'email', 'contact_number'],  # joining_date remove karo
            'principal': ['full_name', 'email', 'contact_number', 'campus', 'joining_date']
        }

        # Special validation for coordinator: require either single level or assigned_levels when shift == 'both'
        if entity_type == 'coordinator':
            base_fields = ['full_name', 'email', 'contact_number', 'campus', 'joining_date']
            for field in base_fields:
                value = getattr(entity, field, None)
                if not value or (isinstance(value, str) and not value.strip()):
                    return False, f"Missing or empty field: {field}"
            # Level requirements
            has_single_level = getattr(entity, 'level_id', None) is not None
            has_multi_levels = hasattr(entity, 'assigned_levels') and entity.assigned_levels.exists()
            if not has_single_level and not has_multi_levels:
                return False, "Missing or empty field: level"
            return True, "Valid"

        for field in required_fields.get(entity_type, []):
            value = getattr(entity, field, None)
            if not value or (isinstance(value, str) and not value.strip()):
                return False, f"Missing or empty field: {field}"
        
        return True, "Valid"
    
    @staticmethod
    def generate_employee_code(entity, entity_type):
        """Generate employee code for entity"""
        try:
            # If entity already has an employee_code (generated in model.save),
            # reuse it instead of generating a new one. This prevents the
            # global role counter from being incremented twice and ensures
            # continuous sequences without gaps (e.g. ...T-0008, T-0009, T-0010).
            existing_code = getattr(entity, "employee_code", None)
            if existing_code:
                return existing_code

            # Get campus field based on entity type
            if entity_type == 'teacher':
                campus = entity.current_campus
            else:
                campus = entity.campus
                
            if not campus:
                raise ValueError("Campus is required for employee code generation")
                
            # Prefer entity's own shift if available (teacher/coordinator/principal)
            if hasattr(entity, 'shift') and entity.shift:
                shift = entity.shift
            else:
                shift = getattr(campus, 'shift_available', 'morning')
            
            # Get year from joining date or current year
            if hasattr(entity, 'joining_date') and entity.joining_date:
                if isinstance(entity.joining_date, str):
                    from datetime import datetime
                    joining_date = datetime.strptime(entity.joining_date, '%Y-%m-%d').date()
                    year = joining_date.year
                else:
                    year = entity.joining_date.year
            else:
                year = 2025  # Default year if no joining_date
            
            return IDGenerator.generate_unique_employee_code(
                campus, shift, year, entity_type
            )
        except Exception as e:
            raise ValueError(f"Failed to generate employee code: {str(e)}")
    
    @staticmethod
    def create_user_from_entity(entity, entity_type):
        """Create user from entity with full validation"""
        try:
            # Validate entity data
            is_valid, error_msg = UserCreationService.validate_entity_data(entity, entity_type)
            if not is_valid:
                return None, f"Validation failed: {error_msg}"
            
            # Check if user already exists
            if User.objects.filter(email=entity.email).exists():
                return None, "User with this email already exists"
            
            # Generate employee code
            employee_code = UserCreationService.generate_employee_code(entity, entity_type)
            
            # Get campus field based on entity type
            if entity_type == 'teacher':
                campus = entity.current_campus
            else:
                campus = entity.campus
            
            # Create user with transaction (no I/O inside — keeps transaction short)
            with transaction.atomic():
                user = User.objects.create(
                    username=employee_code,
                    email=entity.email,
                    first_name=entity.full_name.split()[0] if entity.full_name else '',
                    last_name=' '.join(entity.full_name.split()[1:]) if len(entity.full_name.split()) > 1 else '',
                    role=entity_type,
                    campus=campus,
                    organization=getattr(entity, 'organization', None),
                    phone_number=entity.contact_number,
                    password=make_password(UserCreationService.DEFAULT_PASSWORD),
                    is_verified=True,
                )
                entity.employee_code = employee_code
                entity.save()

            # Sync to auth-service OUTSIDE transaction so HTTP timeout never rolls back DB write
            UserCreationService._sync_user_to_auth(user, entity)

            # Phase B4 dual-write: also land this identity in central auth's
            # SMS01 tenant, no-ops unless SYNC_TO_CENTRAL_AUTH=true. Covers
            # every caller of create_user_from_entity — all three staff
            # signals, populate_teachers_from_csv, and
            # create_users_for_existing_entities — through this one spot.
            from services.central_auth_sync_service import sync_staff_entity_to_central_auth
            sync_staff_entity_to_central_auth(user, entity, entity_type)

            # Send credentials email — failure never blocks user creation
            try:
                from services.email_notification_service import EmailNotificationService
                email_sent, email_message = EmailNotificationService.send_credentials_email(
                    user, employee_code, entity_type
                )
                if email_sent:
                    print(f"[OK] Credentials email sent to {user.email}")
                else:
                    print(f"[WARN] Failed to send email: {email_message}")
            except Exception as email_err:
                print(f"[WARN] Email send failed (user created OK): {email_err}")

            return user, "User created successfully"
                
        except Exception as e:
            return None, f"Failed to create user: {str(e)}"
    
    @staticmethod
    def _sync_user_to_auth(user, entity):
        """Call auth-service internal API to create the user there too."""
        import os, json
        import urllib.request, urllib.error
        auth_url = os.getenv('AUTH_SERVICE_URL', 'http://auth-service:8001')
        secret = os.getenv('INTERNAL_SERVICE_SECRET', '')
        org = getattr(entity, 'organization', None)
        org_data = None
        if org:
            org_data = {
                'id': org.id,
                'name': org.name,
                'code_prefix': getattr(org, 'code_prefix', None),
                'code_pattern': getattr(org, 'code_pattern', 'PREFIX_SEQ4'),
            }
        payload = json.dumps({
            'email': user.email,
            'password': UserCreationService.DEFAULT_PASSWORD,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'organization': org_data,
            'campus_id': user.campus_id,
            'phone_number': getattr(user, 'phone_number', '') or '',
            'has_changed_default_password': False,
        }).encode()
        try:
            req = urllib.request.Request(
                f'{auth_url}/api/internal/create-user/',
                data=payload,
                headers={'Content-Type': 'application/json', 'X-Internal-Secret': secret},
                method='POST',
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                print(f"[AUTH-SYNC] User {user.email} created in auth-service (status {resp.status}).")
        except urllib.error.HTTPError as e:
            if e.code == 409:
                print(f"[AUTH-SYNC] User {user.email} already exists in auth-service.")
            else:
                print(f"[AUTH-SYNC] Warning: auth-service returned {e.code}: {e.read().decode()[:200]}")
        except Exception as e:
            print(f"[AUTH-SYNC] Could not reach auth-service: {e}")

    @staticmethod
    def create_users_for_existing_entities():
        """Create users for existing entities without users"""
        from teachers.models import Teacher
        from coordinator.models import Coordinator
        from principals.models import Principal

        results = {
            'teachers': {'created': 0, 'failed': 0, 'errors': []},
            'coordinators': {'created': 0, 'failed': 0, 'errors': []},
            'principals': {'created': 0, 'failed': 0, 'errors': []}
        }

        # Process teachers
        for teacher in Teacher.objects.filter(employee_code__isnull=True):
            user, message = UserCreationService.create_user_from_entity(teacher, 'teacher')
            if user:
                results['teachers']['created'] += 1
            else:
                results['teachers']['failed'] += 1
                results['teachers']['errors'].append(f"Teacher {teacher.id}: {message}")

        # Process coordinators
        for coordinator in Coordinator.objects.filter(employee_code__isnull=True):
            user, message = UserCreationService.create_user_from_entity(coordinator, 'coordinator')
            if user:
                results['coordinators']['created'] += 1
            else:
                results['coordinators']['failed'] += 1
                results['coordinators']['errors'].append(f"Coordinator {coordinator.id}: {message}")

        # Process principals
        for principal in Principal.objects.filter(employee_code__isnull=True):
            user, message = UserCreationService.create_user_from_entity(principal, 'principal')
            if user:
                results['principals']['created'] += 1
            else:
                results['principals']['failed'] += 1
                results['principals']['errors'].append(f"Principal {principal.id}: {message}")

        return results