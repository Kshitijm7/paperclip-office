# Scandi wood: tileset prompts (v2, modular)

One style, four sheets, made so the pieces **join** like the Mifflin (LimeZu) office: floors tile without lines, walls run continuously, a desk is one drawing that spans several tiles, and every object is sized for the characters already in the game.

## What went wrong in v1 (and what these prompts change)

| v1 problem | Cause | v2 rule |
|---|---|---|
| "Half tables" | Each cell was its own complete little picture | Multi-tile objects are drawn as **one image across several cells**; we cut them apart afterwards, so they rejoin perfectly |
| Gaps in walls | Every wall cell had its own frame | Walls are drawn as **one long continuous strip**, then cut |
| Floors too sharp | Plank lines on every tile edge | Floors are one **large seamless, low-contrast swatch**, no line on tile borders |
| Wrong sizes | Every item padded differently in a 32px cell | Everything is on a **16px grid** matched to 16×32px characters, and fills its footprint |

## The grid (same for all four sheets)

- Canvas **1024 × 1024 px** = **16 columns × 16 rows** of **64 × 64 px cells**.
- **One cell = one 16 × 16 px game tile drawn at 4×.** Every art pixel is a crisp 4×4 block.
- Columns are lettered **A–P** (left to right) and rows are numbered **1–16** (top to bottom). `C3:E4` means the rectangle from cell C3 to cell E4, 3 wide × 2 tall.
- Each object fills **exactly its rectangle**, edge to edge where it touches the floor, with no margin. Nothing crosses into another object's rectangle.
- All cells not listed are flat magenta **#FF00FF**.

## Scale reference: the characters

A standing person in the game is **1 tile wide × 2 tiles tall** (16 × 32 px): a small chibi office worker. Draw everything to suit that:
- A desk is **3 tiles wide**.
- An office chair fits **1 tile**.
- A sofa is **3 tiles wide**.
- A door is **2 tiles wide**.
- A wall is **3 tiles tall** from the top cap to the skirting.

## How to use

1. Start **one ChatGPT chat** for the whole style. Paste the **Base prompt** first, then **Sheet 1**.
2. When Sheet 1 is right, ask for **Sheet 2** in the same chat, then 3, then 4. The same chat keeps the palette and pixel size consistent.
3. If one object is wrong, say: `Redraw only <rectangle>, keep every other pixel of the sheet identical.`
4. Save the sheets as **`scandi-1.png` … `scandi-4.png`** and put them in `assets/free/styles/scandi-wood/v2/`. Claude cuts them on the 16px grid using the rectangles below.

---

## Base prompt (paste first)

```
You are making a game tileset sheet for a top-down pixel-art office (the same camera as classic top-down RPGs: floors seen from directly above, walls and furniture shown with their front face visible, like a 3/4 view).

GRID — follow exactly:
- Canvas exactly 1024 × 1024 px, 16 columns (A–P) × 16 rows (1–16) of 64 × 64 px cells.
- Each cell is ONE 16 × 16 px game tile drawn at 4× scale: every art pixel is a crisp 4×4 block. No anti-aliasing, no gradients inside a pixel, no blur, no painterly shading.
- Objects occupy the exact rectangle of cells I give. A multi-cell object is ONE continuous drawing across its cells (do not draw separate small objects per cell). It fills its rectangle to the edges it stands on, with no empty margin.
- Everything I do not list is flat pure magenta #FF00FF. No text, no letters, no numbers, no logos, no watermark, no border around the sheet.

SCALE: characters in this game are 16 × 32 px chibi office workers (1 tile wide, 2 tiles tall). A desk is 3 tiles wide, an office chair 1 tile, a door 2 tiles wide, a wall 3 tiles tall.

STYLE — Scandinavian studio office: pale oak wood, white-washed walls, rounded white desks with oak legs, pastel upholstery (sage, dusty pink, pale blue, mustard), wool rugs, many green plants in white and terracotta pots, soft warm daylight. Calm, airy, friendly. Light from the top-left. Clean 1-pixel darker outline on furniture (a darker shade of the object's own colour, never pure black). Soft 1-step shading only.

PALETTE — use ONLY these colours (plus #FF00FF background):
oak light #E9D2A8, oak mid #D4B384, oak dark #B48E5E, oak grain #C9A574,
white #F7F4EE, off-white #ECE6DC, warm grey #CFC7BA, grey #A79E91, charcoal #4A4541, ink #2E2A27,
sage #A9BFA0, sage dark #7E9676, pink #E5B7B0, pink dark #C98F88, pale blue #B8CCD8, blue dark #86A0B2,
mustard #E2B659, mustard dark #BF9038, terracotta #C9825E, leaf #6E9A5B, leaf dark #4E7442,
screen off #3B4046, screen on #9ED8F0, screen glow #DDF3FA, glass #D5E6EC, brass #C8A45A, red accent #D46A5E.
```

