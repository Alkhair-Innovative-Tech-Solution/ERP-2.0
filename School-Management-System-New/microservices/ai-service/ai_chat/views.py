import json
import urllib.request
from datetime import date

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import TOOL_PERMISSIONS, ROLE_DISPLAY
from .db import student_conn, attendance_conn, staff_conn, campus_conn, result_conn, timetable_conn, fetchall, fetchone

GEMINI_MODEL = "gemini-2.5-flash"

ALL_FUNCTION_DECLARATIONS = [
    {"name": "get_students", "description": "Get list of students with optional filters.", "parameters": {"type": "OBJECT", "properties": {"campus_name": {"type": "STRING"}, "current_state": {"type": "STRING", "description": "active, inactive, or alumni"}, "current_grade": {"type": "STRING"}, "gender": {"type": "STRING"}, "added_on": {"type": "STRING", "description": "YYYY-MM-DD or 'today'"}, "limit": {"type": "INTEGER"}}}},
    {"name": "get_absent_students", "description": "Get students absent on a date.", "parameters": {"type": "OBJECT", "properties": {"date": {"type": "STRING", "description": "YYYY-MM-DD, default today"}, "campus_name": {"type": "STRING"}, "grade": {"type": "STRING"}}}},
    {"name": "get_attendance_summary", "description": "Get attendance statistics for a date.", "parameters": {"type": "OBJECT", "properties": {"date": {"type": "STRING"}, "campus_name": {"type": "STRING"}}}},
    {"name": "get_teachers", "description": "Get teachers list.", "parameters": {"type": "OBJECT", "properties": {"campus_name": {"type": "STRING"}, "is_active": {"type": "BOOLEAN"}, "limit": {"type": "INTEGER"}}}},
    {"name": "get_campus_list", "description": "Get all campuses with student/teacher counts.", "parameters": {"type": "OBJECT", "properties": {}}},
    {"name": "get_coordinators", "description": "Get coordinators list.", "parameters": {"type": "OBJECT", "properties": {"campus_name": {"type": "STRING"}, "limit": {"type": "INTEGER"}}}},
    {"name": "get_results_summary", "description": "Get exam results summary — pass/fail/absent counts, average percentage.", "parameters": {"type": "OBJECT", "properties": {"exam_type": {"type": "STRING", "description": "monthly, midterm, or final"}, "academic_year": {"type": "STRING"}, "campus_name": {"type": "STRING"}, "current_grade": {"type": "STRING"}}}},
    {"name": "get_transfers", "description": "Get student transfer records.", "parameters": {"type": "OBJECT", "properties": {"transfer_type": {"type": "STRING", "description": "class, shift, or campus"}, "status": {"type": "STRING"}, "campus_name": {"type": "STRING"}, "limit": {"type": "INTEGER"}}}},
    {"name": "get_my_results", "description": "Get logged-in student's own exam results.", "parameters": {"type": "OBJECT", "properties": {"exam_type": {"type": "STRING"}, "academic_year": {"type": "STRING"}}}},
    {"name": "get_my_attendance", "description": "Get logged-in student's own attendance summary.", "parameters": {"type": "OBJECT", "properties": {}}},
]

_BEHAVIOR_RULES = """
BEHAVIOR RULES:
- Respond in the SAME language the user writes in: Roman Urdu, Urdu, or English
- ALWAYS call a function first to get real data — never guess or make up numbers
- ONLY call tools that are in your ALLOWED TOOLS list above
- Be concise. Show total count clearly (e.g. "42 students")
- "active students" = current_state=active (Alumni excluded)
- Campus by number: "Campus 3" → use campus_name="Campus 3"
- "aaj add hue / naye daakhil / today admitted" → get_students with added_on="today"
- If a tool returns an error or empty data, tell the user clearly
"""

_ROLE_PERMISSION_RULES = {
    "teacher": "\nPERMISSION RULES:\n- You can only show data for your assigned classroom(s)\n- Never show other teachers' personal data\n",
    "coordinator": "\nPERMISSION RULES:\n- You can only show data within your assigned levels/campus\n- Do not show data of coordinators or principals\n",
    "principal": "\nPERMISSION RULES:\n- You can see ALL data for your campus\n- Do not show data from other campuses\n",
    "org_admin": "\nPERMISSION RULES:\n- You have full access to all campuses in your organization\n",
    "admin": "\nPERMISSION RULES:\n- You have full access to all campuses in your organization\n",
    "student": "\nPERMISSION RULES:\n- You can ONLY show THIS student's own data\n- Never show other students' data\n",
}

_ROLE_QUICK_HINTS = {
    "teacher":    "Quick queries: 'Meri class ke students', 'Aaj absent kon hai', 'Class attendance summary'",
    "coordinator":"Quick queries: 'Mere level ke teachers', 'Aaj absent students', 'Level attendance summary'",
    "principal":  "Quick queries: 'Aaj absent students', 'Teachers ki list', 'Coordinators ki list', 'Exam results summary'",
    "org_admin":  "Quick queries: 'Sab campuses ki summary', 'Aaj absent students', 'Active students count'",
    "admin":      "Quick queries: 'Sab campuses ki summary', 'Aaj absent students', 'Teachers ki list'",
    "student":    "Quick queries: 'Mere marks', 'Meri attendance', 'Final term result'",
}


