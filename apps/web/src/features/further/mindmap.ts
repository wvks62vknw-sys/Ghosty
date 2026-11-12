/**
 * THE ORB AS A REAL MAP OF WHAT HE KNOWS (BRIEF-OCT-IDEAS-3 item 2). A long hold on the orb on Home, or "what do you know?", opens
 * MIND AS A MAP: the memory's own records (the timeline's lines, facts, diary days and lessons, and his saved places) laid out as
 * nodes by subject on the orb's own points (features/core/mind.ts `shellPoint`), the nearest subjects largest. A tap on a node reads
 * the memory behind it in a sheet with KEEP and FORGET (the memory's own changes, as the Memory screen makes them, with UNDO).
 *
 * No model and nothing sent: it is a view of what the phone already asks of the brain's memory (the timeline and the places). Every
 * state is said: reading it, nothing known yet, no connection.
 */
import type { MemoryItem } from '../../../../../packages/shared/src/protocol';
import type { SavedPlace } from '../../../../../packages/shared/src/places';
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { navTo } from '../../shell/areas';
import { button, modal, toast, undo } from '../../ui/components';
import { shellPoint } from '../core/mind';

/** The sections of ME, in his words (the memory screen's own headings). */
const SECTION_WORDS: Record<string, string> = {
  about: 'Who you are',
  likes: 'What you like',
  dislikes: 'What you don’t like',
  people: 'Your people',
  places: 'Places in your life',
  routines: 'Your routines',
  goals: 'What you’re working towards',
  work: 'Your work',
  other: 'Also',
};
/** The subject a memory is under, in his words. */
export function subjectOf(m: Pick<MemoryItem, 'kind' | 'section'>): { id: string; label: string } {
  if (m.kind === 'profile') {
    const s = m.section ?? 'other';
    return { id: `p-${s}`, label: SECTION_WORDS[s] ?? 'Also' };
  }
  return m.kind === 'fact' ? { id: 'fact', label: 'Things you told me' } : m.kind === 'diary' ? { id: 'diary', label: 'My diary of us' } : { id: 'lesson', label: 'What I learned' };
}

/** One thing on the map. */
export interface MapNode {
  id: string;
  subject: string;
  label: string;
  text: string;
  from: string;
  at: number;
  weight: number;
  kind: MemoryItem['kind'] | 'place';
  place?: SavedPlace;
}

/** Most nodes drawn (a finger needs room; the rest are said, and left to Memory). */
export const MAX_NODES = 36;
const NODE = 44;
const GAP = NODE + 4;

const day = (at: number) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const FROM: Record<string, string> = { owner: 'From your own words', chat: 'From a chat', reflection: 'From my nightly reflection', ghosty: 'Something I noticed', unknown: 'From what I have kept' };

/** The nodes: every memory and saved place, then the ones worth the room, round-robin across the subjects (heavier and newer first). */
export function nodesOf(items: MemoryItem[], places: SavedPlace[]): { nodes: MapNode[]; total: number } {
  const all: MapNode[] = items.map((m) => {
    const s = subjectOf(m);
    return { id: m.id, subject: s.id, label: s.label, text: m.text, from: `${FROM[m.src?.kind ?? 'unknown'] ?? FROM.unknown} · ${day(m.at)}`, at: m.at, weight: m.weight ?? 1, kind: m.kind };
  });
  for (const p of places) all.push({ id: `place:${p.id}`, subject: 'places-saved', label: 'Places you saved', text: `${p.label}: ${p.address || p.query}`, from: `Saved place · ${day(p.at)}`, at: p.at, weight: 2, kind: 'place', place: p });
  const bySubject = new Map<string, MapNode[]>();
  for (const n of all) bySubject.set(n.subject, [...(bySubject.get(n.subject) ?? []), n]);
  for (const list of bySubject.values()) list.sort((a, b) => b.weight - a.weight || b.at - a.at);
  const picked: MapNode[] = [];
  for (let round = 0; picked.length < MAX_NODES; round++) {
    let any = false;
    for (const list of bySubject.values()) {
      if (list[round] && picked.length < MAX_NODES) {
        picked.push(list[round]!);
        any = true;
      }
    }
    if (!any) break;
  }
  return { nodes: picked, total: all.length };
}

export interface Placed {
  node: MapNode;
  /** Centre, in px on the stage. */
  x: number;
  y: number;
  /** Diameter: the nearer the subject, the larger (44 to 60). */
  size: number;
  /** 0 (far side of the orb) to 1 (nearest). */
  near: number;
}

/**
 * Lay the nodes out on a square stage of `S` px: the subjects on the orb's own points (the freshest subject on the nearest point),
 * each node on a small spiral round its subject, then eased apart so no two touch (a finger takes one). Pure.
 */