---

## Sheet 1: floors and walls

```
SHEET 1 — floors and walls. Draw exactly these rectangles:

FLOORS (each is a SEAMLESS texture: its left edge continues its right edge and its top edge continues its bottom edge; keep contrast LOW — no dark line along tile borders, planks run horizontally with staggered joints that do not line up with the 16 px grid):
A1:D4 main floor: pale oak planks (oak light with oak grain, subtle).
E1:H4 corridor floor: light warm-grey stone tiles, very soft joints.
I1:L4 café floor: off-white terrazzo with tiny sage and pink flecks.
M1:P4 boardroom floor: sage wool carpet, fine texture, no pattern.
A5:B6 department accent floor 1: dusty-pink wool carpet (seamless).
C5:D6 department accent floor 2: pale-blue wool carpet (seamless).
E5:F6 department accent floor 3: mustard wool carpet (seamless).
G5:H6 department accent floor 4: sage wool carpet, slightly darker than M1 (seamless).

RUG (9-slice, one drawing): I5:K7 a 3×3-tile rectangular wool rug in off-white with a thin sage border; the corners, edges and centre must be separable so the rug can be stretched.
DOOR MAT: L5:M5 a 2×1 oak-framed door mat, sage centre.

WALLS — draw ONE continuous white-washed wall seen from the front, 3 tiles tall: row 1 of the wall = a thin light top cap, rows 2 = plain white wall face, row 3 = oak skirting board at the bottom.
A8:P10 one continuous straight wall, 16 tiles wide × 3 tall, perfectly repeating every tile horizontally (no frames, no seams, no vertical lines between tiles).
A11:C13 outer corner, wall turning DOWN on the left (the wall continues downward as a thin 1-tile-wide vertical wall seen from above).
D11:F13 outer corner, wall turning DOWN on the right.
G11:G14 vertical wall seen from above: 1 tile wide, 4 tall, continuous, white top with a thin oak edge, repeats vertically.
H11:I13 doorway: a 2-tile-wide opening in the 3-tall wall with an oak door frame; the floor shows through (leave floor area magenta).
J11:K13 the same doorway with a closed oak door.
L11:M13 the same doorway with a glass door, oak frame.
N11:O13 a large window in the wall: 2 tiles wide in the wall face, white frame, soft blue sky with a birch tree.
P11:P13 wall end cap (where a straight wall stops), 1 wide × 3 tall.

GLASS PARTITION: A15:D15 a 4×1 low glass partition with thin oak frame and oak base, repeats horizontally.
LOW DIVIDER: E15:G15 a 3×1 low felt divider panel, sage, on oak feet.
```

## Sheet 2: workstations, meeting, lounge