def _get_token_claim(user, claim, default=None):
    # JWTStatelessUserAuthentication returns a TokenUser — claims in user.token
    try:
        val = user.token.get(claim)
        if val is not None:
            return val
    except Exception:
        pass
    return getattr(user, claim, default)


def _build_scope(user) -> dict:
    role = _get_token_claim(user, 'role', '')
    org_id = _get_token_claim(user, 'org_id')
    campus_id = _get_token_claim(user, 'campus_id')
    user_id = user.id

    scope = {
        "role": role,
        "org_id": org_id,
        "user_id": user_id,
        "campus_id": campus_id,
        "classroom_ids": [],
        "level_ids": [],
        "student_id": None,
    }

    try:
        if role == "teacher":
            with staff_conn() as c:
                with c.cursor() as cur:
                    row = fetchone(cur,
                        "SELECT id, current_campus_id FROM teachers_teacher WHERE user_id=%s AND is_deleted=false LIMIT 1",
                        (user_id,))
                    if row:
                        scope["campus_id"] = row["current_campus_id"]
                        teacher_id = row["id"]
                        with campus_conn() as cc:
                            with cc.cursor() as ccur:
                                rows = fetchall(ccur,
                                    "SELECT id FROM classes_classroom WHERE class_teacher_id=%s",
                                    (teacher_id,))
                                scope["classroom_ids"] = [r["id"] for r in rows]

        elif role == "coordinator":
            with staff_conn() as c:
                with c.cursor() as cur:
                    coord = fetchone(cur,
                        "SELECT id, campus_id, level_id FROM coordinator_coordinator WHERE user_id=%s AND is_deleted=false LIMIT 1",
                        (user_id,))
                    if coord:
                        scope["campus_id"] = coord["campus_id"]
                        assigned = fetchall(cur,
                            "SELECT level_id FROM coordinator_coordinator_assigned_levels WHERE coordinator_id=%s",
                            (coord["id"],))
                        scope["level_ids"] = [r["level_id"] for r in assigned] or ([coord["level_id"]] if coord["level_id"] else [])

        elif role == "student":
            with student_conn() as c:
                with c.cursor() as cur:
                    row = fetchone(cur,
                        "SELECT id FROM students_student WHERE user_id=%s LIMIT 1",
                        (user_id,))
                    if row:
                        scope["student_id"] = row["id"]
    except Exception:
        pass

    return scope


def _resolve_campus_id(org_id, campus_name: str | None):
    if not campus_name:
        return None
    try:
        token = campus_name.replace("Campus", "").replace("campus", "").strip()
        with campus_conn() as c:
            with c.cursor() as cur:
                row = (
                    fetchone(cur, "SELECT id FROM campus_campus WHERE organization_id=%s AND campus_name ILIKE %s LIMIT 1", (org_id, f"%{token}%"))
                    or fetchone(cur, "SELECT id FROM campus_campus WHERE organization_id=%s AND campus_code ILIKE %s LIMIT 1", (org_id, f"%{token}%"))
                )
                return row["id"] if row else None
    except Exception:
        return None


def _build_system_prompt(user, scope, allowed_tools, today_str) -> str:
    role = scope["role"]
    full_name = _get_token_claim(user, 'username', str(user.id))
    role_display = ROLE_DISPLAY.get(role, role)

    identity = f"Tum AI assistant ho school management system ke liye.\nAaj ki tarikh: {today_str}.\n"
    user_section = f"\nCURRENT USER:\n- Name: {full_name}\n- Role: {role_display}\n"

    tools_section = "\nALLOWED TOOLS:\n"
    for decl in allowed_tools:
        perm = TOOL_PERMISSIONS.get(decl["name"], {})
        scope_type = perm.get("scope", {}).get(role, "all")
        scope_note = {"self": "sirf aap ka apna data", "assigned_classroom": "sirf aap ki assigned class(es)", "assigned_levels": "sirf aap ke managed levels", "campus": "sirf aap ka campus", "all": "poori organization"}.get(scope_type, scope_type)
        tools_section += f"- {decl['name']} ({scope_note})\n"

    permission_rules = _ROLE_PERMISSION_RULES.get(role, "\nPERMISSION RULES:\n- Only show data within your access scope.\n")
    quick_hint = _ROLE_QUICK_HINTS.get(role, "")
    behavior = _BEHAVIOR_RULES + (f"\n{quick_hint}\n" if quick_hint else "")

    return identity + user_section + tools_section + permission_rules + behavior


def _get_allowed_declarations(role: str) -> list:
    return [d for d in ALL_FUNCTION_DECLARATIONS if role in TOOL_PERMISSIONS.get(d["name"], {}).get("allowed", set())]


