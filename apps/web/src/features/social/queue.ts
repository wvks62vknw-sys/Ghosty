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
import { ACCOUNTS, accountInfo, accountName, draftCard, graphemes, postProblem, type Account } from '../../../../../packages/shared/src/social';
import { brain, headers, type DraftAnswer, type SocialInfo } from '../../api/brain';
import { clear, fmt, h } from '../../core/dom';
import { brainRefusal, draftEl, noteMax, ownMax, socialRead } from '../links/drafts';
import {
  accountsWords, ALT_MISSING, COMPOSE_EMPTY, COMPOSE_NONE, COMPOSE_NOTE, composeKey, countWords, KEPT_NOTE, madeWords, PICTURE_BIG, PICTURE_KINDS,
  PICTURE_KEPT, PICTURE_NO, PICTURE_SHRINKING, pictureWords, tooLong, queueNote, QUEUE_ERROR, QUEUE_LOADING, SENT_EMPTY, SENT_ERROR, SENT_LOADING, sentNote, toWords,
} from './words';
import { button, toast } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { phrases } from '../lifeui';

/** One read of the brain shared by the pages shown together (the queue and what went out). */
let held: { at: number; info: Promise<SocialInfo | null> } | null = null;
export function socialInfo(fresh = false): Promise<SocialInfo | null> {
  if (!fresh && held && Date.now() - held.at < 3000) return held.info;
  // the brain's answer now (never the phone's kept copy): out of reach, every part says so
  held = { at: Date.now(), info: socialRead().then((i) => (noteMax(i), i)).catch(() => null) };
  return held.info;
}

/** A fresh read was made (after his APPROVE, NO or a new draft): SENT TODAY, shown beside the queue, paints from it too. */
const fresh = new EventTarget();

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
/** Bluesky's limit, the smaller of the two that take pictures: a bigger picture is made smaller (a JPEG) on the phone first. */
const PICTURE_MAX = 1_000_000;
/** His account's own length: his Mastodon server's (GET /social), else the fixed one. */
const maxOf = (a: Account): number => ownMax.get(a) ?? accountInfo(a).max;

