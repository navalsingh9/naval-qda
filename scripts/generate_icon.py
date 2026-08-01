from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'build'
BUILD.mkdir(parents=True, exist_ok=True)

size = 1024
img = Image.new('RGBA', (size, size), (8, 19, 47, 255))
draw = ImageDraw.Draw(img)

# Soft radial glow
for radius, alpha in ((430, 28), (340, 40), (240, 54)):
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((size/2-radius, size/2-radius, size/2+radius, size/2+radius), fill=(24, 52, 122, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(radius * 0.16))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

# Rounded card background
card = Image.new('RGBA', (size, size), (0, 0, 0, 0))
card_draw = ImageDraw.Draw(card)
card_draw.rounded_rectangle((24, 24, size - 24, size - 24), radius=160, fill=(10, 23, 57, 255))
card = card.filter(ImageFilter.GaussianBlur(0.5))
img = Image.alpha_composite(img, card)
draw = ImageDraw.Draw(img)

# Left-side glyphs
left_x = 150
icon_color = (121, 164, 239, 220)
for y in (250, 350, 452, 560):
    draw.rounded_rectangle((left_x - 34, y - 28, left_x + 34, y + 28), radius=10, outline=icon_color, width=6)
# Quote marks
font = ImageFont.load_default()
draw.text((132, 170), '“', fill=(123, 167, 255, 200), font=font)
draw.text((168, 170), '”', fill=(123, 167, 255, 200), font=font)
# Dotted connector
for i, y in enumerate(range(225, 640, 32)):
    draw.rounded_rectangle((242, y, 248, y + 6), radius=2, fill=(89, 134, 214, 255))

# Stylized N built from polygons and rounded bars
blue = (56, 132, 255, 255)
cyan = (109, 239, 236, 255)
shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
shadow_draw = ImageDraw.Draw(shadow)
shadow_draw.rounded_rectangle((318, 226, 410, 690), radius=46, fill=(17, 60, 160, 255))
shadow_draw.rounded_rectangle((566, 226, 658, 690), radius=46, fill=(38, 158, 170, 255))
shadow = shadow.filter(ImageFilter.GaussianBlur(7))
img = Image.alpha_composite(img, shadow)
draw = ImageDraw.Draw(img)

draw.rounded_rectangle((312, 220, 404, 684), radius=46, fill=blue)
draw.rounded_rectangle((560, 220, 652, 684), radius=46, fill=cyan)
draw.polygon([(393, 324), (566, 324), (660, 684), (565, 684)], fill=(53, 154, 255, 255))
# center cut for the N bend
mask = Image.new('RGBA', (size, size), (0, 0, 0, 0))
mask_draw = ImageDraw.Draw(mask)
mask_draw.polygon([(410, 416), (504, 416), (594, 684), (500, 684)], fill=(10, 23, 57, 255))
img = Image.alpha_composite(img, mask)
draw = ImageDraw.Draw(img)

# Chat bubble
bubble = [(650, 628), (830, 628), (870, 668), (870, 742), (826, 742), (800, 786), (796, 742), (650, 742)]
draw.rounded_rectangle((648, 610, 870, 742), radius=52, fill=(97, 222, 219, 255))
draw.polygon([(780, 742), (806, 742), (795, 790)], fill=(97, 222, 219, 255))
for dot_x in (704, 758, 812):
    draw.ellipse((dot_x - 10, 665, dot_x + 10, 685), fill=(11, 26, 46, 255))

# Title text
try:
    title_font = ImageFont.truetype('arial.ttf', 80)
    subtitle_font = ImageFont.truetype('arial.ttf', 24)
except Exception:
    title_font = ImageFont.load_default()
    subtitle_font = ImageFont.load_default()

draw.text((182, 860), 'NAVAL', fill=(244, 247, 255, 255), font=title_font)
draw.text((544, 860), 'QDA', fill=(111, 229, 230, 255), font=title_font)
draw.line((158, 944, 228, 944), fill=(106, 147, 210, 180), width=3)
draw.line((804, 944, 874, 944), fill=(106, 147, 210, 180), width=3)
draw.text((244, 920), 'QUALITATIVE DATA ANALYSIS', fill=(164, 192, 232, 255), font=subtitle_font)

# Polish with slight blur and sharpen for a more polished app-style icon
img = img.filter(ImageFilter.GaussianBlur(0.2))

png_path = BUILD / 'icon.png'
ico_path = BUILD / 'icon.ico'
img.save(png_path)
img.resize((256, 256), Image.Resampling.LANCZOS).save(ico_path)
