---
name: office-art-studio
description: End-to-end process for designing a pixel-art office (or any top-down workplace) for a team - interviews the user about the team and the look they want, writes a style, generates or hands over prompts for full sprite sheets (floors, walls, furniture, utility props), slices and validates the tiles, and builds a complete floor layout from the team structure. Use this whenever someone wants office art, a new office theme or style, tilesets or sprite sheets for an office/workspace scene, image-generation prompts for game assets, a "god view" office canvas, or wants to turn a team or org chart into an office floor plan, even if they only say "make the office look modern" or "give me prompts for ChatGPT".
---

# Office Art Studio

Turn "who is this team and how should their office feel" into a finished, tile-based office: a style, 168 consistent assets, validated tiles, and a floor plan that seats the team.

The pipeline is deliberately linear because consistency is the whole game. Generated art only looks like one office if every sheet shares the same grid, palette, light and scale, so each step locks something down for the next.

```
1 Interview → 2 Detect image tool → 3 Write the style → 4 Generate sheets A/B/C
→ 5 Slice + validate → 6 Build the layout → 7 Preview + iterate → 8 Record licence
```

## 1. Interview (ask before designing anything)

Use a question tool if one exists, otherwise ask in chat. Ask these in one round, offering concrete options with a recommendation, so the user can answer in seconds:

