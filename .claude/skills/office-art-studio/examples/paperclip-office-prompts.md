# Office art prompts (ChatGPT image generation)

Seven office styles, two sprite sheets each. Every sheet uses the same 8×8 grid, so one slicing script turns any of them into a theme.

## How to use this

1. In ChatGPT, paste the **Base prompt**, then the **Style block** for the style you want. Generate **Sheet A** first, then Sheet B in the same chat so the style stays consistent.
2. Download each sheet as PNG. Name it `<style>-A.png` and `<style>-B.png`, for example `corporate-glass-A.png`.
3. Optional: paste the **Slicing prompt** into ChatGPT and let it cut the sheets into tiles for you. Otherwise, send the sheets to Claude and it slices them.
4. Put the files in `assets/free/styles/<style>/`. Claude wires them into the layout picker.

Tips:
- If a cell comes out wrong, say "Regenerate only cell C4, keep everything else identical." ChatGPT edits in place well.
- If the grid drifts, add: "Draw thin 1px grey guide lines between cells". We remove them when slicing.
- Keep one chat per style. A fresh chat changes the look.

---

## Base prompt (paste first, every time)

```
Create a pixel-art sprite sheet for a top-down office management game, seen from directly above with a slight 3/4 tilt (like Stardew Valley or Prison Architect).

Canvas: exactly 1024 × 1024 px, a grid of 8 columns × 8 rows, each cell exactly 128 × 128 px. Each cell holds ONE item, centred, drawn as 32 × 32 pixel art scaled up 4× with nearest-neighbour (every art pixel is a crisp 4×4 block, no anti-aliasing, no blur, no gradients inside a pixel).

Background: every empty area is flat pure magenta #FF00FF (it will be keyed out). No shadows onto the background, no text, no labels, no watermark, no border around the sheet.

Lighting: light from the top-left, a 1-pixel darker outline on objects, a limited palette of at most 32 colours for the whole sheet. All furniture at the same scale: a desk is 2 cells wide when it spans cells, a chair fits in one cell, a person would be about 1 × 1.5 cells.

Floor and wall tiles must be seamless: their left edge matches their right edge and their top edge matches their bottom edge, so they tile without seams.

Follow the cell list exactly (columns A–H left to right, rows 1–8 top to bottom).
```

## Sheet A: floors, walls, doors (paste after the base prompt and a style block)

```
SHEET A — building tiles. Cell list:
Row 1: A1 main floor tile, B1 main floor variant, C1 corridor floor, D1 corridor floor variant, E1 café floor, F1 boardroom floor, G1 department floor accent 1, H1 department floor accent 2
Row 2: A2 department floor accent 3, B2 department floor accent 4, C2 door mat / rug centre tile, D2 rug edge top, E2 rug edge left, F2 rug corner top-left, G2 entrance mat, H2 floor with tiny cable cover
Row 3: A3 wall top (seen from above, thin cap), B3 wall face (front of wall, full cell), C3 wall face with window, D3 wall face with framed picture, E3 wall face with clock, F3 wall base / skirting, G3 wall face with company logo plaque (blank), H3 wall face with whiteboard
Row 4: A4 outer corner top-left, B4 outer corner top-right, C4 outer corner bottom-left, D4 outer corner bottom-right, E4 vertical wall left side, F4 vertical wall right side, G4 wall end cap, H4 wall T-junction
Row 5: A5 door closed (front), B5 door open (front), C5 glass door, D5 glass partition horizontal, E5 glass partition vertical, F5 glass partition corner, G5 low divider panel horizontal, H5 low divider panel vertical
Row 6: A6 window on outer wall (large), B6 window with blinds, C6 wall light / sconce, D6 air vent, E6 fire extinguisher on wall, F6 notice board, G6 wall TV / screen off, H6 wall TV / screen on (dashboard)
Row 7: A7 floor lamp, B7 ceiling-light glow decal (soft circle on floor), C7 floor plant small, D7 floor plant tall, E7 plant in long planter (left half), F7 plant in long planter (right half), G7 pillar / column, H7 bin
Row 8: A8 to H8 leave empty magenta.
```

## Sheet B: furniture and props

