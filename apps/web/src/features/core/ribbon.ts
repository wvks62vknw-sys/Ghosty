/**
 * THE READOUT RIBBON (BRIEF-OCT-IDEAS-1 1): one mono line on Home, five parts, each a `span.g-truth` with the system's dot at its end
 * (a wrapped line ends on the dot and a part is never cut): the time, the weather now and the next rain hour, the next thing, the
 * threat word, and what I am doing now. Every part is read from what the phone already holds (the Brief's own cached weather, Core's
 * next event, the guardian's last answer, the live dots' source): it asks for nothing, so it costs the first screen nothing, and it is
 * drawn after the hero hand-over, never on the first frame. It repaints once a minute and when a source changes. THE SCAN draws it
 * under the stamp line, ONE INK in the serif under the masthead; GLASS has none. One `aria-live="off"` line: it is not read out.
 */
import { fmt, h } from '../../core/dom';
import { WMO, temp, weather } from '../../data/weather';
import { liveIn } from '../../shell/areas';
import { chat, send } from '../../assistant/session';
import { settings, ui } from '../../state/app';
import { doingWords } from './ribbonwords';
import { guardian } from '../../state/guardian';

/** What the checks read (window.__ghosty.ribbon). */
export const ribbonState = { shown: false, parts: [] as string[], text: '', paints: 0 };

/** The hour of the next rain in the cached forecast: 'now' when it is raining this hour, 'HH:00' for the next one, '' for none in a day. */
export function nextRain(w: { hourly: { precipitation_probability: number[] } } | null, hr = new Date().getHours()): string {
  const p = w?.hourly.precipitation_probability;
  if (!p) return '';
  for (let i = hr; i < Math.min(p.length, hr + 24); i++) if ((p[i] ?? 0) >= 50) return i === hr ? 'rain now' : `rain ${String(i % 24).padStart(2, '0')}:00`;
  return 'no rain';
}

/** The threats feature's own word for NEAR HOME: nothing active is CALM, a warning of any level WATCH, the most severe level WARNING. */
export function threatWord(info = guardian.get().info): string {
  if (!info) return '—';
  const active = info.places.flatMap((p) => p.active);
  return active.some((a) => a.level === 1) ? 'Warning' : active.length ? 'Watch' : 'Calm';
}

/** His words when the last turn did not land and RETRY can send them again, else ''. */
export function retryText(): string {
  const last = chat.get().entries[chat.get().entries.length - 1];
  return !ui.get().busy && last?.kind === 'error' && !last.cool ? last.retry ?? '' : '';
}

/** How long "Done." stays after a turn that went well, ms. */
const DONE_MS = 20_000;
let doneAt = 0;
/** What I am doing right now, as one sentence (ribbonwords.ts), from the live dots' own source (shell/areas.ts liveIn) and the turn's own state. */
export function doingNow(): string {
  const l = liveIn();
  const u = ui.get();
  const last = chat.get().entries[chat.get().entries.length - 1];
  const failed = !u.busy && last?.kind === 'error' && !last.cool;
  const live = l.learn ? (/training/.test(l.learn) ? 'training' : 'sitting') : l.make ? 'report' : l.me ? 'download' : '';
  return doingWords({
    online: navigator.onLine !== false,
    brain: u.connected,
    busy: u.busy || !!l.ask,
    status: u.status,
    cool: u.busy && u.coolUntil > Date.now() ? fmt.time(new Date(u.coolUntil)) : '',
    failed,
    retry: failed && last?.kind === 'error' && !!last.retry,
    done: !u.busy && !failed && Date.now() - doneAt < DONE_MS,
    live,
  });
}

/** The five parts, as words. `next`: Core's next event ("Dentist · 9:30 AM"), '' when there is none, null before the agenda has answered. */
export function ribbonParts(next: string | null, d = new Date()): string[] {
  const w = weather.data;
  const sky = w ? `${temp(w.current.temperature_2m)} ${WMO(w.current.weather_code).toLowerCase()}, ${nextRain(w, d.getHours())}` : '—';
  /* state: core.ribbon loading */
  const thing = next === null ? '—' : next ? `Next ${next.replace(/ · /, ' ')}` : /* state: core.ribbon empty */ 'Nothing next';
  return [fmt.time(d), sky, thing, `Threat ${threatWord().toLowerCase()}`, doingNow()];
}

export interface Ribbon {
  el: HTMLElement;
  /** Mount it where it goes (after the hand-over), then keep it true. */
  mount(into: HTMLElement, before: Node | null): void;
  paint(): void;
}

/** One ribbon line. `look`: which Home draws it (styles.css sets it as the Scan's mono or ONE INK's serif). */
export function ribbon(look: 'scan' | 'ink', next: () => string | null): Ribbon {
  const el = h(`div.ribbon.${look}ribbon` as 'div', { 'aria-live': 'off', 'aria-label': 'Now', dataset: { case: 'keep', look } });
  let sig = '';
  const paint = () => {
    if (!el.isConnected) return;
    const parts = ribbonParts(next());
    ribbonState.parts = parts;
    const s = parts.join('|') + (retryText() ? '|retry' : '');
    if (s === sig) return;
    sig = s;
    ribbonState.text = parts.join(' · ');
    ribbonState.paints++;
    // (the last part, when RETRY can send his words again: that part is the button, 44 pt tall)
    const again = retryText();
    el.replaceChildren(
      ...parts.flatMap((p, i) => {
        const last = i === parts.length - 1;
        const span = h('span.g-truth', { dataset: { case: 'keep' } }, p, !last ? h('span.g-sep', { 'aria-hidden': 'true' }, ' ·') : null);
        if (last && again) {
          span.classList.add('ribretry');
          span.setAttribute('role', 'button');
          span.tabIndex = 0;
          const go = () => void send(again, { speak: settings.get().speak });
          span.addEventListener('click', go);
          span.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && go());
        }
        return [span, ' '];
      }),
    );
  };
  // a source changed: the weather came, the guardian answered, a turn began or ended, something started or stopped
  weather.onChange(paint);
  guardian.subscribe(paint);
  // (a turn ends well: "Done." for a moment, and the ribbon repaints when it goes)
  ui.subscribe((s, p) => {
    if (p.busy && !s.busy) {
      doneAt = Date.now();
      setTimeout(paint, DONE_MS + 100);
    }
    if (s.busy !== p.busy || s.voice !== p.voice || s.connected !== p.connected || s.status !== p.status || s.coolUntil !== p.coolUntil) paint();
  });
  chat.subscribe(paint);
  addEventListener('online', paint);
  addEventListener('offline', paint);
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? ((w.__ghosty.ribbon ??= ribbonState), (w.__ghosty.chat ??= chat)) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  return {
    el,
    mount(into, before) {
      if (el.parentElement !== into) into.insertBefore(el, before);
      ribbonState.shown = true;
      sig = '';
      paint();
    },
    paint,
  };
}
