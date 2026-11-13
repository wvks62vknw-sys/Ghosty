/**
 * THE BRAIN'S HANDS ON THE FOUR OTHER EDITORS (BRIEF-KERNEL-3): `slides`, `videoedit`, `workspace` and `game`, each the pattern of
 * `document` (tools/document.ts): the editor open on his phone is the turn's data (packages/shared/src/openwork.ts), read back here
 * from this turn's stored message, so the brain keeps no copy and reaches nothing that is not open. `read` and `search` look; every
 * change is a PROPOSAL sent to the phone as a client event, shown in the editor as a marked change his tap accepts or rejects. The
 * brain applies nothing, starts no export, publishes nothing; the game tool builds from the studio's own kit (no model draws a
 * sprite or a tile) and the phone keeps it in the studio's library; only publish_game (tools/sites.ts), with his APPROVE, puts one on his sites.
 */
import type { ChatTurn } from '../../../../packages/shared/src/protocol';
import { one, num, parseOpenWork, secondsWord, workLine, WORK_WHEN, type OpenWork, type WorkKind, type WorkLine } from '../../../../packages/shared/src/openwork';
import { THEME_KEYS } from '../../../web/src/slides/themes';
import { deckFromMarkdown } from '../../../web/src/slides/fromreport';
import { MAX_H, MAX_W, MIN_H, MIN_W } from '../../../web/src/studio-game/model';
import { checked, gameFromChat, gameSummary } from '../../../web/src/studio-game/chat';
import type { Tool, ToolContext } from './types';

const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const none = (what: string): string => `No ${what} is open on his phone right now (or this message carried none). Tell him to open it first; you cannot reach any other.`;

async function turnsOf(ctx: ToolContext): Promise<ChatTurn[]> {
  return (await ctx.storage.get<ChatTurn[]>('turns').catch(() => undefined)) ?? [];
}
/** The editor he has open, from his latest message (a stale one from an earlier message is not trusted). */
async function openWork(ctx: ToolContext, kind: WorkKind): Promise<{ head: WorkLine; lines: WorkLine[]; raw: OpenWork } | null> {
  const last = [...(await turnsOf(ctx))].reverse().find((t) => t.role === 'user');
  const w = last ? parseOpenWork(last.text, kind) : null;
  const head = w ? workLine(w.head) : null;
  return w && head ? { head, lines: w.lines.map(workLine).filter((l): l is WorkLine => !!l), raw: w } : null;
}
const asNumber = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : null);
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '');
const more = (w: { raw: OpenWork }): string => (w.raw.more ? `\n(${w.raw.more} more lines were not sent with this message.)` : '');
const PROPOSED = 'NOTHING is changed until he taps ACCEPT in the editor; REJECT leaves it as it was. Tell him it is there.';

// ================================================================ slides

const slidesOf = (w: { lines: WorkLine[] }) => w.lines.filter((l) => l.tag === 'slide').map((l) => ({ n: Number(l.id), layout: one(l, 'layout'), title: one(l, 'title'), body: l.f.b ?? [] }));

/** A deck as the shape the phone will build from the same words (the same code PRESENTATIONS uses). */
export function deckShape(words: string, title = ''): { title: string; slides: { layout: string; title: string; bullets: number }[] } {
  const d = deckFromMarkdown(words, { title, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }, 'a reply');
  return { title: d.title, slides: d.slides.map((s) => ({ layout: s.layout, title: s.title.runs.map((r) => r.text).join(''), bullets: s.body.length })) };
}

