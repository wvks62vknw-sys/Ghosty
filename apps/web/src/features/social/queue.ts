/**
 * [tabs] The SOCIAL screen's own pages (BRIEF-TABS 2): THE QUEUE — every draft for his accounts still waiting for his APPROVE,
 * drawn by the chat's own draft card (features/links/drafts.ts: APPROVE · EDIT · NO, nothing goes out without APPROVE) — and
 * what went out today, from the brain's record (GET /api/social). The accounts themselves are LINKS' own panels
 * (features/links/social.ts) and FATHER AND THE ORIGIN its own page (features/me/origin.ts): the screen shows those as they are.
 *
 * WRITE A POST (planlane:social): his words to one or several of his linked accounts at once, counted the way each account
 * counts them (Bluesky's 300 are graphemes), with one picture and its words where every chosen account takes pictures. It only
 * ever makes DRAFTS (POST /social/draft, one per account): each then waits in the queue with its own APPROVE · EDIT · NO, and
 * only his tap on that APPROVE sends it. Nothing here asks the brain to approve: the one call in the app is behind draftEl's APPROVE key.
 * His words (and the accounts he chose, and the picture's words) are kept on the phone while he writes, so leaving loses nothing.
 */
import { ACCOUNTS, accountName, draftCard, graphemes, postProblem, type Account } from '../../../../../packages/shared/src/social';
import { brain, headers, type DraftAnswer, type SocialInfo } from '../../api/brain';
import { clear, fmt, h } from '../../core/dom';
import { draftEl } from '../links/drafts';
import {
  accountsWords, ALT_MISSING, COMPOSE_EMPTY, COMPOSE_NONE, COMPOSE_NOTE, composeKey, countWords, KEPT_NOTE, madeWords, PICTURE_BIG, PICTURE_KINDS,
  PICTURE_NO, pictureWords, queueNote, QUEUE_ERROR, QUEUE_LOADING, SENT_EMPTY, SENT_ERROR, SENT_LOADING, sentNote, toWords,
} from './words';
import { button, toast } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { phrases } from '../lifeui';

/** One read of the brain shared by the pages shown together (the queue and what went out). */
let held: { at: number; info: Promise<SocialInfo | null> } | null = null;
export function socialInfo(fresh = false): Promise<SocialInfo | null> {
  if (!fresh && held && Date.now() - held.at < 3000) return held.info;
  held = { at: Date.now(), info: brain.social().catch(() => null) };
  return held.info;
}

/** The drafts still waiting for his APPROVE (or a failed send that waits again), across his accounts. */
export const waiting = (info: SocialInfo | null) => (info?.drafts ?? []).filter((d) => (d.state === 'waiting' || d.state === 'failed') && Date.now() <= d.expires);

// ---------------------------------------------------------------- what he is writing, kept on the phone

/** His words, the accounts he chose and the picture's words, kept on this phone while he writes (cleared once the drafts are made). */
export const COMPOSE_STORE = 'ghosty.social.compose';
interface Kept {
  text: string;
  to: Account[];
  alt: string;
}
function loadKept(): Kept {
  try {
    const j = JSON.parse(localStorage.getItem(COMPOSE_STORE) ?? 'null') as Partial<Kept> | null;
    return { text: typeof j?.text === 'string' ? j.text : '', to: Array.isArray(j?.to) ? j.to.filter((a): a is Account => ACCOUNTS.some((x) => x.id === a)) : [], alt: typeof j?.alt === 'string' ? j.alt : '' };
  } catch {
    return { text: '', to: [], alt: '' };
  }
}
function saveKept(k: Kept): void {
  try {
    if (!k.text && !k.alt && !k.to.length) localStorage.removeItem(COMPOSE_STORE);
    else localStorage.setItem(COMPOSE_STORE, JSON.stringify(k));
  } catch {
    /* a phone that will not keep it still lets him write */
  }
}
/** The picture he picked: kept in memory until Ghosty is closed (too big for the phone's small store). */
let picture: { blob: Blob; url: string } | null = null;
const PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PICTURE_MAX = 1_500_000;

/** How an account counts a post's length (as the brain does: Bluesky's 300 are graphemes, the others letters). */
export const lengthOn = (a: Account, text: string): number => (a === 'bluesky' ? graphemes(text.trim()) : [...text.trim()].length);

/** POST /social/draft with a picture: the brain's draft route takes `image` (one of his /i/ pictures) and `alt`. */
const draftWith = brain.socialDraft as unknown as (b: { account: Account; text: string; image?: string; alt?: string; from: 'phone' }) => Promise<DraftAnswer>;

/** The picture, kept by the brain for 24 hours under /i/<id> so the post can carry it (the Lens's own store). */
async function keepPicture(blob: Blob): Promise<string> {
  const { shareImage } = await import('../../vision/engines');
  const r = await shareImage(blob, { fetch: (u, i) => fetch(u, i), headers });
  return r.id;
}

