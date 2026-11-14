/**
 * SETTINGS → ROUTINES (NEXT-ROUND consistency.s2, voice.s7): his own one-word routines. A word of his ("morning", "movie time")
 * and a few steps in turn, each one of the deck's own YOU CAN lines (a screen, a panel, a command that moves him around) or words
 * he says to Ghosty. Kept on this phone (assistant/routines.ts). Said or typed in the chat, the word runs it
 * (assistant/routineturn.ts); RUN here does the same. A routine never sends or posts by itself: words that would send reach the
 * brain as his own message, and APPROVE stops them there.
 */
import { clear, h } from '../../core/dom';
import { button, panel, toast, type Panel } from '../../ui/components';
import { DECK } from '../../shell/deckcopy';
import { loadRoutines, MAX_STEPS, saveRoutines, STARTERS, wordProblem, type Routine, type RoutineStep } from '../../assistant/routines';

/** Every step he can pick: each screen of the deck, then each of its YOU CAN lines (only those whose act is plain data). */
export function stepChoices(): RoutineStep[] {
  const out: RoutineStep[] = [];
  for (const [id, d] of Object.entries(DECK)) {
    out.push({ label: `${d.name}: open it`, act: { open: id } });
    for (const c of d.can) {
      const a = c.act as Record<string, unknown>;
      if (typeof a.ask === 'string') out.push({ label: `Say: ${a.ask}`, act: { ask: a.ask } });
      else if (typeof a.open === 'string') out.push({ label: `${d.name}: ${c.text.replace(/[“”]/g, '')}`, act: { open: a.open, ...(typeof a.panel === 'string' ? { panel: a.panel } : {}) } });
      else if (typeof a.run === 'string' && (a.args === undefined || typeof a.args === 'object')) out.push({ label: `${d.name}: ${c.text.replace(/[“”]/g, '')}`, act: { run: a.run, ...(a.args ? { args: a.args as Record<string, unknown> } : {}) } });
    }
  }
  return out;
}

const summary = (r: Routine) => r.steps.map((s) => s.label.replace(/: open it$/, '')).join(' → ');

