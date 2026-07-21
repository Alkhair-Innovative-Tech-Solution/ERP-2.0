import psycopg2
from psycopg2.extras import RealDictCursor

SIS_DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'sms_iak_db',
    'user': 'erp_admin',
    'password': 'erp_admin_password_change_me_in_prod'
}

def check_details():
    try:
        conn = psycopg2.connect(**SIS_DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("COLUMNS IN coordinator_coordinator:")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'coordinator_coordinator'")
        cols = cur.fetchall()
        for c in cols:
            print(f"{c['column_name']:25} | {c['data_type']}")
            
        print("\nDISTINCT ROLES IN users_user:")
        cur.execute("SELECT DISTINCT role FROM users_user")
        roles = cur.fetchall()
        for r in roles:
            print(f"- {r['role']}")
            
        print("\nCHECKING FOR coordinator IN users_user role:")
        cur.execute("SELECT id, username, email, role FROM users_user WHERE role ILIKE '%coord%' LIMIT 5")
        coords = cur.fetchall()
        for c in coords:
            print(f"{c}")

        conn.close()
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == '__main__':
    check_details()
