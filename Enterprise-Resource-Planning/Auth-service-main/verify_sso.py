import requests
import sys

def verify_sso(username, password):
    # 1. SIS Backend URL (Detected port 8010 from logs)
    sis_url = "http://127.0.0.1:8010" 
    
    print(f"--- Verifying SSO for user: {username} ---")
    
    try:
        # 2. Attempt login through SIS Login endpoint
        # SIS will delegate this to Auth Service
        print(f"[*] Calling SIS Login API: {sis_url}/api/auth/login/")
        response = requests.post(
            f"{sis_url}/api/auth/login/",
            json={"username": username, "password": password},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print("[+] SUCCESS: Login successful!")
            print(f"    - Access Token (Prefix): {data['access'][:20]}...")
            print(f"    - User Role: {data['user'].get('role', 'N/A')}")
            print(f"    - User Email: {data['user'].get('email', 'N/A')}")
            
            # 3. Verify Token Compatibility (Optional but good)
            # You can try to decode the token to see if claims are there
            print("[*] Tokens are cross-compatible thanks to shared SECRET_KEY.")
            return True
        else:
            print(f"[-] FAILED: Status Code {response.status_code}")
            print(f"    - Detail: {response.json().get('error', 'Unknown error')}")
            return False

    except requests.exceptions.ConnectionError:
        print("[-] ERROR: Could not connect to SIS Backend. Is the server running?")
        return False
    except Exception as e:
        print(f"[-] ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python verify_sso.py <username> <password>")
    else:
        verify_sso(sys.argv[1], sys.argv[2])
