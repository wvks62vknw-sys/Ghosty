/**
 * LINKS → NOTIFICATIONS: which kinds of notification the owner wants. The choices are kept by the
 * brain (apps/edge/src/notifyprefs.ts): a kind switched off gets no phone notification, no Telegram
 * message and no alert in the app (assistant/notices.ts skips items it marks quiet); the Agenda
 * inbox keeps every item either way.
 */
import { brain } from '../../api/brain';
import { needsHomeScreen, pushState } from '../../assistant/push';
import { clear, h } from '../../core/dom';
import { button, row, toast, type Panel } from '../../ui/components';

export const HOME_SCREEN_ONLY = 'iPhone only allows notifications for apps on your Home Screen: Share → Add to Home Screen, then open Ghosty from there.';

/** Paints overlap (opening the tab and each change of the phone's notification state start one): only the newest draws. */
let painting = 0;

export async function paintNotifications(p: Panel): Promise<void> {
  const mine = ++painting;
  let got: Awaited<ReturnType<typeof brain.pushPrefs>> | null = null;
  let failed: unknown = null;
  try {
    got = await brain.pushPrefs();
  } catch (e) {
    failed = e;
  }
  if (mine !== painting) return; // a newer paint is on its way
  const st = pushState.get();
  const homeOnly = needsHomeScreen() || st.status === 'needs-install';
  clear(p.body);
  if (homeOnly) p.body.append(h('div.note.bad.homeonly', HOME_SCREEN_ONLY));
  else if (st.status !== 'on') p.body.append(h('div.note', 'Notifications are off on this device: turn them on in PHONE above. These switches say which kinds Ghosty sends.'));
  if (!got) {
    p.setStatus('', 'off');
    p.body.append(h('div.note', (failed as { status?: number }).status === 404 ? 'The brain cannot keep these choices yet: it needs an update first.' : 'These choices are kept by the brain, which is not reachable right now.'));
    return;
  }
  const prefs = { ...got.prefs };
  const on = got.kinds.filter((k) => prefs[k.id]).length;
  p.setStatus(`${on} OF ${got.kinds.length} ON`, on ? 'ok' : 'mid');
  for (const k of got.kinds) {
    const b = button(prefs[k.id] ? 'ON' : 'OFF', async () => {
      const want = !prefs[k.id];
      b.disabled = true;
      try {
        const r = await brain.setPushPrefs({ [k.id]: want });
        Object.assign(prefs, r.prefs);
        b.textContent = prefs[k.id] ? 'ON' : 'OFF';
        b.classList.toggle('on', !!prefs[k.id]);
        b.setAttribute('aria-pressed', String(!!prefs[k.id]));
        const n = got.kinds.filter((x) => prefs[x.id]).length;
        p.setStatus(`${n} OF ${got.kinds.length} ON`, n ? 'ok' : 'mid');
      } catch (e) {
        toast(`Not changed: ${String((e as Error).message)}`, 'warn');
      } finally {
        b.disabled = false;
      }
    }, prefs[k.id] ? 'on' : '');
    b.setAttribute('aria-pressed', String(!!prefs[k.id]));
    b.setAttribute('aria-label', `${k.label} notifications`);
    b.dataset.kind = k.id;
    const r = row(k.label, k.hint, null, { wrap: true });
    r.append(b);
    p.body.append(r);
  }
  p.body.append(
    h('div.note.notifyscope', 'OFF stops that kind everywhere: no phone notification, no Telegram message, no alert or voice in the app. It still goes in your Agenda inbox. Always sent: what you ask for ("ping my phone…"), finished tasks and projects, and anything that went wrong.'),
    h('div.keyrow', button('SEND A TEST', async () => {
      const r = await brain.pushTest().catch(() => ({ sent: 0 }));
      toast(r.sent ? `Sent to ${r.sent} device(s)` : homeOnly ? HOME_SCREEN_ONLY : 'No device has notifications on yet', r.sent ? 'ok' : 'warn');
    })),
  );
}
