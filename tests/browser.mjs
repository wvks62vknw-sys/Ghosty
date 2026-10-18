// Which browser engine a spec runs in. Unset: Chromium, launched exactly as each spec always launched it
// (its own flags, CHROMIUM path). BROWSER=webkit: WebKit, Safari's engine — what the owner's iPhone really runs.
// Chromium-only flags (swiftshader, fake camera/mic, autoplay) mean nothing to WebKit and are dropped there.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/wk/browsers BROWSER=webkit BASE=… node tests/<name>.spec.mjs
// Specs that stay on Chromium (they do not import this): aim, lens, measure, name, scan, sound, vehicle — they
// need Chromium's fake camera or microphone (--use-fake-device-for-media-stream), which WebKit has no stand-in for.
// tests/scroll.spec.mjs and tests/safari.spec.mjs always run WebKit.
import { chromium, webkit } from 'playwright';

export const engine = process.env.BROWSER === 'webkit' ? 'webkit' : 'chromium';
export const isWebKit = engine === 'webkit';

/** WebKit reports things as page errors that are not: a fetch the page itself caught ("… due to access control
 *  checks", e.g. a data mirror that is down; an uncaught one still shows as an unhandled rejection), the
 *  ResizeObserver loop notice, and — in a sandboxed widget frame, once service workers are blocked below — a
 *  notice that they are off there. Chromium reports none of these, so this is always false there. */
export const webkitNoise = (e) => isWebKit && /ResizeObserver loop completed|due to access control checks|Service Worker is disabled because the context is sandboxed/.test(e.message);

export async function launch(options = {}) {
  if (!isWebKit) return chromium.launch(options);
  const { args: _args, executablePath: _path, channel: _channel, ...rest } = options;
  const browser = await webkit.launch(rest);
  // In WebKit, page.route() never sees a request made by a page that Ghosty's service worker controls (even the
  // /api calls the worker leaves alone), so the specs' faked feeds and brain answers would silently go to the real
  // server. Contexts start without the service worker unless a spec asks for it ({ serviceWorkers: 'allow' }).
  const newContext = browser.newContext.bind(browser);
  const newPage = browser.newPage.bind(browser);
  browser.newContext = (o = {}) => newContext({ serviceWorkers: 'block', ...o });
  browser.newPage = (o = {}) => newPage({ serviceWorkers: 'block', ...o });
  return browser;
}
