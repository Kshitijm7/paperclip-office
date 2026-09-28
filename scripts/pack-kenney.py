# Repacks the Kenney roguelike sheets (16px tiles, 1px spacing) into gapless atlases for the free theme.
# The scene's TiledMapRenderer ignores margin/spacing, so it needs tiles at (col*16, row*16). Run: python scripts/pack-kenney.py
from PIL import Image

SHEETS = [
    ("assets/free/kenney/roguelike-rpg-pack/roguelikeSheet_transparent.png", "assets/free/kenney/packed/rpg.png"),
    ("assets/free/kenney/roguelike-indoors/roguelikeIndoor_transparent.png", "assets/free/kenney/packed/indoors.png"),
]

for src, dest in SHEETS:
    im = Image.open(src).convert("RGBA")
    cols, rows = (im.width + 1) // 17, (im.height + 1) // 17
    out = Image.new("RGBA", (cols * 16, rows * 16))
    for r in range(rows):
        for c in range(cols):
            out.paste(im.crop((c * 17, r * 17, c * 17 + 16, r * 17 + 16)), (c * 16, r * 16))
    out.save(dest, optimize=True)
    print(dest, cols, rows)
