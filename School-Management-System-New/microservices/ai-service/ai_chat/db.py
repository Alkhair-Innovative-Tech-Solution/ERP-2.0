import psycopg2
from django.conf import settings


def conn(db_cfg: dict):
    return psycopg2.connect(**db_cfg)


def student_conn():  return conn(settings.STUDENT_DB)
def attendance_conn(): return conn(settings.ATTENDANCE_DB)
def staff_conn():    return conn(settings.STAFF_DB)
def campus_conn():   return conn(settings.CAMPUS_DB)
def result_conn():   return conn(settings.RESULT_DB)
def timetable_conn(): return conn(settings.TIMETABLE_DB)


def fetchall(cursor, query, params=()):
    cursor.execute(query, params)
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def fetchone(cursor, query, params=()):
    cursor.execute(query, params)
    if not cursor.description:
        return None
    cols = [d[0] for d in cursor.description]
    row = cursor.fetchone()
    return dict(zip(cols, row)) if row else None