def _gemini_call(contents, system, api_key, tools=None) -> dict:
    import concurrent.futures, urllib.error, time
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    payload = {"systemInstruction": {"parts": [{"text": system}]}, "contents": contents}
    if tools:
        payload["tools"] = [{"functionDeclarations": tools}]
    data = json.dumps(payload).encode()

    def do_request():
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.loads(r.read().decode())

    def do_with_retry():
        try:
            return do_request()
        except urllib.error.HTTPError as e:
            if e.code == 503: time.sleep(2); return do_request()
            if e.code == 429: time.sleep(15); return do_request()
            raise

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        return ex.submit(do_with_retry).result(timeout=60)


def _gemini_stream(contents, system, api_key):
    import urllib.error
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:streamGenerateContent?key={api_key}&alt=sse"
    payload = {"systemInstruction": {"parts": [{"text": system}]}, "contents": contents}
    data = json.dumps(payload).encode()
    try:
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=60) as resp:
            for raw in resp:
                line = raw.decode().strip()
                if not line.startswith("data: "): continue
                try:
                    chunk = json.loads(line[6:])
                    for part in chunk.get("candidates", [{}])[0].get("content", {}).get("parts", []):
                        if "text" in part and part["text"]:
                            yield f"data: {json.dumps({'chunk': part['text']})}\n\n"
                except (json.JSONDecodeError, IndexError, KeyError):
                    pass
    except urllib.error.HTTPError as e:
        yield f"data: {json.dumps({'error': f'AI error {e.code}'})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    yield "data: [DONE]\n\n"


def _sse_response(gen):
    res = StreamingHttpResponse(gen, content_type="text/event-stream")
    res["Cache-Control"] = "no-cache"
    res["X-Accel-Buffering"] = "no"
    return res


def _check_rate_limit(user_id, org_id):
    try:
        from django.core.cache import cache
        user_key = f"ai_chat:user:{user_id}"
        org_key = f"ai_chat:org:{org_id}"
        user_count = cache.get(user_key, 0)
        if user_count >= 50:
            return False, "Aap ne aaj ke 50 messages use kar liye hain. Kal dobara try karein."
        org_count = cache.get(org_key, 0)
        if org_count >= 500:
            return False, "Aap ke school ka aaj ka AI quota khatam ho gaya hai."
        cache.set(user_key, user_count + 1, timeout=86400)
        cache.set(org_key, org_count + 1, timeout=86400)
        return True, None
    except Exception:
        return True, None


