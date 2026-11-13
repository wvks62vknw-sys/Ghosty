/**
 * SETTINGS → PERMISSIONS (BRIEF-RELIABILITY 3): one row per thing the phone can be asked for, so he can see what Ghosty has and what
 * it does with it. Each row: its state as the browser tells it (the Permissions API where Safari answers; where it does not, the
 * phone's own record of the last grant or refusal, said as "last time: allowed", never guessed), what Ghosty uses it for in one
 * sentence, what Ghosty never does with it (his rules, in his words), and how to change it (the iPhone Settings path as words: no
 * link, because none can work). A permission refused mid-task anywhere lands here with one line (ui/hisWords.ts, the funnel).
 * Nothing on this page asks for a permission; it only looks.
 */
import { clear, h } from '../../core/dom';
import { lastPerm, lastRefusal, notePerm, type PermRow } from '../../ui/permrecord';
import { panel, type Panel } from '../../ui/components';
import { checkStorage, homeScreenApp, storageState } from '../system/storage';

interface Spec {
  id: string;
  name: string;
  /** The Permissions API's name for it, where there is one. */
  api?: string;
  row?: PermRow;
  uses: string;
  never: string;
  how: string;
}

const SETTINGS = 'Settings, Ghosty, then switch it on. If Ghosty is not in that list, Settings, Apps, Safari, then the address Ghosty is on.';

export const PERMS: Spec[] = [
  { id: 'camera', name: 'Camera', api: 'camera', row: 'camera', uses: 'The Lens: reading, scanning, translating and naming what you point it at.', never: 'I never name a stranger from their face. Faces and voices I know are only yours and the people you introduce, and they stay on this phone.', how: `${SETTINGS} Choose Camera.` },
  { id: 'microphone', name: 'Microphone', api: 'microphone', row: 'microphone', uses: 'Talking to me, dictation and the sound modes of the Lens.', never: 'I never listen in the background, and your voice is never a lock on its own: it can say who is talking, never let anyone in.', how: `${SETTINGS} Choose Microphone.` },
  { id: 'location', name: 'Location', api: 'geolocation', row: 'location', uses: 'Where you are on the map, the nearest things, and a walk home that you start.', never: 'Your live position never reaches my brain: it gets the name of a saved place, never coordinates.', how: `${SETTINGS} Choose Location.` },
  { id: 'notifications', name: 'Notifications', api: 'notifications', row: 'notifications', uses: 'Telling you when a reminder, a warning near your places or a watcher goes off.', never: 'I never send adverts, and I never do anything that could cost you money.', how: `${SETTINGS} Choose Notifications. They only work once Ghosty is on your Home Screen.` },
  { id: 'motion', name: 'Motion', row: 'motion', uses: 'Tilt to look around, and the level in the measuring tools.', never: 'It stays on the phone. I never record how you move.', how: `${SETTINGS} Choose Motion and Orientation. Safari asks once, the first time I use tilt.` },
  { id: 'clipboard', name: 'Clipboard', api: 'clipboard-read', row: 'clipboard', uses: 'Pasting into my box when you press paste, and copying a reply when you press copy.', never: 'I never read what you copied without your tap.', how: 'Safari asks each time I paste. There is no setting to change.' },
  { id: 'storage', name: 'Kept storage', uses: 'Stopping Safari clearing what lives only on this phone (courses, cards, plans) after seven days unused.', never: 'I only use the room for your own things, and your daily backup can bring them back if it is cleared anyway.', how: 'Add Ghosty to your Home Screen (Share, then Add to Home Screen), open it from there, then press PROTECT in System.' },
  { id: 'homescreen', name: 'Home Screen app', uses: 'Opening full screen, and Safari sparing what Ghosty keeps.', never: 'Adding it changes nothing about what I can see.', how: 'Share, then Add to Home Screen. To remove it, press and hold its icon and choose Remove App.' },
  { id: 'wifi', name: 'Downloads on Wi-Fi', uses: 'Big files (a brain on the phone, maps, models) come only when you tap, with their size said first.', never: 'I never download by myself, and never on mobile data.', how: 'This is always on. There is nothing to switch.' },
];

