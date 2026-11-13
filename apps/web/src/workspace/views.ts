/**
 * THE WORKSPACE'S DATABASE VIEWS (BRIEF-EDITOR-WORKSPACE): one database drawn as a TABLE (the spreadsheet's grid, read-only cells, a row opening as
 * its page), a BOARD (columns by a select; a card dragged between columns changes it, and ‹ › keys do the same for one hand), a CALENDAR (a month by
 * a date; a day's cards; swipe or the keys for the next month), a TIMELINE (rows as bars between two dates; pinch or the keys to zoom from a week
 * to a year) and a GALLERY (a card a row with its first picture). Each view keeps its own sort, filter and hidden properties; FILTER & SORT and
 * PROPERTIES are sheets of the view's own. Pure drawing over workspace/db.ts: every change goes back through `ctx.change`.
 */
import { clear, h } from '../core/dom';
import { button } from '../ui/components';
import {
  addMonths, addOption, addProp, addRow, addView, boardColumns, dateTyped, dateWords, dayDiff, dbOf, galleryCards, isoOf, KIND_NAMES, monthGrid, monthOf, monthWords, moveCard,
  moveProp, patchProp, patchView, propOf, removeProp, removeView, renameProp, ROLL_NAMES, setVal, shown, timelineBars, viewOf, viewRows, visibleProps, VIEW_NAMES, WEEKDAYS, addDays,
  errorWords,
} from './db';
import { rowsOf, titleOf, type Filter, type Page, type Prop, type PropKind, type PVal, type RollFn, type View, type ViewKind, type Workspace } from './model';

export interface Ctx {
  ws(): Workspace;
  change(next: Workspace): void;
  open(id: string): void;
  say(words: string): void;
  today(): string;
  image(id: string): string | null;
  people(): string[];
  /** Called after any change so every view on screen draws again. */
  subscribe(fn: () => void): void;
}

const key = (label: string, run: () => void, cls = '', name = ''): HTMLButtonElement => {
  const b = button(label, run, cls);
  if (name) b.setAttribute('aria-label', name);
  return b;
};
const field = (label: string, el: HTMLElement): HTMLElement => h('label.wsfield', h('small.wsh', label), el);
const opt = (value: string, text: string, sel = false): HTMLOptionElement => h('option', { value, ...(sel ? { selected: true } : {}) }, text) as HTMLOptionElement;
const select = (name: string, opts: [string, string][], cur: string, on: (v: string) => void): HTMLSelectElement => {
  const s = h('select', { 'aria-label': name }, ...opts.map(([v, t]) => opt(v, t, v === cur))) as HTMLSelectElement;
  s.value = cur;
  s.addEventListener('change', () => on(s.value));
  return s;
};

export const OPS: Record<Filter['op'], string> = {
  is: 'is', isnot: 'is not', contains: 'contains', empty: 'is empty', filled: 'is filled', over: 'is over', under: 'is under', checked: 'is ticked', unchecked: 'is not ticked',
};
const opsFor = (k: PropKind | 'name'): Filter['op'][] =>
  k === 'check' ? ['checked', 'unchecked'] : k === 'number' || k === 'date' ? ['is', 'over', 'under', 'empty', 'filled'] : k === 'select' ? ['is', 'isnot', 'empty', 'filled'] : ['contains', 'is', 'isnot', 'empty', 'filled'];

// ---------------------------------------------------------------- a row's properties, as controls