```
SHEET B — furniture and props, same style, palette and scale as Sheet A. Cell list:
Row 1: A1 desk left half, B1 desk right half with monitor OFF (monitor faces up/away from the viewer), C1 desk left half, D1 desk right half with monitor ON (glowing screen), E1 office chair facing up (seen from behind), F1 office chair facing down, G1 office chair facing left, H1 office chair facing right
Row 2: A2 executive desk left half, B2 executive desk right half, C2 executive chair, D2 standing desk with monitor, E2 dual-monitor desk left half, F2 dual-monitor desk right half, G2 laptop on desk (single cell desk), H2 desk lamp + mug + notebook (desk clutter overlay, transparent around it)
Row 3: A3 meeting table left end, B3 meeting table middle, C3 meeting table right end, D3 meeting chair facing down, E3 meeting chair facing up, F3 round café table, G3 café stool, H3 bar-height counter
Row 4: A4 sofa left half, B4 sofa right half, C4 armchair, D4 coffee table, E4 bean bag, F4 rug with pattern (whole cell), G4 bookshelf (tall, full cell), H4 low bookshelf / credenza
Row 5: A5 kitchen counter with sink, B5 kitchen counter plain, C5 coffee machine on counter, D5 fridge, E5 vending machine, F5 water cooler, G5 microwave on counter, H5 fruit bowl on counter
Row 6: A6 printer / copier, B6 filing cabinet, C6 server rack (lights on), D6 server rack (lights off), E6 whiteboard on stand, F6 reception desk left half, G6 reception desk right half, H6 lockers
Row 7: A7 potted plant on desk, B7 trophy, C7 stack of papers, D7 cardboard box, E7 umbrella stand, F7 coat rack, G7 ping-pong table left half, H7 ping-pong table right half
Row 8: A8 to H8 leave empty magenta.
```

## Sheet C: props that show Paperclip data (paste after Sheet B, same chat)

Every cell here is tied to something the plugin already knows. Items marked (neutral) are drawn in white or light grey so the plugin can tint them with a state or department colour at runtime.

```
SHEET C — utility and detail props, same style, palette and scale as Sheets A and B. Cell list:
Row 1: A1 wall kanban board, empty, 3 columns with thin dividers (notes are drawn by the game), B1 wall calendar, blank grid, C1 wall clock, round, no hands (hands drawn by the game), D1 "ask me" board: empty cork board with a red pin, E1 wall screen showing a bar chart (leaderboard), F1 wall screen showing a line going up and a coin icon (budget), G1 wall screen showing a scrolling text list (activity feed), H1 gold plaque frame, empty, wide (Wall of Fame)
Row 2: A2 trophy cabinet with glass doors and trophies, B2 small desk sign plate, blank (name plate), C2 blank department sign above a door, D2 blank door name plate, E2 desk status lamp (neutral white glow), F2 desk flag holder with small flag (neutral), G2 red inbox tray with papers on desk, H2 service bell on desk
Row 3: A3 paper stack small (2 sheets), B3 paper stack medium, C3 paper stack tall and messy, D3 in/out letter trays, E3 mail cart, F3 envelope on floor, G3 clipboard on a podium (PA station), H3 small desk with clipboard and tablet (PA desk)
Row 4: A4 sideboard with a mug rack (clean mugs), B4 sideboard with empty mug rack, C4 dishwasher, D4 open window (sash raised), E4 window at night (dark blue, lights outside), F4 window blinds closed, G4 curtains, H4 window sill plant
Row 5: A5 server rack front with status lights (neutral), B5 network switch cabinet, C5 cable tray on floor, D5 UPS battery unit, E5 security camera on wall, F5 badge reader by door, G5 fire exit sign (no text, running figure icon), H5 first-aid box on wall
Row 6: A6 wall art abstract 1, B6 wall art abstract 2, C6 wall art landscape, D6 framed photo group, E6 vase with flowers on table, F6 magazine rack, G6 bench, H6 planter box with small hedge
Row 7: A7 game console with TV (lounge), B7 arcade cabinet, C7 foosball table left half, D7 foosball table right half, E7 bookshelf with plants, F7 floor cushion, G7 new-hire welcome box with balloon, H7 moving boxes stacked
Row 8: A8 to H8 leave empty magenta.
```

---

## Style blocks (paste one after the base prompt)

### 1. Corporate glass

```
STYLE: Modern corporate headquarters. Mid-grey low-pile carpet tiles with a subtle square pattern, light grey corridors, white walls with brushed-steel trim, frosted and clear glass partitions with thin dark-teal frames, dark walnut-and-black desks, black mesh office chairs, teal (#2F8F8B) and navy accents, large windows with city light, neat potted fiddle-leaf figs. Clean, professional, calm. Department accent floors: muted teal, slate blue, sand, soft green.
```

### 2. Scandi wood

```
STYLE: Scandinavian studio office. Pale oak plank floors with visible grain, white-washed walls, rounded white desks with oak legs, pastel chairs (sage green, dusty pink, pale blue, mustard), wool rugs, lots of hanging and floor plants, linen sofas, warm daylight. Soft, airy, friendly. Department accent floors: light oak, birch, soft sage, blush.
```

