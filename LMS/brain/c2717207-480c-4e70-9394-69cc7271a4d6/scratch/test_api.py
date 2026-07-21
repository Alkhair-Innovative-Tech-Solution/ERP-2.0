import requests, json
url = "http://localhost:8001/api/auth/users-by-ids"
payload = {"user_ids": ["1f3f68d0-8f9b-4ddd-9b4a-7b9ad36450dd"]}
try:
    resp = requests.post(url, json=payload)
    print(json.dumps(resp.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
