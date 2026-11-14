/**
 * [planlane4:calendar] DRAG TO MOVE. Press and hold one of his own events on the timeline and drag it to a new time, in 15-minute steps (and,
 * on the week by the hour, to another day): a ghost shows the new time while it moves, and on release the brain changes it IN PLACE (the same
 * id, its length kept, its reminder moving with it), with UNDO. With no signal the move waits on this phone like any change.
 *  - the pointer: one pointer at a time, captured once the hold has fired; a hold of HOLD_MS with the finger still (SLOP) is what starts a
 *    drag, so a finger that moves first is a scroll and never a drag (a mouse may also start one by moving with its button down); while it
 *    drags the page never scrolls under the finger (touchmove is stopped), only on purpose at the screen's edge;
 *  - a calendar feed's event is read only: a hold says so instead of moving it;
 *  - for a tap-only hand: EARLIER / LATER by 15 minutes and A DAY LATER, in the event's sheet (moveKeys).
 */
import type { AgendaEventInfo } from '../../../../../packages/shared/src/protocol';
import { moveEvent } from '../../api/brain';
import { fmt, h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { sayError } from '../../ui/hisWords';

export const STEP = 15 * 60_000;
export const HOLD_MS = 300;
export const SLOP = 8;
const HOUR = 3600_000;
const hm = (ms: number) => fmt.time(new Date(ms));

/** Onto the nearest quarter hour (every zone's offset is a whole number of quarters, so the clock's quarters are these). */
export const snapQuarter = (ms: number): number => Math.round(ms / STEP) * STEP;
/** The same clock time `n` days on, by the calendar (a clock-change day is 23 or 25 hours long, never a shifted time). */
export function shiftDays(ms: number, n: number): number {
  if (!n) return ms;
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes()).getTime();
}
/** Where a drag of `dy` pixels (on a grid of `hourPx` pixels an hour) and `days` columns puts a start: on a quarter, kept in [lo, hi]. */
export function dragStart(start: number, dy: number, hourPx: number, days = 0, lo = -Infinity, hi = Infinity): number {
  const moved = snapQuarter(start + (hourPx > 0 ? (dy / hourPx) * HOUR : 0));
  const day = shiftDays(moved, days);
  return Math.min(Math.max(day, lo), hi);
}
/** "Sat 14 Nov 14:15–15:15" (today's day said as Today, tomorrow's as Tomorrow): where a move puts it. */
export function whenWords(start: number, end: number | undefined, now = Date.now()): string {
  const d0 = new Date(now);
  const mid = (n: number) => new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + n).getTime();
  const day = start >= mid(0) && start < mid(1) ? 'Today' : start >= mid(1) && start < mid(2) ? 'Tomorrow' : new Date(start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} ${hm(start)}${end && end > start ? `–${hm(end)}` : ''}`;
}
/** His own (his diary, or one waiting on this phone to be sent): only these move. */
export const movable = (e: Pick<AgendaEventInfo, 'source' | 'id'>): boolean => e.source === 'mine' || e.id.startsWith('local-') || e.source.startsWith('this device');
/** A feed's event held: said in his words, never moved. */
export const readOnlyWords = (e: Pick<AgendaEventInfo, 'source' | 'title'>): string => `${e.title} is from your calendar “${e.source}”, which Ghosty only reads, so it can’t be moved here. Change it in that calendar.`;

/**
 * Move one of his events to `start` (its length kept by the brain), say it on `show`'s UNDO bar, and tell the Agenda to read the diary again.
 * Returns false (and says why) when it could not be moved.
 */
export async function moveTo(e: AgendaEventInfo, start: number, show: (text: string, undo: () => Promise<void>) => void): Promise<boolean> {
  if (start === e.start) return true;
  let r: { queued: boolean };
  try {
    r = await moveEvent(e.id, { start });
  } catch (err) {
    /* state: agenda.drag error */
    toast(sayError(err, 'move that event'), 'bad');
    return false;
  }
  dispatchEvent(new CustomEvent('ghosty:agenda'));
  const end = e.end && e.end > e.start ? start + (e.end - e.start) : undefined;
  /* state: agenda.drag offline */
  show(r.queued ? `Moved on this phone: ${e.title} to ${whenWords(start, end)}. It goes to your brain when it’s back.` : `Moved: ${e.title} to ${whenWords(start, end)}`, async () => {
    // UNDO puts it back where it was: the same event, its old start and end (its reminder follows it back)
    await moveEvent(e.id, { start: e.start, end: e.end ?? null });
    toast(`Back as it was: ${e.title}`, 'ok');
    dispatchEvent(new CustomEvent('ghosty:agenda'));
  });
  return true;
}

/** EARLIER / LATER by 15 minutes and A DAY LATER (a day earlier and later for an all-day one): the 44 pt way to move it without a drag. */
export function moveKeys(e: AgendaEventInfo, show: (text: string, undo: () => Promise<void>) => void): HTMLElement {
  const end = (s: number) => (e.end && e.end > e.start ? s + (e.end - e.start) : undefined);
  const key = (label: string, to: number, said: string) => {
    const b = button(label, async (x) => {
      if (x.disabled) return;
      x.disabled = true;
      await moveTo(e, to, show);
      x.disabled = false;
    }, 'agmovekey');
    b.setAttribute('aria-label', `${said}, to ${whenWords(to, end(to))}`);
    return b;
  };
  const keys = e.allDay
    ? [key('A DAY EARLIER', shiftDays(e.start, -1), `Move ${e.title} a day earlier`), key('A DAY LATER', shiftDays(e.start, 1), `Move ${e.title} a day later`)]
    : [key('EARLIER', snapQuarter(e.start - STEP), `Move ${e.title} 15 minutes earlier`), key('LATER', snapQuarter(e.start + STEP), `Move ${e.title} 15 minutes later`), key('A DAY LATER', shiftDays(e.start, 1), `Move ${e.title} a day later`)];
  return h('div.keyrow.wrapit.agmove', { role: 'group', 'aria-label': 'Move it' }, ...keys);
}

/** The scroller the page moves in (the nearest that scrolls), for the edge's slow scroll while dragging. */
function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const s = getComputedStyle(p).overflowY;
    if ((s === 'auto' || s === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

export interface DragPlace {
  /** the new start the drag points at */
  start: number;
  /** where the ghost is drawn (CSS values) and what it says */
  top: string;
  left?: string;
  width?: string;
  label: string;
}

/**
 * Make `el` (an event's box in `grid`) movable by press-and-hold and drag. `place(dx, dy)` says where a drag of that far puts it (the
 * caller knows its grid); `drop(start)` is called on release at a new start; `refuse()` when the event is not his to move.
 */
export function attachDrag(el: HTMLElement, o: { grid: HTMLElement; can: boolean; height: string; place(dx: number, dy: number): DragPlace; drop(start: number): void; refuse(): void; start: number }): void {
  let st: { id: number; x0: number; y0: number; kind: string; timer: number; on: boolean; scroller: HTMLElement; s0: number; x: number; y: number; ghost?: HTMLElement; at?: number; raf?: number } | null = null;
  let swallow = false;
  const finish = (dropIt: boolean) => {
    if (!st) return;
    const s = st;
    st = null;
    clearTimeout(s.timer);
    if (s.raf) cancelAnimationFrame(s.raf);
    s.ghost?.remove();
    el.classList.remove('agdragging');
    delete o.grid.dataset.dragging;
    try {
      if (el.hasPointerCapture(s.id)) el.releasePointerCapture(s.id);
    } catch {
      /* already let go */
    }
    if (s.on) swallow = true;
    if (dropIt && s.on && s.at !== undefined && s.at !== o.start) o.drop(s.at);
  };
  const paint = () => {
    if (!st?.on || !st.ghost) return;
    const dy = st.y - st.y0 + (st.scroller.scrollTop - st.s0);
    const p = o.place(st.x - st.x0, dy);
    st.at = p.start;
    st.ghost.style.top = p.top;
    if (p.left) st.ghost.style.left = p.left;
    if (p.width) st.ghost.style.width = p.width;
    st.ghost.firstChild!.textContent = p.label;
    st.ghost.setAttribute('aria-label', `Moving to ${p.label}`);
  };
  // at the screen's top or bottom edge the page scrolls on slowly, so a drag can reach any hour of the day
  const edge = () => {
    if (!st?.on) return;
    const band = 64;
    const v = st.y < band ? -Math.ceil((band - st.y) / 6) : st.y > innerHeight - band ? Math.ceil((st.y - (innerHeight - band)) / 6) : 0;
    if (v) {
      st.scroller.scrollTop += v;
      paint();
    }
    st.raf = requestAnimationFrame(edge);
  };
  const begin = () => {
    if (!st || st.on) return;
    if (!o.can) {
      o.refuse();
      swallow = true;
      return finish(false);
    }
    st.on = true;
    try {
      el.setPointerCapture(st.id);
    } catch {
      /* the pointer went before the hold: nothing to capture */
    }
    el.classList.add('agdragging');
    o.grid.dataset.dragging = '1';
    st.ghost = h('span.agghost', { role: 'status', 'aria-live': 'assertive', style: `height:${o.height}` }, h('b', ''));
    o.grid.append(st.ghost);
    paint();
    st.raf = requestAnimationFrame(edge);
  };
  el.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || st || !ev.isPrimary) return;
    // (a release that never became a click leaves nothing to swallow: this press is new)
    swallow = false;
    const scroller = scrollerOf(el);
    st = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, kind: ev.pointerType, on: false, scroller, s0: scroller.scrollTop, timer: window.setTimeout(begin, HOLD_MS) };
  });
  el.addEventListener('pointermove', (ev) => {
    if (!st || ev.pointerId !== st.id) return;
    st.x = ev.clientX;
    st.y = ev.clientY;
    if (!st.on) {
      if (Math.hypot(st.x - st.x0, st.y - st.y0) > SLOP) {
        // a finger that moves before the hold is a scroll, never a drag; a mouse moving with its button down is a drag
        if (st.kind === 'mouse') begin();
        else finish(false);
      }
      return;
    }
    ev.preventDefault();
    paint();
  });
  el.addEventListener('pointerup', (ev) => st && ev.pointerId === st.id && finish(true));
  el.addEventListener('pointercancel', (ev) => st && ev.pointerId === st.id && finish(false));
  // while it drags the page stays where it is under the finger (touch-action stays auto, so a plain swipe still scrolls)
  el.addEventListener('touchmove', (ev) => st?.on && ev.cancelable && ev.preventDefault(), { passive: false });
  el.addEventListener('contextmenu', (ev) => st && ev.preventDefault());
  // the release after a drag (or a refused hold) is not also a tap that opens the event
  el.addEventListener('click', (ev) => {
    if (!swallow) return;
    swallow = false;
    ev.stopImmediatePropagation();
    ev.preventDefault();
  }, true);
  el.addEventListener('keydown', (ev) => ev.key === 'Escape' && finish(false));
}