/** THE QUEUE: each waiting draft as the chat draws it, newest first; then WRITE A POST. */
export function queueScreen(): { el: HTMLElement; stop(): void } {
  const list = h('div.pkcol.socq', { 'aria-live': 'polite' });
  /* state: social.queue loading */
  const note = h('p.pknote', QUEUE_LOADING);
  let gone = false;
  const paint = async (fresh = false) => {
    const info = await socialInfo(fresh);
    if (gone) return;
    const w = waiting(info).sort((a, b) => b.at - a.at);
    /* state: social.queue offline */
    /* state: social.queue empty */
    /* state: social.queue error */
    note.textContent = !info ? QUEUE_ERROR : queueNote(w.length);
    clear(list, ...w.map((d) => draftEl(draftCard(d), () => void paint(true))));
    paintCompose(info);
  };

  // WRITE A POST: a box for his own words, to one or more of his linked accounts. It makes DRAFTS (POST /social/draft), never a
  // post: each draft shows in the queue above with APPROVE · EDIT · NO, and only his APPROVE on it sends it.
  const kept = loadKept();
  const compose = h('div.pkcol.soccompose', { 'aria-label': 'Write a post' });
  let to: Account[] = kept.to;
  let linkedNow: Account[] = [];
  const box = h('textarea', { rows: '4', placeholder: 'What do you want to post?', 'aria-label': 'Your post', maxlength: '4096' }) as HTMLTextAreaElement;
  box.value = kept.text;
  const alt = h('input.socalt', { type: 'text', placeholder: 'e.g. The canal at dusk, two swans', 'aria-label': 'What is in the picture, for anyone who cannot see it', maxlength: '1000' }) as HTMLInputElement;
  alt.value = kept.alt;
  const keep = () => saveKept({ text: box.value, to, alt: alt.value });
  const count = h('small.pknote.soccount', { 'aria-live': 'polite' });
  const where = h('p.pknote.socto');
  const accLine = h('p.pknote.socacc');
  const picLine = h('p.pknote.socpicl');
  const picBox = h('div.pkcol.socpic');
  /* state: social.compose error */
  const msg = h('p.pknote.socmsg', { role: 'status', 'aria-live': 'polite' });
  const file = h('input', { type: 'file', accept: PICTURE_TYPES.join(','), hidden: '', 'aria-hidden': 'true', tabindex: '-1' }) as HTMLInputElement;
  const chosen = () => ACCOUNTS.filter((a) => to.includes(a.id) && linkedNow.includes(a.id));
  const recount = () => {
    const rows = chosen().map((a) => ({ name: a.name, n: lengthOn(a.id, box.value), max: a.max }));
    count.textContent = rows.length ? countWords(rows) : '';
    count.classList.toggle('bad', rows.some((r) => r.n > r.max));
  };
  const paintPicture = () => {
    const c = chosen();
    const no = c.filter((a) => !a.pictures).map((a) => a.name);
    picLine.textContent = pictureWords(c.map((a) => a.name), no);
    const add = button(picture ? 'ANOTHER PICTURE' : 'ADD A PICTURE', () => file.click());
    add.setAttribute('aria-label', picture ? 'Pick another picture instead' : 'Add a picture to the post');
    const off = button('TAKE IT OFF', () => {
      if (picture) URL.revokeObjectURL(picture.url);
      picture = null;
      paintPicture();
    }, 'warn');
    off.setAttribute('aria-label', 'Take the picture off the post');
    if (picture)
      clear(picBox, h('img.socthumb', { src: picture.url, alt: alt.value.trim() || 'The picture you picked' }), h('div.lab', 'THE PICTURE, IN WORDS'), alt, h('div.keyrow.wrapit', ...(no.length ? [] : [add]), off));
    else clear(picBox, ...(c.length && !no.length ? [h('div.keyrow', add)] : []));
  };
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    if (!PICTURE_TYPES.includes(f.type)) return void (msg.textContent = PICTURE_KINDS);
    if (f.size > PICTURE_MAX) return void (msg.textContent = PICTURE_BIG);
    if (picture) URL.revokeObjectURL(picture.url);
    picture = { blob: f, url: URL.createObjectURL(f) };
    msg.textContent = '';
    paintPicture();
    setTimeout(() => alt.focus(), 30);
  });
  box.addEventListener('input', () => {
    recount();
    keep();
  });
  alt.addEventListener('input', keep);

  let busy = false;
  const make = button(composeKey(1), () => void makeDrafts(), 'on');
  const makeDrafts = async () => {
    if (busy) return;
    const c = chosen();
    const text = box.value.trim();
    if (!c.length) return void (msg.textContent = toWords([]));
    if (!text && !picture) return void ((msg.textContent = `${COMPOSE_EMPTY}.`), box.focus());
    const no = c.filter((a) => !a.pictures);
    if (picture && no.length) return void (msg.textContent = PICTURE_NO(no.map((a) => a.name)));
    if (picture && !alt.value.trim()) return void ((msg.textContent = ALT_MISSING), alt.focus());
    // each account's own limit, said before anything is asked of the brain
    for (const a of c) {
      const problem = postProblem(a.id, text, picture ? { id: 'here', alt: alt.value } : null);
      if (problem) return void (msg.textContent = problem);
    }
    busy = true;
    make.disabled = true;
    msg.textContent = c.length > 1 ? `Making ${c.length} drafts…` : 'Making the draft…';
    const made: Account[] = [];
    const missed: { name: string; why: string }[] = [];
    let image = '';
    try {
      if (picture) image = await keepPicture(picture.blob);
      for (const a of c) {
        try {
          const r = await draftWith({ account: a.id, text, ...(image ? { image, alt: alt.value.trim() } : {}), from: 'phone' });
          if (r.error || !r.draft) missed.push({ name: a.name, why: r.error ?? 'my brain did not make it' });
          else made.push(a.id);
        } catch (e) {
          missed.push({ name: a.name, why: sayError(e, `make the draft for ${a.name}`) });
        }
      }
    } catch (e) {
      missed.push(...c.map((a) => ({ name: a.name, why: sayError(e, 'keep the picture for the post') })));
    }
    busy = false;
    make.disabled = false;
    msg.textContent = madeWords(made.map(accountName), missed);
    if (made.length) {
      toast(made.length > 1 ? `${made.length} drafts made. Each waits above for your APPROVE.` : 'Draft made. It waits above for your APPROVE.', 'ok');
      if (!missed.length) {
        box.value = '';
        alt.value = '';
        if (picture) URL.revokeObjectURL(picture.url);
        picture = null;
      } else to = to.filter((a) => !made.includes(a));
      keep();
      await paint(true);
    }
  };

  const paintCompose = (info: SocialInfo | null) => {
    /* state: social.compose offline */
    accLine.textContent = accountsWords(info?.accounts ?? null);
    if (!info) return void clear(compose, h('b', 'Write a post'), accLine, ...(box.value.trim() ? [h('p.pknote', KEPT_NOTE)] : []));
    linkedNow = info.accounts.filter((a) => a.who).map((a) => a.id);
    /* state: social.compose empty */
    if (!linkedNow.length) return void clear(compose, h('b', 'Write a post'), accLine, h('p.pknote', COMPOSE_NONE));
    to = to.filter((a) => linkedNow.includes(a));
    if (!to.length) to = [linkedNow[0]!];
    const keys = ACCOUNTS.filter((a) => linkedNow.includes(a.id)).map((a) => {
      const on = to.includes(a.id);
      const b = button(a.name.replace(/^your /, 'Your '), () => {
        to = on ? to.filter((x) => x !== a.id) : [...to, a.id];
        keep();
        msg.textContent = '';
        paintCompose(info);
      }, on ? 'on' : '');
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', `${on ? 'Posting to' : 'Not posting to'} ${a.name}: tap to ${on ? 'leave it out' : 'add it'}`);
      b.dataset.case = 'keep';
      return b;
    });
    where.textContent = toWords(chosen().map((a) => a.name));
    make.textContent = composeKey(chosen().length);
    make.setAttribute('aria-label', `${composeKey(chosen().length)}: nothing goes out until you tap APPROVE on ${chosen().length > 1 ? 'each one' : 'it'}`);
    clear(
      compose,
      h('b', 'Write a post'),
      accLine,
      h('div.keyrow.wrapit', { role: 'group', 'aria-label': 'Which accounts' }, ...keys),
      where,
      box,
      count,
      picLine,
      picBox,
      file,
      h('p.pknote', COMPOSE_NOTE),
      h('p.pknote.sockept', KEPT_NOTE),
      h('div.keyrow', make),
      msg,
    );
    recount();
    paintPicture();
  };
  void paint();
  return { el: h('div.pkcol', note, list, compose, phrases(['post that to Bluesky', 'who made you?'])), stop: () => (gone = true) };
}