/** A row's properties at the head of its page: each a control of its kind (a formula and a rollup are worked, never typed). */
export function propEditor(ctx: Ctx, dbId: string, row: Page): HTMLElement {
  const ws = ctx.ws();
  const db = dbOf(ws, dbId);
  const box = h('div.wsprops', { role: 'group', 'aria-label': 'Properties' });
  if (!db) return box;
  for (const p of db.props) {
    const v = row.vals?.[p.id] ?? null;
    const name = p.name;
    let control: HTMLElement;
    const put = (x: PVal): void => ctx.change(setVal(ctx.ws(), row.id, p.id, x));
    switch (p.kind) {
      case 'text':
      case 'person': {
        if (p.kind === 'person') {
          const names = ctx.people();
          const cur = typeof v === 'string' ? v : '';
          control = select(name, [['', names.length ? 'Nobody' : 'No one in PEOPLE yet'], ...names.map((n): [string, string] => [n, n]), ...(cur && !names.includes(cur) ? [[cur, cur] as [string, string]] : [])], cur, (x) => put(x || null));
        } else {
          const i = h('input', { type: 'text', value: typeof v === 'string' ? v : '', 'aria-label': name, enterKeyHint: 'done', autocomplete: 'off' }) as HTMLInputElement;
          i.addEventListener('change', () => put(i.value || null));
          control = i;
        }
        break;
      }
      case 'number': {
        const i = h('input', { type: 'text', inputMode: 'decimal', value: typeof v === 'number' ? String(v) : '', 'aria-label': name, autocomplete: 'off' }) as HTMLInputElement;
        i.addEventListener('change', () => {
          const t = i.value.trim().replace(/,/g, '');
          if (!t) return put(null);
          if (Number.isNaN(Number(t))) {
            i.setAttribute('aria-invalid', 'true');
            return ctx.say(`“${i.value}” is not a number, so ${name} keeps what it had.`);
          }
          put(Number(t));
        });
        control = i;
        break;
      }
      case 'date': {
        const i = h('input', { type: 'date', value: typeof v === 'string' ? v : '', 'aria-label': name }) as HTMLInputElement;
        i.addEventListener('change', () => put(dateTyped(i.value) ?? null));
        control = i;
        break;
      }
      case 'check': {
        const b = h('button.wscheck', { type: 'button', role: 'checkbox', 'aria-checked': String(v === true), 'aria-label': name }, v === true ? '✓' : '') as HTMLButtonElement;
        b.addEventListener('click', () => put(v !== true));
        control = b;
        break;
      }
      case 'select': {
        const cur = typeof v === 'string' ? v : '';
        control = select(name, [['', 'None'], ...(p.options ?? []).map((o): [string, string] => [o, o]), ...(cur && !(p.options ?? []).includes(cur) ? [[cur, cur] as [string, string]] : [])], cur, (x) => put(x || null));
        break;
      }
      case 'multi': {
        const cur = Array.isArray(v) ? v : [];
        control = h('div.wschips', ...(p.options ?? []).map((o) => {
          const on = cur.includes(o);
          const b = h('button.wschip', { type: 'button', 'aria-pressed': String(on) }, o) as HTMLButtonElement;
          b.addEventListener('click', () => put(on ? cur.filter((x) => x !== o) : [...cur, o]));
          return b;
        }), (p.options ?? []).length ? '' : h('small.wsnote', 'No choices yet. Add them in PROPERTIES.'));
        break;
      }
      case 'relation': {
        const target = p.rel ? ctx.ws().pages[p.rel] : undefined;
        const cur = Array.isArray(v) ? v : [];
        control = target?.db
          ? h('div.wschips', ...rowsOf(ctx.ws(), target.id).map((r) => {
            const on = cur.includes(r.id);
            const b = h('button.wschip', { type: 'button', 'aria-pressed': String(on) }, titleOf(r)) as HTMLButtonElement;
            b.addEventListener('click', () => put(on ? cur.filter((x) => x !== r.id) : [...cur, r.id]));
            return b;
          }), rowsOf(ctx.ws(), target.id).length ? '' : h('small.wsnote', `${titleOf(target)} has no rows yet.`))
          : h('small.wsnote', 'This relation has no database to point at. Pick one in PROPERTIES.');
        break;
      }
      default: {
        const s = shown(ws, dbId, row, p);
        control = h('div.wscalc', h('b', { dataset: { case: 'keep' } }, s.text || '—'), s.error ? h('small.wserr', { role: 'alert' }, s.error) : '');
      }
    }
    box.append(h('div.wsprop', { dataset: { kind: p.kind, prop: p.id } }, h('span.wspn', name, h('small', KIND_NAMES[p.kind])), control));
  }
  return box;
}

// ---------------------------------------------------------------- the view

export interface ViewOpts {
  /** The view to show (left out: the database's first). */
  view?: string;
  /** Called when a view is picked, so the block that shows it can keep which. */
  onView?(id: string): void;
  /** Drawn inside a page (smaller head) rather than as the database page itself. */
  embedded?: boolean;
}

