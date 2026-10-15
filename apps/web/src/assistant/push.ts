/**
 * Installable app + push notifications. Registers the service worker (public/sw.js) and
 * subscribes this device to Web Push, so reminders and task results arrive even when
 * Ghosty is closed. On iPhone this only works after "Add to Home Screen".
 */
import { brain } from '../api/brain';
import { createStore } from '../core/store';

export const pushState = createStore({
  supported: false,
  /** 'on' = this device receives notifications */
  status: 'unknown' as 'unknown' | 'on' | 'off' | 'blocked' | 'needs-install' | 'unsupported',
  installed: false,
});

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android' : /mac/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : /linux/i.test(ua) ? 'Linux' : 'Device';
  const br = /edg\//i.test(ua) ? 'Edge' : /firefox/i.test(ua) ? 'Firefox' : /crios|chrome/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : '';
  return `${os}${br ? ` · ${br}` : ''}${standalone() ? ' (app)' : ''}`;
}

let reg: ServiceWorkerRegistration | null = null;

export async function initApp(): Promise<void> {
  pushState.set({ installed: standalone() });
  if (!('serviceWorker' in navigator)) {
    pushState.set({ status: 'unsupported' });
    return;
  }
  try {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    pushState.set({ status: 'unsupported' });
    return;
  }
  const supported = 'PushManager' in window && 'Notification' in window;
  pushState.set({ supported });
  if (!supported) {
    pushState.set({ status: isIos() && !standalone() ? 'needs-install' : 'unsupported' });
    return;
  }
  if (Notification.permission === 'denied') return pushState.set({ status: 'blocked' });
  const sub = await reg.pushManager.getSubscription().catch(() => null);
  pushState.set({ status: sub && Notification.permission === 'granted' ? 'on' : 'off' });
  // Re-send an existing subscription (the brain may have dropped it, or this is a new brain).
  if (sub && Notification.permission === 'granted') void brain.pushSubscribe(sub.toJSON(), deviceLabel()).catch(() => undefined);
}

/** Ask permission and subscribe this device. Must be called from a tap. */
export async function enablePush(): Promise<string> {
  const st = pushState.get().status;
  if (st === 'needs-install') return 'On iPhone: tap Share → "Add to Home Screen", open Ghosty from the new icon, then turn notifications on there.';
  if (st === 'unsupported' || !reg) return 'This browser cannot receive notifications.';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    pushState.set({ status: perm === 'denied' ? 'blocked' : 'off' });
    return perm === 'denied' ? 'Notifications are blocked for this site. Allow them in the browser\'s site settings, then try again.' : 'Notifications were not allowed.';
  }
  try {
    const { key } = await brain.pushKey();
    let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options.applicationServerKey) {
      const cur = new Uint8Array(sub.options.applicationServerKey);
      const want = b64uToBytes(key);
      if (cur.length !== want.length || cur.some((x, i) => x !== want[i])) {
        await sub.unsubscribe();
        sub = null;
      }
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key) });
    await brain.pushSubscribe(sub.toJSON(), deviceLabel());
    pushState.set({ status: 'on' });
    return 'Notifications are on for this device.';
  } catch (e) {
    return `Could not turn on notifications: ${String((e as Error)?.message ?? e)}`;
  }
}

export async function disablePush(): Promise<void> {
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (sub) {
    await brain.pushUnsubscribe(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  pushState.set({ status: 'off' });
}

function b64uToBytes(s: string): Uint8Array<ArrayBuffer> {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '==='.slice((t.length + 3) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** "Install" prompt on Android/desktop Chrome (iPhone uses the Share menu instead). */
let deferred: (Event & { prompt: () => Promise<void> }) | null = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as Event & { prompt: () => Promise<void> };
});
export const canPromptInstall = () => !!deferred;
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  deferred = null;
  return true;
}
export const installHelp = () =>
  isIos()
    ? 'iPhone/iPad: open Ghosty in Safari, tap the Share button, then "Add to Home Screen".'
    : /android/i.test(navigator.userAgent)
      ? 'Android: in Chrome tap ⋮ (top right) → "Install app" or "Add to Home screen".'
      : 'Computer: in Chrome or Edge, click the install icon at the right of the address bar.';
