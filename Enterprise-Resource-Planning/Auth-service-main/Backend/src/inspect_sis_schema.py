import psycopg2
from psycopg2.extras import RealDictCursor

def inspect_sis():
    SIS_DB_CONFIG = {
        'host': 'localhost',
        'port': 5432,
        'database': 'sms_iak_db',
        'user': 'erp_admin',
        'password': 'erp_admin_password_change_me_in_prod'
    }
    
    conn = psycopg2.connect(**SIS_DB_CONFIG)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    tables = [
        'campus_campus',
        'teachers_teacher',
        'coordinator_coordinator',
        'principals_principal'
    ]
    
    for t in tables:
        print(f"\nTABLE: {t}")
        print("-" * 30)
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = %s
            ORDER BY ordinal_position
        """, (t,))
        columns = cursor.fetchall()
        for col in columns:
            print(f"{col['column_name']:25} | {col['data_type']:15} | Null: {col['is_nullable']}")

    conn.close()

if __name__ == '__main__':
    inspect_sis()
