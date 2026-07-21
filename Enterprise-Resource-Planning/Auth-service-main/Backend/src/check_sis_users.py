import psycopg2
from psycopg2.extras import RealDictCursor

SIS_DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'sms_iak_db',
    'user': 'erp_admin',
    'password': 'erp_admin_password_change_me_in_prod'
}

def check_users():
    try:
        conn = psycopg2.connect(**SIS_DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # List all tables to see what we have
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        tables = cur.fetchall()
        print("ALL TABLES:")
        for t in tables:
            print(f"- {t['table_name']}")
            
        # specifically look for user related tables
        print("\nUSER RELATED TABLES:")
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%user%'")
        user_tables = cur.fetchall()
        for t in user_tables:
            print(f"- {t['table_name']}")
            
        # If auth_user exists, show its columns
        if any(t['table_name'] == 'users_user' for t in user_tables):
            print("\nCOLUMNS IN users_user:")
            cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users_user'")
            cols = cur.fetchall()
            for c in cols:
                print(f"{c['column_name']:25} | {c['data_type']}")
                
            # Sample record (sensitive info hidden)
            print("\nSAMPLE RECORD (users_user):")
            cur.execute("SELECT id, username, email, is_active, last_login, password FROM users_user LIMIT 1")
            sample = cur.fetchone()
            if sample:
                for k, v in sample.items():
                    if k == 'password':
                        print(f"{k:25} | {v[:20]}...")
                    else:
                        print(f"{k:25} | {v}")

        # Check for user_id in profile tables
        profile_tables = ['teachers_teacher', 'coordinator_coordinator', 'principals_principal']
        print("\nUSER LINKS IN PROFILE TABLES:")
        for pt in profile_tables:
             cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{pt}' AND column_name LIKE '%user%'")
             links = cur.fetchall()
             print(f"- {pt:25} | Links: {[l['column_name'] for l in links]}")

        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == '__main__':
    check_users()
