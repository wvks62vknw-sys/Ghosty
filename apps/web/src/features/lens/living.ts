/**
 * NAME IT and WHAT'S IN IT: the Lens's cards for a living thing and for a meal (the checks and the
 * words are in packages/shared/src/living.ts, shared with the brain).
 *
 * NAME IT (NAME's LIVING THING → PLANT / BIRD / INSECT / OTHER): a plant goes to Pl@ntNet through
 * the brain (its free key; the photo is held under a picture id for the moment it takes and the
 * brain forgets it at once, tools/lens.ts identify_plant); anything else goes with the photo to the
 * brain's model that can see, which answers JSON checked before anything shows. The card: the name,
 * how sure in plain words ("about 70 % sure", "probably"), the tell-tale, Wikipedia, and SAVE — the
 * only way anything is kept ("seen: a robin, 24 Oct, near home" in Memory). A person is never named.
 *
 * WHAT'S IN IT (ASK's chip): the model lists the foods with guessed portions, the brain matches them
 * to its table or Open Food Facts (POST /api/lookup/barcode), and a barcode in the photo gets the
 * packet's exact figures (the SCAN reader, GET /api/lookup/barcode). "About 650 kcal", always with
 * why it is rough; never a health claim. Without a key or a model, the card says what is missing.
 */
import { brain, headers } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { go } from '../../shell/tabs';
import { home } from '../../state/app';
import { button, toast } from '../../ui/components';
import { askWithImage } from '../../vision/ask';
import { toJpegBlob, toJpegDataUrl } from '../../vision/camera';
import { forgetImage, shareImage } from '../../vision/engines';
import { readCodes } from '../../scan/barcode';
import { classifyCode } from '../../scan/codes';
import type { LookupResult } from '../../../../../packages/shared/src/scan';
import {
  checkLiving,
  checkMeal,
  levelFromWords,
  livingCard,
  livingQuestion,
  mealCardLines,
  mealQuestion,
  plantQuestion,
  readPlantLine,
  seenMemory,
  type AskedKind,
  type Living,
  type MealTotal,
  type PlantLine,
} from '../../../../../packages/shared/src/living';
import type { LensContext } from './index';

/** What the card shows now, for a test (window.__ghosty.lens.card) and for describe(). */
export interface LensCard {
  what: '' | 'busy' | 'living' | 'meal' | 'missing' | 'problem';
  text: string;
}

const KEYS_HOW = 'SYSTEM → KEYS → Pl@ntNet: make a free account at my.plantnet.org, copy your API key from your account there, paste it in. Free, 500 plants a day.';

/** True when the phone already knows (without asking again) that it is within 1.5 km of home. */
async function nearHome(): Promise<boolean> {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (p?.state !== 'granted') return false;
    const pos = await new Promise<GeolocationPosition>((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { maximumAge: 600_000, timeout: 3000 }));
    const at = home();
    const k = Math.PI / 180;
    const dLat = (pos.coords.latitude - at.lat) * k;
    const dLon = (pos.coords.longitude - at.lon) * k * Math.cos(at.lat * k);
    return Math.hypot(dLat, dLon) * 6_371_000 < 1500;
  } catch {
    return false;
  }
}