### 3. Dark tech

```
STYLE: Late-night tech company. Near-black matte floor (#15161A) with faint grid lines, charcoal walls with thin cyan and magenta LED edge strips, black desks with RGB-lit keyboards and bright monitors, gaming-style chairs, server racks with blinking green and blue lights, neon wall signs (no text), glass with a cyan tint. High contrast, glowing screens are the main light. Department accent floors: deep blue, deep purple, dark teal, graphite.
```

### 4. Startup loft

```
STYLE: Converted warehouse startup. Polished concrete floor with small cracks and patches, exposed red-brick walls, black steel window frames, reclaimed-wood long tables and standing desks, bean bags, whiteboards covered in coloured sticky notes, hanging Edison bulbs, a ping-pong table, big plants in metal tubs. Energetic and casual. Department accent floors: painted concrete in mustard, teal, coral, olive.
```

### 5. Warm cozy

```
STYLE: Cozy boutique office. Warm honey wood floors, patterned wool rugs, wood-panelled lower walls with cream plaster above, brass lamps giving warm pools of light, leather armchairs and tufted sofas, green banker's lamps on desks, full bookshelves, trailing plants. Inviting and warm. Department accent floors: terracotta, forest green, burgundy, ochre rugs.
```

### 6. Modern corporate (grey and teal)

```
STYLE: Bright modern corporate office in clean, detailed pixel art. Medium-grey carpet with a very subtle speckle, light-grey tiled corridors, off-white walls with a thin dark-teal trim and cream skirting, floor-to-ceiling teal-tinted glass partitions with slim dark frames, warm honey-wood desks with black legs, black ergonomic office chairs, slim black monitors with blue-white screens, teal fabric armchairs and a teal sofa in the waiting area, a curved light-wood reception desk, round meeting table with teal chairs, copier and filing cabinets in a print corner, a break corner with a small counter, glossy green potted plants in white and grey pots, and hedge planters along the outer wall. Crisp dark outlines, soft top-left light, even clean shading, calm professional mood. Department accent floors: soft teal, slate grey, warm sand, pale sage.
```

### 7. IT operations (blue-grey tech)

```
STYLE: Modern IT network operations centre in clean, detailed pixel art. Cool blue-grey vinyl floor with faint panel seams, darker navy-grey corridors, pale grey walls with steel-blue trim, a large monitoring wall of dark screens showing bright blue network maps and green graphs, desks with two or three monitors each showing blue and cyan dashboards, navy-blue office chairs, a server room with tall black racks and rows of small green, blue and amber status lights, cable trays, an IT help-desk counter with a headset, a repair bench with tools and open laptops, grey metal storage shelves with labelled boxes, a glass-walled meeting room with a wall display, navy waiting-room chairs, a water cooler and small potted plants for colour. Crisp dark outlines, screen glow as the main accent light, tidy technical mood. Department accent floors: steel blue, deep navy, cool grey, muted cyan.
```

---

## Slicing prompt (optional: let ChatGPT do the cutting)

Paste this in the same chat after both sheets exist, or upload the two PNGs first.

```
Use Python to process the two sprite sheets I generated (Sheet A and Sheet B):
1. Load each 1024×1024 PNG. Split it into an 8×8 grid of 128×128 cells.
2. For each cell: replace every pixel within 40 of pure magenta #FF00FF with full transparency, then downscale 4× to 32×32 using nearest-neighbour (take the centre pixel of each 4×4 block, not an average).
3. Reduce the whole set to one shared palette of at most 32 colours (median cut over all non-transparent pixels), keeping transparency.
4. Skip cells that are fully transparent after keying.
5. Pack all tiles into one sheet `tiles.png`, 8 columns wide, 32×32 per tile, no gaps, in reading order (Sheet A cells first, then Sheet B).
6. Write `tiles.json` mapping each cell id (e.g. "A:C3", "B:D1") to its tile index.
7. Also save a 4× preview `preview.png` of `tiles.png` so I can check it.
Give me a zip containing tiles.png, tiles.json and preview.png.
```

## What Claude does with the result

- Checks that each tile is really 32×32 on the grid, that floor and wall tiles tile seamlessly, and that the palette is consistent.
- Builds a palette for the style (like `src/layout/kenney.ts`) and maps each cell to a role: floor, wall, desk with monitor, chair, café, boardroom, plants.
- Adds the style to the layout picker, then renders a preview of the demo company in it before you pick it.
- Records the source and licence in `assets/catalogue.json`. Check that your ChatGPT plan lets you use and publish generated images. Current OpenAI terms assign output to you, but confirm for your account.
