/**
 * SETTINGS → SHORTCUTS (BRIEF-REST-A 2): Siri Shortcuts for Ghosty, made of the links the app understands
 * (deeplinks.ts). A gallery of twelve ready ones (a name to say, what it does, its link, COPY), the plain steps once for
 * the Shortcuts app, and MAKE YOUR OWN: a screen picked or words typed, the link made, COPY. Nothing is installed by us:
 * iOS lets no web page add a shortcut. `followLink` (called by main.ts once Ghosty is up) does what a link asks, on the
 * owner's own signed-in phone only.
 */
import { h } from '../../core/dom';
import { tabs } from '../../shell/tabs';
import { button, panel, toast, type Panel } from '../../ui/components';
import { NOT_INSTALLED, parseLink, READY, shortcutUrl, STEPS, type DoCmd, type LinkAsk } from './deeplinks';

const origin = () => (typeof location !== 'undefined' ? location.origin : '');

/** COPY: to the clipboard (or selected, where the browser will not), and said. */
async function copy(text: string, b: HTMLButtonElement): Promise<void> {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    const t = h('textarea', { value: text, readOnly: true, style: { position: 'fixed', opacity: '0' } });
    document.body.append(t);
    t.select();
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    t.remove();
  }
  b.textContent = ok ? 'COPIED' : 'COPY';
  b.dataset.copied = ok ? '1' : '';
  toast(ok ? 'Copied: paste it into Open URLs in the Shortcuts app.' : 'This browser would not copy: press and hold the link to copy it.', ok ? 'ok' : 'warn');
  if (ok) setTimeout(() => (b.textContent = 'COPY'), 2000);
}

const urlEl = (url: string) => h('code.scurl', { tabIndex: 0, 'aria-label': `Link: ${url}` }, url);

export function shortcutsPanel(): Panel {
  const p = panel('SHORTCUTS', { grow: false, status: 'Siri' });
  const gallery = h('div.scgal', ...READY.map((r) => {
    const url = shortcutUrl(origin(), r.ask);
    const b = button('COPY', (btn) => void copy(url, btn), 'on');
    b.setAttribute('aria-label', `Copy the link for ${r.name}`);
    return h('div.scrow', { dataset: { name: r.name } }, h('b', `“${r.name}”`), h('span', r.does), urlEl(url), h('div.row', b));
  }));

  // MAKE YOUR OWN: a screen (and its first panels are its own business), or words to say
  const screens = tabs().filter((t) => !t.hub);
  const pick = h('select.scpick', { 'aria-label': 'A screen to open' }, h('option', { value: '' }, 'Words to say…'), ...screens.map((t) => h('option', { value: t.id }, t.title.charAt(0) + t.title.slice(1).toLowerCase())));
  const words = h('input.scwords', { type: 'text', placeholder: 'What’s the weather tomorrow?', 'aria-label': 'Words to say to Ghosty' });
  const made = urlEl('');
  const copyMine = button('COPY', (btn) => void copy(made.textContent ?? '', btn), 'on');
  copyMine.setAttribute('aria-label', 'Copy your link');
  const mine = (): LinkAsk | null => (pick.value ? { open: pick.value } : words.value.trim() ? { say: words.value.trim() } : null);
  const paint = () => {
    const a = mine();
    words.hidden = !!pick.value;
    made.textContent = a ? shortcutUrl(origin(), a) : '';
    copyMine.disabled = !a;
  };
  pick.addEventListener('change', paint);
  words.addEventListener('input', paint);
  paint();

  p.body.append(
    h('p.note', 'Say “Hey Siri, Ghosty timer” and it happens: each shortcut is a link that the Shortcuts app opens.'),
    h('p.note.scsteps', STEPS),
    h('p.note', NOT_INSTALLED),
    h('p.note', 'A shortcut opens Ghosty in Safari: sign in there once (Passwords fills your key). Words that would start something, like a reminder, wait in the chat box for your send.'),
    gallery,
    h('div.scown', h('b', 'MAKE YOUR OWN'), h('div.row', pick, words), made, h('div.row', copyMine)),
  );
  return p;
}

// ---------------------------------------------------------------- following a link

/** What a link asks (main.ts, once Ghosty is up): only when `owner` (his own signed-in phone); the address is cleaned after. */
export async function followLink(owner: boolean): Promise<void> {
  const link = parseLink(location.search, { owner, tabs: tabs().map((t) => t.id) });
  if (!link) return;
  try {
    history.replaceState(null, '', `${location.pathname}${location.hash}`);
  } catch {
    /* no address here */
  }
  const L = await import('../../shell/launcher');
  switch (link.kind) {
    case 'signin':
      // a stranger's link: the sign-in is on the screen (main.ts), and nothing is run
      return;
    case 'unknown':
      toast(`That link asks for something Ghosty does not know (“${link.text}”).`, 'warn');
      return;
    case 'open':
      L.perform({ open: link.tab, ...(link.panel ? { panel: link.panel } : {}) });
      return;
    case 'say':
      if (link.send) {
        L.openChat();
        const { send } = await import('../../assistant/session');
        void send(link.text);
      } else (await import('../core/cards')).askInBox(link.text);
      return;
    case 'do':
      return doCommand(link.what, L);
  }
}

async function doCommand(d: DoCmd, L: typeof import('../../shell/launcher')): Promise<void> {
  const say = async (words: string) => {
    L.openChat();
    const { send } = await import('../../assistant/session');
    void send(words);
  };
  switch (d.cmd) {
    case 'timer':
      return L.perform({ run: 'kitchen_timer', args: { timers: [{ secs: d.secs, name: 'timer' }] } });
    case 'open':
      return L.perform({ open: d.tab });
    case 'lens':
      return L.perform({ run: 'open_lens', args: { mode: d.mode } });
    case 'arcade':
      return L.perform({ open: 'arcade' });
    case 'sit':
      return L.perform({ open: 'school', panel: 'THIS STAGE' });
    case 'walkhome':
      return say('walk me home');
    case 'remind':
      return say(`remind me ${d.text}`);
    case 'morse':
      return say(d.text ? `${d.text} in morse` : 'morse');
    case 'wiki':
      return void import('../../wiki/view').then((w) => w.openWiki('', d.title ?? ''));
  }
}