export function routinesPanel(): Panel {
  const p = panel('ROUTINES', { grow: false, status: 'Your words' });
  p.el.classList.add('routines');
  let list = loadRoutines();
  /** The routine being made or changed (its old word when changing one), or null when only the list shows. */
  let draft: { word: string; steps: RoutineStep[]; was?: string } | null = null;

  const keep = (next: Routine[], said: string): boolean => {
    if (!saveRoutines(next)) {
      /* state: settings.routines error */
      toast('This phone would not keep it (private browsing, or storage full). Nothing changed.', 'bad');
      return false;
    }
    list = next;
    toast(said, 'ok');
    return true;
  };

  const run = (r: Routine) => {
    void import('../../assistant/routineturn').then((m) => m.runRoutine(r));
    toast(`${r.word}: running ${r.steps.length} ${r.steps.length === 1 ? 'thing' : 'things'} in turn.`, 'ok');
  };

  const listView = (): HTMLElement[] => {
    if (!list.length) {
      /* state: settings.routines empty */
      return [
        h('div.empty', { dataset: { case: 'keep', state: 'empty' } }, h('b', 'No routines yet'), h('span', 'Make one word do a few things in turn, like “morning”.')),
        h('div.scgal', ...STARTERS.map((s) => h('div.scrow.rtstarter', { dataset: { word: s.word } }, h('b', `“${s.word}”`), h('span', summary(s)), h('div.row', button(`ADD ${s.word.toUpperCase()}`, () => {
          if (keep([...list, { ...s, at: Date.now() }], `Added “${s.word}”. Say it, or tap RUN.`)) paint();
        }, 'on'))))),
      ];
    }
    return [h('div.scgal', ...list.map((r) => {
      const runB = button('RUN', () => run(r), 'on');
      runB.setAttribute('aria-label', `Run ${r.word}`);
      const edit = button('EDIT', () => {
        draft = { word: r.word, steps: [...r.steps], was: r.word };
        paint();
      });
      edit.setAttribute('aria-label', `Change ${r.word}`);
      const del = button('DELETE', () => {
        const before = list;
        if (!keep(list.filter((x) => x !== r), `Deleted “${r.word}”.`)) return;
        paint();
        // (put back with RESTORE, as everywhere he deletes something of his)
        undoBtn.hidden = false;
        undo = () => {
          if (keep(before, `“${r.word}” is back.`)) paint();
        };
      });
      del.setAttribute('aria-label', `Delete ${r.word}`);
      return h('div.scrow.rtrow', { dataset: { word: r.word } }, h('b', `“${r.word}”`), h('span', summary(r)), h('div.row', runB, edit, del));
    }))];
  };

  let undo: (() => void) | null = null;
  const undoBtn = button('RESTORE', () => {
    const u = undo;
    undo = null;
    undoBtn.hidden = true;
    u?.();
  });
  undoBtn.hidden = true;

  const editor = (d: NonNullable<typeof draft>): HTMLElement => {
    const word = h('input.scwords.rtword', { type: 'text', value: d.word, placeholder: 'A word to say, like “morning”', 'aria-label': 'The word you will say', maxLength: 40 });
    const problem = h('p.note.rtproblem', { dataset: { case: 'keep' }, role: 'status' });
    const steps = h('ol.rtsteps');
    const paintSteps = () => {
      clear(steps, ...d.steps.map((s, i) => {
        const up = button('↑', () => { [d.steps[i - 1], d.steps[i]] = [d.steps[i]!, d.steps[i - 1]!]; paintSteps(); });
        up.disabled = i === 0;
        up.setAttribute('aria-label', `Move ${s.label} earlier`);
        const down = button('↓', () => { [d.steps[i + 1], d.steps[i]] = [d.steps[i]!, d.steps[i + 1]!]; paintSteps(); });
        down.disabled = i === d.steps.length - 1;
        down.setAttribute('aria-label', `Move ${s.label} later`);
        const x = button('✕', () => { d.steps.splice(i, 1); paintSteps(); });
        x.setAttribute('aria-label', `Take out ${s.label}`);
        return h('li.rtstep', h('span', s.label), h('div.row', up, down, x));
      }));
      if (!d.steps.length) steps.append(h('li.rtstep.none', h('span', 'No steps yet: add one below.')));
      addRow.hidden = d.steps.length >= MAX_STEPS;
    };
    // ADD A STEP: a screen or a YOU CAN line found by a word, or his own words to say
    const find = h('input.scwords.rtfind', { type: 'search', placeholder: 'Find a screen or a thing to do', 'aria-label': 'Find a step to add' });
    const found = h('div.rtfound');
    const all = stepChoices();
    const paintFound = () => {
      const q = find.value.trim().toLowerCase();
      const hits = q ? all.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 8) : [];
      clear(found, ...hits.map((s) => button(s.label, () => {
        d.steps.push(s);
        find.value = '';
        paintFound();
        paintSteps();
      }, 'rtpick')));
      if (q && !hits.length) found.append(h('p.note', { dataset: { case: 'keep' } }, 'Nothing by that word: try a screen’s name, or add words to say below.'));
    };
    find.addEventListener('input', paintFound);
    const say = h('input.scwords.rtsay', { type: 'text', placeholder: 'Or words to say to me', 'aria-label': 'Words to say to Ghosty', maxLength: 300 });
    const sayB = button('ADD WORDS', () => {
      const t = say.value.trim();
      if (!t) return;
      d.steps.push({ label: `Say: ${t}`, act: { ask: t } });
      say.value = '';
      paintSteps();
    });
    const addRow = h('div.rtadd', h('b', 'ADD A STEP'), find, found, h('div.row', say, sayB));
    const save = button('SAVE', () => {
      const w = word.value.trim();
      const why = wordProblem(w, list, d.was) || (d.steps.length ? '' : 'Add at least one step first.');
      problem.textContent = why;
      if (why) return;
      const next = { word: w, steps: d.steps, at: Date.now() };
      const rest = d.was ? list.map((r) => (r.word === d.was ? next : r)) : [...list, next];
      if (keep(rest, `Kept “${w}”. Say it, or tap RUN.`)) {
        draft = null;
        paint();
      }
    }, 'on');
    const cancel = button('CANCEL', () => {
      draft = null;
      paint();
    });
    paintSteps();
    return h('div.rtedit', h('b', d.was ? `CHANGE “${d.was}”` : 'NEW ROUTINE'), word, steps, addRow, problem, h('div.row', save, cancel));
  };

  const paint = () => {
    clear(p.body,
      h('p.note', 'One word of yours runs a few things in turn: say it or type it to me.'),
      h('p.note', 'Anything that would send or post still waits for your APPROVE.'),
      ...(draft ? [editor(draft)] : [...listView(), h('div.row', button('NEW ROUTINE', () => {
        draft = { word: '', steps: [] };
        paint();
      }, list.length ? '' : 'on'), undoBtn)]),
    );
    p.setStatus(list.length ? `${list.length} ${list.length === 1 ? 'routine' : 'routines'}` : 'Your words');
  };
  paint();
  return p;
}