/** The drafts being made right now, shared by every copy of the page (he may leave and come back while they are made). */
let making = false;
const madeEvents = new EventTarget();

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
  const paint = async (again = false) => {
    const info = await socialInfo(again);
    if (gone) return;
    if (again) fresh.dispatchEvent(new Event('read'));
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
    const rows = chosen().map((a) => ({ name: a.name, n: lengthOn(a.id, box.value), max: maxOf(a.id) }));
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
      clear(picBox, h('img.socthumb', { src: picture.url, alt: alt.value.trim() || 'The picture you picked' }), h('div.lab', 'THE PICTURE, IN WORDS'), alt, h('p.pknote.socpick', PICTURE_KEPT), h('div.keyrow.wrapit', ...(no.length ? [] : [add]), off));
    else clear(picBox, ...(c.length && !no.length ? [h('div.keyrow', add)] : []));
  };
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    if (!PICTURE_TYPES.includes(f.type)) return void (msg.textContent = PICTURE_KINDS);
    let blob: Blob = f;
    if (f.size > PICTURE_MAX) {
      // a camera photo (2–5 MB) made a JPEG under 1 MB, as the Lens does before it shares, so every account that takes pictures takes it
      msg.textContent = PICTURE_SHRINKING;
      try {
        const { loadImageFile, toJpegBlob } = await import('../../vision/camera');
        blob = await toJpegBlob(await loadImageFile(f, 2048), PICTURE_MAX, 2048);
      } catch {
        blob = f;
      }
      if (gone) return;
      if (blob.size > PICTURE_MAX) return void (msg.textContent = PICTURE_BIG);
    }
    if (picture) URL.revokeObjectURL(picture.url);
    picture = { blob, url: URL.createObjectURL(blob) };
    msg.textContent = '';
    paintPicture();
    setTimeout(() => alt.focus(), 30);
  });
  box.addEventListener('input', () => {
    recount();
    keep();
  });
  alt.addEventListener('input', keep);

  const make = button(composeKey(1), () => void makeDrafts(), 'on');
  const makeDrafts = async () => {
    if (making) return;
    const c = chosen();
    const text = box.value.trim();
    if (!c.length) return void (msg.textContent = toWords([]));
    if (!text && !picture) return void ((msg.textContent = `${COMPOSE_EMPTY}.`), box.focus());
    const no = c.filter((a) => !a.pictures);
    if (picture && no.length) return void (msg.textContent = PICTURE_NO(no.map((a) => a.name)));
    if (picture && !alt.value.trim()) return void ((msg.textContent = ALT_MISSING), alt.focus());
    // each account's own limit (his Mastodon server's own), said before anything is asked of the brain
    for (const a of c) {
      const n = lengthOn(a.id, text);
      if (n > maxOf(a.id)) return void ((msg.textContent = tooLong(a.name, n, maxOf(a.id))), box.focus());
      const problem = postProblem(a.id, text, picture ? { id: 'here', alt: alt.value } : null, maxOf(a.id));
      if (problem) return void (msg.textContent = problem);
    }
    making = true;
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
          missed.push({ name: a.name, why: brainRefusal(e, `make the draft for ${a.name}`) });
        }
      }
    } catch (e) {
      missed.push(...c.map((a) => ({ name: a.name, why: sayError(e, 'keep the picture for the post') })));
    }
    // once, whichever copy of the page is showing now: what is kept on the phone, the picture, and the toast
    if (made.length) {
      const k = loadKept();
      saveKept(missed.length ? { ...k, to: k.to.filter((a) => !made.includes(a)) } : { text: '', alt: '', to: k.to });
      if (!missed.length && picture) {
        URL.revokeObjectURL(picture.url);
        picture = null;
      }
      toast(made.length > 1 ? `${made.length} drafts made. Each waits above for your APPROVE.` : 'Draft made. It waits above for your APPROVE.', 'ok');
    }
    making = false;
    madeEvents.dispatchEvent(new CustomEvent('made', { detail: madeWords(made.map(accountName), missed) }));
  };
  // the live copy takes the answer: its box and accounts from what is kept, the queue read again (a retry never makes a draft twice)
  const onMade = (ev: Event) => {
    if (gone) return;
    const k = loadKept();
    box.value = k.text;
    alt.value = k.alt;
    to = k.to;
    make.disabled = false;
    msg.textContent = (ev as CustomEvent<string>).detail;
    void paint(true);
  };
  madeEvents.addEventListener('made', onMade);

  let first = true;
  const paintCompose = (info: SocialInfo | null) => {
    /* state: social.compose offline */
    accLine.textContent = accountsWords(info?.accounts ?? null);
    // the brain not answering: he can still write (kept on the phone); the drafts are made when it answers again
    if (!info) return void clear(compose, h('b', 'Write a post'), accLine, box, h('p.pknote.sockept', KEPT_NOTE), h('div.keyrow', button('TRY AGAIN', () => void paint(true))));
    linkedNow = info.accounts.filter((a) => a.who).map((a) => a.id);
    /* state: social.compose empty */
    if (!linkedNow.length) return void clear(compose, h('b', 'Write a post'), accLine, h('p.pknote', COMPOSE_NONE));
    to = to.filter((a) => linkedNow.includes(a));
    // the first account is chosen for him once, when nothing was kept; after that his own taps decide (none chosen is a choice too)
    if (first && !to.length) to = [linkedNow[0]!];
    first = false;
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
    make.disabled = making;
    if (making && !msg.textContent) msg.textContent = 'Making the drafts…';
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
  return { el: h('div.pkcol', note, list, compose, phrases(['post that to Bluesky', 'who made you?'])), stop: () => ((gone = true), madeEvents.removeEventListener('made', onMade)) };
}

/** What went out today: each post, follow or unfollow with its account, its time and its link. */
export function sentScreen(): { el: HTMLElement; stop(): void } {
  const list = h('div.pkcol', { role: 'list', 'aria-label': 'Sent today' });
  /* state: social.sent loading */
  const note = h('p.pknote.socsentl', SENT_LOADING);
  let gone = false;
  const paint = () => void socialInfo().then((info) => {
    if (gone) return;
    // today on this phone's own clock, not the day the brain answered on (a read kept from last night is not today)
    const today = new Date().toDateString();
    const sent = (info?.sent ?? []).filter((s) => new Date(s.at).toDateString() === today).sort((a, b) => b.at - a.at);
    /* state: social.sent error */
    /* state: social.sent empty */
    note.textContent = !info ? SENT_ERROR : sent.length ? sentNote(sent.length) : SENT_EMPTY;
    clear(list, ...sent.map((s) => h('div.pkperson.socsent', { role: 'listitem' },
      h('b', { dataset: { case: 'keep' } }, s.kind === 'post' ? s.text : `${s.kind === 'follow' ? 'Followed' : 'Unfollowed'} ${s.who ?? s.text}`),
      h('span.pklab', `${accountName(s.account)} · ${fmt.ago(s.at)}`),
      s.link ? h('a.lnk.socopen', { href: s.link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Open it on ${accountName(s.account)}` }, `Open it on ${accountName(s.account)} ↗`) : null,
    )));
  });
  paint();
  // what went out a moment ago shows here at once, not on the next visit
  fresh.addEventListener('read', paint);
  return { el: h('div.pkcol', note, list), stop: () => ((gone = true), fresh.removeEventListener('read', paint)) };
}
