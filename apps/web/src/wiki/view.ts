/**
 * The Library → WIKIPEDIA, OFFLINE (BRIEF-REST-A 1; the panel is made in features/library/index.ts and filled here):
 *  - nothing here yet: the two files on offer (wiki/files.ts), each with what is in it, its size and month and GET; GET
 *    waits on mobile data (where the browser says so), shows "piece 3 of 7 · 24 MB of 53 MB" with STOP, and carries on
 *    from where it stopped; the licence, and why never the whole English Wikipedia;
 *  - a file here: OFFLINE, "Simple English Wikipedia, September 2026, 1.1 GB on your phone" (its own date) and DELETE
 *    (with the UNDO bar); a search box that answers as he types (titles from the file's own index, 44 pt rows) and
 *    RANDOM; an article in a sandboxed frame that runs no script (wiki/html.ts), its links opening the next article in
 *    place, its pictures from the file, BACK, READ IT TO ME (the phone's own voice: nothing leaves it) and CLOSE.
 * All of it works with no signal. The chat opens an article here with the `open_wiki` command (wiki/ask.ts's cards).
 */
import { register } from '../commands/registry';
import { clear, h } from '../core/dom';
import { button, toast, undo, type Panel } from '../ui/components';
import { speak, stopSpeaking } from '../assistant/voice';
import { keptLine, LICENCE, sizeWords, WHY_NOT_ALL, WIKI_FILES, type WikiFile } from './files';
import { articleText, rewriteArticle, type FrameLook } from './html';
import { archiveOf, bytesOf, chooseReading, deleteWiki, filesHere, getWiki, keptAll, offMobileData, onMobileData, progressLine, readingFile, readLog, type GetProgress } from './store';
import type { Archive, Hit } from './zim';

/** What the spec and the console can read (window.__ghostyWiki): the last search's and the last article's times, in ms. */
export const wikiTimes = { search: -1, open: -1, results: 0 };

let view: { open(path: string): void; find(words: string): void } | null = null;
let pending = '';
let pendingFind = '';

/** Opens the Library on WIKIPEDIA, OFFLINE: and an article, when the chat's card names one, or a search (a shortcut's). */
export function openWiki(path = '', find = ''): void {
  if (path) pending = path;
  else if (find) pendingFind = find;
  void import('../shell/launcher').then((l) => l.perform({ open: 'library', panel: 'WIKIPEDIA' }));
  if (view && pending) {
    const p = pending;
    pending = '';
    view.open(p);
  } else if (view && pendingFind) {
    const w = pendingFind;
    pendingFind = '';
    view.find(w);
  }
}
register({ id: 'open_wiki', title: 'Wikipedia, offline', hidden: true, run: (a) => openWiki(typeof a?.path === 'string' ? a.path : '') });

const cssVar = (name: string, fallback: string) => {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
};
const look = (): FrameLook => ({ fg: cssVar('--fg', '#f4f6f8'), bg: cssVar('--bg', '#050607'), link: cssVar('--c', '#64d2ff'), muted: cssVar('--l2', '#9aa4b1') });

