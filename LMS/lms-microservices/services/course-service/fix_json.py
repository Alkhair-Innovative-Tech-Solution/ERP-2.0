import json
with open('/app/master_enrollment_mapping.json') as f:
    content = f.read()
idx = content.rfind('\n][')
if idx == -1:
    idx = content.find('\n]')
    if idx > -1:
        content = content[:idx+1]
with open('/app/master_enrollment_mapping.json', 'w') as f:
    f.write(content)
data = json.load(open('/app/master_enrollment_mapping.json'))
print(f'Fixed: {len(data)} records')
