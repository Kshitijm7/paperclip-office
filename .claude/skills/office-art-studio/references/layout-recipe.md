# Layout recipe

How to turn a team into a floor plan. In the Paperclip Office repo, `src/layout/generate.ts` already implements this; read `docs/layouts.md` there before changing it. Use this file for other engines or to explain choices.

## Rooms from the team

| Team input | Room |
|---|---|
| Top of the org chart | Corner office: 6×5 tiles, desk + chair + shelves + small meeting table |
| Each department | A room sized to its people: lead desk at the head, then desk pods of 2 or 4 |
| Everyone | Boardroom 9×5 (table for 8), café 8×9 (counter, sink, coffee, fridge, two tables), lounge corner (sofa, coffee table) |
| Team needs (from the interview) | Server room, help desk, print corner, phone booths, reception at the entrance |

Sizing:
- Desk block: 3 tiles wide × 4 tall (monitor row, desk row, chair row, aisle). A pod of 4 is 2×2 blocks.
- Corridors: 2 tiles wide, so two characters can pass. A spine corridor at most 4 wide.
- Walls: inner walls 2 rows (top + face), outer wall 3 rows so wall props sit at a readable height.
- Doors: 2 tiles wide, never blocked by furniture.
- Leave one free tile in front of every prop a character uses (coffee machine, sink, fridge, printer).

Placement:
- Shared rooms (café, boardroom) on the edges; departments in bands between corridors.
- The chief's office in a top corner, far from the entrance.
- Entrance centred on the bottom wall, with reception beside it if present.
- Sort people by a stable id so the same team always gets the same seats.

Checks (automate them):
1. Every seat and every prop stand is reachable from the entrance (BFS over walkable tiles).
2. Every monitor sits the same number of rows above its seat.
3. No two seats share a tile; no furniture on a door or corridor tile.

## Tiled map skeleton (.tmj)

```json
{
  "type": "map", "orientation": "orthogonal", "renderorder": "right-down",
  "width": 60, "height": 40, "tilewidth": 32, "tileheight": 32, "infinite": false,
  "tilesets": [{ "firstgid": 1, "image": "tiles.png", "imagewidth": 256, "imageheight": 672,
                 "tilewidth": 32, "tileheight": 32, "columns": 8, "tilecount": 168, "name": "style" }],
  "layers": [
    { "type": "tilelayer", "name": "floor", "width": 60, "height": 40, "data": [] },
    { "type": "tilelayer", "name": "walls", "width": 60, "height": 40, "data": [] },
    { "type": "tilelayer", "name": "furniture-below", "width": 60, "height": 40, "data": [] },
    { "type": "tilelayer", "name": "furniture-above", "width": 60, "height": 40, "data": [] },
    { "type": "objectgroup", "name": "spawns", "objects": [
      { "name": "entrance", "x": 960, "y": 1248, "point": true },
      { "name": "desk-ceo", "x": 96, "y": 160, "point": true },
      { "name": "desk-engineering-0", "x": 480, "y": 320, "point": true }
    ]}
  ]
}
```

`data` arrays hold `width × height` gids (tile index + firstgid, 0 = empty). Tile indexes come from `tiles.json` produced by `scripts/slice_sheets.py`. Mark collision on walls and furniture with a tile property `collision: 1` or a separate collision layer, depending on the engine.
