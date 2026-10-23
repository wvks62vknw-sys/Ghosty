/**
 * What a model is asked, and how its answers are checked before they touch the site: the planner picks
 * the look and trims the page plan; the writer rewrites the words of one page in the business's own
 * voice; the critic reads screenshots or the layout analysis and proposes fixes. Every answer is JSON,
 * read leniently and applied strictly — only to known slots, within each slot's length, and never adding
 * a number (a price, a year, a rating) that is not already in the owner's facts. Pure; used by the brain
 * and by the phone's offline brain alike.
 */
import { BLOCKS } from './blocks';
import { CLICHES, unsupportedClaims } from './gates';
import { FONTS, PALETTES, SHAPES } from './tokens';
import type { Brief, FontsId, PaletteId, Plan, Scheme, ShapeId, Slot } from './types';

/** The keys a writer may rewrite: words, never facts (names, prices, quotes, links, times). */
const EDITABLE = new Set(['eyebrow', 'title', 'lead', 'text', 'intro', 'body', 'card', 'points', 'q', 'a', 'note', 'blurb', 'caption', 'formTitle', 'summary', 'excerpt']);

export interface Editable {
  /** Where it lives: ['pages', 0, 'sections', 2, 'data', 'items', 1, 'text']. */
  path: (string | number)[];
  text: string;
  max: number;
}

/** The slot type at a data path in a block (for the length limit). */
function slotAt(slots: Record<string, Slot>, keys: (string | number)[]): Slot | undefined {
  let cur: Slot | undefined = { t: 'list', of: slots, max: 1 };
  for (const k of keys) {
    if (!cur) return undefined;
    if (typeof k === 'number') {
      if (cur.t !== 'list' && cur.t !== 'texts') return undefined;
      if (cur.t === 'texts') return { t: 'text', max: cur.each };
      continue;
    }
    cur = cur.t === 'list' ? cur.of[k] : undefined;
  }
  return cur;
}

/** Every rewritable piece of text on a page (or in the footer when page is -1). */
export function editables(plan: Plan, page: number): Editable[] {
  const out: Editable[] = [];
  const secs = page < 0 ? plan.footer : plan.pages[page]?.sections ?? [];
  const root = page < 0 ? ['footer'] : ['pages', page, 'sections'];
  secs.forEach((s, si) => {
    const def = BLOCKS[s.block];
    if (!def) return;
    const walk = (v: unknown, keys: (string | number)[]) => {
      if (typeof v === 'string') {
        const key = [...keys].reverse().find((k) => typeof k === 'string') as string | undefined;
        if (!key || !EDITABLE.has(key)) return;
        const slot = slotAt(def.slots, keys);
        const max = slot && 'max' in slot && slot.t === 'text' ? slot.max : slot?.t === 'texts' ? slot.each : 200;
        if (v.trim()) out.push({ path: [...root, si, 'data', ...keys], text: v, max });
      } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...keys, i]));
      else if (v && typeof v === 'object' && !('src' in (v as object)) && !('href' in (v as object))) for (const [k, x] of Object.entries(v)) walk(x, [...keys, k]);
    };
    walk(s.data, []);
  });
  return out;
}

/** The facts the owner gave, as plain lines (what the writers may build on). */
export function factLines(b: Brief): string {
  const l: string[] = [`Business: ${b.name} (${b.kind})`];
  if (b.town) l.push(`Town: ${b.town}`);
  if (b.address || b.postcode) l.push(`Address: ${[b.address, b.postcode].filter(Boolean).join(', ')}`);
  if (b.established) l.push(`Established: ${b.established}`);
  if (b.about) l.push(`In the owner's words: ${b.about}`);
  if (b.extras) l.push(`Also said: ${b.extras}`);
  if (b.services?.length) l.push(`Services: ${b.services.map((s) => `${s.name}${s.price ? ` ${s.price}` : ''}`).join('; ')}`);
  if (b.hours?.length) l.push(`Hours: ${b.hours.map((h) => `${h.label} ${h.closed ? 'closed' : `${h.open}–${h.close}`}`).join('; ')}`);
  if (b.accreditations?.length) l.push(`Accreditations: ${b.accreditations.join(', ')}`);
  if (b.areas?.length) l.push(`Areas: ${b.areas.join(', ')}`);
  if (b.request) l.push(`The request: ${b.request}`);
  return l.join('\n');
}

