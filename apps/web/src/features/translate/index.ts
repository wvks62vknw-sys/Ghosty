/**
 * TRANSLATE (THE APPS ROUND, the voice lane's flagship; leaders: Google Translate, DeepL, Apple Translate). One screen, three views:
 *   - TRANSLATE: a box that finds the language itself and answers as he types; the translation with LISTEN, COPY, a star, letters in
 *     another script, a register (as it is, formal, casual) and other ways to say it; SPEAK fills the box from his voice;
 *     CONVERSATION (the Interpreter) and CAMERA (the Lens on TRANSLATE) one tap away.
 *   - PHRASEBOOK: what he starred, sorted by trip; a trip's ready phrasebook in the country's language, each line translated on a tap.
 *   - HISTORY: every translation he made, kept on this phone, searchable; clearing it can be undone.
 * His own words only: nothing of anyone else is kept (the Interpreter keeps nothing). Translated by the brain when there is a signal,
 * the offline brain on the phone (rough) when there is none: further/interpret.ts. Downloads: none here (the offline brain's own
 * download is in Settings, on his tap, on Wi-Fi, with its size said).
 */
import { sayError } from '../../ui/hisWords';
import { speakIn, stopSpeaking, voiceIn } from '../../assistant/voice';
import { clear, h, icon } from '../../core/dom';
import { screenSays } from '../../shell/awareness';
import { navTo } from '../../shell/areas';
import type { TabDef } from '../../shell/tabs';
import { button, toast, undo } from '../../ui/components';
import { page } from '../../ui/page';
import { headers } from '../../api/brain';
import { canHear, hear, translate, type Ear } from '../../further/interpret';
import { LANGUAGES, langName } from '../../../../../packages/shared/src/scan';
import {
  BOOK_KEY,
  COUNTRIES,
  HISTORY_KEY,
  NO_TRIP,
  SCRIPT_NAME,
  TRIP_KEY,
  TRIP_PHRASES,
  byTrip,
  isStarred,
  readList,
  scriptOf,
  scriptsFor,
  searchDone,
  toggleStar,
  transliterate,
  withDone,
  type Done,
  type Starred,
} from '../../../../../packages/shared/src/translatekit';

type View = 'translate' | 'book' | 'history';
type Style = '' | 'formal' | 'casual';
const PAIR = 'ghosty.translate.pair';

const load = <T>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const keep = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage refused: kept for this visit */
  }
};

/** What a test can read (window.__ghosty.translate). */
export const trState = {
  view: 'translate' as View,
  from: '' as string,
  to: 'es' as string,
  style: '' as Style,
  /** The last answer: what it came to, the language found, the other ways, and how ('brain' | 'offline' | 'same'). */
  out: null as null | { said: string; came: string; from: string; alts: string[]; how: string },
  state: 'empty' as 'empty' | 'typing' | 'loading' | 'done' | 'failed',
  history: [] as Done[],
  book: [] as Starred[],
  trip: '',
  spoken: [] as { text: string; lang: string }[],
};

const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';
const SOUND = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>';
const STAR = '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>';
export const TRANSLATE_ICON = '<path d="M3.5 5.5h9M8 3.5v2M5.5 5.5c.6 3 2.6 5.2 5.5 6.3M10.5 5.5c-.7 3-3 5.4-6.5 6.6"/><rect x="11.5" y="11.5" width="9" height="9" rx="2"/><path d="M14 18.5l2-5 2 5M14.6 17h2.8"/>';

/** The brain's translation with a register and alternatives; with no signal, the plain one (the phone's own, rough). */
async function translateRich(text: string, to: string, from: string, style: Style): Promise<{ came: string; from: string; alts: string[]; how: string }> {
  try {
    const r = await fetch('/api/translate', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), credentials: 'same-origin', body: JSON.stringify({ text, to, ...(from ? { from } : {}), style, alts: true }) });
    const j = (await r.json().catch(() => ({}))) as { text?: string; from?: string; alts?: string[]; engine?: string; error?: string };
    if (r.ok && typeof j.text === 'string') return { came: j.text, from: j.from ?? from, alts: Array.isArray(j.alts) ? j.alts : [], how: j.engine === 'none' ? 'same' : 'brain' };
  } catch {
    /* no signal: the plain translation below says what it can */
  }
  const t = await translate(text, to, from);
  return { came: t.text, from, alts: [], how: t.how };
}

