"""Stretch floor, rug and wall-face tiles to fill their whole 32px cell so they tile without gaps."""
import json
import sys
from pathlib import Path

from PIL import Image

FILL = ["A:" + c + "1" for c in "ABCDEFGH"] + ["A:A2", "A:B2", "A:C2", "A:A3", "A:B3", "A:F3"]


def main(style_dir):
    d = Path(style_dir)
    tiles = Image.open(d / "tiles.png").convert("RGBA")
    raw = json.loads((d / "tiles.json").read_text())
    index = raw.get("index", raw)
    size = raw.get("tile", 32) if "index" in raw else 32
    cols = tiles.width // size
    for cid in FILL:
        i = index.get(cid)
        if i is None:
            continue
        box = ((i % cols) * size, (i // cols) * size)
        tile = tiles.crop((*box, box[0] + size, box[1] + size))
        bbox = tile.getchannel("A").point(lambda a: 255 if a > 128 else 0).getbbox()
        if not bbox or bbox == (0, 0, size, size):
            continue
        filled = tile.crop(bbox).resize((size, size), Image.NEAREST)
        filled.putalpha(255)
        tiles.paste(filled, box)
    tiles.save(d / "tiles.png")
    print(f"{d.name}: normalized {len(FILL)} fill cells")


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        main(arg)
