import psycopg2
from psycopg2.extras import RealDictCursor

SIS_DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'sms_iak_db',
    'user': 'erp_admin',
    'password': 'erp_admin_password_change_me_in_prod'
}

def investigate():
    conn = psycopg2.connect(**SIS_DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    print("--- SIS DATA INVESTIGATION ---")
    
    # 1. Users with employee roles
    cursor.execute("SELECT id, username, email, role FROM users_user WHERE role IN ('teacher', 'coordinator', 'principal')")
    users = cursor.fetchall()
    print(f"Total Users in SIS (T/C/P): {len(users)}")

    # 2. Profiles (Teachers/Coords/Principals)
    cursor.execute("SELECT email, full_name, 'teacher' as ptype FROM teachers_teacher")
    t_profiles = cursor.fetchall()
    cursor.execute("SELECT email, full_name, 'coordinator' as ptype FROM coordinator_coordinator")
    c_profiles = cursor.fetchall()
    cursor.execute("SELECT email, full_name, 'principal' as ptype FROM principals_principal")
    p_profiles = cursor.fetchall()
    
    all_profiles = t_profiles + c_profiles + p_profiles
    print(f"Total Profiles (T/C/P): {len(all_profiles)}")

    # 3. Find Users WITHOUT a matching Profile (Email join)
    user_emails = {u['email'].lower().strip() for u in users if u['email']}
    profile_emails = {p['email'].lower().strip() for p in all_profiles if p['email']}

    orphans_users = [u for u in users if u['email'].lower().strip() not in profile_emails]
    print(f"\nUsers without any Profile match (by email) [{len(orphans_users)}]:")
    for u in orphans_users:
        print(f"  - {u['username']} ({u['role']}) email: {u['email']}")

    # 4. Find Profiles WITHOUT a matching User (Email join)
    orphans_profiles = [p for p in all_profiles if p['email'].lower().strip() not in user_emails]
    print(f"\nProfiles without any User match (by email) [{len(orphans_profiles)}]:")
    # Limiting output if too many
    for p in orphans_profiles[:10]:
        print(f"  - {p['full_name']} ({p['ptype']}) email: {p['email']}")
    if len(orphans_profiles) > 10:
        print(f"  ... and {len(orphans_profiles)-10} more.")

    conn.close()

if __name__ == '__main__':
    investigate()
