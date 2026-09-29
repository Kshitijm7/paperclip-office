"""Slice generated sprite sheets (8x8 grid, magenta background) into a packed, validated tileset.

usage: slice_sheets.py <sheets_dir> --out <dir> [--tile 32] [--grid 8] [--rows 7] [--colors 32]
Sheets are read in name order (e.g. style-A.png, style-B.png, style-C.png); the letter before
.png becomes the sheet id used in tiles.json ("A:C3" = sheet A, column C, row 3).
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image

MAGENTA = (255, 0, 255)
KEY_TOLERANCE = 60
SEAMLESS_CELLS = {("A", r, c) for r in (1, 2) for c in range(8)} | {("A", 3, c) for c in (0, 1, 5)}


def is_key(px):
    r, g, b = px[:3]
    return abs(r - MAGENTA[0]) + abs(g - MAGENTA[1]) + abs(b - MAGENTA[2]) <= KEY_TOLERANCE


def cell_to_tile(sheet, col, row, cell, tile):
    step = cell // tile
    out = Image.new("RGBA", (tile, tile), (0, 0, 0, 0))
    src = sheet.load()
    dst = out.load()
    x0, y0 = col * cell, row * cell
    for ty in range(tile):
        for tx in range(tile):
            px = src[x0 + tx * step + step // 2, y0 + ty * step + step // 2]
            if not is_key(px):
                dst[tx, ty] = (px[0], px[1], px[2], 255)
    return out


def edge_touch(sheet, col, row, cell):
    """Non-key pixels on the outer 2px ring of a cell mean the art bled past its cell."""
    src = sheet.load()
    x0, y0 = col * cell, row * cell
    ring = [(x0 + i, y0 + j) for i in range(cell) for j in (0, 1, cell - 2, cell - 1)]
    ring += [(x0 + i, y0 + j) for j in range(cell) for i in (0, 1, cell - 2, cell - 1)]
    return sum(1 for p in ring if not is_key(src[p])) / len(ring)


def seam_error(tile):
    px = tile.load()
    n = tile.width
    diff = 0
    for i in range(n):
        for a, b in (((0, i), (n - 1, i)), ((i, 0), (i, n - 1))):
            pa, pb = px[a], px[b]
            diff += sum(abs(pa[k] - pb[k]) for k in range(3)) / 3
    return diff / (2 * n)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheets_dir")
    ap.add_argument("--out", required=True)
    ap.add_argument("--tile", type=int, default=32)
    ap.add_argument("--grid", type=int, default=8)
    ap.add_argument("--rows", type=int, default=7)
    ap.add_argument("--colors", type=int, default=32)
    args = ap.parse_args()

    sheets = sorted(p for p in Path(args.sheets_dir).glob("*.png"))
    if not sheets:
        sys.exit(f"no PNG sheets in {args.sheets_dir}")

    tiles, index, problems = [], {}, []
    for path in sheets:
        sid = path.stem.rsplit("-", 1)[-1].upper()[:1]
        sheet = Image.open(path).convert("RGB")
        cell = sheet.width // args.grid
        if sheet.width != sheet.height or sheet.width % args.grid:
            problems.append(f"{path.name}: {sheet.width}x{sheet.height} is not a square {args.grid}x{args.grid} grid")
        if cell % args.tile:
            problems.append(f"{path.name}: cell {cell}px is not a multiple of tile {args.tile}px")
        for row in range(args.rows):
            for col in range(args.grid):
                cid = f"{sid}:{'ABCDEFGH'[col]}{row + 1}"
                tile = cell_to_tile(sheet, col, row, cell, args.tile)
                if tile.getbbox() is None:
                    problems.append(f"{cid}: empty cell")
                    continue
                bleed = edge_touch(sheet, col, row, cell)
                seamless = (sid, row + 1, col) in SEAMLESS_CELLS
                if bleed > 0.25 and not seamless:
                    problems.append(f"{cid}: off-grid ({bleed:.0%} of the cell border is painted)")
                if seamless and seam_error(tile) > 18:
                    problems.append(f"{cid}: seam (edges differ by {seam_error(tile):.0f}/255 on average)")
                index[cid] = len(tiles)
                tiles.append(tile)

    if not tiles:
        sys.exit("no tiles found")

    cols = args.grid
    rows = -(-len(tiles) // cols)
    packed = Image.new("RGBA", (cols * args.tile, rows * args.tile), (0, 0, 0, 0))
    for i, t in enumerate(tiles):
        packed.paste(t, ((i % cols) * args.tile, (i // cols) * args.tile))

    alpha = packed.getchannel("A")
    rgb = packed.convert("RGB").quantize(colors=args.colors, method=Image.Quantize.MEDIANCUT).convert("RGB")
    packed = Image.merge("RGBA", (*rgb.split(), alpha))
    used = len(Image.composite(rgb, Image.new("RGB", rgb.size, MAGENTA), alpha).getcolors(1 << 16) or []) - 1

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    packed.save(out / "tiles.png")
    packed.resize((packed.width * 4, packed.height * 4), Image.NEAREST).save(out / "preview.png")
    (out / "tiles.json").write_text(json.dumps({"tile": args.tile, "columns": cols, "index": index}, indent=1))

    print(f"tiles: {len(tiles)} from {len(sheets)} sheet(s), palette: {used} colours")
    print(f"wrote {out / 'tiles.png'}, {out / 'tiles.json'}, {out / 'preview.png'}")
    if problems:
        print(f"\n{len(problems)} problem(s):")
        for p in problems:
            print(f"  - {p}")
    else:
        print("no problems found")


if __name__ == "__main__":
    main()