export const slidesTools: Tool[] = [
  {
    name: 'slides',
    description:
      'The ONE deck open on his phone (Presentations). read: its outline. edit: ONE change per call, as a proposal he accepts or rejects: slide + title and/or body (lines); add_after (a slide number) + title/body; remove (a slide number); theme. make: slides from text (default your last reply) opens a new deck, unpublished.',
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['read', 'edit', 'make'] },
        slide: { type: 'number', description: 'edit: the slide number, as in read' },
        title: { type: 'string', description: 'edit: the slide\'s new title; make: the deck\'s title' },
        body: { type: 'string', description: 'edit: the slide\'s new body, one line each' },
        add_after: { type: 'number', description: 'edit: add a slide after this number (0 for first)' },
        remove: { type: 'number', description: 'edit: the slide number to remove' },
        theme: { type: 'string', description: `edit: one of ${THEME_KEYS.join(', ')}` },
        text: { type: 'string', description: 'make: the report or reply, with headings' },
      },
      required: ['op'],
    },
    risk: 'auto',
    pure: (a) => a.op === 'read',
    async run(a, ctx) {
      const op = String(a.op ?? '');
      if (!['read', 'edit', 'make'].includes(op)) throw new Error('op is read, edit or make');
      if (op === 'make') {
        const given = text(a.text, 30000);
        const words = given || [...(await turnsOf(ctx))].reverse().find((t) => t.role === 'assistant')?.text.slice(0, 30000) || '';
        const shape = deckShape(words, text(a.title, 80));
        if (shape.slides.length < 3) throw new Error('there is nothing in that to make slides of: it needs a title and some sections with headings');
        ctx.emit({ t: 'client', name: 'open_slides', args: { report: { text: words, title: text(a.title, 80) } } });
        return `A deck of ${shape.slides.length} slides is open on his phone: "${shape.title}", from ${shape.slides.slice(0, 5).map((s) => `"${s.title}"`).join(', ')}${shape.slides.length > 5 ? ' and more' : ''}. It is his to edit; nothing is published or exported. Tell him it is there.`;
      }
      const w = await openWork(ctx, 'slides');
      if (!w) return none('deck');
      const slides = slidesOf(w);
      if (op === 'read') {
        return [`"${one(w.head, 'title')}": ${slides.length} slides, theme ${one(w.head, 'theme')}.`, ...slides.map((s) => `[${s.n}] ${s.layout}: ${s.title || '(no title)'}${s.body[0] ? ` / ${s.body[0]}` : ''}`)].join('\n') + more(w);
      }
      const count = slides.length;
      const at = (v: unknown, name: string): { n: number; s: (typeof slides)[number] } => {
        const n = asNumber(v);
        const s = slides.find((x) => x.n === n);
        if (n === null || !s) throw new Error(`no such slide: ${name} is 1 to ${count}`);
        return { n, s };
      };
      const title = text(a.title, 120).replace(/\n+/g, ' ');
      const body = text(a.body, 1500);
      const lines = body ? body.split('\n').map((l) => flat(l.replace(/^[-*•]\s*/, ''))).filter(Boolean).slice(0, 8) : [];
      if (a.theme !== undefined && a.theme !== '') {
        const theme = String(a.theme).toLowerCase().trim();
        if (!(THEME_KEYS as readonly string[]).includes(theme)) throw new Error(`no such theme: ${THEME_KEYS.join(', ')}`);
        if (theme === one(w.head, 'theme')) return 'That is the theme it already has: no change proposed.';
        ctx.emit({ t: 'client', name: 'slides', args: { change: 'theme', theme, old: one(w.head, 'theme') } });
        return `Proposed to him: the ${theme} theme for the deck. ${PROPOSED}`;
      }
      if (a.remove !== undefined && a.remove !== null && a.remove !== '') {
        const { n, s } = at(a.remove, 'remove');
        if (count < 2) throw new Error('a deck keeps at least one slide');
        ctx.emit({ t: 'client', name: 'slides', args: { change: 'remove', slide: n, old: s.title } });
        return `Proposed to him: slide ${n} ("${s.title}") taken out. ${PROPOSED}`;
      }
      if (a.add_after !== undefined && a.add_after !== null && a.add_after !== '') {
        const after = asNumber(a.add_after);
        if (after === null || after < 0 || after > count) throw new Error(`add_after is 0 to ${count}`);
        if (!title && !lines.length) throw new Error('give the new slide a title or a body');
        ctx.emit({ t: 'client', name: 'slides', args: { change: 'add', after, title, body: lines.join('\n') } });
        return `Proposed to him: a new slide after slide ${after}${title ? ` ("${title}")` : ''}. ${PROPOSED}`;
      }
      const { n, s } = at(a.slide, 'slide');
      if (!title && !lines.length) throw new Error('give the new title or body');
      if (title && flat(title) !== flat(s.title)) {
        ctx.emit({ t: 'client', name: 'slides', args: { change: 'title', slide: n, old: s.title, text: title } });
        if (lines.length) ctx.emit({ t: 'client', name: 'slides', args: { change: 'body', slide: n, old: s.body.join('\n'), text: lines.join('\n') } });
        return `Proposed to him as a marked change to slide ${n}'s title (the old words "${s.title}", the new "${title}"). ${PROPOSED}`;
      }
      if (lines.length && flat(lines.join(' ')) !== flat(s.body.join(' '))) {
        ctx.emit({ t: 'client', name: 'slides', args: { change: 'body', slide: n, old: s.body.join('\n'), text: lines.join('\n') } });
        return `Proposed to him as a marked change to slide ${n}'s body. ${PROPOSED}`;
      }
      return 'That is how it already reads: no change proposed.';
    },
  },
];
export const SLIDES_ABOUT = 'You can read and change the one deck he has open in Presentations (slides: read, edit, make); a change is only proposed, marked for him to accept or reject. It comes with his message.';
export const SLIDES_WHEN = WORK_WHEN.slides;

