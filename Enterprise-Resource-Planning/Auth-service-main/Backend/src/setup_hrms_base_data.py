import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from employees.models import Organization, Institution, Department, Designation

def setup_base_data():
    print("🚀 Starting HRMS Base Data Setup...")
    
    # 1. Ensure Organization exists
    org, created = Organization.objects.get_or_create(
        org_code="IAK",
        defaults={"name": "Al-Khair Foundation"}
    )
    if created:
        print(f"✅ Created Organization: {org}")
    else:
        print(f"ℹ️ Organization already exists: {org}")

    # 2. Create Al-Khair Schools Institution
    inst, created = Institution.objects.get_or_create(
        inst_code="AKS",
        defaults={
            "name": "Al-Khair Schools",
            "inst_type": "educational",
            "organization": org
        }
    )
    if created:
        print(f"✅ Created Institution: {inst}")
    else:
        print(f"ℹ️ Institution already exists: {inst}")

    # 3. Create Departments
    depts = [
        {"name": "Academic", "code": "ACAD"},
        {"name": "Administration", "code": "ADMIN"},
    ]
    
    created_depts = {}
    for d_info in depts:
        dept, created = Department.objects.get_or_create(
            institution=inst,
            dept_code=d_info["code"],
            defaults={"dept_name": d_info["name"]}
        )
        created_depts[d_info["name"]] = dept
        if created:
            print(f"✅ Created Department: {dept}")
        else:
            print(f"ℹ️ Department already exists: {dept}")

    # 4. Create Designations
    roles = [
        {"name": "Teacher", "code": "T", "dept": "Academic"},
        {"name": "Coordinator", "code": "C", "dept": "Academic"},
        {"name": "Principal", "code": "P", "dept": "Administration"},
    ]
    
    for r_info in roles:
        dept = created_depts[r_info["dept"]]
        designation, created = Designation.objects.get_or_create(
            department=dept,
            position_code=r_info["code"],
            defaults={"position_name": r_info["name"]}
        )
        if created:
            print(f"✅ Created Designation: {designation}")
        else:
            print(f"ℹ️ Designation already exists: {designation}")

    print("\n🎉 Base data setup complete! Now you are ready for Phase 3 (Campus Migration).")

if __name__ == '__main__':
    setup_base_data()
