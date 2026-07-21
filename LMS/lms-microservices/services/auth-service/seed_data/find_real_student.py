from users.models import User
students = User.objects.filter(role='student').exclude(email__contains='ait.iak.ngo').values('full_name', 'email')[:5]
for s in students:
    print(f"Name: {s['full_name']} | Email: {s['email']}")