// ================================================================ videoedit

interface ClipRow { n: number; src: string; inMs: number; outMs: number; len: number; speed: number; flags: string[]; next: string; nextLen: number }
const clipsOf = (w: { lines: WorkLine[] }): ClipRow[] =>
  w.lines.filter((l) => l.tag === 'clip').map((l) => ({ n: Number(l.id), src: one(l, 'src'), inMs: num(l, 'in'), outMs: num(l, 'out'), len: num(l, 'len'), speed: num(l, 'speed') || 1, flags: one(l, 'flags').split(',').filter(Boolean), next: one(l, 'next') || 'cut', nextLen: num(l, 'nextlen') }));
const KINDS = ['cut', 'crossfade', 'dip', 'wipe', 'slide'];
const EXPORT_NO = 'I never start an export: it only starts when you tap EXPORT in the Video editor, with the size said there. Open the video project and tap it when you are ready.';

export const videoeditTools: Tool[] = [
  {
    name: 'videoedit',
    description:
      'The ONE video project open on his phone (Video). read: clips in order with lengths in seconds, music, subtitles. edit: ONE change per call (change = trim, swap, remove, transition, music, subtitles, steady, best, beat, reverse, ramp) as a proposal on the timeline; times in seconds. export is never started: only his tap.',
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['read', 'edit', 'export'] },
        change: { type: 'string', enum: ['trim', 'swap', 'remove', 'transition', 'music', 'subtitles', 'steady', 'best', 'beat', 'reverse', 'ramp'] },
        clip: { type: 'number', description: 'the clip number, as in read (1 is first)' },
        with: { type: 'number', description: 'swap: the other clip number' },
        from: { type: 'number', description: 'trim: keep from this many seconds into the clip (default 0)' },
        to: { type: 'number', description: 'trim: keep up to this many seconds into the clip' },
        kind: { type: 'string', description: `transition into the next clip: ${KINDS.join(', ')}` },
        seconds: { type: 'number', description: 'transition: its length; best: the target length of the cut' },
        track: { type: 'string', description: 'music: the name of an audio file already in the project' },
        on: { type: 'boolean', description: 'subtitles: true to write them, false to take them off' },
        ramp_to: { type: 'number', description: 'ramp: the speed the clip ends at, 0.25 to 4 (it starts at 1)' },
      },
      required: ['op'],
    },
    risk: 'auto',
    pure: (a) => a.op === 'read' || a.op === 'export',
    async run(a, ctx) {
      const op = String(a.op ?? '');
      if (!['read', 'edit', 'export'].includes(op)) throw new Error('op is read, edit or export');
      if (op === 'export') return EXPORT_NO;
      const w = await openWork(ctx, 'video');
      if (!w) return none('video project');
      const clips = clipsOf(w);
      const music = w.lines.filter((l) => l.tag === 'music');
      const audio = w.lines.filter((l) => l.tag === 'audio');
      const subs = w.lines.find((l) => l.tag === 'subs');
      if (op === 'read') {
        return [
          `"${one(w.head, 'name')}": ${clips.length} clip${clips.length === 1 ? '' : 's'}, ${secondsWord(num(w.head, 'len'))} in all.`,
          ...clips.map((c) => `[${c.n}] ${c.src}: ${secondsWord(c.len)}${c.speed !== 1 ? `, speed ${c.speed}` : ''}${c.flags.length ? `, ${c.flags.join(', ')}` : ''}${c.next !== 'cut' ? `, ${c.next} of ${secondsWord(c.nextLen)} into the next` : ''}`),
          music.length ? `Music: ${music.map((m) => `${one(m, 'name')} (${secondsWord(num(m, 'len'))})`).join(', ')}.` : 'No music.',
          subs ? `Subtitles: ${subs.id} line${subs.id === '1' ? '' : 's'}, the first "${one(subs, 'first')}".` : 'No subtitles.',
          audio.length ? `Audio in the project: ${audio.map((x) => one(x, 'name')).join(', ')}.` : '',
        ].filter(Boolean).join('\n') + more(w);
      }
      const change = String(a.change ?? '');
      if (!['trim', 'swap', 'remove', 'transition', 'music', 'subtitles', 'steady', 'best', 'beat', 'reverse', 'ramp'].includes(change)) throw new Error('change is trim, swap, remove, transition, music, subtitles, steady, best, beat, reverse or ramp');
      const needClip = (v: unknown): ClipRow => {
        const n = asNumber(v);
        const c = clips.find((x) => x.n === n);
        if (n === null || !c) throw new Error(`no such clip: give clip 1 to ${clips.length}`);
        return c;
      };
      const send = (args: Record<string, unknown>, said: string): string => {
        ctx.emit({ t: 'client', name: 'videoedit', args: { change, ...args } });
        return `Proposed to him on the timeline: ${said}. ${PROPOSED}`;
      };
      if (change === 'trim') {
        const c = needClip(a.clip);
        const from = typeof a.from === 'number' && Number.isFinite(a.from) ? Math.max(0, a.from) : 0;
        const to = typeof a.to === 'number' && Number.isFinite(a.to) ? a.to : NaN;
        if (!Number.isFinite(to)) throw new Error('give "to": the seconds into the clip to keep up to');
        if (to * 1000 > c.len + 50) throw new Error(`clip ${c.n} is only ${secondsWord(c.len)} long`);
        if ((to - from) * 1000 < 200) throw new Error('keep at least 0.2 seconds');
        if (from === 0 && Math.abs(to * 1000 - c.len) < 50) return `Clip ${c.n} is already ${secondsWord(c.len)}: no change proposed.`;
        return send({ clip: c.n, from, to }, `clip ${c.n} trimmed to ${secondsWord(from * 1000)} to ${secondsWord(to * 1000)} of its ${secondsWord(c.len)}`);
      }
      if (change === 'swap') {
        const c = needClip(a.clip);
        const d = needClip(a.with);
        if (c.n === d.n) throw new Error('swap two different clips');
        return send({ clip: c.n, with: d.n }, `clips ${c.n} and ${d.n} swapped`);
      }
      if (change === 'remove') {
        const c = needClip(a.clip);
        if (clips.length < 2) throw new Error('a project keeps at least one clip');
        return send({ clip: c.n }, `clip ${c.n} (${secondsWord(c.len)}) taken out`);
      }
      if (change === 'transition') {
        const c = needClip(a.clip);
        if (c.n === clips.length) throw new Error('the last clip has no next clip to join');
        const kind = String(a.kind ?? '').toLowerCase();
        if (!KINDS.includes(kind)) throw new Error(`kind is one of ${KINDS.join(', ')}`);
        const s = typeof a.seconds === 'number' && Number.isFinite(a.seconds) ? Math.max(0.1, Math.min(3, a.seconds)) : 0.5;
        return send({ clip: c.n, kind, seconds: kind === 'cut' ? 0 : s }, kind === 'cut' ? `a plain cut from clip ${c.n} to clip ${c.n + 1}` : `a ${kind} of ${secondsWord(s * 1000)} from clip ${c.n} to clip ${c.n + 1}`);
      }
      if (change === 'music') {
        const name = text(a.track, 120);
        const hit = audio.find((x) => one(x, 'name').toLowerCase() === name.toLowerCase()) ?? audio.find((x) => name && one(x, 'name').toLowerCase().includes(name.toLowerCase()));
        if (!hit) throw new Error(audio.length ? `no such audio in the project: ${audio.map((x) => one(x, 'name')).join(', ')}` : 'there is no audio file in the project: he adds music with ADD MUSIC first');
        return send({ track: one(hit, 'name') }, `${one(hit, 'name')} (${secondsWord(num(hit, 'len'))}) as the music`);
      }
      if (change === 'subtitles') {
        const on = a.on === true || a.on === 'true';
        if (!on && !subs) return 'There are no subtitles to take off: no change proposed.';
        if (on && subs) return `The subtitles are already on: ${subs.id} lines.`;
        return send({ on }, on ? 'subtitles written from the clip’s sound (his tap opens the SUBTITLES tray; the sound goes to the brain only when he taps FROM MY BRAIN)' : `the ${subs!.id} subtitle line${subs!.id === '1' ? '' : 's'} taken off`);
      }
      if (change === 'steady') {
        const c = needClip(a.clip);
        return send({ clip: c.n }, `clip ${c.n} (${secondsWord(c.len)}) steadied on his phone`);
      }
      if (change === 'best') {
        const s = typeof a.seconds === 'number' && Number.isFinite(a.seconds) ? a.seconds : NaN;
        if (!(s >= 1 && s <= 600)) throw new Error('give seconds: the target length, 1 to 600');
        return send({ seconds: s }, `the best ${secondsWord(s * 1000)} chosen from the clips (he ticks the stretches before the cut is made)`);
      }
      if (change === 'beat') {
        if (!music.length) throw new Error('there is no music on the timeline to find a beat in');
        return send({}, 'the cuts moved on to the music’s beat');
      }
      if (change === 'reverse') {
        const c = needClip(a.clip);
        return send({ clip: c.n }, `clip ${c.n} (${secondsWord(c.len)}) played backwards`);
      }
      const c = needClip(a.clip);
      const to = typeof a.ramp_to === 'number' && Number.isFinite(a.ramp_to) ? a.ramp_to : NaN;
      if (!(to >= 0.25 && to <= 4)) throw new Error('give ramp_to: 0.25 to 4');
      return send({ clip: c.n, ramp_to: to }, `a ramp on clip ${c.n} from 1× to ${to}×`);
    },
  },
];
export const VIDEOEDIT_ABOUT = 'You can read and change the one video project he has open in Video (videoedit: read, edit); a change is only proposed on the timeline for him to accept or reject, and an export only starts on his tap.';
export const VIDEOEDIT_WHEN = WORK_WHEN.video;

