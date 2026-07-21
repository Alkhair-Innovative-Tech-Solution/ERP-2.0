import requests
import os
import json

def test_unified_upload():
    print("Testing Unified Upload...")
    
    # 1. Login to get JWT
    login_url = "http://localhost:8000/api/auth/login"
    login_data = {
        "employee_code": "AIT01-G-26-AD-0001",
        "password": "password123"
    }
    
    print(f"Logging in at {login_url}...")
    r = requests.post(login_url, json=login_data)
    if r.status_code != 200:
        print(f"Login failed: {r.status_code}")
        print(r.text)
        return

    token = r.json().get('access_token')
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Test File Service Upload with 'purpose' alias
    # Use service name 'hdms-nginx' for intra-docker communication
    upload_url = "http://hdms-nginx/api/v1/files/upload"
    
    # Create a dummy file
    with open("test_ticket_attachment.txt", "w") as f:
        f.write("This is a test ticket attachment")
    
    files = {'file': open("test_ticket_attachment.txt", 'rb')}
    params = {
        'purpose': 'ticket_attachment',
        'uploaded_by_id': '2cf88ab1-1220-4f99-bd54-3086ef6b3c58' # Example UUID
    }
    
    print(f"Uploading file to {upload_url} with purpose='ticket_attachment'...")
    r = requests.post(upload_url, headers=headers, files=files, params=params)
    
    print(f"Status: {r.status_code}")
    response_data = r.json()
    print(f"Response: {json.dumps(response_data, indent=2)}")
    
    # Clean up
    if os.path.exists("test_ticket_attachment.txt"):
        os.remove("test_ticket_attachment.txt")
        
    # 3. Verify Enhancements
    if r.status_code in [200, 201]:
        file_key = response_data.get('file_key')
        url = response_data.get('url')
        
        if url and file_key in url:
            print("✅ SUCCESS: 'url' field present and correct.")
        else:
            print("❌ FAILURE: 'url' field missing or incorrect.")
            
        print(f"Direct link: {url}")
    else:
        print("❌ FAILURE: Upload failed.")

if __name__ == "__main__":
    test_unified_upload()
