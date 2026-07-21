import os

def find_null_bytes(start_path):
    print(f"Scanning {start_path} for null bytes...")
    for root, dirs, files in os.walk(start_path):
        for file in files:
            if file.endswith('.py'):
                path = os.path.join(root, file)
                try:
                    with open(path, 'rb') as f:
                        content = f.read()
                        if b'\x00' in content:
                            print(f"FOUND NULL BYTES: {path}")
                            # Print context around null byte
                            index = content.find(b'\x00')
                            start = max(0, index - 20)
                            end = min(len(content), index + 20)
                            print(f"Context: {content[start:end]}")
                except Exception as e:
                    print(f"Error reading {path}: {e}")

if __name__ == "__main__":
    find_null_bytes('.')