const STYLE_RULES = `Write like a good local copywriter: short sentences, concrete details, British English, warm and confident. No exclamation marks, no emoji, no clichés (never: ${CLICHES.slice(0, 14).join(', ')}). Never invent facts: no new prices, numbers, years, awards, names, reviews or promises that are not in the facts. Keep *asterisks* around one word of a title for the accent if it had them.`;

/** The writer's request for one page: the facts, the voice, and the pieces as a numbered JSON object. */
export function writePrompt(plan: Plan, b: Brief, page: number): { system: string; user: string; pieces: Editable[] } {
  const pieces = editables(plan, page);
  const p = plan.pages[page];
  const obj = Object.fromEntries(pieces.map((x, i) => [String(i), x.text]));
  const limits = pieces.map((x, i) => `${i}≤${x.max}`).join(' ');
  return {
    pieces,
    system: `SITE WRITER. You improve the words of one page of a small business website. ${STYLE_RULES} Reply with ONLY a JSON object with the same keys and your new text for each (keep a key's text when it is already good). Character limits per key: ${limits}.`,
    user: `FACTS (the only facts you may use):\n${factLines(b)}\n\nVOICE: ${plan.tone}\nPAGE: ${p?.label ?? 'Footer'}\n\nTEXT TO IMPROVE (JSON):\n${JSON.stringify(obj)}`,
  };
}