```
SHEET 2 — furniture. Same grid, style, palette and scale as Sheet 1. Draw exactly these rectangles:

WORKSTATION, monitor OFF: A1:C2 one rounded white desk with oak legs, 3 tiles wide × 2 tall, seen from the front-top. On it: one monitor centred on the back half of the desk, screen facing the viewer, screen DARK (screen off #3B4046), a keyboard in front of it, a small plant on the left, a mug on the right.
WORKSTATION, monitor ON: D1:F2 EXACTLY the same drawing pixel for pixel, except the screen is glowing (screen on #9ED8F0 with a few lighter lines of screen glow #DDF3FA).
WORKSTATION 2 OFF / ON: G1:I2 and J1:L2 same pair as above but with a laptop instead of a monitor and papers instead of the plant (again identical except the laptop screen).
OFFICE CHAIRS, 1×1 each, pastel fabric seat, oak or white base, seen from above/behind as a person would sit at a desk above it:
M1 chair facing UP (we see its back), sage. N1 facing UP, pink. O1 facing UP, pale blue. P1 facing UP, mustard.
M2 chair facing DOWN (we see the seat front), sage. N2 facing LEFT, sage. O2 facing RIGHT, sage. P2 stool, oak.

EXECUTIVE DESK OFF / ON: A4:D5 and E4:H5 a larger oak desk 4×2 with a monitor and a brass lamp; identical except the screen is off / on.
EXECUTIVE CHAIR: I4 1×1 higher-backed chair facing UP, off-white leather.

MEETING TABLE: A7:E8 one long rounded oak table 5 tiles wide × 2 tall with a plant in the middle, no chairs on it.
MEETING CHAIRS: F7 facing DOWN, G7 facing UP, H7 facing DOWN, I7 facing UP (all 1×1, white shell chairs on oak legs).
ROUND CAFÉ TABLE: J7:K8 2×2 round white table on an oak pedestal, with two cups.
BAR STOOLS: L7 and M7 1×1 each.

SOFA: A10:C11 a 3×2 linen three-seat sofa, off-white with sage and pink cushions, front facing the viewer.
ARMCHAIR: D10:D11 a 1×2 mustard armchair facing the viewer.
COFFEE TABLE: E10:F11 a 2×2 low oval oak coffee table with a book and a small vase.
BEAN BAGS: G10 sage, H10 pink (1×1 each).
FLOOR CUSHIONS: G11 pale blue, H11 mustard.
RECEPTION DESK: I10:L11 a 4×2 curved white reception counter with an oak top, a small monitor and a plant.
STANDING DESK: M10:O11 a 3×2 white standing desk with a monitor (screen on).
PING-PONG TABLE: A13:D14 a 4×2 table, sage top, white lines, net across the middle.
FOOSBALL: E13:G14 a 3×2 foosball table, oak.
```

## Sheet 3: café, storage, tech

```
SHEET 3 — café, storage and tech. Same grid, style, palette and scale. Draw exactly these rectangles:

KITCHEN COUNTER RUN (these must join side by side into one continuous counter, 1 tile wide × 2 tall each, same height, same top line, same oak worktop):
A1:A2 counter left end. B1:B2 counter plain middle (repeatable). C1:C2 counter with sink and tap. D1:D2 counter with espresso machine. E1:E2 counter with microwave. F1:F2 counter with a fruit bowl. G1:G2 counter with a rack of clean mugs. H1:H2 the same counter with an EMPTY mug rack. I1:I2 counter right end.
FRIDGE: J1:J2 1×2 tall white fridge.
VENDING MACHINE: K1:K2 1×2, pale blue, lit.
WATER COOLER: L1:L2 1×2, white with a blue bottle.
DISHWASHER: M1:M2 1×2 built-in, white.

BOOKSHELF: A4:B5 2×2 oak bookshelf full of pastel books and plants.
LOW SHELF / CREDENZA: C4:D4 2×1 oak credenza with plants and books on top.
FILING CABINET: E4:E5 1×2 white.
PRINTER: F4:G5 2×2 white office printer/copier on an oak stand.
LOCKERS: H4:I5 2×2 sage lockers.
COAT RACK: J4:J5 1×2 oak coat stand with a scarf.
UMBRELLA STAND: K4 1×1.
TROPHY CABINET: L4:M5 2×2 glass-front oak cabinet with small trophies.

SERVER RACK OFF: A7:A8 1×2 charcoal rack with DARK status lights.
SERVER RACK ON: B7:B8 identical, lights lit (small green and blue dots).
NETWORK CABINET: C7:C8 1×2 white.
PA STATION: D7:E8 2×2 small oak desk with a clipboard and a tablet, a chair facing UP drawn in front of it as part of the image.
MAIL CART: F7 1×1.
DESK STATUS LAMP: G7 1×1, drawn in WHITE / light grey only (the game tints it).
DESK FLAG: H7 1×1 small flag on a stand, WHITE only (tinted by the game).
PAPER STACKS on desk: I7 small, J7 medium, K7 tall and messy (1×1 each, transparent around them).
IN/OUT TRAYS: L7 1×1. RED INBOX TRAY: M7 1×1. SERVICE BELL: N7 1×1. NAME PLATE (blank, no text): O7 1×1.
WELCOME BOX with a balloon: P7:P8 1×2.
```

