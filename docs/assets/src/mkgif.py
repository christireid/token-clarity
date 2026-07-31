#!/usr/bin/env python3
"""Assemble captured PNG frames into an optimised animated GIF."""
import sys, os, glob
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
fps = float(sys.argv[3]) if len(sys.argv) > 3 else 12
colors = int(sys.argv[4]) if len(sys.argv) > 4 else 128
width = int(sys.argv[5]) if len(sys.argv) > 5 else 0
hold_last = int(sys.argv[6]) if len(sys.argv) > 6 else 0

files = sorted(glob.glob(os.path.join(src, "*.png")))
if not files:
    sys.exit("no frames in " + src)

frames = []
for f in files:
    im = Image.open(f).convert("RGB")
    if width and im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    frames.append(im)

# Shared palette from a montage of evenly-sampled frames -> stable colours, no flicker.
step = max(1, len(frames) // 24)
sample = frames[::step]
sheet = Image.new("RGB", (frames[0].width, frames[0].height * len(sample)))
for i, im in enumerate(sample):
    sheet.paste(im, (0, i * frames[0].height))
palette = sheet.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)

quant = [im.quantize(palette=palette, dither=Image.NONE) for im in frames]

durations = [round(1000 / fps)] * len(quant)
if hold_last:
    durations[-1] = hold_last

quant[0].save(
    out,
    save_all=True,
    append_images=quant[1:],
    duration=durations,
    loop=0,
    optimize=True,
    disposal=1,
)
kb = os.path.getsize(out) / 1024
print(f"{out}: {len(quant)} frames, {frames[0].width}x{frames[0].height}, {kb:.0f} KB")
