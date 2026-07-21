"""
Enrollment verification utility for microservices.
Checks if a user is enrolled in a course before granting content access.
"""
import os
import logging
import requests
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

COURSE_SERVICE_URL = os.environ.get("COURSE_SERVICE_URL", "http://course-service:8002")
ADMIN_ROLES = {"ADMIN", "COORDINATOR", "ACCOUNT_OFFICER", "LEAD"}


def check_enrollment(
    user_id: str,
    course_id: str,
    user_role: str = "STUDENT",
    timeout: int = 5,
) -> Tuple[bool, Optional[dict]]:
    """
    Check if a user is enrolled in a course via course-service.

    Returns:
        (is_enrolled, enrollment_data)
        - is_enrolled: True if the user has an active enrollment
        - enrollment_data: dict with enrollment details or None
    """
    # Admins and coordinators bypass enrollment check
    if user_role.upper() in ADMIN_ROLES:
        return True, {"status": "admin_bypass", "role": user_role}

    try:
        resp = requests.get(
            f"{COURSE_SERVICE_URL}/api/courses/enrollment/check/",
            params={"student_id": user_id, "course_id": course_id},
            headers={
                "X-User-Id": user_id,
                "X-User-Role": user_role,
            },
            timeout=timeout,
        )

        if resp.status_code == 200:
            data = resp.json()
            return data.get("enrolled", False), data
        else:
            logger.warning(
                f"Enrollment check failed for user={user_id} course={course_id}: "
                f"{resp.status_code} {resp.text}"
            )
            return False, None

    except requests.exceptions.Timeout:
        logger.error(f"Timeout checking enrollment for user={user_id} course={course_id}")
        return False, None
    except requests.exceptions.ConnectionError:
        logger.error(f"Connection error checking enrollment for user={user_id} course={course_id}")
        return False, None
    except Exception as e:
        logger.error(f"Error checking enrollment: {e}", exc_info=True)
        return False, None


def is_preview_content(obj) -> bool:
    """Check if a content item is marked as preview (accessible without enrollment)."""
    return getattr(obj, "is_preview", False)
