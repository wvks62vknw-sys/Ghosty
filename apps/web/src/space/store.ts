/**
 * The SPACE PLANNER's plan and the measurements MEASURE saved, kept on this phone only
 * (localStorage 'ghosty.space'; nothing goes to the brain unless the owner asks Ghosty). Shared
 * by the planner tab and the Lens's MEASURE mode; a storage error (private browsing, full) keeps
 * the plan in memory for this visit instead of failing.
 */
import type { Measurement } from '../measure/geom';
import { footprint, readPlan, type Item, type Plan, type Room } from './plan';

const KEY = 'ghosty.space';
const MAX_MEASURES = 20;

export interface SpaceData {
  plan: Plan;
  /** Newest last. */
  measures: (Measurement & { at: number })[];
}

const DEFAULT: SpaceData = {
  plan: {
    v: 1,
    room: { w: 420, d: 360 },
    items: [
      { id: 'sofa', kind: 'sofa3', label: 'Sofa, 3-seater', w: 210, d: 95, x: 105, y: 0, rot: 0 },
      { id: 'tv', kind: 'tv', label: 'TV unit', w: 150, d: 40, x: 135, y: 320, rot: 2 },
      { id: 'chair', kind: 'armchair', label: 'Armchair', w: 85, d: 85, x: 0, y: 140, rot: 3 },
    ],
  },
  measures: [],
};

let data: SpaceData | null = null;

/** The pieces pulled back inside a room that just changed size (one too big for it stays at the wall, shown as a clash). */
function keepInside(room: Room, items: Item[]): Item[] {
  return items.map((it) => {
    const f = footprint(it);
    return { ...it, x: Math.max(0, Math.min(it.x, room.w - f.w)), y: Math.max(0, Math.min(it.y, room.d - f.h)) };
  });
}
const listeners = new Set<() => void>();

function load(): SpaceData {
  if (data) return data;
  try {
    const raw = localStorage.getItem(KEY);
    const j = raw ? (JSON.parse(raw) as { plan?: unknown; measures?: unknown }) : null;
    const plan = j ? readPlan(j.plan) : null;
    const measures = Array.isArray(j?.measures) ? (j!.measures as SpaceData['measures']).filter((m) => m && (m.kind === 'length' || m.kind === 'rect') && m.w > 0).slice(-MAX_MEASURES) : [];
    data = plan ? { plan, measures } : structuredClone(DEFAULT);
  } catch {
    data = structuredClone(DEFAULT);
  }
  return data;
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage refused: the plan lives on in memory for this visit */
  }
  for (const f of listeners) f();
}

export const space = {
  get: (): SpaceData => load(),
  subscribe(f: () => void): () => void {
    listeners.add(f);
    return () => listeners.delete(f);
  },
  setRoom(room: Room): void {
    const d = load();
    const r = { w: Math.round(room.w), d: Math.round(room.d) };
    d.plan = { ...d.plan, room: r, items: keepInside(r, d.plan.items) };
    save();
  },
  setItems(items: Item[]): void {
    const d = load();
    d.plan = { ...d.plan, items };
    save();
  },
  setPlan(plan: Plan): void {
    load().plan = plan;
    save();
  },
  /** MEASURE's SAVE: the set is kept (newest last); the first rectangle gives the room's width and a second its depth. */
  addMeasurements(list: Measurement[]): { room: boolean } {
    const d = load();
    const now = Date.now();
    d.measures = [...d.measures, ...list.map((m) => ({ ...m, at: now }))].slice(-MAX_MEASURES);
    const rects = list.filter((m) => m.kind === 'rect');
    let room = false;
    if (rects[0]) {
      const w = Math.round(rects[0].w / 10);
      const depth = rects[1] ? Math.round(rects[1].w / 10) : d.plan.room.d;
      if (w >= 50 && w <= 5000) {
        d.plan = { ...d.plan, room: { w, d: depth }, items: keepInside({ w, d: depth }, d.plan.items) };
        room = true;
      }
    }
    save();
    return { room };
  },
  clearMeasurements(): void {
    load().measures = [];
    save();
  },
};