export const translateTab: TabDef = {
  id: 'translate',
  title: 'TRANSLATE',
  icon: TRANSLATE_ICON,
  scene: 'backdrop',
  blurb: 'finds the language · a phrasebook by trip',
  now: () => `into ${langName(trState.to)}`,
  mount(root) {
    const P = page(root, { tag: 'SEE // TRANSLATE', sub: 'Type, paste or speak. I find the language and answer as you type.', stack: true });
    root.classList.add('fxpg', 'tlxpg');
    P.big.dataset.case = 'keep';
    P.big.textContent = '';
    P.right.hidden = true;
    (P.big.parentElement?.querySelector('.swap') as HTMLElement | null)?.setAttribute('hidden', '');
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.translate = trState;

    const pair = load<{ from?: string; to?: string }>(PAIR, {});
    trState.from = typeof pair.from === 'string' && (pair.from === '' || LANGUAGES.some((l) => l.code === pair.from)) ? pair.from : '';
    trState.to = LANGUAGES.some((l) => l.code === pair.to) ? pair.to! : 'es';
    trState.history = readList<Done>(localStorage.getItem(HISTORY_KEY));
    trState.book = readList<Starred>(localStorage.getItem(BOOK_KEY));
    trState.trip = load<string>(TRIP_KEY, '');

    // ---- the three views, one tap apart
    const views: Record<View, HTMLElement> = { translate: h('div.tlxview'), book: h('div.tlxview'), history: h('div.tlxview') };
    const seg = h('div.tlxseg', { role: 'tablist', 'aria-label': 'Translate, phrasebook or history' });
    const segKeys = (['translate', 'book', 'history'] as View[]).map((v) => {
      const b = button(v === 'translate' ? 'TRANSLATE' : v === 'book' ? 'PHRASEBOOK' : 'HISTORY', () => show(v));
      b.dataset.case = 'keep';
      b.dataset.view = v;
      b.setAttribute('role', 'tab');
      seg.append(b);
      return b;
    });
    const show = (v: View) => {
      trState.view = v;
      for (const b of segKeys) b.setAttribute('aria-selected', String(b.dataset.view === v));
      for (const [k, el] of Object.entries(views)) el.hidden = k !== v;
      if (v === 'book') drawBook();
      if (v === 'history') drawHistory();
    };

    // ---- TRANSLATE: the languages, the box, the answer
    const opts = (sel: string, detect: boolean) => [
      ...(detect ? [h('option', { value: '', ...(sel === '' ? { selected: true } : {}) }, 'Find it for me')] : []),
      ...LANGUAGES.map((l) => h('option', { value: l.code, ...(l.code === sel ? { selected: true } : {}) }, l.name)),
    ];
    const selFrom = h('select#tlxfrom', { 'aria-label': 'Translate from' }, ...opts(trState.from, true)) as HTMLSelectElement;
    const selTo = h('select#tlxto', { 'aria-label': 'Translate into' }, ...opts(trState.to, false)) as HTMLSelectElement;
    const savePair = () => keep(PAIR, { from: trState.from, to: trState.to });
    selFrom.addEventListener('change', () => {
      trState.from = selFrom.value;
      savePair();
      soon(0);
    });
    selTo.addEventListener('change', () => {
      trState.to = selTo.value;
      savePair();
      soon(0);
    });
    const swap = button('SWAP', () => {
      const found = trState.out?.from || trState.from;
      if (!found) return toast('Type something first, so I know which language to swap from.', 'warn');
      const came = trState.out?.came ?? '';
      trState.from = trState.to;
      trState.to = found;
      selFrom.value = trState.from;
      selTo.value = trState.to;
      savePair();
      if (came) box.value = came;
      soon(0);
    });
    swap.dataset.case = 'keep';
    swap.setAttribute('aria-label', 'Swap the two languages');
    const pairRow = h('div.fxpair', h('label', h('span', 'FROM'), selFrom), swap, h('label', h('span', 'INTO'), selTo));

    const box = h('textarea#tlxin.fxfield', { placeholder: 'Type or paste here', 'aria-label': 'Text to translate', rows: 3, autocomplete: 'off', spellcheck: true }) as HTMLTextAreaElement;
    const speak = h('button.fxkb.tlxmic', { type: 'button', 'aria-label': 'Speak instead of typing', 'aria-pressed': 'false', dataset: { case: 'keep' } }, icon(MIC));
    const wipe = button('CLEAR', () => {
      box.value = '';
      soon(0);
      box.focus();
    });
    wipe.dataset.case = 'keep';
    const boxRow = h('div.tlxboxrow', box, h('div.tlxboxkeys', speak, wipe));

    const status = h('p.tlxstate', { role: 'status', 'aria-live': 'polite' });
    const outText = h('p#tlxout.tlxout', { lang: trState.to });
    const found = h('p.tlxfound');
    const listen = h('button.fxkb', { type: 'button', 'aria-label': 'Listen', dataset: { case: 'keep', act: 'listen' } }, icon(SOUND));
    const star = h('button.fxkb.tlxstar', { type: 'button', 'aria-label': 'Star into the phrasebook', 'aria-pressed': 'false', dataset: { case: 'keep', act: 'star' } }, icon(STAR));
    const copy = button('COPY', () => {
      const t = trState.out?.came;
      if (!t) return;
      void navigator.clipboard?.writeText(t).then(() => toast('Copied.', 'ok'), () => toast('This browser would not copy. Hold the words to copy them.', 'warn'));
    });
    copy.dataset.case = 'keep';
    const letters = button('LETTERS', () => toggleLetters());
    letters.dataset.case = 'keep';
    letters.dataset.act = 'letters';
    const lettersOut = h('p.tlxletters', { hidden: true });
    const outKeys = h('div.tlxoutkeys', listen, star, copy, letters);
    const styleSeg = h('div.tlxseg.tlxstyle', { role: 'radiogroup', 'aria-label': 'How it sounds' });
    const styleKeys = (['', 'formal', 'casual'] as Style[]).map((s) => {
      const b = button(s === '' ? 'AS IT IS' : s.toUpperCase(), () => {
        trState.style = s;
        for (const k of styleKeys) k.setAttribute('aria-checked', String(k.dataset.style === s));
        soon(0);
      });
      b.dataset.case = 'keep';
      b.dataset.style = s;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(s === trState.style));
      styleSeg.append(b);
      return b;
    });
    const altsHead = h('b.fxhead', 'OTHER WAYS TO SAY IT');
    const alts = h('div.tlxalts', { role: 'list' });
    const altsBox = h('div.tlxaltbox', { hidden: true }, altsHead, alts);
    const card = h('div.tlxcard', { hidden: true }, found, outText, lettersOut, outKeys, styleSeg, altsBox);
    const skeleton = h('div.tlxskel', { hidden: true, 'aria-hidden': 'true' }, h('i'), h('i'));
    const modes = h(
      'div.tlxmodes',
      Object.assign(button('CONVERSATION', () => navTo(`interpreter?to=${trState.to}`, 'push')), { title: 'Two halves of the screen, both of you talking' }),
      Object.assign(button('CAMERA', () => void import('../lens').then((m) => m.openLens('translate', undefined, true))), { title: 'Point it at a sign or a menu' }),
    );
    for (const b of modes.querySelectorAll('button')) (b as HTMLElement).dataset.case = 'keep';
    const note = h('p.fxnote', 'Your words go to my brain to translate when there is a signal, and nothing of them is kept there. With no signal, the brain on this phone translates, roughly. Your history and phrasebook stay on this phone.');
    views.translate.append(pairRow, boxRow, status, skeleton, card, modes, note);

    let visit = 0;
    let asked = 0;
    let timer = 0;
    const say = (t: string) => (status.textContent = t);
    const paintEmpty = () => {
      trState.state = 'empty';
      trState.out = null;
      card.hidden = true;
      skeleton.hidden = true;
      say('Type or paste above, or tap the microphone and speak. The answer comes as you type.');
    };
    /** Translate after he pauses (`ms`); a newer word cancels an older answer still on its way. */
    const soon = (ms = 650) => {
      clearTimeout(timer);
      const text = box.value.trim();
      if (!text) return paintEmpty();
      trState.state = 'typing';
      timer = window.setTimeout(() => void run(text), ms);
    };
    const run = async (text: string) => {
      const me = ++asked;
      const v = visit;
      trState.state = 'loading';
      skeleton.hidden = !card.hidden ? true : false;
      say(`Translating into ${langName(trState.to)}…`);
      try {
        const r = await translateRich(text, trState.to, trState.from, trState.style);
        if (me !== asked || v !== visit) return;
        trState.out = { said: text, came: r.came, from: r.from, alts: r.alts, how: r.how };
        trState.state = 'done';
        trState.history = withDone(trState.history, { id: `t${Date.now().toString(36)}`, said: text, came: r.came, from: r.from, to: trState.to, at: Date.now(), style: trState.style });
        keep(HISTORY_KEY, trState.history);
        paintOut();
      } catch (e) {
        if (me !== asked || v !== visit) return;
        trState.state = 'failed';
        skeleton.hidden = true;
        say(sayError(e, 'translate that'));
      }
    };
    const paintOut = () => {
      const o = trState.out;
      if (!o) return paintEmpty();
      skeleton.hidden = true;
      card.hidden = false;
      outText.textContent = o.came;
      outText.lang = trState.to;
      const fromName = o.from ? langName(o.from) : '';
      found.textContent = o.how === 'same' ? `Already in ${langName(trState.to)}.` : `${fromName ? `From ${fromName}${trState.from ? '' : ' (found it)'}` : 'Language found by my brain'} · into ${langName(trState.to)}`;
      say(o.how === 'offline' ? 'No signal: translated on this phone, roughly. Check anything important when you have a signal.' : '');
      const starred = isStarred(trState.book, { said: o.said, to: trState.to });
      star.setAttribute('aria-pressed', String(starred));
      star.setAttribute('aria-label', starred ? 'Starred: tap to take it out of the phrasebook' : 'Star into the phrasebook');
      const sc = scriptsFor(scriptOf(o.came));
      letters.hidden = sc.length === 0;
      if (sc.length) letters.textContent = `IN ${SCRIPT_NAME[sc[0]!].toUpperCase()}`;
      lettersOut.hidden = true;
      clear(alts);
      altsBox.hidden = o.alts.length === 0;
      for (const a of o.alts) {
        const b = button(a, () => {
          if (!trState.out) return;
          const was = trState.out.came;
          trState.out = { ...trState.out, came: a, alts: [was, ...trState.out.alts.filter((x) => x !== a)] };
          paintOut();
        });
        b.classList.add('tlxalt');
        b.dataset.case = 'keep';
        b.setAttribute('role', 'listitem');
        b.lang = trState.to;
        alts.append(b);
      }
    };
    const toggleLetters = () => {
      const o = trState.out;
      if (!o) return;
      const sc = scriptsFor(scriptOf(o.came))[0];
      if (!sc) return;
      lettersOut.textContent = transliterate(o.came, sc);
      lettersOut.hidden = !lettersOut.hidden;
    };
    const sayAloud = (text: string, lang: string) => {
      stopSpeaking();
      trState.spoken.push({ text, lang });
      if (!voiceIn(lang) || !speakIn(text, lang)) toast(`This phone has no ${langName(lang)} voice, so I can’t say it aloud. iPhone Settings, Accessibility, Spoken Content, Voices adds one.`, 'warn');
    };
    listen.addEventListener('click', () => trState.out && sayAloud(trState.out.came, trState.to));
    star.addEventListener('click', () => {
      const o = trState.out;
      if (!o) return;
      const d: Done = { id: `s${Date.now().toString(36)}`, said: o.said, came: o.came, from: o.from, to: trState.to, at: Date.now(), style: trState.style };
      const was = isStarred(trState.book, d);
      trState.book = toggleStar(trState.book, d, trState.trip || NO_TRIP);
      keep(BOOK_KEY, trState.book);
      paintOut();
      toast(was ? 'Taken out of the phrasebook.' : `Starred into the phrasebook, under ${trState.trip || NO_TRIP}.`, 'ok');
    });
    box.addEventListener('input', () => soon());

    // SPEAK: his voice fills the box, in the FROM language (English when it is to be found)
    let ear: Ear | null = null;
    speak.addEventListener('click', async () => {
      if (ear) {
        const e = ear;
        ear = null;
        speak.setAttribute('aria-pressed', 'false');
        try {
          const said = await e.stop();
          if (!said) return say('I heard nothing. Tap the microphone and say it again.');
          box.value = said;
          soon(0);
        } catch (err) {
          say(sayError(err, 'hear that'));
        }
        return;
      }
      if (!canHear()) return say('This browser has no speech recognition, so I can’t hear. Type it instead.');
      stopSpeaking();
      const lang = trState.from || 'en';
      speak.setAttribute('aria-pressed', 'true');
      say(`Listening in ${langName(lang)}… tap the microphone again when you are done.`);
      ear = hear(lang, (t) => t && say(`Hearing: ${t}`));
    });

    // ---- PHRASEBOOK: starred lines by trip, and a trip's ready lines in the country's language
    const tripField = h('input#tlxtrip.fxfield', { type: 'text', placeholder: 'This trip’s name, like Spain in May', 'aria-label': 'The trip new stars go under', value: trState.trip, autocomplete: 'off' }) as HTMLInputElement;
    tripField.addEventListener('change', () => {
      trState.trip = tripField.value.trim().slice(0, 40);
      keep(TRIP_KEY, trState.trip);
      drawBook();
    });
    const country = h('select#tlxcountry', { 'aria-label': 'A country’s phrasebook' }, h('option', { value: '' }, 'A country’s phrasebook…'), ...COUNTRIES.map((c) => h('option', { value: c.name }, c.name))) as HTMLSelectElement;
    const ready = h('div.tlxready');
    const starredBox = h('div.tlxbook');
    country.addEventListener('change', () => drawReady());
    views.book.append(h('div.tlxtriprow', h('label', h('span', 'NEW STARS GO UNDER'), tripField)), starredBox, h('div.tlxtriprow', h('label', h('span', 'GOING SOMEWHERE?'), country)), ready);

    const row = (d: Done, extra: HTMLElement[] = []) => {
      const say2 = h('button.fxkb', { type: 'button', 'aria-label': `Listen to it in ${langName(d.to)}`, dataset: { case: 'keep' } }, icon(SOUND));
      say2.addEventListener('click', () => sayAloud(d.came, d.to));
      return h('div.tlxrow', { role: 'listitem' }, h('div.tlxrowtext', h('p.tlxcame', { lang: d.to }, d.came), h('p.tlxsaid', `${d.said} · ${langName(d.to)}`)), say2, ...extra);
    };
    const drawBook = () => {
      clear(starredBox);
      const groups = byTrip(trState.book, trState.trip || NO_TRIP);
      if (!groups.length) {
        starredBox.append(h('p.tlxempty', 'Nothing starred yet. Tap the star under a translation and it is kept here, under this trip, on this phone.'));
        return;
      }
      for (const g of groups) {
        starredBox.append(
          h('b.fxhead', `${g.trip} · ${g.phrases.length}`),
          h(
            'div.tlxlist',
            { role: 'list' },
            ...g.phrases.map((p) => {
              const un = h('button.fxkb.tlxstar', { type: 'button', 'aria-pressed': 'true', 'aria-label': 'Take it out of the phrasebook', dataset: { case: 'keep' } }, icon(STAR));
              un.addEventListener('click', () => {
                const before = trState.book;
                trState.book = trState.book.filter((x) => x !== p);
                keep(BOOK_KEY, trState.book);
                drawBook();
                undo('Taken out of the phrasebook.', () => {
                  trState.book = before;
                  keep(BOOK_KEY, trState.book);
                  drawBook();
                });
              });
              return row(p, [un]);
            }),
          ),
        );
      }
    };
    const drawReady = () => {
      clear(ready);
      const c = COUNTRIES.find((x) => x.name === country.value);
      if (!c) return;
      ready.append(h('p.tlxempty', `Tap a line and I put it into ${langName(c.lang)}, say it, and you can star it under ${c.name}.`));
      for (const g of TRIP_PHRASES) {
        ready.append(
          h('b.fxhead', g.group.toUpperCase()),
          h(
            'div.tlxlist',
            { role: 'list' },
            ...g.lines.map((line) => {
              const b = button(line, async () => {
                b.disabled = true;
                const was = b.textContent;
                b.textContent = `${line} · translating…`;
                try {
                  const r = await translate(line, c.lang, 'en');
                  const d: Done = { id: `p${Date.now().toString(36)}`, said: line, came: r.text, from: 'en', to: c.lang, at: Date.now() };
                  const starIt = h('button.fxkb.tlxstar', { type: 'button', 'aria-pressed': 'false', 'aria-label': `Star it under ${c.name}`, dataset: { case: 'keep' } }, icon(STAR));
                  starIt.addEventListener('click', () => {
                    const on = isStarred(trState.book, d);
                    trState.book = toggleStar(trState.book, d, c.name);
                    keep(BOOK_KEY, trState.book);
                    starIt.setAttribute('aria-pressed', String(!on));
                  });
                  b.replaceWith(row(d, [starIt]));
                  sayAloud(r.text, c.lang);
                } catch (e) {
                  b.disabled = false;
                  b.textContent = was;
                  toast(sayError(e, 'translate that'), 'warn');
                }
              });
              b.classList.add('tlxline');
              b.dataset.case = 'keep';
              return b;
            }),
          ),
        );
      }
    };

    // ---- HISTORY: kept on this phone, searchable, cleared with an undo
    const search = h('input#tlxsearch.fxfield', { type: 'search', placeholder: 'Search your translations', 'aria-label': 'Search your translations', autocomplete: 'off' }) as HTMLInputElement;
    const histList = h('div.tlxlist', { role: 'list' });
    const clearAll = button('CLEAR HISTORY', () => {
      if (!trState.history.length) return;
      const before = trState.history;
      trState.history = [];
      keep(HISTORY_KEY, trState.history);
      drawHistory();
      undo('History cleared.', () => {
        trState.history = before;
        keep(HISTORY_KEY, trState.history);
        drawHistory();
      });
    });
    clearAll.dataset.case = 'keep';
    search.addEventListener('input', () => drawHistory());
    views.history.append(search, histList, clearAll);
    const drawHistory = () => {
      clear(histList);
      const list = searchDone(trState.history, search.value);
      clearAll.hidden = !trState.history.length;
      if (!list.length) {
        histList.append(h('p.tlxempty', trState.history.length ? 'Nothing matches that.' : 'No translations yet. Everything you translate is kept here, on this phone only.'));
        return;
      }
      for (const d of list.slice(0, 60)) {
        const again = button('OPEN', () => {
          box.value = d.said;
          trState.to = d.to;
          selTo.value = d.to;
          savePair();
          show('translate');
          soon(0);
        });
        again.dataset.case = 'keep';
        histList.append(row(d, [again]));
      }
    };

    P.left.append(seg, views.translate, views.book, views.history);
    show('translate');
    paintEmpty();

    return {
      enter() {
        visit++;
      },
      leave() {
        visit++;
        clearTimeout(timer);
        ear?.abort();
        ear = null;
        speak.setAttribute('aria-pressed', 'false');
        stopSpeaking();
      },
      open(arg: string) {
        // #translate?view=book, #translate?to=fr, #translate?text=hello
        const q = new URLSearchParams(arg);
        const v = q.get('view');
        if (v === 'book' || v === 'history' || v === 'translate') show(v);
        const to = q.get('to');
        if (to && LANGUAGES.some((l) => l.code === to)) {
          trState.to = to;
          selTo.value = to;
          savePair();
        }
        const text = q.get('text');
        if (text) {
          box.value = text.slice(0, 1000);
          show('translate');
          soon(0);
        }
      },
      context: () =>
        screenSays('translate', 'Translate', trState.out ? `Translate, into ${langName(trState.to)}: “${trState.out.said.slice(0, 60)}” came to “${trState.out.came.slice(0, 60)}”` : `Translate, into ${langName(trState.to)}`, { looking: trState.view === 'book' ? 'the phrasebook' : trState.view === 'history' ? 'the history' : 'the translation' }),
    };
  },
};