def _execute_tool(name: str, args: dict, scope: dict):
    org_id = scope["org_id"]
    role = scope["role"]
    today_str = str(date.today())

    perm = TOOL_PERMISSIONS.get(name, {})
    if role not in perm.get("allowed", set()):
        return {"error": f"Aap ka role '{role}' is tool ko use karne ki permission nahi deta."}

    scope_type = perm["scope"].get(role, "all")

    # ── get_campus_list ──────────────────────────────────────────────────────
    if name == "get_campus_list":
        try:
            with campus_conn() as c:
                with c.cursor() as cur:
                    if scope_type == "campus" and scope["campus_id"]:
                        campuses = fetchall(cur, "SELECT id, campus_name, campus_code FROM campus_campus WHERE organization_id=%s AND id=%s", (org_id, scope["campus_id"]))
                    else:
                        campuses = fetchall(cur, "SELECT id, campus_name, campus_code FROM campus_campus WHERE organization_id=%s", (org_id,))
            result = []
            for c in campuses:
                cid = c["id"]
                s_count, t_count = 0, 0
                try:
                    with student_conn() as sc:
                        with sc.cursor() as scur:
                            scur.execute("SELECT COUNT(*) FROM students_student WHERE organization_id=%s AND campus_id=%s AND is_active=true AND LOWER(current_grade)!='alumni'", (org_id, cid))
                            s_count = scur.fetchone()[0]
                except Exception: pass
                try:
                    with staff_conn() as tc:
                        with tc.cursor() as tcur:
                            tcur.execute("SELECT COUNT(*) FROM teachers_teacher WHERE organization_id=%s AND current_campus_id=%s", (org_id, cid))
                            t_count = tcur.fetchone()[0]
                except Exception: pass
                result.append({"id": cid, "name": c["campus_name"], "code": c["campus_code"], "students": s_count, "teachers": t_count})
            return {"total_campuses": len(result), "campuses": result}
        except Exception as e:
            return {"error": str(e)}

    # ── get_students ─────────────────────────────────────────────────────────
    if name == "get_students":
        try:
            conditions = ["organization_id=%s"]
            params = [org_id]

            if scope_type == "assigned_classroom":
                if not scope["classroom_ids"]:
                    return {"total": 0, "students": [], "note": "Aap ka koi classroom assign nahi hai."}
                conditions.append(f"classroom_id = ANY(%s)")
                params.append(scope["classroom_ids"])
            elif scope_type == "assigned_levels":
                if not scope["level_ids"]:
                    return {"total": 0, "students": [], "note": "Aap ka koi level assign nahi hai."}
                try:
                    with campus_conn() as c:
                        with c.cursor() as cur:
                            rows = fetchall(cur, "SELECT cr.id FROM classes_classroom cr JOIN classes_grade g ON g.id=cr.grade_id WHERE g.level_id = ANY(%s)", (scope["level_ids"],))
                            class_ids = [r["id"] for r in rows]
                    if not class_ids:
                        return {"total": 0, "students": [], "note": "Level mein koi classroom nahi mila."}
                    conditions.append("classroom_id = ANY(%s)")
                    params.append(class_ids)
                except Exception: pass
            elif scope_type == "campus":
                if scope["campus_id"]:
                    conditions.append("campus_id=%s"); params.append(scope["campus_id"])
            else:
                campus_id = _resolve_campus_id(org_id, args.get("campus_name"))
                if campus_id:
                    conditions.append("campus_id=%s"); params.append(campus_id)

            state = args.get("current_state", "active")
            if state == "active":
                conditions.append("is_active=true AND LOWER(current_grade)!='alumni'")
            elif state == "inactive":
                conditions.append("is_active=false")
            elif state == "alumni":
                conditions.append("LOWER(current_grade)='alumni'")

            if args.get("current_grade"):
                conditions.append("current_grade ILIKE %s"); params.append(f"%{args['current_grade']}%")
            if args.get("gender"):
                conditions.append("gender=%s"); params.append(args["gender"])
            if args.get("added_on"):
                d = today_str if args["added_on"] == "today" else args["added_on"]
                conditions.append("DATE(created_at)=%s"); params.append(d)

            where = " AND ".join(conditions)
            limit = min(int(args.get("limit", 30)), 100)

            with student_conn() as c:
                with c.cursor() as cur:
                    cur.execute(f"SELECT COUNT(*) FROM students_student WHERE {where}", params)
                    total = cur.fetchone()[0]
                    rows = fetchall(cur, f"SELECT s.name, s.gr_no, s.current_grade, s.gender, c.campus_name FROM students_student s LEFT JOIN campus_campus c ON c.id=s.campus_id WHERE {where} LIMIT %s", params + [limit])

            return {"total": total, "showing": len(rows), "students": [{"name": r["name"], "gr_no": r["gr_no"], "grade": r["current_grade"], "campus": r.get("campus_name")} for r in rows]}
        except Exception as e:
            return {"error": str(e)}

    # ── get_absent_students ──────────────────────────────────────────────────
    if name == "get_absent_students":
        try:
            target_date = args.get("date") or today_str
            conditions = ["sa.organization_id=%s", "sa.status='absent'", "a.date=%s"]
            params = [org_id, target_date]

            if scope_type == "assigned_classroom":
                if not scope["classroom_ids"]:
                    return {"total_absent": 0, "students": [], "note": "Aap ka koi classroom assign nahi hai."}
                conditions.append("s.classroom_id = ANY(%s)"); params.append(scope["classroom_ids"])
            elif scope_type == "assigned_levels":
                if not scope["level_ids"]:
                    return {"total_absent": 0, "students": [], "note": "Aap ka koi level assign nahi hai."}
                try:
                    with campus_conn() as c:
                        with c.cursor() as cur:
                            rows = fetchall(cur, "SELECT cr.id FROM classes_classroom cr JOIN classes_grade g ON g.id=cr.grade_id WHERE g.level_id = ANY(%s)", (scope["level_ids"],))
                            class_ids = [r["id"] for r in rows]
                    if class_ids:
                        conditions.append("s.classroom_id = ANY(%s)"); params.append(class_ids)
                except Exception: pass
            elif scope_type == "campus":
                if scope["campus_id"]:
                    conditions.append("s.campus_id=%s"); params.append(scope["campus_id"])
            else:
                campus_id = _resolve_campus_id(org_id, args.get("campus_name"))
                if campus_id:
                    conditions.append("s.campus_id=%s"); params.append(campus_id)

            if args.get("grade"):
                conditions.append("s.current_grade ILIKE %s"); params.append(f"%{args['grade']}%")

            where = " AND ".join(conditions)
            with attendance_conn() as c:
                with c.cursor() as cur:
                    rows = fetchall(cur,
                        f"""SELECT s.name, s.gr_no, s.current_grade, c.campus_name
                            FROM attendance_studentattendance sa
                            JOIN attendance_attendance a ON a.id=sa.attendance_id
                            JOIN students_student s ON s.id=sa.student_id
                            LEFT JOIN campus_campus c ON c.id=s.campus_id
                            WHERE {where} LIMIT 50""", params)
            return {"date": target_date, "total_absent": len(rows), "students": [{"name": r["name"], "gr_no": r["gr_no"], "grade": r["current_grade"], "campus": r.get("campus_name")} for r in rows]}
        except Exception as e:
            return {"error": str(e)}

    # ── get_attendance_summary ───────────────────────────────────────────────
    if name == "get_attendance_summary":
        try:
            target_date = args.get("date") or today_str
            conditions = ["organization_id=%s", "date=%s"]
            params = [org_id, target_date]

            if scope_type == "assigned_classroom":
                if scope["classroom_ids"]:
                    conditions.append("classroom_id = ANY(%s)"); params.append(scope["classroom_ids"])
            elif scope_type == "assigned_levels":
                if scope["level_ids"]:
                    try:
                        with campus_conn() as c:
                            with c.cursor() as cur:
                                rows = fetchall(cur, "SELECT cr.id FROM classes_classroom cr JOIN classes_grade g ON g.id=cr.grade_id WHERE g.level_id = ANY(%s)", (scope["level_ids"],))
                                class_ids = [r["id"] for r in rows]
                        if class_ids:
                            conditions.append("classroom_id = ANY(%s)"); params.append(class_ids)
                    except Exception: pass
            elif scope_type == "campus":
                if scope["campus_id"]:
                    try:
                        with campus_conn() as c:
                            with c.cursor() as cur:
                                rows = fetchall(cur, "SELECT id FROM classes_classroom WHERE campus_id=%s", (scope["campus_id"],))
                                class_ids = [r["id"] for r in rows]
                        if class_ids:
                            conditions.append("classroom_id = ANY(%s)"); params.append(class_ids)
                    except Exception: pass
            else:
                campus_id = _resolve_campus_id(org_id, args.get("campus_name"))
                if campus_id:
                    try:
                        with campus_conn() as c:
                            with c.cursor() as cur:
                                rows = fetchall(cur, "SELECT id FROM classes_classroom WHERE campus_id=%s", (campus_id,))
                                class_ids = [r["id"] for r in rows]
                        if class_ids:
                            conditions.append("classroom_id = ANY(%s)"); params.append(class_ids)
                    except Exception: pass

            where = " AND ".join(conditions)
            with attendance_conn() as c:
                with c.cursor() as cur:
                    cur.execute(f"SELECT COALESCE(SUM(total_students),0), COALESCE(SUM(present_count),0), COALESCE(SUM(absent_count),0) FROM attendance_attendance WHERE {where}", params)
                    total_s, total_p, total_a = cur.fetchone()
            return {"date": target_date, "total_students": total_s, "present": total_p, "absent": total_a, "attendance_percentage": round(total_p / total_s * 100, 1) if total_s else 0}
        except Exception as e:
            return {"error": str(e)}

    # ── get_teachers ─────────────────────────────────────────────────────────
    if name == "get_teachers":
        try:
            conditions = ["t.organization_id=%s", "t.is_deleted=false"]
            params = [org_id]

            if scope_type == "assigned_levels":
                if not scope["level_ids"]:
                    return {"total": 0, "teachers": [], "note": "Aap ka koi level assign nahi hai."}
                try:
                    with campus_conn() as c:
                        with c.cursor() as cur:
                            rows = fetchall(cur, "SELECT class_teacher_id FROM classes_classroom WHERE grade_id IN (SELECT id FROM classes_grade WHERE level_id = ANY(%s))", (scope["level_ids"],))
                            teacher_ids = [r["class_teacher_id"] for r in rows if r["class_teacher_id"]]
                    if not teacher_ids:
                        return {"total": 0, "teachers": []}
                    conditions.append("t.id = ANY(%s)"); params.append(teacher_ids)
                except Exception: pass
            elif scope_type == "campus":
                if scope["campus_id"]:
                    conditions.append("t.current_campus_id=%s"); params.append(scope["campus_id"])
            else:
                campus_id = _resolve_campus_id(org_id, args.get("campus_name"))
                if campus_id:
                    conditions.append("t.current_campus_id=%s"); params.append(campus_id)

            if args.get("is_active") is not None:
                conditions.append("t.is_currently_active=%s"); params.append(bool(args["is_active"]))

            limit = min(int(args.get("limit", 30)), 100)
            where = " AND ".join(conditions)
            with staff_conn() as c:
                with c.cursor() as cur:
                    cur.execute(f"SELECT COUNT(*) FROM teachers_teacher t WHERE {where}", params)
                    total = cur.fetchone()[0]
                    rows = fetchall(cur, f"SELECT t.full_name, t.employee_code, t.shift, c.campus_name FROM teachers_teacher t LEFT JOIN campus_campus c ON c.id=t.current_campus_id WHERE {where} LIMIT %s", params + [limit])
            return {"total": total, "showing": len(rows), "teachers": [{"name": r["full_name"], "code": r["employee_code"], "campus": r.get("campus_name"), "shift": r["shift"]} for r in rows]}
        except Exception as e:
            return {"error": str(e)}

    # ── get_coordinators ─────────────────────────────────────────────────────
    if name == "get_coordinators":
        try:
            conditions = ["c.organization_id=%s", "c.is_deleted=false"]
            params = [org_id]
            if scope_type == "campus":
                if scope["campus_id"]:
                    conditions.append("c.campus_id=%s"); params.append(scope["campus_id"])
            else:
                campus_id = _resolve_campus_id(org_id, args.get("campus_name"))
                if campus_id:
                    conditions.append("c.campus_id=%s"); params.append(campus_id)
            limit = min(int(args.get("limit", 30)), 100)
            where = " AND ".join(conditions)
            with staff_conn() as sc:
                with sc.cursor() as cur:
                    cur.execute(f"SELECT COUNT(*) FROM coordinator_coordinator c WHERE {where}", params)
                    total = cur.fetchone()[0]
                    rows = fetchall(cur, f"SELECT c.full_name, c.employee_code, c.shift, c.is_currently_active, ca.campus_name FROM coordinator_coordinator c LEFT JOIN campus_campus ca ON ca.id=c.campus_id WHERE {where} LIMIT %s", params + [limit])
            return {"total": total, "showing": len(rows), "coordinators": [{"name": r["full_name"], "code": r["employee_code"], "campus": r.get("campus_name"), "shift": r["shift"], "active": r["is_currently_active"]} for r in rows]}
        except Exception as e:
            return {"error": str(e)}

    # ── get_results_summary ──────────────────────────────────────────────────
    if name == "get_results_summary":
        try:
            conditions = ["r.organization_id=%s", "r.is_deleted=false"]
            params = [org_id]

            if scope_type == "assigned_levels":
                if not scope["level_ids"]:
                    return {"error": "Aap ka koi level assign nahi hai."}
                try:
                    with campus_conn() as c:
                        with c.cursor() as cur:
                            rows = fetchall(cur, "SELECT cr.id FROM classes_classroom cr JOIN classes_grade g ON g.id=cr.grade_id WHERE g.level_id = ANY(%s)", (scope["level_ids"],))
                            class_ids = [r["id"] for r in rows]
                    if class_ids:
                        conditions.append("s.classroom_id = ANY(%s)"); params.append(class_ids)
                except Exception: pass
            elif scope_type == "campus":
                if scope["campus_id"]:
                    conditions.append("s.campus_id=%s"); params.append(scope["campus_id"])
            else:
                campus_id = _resolve_campus_id(org_id, args.get("campus_name"))
                if campus_id:
                    conditions.append("s.campus_id=%s"); params.append(campus_id)

            if args.get("exam_type"):
                conditions.append("r.exam_type=%s"); params.append(args["exam_type"])
            if args.get("academic_year"):
                conditions.append("r.academic_year=%s"); params.append(args["academic_year"])
            if args.get("current_grade"):
                conditions.append("s.current_grade ILIKE %s"); params.append(f"%{args['current_grade']}%")

            where = " AND ".join(conditions)
            with result_conn() as c:
                with c.cursor() as cur:
                    cur.execute(
                        f"""SELECT COUNT(*) as total,
                            SUM(CASE WHEN r.is_absent=false THEN 1 ELSE 0 END) as appeared,
                            SUM(CASE WHEN r.pass_status='pass' THEN 1 ELSE 0 END) as passed,
                            SUM(CASE WHEN r.pass_status='fail' THEN 1 ELSE 0 END) as failed,
                            SUM(CASE WHEN r.pass_status='absent' THEN 1 ELSE 0 END) as absent_exam,
                            ROUND(AVG(CASE WHEN r.is_absent=false THEN r.percentage END)::numeric, 1) as avg_pct
                            FROM result_result r
                            JOIN students_student s ON s.id=r.student_id
                            WHERE {where}""", params)
                    row = cur.fetchone()
            total, appeared, passed, failed, absent_exam, avg_pct = row
            return {"total_results": total or 0, "appeared": appeared or 0, "passed": passed or 0, "failed": failed or 0, "absent_in_exam": absent_exam or 0, "average_percentage": float(avg_pct or 0), "pass_rate": f"{round(passed/appeared*100,1)}%" if appeared else "N/A"}
        except Exception as e:
            return {"error": str(e)}

    # ── get_transfers ────────────────────────────────────────────────────────
    if name == "get_transfers":
        try:
            transfer_type = (args.get("transfer_type") or "").lower()
            status_filter = (args.get("status") or "").lower()
            limit = min(int(args.get("limit", 20)), 100)
            campus_id = None
            if scope_type == "campus":
                campus_id = scope["campus_id"]
            elif scope_type == "all":
                campus_id = _resolve_campus_id(org_id, args.get("campus_name"))

            results = []
            with timetable_conn() as c:
                with c.cursor() as cur:
                    if not transfer_type or transfer_type == "class":
                        q = "SELECT t.from_grade_name, t.from_section, t.to_grade_name, t.to_section, t.status, t.requested_date, s.name as student_name FROM transfers_classtransfer t JOIN students_student s ON s.id=t.student_id WHERE t.organization_id=%s"
                        p = [org_id]
                        if campus_id: q += " AND s.campus_id=%s"; p.append(campus_id)
                        if status_filter: q += " AND t.status ILIKE %s"; p.append(f"%{status_filter}%")
                        q += f" LIMIT %s"; p.append(limit)
                        for r in fetchall(cur, q, p):
                            results.append({"type": "Class Transfer", "student": r["student_name"], "from": f"{r['from_grade_name'] or ''}-{r['from_section'] or ''}".strip("-"), "to": f"{r['to_grade_name'] or ''}-{r['to_section'] or ''}".strip("-"), "status": r["status"], "date": str(r["requested_date"])})

                    if not transfer_type or transfer_type == "shift":
                        q = "SELECT t.from_shift, t.to_shift, t.status, t.requested_date, s.name as student_name FROM transfers_shifttransfer t JOIN students_student s ON s.id=t.student_id WHERE t.organization_id=%s"
                        p = [org_id]
                        if campus_id: q += " AND t.campus_id=%s"; p.append(campus_id)
                        if status_filter: q += " AND t.status ILIKE %s"; p.append(f"%{status_filter}%")
                        q += f" LIMIT %s"; p.append(limit)
                        for r in fetchall(cur, q, p):
                            results.append({"type": "Shift Transfer", "student": r["student_name"], "from": r["from_shift"], "to": r["to_shift"], "status": r["status"], "date": str(r["requested_date"])})

                    if not transfer_type or transfer_type == "campus":
                        q = "SELECT t.status, t.requested_date, s.name as student_name, fc.campus_name as from_campus, tc.campus_name as to_campus FROM transfers_campustransfer t JOIN students_student s ON s.id=t.student_id LEFT JOIN campus_campus fc ON fc.id=t.from_campus_id LEFT JOIN campus_campus tc ON tc.id=t.to_campus_id WHERE t.organization_id=%s"
                        p = [org_id]
                        if campus_id: q += " AND t.from_campus_id=%s"; p.append(campus_id)
                        if status_filter: q += " AND t.status ILIKE %s"; p.append(f"%{status_filter}%")
                        q += f" LIMIT %s"; p.append(limit)
                        for r in fetchall(cur, q, p):
                            results.append({"type": "Campus Transfer", "student": r["student_name"], "from": r.get("from_campus") or "—", "to": r.get("to_campus") or "—", "status": r["status"], "date": str(r["requested_date"])})

            return {"total_shown": len(results[:limit]), "transfers": results[:limit]}
        except Exception as e:
            return {"error": str(e)}

    # ── get_my_results ───────────────────────────────────────────────────────
    if name == "get_my_results":
        student_id = scope.get("student_id")
        if not student_id:
            return {"error": "Student profile nahi mila."}
        try:
            conditions = ["student_id=%s", "organization_id=%s"]
            params = [student_id, org_id]
            if args.get("exam_type"):
                conditions.append("exam_type=%s"); params.append(args["exam_type"])
            if args.get("academic_year"):
                conditions.append("academic_year=%s"); params.append(args["academic_year"])
            with result_conn() as c:
                with c.cursor() as cur:
                    rows = fetchall(cur, f"SELECT exam_type, academic_year, percentage, grade, pass_status, obtained_marks, total_marks FROM result_result WHERE {' AND '.join(conditions)} ORDER BY academic_year DESC LIMIT 10", params)
            return {"total": len(rows), "results": [{"exam_type": r["exam_type"], "academic_year": r["academic_year"], "percentage": round(float(r["percentage"] or 0), 1), "grade": r["grade"], "pass_status": r["pass_status"], "obtained_marks": r["obtained_marks"], "total_marks": r["total_marks"]} for r in rows]}
        except Exception as e:
            return {"error": str(e)}

    # ── get_my_attendance ────────────────────────────────────────────────────
    if name == "get_my_attendance":
        student_id = scope.get("student_id")
        if not student_id:
            return {"error": "Student profile nahi mila."}
        try:
            with attendance_conn() as c:
                with c.cursor() as cur:
                    cur.execute("SELECT COUNT(*) FROM attendance_studentattendance WHERE student_id=%s AND organization_id=%s", (student_id, org_id))
                    total = cur.fetchone()[0]
                    cur.execute("SELECT COUNT(*) FROM attendance_studentattendance WHERE student_id=%s AND organization_id=%s AND status='present'", (student_id, org_id))
                    present = cur.fetchone()[0]
                    absent = total - present
                    rows = fetchall(cur, "SELECT a.date, sa.status FROM attendance_studentattendance sa JOIN attendance_attendance a ON a.id=sa.attendance_id WHERE sa.student_id=%s AND sa.organization_id=%s ORDER BY a.date DESC LIMIT 30", (student_id, org_id))
            return {"total_days": total, "present": present, "absent": absent, "attendance_percentage": round(present / total * 100, 1) if total else 0, "recent_records": [{"date": str(r["date"]), "status": r["status"]} for r in rows]}
        except Exception as e:
            return {"error": str(e)}

    return {"error": f"Unknown tool: {name}"}


class AIChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import Conversation, ConversationMessage

        message = (request.data.get("message") or "").strip()
        if not message:
            return Response({"error": "Message cannot be empty"}, status=400)

        api_key = getattr(settings, "GEMINI_API_KEY", None)
        if not api_key:
            return Response({"error": "AI service not configured"}, status=500)

        user = request.user
        role = _get_token_claim(user, 'role', '')
        user_id = user.id
        org_id = _get_token_claim(user, 'org_id')

        allowed, limit_msg = _check_rate_limit(user_id, org_id)
        if not allowed:
            return Response({"error": "rate_limit", "message": limit_msg}, status=429)

        if role in ("superadmin", "donor", "accounts_officer", "admissions_counselor", "compliance_officer"):
            def _blocked():
                yield f"data: {json.dumps({'chunk': 'Aap ke role ke liye AI chat available nahi hai.'})}\n\n"
                yield "data: [DONE]\n\n"
            return _sse_response(_blocked())

        scope = _build_scope(user)
        allowed_tools = _get_allowed_declarations(role)

        if not allowed_tools:
            def _no_tools():
                yield f"data: {json.dumps({'chunk': 'Aap ke role ke liye koi data query available nahi hai.'})}\n\n"
                yield "data: [DONE]\n\n"
            return _sse_response(_no_tools())

        conv_id = request.data.get("conversation_id")
        if conv_id:
            conversation = Conversation.objects.filter(id=conv_id, user_id=user_id, org_id=org_id).first()
            if not conversation:
                conversation = Conversation.objects.create(user_id=user_id, org_id=org_id)
        else:
            conversation = Conversation.objects.create(user_id=user_id, org_id=org_id)

        history = list(conversation.messages.order_by("-created_at")[:20])
        history.reverse()

        today_str = str(date.today())
        system = _build_system_prompt(user, scope, allowed_tools, today_str)

        contents = [{"role": "user" if m.role == "user" else "model", "parts": [{"text": m.content}]} for m in history]
        contents.append({"role": "user", "parts": [{"text": message}]})

        ConversationMessage.objects.create(conversation=conversation, role="user", content=message)
        if not conversation.title:
            conversation.title = message[:60].strip()
            conversation.save(update_fields=["title", "updated_at"])

        try:
            result1 = _gemini_call(contents, system, api_key, allowed_tools)
        except Exception as e:
            err_msg = "AI service abhi busy hai. Thodi der baad dobara koshish karein." if "503" in str(e) else str(e)
            def _err():
                yield f"data: {json.dumps({'error': err_msg})}\n\n"
                yield "data: [DONE]\n\n"
            return _sse_response(_err())

        candidate = result1.get("candidates", [{}])[0]
        parts = candidate.get("content", {}).get("parts", [])
        fn_calls = [p["functionCall"] for p in parts if "functionCall" in p]

        if fn_calls:
            contents.append({"role": "model", "parts": parts})
            fn_responses = []
            for fc in fn_calls:
                tool_result = _execute_tool(fc["name"], fc.get("args", {}), scope)
                fn_responses.append({"functionResponse": {"name": fc["name"], "response": {"result": tool_result}}})
            contents.append({"role": "user", "parts": fn_responses})
            stream_gen = _gemini_stream(contents, system, api_key)
        else:
            text = " ".join(p.get("text", "") for p in parts if "text" in p) or "Jawab nahi mila."
            def _plain():
                yield f"data: {json.dumps({'chunk': text})}\n\n"
                yield "data: [DONE]\n\n"
            stream_gen = _plain()

        conv_id_str = str(conversation.id)

        def _stream_and_save():
            reply_parts = []
            for chunk in stream_gen:
                yield chunk
                if chunk.startswith("data: ") and not chunk.strip().endswith("[DONE]"):
                    try:
                        data_obj = json.loads(chunk[6:])
                        if "chunk" in data_obj:
                            reply_parts.append(data_obj["chunk"])
                    except (json.JSONDecodeError, KeyError):
                        pass
            yield f"data: {json.dumps({'conversation_id': conv_id_str})}\n\n"
            if reply_parts:
                ConversationMessage.objects.create(conversation=conversation, role="assistant", content="".join(reply_parts))

        return _sse_response(_stream_and_save())


class AIChatConversationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Conversation
        user_id = request.user.id
        org_id = _get_token_claim(request.user, 'org_id')
        convs = Conversation.objects.filter(user_id=user_id, org_id=org_id).order_by("-updated_at")[:30]
        return Response([{"id": str(c.id), "title": c.title or "New Chat", "updated_at": c.updated_at.isoformat()} for c in convs])


class AIChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Conversation
        user_id = request.user.id
        org_id = _get_token_claim(request.user, 'org_id')
        conv_id = request.query_params.get("conversation_id")

        if conv_id:
            conversation = Conversation.objects.filter(id=conv_id, user_id=user_id, org_id=org_id).first()
        else:
            conversation = Conversation.objects.filter(user_id=user_id, org_id=org_id).first()

        if not conversation:
            return Response({"messages": [], "conversation_id": None})

        messages = [{"role": m.role, "content": m.content} for m in conversation.messages.order_by("created_at")]
        return Response({"conversation_id": str(conversation.id), "messages": messages})
