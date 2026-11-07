/**
 * SETTINGS → THE LOOK (BRIEF-DESIGN-SYSTEM 5; his pick, W1 THE SCAN, OWNER-ISSUES 139): the design system shown by itself,
 * the first screen drawn in it. Five sections, each a pill: TOKENS (every token with its name, value and job, read from
 * tokens.css itself, the inks and lines with their contrast measured live), TYPE (the scale set in its own sizes), MARKS (the
 * Machine's marks working: a reticle to tap, a typed-out line typing, the recognition tone on a key, the search, the line of
 * sight), MIND (the eye, breathing while it listens) and THEMES (the twelve as live swatches with their measured contrast).
 * Two taps from Settings (the Appearance pill, then its row). The stamp line at the top says what the Machine is looking at
 * as he moves between sections.
 *
 * States, each said in a sentence: Reduce Motion on (marks land where they land, the eye holds still), sound off (the tone
 * stays quiet, and where to turn it on), a browser with no 3-D (the eye drawn flat), offline (the stamp says so), first open
 * (it opens on MARKS, where "tap a mark" is). SPEED: the section in view is built at once and the others just after the first
 * paint, so the screen opens in under 300 ms on the preview (tests/look.spec.mjs holds it).
 */
import { h, icon } from '../../core/dom';
import { stopwatch } from '../../core/stopwatch';
import { parseColour, contrast, ratioWords, FLOOR, type RGB } from '../../design/contrast';
import tokensCss from '../../design/tokens.css';
import { ACCENT_BLOCK, parseTokens, typeParts, type Token } from '../../design/tokens';
import type { TabDef } from '../../shell/tabs';
import { home, settings } from '../../state/app';
import { guardian, loadGuardian } from '../../state/guardian';
import { themeEvents, themeKey, THEMES } from '../../state/theme';
import { panel, type Panel } from '../../ui/components';
import { machineEye, type Eye, type EyeInfo } from '../../ui/eye';
import { eyeGlyph, index, key, lineOfSight, lockBox, MARKS, marksState, plate, recognise, reticle, search, stampLine, tag, toneHeard, truthLine, typedLine, type Reticle, type StampFacts } from '../../ui/machine';
import { sections } from '../../ui/sections';
import { themeSwatches } from '../../ui/swatches';

const GLYPH = {
  look: '<circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.2"/><path d="M3.5 7.5v-4h4M16.5 3.5h4v4M20.5 16.5v4h-4M7.5 20.5h-4v-4"/>',
  book: '<path d="M4 5.5c2.6-1 5.2-1 8 .8 2.8-1.8 5.4-1.8 8-.8v13c-2.6-1-5.2-1-8 .8-2.8-1.8-5.4-1.8-8-.8z"/><path d="M12 6.3v13"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15.5" rx="1"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5z"/>',
  home: '<path d="M4 20V10l8-6 8 6v10z"/><path d="M9.5 20v-6h5v6"/>',
};

/** Who reads the screen: the specs (window.__ghosty.look) and the console. */
export const lookState = {
  /** The sections built so far, in the order they were built. */
  built: [] as string[],
  section: '',
  eye: null as EyeInfo | null,
  marks: marksState,
  /** The newest open of this screen, as the phone's stopwatch timed it. */
  opened: () => stopwatch.lastTab('look'),
  /** The contrast measured on screen: each ink and line on each surface, and each theme's accent as text and as a line. */
  contrast: {} as Record<string, number[]>,
  states: [] as string[],
};

/** The feeds the guardian reads (flood, weather, crime) that answered last time; null while it is still finding out. */
function feedsWatched(): number | null {
  const info = guardian.get().info;
  if (!info) return null;
  return (['flood', 'weather', 'crime'] as const).filter((f) => info.checked[f] && !info.failed[f]).length;
}

const SECTION_WORDS: Record<string, string> = { tokens: 'the tokens', type: 'the type', marks: 'the marks', mind: 'my eye', themes: 'the themes' };
/** A token's job as a sentence on screen (the file writes it as a note: "the page: …" reads "The page: …"). */
const sentence = (job: string) => job.charAt(0).toUpperCase() + job.slice(1);

