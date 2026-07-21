from pydantic import BaseModel

class UserTestSelectionSchema(BaseModel):
    id: int
    user_id: int
    course_id: int
    test_id: int
