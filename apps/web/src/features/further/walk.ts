/**
 * WALK ME THROUGH IT (BRIEF-OCT-IDEAS-3 item 5; STARS 166): he drives the screen step by step. A soft pointer rings the one key (or
 * panel, or card, or the ask line) to press next, one sentence of why in his voice (said aloud too when his voice is on), and NEXT,
 * BACK and DONE. The steps are the screen's own YOU CAN lines and a room's things (further/walk.ts): no copy kept twice. Reduced
 * motion stills the pointer's pulse. Nothing is pressed for him: the pointer shows, his finger presses.
 */
import { speak, stopSpeaking } from '../../assistant/voice';
import { h } from '../../core/dom';
import { navTo } from '../../shell/areas';
import { tabs } from '../../shell/tabs';
import { settings, ui } from '../../state/app';
import { button } from '../../ui/components';
import { revealSection } from '../../ui/sections';
import { screenFor, walkFor, type Walk, type WalkTarget } from '../../further/walk';

/** What a test can read (window.__ghosty.walk). */
export const walkState = { on: false, screen: '', name: '', i: 0, of: 0, target: '', says: '' };

let overlay: HTMLElement | null = null;
let stop: (() => void) | null = null;

const label = (t: WalkTarget): string => (t.kind === 'panel' ? `panel:${t.panel}` : t.kind === 'card' ? `card:${t.id}` : t.kind === 'ask' ? 'ask' : `screen:${t.screen}`);

/** The element to ring for a step, once its screen is there (null: ring the screen's top instead). */
function elementFor(t: WalkTarget, screen: string): HTMLElement | null {
  const root = document.getElementById(`pg-${screen}`) ?? document;
  if (t.kind === 'panel') {
    const pn = revealSection(t.screen, t.panel);
    return pn?.querySelector<HTMLElement>('.ptitle, h3') ?? pn ?? null;
  }
  if (t.kind === 'card') return root.querySelector<HTMLElement>(`.hubtile[data-id="${t.id}"]`);
  if (t.kind === 'ask') return [...document.querySelectorAll<HTMLElement>('.houseask .housefield, .scanask, #cin, .housemic')].find((e) => e.getClientRects().length && e.getBoundingClientRect().width > 0) ?? null;
  return root.querySelector<HTMLElement>('.hero .bigv, .tag, h1, .pn .ptitle') ?? null;
}

export function endWalk(): void {
  stop?.();
  stop = null;
  overlay?.remove();
  overlay = null;
  stopSpeaking();
  walkState.on = false;
}

/** Walk the screen `what` names ("the library", "learn", "here"). Returns what was said about it (for the chat's reply). */
export async function startWalk(what: string): Promise<{ ok: boolean; name: string; said: string }> {
  const ids = tabs().map((t) => t.id);
  const id = what === 'here' ? ui.get().tab : screenFor(what, ids);
  const found: Walk | null = id ? walkFor(id) : null;
  if (!id || !found) return { ok: false, name: what, said: '' };
  const w: Walk = found;
  endWalk();
  const w0 = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w0.__ghosty) w0.__ghosty.walk = walkState;
  if (ui.get().tab !== id) navTo(id, 'push');
  // the screen is built and drawn before the pointer lands
  for (let n = 0; n < 40 && !document.getElementById(`pg-${id}`)?.classList.contains('on'); n++) await new Promise((r) => setTimeout(r, 75));
  await new Promise((r) => setTimeout(r, 350));

  let i = 0;
  const ptr = h('i.fxptr', { 'aria-hidden': 'true' });
  const says = h('p.fxwalksays', { 'aria-live': 'polite' });
  const count = h('small.fxwalkn', { dataset: { case: 'keep' } });
  const back = button('BACK', () => step(i - 1));
  back.dataset.act = 'back';
  back.dataset.case = 'keep';
  const next = button('NEXT', () => (i >= w.steps.length - 1 ? endWalk() : step(i + 1)), 'on');
  next.dataset.act = 'next';
  next.dataset.case = 'keep';
  const done = button('DONE', () => endWalk());
  done.dataset.act = 'done';
  done.dataset.case = 'keep';
  const card = h('div.fxwalkcard', { role: 'dialog', 'aria-label': `Walk me through ${w.name}` }, count, says, h('div.row.wrap.fxwalkacts', back, next, done));
  overlay = h('div#fxwalk', ptr, card);
  document.getElementById('app')?.append(overlay) ?? document.body.append(overlay);

  let lastEl: HTMLElement | null = null;
  const place = () => {
    const r = lastEl?.getBoundingClientRect();
    if (!r || !r.width) return void ptr.classList.add('top');
    ptr.classList.remove('top');
    const size = 56;
    ptr.style.left = `${Math.round(r.left + r.width / 2 - size / 2)}px`;
    ptr.style.top = `${Math.round(r.top + r.height / 2 - size / 2)}px`;
  };
  function step(n: number): void {
    i = Math.max(0, Math.min(w.steps.length - 1, n));
    const s = w.steps[i]!;
    // a step in another screen (a YOU CAN line that opens it) takes him there first
    const at = s.target.kind === 'panel' ? s.target.screen : id!;
    if (at !== ui.get().tab && !at.startsWith('area-')) navTo(at, 'push');
    lastEl = elementFor(s.target, at);
    lastEl?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    says.textContent = s.says;
    count.textContent = `${w.name.toUpperCase()} · STEP ${i + 1} OF ${w.steps.length}`;
    next.textContent = i >= w.steps.length - 1 ? 'DONE' : 'NEXT';
    back.hidden = i === 0;
    done.hidden = i >= w.steps.length - 1;
    Object.assign(walkState, { on: true, screen: id, name: w.name, i, of: w.steps.length, target: label(s.target), says: s.says });
    setTimeout(place, 60);
    if (settings.get().speak) void speak(s.says, { here: true }).catch(() => undefined);
  }
  const onMove = () => requestAnimationFrame(place);
  addEventListener('resize', onMove);
  document.addEventListener('scroll', onMove, true);
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && endWalk();
  addEventListener('keydown', onKey);
  const off = ui.subscribe((s, p) => {
    // leaving the screen on his own ends the walk (a step's own move is the walk's to make)
    if (s.tab !== p.tab && walkState.on && s.tab !== id && !w.steps.some((x) => x.target.kind === 'panel' && x.target.screen === s.tab)) endWalk();
  });
  stop = () => {
    removeEventListener('resize', onMove);
    document.removeEventListener('scroll', onMove, true);
    removeEventListener('keydown', onKey);
    off?.();
  };
  step(0);
  return { ok: true, name: w.name, said: w.steps[0]!.says };
}
