/**
 * SETTINGS → SHORTCUTS (BRIEF-REST-A 2): Siri Shortcuts for Ghosty, made of the links the app understands
 * (deeplinks.ts). "Ghosty listen" first, on its own (Siri straight into a conversation, with the truth about the background),
 * then a gallery of twelve ready ones (a name to say, what it does, its link, COPY), the plain steps once for
 * the Shortcuts app, and MAKE YOUR OWN: a screen picked or words typed, the link made, COPY. Nothing is installed by us:
 * iOS lets no web page add a shortcut. `followLink` (called by main.ts once Ghosty is up) does what a link asks, on the
 * owner's own signed-in phone only.
 */
import { h } from '../../core/dom';
import { tabs } from '../../shell/tabs';
import { button, panel, toast, type Panel } from '../../ui/components';
import { brain, headers } from '../../api/brain';
import { LISTEN, NO_BACKGROUND, NOT_INSTALLED, parseLink, READY, shortcutUrl, SIRI, STEPS, type DoCmd, type LinkAsk } from './deeplinks';

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

/** GET: the link copied, then the Shortcuts app opened on a new shortcut (iPhone lets no page add one itself: the plain steps are said under it). */
async function get(url: string, b: HTMLButtonElement): Promise<void> {
  await copy(url, b);
  b.textContent = 'GET';
  try {
    location.href = 'shortcuts://create-shortcut';
  } catch {
    /* no Shortcuts app here (a desk's browser): the link is copied, the steps are above */
  }
}

const urlEl = (url: string) => h('code.scurl', { tabIndex: 0, 'aria-label': `Link: ${url}` }, url);

export function shortcutsPanel(): Panel {
  const p = panel('SHORTCUTS', { grow: false, status: 'Siri' });
  // [talk] "Ghosty listen": the one that matters most for talking, first and on its own, with what iPhone allows (BRIEF-TALK-1A 6)
  const listenUrl = shortcutUrl(origin(), LISTEN.ask);
  const listenCopy = button('COPY', (btn) => void copy(listenUrl, btn), 'on');
  listenCopy.setAttribute('aria-label', `Copy the link for ${LISTEN.name}`);
  const listen = h('div.sclisten', { dataset: { name: LISTEN.name } }, h('b', `“${LISTEN.name}”`), h('span', LISTEN.does), urlEl(listenUrl), h('div.row', listenCopy), h('p.note', NO_BACKGROUND));
  // [lifeeasier] "Hey Siri, ask Ghosty …" and the share sheet's "Send to Ghosty": each with its GET and its one-line how-to
  const siri = (k: 'ask' | 'add') => {
    const r = SIRI[k];
    const url = shortcutUrl(origin(), r.ask);
    const b = button('GET', (btn) => void get(url, btn), 'on');
    b.setAttribute('aria-label', `Get the shortcut ${r.name}: copy its link and open Shortcuts`);
    return h('div.sclisten.sirirow', { dataset: { name: r.name, siri: k } }, h('b', `“${r.name}”`), h('span', r.does), urlEl(url), h('p.note', r.how), h('div.row', b));
  };
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
    listen,
    siri('ask'),
    siri('add'),
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
    case 'ask': {
      // [lifeeasier] Siri's words are his turn, sent at once
      L.openChat();
      const { send } = await import('../../assistant/session');
      void send(link.text);
      return;
    }
    case 'add':
      return void fileShared(link.text, link.url);
    case 'do':
      return doCommand(link.what, L);
  }
}

/**
 * [lifeeasier] What the share sheet's Shortcut sent: a link is read into the library by the brain as any imported page; where it
 * cannot be read (offline, a page that refuses) the link itself is kept, so nothing shared is lost. Words are filed as a note.
 */
async function fileShared(text: string, isUrl: boolean): Promise<void> {
  const note = async (title: string, body: string): Promise<boolean> => {
    const r = await fetch('/api/library/text', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ title, text: body, kind: 'note', source: 'Share sheet' }), credentials: 'same-origin' }).catch(() => null);
    return !!r?.ok;
  };
  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return u.slice(0, 40);
    }
  };
  if (isUrl) {
    try {
      const r = await brain.libraryImport(text);
      toast(`On your Shelf: ${r.doc?.title ?? host(text)}.`, 'ok');
      return;
    } catch {
      /* the page could not be read: the link itself is kept below */
    }
    if (await note(`Link from ${host(text)}`, text)) toast(`I couldn’t read that page, so I kept the link on your Shelf (${host(text)}).`, 'ok');
    else toast('I couldn’t file that just now: the brain isn’t answering. Share it again when you’re back online.', 'warn');
    return;
  }
  const first = text.split('\n')[0]!.trim().slice(0, 60) || 'Shared note';
  if (await note(first, text)) toast(`On your Shelf: ${first}.`, 'ok');
  else toast('I couldn’t file that just now: the brain isn’t answering. Share it again when you’re back online.', 'warn');
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
      return void import('../../morse/sheet').then((m) => m.openMorse(d.text ? { mode: 'text', text: d.text } : { mode: 'text' }));
    case 'wiki':
      return void import('../../wiki/view').then((w) => w.openWiki('', d.title ?? ''));
    case 'listen': {
      // [talk] Siri's "Ghosty listen" (BRIEF-TALK-1A 6): Home, and a conversation listening the moment Ghosty shows (the boot
      // cinematic over), as if the mic had been tapped
      L.perform({ open: 'core' });
      await shown();
      (await import('../core/index')).listenNow();
      return;
    }
  }
}

/** Resolves once Ghosty is on the screen: the boot cinematic has gone (or after 15 s whatever it is doing). */
function shown(): Promise<void> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const look = () => (!document.getElementById('boot') || Date.now() - t0 > 15_000 ? resolve() : void setTimeout(look, 40));
    look();
  });
}
