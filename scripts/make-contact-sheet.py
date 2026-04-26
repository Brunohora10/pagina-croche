from PIL import Image, ImageOps, ImageDraw
import os
import math

folder = 'video-thumbs'
files = [f for f in os.listdir(folder) if f.lower().endswith('.jpg')]
files.sort()

thumb_w, thumb_h = 240, 150
cols = 4
rows = math.ceil(len(files) / cols)
canvas = Image.new('RGB', (cols * thumb_w, rows * (thumb_h + 24)), (20, 20, 20))
draw = ImageDraw.Draw(canvas)

for i, f in enumerate(files):
    img = Image.open(os.path.join(folder, f)).convert('RGB')
    img = ImageOps.fit(img, (thumb_w, thumb_h))
    x = (i % cols) * thumb_w
    y = (i // cols) * (thumb_h + 24)
    canvas.paste(img, (x, y))
    label = f.split('-')[0][:28]
    draw.text((x + 4, y + thumb_h + 4), label, fill=(235, 235, 235))

out = os.path.join(folder, 'contact-sheet.jpg')
canvas.save(out, quality=90)
print(out)
print('total', len(files))
