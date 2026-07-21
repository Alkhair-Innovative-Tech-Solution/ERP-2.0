from users.models import User, Student
import uuid

uid = '616666e5-cde2-4b2b-a757-df5b3d4c80b2'
u = User.objects.filter(id=uid).first()
if u:
    print('Found user:', u.email, u.role)
else:
    print('User not found, checking Student model...')
    s = Student.objects.filter(student_id__isnull=False).first()
    print('Sample student:', s.student_id, s.user_id)
    u2 = User.objects.filter(id=s.user_id).first()
    print('Student user:', u2.email if u2 else 'NOT FOUND')
    u2.set_password('test123')
    u2.save()
    print('Password set for student')
