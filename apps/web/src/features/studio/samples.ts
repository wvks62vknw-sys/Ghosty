/**
 * The 3D STUDIO's built-in samples and its panes, as the studio renders them (features/studio/index.ts). Pure, so the
 * ABILITIES catalogue reads the same lists (apps/web/src/abilities/sources.ts) and its test can too: a sample or a pane added
 * here is listed there by itself, or the catalogue's test names it.
 */

/** The samples that ship with Ghosty (public/models), each credited as its licence asks. */
export const SAMPLES = [
  { id: 'reactor', title: 'Arc reactor', note: 'built in · 16 parts', file: '', credit: 'Made for Ghosty from simple shapes' },
  { id: 'toycar', title: 'Toy car', note: 'Khronos sample · CC0', file: 'ToyCar.glb', credit: 'Toy car by Guido Odendahl and Eric Chadwick, CC0 (Khronos glTF Sample Assets)' },
  { id: 'chair', title: 'Sheen chair', note: 'Khronos sample · CC0', file: 'SheenChair.glb', credit: 'Sheen chair © 2020 Wayfair LLC, by Eric Chadwick, CC0 (Khronos glTF Sample Assets)' },
  { id: 'sofa', title: 'Glam velvet sofa', note: 'Khronos sample · CC BY 4.0', file: 'GlamVelvetSofa.glb', credit: 'Glam velvet sofa © 2021 Wayfair LLC, by Eric Chadwick, CC BY 4.0 (Khronos glTF Sample Assets)' },
  { id: 'truck', title: 'Milk truck', note: 'Khronos sample · CC BY 4.0', file: 'CesiumMilkTruck.glb', credit: 'Cesium Milk Truck © 2017 Cesium, CC BY 4.0; Cesium logo is a trademark of Cesium (Khronos glTF Sample Assets)' },
  // the car from a plate, built here from its public facts (apps/web/src/car): it opens the CAR · FIX IT pane
  { id: 'car', title: 'Car, bonnet up', note: 'built in · from its plate', file: '', credit: 'A stand-in car made for Ghosty from its public facts' },
  // [restd] a build designed from his words (apps/web/src/build): it opens the DESIGN A BUILD pane
  { id: 'build', title: 'Design a build', note: 'built in · from your words', file: '', credit: 'A design drawn by Ghosty from your words: a first estimate, never certified' },
] as const;
export type SampleId = (typeof SAMPLES)[number]['id'];

export type Pane = 'models' | 'parts' | 'tools' | 'make' | 'room' | 'spline' | 'car' | 'build';
export const PANES: { id: Pane; label: string }[] = [
  { id: 'models', label: 'MODELS' },
  { id: 'parts', label: 'PARTS' },
  { id: 'tools', label: 'CUT · MEASURE' },
  { id: 'make', label: 'MAKE · PHOTO' },
  { id: 'room', label: 'ROOM' },
  { id: 'spline', label: 'SPLINE' },
  { id: 'car', label: 'CAR · FIX IT' },
  { id: 'build', label: 'DESIGN A BUILD' },
];