/** What went out today: each post, follow or unfollow with its account, its time and its link. */
export function sentScreen(): { el: HTMLElement; stop(): void } {
  const list = h('div.pkcol', { role: 'list', 'aria-label': 'Sent today' });
  /* state: social.sent loading */
  const note = h('p.pknote.socsentl', SENT_LOADING);
  let gone = false;
  void socialInfo().then((info) => {
    if (gone) return;
    const sent = [...(info?.sent ?? [])].sort((a, b) => b.at - a.at);
    /* state: social.sent error */
    /* state: social.sent empty */
    note.textContent = !info ? SENT_ERROR : sent.length ? sentNote(sent.length) : SENT_EMPTY;
    clear(list, ...sent.map((s) => h('div.pkperson.socsent', { role: 'listitem' },
      h('b', { dataset: { case: 'keep' } }, s.kind === 'post' ? s.text : `${s.kind === 'follow' ? 'Followed' : 'Unfollowed'} ${s.who ?? s.text}`),
      h('span.pklab', `${accountName(s.account)} · ${fmt.ago(s.at)}`),
      s.link ? h('a.lnk.socopen', { href: s.link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Open it on ${accountName(s.account)}` }, `Open it on ${accountName(s.account)} ↗`) : null,
    )));
  });
  return { el: h('div.pkcol', note, list), stop: () => (gone = true) };
}
