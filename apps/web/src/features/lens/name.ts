/**
 * NAME: name almost anything in view, on the phone. The picture (the live frame about every
 * 0.7 s, the held frame, or a picked photo) goes through MobileCLIP's picture encoder and is
 * matched against 4,624 everyday names (32,800-odd with MORE NAMES); the five closest show with
 * how strongly each matches. A tap on the picture names just that part. A tap on a name offers
 * ASK GHOSTY (the picture and the question, the names riding along as the phone's guesses) and
 * SEARCH THE WEB (words only). The namer loads on the first use of this mode and is freed on
 * leaving it (vision/clip.ts). These are guesses — the closest names, not facts — and people are
 * only ever "person", "man", "woman", "child": nobody is identified.
 *
 * LIVING THING (living.ts) names a plant, a bird, an insect or another living thing properly: a
 * plant by Pl@ntNet, the rest by Ghosty's model that can see, on a tap (lit up when the closest
 * names are unsure). Nothing is kept unless SAVE is pressed on its card.
 */
import { clear, h } from '../../core/dom';
import { bar, button, toast } from '../../ui/components';
import type { Box } from '../../vision/boxes';
import { cropCanvas, loadImageFile } from '../../vision/camera';
import { EXTENDED_SIZE, NAMER_SIZE, namer } from '../../vision/clip';
import { namesLine, tapSquare, type NameGuess } from '../../vision/clipmath';
import type { LensContext, Mode, ModeOpts } from './index';
import { createLiving } from './living';
import { ASKED_KINDS, type AskedKind } from '../../../../../packages/shared/src/living';

/** How often the live picture is named, at most (the encoder takes ~0.3–1 s on a phone). */
const EVERY_MS = 700;
const MORE_KEY = 'ghosty.lens.morenames';
/** Under this share the closest name is unsure: LIVING THING lights up. */
const UNSURE = 0.35;
const KIND_LABEL: Record<AskedKind, string> = { plant: 'PLANT', bird: 'BIRD', insect: 'INSECT', other: 'OTHER' };

const morePref = (): boolean => {
  try {
    return localStorage.getItem(MORE_KEY) === '1';
  } catch {
    return false;
  }
};
const setMorePref = (on: boolean): void => {
  try {
    localStorage.setItem(MORE_KEY, on ? '1' : '0');
  } catch {
    /* private mode: the choice lasts this visit only */
  }
};