export function createLiving(L: LensContext) {
  const S = L.state;
  const el = h('div.lenssel.livingcard', { 'aria-live': 'polite' });
  el.hidden = true;
  let busy = false;
  /** Bumped by clear(): an answer for a card already cleared is dropped. */
  let gen = 0;

  const show = (what: LensCard['what'], ...kids: (Node | string)[]) => {
    clear(el, ...kids);
    el.hidden = false;
    S.card = { what, text: el.textContent ?? '' };
    el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };
  const close = button('CLEAR', () => api.clear());
  const head = (t: string) => h('small.livinghead', t);

  /** A card that says what is missing and what to do about it. */
  const missing = (title: string, how: string, ...actions: HTMLButtonElement[]) => {
    show('missing', head(title), h('div.livinglead', how), h('div.row.wrap', ...actions, button('CLEAR', () => api.clear())));
    L.status(title.toLowerCase(), 'off');
  };
  const problem = (why: string) => {
    show('problem', head('NOT NAMED'), h('div.livinglead', why), h('div.row.wrap', button('CLEAR', () => api.clear())));
    L.status(why, 'off');
  };

  const livingShow = (l: Living, viaPlantNet: boolean) => {
    const c = livingCard(l);
    const kids: (Node | string)[] = [head(l.kind === 'person' ? 'A PERSON' : `NAME IT · ${viaPlantNet ? 'PLANT' : l.kind === 'none' ? 'LIVING THING' : l.kind.toUpperCase()}`)];
    if (c.title) kids.push(h('b.livingname', c.title));
    if (c.latin) kids.push(h('i.livinglatin', c.latin));
    kids.push(h('div.livinglead', c.lead));
    if (c.sure) kids.push(h('div.livingsure', c.sure));
    if (c.tell) kids.push(h('div.livingtell', c.tell));
    if (c.others) kids.push(h('div.note', c.others));
    kids.push(h('div.note', viaPlantNet ? 'Named by Pl@ntNet (free, 500 a day). The photo was not kept.' : `Named by ${c.by || 'Ghosty'} from the photo. Nothing is kept unless you press SAVE.`));
    const row = h('div.row.wrap');
    if (c.link) {
      const a = h('a.lnk', { href: c.link, target: '_blank', rel: 'noopener noreferrer' }, 'WIKIPEDIA');
      row.append(a);
    }
    if (c.canSave) {
      const save = button('SAVE', async (b) => {
        b.disabled = true;
        const text = seenMemory(l, new Date(), await nearHome());
        try {
          await brain.addMemory(text);
          b.textContent = 'SAVED';
          S.lastAction = `saved: ${text}`;
          toast(`Saved to Memory: ${text}`, 'ok');
        } catch (e) {
          b.disabled = false;
          toast(`Could not save it: ${String((e as Error)?.message ?? e)}`, 'bad');
        }
      }, 'warn');
      save.setAttribute('aria-label', 'Save to Memory as seen today');
      row.append(save);
    }
    row.append(close);
    kids.push(row);
    show('living', ...kids);
    L.status(c.title ? `${l.level === 'cant' ? 'not sure' : l.level}: ${c.title}` : "can't tell from this photo", c.title ? 'ok' : 'mid');
  };

  /** Pl@ntNet through the brain: the photo is held by id for a moment, the brain's identify_plant reads it and forgets it. */
  const plant = async (still: HTMLCanvasElement, g: number) => {
    let id = '';
    try {
      L.status('holding the photo for Pl@ntNet…', 'mid');
      id = (await shareImage(await toJpegBlob(still, 1_400_000, 1024), { fetch: (u, i) => fetch(u, i), headers })).id;
    } catch (e) {
      return problem(`Could not hand the photo over: ${String((e as Error)?.message ?? e)}`);
    }
    let line: PlantLine | null = null;
    try {
      L.status('asking Pl@ntNet…', 'mid');
      const r = await askWithImage(plantQuestion(id), null, (ev) => {
        if (ev.t === 'tool_result' && ev.name === 'identify_plant') line = readPlantLine(ev.summary) ?? line;
      }, { quiet: true });
      if (g !== gen) return;
      const got = line as PlantLine | null;
      if (!got) return problem(r.error ? `Ghosty could not run the plant check: ${r.error}` : 'Ghosty did not run the plant check this time: press PLANT again.');
      if ('missing' in got) {
        return missing(
          'PL@NTNET NEEDS ITS FREE KEY',
          `Plants are named by Pl@ntNet, which needs a free key. ${KEYS_HOW} Or let Ghosty's own model try.`,
          button('ADD THE KEY', () => go('system'), 'warn'),
          button('ASK GHOSTY INSTEAD', () => void api.nameIt('plant', still, true)),
        );
      }
      if ('error' in got) return problem(got.error);
      livingShow(got, true);
    } finally {
      // the brain forgets it as soon as it has read it; this makes sure it is gone whatever happened
      if (id) void forgetImage(id, { fetch: (u, i) => fetch(u, i), headers }).catch(() => undefined);
    }
  };

  /** The model that can see, asked for JSON about a bird, an insect, anything else (or a plant without Pl@ntNet). */
  const seeing = async (kind: AskedKind, still: HTMLCanvasElement, g: number) => {
    L.status('sending the photo to Ghosty…', 'mid');
    const r = await askWithImage(livingQuestion(kind), toJpegDataUrl(still, 1024, 0.8), undefined, { quiet: true });
    if (g !== gen) return;
    if (r.noVision) return noModel();
    if (!r.text) return problem(r.error ? `No answer: ${r.error}` : 'No answer came back: try again.');
    const l = checkLiving(r.text, r.model || 'Ghosty');
    if (!l) return problem("Ghosty's answer could not be read as a name: try again.");
    livingShow(l, false);
  };

  const noModel = () =>
    missing(
      'NO MODEL THAT CAN SEE IS FREE',
      'Naming from a photo needs a model that can see pictures, and none Ghosty can reach is free right now. A free Gemini key (SYSTEM → KEYS → Gemini) fixes it; or try again in a minute.',
      button('ADD A KEY', () => go('system'), 'warn'),
    );

  const mealShow = (m: MealTotal & { credit?: string }, said: string, exact: LookupResult | null) => {
    const lines = mealCardLines(m);
    const total = lines.pop() ?? '';
    const kids: (Node | string)[] = [head("WHAT'S IN IT"), h('b.livingname', m.line), h('div.livingsure', m.honesty)];
    kids.push(h('div.livinglist', ...lines.map((t) => h('div', t))));
    kids.push(h('div.note', total));
    if (said) kids.push(h('div.note', `The foods are ${mealWords(said)} right — the model said “${said}”.`));
    if (exact?.nutrition) {
      const n = exact.nutrition;
      kids.push(h('div.livingtell', `The barcode in the photo: ${exact.title}${exact.brand ? `, ${exact.brand}` : ''} — exact per 100 g: ${[n.kcal != null && `${n.kcal} kcal`, n.protein != null && `${n.protein} g protein`, n.carbs != null && `${n.carbs} g carbs`, n.fat != null && `${n.fat} g fat`].filter(Boolean).join(', ')} (Open Food Facts).`));
    }
    kids.push(h('div.note', `Figures per 100 g: USDA FoodData Central (public domain)${m.credit ? `; ${m.credit}` : ''}.`));
    kids.push(h('div.row.wrap', close));
    show('meal', ...kids);
    L.status(m.line, m.counted ? 'ok' : 'mid');
  };

  /** A product barcode in the photo, read on the phone, then its exact figures (or null). */
  const barcodeIn = async (still: HTMLCanvasElement): Promise<LookupResult | null> => {
    try {
      const code = (await readCodes(still, true)).map((c) => classifyCode(c.text, c.format)).find((c) => c.kind === 'product');
      if (!code?.code) return null;
      const r = await fetch(`/api/lookup/barcode?code=${encodeURIComponent(code.code)}`, { headers: headers(), credentials: 'same-origin' });
      const j = (await r.json().catch(() => null)) as LookupResult | null;
      return r.ok && j?.kind === 'product' ? j : null;
    } catch {
      return null;
    }
  };

  const api = {
    el,
    busy: () => busy,
    /** NAME IT: `kind` plant → Pl@ntNet (unless `viaModel`), anything else → the model that can see. */
    async nameIt(kind: AskedKind, still: HTMLCanvasElement, viaModel = false) {
      if (busy) return;
      busy = true;
      const g = ++gen;
      S.lastAction = `name it: ${kind}`;
      show('busy', head('NAME IT'), h('div.livinglead', kind === 'plant' && !viaModel ? 'Asking Pl@ntNet…' : 'Ghosty is looking…'));
      try {
        if (kind === 'plant' && !viaModel) await plant(still, g);
        else await seeing(kind, still, g);
      } catch (e) {
        if (g === gen) problem(String((e as Error)?.message ?? e));
      } finally {
        busy = false;
      }
    },
    /** WHAT'S IN IT: the foods, matched, and the rough total. */
    async whatsInIt(still: HTMLCanvasElement) {
      if (busy) return;
      busy = true;
      const g = ++gen;
      S.lastAction = "what's in it";
      show('busy', head("WHAT'S IN IT"), h('div.livinglead', 'Ghosty is looking at the food…'));
      try {
        L.status('sending the photo to Ghosty…', 'mid');
        const [r, exact] = await Promise.all([askWithImage(mealQuestion(), toJpegDataUrl(still, 1024, 0.8), undefined, { quiet: true }), barcodeIn(still)]);
        if (g !== gen) return;
        if (r.noVision) return noModel();
        const seen = r.text ? checkMeal(r.text) : null;
        if (!seen) return problem(r.error ? `No answer: ${r.error}` : "Ghosty's answer could not be read as a list of foods: try again.");
        if (!seen.foods.length) return show('meal', head("WHAT'S IN IT"), h('div.livinglead', "I can't tell from this photo: no food I could name. Try closer, from above, in good light."), h('div.row.wrap', close));
        L.status('matching the foods…', 'mid');
        const res = await fetch('/api/lookup/barcode', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ meal: seen.foods }), credentials: 'same-origin' });
        const m = (await res.json().catch(() => ({}))) as MealTotal & { credit?: string; error?: string };
        if (g !== gen) return;
        if (!res.ok || !Array.isArray(m.items)) return problem(`Could not match the foods: ${m.error ?? `HTTP ${res.status}`}`);
        mealShow(m, seen.said, exact);
      } catch (e) {
        if (g === gen) problem(String((e as Error)?.message ?? e));
      } finally {
        busy = false;
      }
    },
    clear() {
      gen++;
      busy = false;
      el.hidden = true;
      clear(el);
      S.card = { what: '', text: '' };
    },
  };
  return api;
}

/** The model's words about the foods → how the card says it. */
function mealWords(said: string): string {
  const l = levelFromWords(said);
  return l === 'sure' ? 'most likely' : l === 'probably' ? 'probably' : 'only guessed';
}