// ================================================================ workspace

const nameKey = (s: string): string => flat(s).toLowerCase();
const pagesOf = (w: { lines: WorkLine[] }) => w.lines.filter((l) => l.tag === 'page' || l.tag === 'table').map((l) => ({ n: l.id, table: l.tag === 'table', title: one(l, 'title'), cols: l.f.col ?? [], line: l }));
/** The lines that belong to a page or table (its blocks, its rows), in order. */
const under = (w: { lines: WorkLine[] }, n: string): WorkLine[] => w.lines.filter((l) => (l.tag === 'block' || l.tag === 'row') && l.id.split('.')[0] === n);
const sayLine = (l: WorkLine): string =>
  l.tag === 'block' ? `[${l.id}] ${one(l, 't')}${one(l, 't') === 'todo' ? (one(l, 'done') === '1' ? ' (done)' : '') : ''}: ${one(l, 'text')}` : l.tag === 'row' ? `[${l.id}] ${one(l, 'title')} | ${(l.f.v ?? []).join(' | ')}` : `${l.tag === 'table' ? 'TABLE' : 'PAGE'} ${l.id} "${one(l, 'title')}"${l.f.col ? ` (columns: ${l.f.col.join(', ')})` : ''}`;

export const workspaceTools: Tool[] = [
  {
    name: 'workspace',
    description:
      'The ONE workspace open on his phone (his pages and databases). read: a page by name, or the whole. search: pages and rows matching his words. edit: a block of a page (page + block + text), a row\'s cell (page + row + column + text) or a new page under one (new_page + page); append: a block, or a row in a database, at the end of a page. Edits and appends are proposals he accepts or rejects.',
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['read', 'search', 'edit', 'append'] },
        page: { type: 'string', description: 'a page or database, by name' },
        query: { type: 'string', description: 'search: his words' },
        block: { type: 'number', description: 'edit: the block number inside the page, as in read' },
        row: { type: 'string', description: 'edit: a database row, by name' },
        column: { type: 'string', description: 'edit: the row\'s column (Name for its title)' },
        new_page: { type: 'string', description: 'edit: the title of a page to add under `page`' },
        text: { type: 'string', description: 'the new words (edit), or what to add (append)' },
      },
      required: ['op'],
    },
    risk: 'auto',
    pure: (a) => a.op === 'read' || a.op === 'search',
    async run(a, ctx) {
      const op = String(a.op ?? '');
      if (!['read', 'search', 'edit', 'append'].includes(op)) throw new Error('op is read, search, edit or append');
      const w = await openWork(ctx, 'workspace');
      if (!w) return none('workspace');
      const pages = pagesOf(w);
      const pageNamed = (name: string) => {
        const k = nameKey(name);
        const hits = pages.filter((p) => nameKey(p.title) === k);
        const part = hits.length ? hits : pages.filter((p) => k && nameKey(p.title).includes(k));
        if (!part.length) throw new Error(`no page called "${name}": ${pages.slice(0, 12).map((p) => `"${p.title}"`).join(', ') || 'the workspace has none'}`);
        if (part.length > 1) throw new Error(`more than one page matches "${name}": ${part.map((p) => `"${p.title}"`).join(', ')}`);
        return part[0]!;
      };
      if (op === 'read') {
        const name = text(a.page, 120);
        if (!name) return [`${pages.length} page${pages.length === 1 ? '' : 's'}, read whole:`, ...w.lines.map(sayLine)].join('\n') + more(w);
        const p = pageNamed(name);
        return [sayLine(p.line), ...under(w, p.n).map(sayLine)].join('\n');
      }
      if (op === 'search') {
        const words = [...new Set(text(a.query, 200).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 2 && !['the', 'and', 'what', 'did', 'write', 'wrote', 'about', 'for', 'with', 'that', 'this', 'from', 'have', 'you'].includes(x)))];
        if (!words.length) throw new Error('give query: the words to look for');
        const scored = w.lines
          .map((l) => ({ l, hits: words.filter((x) => `${one(l, 'title')} ${one(l, 'text')} ${(l.f.v ?? []).join(' ')}`.toLowerCase().includes(x)).length }))
          .filter((x) => x.hits > 0 && (x.l.tag === 'block' || x.l.tag === 'row' || x.l.tag === 'page' || x.l.tag === 'table'))
          .sort((x, y) => y.hits - x.hits)
          .slice(0, 12);
        if (!scored.length) return `Nothing in the workspace matches "${words.join(' ')}".` + more(w);
        const place = (l: WorkLine): string => `${pages.find((p) => p.n === l.id.split('.')[0])?.title ?? ''}`;
        // a page or table whose NAME matches is "what he wrote about it": its own lines come with it (eight at most), each said once
        const said = new Set<string>();
        const out: string[] = [];
        const put = (l: WorkLine, line: string): void => {
          const k = `${l.tag}${l.id}`;
          if (said.has(k)) return;
          said.add(k);
          out.push(line);
        };
        for (const { l } of scored) {
          if (l.tag === 'block' || l.tag === 'row') put(l, `In "${place(l)}": ${sayLine(l)}`);
          else {
            put(l, sayLine(l));
            for (const c of under(w, l.id).slice(0, 8)) put(c, `  ${sayLine(c)}`);
          }
        }
        return out.slice(0, 30).join('\n') + more(w);
      }
      if (op === 'append') {
        const words = text(a.text, 2000);
        if (!words) throw new Error('missing "text": what to add');
        const p = pageNamed(text(a.page, 120));
        ctx.emit({ t: 'client', name: 'workspace', args: { change: 'append', page: p.title, text: words, row: p.table } });
        return `Proposed to him as ${p.table ? `a new row "${flat(words).slice(0, 80)}"` : 'a block at the end'} of "${p.title}". ${PROPOSED}`;
      }
      // edit
      const words = text(a.text, 2000);
      if (a.new_page !== undefined && a.new_page !== '') {
        const title = text(a.new_page, 120);
        if (!title) throw new Error('give new_page: the new page\'s title');
        const parent = text(a.page, 120) ? pageNamed(text(a.page, 120)) : null;
        ctx.emit({ t: 'client', name: 'workspace', args: { change: 'page', parent: parent?.title ?? '', title, text: words } });
        return `Proposed to him: a new page "${title}"${parent ? ` under "${parent.title}"` : ''}. ${PROPOSED}`;
      }
      if (!words && words !== '') throw new Error('missing "text"');
      const p = pageNamed(text(a.page, 120));
      if (text(a.row, 120)) {
        const rows = under(w, p.n).filter((l) => l.tag === 'row');
        const k = nameKey(text(a.row, 120));
        const r = rows.find((l) => nameKey(one(l, 'title')) === k) ?? rows.find((l) => nameKey(one(l, 'title')).includes(k));
        if (!r) throw new Error(`no row called "${text(a.row, 120)}" in "${p.title}": ${rows.slice(0, 12).map((l) => `"${one(l, 'title')}"`).join(', ')}`);
        const col = text(a.column, 80) || 'Name';
        const ci = nameKey(col) === 'name' ? -1 : p.cols.findIndex((c) => nameKey(c) === nameKey(col));
        if (ci < 0 && nameKey(col) !== 'name') throw new Error(`no column called "${col}": ${['Name', ...p.cols].join(', ')}`);
        const old = ci < 0 ? one(r, 'title') : (r.f.v ?? [])[ci] ?? '';
        if (flat(old) === flat(words)) return 'That is how it already reads: no change proposed.';
        ctx.emit({ t: 'client', name: 'workspace', args: { change: 'cell', page: p.title, row: one(r, 'title'), column: ci < 0 ? 'Name' : p.cols[ci], old, text: words } });
        return `Proposed to him as a marked change to ${ci < 0 ? 'the name' : `"${p.cols[ci]}"`} of the row "${one(r, 'title')}" in "${p.title}". ${PROPOSED}`;
      }
      const n = asNumber(a.block);
      const b = under(w, p.n).find((l) => l.tag === 'block' && l.id === `${p.n}.${n}`);
      if (n === null || !b) throw new Error(`no such block: give block 1 to ${under(w, p.n).filter((l) => l.tag === 'block').length} of "${p.title}", or row and column`);
      if (flat(one(b, 'text')) === flat(words)) return 'That is how it already reads: no change proposed.';
      ctx.emit({ t: 'client', name: 'workspace', args: { change: 'block', page: p.title, block: n, old: one(b, 'text'), text: words } });
      return `Proposed to him as a marked change to block ${n} of "${p.title}". ${PROPOSED}`;
    },
  },
];
export const WORKSPACE_ABOUT = 'You can read, search and change the workspace he has open (workspace: read, search, edit, append) from his own pages; a change is only proposed, marked for him to accept or reject. It comes with his message.';
export const WORKSPACE_WHEN = WORK_WHEN.workspace;

