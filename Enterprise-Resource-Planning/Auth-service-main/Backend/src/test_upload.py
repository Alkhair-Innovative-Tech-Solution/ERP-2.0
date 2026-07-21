import requests
import os

def test_upload():
    base_url = "http://localhost:8000/api"
    
    # 1. Login to get token
    login_url = f"{base_url}/auth/login"
    login_data = {
        "employee_code": "AIT01-G-26-AD-0001", 
        "password": "password123" 
    }
    
    print("Logging in...")
    login_resp = requests.post(login_url, json=login_data)
    if login_resp.status_code != 200:
        print(f"Login failed: {login_resp.text}")
        return
    
    token = login_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Create Employee with Resume
    create_url = f"{base_url}/employees"
    data = {
        "fullName": "Test Admin JWT",
        "dob": "1990-01-01",
        "cnic": "4210112345701", # New unique CNIC
        "gender": "male",
        "personalEmail": "test_jwt@example.com",
        "mobile": "03001234567",
        "residentialAddress": "123 Test St",
        "organizationCode": "IAK",
        "departmentCode": "AMD",
        "designationCode": "AD",
        "joiningDate": "2026-01-01",
        "shift": "general"
    }
    
    file_path = "test_resume.txt"
    with open(file_path, "rb") as f:
        files = {"resume": ("resume_jwt.txt", f, "text/plain")}
        print("Sending authenticated request to Auth-Service...")
        response = requests.post(create_url, data=data, files=files, headers=headers)
        
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

if __name__ == "__main__":
    test_upload()