export function mountWiki(p: Panel): void {
  (globalThis as { __ghostyWiki?: unknown }).__ghostyWiki = wikiTimes;
  const lead = h('p.note.wikilead', 'Wikipedia on this phone, for when there is no signal: searched and read here. My brain never reads it: it stays on the phone.');
  const have = h('div.wikihave', { hidden: true });
  const offers = h('div.wikioffers');
  const foot = h('div.wikifoot', h('p.note', LICENCE), h('p.note', WHY_NOT_ALL));
  p.body.append(lead, have, offers, foot);

  // ---- the file he reads, and its search
  const badge = h('span.wikibadge', { 'aria-label': 'Works with no signal' }, 'OFFLINE');
  const keptEl = h('span.wikikept');
  const del = button('DELETE', () => void remove(), 'warn');
  del.setAttribute('aria-label', 'Delete this Wikipedia file from the phone');
  const pick = h('div.row.wikipick', { hidden: true });
  const q = h('input.wikiq', { type: 'search', placeholder: 'Search Wikipedia on this phone…', enterKeyHint: 'search', autocomplete: 'off', autocapitalize: 'none', 'aria-label': 'Search Wikipedia on this phone' });
  q.setAttribute('spellcheck', 'false');
  const randomBtn = button('RANDOM', () => void random());
  randomBtn.setAttribute('aria-label', 'Open a random article');
  const results = h('div.wikires', { 'aria-label': 'Articles found' });
  // the article
  const frame = h('iframe.wikiframe', { title: 'Article', sandbox: 'allow-same-origin', referrerpolicy: 'no-referrer' }) as HTMLIFrameElement;
  const artTitle = h('b.wikiarttitle');
  const backBtn = button('BACK', () => back());
  const readBtn = button('READ IT TO ME', () => void readAloud(), 'on');
  const closeBtn = button('CLOSE', () => closeArticle());
  const art = h('section.wikiart', { hidden: true, 'aria-label': 'Article' }, h('div.row.wikibar', backBtn, readBtn, closeBtn), artTitle, frame, h('small.note.wikilic', 'From Wikipedia, on this phone · CC BY-SA 4.0'));
  have.append(h('div.wikihead', badge, keptEl, del), pick, h('div.keyrow.wikisearch', q, randomBtn), results, art);

  let reading: WikiFile | null = null;
  let archive: Archive | null = null;
  /** Hidden while the UNDO bar is up (its pieces go when the bar does). */
  const leaving = new Set<string>();
  let getting: { f: WikiFile; ctl: AbortController; line: string; frac: number } | null = null;
  let failed: { id: string; text: string } | null = null;

  // ---- the files: offered, on their way, or here
  const paint = async () => {
    const here = (await filesHere()).filter((f) => !leaving.has(f.id));
    reading = (await readingFile().then((f) => (f && !leaving.has(f.id) ? f : null))) ?? here[0] ?? null;
    have.hidden = !reading;
    if (reading) {
      const k = keptAll()[reading.id];
      keptEl.textContent = keptLine(reading, k?.bytes ?? bytesOf(reading), k?.date ?? '');
      q.placeholder = `Search ${reading.name}…`;
      p.setStatus(`${sizeWords(here.reduce((s, f) => s + (keptAll()[f.id]?.bytes ?? bytesOf(f)), 0))} here`);
    } else p.setStatus('Not on this phone');
    // two files here: which one the search reads
    pick.hidden = here.length < 2;
    clear(pick, ...here.map((f) => {
      const b = button(f.name.toUpperCase(), () => {
        chooseReading(f);
        archive = null;
        void paint().then(() => search());
      }, f.id === reading?.id ? 'on' : '');
      b.setAttribute('aria-pressed', String(f.id === reading?.id));
      return b;
    }));
    const was = readLog();
    clear(offers, ...WIKI_FILES.filter((f) => !here.some((x) => x.id === f.id)).map((f) => offerEl(f, was?.id === f.id ? `GET stopped at piece ${was.piece} of ${was.of} when Ghosty closed: GET carries on from there.` : '')));
  };

  const offerEl = (f: WikiFile, note: string): HTMLElement => {
    const size = sizeWords(bytesOf(f));
    const mine = getting?.f.id === f.id;
    const get = button(`Get · ${size}`, () => void fetchFile(f), 'on');
    get.dataset.case = 'keep';
    get.setAttribute('aria-label', `Get ${f.name}, ${size}, on Wi-Fi`);
    get.disabled = !!getting;
    const stop = button('STOP', () => getting?.ctl.abort());
    const status = mine ? h('div.wikiprog', { role: 'status' }, h('div.gauge', h('i', { style: { width: `${Math.round((getting!.frac || 0) * 100)}%` } })), h('small', getting!.line)) : null;
    return h(
      'div.wikioffer',
      { dataset: { file: f.id } },
      h('b', f.name),
      h('span', f.what),
      h('small', `${size} · ${f.month} · CC BY-SA · on Wi-Fi`),
      note ? h('small.note', note) : null,
      failed?.id === f.id ? h('small.wikierr', { role: 'alert' }, failed.text) : null,
      status,
      h('div.row', mine ? stop : get),
    );
  };

  const fetchFile = async (f: WikiFile) => {
    if (getting) return;
    failed = null;
    const ctl = new AbortController();
    getting = { f, ctl, line: '', frac: 0 };
    const show = (line: string, frac = getting?.frac ?? 0) => {
      if (!getting) return;
      getting.line = line;
      getting.frac = frac;
      void paint();
    };
    try {
      if (onMobileData()) {
        show(`You are on mobile data, and ${f.name} is ${sizeWords(bytesOf(f))}: it waits for Wi-Fi. Join Wi-Fi and it starts by itself.`);
        await offMobileData(ctl.signal);
        if (ctl.signal.aborted) throw Object.assign(new Error('stopped'), { name: 'AbortError' });
      }
      show(`On Wi-Fi: getting ${f.name} (${sizeWords(bytesOf(f))})…`);
      await getWiki(f, (x: GetProgress) => show(progressLine(x.piece, x.of, x.got, x.total), x.total ? x.got / x.total : 0), ctl.signal);
      chooseReading(f);
      archive = null;
      getting = null;
      await paint();
      toast(`${f.name} is on your phone: search it below, with or without a signal.`, 'ok');
      q.focus();
    } catch (e) {
      const stopped = (e as Error)?.name === 'AbortError';
      getting = null;
      failed = stopped ? { id: f.id, text: 'Stopped. What came so far stays: GET carries on from there.' } : { id: f.id, text: String((e as Error)?.message ?? e) };
      await paint();
    }
  };

  const remove = async () => {
    const f = reading;
    if (!f) return;
    closeArticle();
    leaving.add(f.id);
    archive = null;
    await paint();
    const size = sizeWords(keptAll()[f.id]?.bytes ?? bytesOf(f));
    undo(
      `${f.name} (${size}) deleted from this phone.`,
      () => {
        leaving.delete(f.id);
        void paint();
      },
      async () => {
        await deleteWiki(f);
        leaving.delete(f.id);
        await paint();
      },
    );
  };

  const opened = async (): Promise<Archive | null> => {
    if (!reading) return null;
    if (!archive) archive = await archiveOf(reading);
    return archive;
  };

  // ---- search, as he types
  let seq = 0;
  let timer = 0;
  const row = (x: Hit) => {
    const r = h('button.wikirow', { type: 'button', dataset: { path: x.path } }, x.title);
    r.addEventListener('click', () => void openArticle(x.path));
    return r;
  };
  const search = async () => {
    const my = ++seq;
    const text = q.value.trim();
    if (!text) return clear(results);
    try {
      const a = await opened();
      if (!a || my !== seq) return;
      const t0 = performance.now();
      const hits = await a.search(text, 20);
      if (my !== seq) return;
      wikiTimes.search = Math.round(performance.now() - t0);
      wikiTimes.results = hits.length;
      clear(results, ...(hits.length ? hits.map(row) : [h('p.note', `No title starts with “${text}” in ${reading?.name ?? 'this file'}.`)]));
    } catch (e) {
      clear(results, h('p.note.wikierr', String((e as Error)?.message ?? e)));
    }
  };
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void search(), 120);
  });
  q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    clearTimeout(timer);
    void search().then(() => results.querySelector<HTMLElement>('.wikirow')?.focus());
  });

  // ---- an article
  const history: string[] = [];
  let current: { path: string; title: string; html: string } | null = null;
  let urls: string[] = [];
  let pictures: { i: number; path: string }[] = [];
  const openArticle = async (path: string, push = true): Promise<void> => {
    const a = await opened().catch((e) => (toast(String((e as Error)?.message ?? e), 'warn'), null));
    if (!a) return;
    const t0 = performance.now();
    const got = await a.article(path).catch(() => null);
    if (!got) return toast('That page is not in this Wikipedia file.', 'warn');
    if (push && current && current.path !== got.path) history.push(current.path);
    current = { path: got.path, title: got.title, html: got.html };
    const r = rewriteArticle(got.html, got.path, look());
    pictures = r.images;
    for (const u of urls) URL.revokeObjectURL(u);
    urls = [];
    artTitle.textContent = got.title;
    frame.title = `Article: ${got.title}`;
    frame.srcdoc = r.doc;
    wikiTimes.open = Math.round(performance.now() - t0);
    art.hidden = false;
    backBtn.disabled = !history.length;
    art.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  /** The frame's height follows its page, so the screen scrolls once (not a box within a box). */
  const fit = () => {
    try {
      const d = frame.contentDocument;
      if (d?.documentElement) frame.style.height = `${Math.max(240, d.documentElement.scrollHeight + 4)}px`;
    } catch {
      /* not ours to measure */
    }
  };
  const fillPictures = async () => {
    const a = archive;
    const d = frame.contentDocument;
    if (!a || !d) return;
    for (const x of pictures) {
      const img = d.querySelector<HTMLImageElement>(`img[data-i="${x.i}"]`);
      if (!img) continue;
      const got = await a.bytes(x.path).catch(() => null);
      if (!got || frame.contentDocument !== d) return;
      const u = URL.createObjectURL(new Blob([got.data as BlobPart], { type: got.mime }));
      urls.push(u);
      img.src = u;
      await img.decode().catch(() => undefined);
      fit();
    }
  };
  // A tap on a link moves the frame to about:blank#zim=<path> (or #ext=<address>): the frame's own load says where.
  frame.addEventListener('load', () => {
    let href = '';
    try {
      href = frame.contentWindow?.location.href ?? '';
    } catch {
      href = '';
    }
    if (href.startsWith('about:blank#zim=')) return void openArticle(decodeURIComponent(href.slice('about:blank#zim='.length)));
    if (href.startsWith('about:blank#ext=')) {
      const u = decodeURIComponent(href.slice('about:blank#ext='.length));
      if (/^https?:\/\//i.test(u)) window.open(u, '_blank', 'noopener,noreferrer');
      if (current) void openArticle(current.path, false);
      return;
    }
    if (href === 'about:srcdoc') {
      fit();
      void fillPictures();
    }
  });
  const back = () => {
    const prev = history.pop();
    if (prev) void openArticle(prev, false);
    else closeArticle();
  };
  const closeArticle = () => {
    stopReading();
    art.hidden = true;
    current = null;
    history.length = 0;
    frame.removeAttribute('srcdoc');
    q.focus();
  };
  let speaking = false;
  const stopReading = () => {
    if (!speaking) return;
    speaking = false;
    stopSpeaking();
    readBtn.textContent = 'READ IT TO ME';
  };
  const readAloud = async () => {
    if (!current) return;
    if (speaking) return stopReading();
    speaking = true;
    readBtn.textContent = 'STOP READING';
    // the phone's own voice: the article never leaves the phone, with or without a signal
    await speak(articleText(current.html), { here: true }).catch(() => undefined);
    speaking = false;
    readBtn.textContent = 'READ IT TO ME';
  };
  const random = async () => {
    const a = await opened().catch(() => null);
    const hit = a ? await a.random().catch(() => null) : null;
    if (hit) void openArticle(hit.path);
  };

  const find = (words: string) => {
    q.value = words;
    void search();
  };
  view = { open: (path) => void paint().then(() => openArticle(path)), find: (w) => void paint().then(() => find(w)) };
  void paint().then(() => {
    if (pending) {
      const path = pending;
      pending = '';
      void openArticle(path);
    } else if (pendingFind) {
      const w = pendingFind;
      pendingFind = '';
      find(w);
    }
  });
}