/** The first JSON object in a model's reply (fences and chatter around it ignored). */
export function jsonIn(reply: string): Record<string, unknown> | null {
  const t = reply.replace(/```(?:json)?/gi, '');
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let q = '';
  for (let i = start; i < t.length; i++) {
    const c = t[i]!;
    if (q) {
      if (c === '\\') i++;
      else if (c === q) q = '';
      continue;
    }
    if (c === '"') q = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        const v = JSON.parse(t.slice(start, i + 1));
        return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

const digits = (s: string) => s.match(/\d+(?:[.,]\d+)*/g) ?? [];

/** Numbers already allowed: everything in the facts and in the text being replaced. */
const allowedNumbers = (b: Brief, old: string) => new Set([...digits(JSON.stringify(b)), ...digits(old)].map((d) => d.replace(/,/g, '')));

/** Why a rewrite is refused ('' when it may be used). */
export function rejectRewrite(old: string, next: unknown, max: number, b: Brief): string {
  if (typeof next !== 'string') return 'not text';
  const n = next.trim();
  if (!n) return 'empty';
  if (n.length > Math.ceil(max * 1.1)) return `too long (${n.length} > ${max})`;
  if (/[<>]|https?:|\{\{|lorem|\[[^\]]*\]/i.test(n)) return 'markup, links or placeholders';
  const ok = allowedNumbers(b, old);
  const fresh = digits(n).filter((d) => !ok.has(d.replace(/,/g, '')));
  if (fresh.length) return `adds numbers not in the facts (${fresh.join(', ')})`;
  const low = n.toLowerCase();
  // A claim (registered, insured, award-winning, rated, thousands of…) only when the owner made it.
  const claims = unsupportedClaims(n, `${factLines(b)}\n${old}`);
  if (claims.length) return `adds a claim the owner did not make (${claims.join(', ')})`;
  const c = CLICHES.find((x) => low.includes(x) && !old.toLowerCase().includes(x));
  if (c) return `stock phrase "${c}"`;
  if (/!/.test(n) && !/!/.test(old)) return 'exclamation mark';
  return '';
}

function setAt(root: Record<string, unknown>, path: (string | number)[], value: string): void {
  let cur: unknown = root;
  for (const k of path.slice(0, -1)) cur = (cur as Record<string | number, unknown>)[k];
  (cur as Record<string | number, unknown>)[path[path.length - 1]!] = value;
}

/** Apply a writer's answer: returns how many pieces changed and why others were refused. */
export function applyWrites(plan: Plan, pieces: Editable[], answer: Record<string, unknown> | null, b: Brief): { changed: number; refused: string[] } {
  if (!answer) return { changed: 0, refused: ['no JSON in the reply'] };
  let changed = 0;
  const refused: string[] = [];
  pieces.forEach((p, i) => {
    const next = answer[String(i)];
    if (next === undefined || next === p.text) return;
    const why = rejectRewrite(p.text, next, p.max, b);
    if (why) refused.push(`${i}: ${why}`);
    else {
      setAt(plan as unknown as Record<string, unknown>, p.path, (next as string).trim());
      changed++;
    }
  });
  return { changed, refused };
}

// ── the planner ─────────────────────────────────────────────────────────────────────

export function planPrompt(plan: Plan, b: Brief): { system: string; user: string } {
  const pages = plan.pages.map((p) => `${p.label || 'Home'}: ${p.sections.map((s) => s.block).join(', ')}`).join('\n');
  return {
    system: `SITE PLANNER. You art-direct a small business website. Choose the look and trim the plan. Reply with ONLY JSON: {"palette": one of ${Object.keys(PALETTES).join('|')}, "fonts": one of ${Object.keys(FONTS).join('|')}, "shape": one of ${Object.keys(SHAPES).join('|')}, "scheme": "light"|"dark"|"auto", "tone": "three words for the voice", "drop": ["block ids to remove from the home page, at most 2"], "why": "one sentence"}. Palettes: ${Object.values(PALETTES).map((p) => `${p.id} (${p.label.split(':')[1]?.trim()})`).join('; ')}. Fonts: ${Object.values(FONTS).map((f) => `${f.id} (${f.label.split(':')[1]?.trim()})`).join('; ')}.`,
    user: `FACTS:\n${factLines(b)}\n\nCURRENT LOOK: ${plan.theme.palette}, ${plan.theme.fonts}, ${plan.theme.shape}, ${plan.theme.scheme}; voice "${plan.tone}"\nPAGES AND SECTIONS:\n${pages}`,
  };
}

/** Apply the planner's choice where it is valid; never drops the hero, the nav or the last contact route. */
export function applyPlan(plan: Plan, answer: Record<string, unknown> | null): string[] {
  if (!answer) return ['no JSON in the reply'];
  const notes: string[] = [];
  const pal = String(answer.palette ?? '') as PaletteId;
  const fon = String(answer.fonts ?? '') as FontsId;
  const sha = String(answer.shape ?? '') as ShapeId;
  const sch = String(answer.scheme ?? '') as Scheme;
  if (PALETTES[pal]) plan.theme.palette = pal;
  if (FONTS[fon]) plan.theme.fonts = fon;
  if (SHAPES[sha]) plan.theme.shape = sha;
  if (['light', 'dark', 'auto'].includes(sch)) plan.theme.scheme = sch;
  if (typeof answer.tone === 'string' && answer.tone.trim() && answer.tone.length < 60 && !/[<>]/.test(answer.tone)) plan.tone = answer.tone.trim();
  const drop = Array.isArray(answer.drop) ? answer.drop.filter((x): x is string => typeof x === 'string').slice(0, 2) : [];
  const home = plan.pages[0];
  if (home)
    for (const id of drop) {
      const def = BLOCKS[id];
      if (!def || def.group === 'hero' || def.group === 'nav' || def.group === 'footer' || id === 'map' || id === 'contact-form') {
        notes.push(`kept ${id}`);
        continue;
      }
      const before = home.sections.length;
      home.sections = home.sections.filter((s) => s.block !== id);
      if (home.sections.length < before) notes.push(`dropped ${id}`);
    }
  return notes;
}

// ── the critic ──────────────────────────────────────────────────────────────────────

export interface Fix {
  /** Which page ('' home) and which section index the fix is about (or -1 for the whole site). */
  page: string;
  section: number;
  /** "text": rewrite a slot; "drop": remove the section; "tone": change its background; "theme": change the look. */
  kind: 'text' | 'drop' | 'tone' | 'theme';
  key?: string;
  value?: string;
  why: string;
}

export function critiquePrompt(plan: Plan, b: Brief, analysis: string, screenshots: boolean): { system: string; user: string } {
  const map = plan.pages.map((p) => `${p.slug || 'home'}: ${p.sections.map((s, i) => `${i}=${s.block}`).join(' ')}`).join('\n');
  return {
    system: `SITE CRITIC. You are a senior web designer reviewing a small business website before launch${screenshots ? ' from screenshots of it on a phone (390 px) and a laptop (1280 px)' : ' from an analysis of its layout (no screenshots were possible)'}. Be specific and only flag what a visitor would notice: crowding, weak headlines, text over busy pictures, repetition, too many sections, missing trust or contact, anything broken. Reply with ONLY JSON: {"verdict": "one sentence", "score": 0-10, "fixes": [{"page": "home or a page slug", "section": index, "kind": "text"|"drop"|"tone"|"theme", "key": "the slot (for text) or palette/fonts/scheme (for theme)", "value": "new text, or base|alt|inverse for tone, or the new value for theme", "why": "short"}]} with at most 6 fixes. ${STYLE_RULES}`,
    user: `FACTS:\n${factLines(b)}\n\nLOOK: ${plan.theme.palette} palette, ${plan.theme.fonts} fonts, ${plan.theme.scheme} scheme\nSECTIONS:\n${map}\n\nCHECKS:\n${analysis}`,
  };
}

/** Apply the critic's fixes that are safe; the rest are reported. */
export function applyFixes(plan: Plan, b: Brief, answer: Record<string, unknown> | null): { applied: string[]; skipped: string[]; verdict: string; score?: number } {
  const applied: string[] = [];
  const skipped: string[] = [];
  if (!answer) return { applied, skipped: ['no JSON in the reply'], verdict: '' };
  const fixes = Array.isArray(answer.fixes) ? (answer.fixes as Record<string, unknown>[]).slice(0, 6) : [];
  for (const f of fixes) {
    const slug = String(f.page ?? 'home').replace(/^home$/i, '').replace(/^#?\/?/, '');
    const page = plan.pages.find((p) => p.slug === slug);
    const idx = Number(f.section);
    const s = page && Number.isInteger(idx) ? page.sections[idx] : undefined;
    const why = String(f.why ?? '').slice(0, 120);
    const kind = String(f.kind ?? '');
    if (kind === 'theme') {
      const key = String(f.key ?? '');
      const v = String(f.value ?? '');
      if (key === 'palette' && PALETTES[v as PaletteId]) plan.theme.palette = v as PaletteId;
      else if (key === 'fonts' && FONTS[v as FontsId]) plan.theme.fonts = v as FontsId;
      else if (key === 'scheme' && ['light', 'dark', 'auto'].includes(v)) plan.theme.scheme = v as Scheme;
      else {
        skipped.push(`theme ${key}=${v}`);
        continue;
      }
      applied.push(`look: ${key} → ${v} (${why})`);
      continue;
    }
    if (!page || !s) {
      skipped.push(`no section ${f.page}/${f.section}`);
      continue;
    }
    const def = BLOCKS[s.block];
    if (kind === 'drop') {
      if (!def || def.group === 'hero' || s.block === 'contact-form' || s.block === 'booking-form' || s.block === 'map') skipped.push(`kept ${s.block}`);
      else {
        page.sections.splice(idx, 1);
        applied.push(`removed ${s.block} from ${page.label} (${why})`);
      }
    } else if (kind === 'tone') {
      const v = String(f.value ?? '');
      if (['base', 'alt', 'inverse'].includes(v)) {
        s.tone = v as 'base' | 'alt' | 'inverse';
        applied.push(`${s.block} on ${page.label}: ${v} background (${why})`);
      } else skipped.push(`tone ${v}`);
    } else if (kind === 'text') {
      const key = String(f.key ?? '');
      const slot = def?.slots[key];
      if (!def || !EDITABLE.has(key) || !slot || slot.t !== 'text' || typeof s.data[key] !== 'string') {
        skipped.push(`text ${s.block}.${key}`);
        continue;
      }
      const why2 = rejectRewrite(s.data[key] as string, f.value, slot.max, b);
      if (why2) skipped.push(`${s.block}.${key}: ${why2}`);
      else {
        s.data[key] = String(f.value).trim();
        applied.push(`${s.block}.${key} on ${page.label} rewritten (${why})`);
      }
    } else skipped.push(`unknown fix ${kind}`);
  }
  return { applied, skipped, verdict: String(answer.verdict ?? '').slice(0, 300), ...(typeof answer.score === 'number' ? { score: answer.score } : {}) };
}
