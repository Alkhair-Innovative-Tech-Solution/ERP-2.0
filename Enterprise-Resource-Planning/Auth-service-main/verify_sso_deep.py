import requests
import sys
import json

def diagnose_sso(username, password):
    sis_base_url = "http://127.0.0.1:8000"
    endpoints_to_try = [
        "/api/auth/login/",
        "/api/auth/login",
        "/auth/login/",
    ]
    
    print("==========================================")
    print("   SSO DEEP DIAGNOSTIC TOOL")
    print("==========================================")
    
    # 1. Connectivity Check
    print(f"[*] Checking connectivity to {sis_base_url}...")
    try:
        health_resp = requests.get(f"{sis_base_url}/health/", timeout=5)
        print(f"[+] SIS Server is UP (Status: {health_resp.status_code})")
    except Exception as e:
        print(f"[!] CANNOT REACH SIS SERVER at {sis_base_url}")
        print(f"    Error: {e}")
        print("    Mashwara: Make sure 'python manage.py runserver' is running in sis/backend.")
        return

    # 2. Endpoint Discovery
    for endpoint in endpoints_to_try:
        url = f"{sis_base_url}{endpoint}"
        print(f"\n[*] Testing Endpoint: {url}")
        try:
            # We use POST because login is POST
            # But first let's see what a GET says (should be 405 Method Not Allowed if endpoint exists)
            check_get = requests.get(url, timeout=5)
            print(f"    - GET Request: {check_get.status_code}")
            
            # Now the actual POST
            print(f"    - Attempting POST Login...")
            resp = requests.post(
                url,
                json={"username": username, "password": password},
                timeout=10
            )
            print(f"    - POST Status: {resp.status_code}")
            
            if resp.status_code == 200:
                print(f"[SUCCESS] Login found at {url}!")
                try:
                    data = resp.json()
                    print(f"    - Token received: {data.get('access', 'MISSING')[:15]}...")
                except:
                    print(f"    - Response body is not JSON: {resp.text[:100]}")
                return
            elif resp.status_code == 404:
                print(f"    - [!] 404: Endpoint not found at this path.")
            elif resp.status_code == 401:
                print(f"    - [!] 401: Invalid Credentials (handled by backend).")
                try:
                    print(f"    - MSG: {resp.json().get('error')}")
                except: pass
            else:
                print(f"    - Unexpected error {resp.status_code}")
                print(f"    - Raw Response: {resp.text[:200]}")
                
        except Exception as e:
            print(f"    - Connection Error: {e}")

    print("\n==========================================")
    print("[!] DIAGNOSIS SUMMARY:")
    print("1. Agar saare 404 hain, to URL configuration check karein.")
    print("2. Check karein ke SIS backend mein 'api/auth/login/' URL defined hai.")
    print("3. Check 'python manage.py runserver' output for any errors during startup.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        user = "C06-B-15-0015"
        pw = "Head612@#"
        print(f"Using default credentials: {user} / {pw}")
        diagnose_sso(user, pw)
    else:
        diagnose_sso(sys.argv[1], sys.argv[2])