export function layout(nodes: MapNode[], S: number): { placed: Placed[]; subjects: { id: string; label: string; x: number; y: number; n: number; near: number }[] } {
  const order = new Map<string, { id: string; label: string; fresh: number; list: MapNode[] }>();
  for (const n of nodes) {
    const o = order.get(n.subject) ?? { id: n.subject, label: n.label, fresh: 0, list: [] };
    o.list.push(n);
    o.fresh = Math.max(o.fresh, n.at);
    order.set(n.subject, o);
  }
  const subjects = [...order.values()].sort((a, b) => b.fresh - a.fresh);
  const k = subjects.length;
  const points = subjects.map((_, i) => ({ i, p: shellPoint(i, k) })).sort((a, b) => b.p[2] - a.p[2]);
  const shellMax = k < 2 ? 1 : k < 6 ? 0.56 : 0.64;
  const half = S / 2 - NODE;
  const placed: Placed[] = [];
  const outSubjects: { id: string; label: string; x: number; y: number; n: number; near: number }[] = [];
  subjects.forEach((s, rank) => {
    const p = points[rank]!.p;
    const near = k < 2 ? 1 : (p[2] / shellMax + 1) / 2;
    const cx = S / 2 + (p[0] / shellMax) * half * 0.82;
    const cy = S / 2 + (p[1] / shellMax) * half * 0.82;
    outSubjects.push({ id: s.id, label: s.label, x: cx, y: cy, n: s.list.length, near });
    s.list.forEach((node, j) => {
      const a = j * Math.PI * (3 - Math.sqrt(5));
      const r = j === 0 ? 0 : GAP * 0.62 * Math.sqrt(j) + GAP * 0.3;
      placed.push({ node, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, size: Math.round(NODE + near * 16), near });
    });
  });
  // eased apart: two nodes closer than a finger move away from each other; none leaves the stage
  const lo = NODE / 2 + 2;
  const hi = S - lo;
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let a = 0; a < placed.length; a++) {
      for (let b = a + 1; b < placed.length; b++) {
        const A = placed[a]!;
        const B = placed[b]!;
        const want = (A.size + B.size) / 2 + 2;
        let dx = B.x - A.x;
        let dy = B.y - A.y;
        let d = Math.hypot(dx, dy);
        if (d >= want) continue;
        if (d < 0.01) {
          dx = Math.cos(a + b);
          dy = Math.sin(a + b);
          d = 1;
        }
        const push = (want - d) / 2 + 0.2;
        A.x -= (dx / d) * push;
        A.y -= (dy / d) * push;
        B.x += (dx / d) * push;
        B.y += (dy / d) * push;
        moved = true;
      }
    }
    for (const q of placed) {
      q.x = Math.min(hi, Math.max(lo, q.x));
      q.y = Math.min(hi, Math.max(lo, q.y));
    }
    if (!moved) break;
  }
  return { placed, subjects: outSubjects };
}

/** What a test can read (window.__ghosty.mindmap). */
export const mapState = { open: false, nodes: 0, total: 0, subjects: 0, shown: '' };
let openNow: { close(): void } | null = null;