/** The browser's own answer for one thing, or null where Safari does not give one. */
async function asked(api: string): Promise<'granted' | 'denied' | 'prompt' | null> {
  try {
    const r = await navigator.permissions?.query({ name: api as PermissionName });
    return r ? r.state : null;
  } catch {
    return null;
  }
}

const ago = (t: number): string => {
  const m = Math.max(1, Math.round((Date.now() - t) / 60_000));
  return m < 2 ? 'a moment ago' : m < 90 ? `${m} minutes ago` : m < 36 * 60 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`;
};

/** One row's state, in words: what the browser says now, else the phone's record ("last time: allowed"), else that it was not asked. */
export async function stateOf(s: Spec): Promise<string> {
  if (s.id === 'storage') {
    await checkStorage(false).catch(() => undefined);
    const st = storageState.get();
    return st.persisted ? 'Kept: Safari will not clear it' : st.supported ? 'Not kept yet: Safari may clear it after seven days' : 'This browser cannot be asked to keep it';
  }
  if (s.id === 'homescreen') return homeScreenApp() ? 'You opened me from the Home Screen' : 'You opened me in Safari';
  if (s.id === 'wifi') {
    const c = (navigator as unknown as { connection?: { type?: string } }).connection;
    return c?.type ? `Now: ${c.type === 'wifi' ? 'on Wi-Fi' : c.type === 'cellular' ? 'on mobile data' : c.type}` : 'Safari cannot tell me which you are on, so I ask you before any download';
  }
  const api = s.api ? await asked(s.api) : null;
  const last = s.row ? lastPerm(s.row) : undefined;
  if (api) return api === 'granted' ? 'Allowed now' : api === 'denied' ? 'Not allowed now' : `I will ask you when I need it${last ? ` (last time: ${last.state})` : ''}`;
  if (last) return `Last time: ${last.state}`;
  return 'Not asked yet';
}

export function permissionsPanel(): Panel & { refresh(): void } {
  const p = panel('PERMISSIONS', { grow: false, status: `${PERMS.length} THINGS`, cls: 'permpn' });
  const refused = h('p.g-truth.permrefused', { role: 'status', dataset: { case: 'keep' } });
  refused.hidden = true;
  const box = h('div.permlist');
  p.body.append(h('p.note', { dataset: { case: 'keep' } }, 'Everything the phone can be asked for, what I use it for, and what I never do with it. Nothing here asks for anything: it only looks.'), refused, box);
  async function refresh(): Promise<void> {
    const r = lastRefusal();
    const recent = r && Date.now() - r.at < 7 * 86_400_000;
    refused.hidden = !recent;
    if (recent) refused.textContent = `The phone refused ${ago(r.at)}${r.doing ? ` when I tried to ${r.doing}` : ''}. It is the ${PERMS.find((x) => x.row === r.row)?.name ?? r.row} row below, with how to change it.`;
    const states = await Promise.all(PERMS.map((s) => stateOf(s)));
    clear(box);
    PERMS.forEach((s, i) => {
      const hit = recent && r.row === s.row;
      box.append(h('div.permrow', { dataset: { perm: s.id, case: 'keep', ...(hit ? { refused: 'true' } : {}) } },
        h('div.permhead', h('b.permname', s.name), h('span.g-truth.permstate', { dataset: { case: 'keep' } }, states[i]!)),
        h('p.permuse', { dataset: { case: 'keep' } }, h('span.g-truth', 'I USE IT FOR'), ' ', s.uses),
        h('p.permnever', { dataset: { case: 'keep' } }, h('span.g-truth', 'I NEVER'), ' ', s.never),
        h('p.permhow', { dataset: { case: 'keep' } }, h('span.g-truth', 'TO CHANGE IT'), ' ', s.how)));
    });
  }
  void refresh();
  // looked at again each time the page is opened (the row for a refusal that happened meanwhile)
  p.el.addEventListener('ghosty:reveal', () => void refresh());
  p.el.querySelector('h3')?.addEventListener('click', () => void refresh());
  return Object.assign(p, { refresh: () => void refresh() });
}

// ---------------------------------------------------------------- the record: every grant and refusal, wherever it happens

let recording = false;
const refusedName = (e: unknown) => /^(NotAllowedError|SecurityError|PermissionDeniedError)$/.test(String((e as { name?: unknown })?.name ?? ''));

/**
 * Note each grant and refusal the browser gives the app, once, where the app asks for the camera, the microphone, the position, the
 * notifications, motion or the clipboard: so a row can say "last time: allowed" where Safari does not answer the Permissions API.
 */
export function installPermissionRecord(): void {
  if (recording || typeof navigator === 'undefined') return;
  recording = true;
  try {
    const md = navigator.mediaDevices;
    if (md?.getUserMedia) {
      const orig = md.getUserMedia.bind(md);
      md.getUserMedia = async (c?: MediaStreamConstraints) => {
        const rows: PermRow[] = [...(c?.video ? ['camera' as const] : []), ...(c?.audio ? ['microphone' as const] : [])];
        try {
          const s = await orig(c);
          for (const r of rows) notePerm(r, 'allowed');
          return s;
        } catch (e) {
          if (refusedName(e)) for (const r of rows) notePerm(r, 'refused', r === 'camera' ? 'open the camera' : 'listen');
          throw e;
        }
      };
    }
    const geo = navigator.geolocation;
    if (geo) {
      const wrap = (fn: Geolocation['getCurrentPosition']) =>
        function (this: Geolocation, ok: PositionCallback, bad?: PositionErrorCallback | null, o?: PositionOptions) {
          return fn.call(this, (p) => (notePerm('location', 'allowed'), ok(p)), (er) => ((er?.code === 1 && notePerm('location', 'refused', 'find where you are')), bad?.(er)), o);
        };
      geo.getCurrentPosition = wrap(geo.getCurrentPosition.bind(geo)) as Geolocation['getCurrentPosition'];
      const watch = geo.watchPosition.bind(geo);
      geo.watchPosition = ((ok: PositionCallback, bad?: PositionErrorCallback | null, o?: PositionOptions) => watch((p) => (notePerm('location', 'allowed'), ok(p)), (er) => ((er?.code === 1 && notePerm('location', 'refused', 'find where you are')), bad?.(er)), o)) as Geolocation['watchPosition'];
    }
    const N = (globalThis as { Notification?: typeof Notification }).Notification;
    if (N?.requestPermission) {
      const orig = N.requestPermission.bind(N);
      N.requestPermission = ((cb?: NotificationPermissionCallback) => orig(cb as never).then((r) => (r === 'granted' ? notePerm('notifications', 'allowed') : r === 'denied' && notePerm('notifications', 'refused', 'send you a notification'), r))) as typeof N.requestPermission;
    }
    const M = (globalThis as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    if (M?.requestPermission) {
      const orig = M.requestPermission.bind(M);
      M.requestPermission = () => orig().then((r) => (notePerm('motion', r === 'granted' ? 'allowed' : 'refused', 'follow the tilt'), r));
    }
    const cb = navigator.clipboard;
    if (cb?.readText) {
      const orig = cb.readText.bind(cb);
      cb.readText = () => orig().then((t) => (notePerm('clipboard', 'allowed'), t), (e) => { if (refusedName(e)) notePerm('clipboard', 'refused', 'paste'); throw e; });
    }
  } catch {
    /* a browser that will not be wrapped: the rows say "not asked yet" or the browser's own answer */
  }
}
