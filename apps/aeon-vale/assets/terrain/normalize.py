"""Slice the original crest family; enforce a shared pixel grid and palette."""
from pathlib import Path
import json
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
COLORS = ['e1e8e5', 'c4d1d1', '91a6b0', '657c88', '454c4c', '535954']
palette = Image.new('P', (1, 1))
rgb = [tuple(bytes.fromhex(color)) for color in COLORS]
palette.putpalette([c for color in rgb for c in color] + list(rgb[-1]) * (256-len(rgb)))
source = Image.open(ROOT / 'sources/snow-crests.png').convert('RGB')
atlas = Image.new('RGBA', (128, 96))
frames = []
for index in range(4):
    x, y = index % 2, index // 2
    cut = source.crop((x*627, y*627, (x+1)*627, (y+1)*627))
    # Chroma key is outside the art palette, including its pale snow caps.
    mask = Image.new('L', cut.size)
    mask.putdata([0 if r > g+35 and b > g+35 else 255 for r,g,b in cut.get_flattened_data()])
    cut.putalpha(mask); cut = cut.crop(mask.getbbox())
    reduced = ImageOps.contain(cut, (60, 42), Image.Resampling.BOX)
    alpha = reduced.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
    sprite = reduced.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
    sprite.putalpha(alpha)
    # Fully transparent texels must not retain the checkerboard's RGB.
    frame = Image.new('RGBA', (64, 48))
    frame.paste(sprite, ((64-sprite.width)//2, (48-sprite.height)//2), sprite)
    assert frame.getbbox()[0] >= 2 and frame.getbbox()[2] <= 62
    atlas.paste(frame, (x*64,y*48)); frames.append(frame)
atlas.save(ROOT / 'snow-crests.png')
preview = Image.new('RGBA', (256, 192), '#4f514d')
for index, frame in enumerate(frames):
    preview.alpha_composite(frame, ((index%2)*128+32,(index//2)*96+24))
preview.resize((768, 576), Image.Resampling.NEAREST).save(ROOT / 'preview.png')
colors = set(atlas.get_flattened_data())
report = {'size': list(atlas.size), 'frames': 4, 'frame_size': [64,48], 'content_limit': [60,42], 'colors': len(colors), 'alpha': sorted(set(atlas.getchannel('A').get_flattened_data())), 'palette': COLORS, 'source_background': 'magenta chroma key removed before size and palette normalization'}
assert report['colors'] <= 7 and report['alpha'] == [0,255]
(ROOT / 'technical-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
