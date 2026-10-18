/**
 * Keeping Ghosty's data on the phone. Safari deletes a site's storage (IndexedDB, localStorage,
 * caches) after 7 days without use — unless the site is a Home Screen app whose storage is
 * "persisted". Once the owner has paired (main.ts, and the PROTECT button) this asks for that with
 * navigator.storage.persist(), and the SYSTEM tab says in plain words whether it worked.
 */
import { createStore } from '../../core/store';

export const storageState = createStore({
  /** null: not known yet. */
  persisted: null as boolean | null,
  supported: true,
  /** Bytes used by Ghosty on this phone (estimate()), -1 when the browser won't say. */
  usage: -1,
});

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Opened from the Home Screen (not a Safari tab). */
export const homeScreenApp = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/**
 * Can Ghosty ask to keep its data without a pop-up? Safari and Chrome answer by themselves; Firefox
 * shows a permission prompt (each time, until the owner decides), so there it waits for PROTECT —
 * unless Ghosty is an installed app.
 */
export const persistAsksQuietly = () => homeScreenApp() || !/firefox|fxios/i.test(navigator.userAgent);

/** Look (and, when `ask`, ask the browser to keep the data — only if it is not kept already). Never throws. */
export async function checkStorage(ask: boolean): Promise<void> {
  const s = navigator.storage;
  if (!s?.persisted) return storageState.set({ supported: false, persisted: false });
  try {
    let on = await s.persisted();
    if (!on && ask && s.persist) on = await s.persist();
    const est = s.estimate ? await s.estimate().catch(() => null) : null;
    storageState.set({ supported: true, persisted: on, usage: typeof est?.usage === 'number' ? est.usage : -1 });
  } catch {
    storageState.set({ supported: false, persisted: false });
  }
}

export const mbText = (n: number) => (n < 0 ? '' : `${n < 10 * 1024 * 1024 ? (n / 1024 / 1024).toFixed(1).replace(/\.0$/, '') : Math.round(n / 1024 / 1024)} MB used`);

/** The one line the SYSTEM tab shows. */
export function storageLine(): { text: string; ok: boolean } {
  const st = storageState.get();
  if (st.persisted) return { text: `STORAGE: PROTECTED${st.usage >= 0 ? ` · ${mbText(st.usage)}` : ''}`, ok: true };
  // No way to ask (an older iPhone): a Home Screen app is still spared Safari's 7-day clear-out.
  if (!st.supported) return { text: isIos() && !homeScreenApp() ? 'STORAGE: NOT PROTECTED — add Ghosty to your Home Screen (Share → Add to Home Screen) so iPhone keeps your data' : "STORAGE: NOT PROTECTED — this browser cannot be asked to keep Ghosty's data.", ok: false };
  // Already a Home Screen app: Safari grants it on the next ask.
  const how = homeScreenApp() ? `press PROTECT so ${isIos() ? 'iPhone' : 'this device'} keeps your data` : 'add Ghosty to your Home Screen (Share → Add to Home Screen) so iPhone keeps your data';
  return { text: `STORAGE: NOT PROTECTED — ${how}`, ok: false };
}
