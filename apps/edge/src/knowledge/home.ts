/**
 * Home know-how Ghosty can look up with `study`: the parts of a sofa, a chair and a bed by their
 * proper names (so a photo of one can be described part by part), the sizes and clearances
 * that make a room work, and how to plan a rearrangement or a reconstruction with the owner's
 * own tools — the Lens's MEASURE, the SPACE PLANNER and find_furniture.
 */
import type { Playbook } from './types';

export const HOME: Playbook[] = [
  {
    id: 'furniture-and-space',
    title: 'Furniture and space: name the parts, measure, find what fits, make space',
    tags: ['furniture', 'sofa', 'couch', 'chair', 'armchair', 'bed', 'wardrobe', 'parts of a sofa', 'reconstruct', 'make space', 'space planner', 'room layout', 'measure', 'fit', 'clearance', 'walkway', 'interior', 'rearrange'],
    body: `NAMING THE PARTS (a photo of furniture: name what you can see, top to bottom, and say which parts you cannot see)
- SOFA: frame (hardwood, plywood or chipboard; the hidden structure), arms (track/square, rolled/scroll, flared, slope, pillow-top), back (tight back = upholstered fixed; loose/scatter cushions; pillow back), seat cushions (foam, fibre wrap, feather, pocket sprung), seat deck (the platform under the cushions), suspension (webbing, serpentine/zig-zag springs, pocket springs), feet/legs (block, tapered, castor, plinth), skirt (fabric hiding the legs), piping/welting (the cord trim along seams), bolsters and scatter cushions, upholstery (fabric, velvet, leather, faux leather). Variants: chaise end, corner/L-shape, modular sections, sofa bed (pull-out mechanism), recliner (power or manual mechanism).
- ARMCHAIR / DINING CHAIR: seat, seat rail/apron, back (splat, slats, spindles, top rail/crest rail), stiles (the two uprights of the back), arms and arm posts, legs, stretchers (bars between legs), feet, glides/castors; wing chair: wings; upholstered: seat pad, back pad, buttons (deep buttoning/tufting).
- BED: headboard, footboard, side rails, slats (sprung or solid, centre support rail and legs on a double or bigger), base (divan with drawers, ottoman lift-up storage, platform), mattress (open coil, pocket sprung, memory foam, hybrid), topper, valance. UK mattress sizes: single 90×190, small double 120×190, double 135×190, king 150×200, super king 180×200 cm; the frame adds about 5–15 cm each way.
- WARDROBE: carcass (sides, top, base, back panel), doors (hinged, sliding, mirrored), hanging rail, shelves, drawers, plinth, cornice; needs the door's swing (about its door width) or none for sliding doors.

RECONSTRUCT / RE-COVER: say what the job involves part by part (strip the old cover, check the frame joints and springs, replace foam to the same density, re-cover, re-pipe), what is a DIY job and what needs an upholsterer, and what to measure first (each cushion W × D × thickness, the arm height, the back height).

THE SIZES THAT MATTER (UK homes)
- Walkways: 70 cm minimum between pieces you walk between (90 cm is comfortable); 60 cm beside a bed; 90 cm in front of a wardrobe with hinged doors.
- Sofa to TV: about 1.5–2.5 × the screen's diagonal; coffee table 40–45 cm from the sofa's front.
- Dining: 75 cm from the table edge to a wall behind a chair (90 cm to walk behind it).
- Door swings and radiators: keep the arc of a door clear; leave 10 cm in front of a radiator.
- Delivery: the item (or its box) must pass the front door, the hall's turn and the stairs — measure the narrowest door (usually 76 cm) and the diagonal depth of a sofa.

HOW TO HELP, STEP BY STEP
1. Measure: open_lens with mode "measure" (the owner calibrates with a bank card, an A4 sheet, a door or a distance and taps two points or a wall's four corners) or ask for the sizes; MEASURE's SAVE puts them in the planner.
2. Plan: open_space with the room's width and depth; the owner drags the pieces; the planner marks gaps under 70 cm.
3. Make space: the planner's MAKE SPACE proposes up to 3 layouts freeing the most open floor — explain the best one in words (what moves where and why).
4. Find what fits: find_furniture with the item, max_width_cm/max_depth_cm/max_height_cm from the measurements (minus the clearances above) and a budget; give the top few with the shop, the stated price and the link; never invent a price or a size, and say when a page gave none.`,
  },
];