/** Open MIND AS A MAP (a second call while it is open leaves it as it is). */
export function openMindMap(): void {
  if (openNow) return;
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.mindmap = mapState;
  const say = h('p.mmsay', { role: 'status' }, 'Reading my memory…');
  const stage = h('div.mmstage', { 'aria-label': 'What I know, as a map: each dot is one thing' });
  const read = h('div.mmread', { 'aria-live': 'polite', hidden: true });
  const more = h('div.mmmore', { hidden: true });
  const box = h('div.mindmap', say, stage, read, more);
  const m = modal('My memory as a map', box, () => {
    openNow = null;
    mapState.open = false;
    mapState.shown = '';
  });
  openNow = m;
  mapState.open = true;

  let items: MemoryItem[] = [];
  let places: SavedPlace[] = [];
  let on = '';

  const readNode = (n: MapNode, el: HTMLElement) => {
    for (const x of stage.querySelectorAll('.mmnode')) {
      x.classList.toggle('on', x === el);
      x.setAttribute('aria-pressed', String(x === el));
    }
    on = n.id;
    mapState.shown = n.id;
    read.hidden = false;
    const acts = h('div.row.wrap.mmacts');
    if (n.kind === 'place') {
      acts.append(button('OPEN MEMORY', () => {
        m.close();
        navTo('memory', 'push');
      }));
    } else {
      const keep = button('KEEP', async (b) => {
        b.disabled = true;
        try {
          await brain.memoryChange(n.id, n.kind === 'fact' ? 'keep' : 'lock');
          toast(n.kind === 'fact' ? 'Kept: I won’t let it go' : 'Kept: I won’t change or drop it', 'ok');
        } catch (e) {
          toast(`I couldn’t keep it: ${(e as Error).message}`, 'bad');
        }
        b.disabled = false;
      }, 'on');
      keep.dataset.case = 'keep';
      const forget = button('FORGET', async (b) => {
        b.disabled = true;
        try {
          await brain.memoryChange(n.id, 'forget');
        } catch (e) {
          b.disabled = false;
          return void toast(`I couldn’t let go of it: ${(e as Error).message}. Try again when you’re back online.`, 'bad');
        }
        items = items.filter((x) => x.id !== n.id);
        paint();
        read.hidden = true;
        undo(`Forgotten: “${n.text.length > 60 ? `${n.text.slice(0, 60)}…` : n.text}”`, async () => {
          try {
            await brain.memoryChange(n.id, 'restore');
            toast('Back in my memory', 'ok');
            await load(false);
          } catch (e) {
            toast(`I couldn’t bring it back: ${(e as Error).message}`, 'bad');
          }
        });
      }, 'warn');
      forget.dataset.case = 'keep';
      acts.append(keep, forget);
    }
    clear(read, h('b.mmsubject', n.label), h('p.mmtext', n.text), h('small.mmfrom', n.from), acts);
  };

  function paint(): void {
    const { nodes, total } = nodesOf(items, places);
    mapState.nodes = nodes.length;
    mapState.total = total;
    clear(stage);
    if (!total) {
      mapState.subjects = 0;
      say.textContent = 'I don’t know anything about you yet. Tell me things, or save a place, and they appear here.';
      more.hidden = true;
      return;
    }
    const S = Math.max(240, Math.min(stage.clientWidth || 340, 460));
    stage.style.height = `${S}px`;
    const { placed, subjects } = layout(nodes, S);
    mapState.subjects = subjects.length;
    say.textContent = `${total} ${total === 1 ? 'thing' : 'things'} I know, in ${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'}. The nearest subjects are the biggest.`;
    // each subject's name sits just above its cluster (clear of the dots), kept inside the stage
    for (const s of subjects) {
      const mine = placed.filter((q) => q.node.subject === s.id);
      const top = Math.min(...mine.map((q) => q.y - q.size / 2));
      const x = Math.min(S * 0.8, Math.max(S * 0.2, s.x));
      const l = h('span.mmsub', { style: { left: `${(x / S) * 100}%`, top: `${(Math.max(14, top - 2) / S) * 100}%` }, 'aria-hidden': 'true' }, `${s.label} · ${s.n}`);
      stage.append(l);
    }
    for (const q of placed) {
      const b = h('button.mmnode', {
        type: 'button',
        'aria-label': `${q.node.label}: ${q.node.text}`,
        'aria-pressed': String(q.node.id === on),
        dataset: { id: q.node.id, subject: q.node.subject, size: String(q.size), kind: q.node.kind, case: 'keep' },
        style: `left:${((q.x / S) * 100).toFixed(2)}%;top:${((q.y / S) * 100).toFixed(2)}%;width:${q.size}px;height:${q.size}px;--near:${q.near.toFixed(2)}`,
      }, h('i'));
      if (q.node.id === on) b.classList.add('on');
      b.addEventListener('click', () => readNode(q.node, b));
      stage.append(b);
    }
    more.hidden = total <= nodes.length;
    clear(more, h('p.mmsay', `${total - nodes.length} more are in Memory; I drew the ones that matter most.`), button('OPEN MEMORY', () => {
      m.close();
      navTo('memory', 'push');
    }));
  }

  async function load(first = true): Promise<void> {
    if (first) say.textContent = 'Reading my memory…';
    const [t, p] = await Promise.allSettled([brain.memoryTimeline(), brain.places()]);
    if (!openNow) return;
    if (t.status === 'rejected' && p.status === 'rejected') {
      clear(stage);
      more.hidden = false;
      say.textContent = offlineNow(t.reason)
        ? 'I can’t reach my brain, so I can’t draw what I know. Try again when you’re back online.'
        : `I couldn’t read my memory just now (${String((t.reason as Error)?.message ?? t.reason)}).`;
      clear(more, button('TRY AGAIN', () => void load()));
      return;
    }
    items = t.status === 'fulfilled' ? t.value.items : [];
    places = p.status === 'fulfilled' ? p.value.places : [];
    paint();
  }
  const offlineNow = (e: unknown) => e instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);
  void load();
  // drawn to the width it has now, and again if the phone turns
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => openNow && items.length + places.length && paint()).observe(stage);
}

/**
 * A long hold on `el` (the orb's wrap) opens the map. A finger that moves is a scroll, not a hold; the tap after a hold that fired is
 * swallowed (the orb pokes the Mind on a tap, and a hold is not one).
 */
export function holdOrb(el: HTMLElement, ms = 650): void {
  let timer = 0;
  let from = { x: 0, y: 0 };
  let fired = false;
  el.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button, a, input, textarea')) return;
    fired = false;
    from = { x: e.clientX, y: e.clientY };
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      fired = true;
      openMindMap();
    }, ms);
  });
  el.addEventListener('pointermove', (e) => Math.hypot(e.clientX - from.x, e.clientY - from.y) > 10 && clearTimeout(timer));
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => clearTimeout(timer));
  el.addEventListener('click', (e) => {
    if (!fired) return;
    fired = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
  el.addEventListener('contextmenu', (e) => {
    if (fired) e.preventDefault();
  });
}
