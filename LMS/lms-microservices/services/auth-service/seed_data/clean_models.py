path = 'profiles/models.py'
try:
    with open(path, 'rb') as f:
        content = f.read()
    
    if b'\x00' in content:
        print(f"Found null bytes in {path}. Cleaning...")
        clean_content = content.replace(b'\x00', b'')
        
        with open(path, 'wb') as f:
            f.write(clean_content)
        print("File cleaned successfully.")
    else:
        print("No null bytes found.")

except Exception as e:
    print(f"Error: {e}")