export function createNameMode(L: LensContext): Mode {
  const S = L.state;
  let ready = false;
  let last = 0;
  /** Bumped on leave: a load or a run still in flight belongs to a past visit. */
  let visit = 0;
  /** The tapped part of the picture (frame pixels), or null for the whole picture. */
  let focus: Box | null = null;
  /** A picked photo being named (instead of the camera). */
  let photo: HTMLCanvasElement | null = null;
  let chosen = '';
  let names: NameGuess[] = [];
  let asking = false;
  /** ASK GHOSTY is taking the picture: the names go along with it (else they are cleared on leaving). */
  let handover = false;

  const progress = h('div.lensprog');
  progress.hidden = true;
  const list = h('div.lensnames');
  const chosenTitle = h('b');
  const replyModel = h('small');
  const replyText = h('div');
  const reply = h('div.lensreply', replyModel, replyText);
  reply.hidden = true;
  const card = h('div.lenssel');
  card.hidden = true;
  const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Pick a photo to name' });
  file.hidden = true;
  const live = button('LIVE VIEW', () => {
    photo = null;
    focus = null;
    if (S.frozen) L.freeze(false);
    L.showStill(null);
    live.hidden = true;
    paint();
  });
  live.hidden = true;
  const whole = button('WHOLE PICTURE', () => {
    focus = null;
    whole.hidden = true;
    again();
  });
  whole.hidden = true;
  const more = button('MORE NAMES', () => void toggleMore());
  more.setAttribute('aria-label', `More names: 28,000 extra, ${EXTENDED_SIZE} once`);
  const living = createLiving(L);
  const kinds = h('div.row.wrap.livingkinds', h('small.livinghead', 'IS IT A'));
  kinds.hidden = true;
  for (const k of ASKED_KINDS) {
    kinds.append(
      button(KIND_LABEL[k], () => {
        const pic = pictureNow();
        if (!pic) return void toast('No picture: START the camera or PICK PHOTO', 'warn');
        kinds.hidden = true;
        void living.nameIt(k, pic);
      }, k === 'plant' ? 'warn' : ''),
    );
  }
  const livingBtn = button('LIVING THING', () => {
    kinds.hidden = !kinds.hidden;
    if (!kinds.hidden) kinds.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  });
  livingBtn.setAttribute('aria-label', 'Living thing: name a plant, bird or insect properly');
  const unsure = h('div.note', "Not sure? LIVING THING names a plant (Pl@ntNet) or a bird or an insect (Ghosty's model).");
  unsure.hidden = true;
  const hint = h('div.note', `Names what is in view from 4,624 everyday things (about 33,000 with MORE NAMES), on the phone. Tap the picture to name just that part; tap a name to ask Ghosty or search the web. These are the closest names, not certainties. The first use loads the namer (${NAMER_SIZE}, once).`);
  const root = h('div.stackf',
    h('div.row.wrap', button('PICK PHOTO', () => file.click()), live, whole, more, livingBtn),
    kinds,
    living.el,
    unsure,
    progress,
    list,
    card,
    reply,
    hint,
  );

  const setProgress = (status: string, frac?: number) => {
    if (S.mode !== 'name') return;
    L.status(status, 'mid');
    progress.hidden = false;
    clear(progress, bar(status.replace(/…$/, '').replace(/\s*\(.*\)/, '').toUpperCase().slice(0, 24), frac ?? 0, frac != null ? `${Math.round(frac * 100)}%` : ''));
  };

  /** The names and the tapped square over the picture; the names in the state a test (and describe()) reads. */
  const paint = () => {
    S.names = names;
    const doubt = names.length > 0 && (names[0]?.p ?? 0) < UNSURE;
    livingBtn.classList.toggle('on', doubt);
    unsure.hidden = !doubt || !living.el.hidden;
    L.lines(namesLine(names, 2), focus ? 'tapped part' : '');
    if (!L.overlay()) return;
    if (focus) L.drawBox(focus, names[0] ? `${names[0].label} ${Math.round(names[0].p * 100)}%` : '', { on: true });
  };

  /**
   * The name buttons, updated in place (the live picture is named every 0.7 s: rebuilding them
   * would swallow a tap that lands mid-update).
   */
  const rows: { b: HTMLButtonElement; name: HTMLElement; bar: HTMLElement; pct: HTMLElement; label: string }[] = [];
  const showNames = () => {
    while (rows.length < names.length) {
      const row = { b: button('', () => pick(row.label)), name: h('span'), bar: h('i'), pct: h('small'), label: '' };
      clear(row.b, row.name, row.bar, row.pct);
      rows.push(row);
      list.append(row.b);
    }
    rows.forEach((row, i) => {
      const n = names[i];
      row.b.hidden = !n;
      if (!n) return;
      const pct = Math.round(n.p * 100);
      row.label = n.label;
      row.name.textContent = n.label;
      row.pct.textContent = `${pct}%`;
      row.bar.style.width = `${Math.max(2, pct)}%`;
      row.b.classList.toggle('on', n.label === chosen);
      row.b.setAttribute('aria-label', `${n.label}, ${pct} percent: ask or search`);
    });
  };

  const pick = (label: string) => {
    chosen = label;
    card.hidden = false;
    chosenTitle.textContent = label.toUpperCase();
    showNames();
    // the actions sit under the list: bring them into the panel's view on a phone
    card.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };

  /** The picture the names were made from (a crop when a part was tapped), for ASK GHOSTY. */
  const pictureNow = (): HTMLCanvasElement | null => {
    const still = photo ?? L.still(1600);
    if (!still) return null;
    if (!focus) return still;
    // the focus is in the frame's pixels; a still taken smaller than the frame scales it down
    const { frame } = L.view();
    const k = photo ? 1 : still.width / (frame.w || still.width);
    return cropCanvas(still, { x: focus.x * k, y: focus.y * k, w: focus.w * k, h: focus.h * k });
  };

  card.append(
    chosenTitle,
    h('div.row.wrap',
      button('ASK GHOSTY', () => {
        const pic = pictureNow();
        if (!chosen) return;
        if (!pic) return void toast('No picture: START the camera or PICK PHOTO', 'warn');
        S.lastAction = `ask about ${chosen}`;
        handover = true;
        L.setMode('ask', { still: pic, question: `What is this? Is it a ${chosen}? Tell me about it.`, send: true });
      }, 'warn'),
      button('SEARCH THE WEB', () => void searchWeb()),
      button('CLEAR', () => {
        chosen = '';
        card.hidden = true;
        showNames();
      }),
    ),
  );

  /** Words only: Ghosty searches the web for the name and says what it is (no picture leaves the phone). */
  const searchWeb = async () => {
    if (!chosen || asking) return;
    asking = true;
    S.lastAction = `search the web for ${chosen}`;
    L.status(`asking Ghosty to search for "${chosen}"…`, 'mid');
    try {
      const r = await L.ask(`Search the web for "${chosen}" and tell me in a few lines what it is, with a link or two.`, null);
      reply.hidden = false;
      replyModel.textContent = r.text ? r.model || 'GHOSTY' : 'PROBLEM';
      replyText.textContent = r.text || r.error || 'No answer came back';
      S.reply = r.text;
      L.status(r.text ? 'answered' : 'no answer', r.text ? 'ok' : 'off');
    } finally {
      asking = false;
    }
  };

  /** Name the picture (or the tapped part of it) now. */
  const run = async (src: CanvasImageSource, size: { w: number; h: number }) => {
    if (!ready || namer.busy) return;
    const v = visit;
    try {
      const r = await namer.name(src, size, focus ?? undefined);
      if (v !== visit || !r) return;
      names = r.names;
      showNames();
      paint();
      S.lookMs = Math.round(r.ms);
      if (S.mode === 'name') L.status(`${focus ? 'naming the part you tapped' : photo || S.frozen ? 'named · tap a name' : 'naming what is in view'}${namer.extended ? ' · more names' : ''}`, 'ok');
    } catch (e) {
      if (v !== visit) return;
      S.error = `The namer failed: ${String((e as Error)?.message ?? e)}`;
      L.status(S.error, 'off');
    }
  };

  /** Name again whatever is on screen when it is not the live picture (a photo, a held frame). */
  const again = () => {
    if (photo) return void run(photo, { w: photo.width, h: photo.height });
    const held = S.frozen ? L.still() : null;
    if (held) return void run(held, { w: held.width, h: held.height });
    last = 0; // the live picture: the next tick names it
    paint();
  };

  const load = () => {
    if (ready) return;
    const v = visit;
    void namer
      .load(setProgress, morePref())
      .then((r) => {
        if (v !== visit) return;
        ready = true;
        progress.hidden = true;
        more.classList.toggle('on', r.extended);
        if (S.mode === 'name') L.status(S.camera === 'on' || photo ? `namer ready · ${r.names.toLocaleString('en-GB')} names` : 'namer ready · START the camera or PICK PHOTO', 'ok');
        again();
      })
      .catch((e: unknown) => {
        if (v !== visit) return;
        progress.hidden = true;
        S.error = String((e as Error)?.message ?? e);
        if (S.mode === 'name') L.status(S.error, 'off');
      });
  };

  const toggleMore = async () => {
    const on = !namer.extended;
    setMorePref(on);
    more.classList.toggle('on', on);
    if (!on) {
      namer.dropExtended();
      again();
      return;
    }
    if (!ready) return; // the load under way picks the choice up next time; it is remembered
    const v = visit;
    try {
      await namer.loadExtended(setProgress);
      if (v !== visit) return;
      progress.hidden = true;
      again();
    } catch (e) {
      progress.hidden = true;
      more.classList.remove('on');
      toast(`Could not load the extra names: ${String((e as Error)?.message ?? e)}`, 'bad');
    }
  };

  const usePhoto = async (c: HTMLCanvasElement) => {
    photo = c;
    focus = null;
    whole.hidden = true;
    L.showStill(c);
    live.hidden = false;
    names = [];
    showNames();
    paint();
    if (!ready) return void L.status('the namer is still loading…', 'mid');
    await run(c, { w: c.width, h: c.height });
  };

  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      S.lastAction = 'name a photo';
      await usePhoto(await loadImageFile(f, 1024));
    } catch (e) {
      toast(String((e as Error)?.message ?? e), 'bad');
    }
  });

  return {
    id: 'name',
    enter(opts?: ModeOpts) {
      clear(L.panel);
      L.panel.append(root, file);
      S.error = '';
      load();
      if (opts?.still) void usePhoto(opts.still);
      else if (photo) {
        L.showStill(photo);
        live.hidden = false;
      }
      showNames();
      paint();
    },
    leave() {
      visit++;
      ready = false;
      focus = null;
      photo = null;
      chosen = '';
      card.hidden = true;
      reply.hidden = true;
      kinds.hidden = true;
      unsure.hidden = true;
      living.clear();
      live.hidden = true;
      whole.hidden = true;
      progress.hidden = true;
      L.clearOverlay();
      // the names go with ASK GHOSTY's picture; otherwise they belong to a picture no longer shown
      if (!handover) S.names = [];
      handover = false;
      names = [];
      // the namer's memory (runtime, encoder, names) goes now; the files stay cached for next time
      namer.release();
    },
    tick(now) {
      // a picked name holds the list still until CLEAR, so the actions stay about what was picked
      if (!ready || photo || chosen || S.frozen || namer.busy || now - last < EVERY_MS) return;
      last = now;
      const { frame } = L.view();
      if (!frame.w) return;
      void run(L.video, frame);
    },
    tap(x, y) {
      const size = photo ? { w: photo.width, h: photo.height } : L.view().frame;
      if (!size.w) return;
      focus = tapSquare(x, y, size.w, size.h);
      whole.hidden = false;
      S.lastAction = 'name the tapped part';
      again();
    },
    froze(still) {
      if (ready) void run(still, { w: still.width, h: still.height });
    },
    unfroze() {
      last = 0;
    },
  };
}