## Sheet 4: wall-mounted, plants and small props

```
SHEET 4 — wall-mounted items (drawn as seen hanging on the white wall face, background magenta), plants and small props. Same grid, style, palette and scale. Draw exactly these rectangles:

WALL ITEMS:
A1:C2 kanban board: white board with 3 empty columns separated by thin grey lines, NO notes (the game draws them).
D1:D1 wall calendar with an empty grid, no numbers.
E1 round wall clock, oak rim, white face, NO hands (the game draws them).
F1:G2 cork "ask me" board, empty, one red pin.
H1:I2 wall screen showing a bar chart. J1:K2 wall screen showing a rising line and a coin. L1:M2 wall screen showing lines of a list (no readable text).
N1:P1 wide empty brass plaque frame (3×1), for a Wall of Fame.
A4:B5 whiteboard with a few pastel sticky notes. C4:D5 notice board with pinned papers.
E4:F5 abstract art print (sage and pink shapes). G4:H5 landscape print (fjord). I4:J5 framed group photo (tiny silhouettes, no faces).
K4:L4 wall shelf with small plants. M4 wall lamp (sconce). N4 fire extinguisher. O4 first-aid box. P4 exit sign with a running-figure icon (no text).
M5 air vent. N5 security camera. O5 badge reader. P5 blank department sign plate.

PLANTS (in white or terracotta pots):
A7 small plant 1×1. B7 small succulent 1×1. C7:C8 tall fiddle-leaf fig 1×2. D7:D8 tall monstera 1×2. E7:F7 long planter box with herbs 2×1. G7:H7 low hedge planter 2×1. I7:I8 hanging plant 1×2 (hangs from the top of its rectangle).

SMALL PROPS (1×1, transparent around them):
A10 bin. B10 recycling bin. C10 cardboard box. D10:E10 two stacked moving boxes 2×1. F10 floor lamp (1×1 base, the shade can reach the top of the cell). G10 vase of flowers. H10 magazine rack. I10 bench seat 1×1 (repeatable end to end). J10 desk plant. K10 trophy. L10 stack of books. M10 laptop closed. N10 mug. O10 headphones. P10 notebook and pen.
A12:C12 bench 3×1 oak, one drawing. D12:D13 game console with TV 1×2. E12:E13 arcade cabinet 1×2.
```

---

## What Claude builds from these

- **Cutting:** each sheet is cut on its 16px grid (64px cells ÷ 4). Every rectangle above becomes a named object whose tiles already join.
- **Floors and walls:**
  - Floors are sampled from the middle of each large swatch, so there are no edge lines.
  - Walls are taken from the long strip: the cap, face and skirting rows, plus a repeatable middle column.
- **Layout:** the office uses exactly the Mifflin department layout: the Chief's office, boardroom, café, department rooms with a Lead desk and desk pods, corridors, and a lounge. Each Mifflin object is swapped for the matching Scandi object:
  - a 3-wide workstation replaces the Mifflin desk
  - the off/on pair lights up when an agent sits down
  - the counter run makes the café, with the mug rack for the coffee routine
  - the kanban board, calendar, clock and "ask me" board sit on the walls, where they stay clickable
- **Tinting:** the white lamp and flag are tinted with each agent's state and the PA's flags.

## Check before sending

- Each sheet is 1024 × 1024 (if ChatGPT gives 1254 or another size, send it anyway; Claude rescales it).
- Floors: tile two copies side by side in any viewer. No visible line where they meet.
- Walls: the long strip has no vertical lines.
- The workstation off/on pair is identical apart from the screen.