1. **The team**: what does it do (engineering, support, design studio, IT ops, sales, research...) and roughly how many people or agents? Is there an org chart with departments and leads? (A team's work decides the utility props: an IT team needs a monitoring wall and server room, a design studio needs pin-up boards and a print table.)
2. **The environment**: which look? Offer the styles in `references/styles.md` (Corporate glass, Scandi wood, Dark tech, Startup loft, Warm cozy, Modern corporate, IT operations) plus "describe your own". Ask for a reference image or link if they have one, and describe its look in your own words. Never ask a generator to copy a named artist or paid pack.
3. **The mood and brand**: light or dark UI host, brand colours to weave in, anything to avoid.
4. **Detail level**: 32px tiles (recommended: monitors, mugs and keyboards read clearly) or 16px (chunkier, faster).
5. **Where it will run**: this repo's Paperclip Office plugin (the default here), another engine that reads Tiled maps, or "just the art".

If the user already answered some of these earlier in the conversation, don't ask again. Confirm the gaps only.

## 2. Detect an image-generation tool

Look at your own tool list for anything that creates images: names or descriptions mentioning image generation, `generate_image`, `create_image`, `gpt-image`, `dall-e`, `imagen`, `stable diffusion`, `flux`, or an MCP server for one of these. Also check for an API key in the environment (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `STABILITY_API_KEY`, `REPLICATE_API_TOKEN`), but only use a key if the user says to, because it spends their money.

- **Tool available**: generate every sheet yourself (step 4), one sheet per call, feeding the previous sheet back as a reference image when the tool accepts one.
- **No tool**: produce the exact prompts for the user to paste into ChatGPT or Gemini, in order, and tell them what to send back (file names in step 4). Say plainly that you can't generate images here. The rest of the pipeline is the same.

## 3. Write the style block

A style block is one paragraph that fixes materials, palette and mood. Write it from the interview; use `references/styles.md` as the pattern and starting point. Include:

- floor material and texture, corridor floor, wall colour and trim
- desk, chair and monitor materials; soft furnishings; plants
- 3 to 5 accent colours as named hues (hex if the user gave brand colours)
- light source and mood in a few words
- four department accent floors (the layout colours departments with these)

Then decide team-specific cell swaps. The sheets have a fixed cell list (see step 4), and a few cells can be swapped for props this team actually uses. Examples: IT ops swaps the ping-pong table for a monitoring-wall screen; a design studio swaps the vending machine for a large-format printer; a support team swaps the arcade cabinet for a headset charging rack. Keep swaps to the "nice to have" cells (the list in `references/asset-catalogue.md` marks which cells the engine depends on) so nothing the layout needs goes missing.

Show the user the style block and swaps, and get a yes before generating. Changing the style after 168 assets exist is expensive.

## 4. Generate the sheets

Every style is three 1024×1024 sheets on an 8×8 grid of 128px cells, 7 rows used. Each cell holds one item drawn as 32px art scaled 4× on flat magenta (#FF00FF).

- **Sheet A**: floors, rugs, walls, corners, doors, glass, windows, wall fixtures, plants.
- **Sheet B**: desks (monitor off and on), chairs in four directions, meeting, café, lounge, kitchen, printer, server racks, reception.
- **Sheet C**: props that show live data: boards the game draws on, status lamps and flags to tint, paper stacks for queue depth, inbox trays, wall screens, plaques, signs, plus detail and elegance pieces.

Assemble each prompt as **Base prompt + Style block + Sheet list (+ swaps)**. The exact text of all three sheet lists, the base prompt and seven worked style blocks are in `examples/paperclip-office-prompts.md`. Reuse them word for word; they were tuned so generators keep the grid.

Order and consistency rules, with the reason for each:
- Generate A, then B, then C in the **same chat or with the previous sheet attached**. A fresh context drifts in palette and pixel scale.
- Items marked (neutral) are drawn white/light grey. The engine tints them per state or department, so one lamp covers every colour.
- Clock without hands, blank signs and blank plaques: the engine draws those parts live.
- If a cell is wrong, regenerate that cell only ("Regenerate only cell C4, keep every other cell identical"). Regenerating a whole sheet changes the palette.

File names to save or ask the user for: `<style-id>-A.png`, `<style-id>-B.png`, `<style-id>-C.png` in `assets/free/styles/<style-id>/sheets/`.

## 5. Slice and validate

Run the bundled script. It keys out magenta, downsamples each 128px cell to 32px by sampling cell centres (averaging would blur pixel art), builds one shared palette, packs a tileset, writes an index and a 4× preview, and reports problems:

```bash
python .claude/skills/office-art-studio/scripts/slice_sheets.py assets/free/styles/<style-id>/sheets --out assets/free/styles/<style-id> --tile 32
```

Read its report and fix what it flags before building anything:
- **empty cell** where an item was expected: regenerate that cell.
- **off-grid**: content touching cell edges or bleeding into neighbours means the generator drifted from the grid; regenerate with "draw thin grey guide lines between cells" added, or regenerate that cell.
- **seam** on floor and wall tiles (edges that don't match when tiled): regenerate the tile with "make this tile seamless".
- **palette > 32 colours**: fine to accept; the script quantizes, but look at the preview for banding.

Open `preview.png` and look at it yourself. The script can't judge style drift between sheets, and that is the most common failure.

## 6. Build the layout

The floor plan comes from the team, not from the art. Seat leads at the head of their department room, give the top person the corner office, put shared rooms (boardroom, café, lounge, server room if the team needs one) on the edges, and keep corridors 2 tiles wide so characters can pass.

**In this repo (Paperclip Office plugin)** the generator already does this: read `docs/layouts.md` first (it records every pitfall we hit), then add a palette for the new style next to `src/layout/kenney.ts`, mapping each role (floor, wall top/face/base, desk with monitor off/on, chair, café, boardroom, plants, props) to tile indexes from `tiles.json`. Add the style to the layout picker and themes. Rules that matter:
- Seat spawn points must start with `desk-` or the vendored scene never walks agents to them.
- `monitorRow` must match how many rows the monitor sits above the seat in your desk stamp.
- Rooms keep the template geometry so vendor anchors (coffee tray, sink, errands, clock, boards) land on the right props.

**Elsewhere**: write a Tiled JSON map (`.tmj`) with layers `floor`, `walls`, `furniture-below`, `furniture-above`, an object layer of named spawn points (seats, café seats, entrance), and the packed tileset. `references/layout-recipe.md` has the room-sizing rules and a minimal map skeleton.

## 7. Preview and iterate

Render the map to a PNG (PIL: paste tiles by index at 32px) or, in this repo, run `npm run demo` and screenshot it. Look at: desks aligned with chairs and monitors, readable props at whole-floor zoom, department colours distinct, nothing blocking corridors. Show the user the render and ask what to change. Style changes go back to step 3; single bad tiles go back to step 4 for that cell only.

## 8. Record the licence

Add the style to `assets/catalogue.json` (source: which generator, date, who generated it) and to `NOTICE`. Tell the user to confirm their generator plan lets them use and publish the output. Never commit third-party packs whose licence forbids redistribution; those go in a gitignored local folder and load only when present.

## Files in this skill

- `examples/paperclip-office-prompts.md`: the full, tested prompt set (base prompt, sheets A/B/C, 7 style blocks, slicing prompt for ChatGPT).
- `references/styles.md`: the style catalogue with what each style suits.
- `references/asset-catalogue.md`: every cell, what it's for, and which ones the engine depends on.
- `references/layout-recipe.md`: room sizing, corridor rules, Tiled map skeleton.
- `scripts/slice_sheets.py`: slicing, palette, packing and validation.
