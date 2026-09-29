# Scandi wood v2 — modular generation drafts

Four sheets generated using the built-in image generation tool from the supplied modular v2 specification. Sheet 1 received one layout-correction edit. Final prompts and the original user specification are included.

- scandi-1.png: floors, wall strip, corners, doors, partitions.
- scandi-2.png: workstations, chairs, meeting and lounge furniture.
- scandi-3.png: continuous kitchen counter, appliances, storage and technical props.
- scandi-4.png: wall-mounted items, plants and small props.

These are unmodified 1254×1254 source images. The request explicitly permits sending non-1024 output for later rescaling. Some sheets use native transparency rather than the requested magenta background.

## Review status

The continuous wall, desk/table drawings, and kitchen counter run are present. However, generated object positions and margins do not consistently match the specified 16×16 grid. A resize alone will not correct placement. Do not automatically slice these using the requested rectangles without first aligning the artwork.

The fixed palette, crisp 4×4 art pixels, exact off/on identity outside screen interiors, seamless floor edges, repeatable counter modules, and edge-to-edge footprints are not satisfied or certified. Furniture orientations and small details also need review. The wall has no internal vertical seams but retains outer margins. Source images include smooth shading and edge artifacts.

No tile atlas or runtime integration is supplied for this draft, since producing a nominal grid atlas would cut through misaligned objects. Earlier Scandi A/B/C assets and packs are preserved separately.

Next art step: align the continuous objects to the specified rectangles, enforce the fixed palette and pixel grid, derive each on/off pair from one shared base, then validate repeats before slicing.

That next step has started in `../validated-core/`. It contains the first tested floor, wall, whole desk with screen overlays, chair, counter modules, packed atlas, and PixiJS canvas preview. It is the production pattern for replacing these draft sheets incrementally.