export function dbView(ctx: Ctx, dbId: string, o: ViewOpts = {}): HTMLElement {
  const root = h('section.wsview', { dataset: { db: dbId } });
  let viewId = o.view ?? '';
  let panel: '' | 'filter' | 'props' | 'add' = '';
  let day = '';
  let px = 0;
  let newRow = '';
  const db = (): ReturnType<typeof dbOf> => dbOf(ctx.ws(), dbId);
  const view = (): View | undefined => viewOf(db(), viewId);
  const change = (next: Workspace): void => ctx.change(next);
  const paint = (): void => {
    const d = db();
    if (!d) return void clear(root, h('p.wsnote', 'This database is not here any more.'));
    const v = view()!;
    viewId = v.id;
    root.dataset.view = v.id;
    root.dataset.kind = v.kind;
    const pills = h('div.wspills', { role: 'tablist', 'aria-label': 'Views' },
      ...d.views.map((x) => {
        const b = h('button.wspill', { type: 'button', role: 'tab', 'aria-selected': String(x.id === v.id), dataset: { kind: x.kind, view: x.id } }, x.name) as HTMLButtonElement;
        b.addEventListener('click', () => {
          viewId = x.id;
          day = '';
          o.onView?.(x.id);
          paint();
        });
        return b;
      }),
      key('ADD VIEW', () => {
        panel = panel === 'add' ? '' : 'add';
        paint();
      }, 'wspill add'),
    );
    const tools = h('div.wsrow',
      key('FILTER & SORT', () => {
        panel = panel === 'filter' ? '' : 'filter';
        paint();
      }, v.filter || v.sort ? 'on' : ''),
      key('PROPERTIES', () => {
        panel = panel === 'props' ? '' : 'props';
        paint();
      }),
      key('ADD A ROW', () => {
        const r = addRow(ctx.ws(), dbId, newRow.trim(), seedFor(v));
        newRow = '';
        change(r.ws);
        ctx.say(`A row added to ${titleOf(ctx.ws().pages[dbId])}. Tap it to write its page.`);
      }, 'on'),
    );
    const name = h('input.wsnewrow', { type: 'text', placeholder: 'Name of a new row', 'aria-label': 'Name of the new row', enterKeyHint: 'done', autocomplete: 'off', value: newRow }) as HTMLInputElement;
    name.addEventListener('input', () => (newRow = name.value));
    name.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const r = addRow(ctx.ws(), dbId, name.value.trim(), seedFor(v));
      newRow = '';
      change(r.ws);
    });
    const panelEl = panel === 'add' ? addPanel() : panel === 'filter' ? filterPanel(v) : panel === 'props' ? propsPanel(v) : null;
    clear(root, ...(o.embedded ? [] : []), pills, h('div.wsrow.wsbar', name, tools), ...(panelEl ? [panelEl] : []), body(v));
  };
  const seedFor = (v: View): Record<string, never> | Record<string, string> => {
    // a row added where a view is looking starts where it looks: a day's date on a calendar, the first column of a board
    if (v.kind === 'calendar' && day && v.by) return { [v.by]: day };
    return {};
  };

  // ---- the panels
  const addPanel = (): HTMLElement =>
    h('div.wspanel', h('small.wsh', 'A NEW VIEW OF THIS DATABASE'),
      h('div.wsrow', ...(['table', 'board', 'calendar', 'timeline', 'gallery'] as ViewKind[]).map((k) => key(VIEW_NAMES[k], () => {
        const r = addView(ctx.ws(), dbId, k);
        panel = '';
        change(r.ws);
        if (r.view) {
          viewId = r.view.id;
          o.onView?.(r.view.id);
          paint();
        }
        ctx.say(`${VIEW_NAMES[k][0]}${VIEW_NAMES[k].slice(1).toLowerCase()} view added.`);
      }, '', `Add a ${k} view`))));

  const filterPanel = (v: View): HTMLElement => {
    const d = db()!;
    const f = v.filter;
    const propOpts: [string, string][] = [['name', 'Name'], ...d.props.map((p): [string, string] => [p.id, p.name])];
    const kindOf = (id: string): PropKind | 'name' => (id === 'name' ? 'name' : propOf(d, id)?.kind ?? 'text');
    let fp = f?.prop ?? d.props[0]?.id ?? 'name';
    let fop: Filter['op'] = f?.op ?? opsFor(kindOf(fp))[0]!;
    let fv = f?.value ?? '';
    const valueBox = h('div.wsvalue');
    const drawValue = (): void => {
      const k = kindOf(fp);
      const needs = !['empty', 'filled', 'checked', 'unchecked'].includes(fop);
      const p = propOf(d, fp);
      clear(valueBox, ...(needs ? [p?.kind === 'select' ? select('Filter value', [['', 'Pick one'], ...(p.options ?? []).map((o): [string, string] => [o, o])], fv, (x) => (fv = x)) : (() => {
        const i = h('input', { type: k === 'date' ? 'date' : 'text', inputMode: k === 'number' ? 'decimal' : 'text', value: fv, 'aria-label': 'Filter value', autocomplete: 'off' }) as HTMLInputElement;
        i.addEventListener('input', () => (fv = i.value));
        return i;
      })()] : []));
    };
    const opSel = h('div.wsopbox');
    const drawOps = (): void => {
      const ops = opsFor(kindOf(fp));
      if (!ops.includes(fop)) fop = ops[0]!;
      clear(opSel, select('Filter test', ops.map((x): [string, string] => [x, OPS[x]]), fop, (x) => {
        fop = x as Filter['op'];
        drawValue();
      }));
    };
    drawOps();
    drawValue();
    const propSel = select('Filter property', propOpts, fp, (x) => {
      fp = x;
      fv = '';
      drawOps();
      drawValue();
    });
    const sortProp = select('Sort by', [['', 'No sorting'], ...propOpts], v.sort?.prop ?? '', (x) => change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, sort: x ? { prop: x, dir: y.sort?.dir ?? 'asc' } : null }))));
    const sortDir = select('Sort order', [['asc', 'A to Z, small to big'], ['desc', 'Z to A, big to small']], v.sort?.dir ?? 'asc', (x) => change(patchView(ctx.ws(), dbId, v.id, (y) => (y.sort ? { ...y, sort: { ...y.sort, dir: x as 'asc' | 'desc' } } : y))));
    const dateProps = d.props.filter((p) => p.kind === 'date');
    const extras: HTMLElement[] = [];
    if (v.kind === 'board') extras.push(field('COLUMNS BY', select('Columns by', d.props.filter((p) => p.kind === 'select').map((p): [string, string] => [p.id, p.name]), v.by ?? '', (x) => change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, by: x }))))));
    if (v.kind === 'calendar') extras.push(field('DAYS BY', select('Days by', dateProps.map((p): [string, string] => [p.id, p.name]), v.by ?? '', (x) => change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, by: x }))))));
    if (v.kind === 'timeline') {
      extras.push(field('BARS BEGIN ON', select('Bars begin on', dateProps.map((p): [string, string] => [p.id, p.name]), v.by ?? '', (x) => change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, by: x }))))));
      extras.push(field('AND END ON', select('Bars end on', [['', 'The same day'], ...dateProps.map((p): [string, string] => [p.id, p.name])], v.end ?? '', (x) => change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, end: x || undefined }))))));
    }
    const name = h('input', { type: 'text', value: v.name, 'aria-label': 'Name of this view', autocomplete: 'off' }) as HTMLInputElement;
    name.addEventListener('change', () => name.value.trim() && change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, name: name.value.trim() }))));
    return h('div.wspanel.wsfilter',
      h('small.wsh', 'FILTER'),
      h('div.wsrow', propSel, opSel, valueBox),
      h('div.wsrow',
        key('APPLY FILTER', () => {
          if (!['empty', 'filled', 'checked', 'unchecked'].includes(fop) && !fv.trim()) return ctx.say('Type or pick what to filter for first.');
          change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, filter: { prop: fp, op: fop, value: fv } })));
          ctx.say('The filter is on for this view only.');
        }, 'on'),
        key('CLEAR IT', () => change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, filter: null }))))),
      h('small.wsh', 'SORT'),
      h('div.wsrow', sortProp, sortDir),
      ...extras,
      field('THIS VIEW’S NAME', name),
      d.views.length > 1 ? key('REMOVE THIS VIEW', () => {
        panel = '';
        viewId = '';
        change(removeView(ctx.ws(), dbId, v.id));
        ctx.say('The view is gone; the rows are all still here.');
      }) : '');
  };

  const propsPanel = (v: View): HTMLElement => {
    const d = db()!;
    const rows = d.props.map((p, i) => {
      const hidden = v.hidden.includes(p.id);
      const nm = h('input', { type: 'text', value: p.name, 'aria-label': `Name of ${p.name}`, autocomplete: 'off' }) as HTMLInputElement;
      nm.addEventListener('change', () => nm.value.trim() && change(renameProp(ctx.ws(), dbId, p.id, nm.value)));
      const more: HTMLElement[] = [];
      if (p.kind === 'select' || p.kind === 'multi') {
        const o2 = h('input', { type: 'text', placeholder: 'Add a choice', 'aria-label': `A new choice for ${p.name}`, enterKeyHint: 'done', autocomplete: 'off' }) as HTMLInputElement;
        o2.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          change(addOption(ctx.ws(), dbId, p.id, o2.value));
        });
        more.push(h('small.wsnote', (p.options ?? []).join(' · ') || 'No choices yet'), o2);
      }
      if (p.kind === 'formula') {
        const fi = h('input.wsformula', { type: 'text', value: p.formula ?? '', placeholder: 'prop("Cost") * 1.2', 'aria-label': `Formula of ${p.name}`, autocomplete: 'off', autocapitalize: 'none', spellcheck: false }) as HTMLInputElement;
        const note = h('small.wserr', { role: 'alert' });
        const test = (text: string): void => {
          const first = rowsOf(ctx.ws(), dbId)[0];
          if (!text.trim() || !first) return void (note.textContent = '');
          const probe = patchProp(ctx.ws(), dbId, p.id, (x) => ({ ...x, formula: text }));
          const s = shown(probe, dbId, probe.pages[first.id]!, probe.pages[dbId]!.db!.props.find((x) => x.id === p.id)!);
          note.textContent = s.error ?? '';
        };
        fi.addEventListener('input', () => test(fi.value));
        fi.addEventListener('change', () => change(patchProp(ctx.ws(), dbId, p.id, (x) => ({ ...x, formula: fi.value }))));
        test(p.formula ?? '');
        more.push(fi, note, h('small.wsnote', 'prop("Name") is another property of the same row. Every spreadsheet function works: if, round, concat, datedif…'));
      }
      if (p.kind === 'relation') {
        const others = Object.values(ctx.ws().pages).filter((x) => x.db && !x.deleted);
        more.push(select(`The database ${p.name} points at`, [['', 'Pick a database'], ...others.map((x): [string, string] => [x.id, titleOf(x)])], p.rel ?? '', (x) => change(patchProp(ctx.ws(), dbId, p.id, (y) => ({ ...y, rel: x || undefined })))));
      }
      if (p.kind === 'rollup') {
        const rels = d.props.filter((x) => x.kind === 'relation' && x.rel);
        const via = rels.find((x) => x.id === p.roll?.via) ?? rels[0];
        const target = via?.rel ? ctx.ws().pages[via.rel]?.db : undefined;
        more.push(
          select('Through which relation', rels.map((x): [string, string] => [x.id, x.name]), via?.id ?? '', (x) => change(patchProp(ctx.ws(), dbId, p.id, (y) => ({ ...y, roll: { via: x, of: y.roll?.of ?? '', fn: y.roll?.fn ?? 'count' } })))),
          select('Of which property', (target?.props ?? []).map((x): [string, string] => [x.id, x.name]), p.roll?.of ?? '', (x) => change(patchProp(ctx.ws(), dbId, p.id, (y) => ({ ...y, roll: { via: y.roll?.via ?? via?.id ?? '', of: x, fn: y.roll?.fn ?? 'count' } })))),
          select('How to add them up', (Object.keys(ROLL_NAMES) as RollFn[]).map((x): [string, string] => [x, ROLL_NAMES[x]]), p.roll?.fn ?? 'count', (x) => change(patchProp(ctx.ws(), dbId, p.id, (y) => ({ ...y, roll: { via: y.roll?.via ?? via?.id ?? '', of: y.roll?.of ?? '', fn: x as RollFn } })))),
        );
      }
      return h('div.wsproprow', { dataset: { prop: p.id } },
        h('div.wsrow', nm, h('small.wskind', KIND_NAMES[p.kind])),
        h('div.wsrow',
          key(hidden ? 'SHOW' : 'HIDE', () => change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, hidden: hidden ? y.hidden.filter((x) => x !== p.id) : [...y.hidden, p.id] }))), '', `${hidden ? 'Show' : 'Hide'} ${p.name} in this view`),
          key('UP', () => change(moveProp(ctx.ws(), dbId, p.id, -1)), '', `Move ${p.name} earlier`),
          key('DOWN', () => change(moveProp(ctx.ws(), dbId, p.id, 1)), '', `Move ${p.name} later`),
          key('REMOVE', () => {
            change(removeProp(ctx.ws(), dbId, p.id));
            ctx.say(`${p.name} is gone from every row. UNDO brings it back.`);
          }, '', `Remove ${p.name}`)),
        ...more, i < 0 ? '' : '');
    });
    const nn = h('input', { type: 'text', placeholder: 'Name of a new property', 'aria-label': 'Name of the new property', autocomplete: 'off' }) as HTMLInputElement;
    const kind = select('Kind of the new property', (Object.keys(KIND_NAMES) as PropKind[]).map((k): [string, string] => [k, KIND_NAMES[k]]), 'text', () => undefined);
    return h('div.wspanel.wsprops2',
      h('small.wsh', 'PROPERTIES'),
      ...rows,
      h('small.wsh', 'ADD A PROPERTY'),
      h('div.wsrow', nn, kind, key('ADD', () => {
        const k = kind.value as PropKind;
        const r = addProp(ctx.ws(), dbId, { name: nn.value.trim() || KIND_NAMES[k], kind: k, ...(k === 'select' || k === 'multi' ? { options: [] } : {}), ...(k === 'rollup' ? { roll: { via: '', of: '', fn: 'count' as RollFn } } : {}) });
        change(r.ws);
        ctx.say(`${r.prop?.name ?? 'The property'} added to every row.`);
      }, 'on')));
  };

  // ---- the five views
  const rowKey = (r: Page, cls = ''): HTMLButtonElement => {
    const b = h(`button.wsrowopen${cls ? `.${cls}` : ''}` as 'button', { type: 'button', dataset: { id: r.id } }, titleOf(r)) as HTMLButtonElement;
    b.addEventListener('click', () => ctx.open(r.id));
    return b;
  };
  const nothing = (all: number, v: View): HTMLElement | null => {
    const sh = viewRows(ctx.ws(), dbId, v);
    if (!all) return h('div.wsempty', h('p', 'Nothing here yet. ADD A ROW.'));
    if (sh.hiddenByFilter) {
      return h('div.wsempty', h('p', `Your filter hides all ${all}. `, key('CLEAR IT', () => change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, filter: null }))), 'on')));
    }
    return null;
  };
  const body = (v: View): HTMLElement => {
    const ws = ctx.ws();
    const d = db()!;
    const all = rowsOf(ws, dbId).length;
    const wrap = h('div.wsbody', { dataset: { kind: v.kind } });
    const empty = nothing(all, v);
    if (empty) {
      wrap.append(empty);
      return wrap;
    }
    if (v.kind === 'table') {
      const props = visibleProps(d, v);
      const rows = viewRows(ws, dbId, v).rows;
      const t = h('table.wstable', h('thead', h('tr', h('th', 'Name'), ...props.map((p) => h('th', p.name)))),
        h('tbody', ...rows.map((r) => {
          const tr = h('tr', { dataset: { id: r.id }, tabIndex: 0, role: 'link', 'aria-label': `Open ${titleOf(r)}` },
            h('td.wsname', titleOf(r)),
            ...props.map((p) => {
              const s = shown(ws, dbId, r, p);
              return h('td', { dataset: { kind: p.kind, ...(s.error ? { err: '1' } : {}) } }, s.error ? h('span.wserr', { title: s.error }, s.text) : s.text);
            }));
          tr.addEventListener('click', () => ctx.open(r.id));
          tr.addEventListener('keydown', (e) => (e.key === 'Enter' ? ctx.open(r.id) : undefined));
          return tr;
        })));
      wrap.append(h('div.wsscroll', t));
      const bad = rows.flatMap((r) => props.map((p) => shown(ws, dbId, r, p).error)).find(Boolean);
      if (bad) wrap.append(h('p.wserr', { role: 'alert' }, bad));
    } else if (v.kind === 'board') wrap.append(boardBody(v));
    else if (v.kind === 'calendar') wrap.append(calendarBody(v));
    else if (v.kind === 'timeline') wrap.append(timelineBody(v));
    else wrap.append(galleryBody(v));
    return wrap;
  };

  const boardBody = (v: View): HTMLElement => {
    const ws = ctx.ws();
    const { columns, prop } = boardColumns(ws, dbId, v);
    if (!prop) return h('div.wsempty', h('p', 'A board needs a select property to make its columns from. '), key('MAKE A STATUS', () => change(addProp(ctx.ws(), dbId, { name: 'Status', kind: 'select', options: ['To do', 'Doing', 'Done'] }).ws), 'on'));
    const board = h('div.wsboard', { role: 'group', 'aria-label': `Board by ${prop.name}` });
    const cols = columns.map((c) => {
      const el = h('section.wscol', { dataset: { col: c.key, none: c.none ? '1' : '' }, 'aria-label': `${c.name}, ${c.rows.length}` },
        h('header.wscolh', h('b', c.name), h('small', String(c.rows.length))),
        h('div.wscards', ...c.rows.map((r) => card(r, c.key, columns.filter((x) => !x.none || x.rows.length || c.none).map((x) => x.key), prop))),
        c.none ? '' : key('+', () => {
          const x = addRow(ctx.ws(), dbId, '', { [prop.id]: c.key });
          change(x.ws);
        }, 'wscoladd', `Add a row to ${c.name}`));
      return el;
    });
    board.append(...cols);
    return h('div.wsscroll.wsboardscroll', board);
  };
  const card = (r: Page, col: string, order: string[], prop: Prop): HTMLElement => {
    const s = ctx.ws();
    const d = db()!;
    const lines = visibleProps(d, view()).filter((p) => p.id !== prop.id && p.kind !== 'check').map((p) => shown(s, dbId, r, p).text).filter(Boolean).slice(0, 2);
    const idx = order.indexOf(col);
    const go = (to: string): void => {
      change(moveCard(ctx.ws(), r.id, prop.id, to));
      ctx.say(`“${titleOf(r)}” moved to ${to || `no ${prop.name.toLowerCase()}`}.`);
    };
    const mv = (by: -1 | 1, glyph: string): HTMLButtonElement => {
      const to = order[idx + by];
      const b = key(glyph, () => to !== undefined && go(to), 'wscardmv', `Move ${titleOf(r)} to ${to === undefined ? 'nowhere' : to || 'none'}`);
      b.disabled = to === undefined;
      return b;
    };
    const el = h('div.wscard', { dataset: { id: r.id } },
      mv(-1, '‹'),
      h('button.wscardopen', { type: 'button', 'aria-label': `Open ${titleOf(r)}` }, h('b', titleOf(r)), ...lines.map((l) => h('small', l))),
      mv(1, '›'));
    el.querySelector('.wscardopen')!.addEventListener('click', () => {
      if (!(el as HTMLElement & { _dragged?: boolean })._dragged) ctx.open(r.id);
      (el as HTMLElement & { _dragged?: boolean })._dragged = false;
    });
    dragCard(el, r.id, go);
    return el;
  };
  /** A card lifted and dropped on another column: a mouse drags at once, a finger holds for a moment first (so a swipe still scrolls). */
  const dragCard = (el: HTMLElement, id: string, drop: (to: string) => void): void => {
    el.addEventListener('pointerdown', (ev) => {
      if ((ev.target as HTMLElement).closest('.wscardmv')) return;
      const touch = ev.pointerType !== 'mouse';
      const sx = ev.clientX;
      const sy = ev.clientY;
      let lifted = !touch;
      let moved = false;
      let ghost: HTMLElement | null = null;
      let over: HTMLElement | null = null;
      // (a card held near the edge of the screen scrolls the board towards that edge, so a column off the screen can be reached)
      let edge = 0;
      const scroller = el.closest<HTMLElement>('.wsboardscroll');
      const auto = window.setInterval(() => {
        if (edge && scroller) scroller.scrollLeft += edge * 14;
      }, 16);
      const timer = touch ? window.setTimeout(() => {
        lifted = true;
        el.classList.add('lift');
      }, 280) : 0;
      const blockScroll = (e: TouchEvent): void => {
        if (lifted) e.preventDefault();
      };
      document.addEventListener('touchmove', blockScroll, { passive: false });
      const colAt = (x: number, y: number): HTMLElement | null => (document.elementsFromPoint(x, y).find((n) => n.classList?.contains('wscol')) as HTMLElement | undefined) ?? null;
      const move = (e: PointerEvent): void => {
        if (!lifted) {
          if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cleanup();
          return;
        }
        if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return;
        if (!moved) {
          moved = true;
          ghost = el.cloneNode(true) as HTMLElement;
          ghost.classList.add('wsghost');
          ghost.style.width = `${el.getBoundingClientRect().width}px`;
          document.body.append(ghost);
          el.classList.add('lift');
        }
        ghost!.style.transform = `translate(${e.clientX - 40}px, ${e.clientY - 24}px)`;
        edge = e.clientX > innerWidth - 56 ? 1 : e.clientX < 56 ? -1 : 0;
        const c = colAt(e.clientX, e.clientY);
        if (c !== over) {
          over?.classList.remove('over');
          over = c;
          over?.classList.add('over');
        }
      };
      const cleanup = (): void => {
        clearTimeout(timer);
        clearInterval(auto);
        document.removeEventListener('touchmove', blockScroll);
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        removeEventListener('pointercancel', cleanup);
        ghost?.remove();
        over?.classList.remove('over');
        el.classList.remove('lift');
      };
      const up = (e: PointerEvent): void => {
        const c = colAt(e.clientX, e.clientY);
        const was = moved;
        cleanup();
        if (was) {
          (el as HTMLElement & { _dragged?: boolean })._dragged = true;
          if (c && c.dataset.col !== undefined) {
            const from = el.closest<HTMLElement>('.wscol')?.dataset.col;
            if (c.dataset.col !== from) drop(c.dataset.col);
          }
        }
        void id;
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', cleanup);
    });
  };

  const calendarBody = (v: View): HTMLElement => {
    const ym = v.month ?? monthOf(ctx.today());
    const g = monthGrid(ctx.ws(), dbId, v, ym);
    if (!g.prop) return h('div.wsempty', h('p', 'A calendar needs a date property to put the rows on. '), key('MAKE A DATE', () => change(addProp(ctx.ws(), dbId, { name: 'Date', kind: 'date' }).ws), 'on'));
    const go = (n: number): void => {
      change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, month: addMonths(ym, n) })));
      day = '';
    };
    const head = h('div.wsrow.wscalhead', key('‹', () => go(-1), 'wsmonth', 'Last month'), h('b.wsmonthname', { 'aria-live': 'polite' }, monthWords(ym)), key('›', () => go(1), 'wsmonth', 'Next month'),
      key('TODAY', () => change(patchView(ctx.ws(), dbId, v.id, (y) => ({ ...y, month: monthOf(ctx.today()) }))), '', 'Back to this month'));
    const grid = h('div.wscal', { role: 'grid', 'aria-label': monthWords(ym) },
      ...WEEKDAYS.map((w) => h('span.wsdow', w)),
      ...g.weeks.flat().map((dd) => {
        const b = h('button.wsday', {
          type: 'button', role: 'gridcell', dataset: { day: dd.iso, in: dd.inMonth ? '1' : '', n: String(dd.rows.length), today: dd.iso === ctx.today() ? '1' : '' },
          'aria-label': `${dateWords(dd.iso)}${dd.rows.length ? `, ${dd.rows.length} ${dd.rows.length === 1 ? 'thing' : 'things'}` : ''}`, 'aria-pressed': String(day === dd.iso),
        }, h('i', String(dd.d)), ...dd.rows.slice(0, 2).map((r) => h('span.wsdot', titleOf(r))), dd.rows.length > 2 ? h('small', `+${dd.rows.length - 2}`) : '') as HTMLButtonElement;
        b.addEventListener('click', () => {
          day = day === dd.iso ? '' : dd.iso;
          paint();
        });
        return b;
      }));
    // swipe sideways for the next or last month
    let sx = 0;
    let sy = 0;
    grid.addEventListener('pointerdown', (e) => {
      sx = e.clientX;
      sy = e.clientY;
    });
    grid.addEventListener('pointerup', (e) => {
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 70 && Math.abs(e.clientY - sy) < 40) go(dx < 0 ? 1 : -1);
    });
    const dayBox = day
      ? h('div.wspanel.wsdaybox', { dataset: { day } }, h('small.wsh', dateWords(day).toUpperCase()),
        ...(g.weeks.flat().find((x) => x.iso === day)?.rows ?? []).map((r) => rowKey(r)),
        (g.weeks.flat().find((x) => x.iso === day)?.rows ?? []).length ? '' : h('p.wsnote', 'Nothing on this day.'),
        key('ADD A ROW ON THIS DAY', () => {
          const x = addRow(ctx.ws(), dbId, newRow.trim(), { [g.prop!.id]: day });
          newRow = '';
          change(x.ws);
        }, 'on'))
      : null;
    return h('div.wscalwrap', head, grid, ...(dayBox ? [dayBox] : []),
      g.undated.length ? h('p.wsnote', `${g.undated.length} without a date: ${g.undated.slice(0, 3).map(titleOf).join(', ')}${g.undated.length > 3 ? '…' : ''}`) : '');
  };

  const timelineBody = (v: View): HTMLElement => {
    const t = timelineBars(ctx.ws(), dbId, v);
    if (!t.prop) return h('div.wsempty', h('p', 'A timeline needs a date property to start its bars. '), key('MAKE A DATE', () => change(addProp(ctx.ws(), dbId, { name: 'Date', kind: 'date' }).ws), 'on'));
    if (!t.bars.length) return h('div.wsempty', h('p', `No row has a ${t.prop.name} yet, so there is nothing to draw. Give one a date.`));
    const span = Math.max(7, dayDiff(t.first, t.last) + 3);
    const first = addDays(t.first, -1);
    if (!px) px = Math.max(3, Math.min(48, Math.floor(300 / span)));
    const setPx = (n: number): void => {
      px = Math.max(1.5, Math.min(80, n));
      paint();
    };
    const label = px >= 24 ? 'days' : px >= 7 ? 'weeks' : 'months';
    const width = Math.round(span * px);
    const ticks: HTMLElement[] = [];
    for (let i = 0; i < span; i++) {
      const iso = addDays(first, i);
      const dd = Number(iso.slice(8));
      const mon = new Date(iso + 'T00:00:00Z').getUTCDay() === 1;
      if (px >= 24 || (px >= 7 && mon) || (px < 7 && dd === 1)) {
        ticks.push(h('span.wstick', { style: `left:${i * px}px` }, px >= 24 ? String(dd) : px >= 7 ? `${dd} ${monthWords(monthOf(iso)).slice(0, 3)}` : monthWords(monthOf(iso)).slice(0, 3)));
      }
    }
    const rows = t.bars.map((b) => {
      const left = dayDiff(first, b.start) * px;
      const wide = Math.max(44, b.days * px);
      const bar = h('button.wsbarbtn', { type: 'button', style: `left:${left}px;width:${wide}px`, dataset: { id: b.row.id, days: String(b.days) }, 'aria-label': `${titleOf(b.row)}, ${dateWords(b.start)}${b.days > 1 ? ` to ${dateWords(b.end)}` : ''}` }) as HTMLButtonElement;
      bar.addEventListener('click', () => ctx.open(b.row.id));
      // (the name sits beside its bar, never cut short inside it: the box scrolls)
      return h('div.wstlrow', bar, h('span.wsbarlabel', { style: `left:${left + wide + 6}px` }, titleOf(b.row)));
    });
    const area = h('div.wstl', { style: `width:${width + 160}px`, dataset: { px: String(Math.round(px * 10) / 10) } }, h('div.wsticks', ...ticks), ...rows);
    // pinch to zoom: two fingers apart, in; together, out
    const pts = new Map<number, number>();
    let base = 0;
    let basePx = px;
    const scroller = h('div.wsscroll.wstlscroll', area);
    scroller.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, e.clientX);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()] as [number, number];
        base = Math.abs(a - b);
        basePx = px;
      }
    });
    scroller.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, e.clientX);
      if (pts.size === 2 && base > 20) {
        const [a, b] = [...pts.values()] as [number, number];
        const nx = Math.max(1.5, Math.min(80, basePx * (Math.abs(a - b) / base)));
        if (Math.abs(nx - px) / px > 0.12) setPx(nx);
      }
    });
    const end = (e: PointerEvent): void => void pts.delete(e.pointerId);
    scroller.addEventListener('pointerup', end);
    scroller.addEventListener('pointercancel', end);
    return h('div.wstlwrap',
      h('div.wsrow', key('ZOOM IN', () => setPx(px * 1.6), '', 'Zoom in'), key('ZOOM OUT', () => setPx(px / 1.6), '', 'Zoom out'), h('small.wsnote', `Showing ${label}. Pinch, or use the keys.`)),
      scroller,
      t.undated.length ? h('p.wsnote', `${t.undated.length} without a ${t.prop.name}: ${t.undated.slice(0, 3).map(titleOf).join(', ')}${t.undated.length > 3 ? '…' : ''}`) : '');
  };

  const galleryBody = (v: View): HTMLElement => {
    const cards = galleryCards(ctx.ws(), dbId, v);
    return h('div.wsgallery', ...cards.map((c) => {
      const src = c.img ? ctx.image(c.img) : null;
      const b = h('button.wsgcard', { type: 'button', dataset: { id: c.row.id, pic: src ? '1' : '' }, 'aria-label': `Open ${c.title}` },
        h('span.wsgpic', src ? h('img', { src, alt: c.alt ?? '' }) : h('i', (c.title[0] ?? '·').toUpperCase())),
        h('b', c.title), ...c.lines.map((l) => h('small', l))) as HTMLButtonElement;
      b.addEventListener('click', () => ctx.open(c.row.id));
      return b;
    }));
  };

  ctx.subscribe(paint);
  paint();
  void isoOf;
  void errorWords;
  return root;
}
