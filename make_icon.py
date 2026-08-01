from PIL import Image, ImageDraw
img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rectangle((0, 0, 255, 255), fill=(76, 110, 245, 255))
d.text((60, 90), 'NQ', fill=(255, 255, 255, 255))
img.save('build/icon.png')
img.save('build/icon.ico')