// ================================================================ game

const GAME_KINDS = ['platformer', 'topdown'];

export const gameTools: Tool[] = [
  {
    name: 'game',
    description:
      'The Game Studio. make: a game built from the studio\'s own kit (rooms, sprites, one person who says your lines, one quest, a save point), kept in his studio library and opened for him to edit: never published, nothing drawn by you. read: the open game\'s rooms, people, quests. edit: room size (room + w, h), a person\'s lines (person + lines), a quest\'s name (quest + text): proposals.',
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['make', 'read', 'edit'] },
        name: { type: 'string', description: 'make: the game\'s name, as he said it' },
        kind: { type: 'string', enum: GAME_KINDS },
        world: { type: 'string', description: 'make: hills, caves, clouds, snow, factory, roofs, ship or tower' },
        colour: { type: 'string', description: 'make: the hero\'s colour: Amber, Grass, Rose, Violet, Sky, Steel, Moss…' },
        person: { type: 'string', description: 'make: the name of the one person who talks; edit: whose lines' },
        lines: { type: 'array', items: { type: 'string' }, description: 'what the person says, a sentence each (up to 8)' },
        quest: { type: 'string', description: 'make: the one quest\'s name; edit: which quest' },
        room: { type: 'string', description: 'edit: a room, by name' },
        w: { type: 'number', description: 'edit: the room\'s width in tiles' },
        h: { type: 'number', description: 'edit: the room\'s height in tiles' },
        text: { type: 'string', description: 'edit: the quest\'s new name' },
      },
      required: ['op'],
    },
    risk: 'auto',
    pure: (a) => a.op === 'read',
    async run(a, ctx) {
      const op = String(a.op ?? '');
      if (!['make', 'read', 'edit'].includes(op)) throw new Error('op is make, read or edit');
      if (op === 'make') {
        const name = text(a.name, 60);
        if (!name) throw new Error('missing "name": the game\'s name');
        const lines = Array.isArray(a.lines) ? a.lines.map((x) => text(x, 160)).filter(Boolean).slice(0, 8) : [];
        const g = gameFromChat({ name, kind: a.kind === 'topdown' ? 'topdown' : 'platformer', world: text(a.world, 20).toLowerCase(), colour: text(a.colour, 20), person: text(a.person, 24), lines, quest: text(a.quest, 40) });
        const c = checked(g);
        if (!c || c.stops.length) throw new Error(`the game I built would not play: ${c?.stops[0] ?? 'it did not read back'}`);
        ctx.emit({ t: 'client', name: 'open_game', args: { game: c.game } });
        return `Built and kept in his studio library, open for him to edit: ${gameSummary(c.game)}. Nothing is published or drawn by a model: the studio's own kit. Tell him it plays from the ARCADE.`;
      }
      const w = await openWork(ctx, 'game');
      if (!w) return none('game');
      const rooms = w.lines.filter((l) => l.tag === 'room');
      const people = w.lines.filter((l) => l.tag === 'person');
      const quests = w.lines.filter((l) => l.tag === 'quest');
      if (op === 'read') {
        return [
          `"${one(w.head, 'name')}": ${one(w.head, 'kind')}, ${rooms.length} room${rooms.length === 1 ? '' : 's'}, ${people.length} ${people.length === 1 ? 'person' : 'people'}, ${quests.length} quest${quests.length === 1 ? '' : 's'}.`,
          ...rooms.map((r) => `Room "${one(r, 'name')}": ${num(r, 'w')} by ${num(r, 'h')} tiles`),
          ...people.map((p) => `Person "${one(p, 'name')}": ${(p.f.line ?? []).map((x) => `"${x}"`).join(' / ') || '(says nothing)'}`),
          ...quests.map((x) => `Quest "${one(x, 'name')}": ${num(x, 'steps')} step${num(x, 'steps') === 1 ? '' : 's'}${one(x, 'reward') ? `, reward line "${one(x, 'reward')}"` : ''}`),
        ].join('\n') + more(w);
      }
      const pick = (list: WorkLine[], name: string, what: string): WorkLine => {
        const k = nameKey(name);
        const hit = list.find((l) => nameKey(one(l, 'name')) === k || l.id === k) ?? list.find((l) => k && nameKey(one(l, 'name')).includes(k));
        if (!hit) throw new Error(`no ${what} called "${name}": ${list.map((l) => `"${one(l, 'name')}"`).join(', ') || `the game has no ${what}s`}`);
        return hit;
      };
      if (text(a.room, 60)) {
        const r = pick(rooms, text(a.room, 60), 'room');
        const nw = asNumber(a.w) ?? num(r, 'w');
        const nh = asNumber(a.h) ?? num(r, 'h');
        if (nw > MAX_W || nh > MAX_H) throw new Error(`a room is ${MAX_W} tiles wide and ${MAX_H} high at most; you asked for ${nw} by ${nh}`);
        if (nw < MIN_W || nh < MIN_H) throw new Error(`a room is ${MIN_W} by ${MIN_H} tiles at the least; you asked for ${nw} by ${nh}`);
        if (nw === num(r, 'w') && nh === num(r, 'h')) return 'That is the size it already is: no change proposed.';
        ctx.emit({ t: 'client', name: 'game', args: { change: 'room', room: r.id, name: one(r, 'name'), w: nw, h: nh, oldW: num(r, 'w'), oldH: num(r, 'h') } });
        return `Proposed to him: "${one(r, 'name')}" resized from ${num(r, 'w')} by ${num(r, 'h')} to ${nw} by ${nh} tiles. ${PROPOSED}`;
      }
      if (text(a.person, 60)) {
        const p = pick(people, text(a.person, 60), 'person');
        const lines = Array.isArray(a.lines) ? a.lines.map((x) => text(x, 160)).filter(Boolean).slice(0, 8) : [];
        if (!lines.length) throw new Error('give lines: what they say, a sentence each');
        ctx.emit({ t: 'client', name: 'game', args: { change: 'dialogue', person: p.id, name: one(p, 'name'), old: (p.f.line ?? []).join('\n'), lines } });
        return `Proposed to him: ${one(p, 'name')} says ${lines.length} new line${lines.length === 1 ? '' : 's'}. ${PROPOSED}`;
      }
      if (text(a.quest, 60)) {
        const x = pick(quests, text(a.quest, 60), 'quest');
        const t = text(a.text, 60);
        if (!t) throw new Error('give text: the quest\'s new name');
        ctx.emit({ t: 'client', name: 'game', args: { change: 'quest', quest: x.id, old: one(x, 'name'), text: t } });
        return `Proposed to him: the quest "${one(x, 'name')}" renamed "${t}". ${PROPOSED}`;
      }
      throw new Error('say what to change: room (with w and h), person (with lines) or quest (with text)');
    },
  },
];
export const GAME_ABOUT = 'You can make a game in his Game Studio from its own kit (game: make), and read or change the open one (read, edit): kept in his library (on his sites only by publish_game, his APPROVE); a change is only proposed.';
export const GAME_WHEN = WORK_WHEN.game;
