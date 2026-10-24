/**
 * SYSTEM → NIGHT SCHOOL: one switch, a time window on UK time, the plan in order with each part's stopping point, the
 * live progress line, last night's morning report, and in plain words what an iPhone needs (Ghosty open on screen and
 * the phone plugged in: nothing runs with the screen off). The work itself is apps/web/src/night (the phone) and the
 * brain's school/night.ts. It lives in SYSTEM, not in Learn: it runs the whole phone for the night (the screen kept on
 * and dimmed, the offline brain, the GYM and the library together), like the other things here that keep the phone and
 * the brain working; Learn's tabs each show their own part of it.
 */
import { NIGHT_LIMITS } from '../../../../../packages/shared/src/night';
import { clear, h } from '../../core/dom';
import { night, setNight } from '../../night';
import { button, panel, row, toast, type Light, type Panel } from '../../ui/components';

const hours = (ms: number) => `${Math.round(ms / 3600_000)} hour${ms === 3600_000 ? '' : 's'}`;

const LIGHT: Record<ReturnType<typeof night.get>['state'], [string, Light]> = {
  off: ['OFF', 'off'],
  waiting: ['ON', 'ok'],
  running: ['RUNNING', 'ok'],
  paused: ['PAUSED', 'mid'],
  done: ['DONE FOR TONIGHT', 'ok'],
};

export function nightPanel(): Panel {
  const p = panel('NIGHT SCHOOL', { grow: false, cls: 'nightsch' });
  const sw = button('NIGHT SCHOOL: OFF', async (b) => {
    b.disabled = true;
    try {
      const on = !night.get().settings.on;
      await setNight({ on });
      toast(on ? `Night School is on: ${night.get().settings.from} to ${night.get().settings.to}, UK time` : 'Night School is off', 'ok');
    } catch (e) {
      toast(String((e as Error)?.message ?? e).slice(0, 200), 'warn');
    } finally {
      b.disabled = false;
    }
  });
  sw.classList.add('nightsw');
  sw.setAttribute('role', 'switch');
  const time = (which: 'from' | 'to') => {
    const i = h('input.nighttime', { type: 'time', step: '60', 'aria-label': which === 'from' ? 'Night School starts at' : 'Night School ends at' }) as HTMLInputElement;
    i.addEventListener('change', () => {
      if (!/^\d{2}:\d{2}$/.test(i.value)) return;
      void setNight({ [which]: i.value }).catch((e) => toast(String((e as Error)?.message ?? e).slice(0, 200), 'warn'));
    });
    return i;
  };
  const from = time('from');
  const to = time('to');
  const live = h('div.nightline', { role: 'status', 'aria-live': 'polite' });
  const plan = h(
    'ol.steps.nightplan',
    h('li', { dataset: { part: 'school' } }, h('b', 'School practice'), ` — his weak spots at his stage, each question checked twice; what he gets wrong goes first into the weekly training. Stops after ${NIGHT_LIMITS.practice} questions.`),
    h('li', { dataset: { part: 'gym' } }, h('b', 'Gym'), ` — TRAIN ALL, the least mastered game first. Stops after ${hours(NIGHT_LIMITS.gymMs)}, or with ${hours(NIGHT_LIMITS.studyMs).replace('1 hour', 'an hour')} of the night left.`),
    h('li', { dataset: { part: 'study' } }, h('b', 'Study'), ' — STUDY ALL, the library’s queue. Until the end of the night.'),
  );
  const honest = h('div.note.small.nightios');
  const extra = h('div.nightextra');
  p.body.append(
    h('div.note', 'He works through the night on this phone while it charges: school practice first, then the gym, then the library.'),
    h('div.keyrow', sw),
    h('div.nightwin', h('label', 'FROM ', from), h('label', 'TO ', to), h('small', 'UK time')),
    live,
    plan,
    honest,
    extra,
  );

  const paint = () => {
    const s = night.get();
    const [text, light] = LIGHT[s.state];
    p.setStatus(text, light);
    sw.textContent = `NIGHT SCHOOL: ${s.settings.on ? 'ON' : 'OFF'}`;
    sw.dataset.label = `Night School: ${s.settings.on ? 'on' : 'off'}`;
    sw.setAttribute('aria-checked', String(s.settings.on));
    sw.classList.toggle('on', s.settings.on);
    if (document.activeElement !== from) from.value = s.settings.from;
    if (document.activeElement !== to) to.value = s.settings.to;
    live.textContent = s.line;
    for (const li of plan.querySelectorAll<HTMLElement>('li')) {
      const part = li.dataset.part as 'school' | 'gym' | 'study';
      li.classList.toggle('now', s.state === 'running' && s.run?.part === part);
      li.classList.toggle('ended', !!s.run?.ended[part] && s.state !== 'off' && s.state !== 'waiting');
    }
    clear(
      honest,
      'On an iPhone: leave Ghosty open on the screen and the phone plugged in. The screen stays on, dimmed (tap it to see Ghosty). Closing Ghosty or locking the phone pauses the plan — nothing runs with the screen off — and it carries on when Ghosty is back on screen. ',
      'Without the phone, the brain does its own part in the same hours: writing and checking practice questions with the free online AIs, and the library’s study.',
    );
    clear(extra);
    if (!s.lock.can) extra.append(h('div.note.small.bad', 'This browser cannot keep the screen on by itself: for the night, set Auto-Lock to Never (Settings → Display & Brightness), or the phone will lock and the plan will pause.'));
    if (s.settings.on && s.charging === null) extra.append(h('div.note.small', 'This phone does not tell Ghosty whether it is charging: plug it in before you leave it.'));
    if (s.charging === false && s.settings.on) extra.append(h('div.note.small.bad', 'Not charging: plug the phone in (the plan waits for it).'));
    if (s.offline) extra.append(h('div.note.small.bad', 'The brain is not reachable right now: the switch and the window could not be read from it.'));
    if (s.report) {
      const r = row('LAST NIGHT', s.report.text.replace(/^Last night: /, ''), null, { wrap: true });
      r.classList.add('nightreport');
      extra.append(r);
    }
  };
  night.subscribe(paint);
  paint();
  return p;
}