/** What each type style is set in, as a person would say it. */
const FACE: Record<string, string> = { '--g-font-text': 'SF Pro Text', '--g-font-display': 'SF Pro Display', '--g-font-mono': 'SF Mono', '--g-font-serif': 'New York' };
/** The tracking token that goes with a type style, and whether it is set in capitals. */
const TRACK: Record<string, [string | null, boolean]> = {
  '--g-t-display': ['--g-tr-display', false], '--g-t-say': ['--g-tr-say', false], '--g-t-head': ['--g-tr-body', false], '--g-t-body': ['--g-tr-body', false],
  '--g-t-value': ['--g-tr-mono', false], '--g-t-reading': ['--g-tr-mono', false], '--g-t-tag': ['--g-tr-tag', true], '--g-t-truth': ['--g-tr-truth', true],
  '--g-t-key': ['--g-tr-key', true], '--g-t-caption': [null, false], '--g-t-fine': [null, false], '--g-t-page': [null, false],
};

export const lookTab: TabDef = {
  id: 'look',
  title: 'THE LOOK',
  icon: GLYPH.look,
  scene: 'backdrop',
  // a row of Settings: the deck's Settings card leads here ("The look: how he draws everything"), it has no card of its own
  inside: 'settings',
  blurb: 'tokens · type · marks · mind · themes',
  now: () => `${Object.keys(THEMES).length} themes · ${THEMES[themeKey(settings.get().theme)]!.label} in use`,
  mount(root) {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.look = lookState;
    const css = getComputedStyle(document.documentElement);
    const tokens = parseTokens(tokensCss);

    // ---------------------------------------------------------------- the head: the stamp, the name, his line, the states
    let looking = 'the marks';
    const facts = (): StampFacts => ({ place: home().name, watching: feedsWatched(), looking, offline: typeof navigator !== 'undefined' && navigator.onLine === false });
    const stamp = stampLine(facts);
    const states = h('div.glook-states', { role: 'status', 'aria-live': 'polite' });
    // (the screen's name is the navigation bar's large title, "The look": the head starts with the stamp under it)
    const hero = h('div.hero.glook-head',
      stamp.el,
      h('p.glook-say', { dataset: { case: 'keep' } }, 'This is how I draw everything from here. Tap a mark to see it work.'),
      states);
    /** Every stamp line on the screen, kept true together (the feeds answer, the signal goes, the minute turns). */
    const stamps = [stamp];
    const col = h('div.col');
    const hud = h('div.hud.glook', hero, col);
    root.append(hud);

    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const paintStates = () => {
      const said: [string, string][] = [];
      if (motion.matches) said.push(['Reduce Motion', 'Reduce Motion is on, so every mark appears where it lands, the typed line shows whole and my eye holds still.']);
      if (!settings.get().sounds) said.push(['Sound off', 'Interface sounds are off, so the recognition tone stays quiet. Settings › Voice & home turns them on.']);
      else if (!toneHeard()) said.push(['Tap once', 'I can play the recognition tone once you have tapped the screen.']);
      if (eye?.info.mode === 'flat') said.push(['Drawn flat', 'This browser has no 3-D, so I draw my eye flat here.']);
      lookState.states = said.map(([k]) => k);
      states.replaceChildren(...said.map(([k, v]) => h('p.glook-state', { dataset: { case: 'keep' } }, h('b', k), v)));
    };

    // ---------------------------------------------------------------- the five sections, each a panel
    const P: Record<string, Panel> = {
      tokens: panel('TOKENS', { grow: false, status: `${tokens.length} tokens` }),
      type: panel('TYPE', { grow: false, status: 'Floor 12 pt' }),
      marks: panel('MARKS', { grow: false, status: `${MARKS.length} marks` }),
      mind: panel('MIND', { grow: false, status: 'My eye' }),
      themes: panel('THEMES', { grow: false, status: `${Object.keys(THEMES).length} themes` }),
    };
    for (const p of Object.values(P)) {
      p.title.dataset.case = 'keep';
      // a section's head is a title here, not a fold: a tap on it does nothing
      p.el.addEventListener('click', (e) => (e.target as Element).closest(':scope > h3') && e.stopPropagation(), true);
      col.append(p.el);
    }
    const secs = sections(root, 'look', [
      { id: 'tokens', label: 'Tokens', match: /^TOKENS/ },
      { id: 'type', label: 'Type', match: /^TYPE/ },
      { id: 'marks', label: 'Marks', match: /^MARKS/ },
      { id: 'mind', label: 'Mind', match: /^MIND/ },
      { id: 'themes', label: 'Themes', match: /^THEMES/ },
    ]);
    // the first open lands on MARKS, where "tap a mark" is; after that, the section he last picked
    let kept = '';
    try {
      kept = localStorage.getItem('ghosty.sections.look') ?? '';
    } catch {
      /* storage unavailable: MARKS each time */
    }
    if (!kept) secs.select('marks');

    // ---------------------------------------------------------------- TOKENS
    /** A token drawn as itself beside its name: a colour as a paint chip, a space as a bar its length, a line at its weight, a
     *  corner at its radius, a reticle at its arm, a plate at its lift; nothing for the rest (a face, a duration: the TYPE and
     *  MARKS sections show them working). */
    const tokenChip = (t: Token): HTMLElement => {
      const hide = { 'aria-hidden': 'true' };
      if (/^#|^rgba?\(/.test(t.value) || /-rgb$/.test(t.name)) return h('span.gtok-chip.colour', { ...hide, style: `background: ${/-rgb$/.test(t.name) ? `rgb(var(${t.name}))` : `var(${t.name})`}` });
      if (/^--g-(s-|unit$|gutter$)/.test(t.name)) return h('span.gtok-chip.space', hide, h('i', { style: `width: var(${t.name})` }));
      if (/^--g-(stroke|hair)$/.test(t.name)) return h('span.gtok-chip.weight', hide, h('i', { style: `height: var(${t.name})` }));
      if (t.name === '--g-ret-arm') return h('span.gtok-chip.ret', hide, h('i', h('span.g-ret-frame')));
      if (/^--g-lift-/.test(t.name)) return h('span.gtok-chip.lift', hide, h('i', { style: `box-shadow: var(${t.name})` }));
      if (/^--g-radius-/.test(t.name)) return h('span.gtok-chip.corner', hide, h('i', { style: `border-top-left-radius: ${t.name === '--g-radius-orb' ? '100%' : `var(${t.name})`}` }));
      return h('span.gtok-chip.none', hide);
    };
    const measure = (name: string): number[] => {
      const surf = ['--g-canvas', '--g-plate', '--g-plate-strong'].map((n) => parseColour(css.getPropertyValue(n)));
      const c = parseColour(getComputedStyle(document.documentElement).getPropertyValue(name));
      if (!c || surf.some((s) => !s)) return [];
      return (surf as RGB[]).map((s) => contrast(c, s));
    };
    const fillTokens = (b: HTMLElement) => {
      const groups = new Map<string, Token[]>();
      for (const t of tokens) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);
      const inks = tokens.filter((t) => /^--g-(ink-\d|line(-faint)?|accent|accent-text|amber|red|ok)$/.test(t.name));
      const worst = inks.filter((t) => t.name.startsWith('--g-ink')).map((t) => ({ t, r: Math.min(...measure(t.name)) })).sort((a, z) => a.r - z.r)[0];
      b.append(h('p.glede', { dataset: { case: 'keep' } }, 'Every token I draw with: its name, its value and its job. A theme changes the accent block and nothing else.'),
        plate({},
          tag('The floor', { tone: 'on' }),
          truthLine([`Text ${FLOOR.text}:1`, `lines ${FLOOR.line}:1`, 'nothing under 12 pt']),
          worst ? truthLine([{ text: 'Weakest ink', tone: 'strong' }, worst.t.name.replace('--g-', '').replace('-', ' '), `${ratioWords(worst.r)} on the brightest surface`]) : null));
      for (const [group, list] of groups) {
        const g = h('div.gtok-group', { dataset: { group } }, tag(group, { count: list.length }));
        for (const t of list) {
          const live = (ACCENT_BLOCK as readonly string[]).includes(t.name) ? getComputedStyle(document.documentElement).getPropertyValue(t.name).trim() : '';
          const chip = tokenChip(t);
          const reads = inks.includes(t) ? measure(t.name) : [];
          if (reads.length) lookState.contrast[t.name] = reads.map((r) => +r.toFixed(2));
          g.append(h('div.gtok', { dataset: { token: t.name } }, chip,
            h('span.gtok-txt',
              h('span.gtok-name', t.name),
              h('span.gtok-val', live && live !== t.value ? `${live} in this theme (Reactor’s ${t.value})` : t.value),
              h('span.gtok-job', { dataset: { case: 'keep' } }, sentence(t.job)),
              reads.length ? truthLine([`On the canvas ${ratioWords(reads[0]!)}`, `plate ${ratioWords(reads[1]!)}`, `strong ${ratioWords(reads[2]!)}`]) : null)));
        }
        b.append(g);
      }
    };

    // ---------------------------------------------------------------- TYPE
    const SAMPLE: Record<string, string> = {
      '--g-t-display': 'The look', '--g-t-say': 'Good evening, Boss.', '--g-t-head': 'Alice’s Adventures in Wonderland',
      '--g-t-body': 'Nothing needs you tonight. Shall we read?', '--g-t-value': '07:24 · 1,240 · 42/112', '--g-t-reading': 'Page 42 of 112 · yesterday',
      '--g-t-tag': 'Library · 4', '--g-t-truth': 'Watching 3 feeds', '--g-t-key': 'Open', '--g-t-caption': 'A caption under a control', '--g-t-fine': '+35 since Monday',
      '--g-t-page': 'Alice was beginning to get very tired of sitting by her sister on the bank.',
    };
    const fillType = (b: HTMLElement) => {
      b.append(h('p.glede', { dataset: { case: 'keep' } }, 'My type, each style in its own size. Words in SF Pro, readings and tags in SF Mono, a book’s own words in New York; numbers line up.'),
        plate({}, tag('The floor', { tone: 'on' }), truthLine(['Body 17', 'reading 15', 'tag or caption 13', 'nothing under 12']), truthLine(['Line heights on the 4-point line', 'numerals tabular'])));
      for (const t of tokens.filter((x) => x.name.startsWith('--g-t-'))) {
        const p = typeParts(t.value);
        if (!p) continue;
        const [tr, caps] = TRACK[t.name] ?? [null, false];
        const face = FACE[/var\((--g-font-[a-z]+)\)/.exec(p.family)?.[1] ?? ''] ?? '';
        const track = tr ? tokens.find((x) => x.name === tr)?.value ?? '0' : '0';
        b.append(h('div.gtype', { dataset: { token: t.name } },
          h('span.gtype-sample', { dataset: { case: 'keep' }, style: `font: var(${t.name});${tr ? ` letter-spacing: var(${tr});` : ''}${caps ? ' text-transform: uppercase;' : ''} font-variant-numeric: var(--g-num)` }, SAMPLE[t.name] ?? t.name),
          truthLine([{ text: t.name.replace('--g-t-', ''), tone: 'strong' }, `${p.size}/${p.line}`, `weight ${p.weight}`, `tracking ${track === '0' ? 'none' : track}`, face]),
          h('span.gtok-job', { dataset: { case: 'keep' } }, sentence(t.job))));
      }
    };

    // ---------------------------------------------------------------- MARKS
    let typed: ReturnType<typeof typedLine> | null = null;
    /** The narration last typed out (typed again only when what the feeds said changes). */
    let said = '';
    const narration = () => {
      const n = feedsWatched();
      return `I’m watching ${home().name}. ${n == null ? 'I’m still asking the feeds.' : n === 0 ? 'No feeds have answered yet.' : `${n} ${n === 1 ? 'feed answered' : 'feeds answered'} last time I looked.`} You have me in ${THEMES[themeKey(settings.get().theme)]!.label}.`;
    };
    const fillMarks = (b: HTMLElement) => {
      b.append(h('p.glede', { dataset: { case: 'keep' } }, 'How I show you what I see. Each one is numbered, named and live: tap it.'));
      const block = (n: number, id: string, stage: HTMLElement, after?: Node | null) => {
        const m = MARKS.find((x) => x.id === id)!;
        b.append(h('div.gmark', { dataset: { mark: id } }, h('div.gmark-head', index(n), tag(m.name)), h('p.gmark-rule', { dataset: { case: 'keep' } }, m.rule), stage, after ?? null));
      };
      const theme = () => THEMES[themeKey(settings.get().theme)]!.label;
      // 01 the stamp line
      const st2 = stampLine(() => ({ ...facts(), looking: 'the stamp line' }));
      stamps.push(st2);
      block(1, 'stamp', h('div.gstage', st2.el));
      // 02 the reticle: his home, watched; a tap attends to it (and says so)
      const retSaid = truthLine('Watching · tap to attend');
      const homeRet = reticle({
        name: `Home, ${home().name}`,
        tag: tag('Home', { glyph: GLYPH.home }),
        body: h('span.gthing.found', icon(GLYPH.home), home().name),
        truth: truthLine([`${home().lat.toFixed(3)}, ${home().lon.toFixed(3)}`]),
        onTap: (r) => {
          r.set(r.state() === 'attend' ? 'watch' : 'attend');
          retSaid.replaceChildren(...truthLine(r.state() === 'attend' ? [{ text: 'Attending', tone: 'on' }, 'tap to let it go'] : 'Watching · tap to attend').childNodes);
        },
      });
      block(2, 'reticle', h('div.gstage', homeRet.el, retSaid));
      // 03 the tag
      block(3, 'tag', h('div.gstage', h('div.grow', tag('Home', { count: home().name }), tag('Theme', { count: theme(), tone: 'on' }), tag('Sounds', { count: settings.get().sounds ? 'on' : 'off' }), tag('In the works', { tone: 'warn' }))));
      // 04 the truth line
      block(4, 'truth', h('div.gstage', truthLine([{ text: 'Home', tone: 'strong' }, home().name, `${home().lat.toFixed(3)}, ${home().lon.toFixed(3)}`]), truthLine([{ text: 'Theme', tone: 'strong' }, { text: theme(), tone: 'on' }, `${Object.keys(THEMES).length} to choose from`])));
      // 05 the plate
      block(5, 'plate', h('div.gstage', h('div.gplates', plate({}, tag('Plate'), truthLine('One step up')), plate({ strong: true }, tag('Strong'), truthLine('Brought forward')))));
      // 06 the key: a press is recognised, with the one tone (his sound setting decides whether it is heard)
      const keyStage = h('div.gstage');
      const keyBox = lockBox(keyStage);
      const keySaid = truthLine('Press a key');
      const pressed = (b2: HTMLButtonElement, word: string) => {
        void recognise(keyBox, b2, { name: word }).then((fresh) => keySaid.replaceChildren(...truthLine(fresh ? [{ text: `Pressed ${word}`, tone: 'on' }, settings.get().sounds ? 'one tone' : 'sound off, no tone'] : [{ text: `${word} again`, tone: 'strong' }, 'held, no second tone']).childNodes));
      };
      keyStage.append(h('div.gkeys',
        key('Open', (b2) => pressed(b2, 'Open'), { kind: 'fill', label: 'Open: the one filled key' }),
        key('Later', (b2) => pressed(b2, 'Later'), { label: 'Later: a key' }),
        key('About', (b2) => pressed(b2, 'About'), { kind: 'ghost', label: 'About: a key with no plate' })), keySaid);
      block(6, 'key', keyStage);
      // 07 the line of sight: from my eye to the thing I attend to
      const sightStage = h('div.gstage');
      const sight = lineOfSight(sightStage);
      const eyeSmall = h('span', { style: 'display:block' }, eyeGlyph(56));
      const sightSaid = truthLine('Tap a thing: I look at it');
      const rets: Reticle[] = [];
      const aim = (r: Reticle, what: string) => {
        for (const x of rets) x.set(x === r && r.state() !== 'attend' ? 'attend' : 'watch');
        const on = r.state() === 'attend';
        sight.aim(eyeSmall, on ? r.el.querySelector('.g-ret-box') : null);
        sightSaid.replaceChildren(...truthLine(on ? [{ text: 'Looking at', tone: 'strong' }, { text: what, tone: 'on' }] : 'Tap a thing: I look at it').childNodes);
        looking = on ? what.toLowerCase() : SECTION_WORDS[secs.current()] ?? 'the look';
        stamp.refresh();
      };
      const r1 = reticle({ name: 'Library', tag: tag('Library'), body: h('span.gthing', icon(GLYPH.book), 'Shelf'), onTap: (r) => aim(r, 'the library') });
      const r2 = reticle({ name: 'Agenda', tag: tag('Agenda'), body: h('span.gthing', icon(GLYPH.agenda), 'Today'), onTap: (r) => aim(r, 'the agenda') });
      rets.push(r1, r2);
      sightStage.append(h('div.gsight', eyeSmall, h('div.grow', r1.el, r2.el)), sightSaid);
      block(7, 'sight', sightStage);
      // 08 the typed-out line
      typed = typedLine({ label: 'What I’m saying' });
      const again = key('Type it again', () => void typed?.type(narration()), { label: 'Type the line again' });
      block(8, 'typed', h('div.gstage', typed.el, again));
      // 09 the moment of recognition: tap a thing, the box snaps on with one tone (once for each thing)
      const recStage = h('div.gstage');
      const recBox = lockBox(recStage);
      const recSaid = truthLine('Tap a thing');
      const thing = (label: string, glyph: string) => {
        const b2 = h('button.gthing', { type: 'button', 'aria-label': label, dataset: { case: 'keep' } }, icon(glyph), label);
        b2.addEventListener('click', () => void recognise(recBox, b2, { name: label }).then((fresh) => recSaid.replaceChildren(...truthLine(fresh ? [{ text: `Locked on ${label}`, tone: 'on' }, settings.get().sounds ? 'one tone' : 'sound off, no tone'] : [{ text: `Still on ${label}`, tone: 'strong' }, 'no second tone']).childNodes)));
        return b2;
      };
      recStage.append(h('div.gthings', thing('Library', GLYPH.book), thing('Agenda', GLYPH.agenda), thing('God’s eye', GLYPH.globe)), recSaid);
      block(9, 'recognise', recStage);
      // 10 the search: the box checks each in turn, says which, then locks on the one it found
      const seekStage = h('div.gstage');
      const seekBox = lockBox(seekStage);
      const seekSaid = truthLine('Ask me to find one');
      const seekThings = [['Library', GLYPH.book], ['Agenda', GLYPH.agenda], ['God’s eye', GLYPH.globe]].map(([l, g]) => h('span.gthing', { 'aria-label': l, role: 'img' }, icon(g!), l!));
      const find = key('Find the agenda', (b2) => {
        b2.disabled = true;
        void search(seekBox, seekThings, seekThings[1]!, (words) => seekSaid.replaceChildren(...truthLine(words).childNodes)).finally(() => (b2.disabled = false));
      }, { label: 'Find the agenda' });
      seekStage.append(h('div.gthings', ...seekThings), seekSaid, find);
      block(10, 'search', seekStage);
      // 11 the index: his own things, numbered
      const rows: [string, string][] = [['Home', home().name], ['Theme', theme()], ['Sounds', settings.get().sounds ? 'On' : 'Off']];
      block(11, 'index', h('div.gstage', ...rows.map(([k, v], i) => h('div.grow', index(i + 1, { on: i === 1 }), tag(k), truthLine(v)))));
      if (secs.current() === 'marks') void typed.type((said = narration()));
    };

    // ---------------------------------------------------------------- MIND
    let eye: Eye | null = null;
    const fillMind = (b: HTMLElement) => {
      eye = machineEye(240, { label: 'My eye' });
      lookState.eye = eye.info;
      const said = truthLine('Idle · turning slowly');
      const idle = key('Idle', () => setEye('idle'), { label: 'My eye idle' });
      const listen = key('Listening', () => setEye('listening'), { label: 'My eye listening' });
      const setEye = (s: 'idle' | 'listening') => {
        eye!.set(s);
        idle.setAttribute('aria-pressed', String(s === 'idle'));
        listen.setAttribute('aria-pressed', String(s === 'listening'));
        const still = motion.matches;
        // (drawn flat, it neither turns nor breathes, and says so)
        const flat = eye!.info.mode === 'flat';
        said.replaceChildren(...truthLine(s === 'idle' ? (flat ? ['Idle', 'drawn flat, still'] : still ? ['Idle', 'held still'] : ['Idle', 'turning slowly']) : [{ text: 'Listening', tone: 'on' }, flat ? 'drawn flat, still' : still ? 'held still: Reduce Motion' : 'breathing']).childNodes);
      };
      b.append(h('p.glede', { dataset: { case: 'keep' } }, 'Mind, drawn as my eye: a sphere of points with what I know inside it, my core in your colour, no glow. I breathe while I listen.'),
        h('div.gstage', h('div.gorbwrap', eye.el), tag('Mind · my eye', { tone: 'on' }), said, h('div.gkeys', idle, listen)),
        h('p.glook-state', { dataset: { case: 'keep' }, style: 'margin-top: var(--g-s-2)' }, h('b', 'In the works'), 'My eye lives here for now. Home keeps today’s Mind until the new shell takes this one.'));
      setEye('idle');
      paintStates();
    };

    // ---------------------------------------------------------------- THEMES
    let swatches: ReturnType<typeof themeSwatches> | null = null;
    const fillThemes = (b: HTMLElement) => {
      swatches = themeSwatches({ measure: true, label: 'Theme' });
      b.append(h('p.glede', { dataset: { case: 'keep' } }, 'Twelve colours for the same screens. A tap applies it at once, everywhere; this phone keeps it, and I wake up in it.'),
        plate({}, tag('Held to the floor', { tone: 'on' }), truthLine(['Every theme', `text ${FLOOR.text}:1`, `lines ${FLOOR.line}:1`, 'on every surface'])),
        swatches.el);
      swatches.paint();
    };

    // ---------------------------------------------------------------- building: the section in view now, the rest after the first paint
    const FILL: Record<string, (b: HTMLElement) => void> = { tokens: fillTokens, type: fillType, marks: fillMarks, mind: fillMind, themes: fillThemes };
    const ensure = (id: string) => {
      if (!FILL[id] || lookState.built.includes(id)) return;
      lookState.built.push(id);
      try {
        FILL[id]!(P[id]!.body);
      } catch (e) {
        console.error('look', id, e);
        P[id]!.body.append(h('p.glook-state', h('b', 'Not drawn'), `This section could not be drawn: ${String((e as Error)?.message ?? e)}`));
      }
    };
    const showing = () => {
      const id = secs.current();
      lookState.section = id;
      ensure(id);
      looking = SECTION_WORDS[id] ?? 'the look';
      stamp.refresh();
    };
    secs.el.addEventListener('click', () => requestAnimationFrame(showing));
    // (a pill's own handler runs first; this builds the section it chose before the next frame is drawn)
    secs.el.addEventListener('click', (e) => {
      const id = (e.target as Element).closest<HTMLElement>('[data-sec]')?.dataset.sec;
      if (id) ensure(id);
    }, true);
    showing();
    paintStates();
    // the rest once the screen is drawn, one section a frame, so the first paint never waits for them
    const rest = ['marks', 'mind', 'themes', 'type', 'tokens'];
    const later = () => {
      const id = rest.find((x) => !lookState.built.includes(x));
      if (!id) return;
      ensure(id);
      setTimeout(() => requestAnimationFrame(later), 60);
    };
    requestAnimationFrame(() => setTimeout(later, 250));

    // ---------------------------------------------------------------- following the phone
    settings.subscribe((s, p) => {
      if (s.sounds !== p.sounds) paintStates();
      if (s.theme !== p.theme) swatches?.paint();
    });
    // the accent block's live values and the measured contrast follow the theme (once it settles: a mood eases over a second)
    let retoken = 0;
    themeEvents.on('change', () => {
      clearTimeout(retoken);
      retoken = window.setTimeout(() => {
        if (!lookState.built.includes('tokens')) return;
        P.tokens!.body.replaceChildren();
        fillTokens(P.tokens!.body);
      }, 250);
    });
    const restamp = () => stamps.forEach((x) => x.refresh());
    guardian.subscribe(() => {
      restamp();
      // the narration follows what the feeds said, typed out again if it changed while MARKS is in view
      const now = narration();
      if (typed && now !== said && secs.current() === 'marks') void typed.type((said = now));
    });
    motion.addEventListener?.('change', paintStates);
    addEventListener('online', restamp);
    addEventListener('offline', restamp);
    return {
      enter() {
        void loadGuardian();
        restamp();
        paintStates();
        showing();
      },
      describe: () => `THE LOOK: how I draw everything (${SECTION_WORDS[secs.current()] ?? 'the marks'} showing); theme ${settings.get().theme}`,
    };
  },
};
