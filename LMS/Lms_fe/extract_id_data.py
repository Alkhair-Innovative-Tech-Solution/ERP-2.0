import re
import base64
import os

html_path = r'd:\AIT-LMS\DIGITAL+MARKE.jpg (1).html'
output_dir = r'd:\AIT-LMS\Lms_fe\public\id_card_assets'

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract Base64 images
images = re.findall(r'data:image\/[a-zA-Z]*;base64,[^\'\"]*', content)
for i, img_data in enumerate(images):
    header, encoded = img_data.split(',', 1)
    ext = header.split('/')[1].split(';')[0]
    with open(os.path.join(output_dir, f'ref_image_{i}.{ext}'), 'wb') as f:
        f.write(base64.b64decode(encoded))
    print(f"Saved: ref_image_{i}.{ext}")

# Extract positioning logic (ctx.fillText, drawImage, etc.)
# Looking for patterns like drawImage(img, x, y, w, h) or fillText(text, x, y)
draw_commands = re.findall(r'ctx\..*?\(.*?\);', content)
with open('extracted_coords.txt', 'w') as f:
    for cmd in draw_commands:
        f.write(cmd + '\n')
print("Extracted drawing commands to extracted_coords.txt")
