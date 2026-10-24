/**
 * Agenda → SPENDING: the statements the owner downloads from his bank and adds here himself (CSV from any UK
 * bank) — no bank access, ever. Why here: the Agenda is where he plans his month (bills, reminders, what is
 * coming), and the money is part of that plan. Before the first import the card says plainly where a
 * statement goes (`PRIVACY`). Then: the month (categories, budget bars "£38 left this month", the rows — a tap
 * re-files one and the rule is remembered), the year, what changed since last month, subscriptions with the
 * yearly total, budgets in plain words, EXPORT AS CSV and FORGET ALL. The brain keeps the rows
 * (apps/edge/src/spending.ts); the sums are `packages/shared/src/spending.ts`.
 */
import { CATEGORIES, gbp, monthName, prevMonth, PRIVACY, type Category, type SpendingSummary, type SpendRow } from '../../../../../packages/shared/src/spending';
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { bar, button, empty, modal, panel, row, toast } from '../../ui/components';

type View = 'month' | 'year' | 'changes';
const COLOURS: Record<Category, string> = {
  groceries: '#52f2b5',
  'eating out': '#ff9a3c',
  transport: '#5ac8fa',
  bills: '#ffd24d',
  subscriptions: '#bf8cff',
  shopping: '#ff6fae',
  cash: '#9aa4b2',
  income: '#52f2b5',
  other: '#7d8590',
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** What a spec reads: window.__ghosty.spending. */
export const spendingState = { kept: 0, month: '', view: 'month' as View, budgets: [] as string[], subs: [] as string[], refiled: 0 };

export function spendingPanel(): { el: HTMLElement; refresh(): Promise<void> } {
  const p = panel('SPENDING', { footer: true, cls: 'spend', status: '' });
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.spending = spendingState;
  let s: SpendingSummary | null = null;
  let view: View = 'month';
  let all = false;
  const file = h('input', { type: 'file', accept: '.csv,text/csv', 'aria-label': 'Bank statement (CSV)', hidden: true });
  const pick = () => file.click();
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    p.setStatus('READING…', 'mid');
    try {
      const r = await brain.spendingImport(await f.text());
      const x = r.result;
      set(r);
      toast(
        `Added ${x.added} row${x.added === 1 ? '' : 's'}${x.bank ? ` from ${x.bank}` : ''}${x.duplicates ? ` · ${x.duplicates} already kept` : ''}${x.asked ? ` · ${x.asked} name${x.asked === 1 ? '' : 's'} sorted by the free AI` : ''}${x.unplaced ? ` · ${x.unplaced} to file yourself` : ''}`,
        'ok',
      );
    } catch (e) {
      toast(`Could not read that statement: ${(e as Error).message}`, 'bad');
      paint();
    }
  });

  const set = (x: SpendingSummary) => {
    // Anything but a summary (an old brain without the route) reads as offline.
    if (typeof x?.kept !== 'number' || !Array.isArray(x.months)) throw new Error('no spending on this brain yet');
    s = x;
    spendingState.kept = x.kept;
    spendingState.month = x.month;
    spendingState.budgets = x.budgets.map((b) => `${b.category}: ${b.line}`);
    spendingState.subs = x.subscriptions.map((v) => `${v.name} ${v.cadence} ${gbp(v.amount, true)}`);
    paint();
  };
  const load = async (month?: string) => {
    try {
      set(await brain.spending(month));
    } catch {
      p.setStatus('OFFLINE', 'off');
      if (!s) clear(p.body, empty('OFFLINE', 'The spending card needs the brain: try again in a moment.'));
    }
  };

  const refile = (r: SpendRow) => {
    const m = modal(`File “${r.t}” as…`, h(
      'div.refile',
      h('p.note', `Every row from ${r.k} goes there, and the next statement remembers it.`),
      h('div.chips', ...CATEGORIES.map((c) => button(cap(c), async () => {
        m.close();
        try {
          const x = await brain.spendingFile(r.k, c, s?.month ?? '');
          spendingState.refiled += x.filed;
          set(x);
          toast(`${x.filed} row${x.filed === 1 ? '' : 's'} filed as ${c}`, 'ok');
        } catch (e) {
          toast(`Could not file it: ${(e as Error).message}`, 'bad');
        }
      }, c === r.c ? 'on' : ''))),
    ));
  };

  const budgetIn = h('input', { placeholder: '£200 a month on eating out', 'aria-label': 'A budget in your words' });
  const setBudget = async () => {
    const words = budgetIn.value.trim();
    if (!words) return;
    try {
      const x = await brain.spendingBudget(words, s?.month ?? '');
      budgetIn.value = '';
      set(x);
      toast(x.set.monthly ? `Budget: ${gbp(x.set.monthly)} a month on ${x.set.category}` : `No budget on ${x.set.category} now`, 'ok');
    } catch (e) {
      toast((e as Error).message, 'warn');
    }
  };
  budgetIn.addEventListener('keydown', (e) => e.key === 'Enter' && void setBudget());

  const paint = () => {
    clear(p.body);
    if (!s) return;
    // Nothing to export or forget yet: the footer waits for the first statement.
    p.foot!.hidden = !s.kept;
    if (!s.kept) {
      p.setStatus('NO STATEMENT YET', 'mid');
      p.body.append(h('p.note.privacy', s.privacy || PRIVACY), h('div.keyrow', button('ADD STATEMENT', pick, 'on')));
      return;
    }
    p.setStatus(`${s.kept.toLocaleString('en-GB')} rows kept · up to ${s.cap.toLocaleString('en-GB')}`, 'ok');
    const i = s.months.indexOf(s.month);
    const tabs = h('div.tabs.spendtabs', ...(['month', 'year', 'changes'] as View[]).map((v) => button(v === 'changes' ? 'SINCE LAST MONTH' : v.toUpperCase(), () => {
      view = spendingState.view = v;
      paint();
    }, v === view ? 'on' : '')));
    const nav = h(
      'div.keyrow.spendnav',
      button('‹', () => void load(s!.months[i - 1])),
      h('b.mname', view === 'year' ? s.month.slice(0, 4) : `${monthName(s.month)} ${s.month.slice(0, 4)}`),
      button('›', () => void load(s!.months[i + 1])),
    );
    (nav.firstChild as HTMLButtonElement).disabled = i <= 0;
    (nav.lastChild as HTMLButtonElement).disabled = i >= s.months.length - 1;
    p.body.append(tabs, nav);
    if (view === 'month' && s.view) {
      const v = s.view;
      p.body.append(h('div.spendtot', h('b', `${gbp(v.out)} out`), h('span', ` · ${gbp(v.in)} in`)));
      if (s.budgets.length) {
        p.body.append(h('div.lab', 'BUDGETS'));
        for (const b of s.budgets) {
          const el = bar(cap(b.category), b.frac, b.line, b.left < 0 ? '#ff4d6a' : COLOURS[b.category]);
          el.classList.add('budget');
          if (b.left < 0) el.classList.add('over');
          p.body.append(el);
        }
      }
      p.body.append(h('div.keyrow.wrapit.budgetadd', budgetIn, button('SET BUDGET', () => void setBudget())));
      p.body.append(h('div.lab', 'BY CATEGORY'));
      const most = Math.max(1, ...v.categories.map((c) => c.spent));
      for (const c of v.categories) p.body.append(bar(cap(c.c), c.spent / most, gbp(c.spent), COLOURS[c.c]));
      if (s.subscriptions.length) {
        const year = s.subscriptions.reduce((k, x) => k + x.yearly, 0);
        p.body.append(h('div.lab', `SUBSCRIPTIONS · ${gbp(year)} A YEAR`));
        for (const x of s.subscriptions) {
          const r = row(x.cadence === 'monthly' ? 'MONTHLY' : 'YEARLY', h('span', h('b', x.name), x.was !== undefined ? h('small.note', ` was ${gbp(x.was, true)} until ${ddmm(x.changed!)}`) : null), `${gbp(x.amount, true)} · ${gbp(x.yearly)}/yr`, { wrap: true });
          r.classList.add('sub');
          p.body.append(r);
        }
      }
      p.body.append(h('div.lab', `ROWS · TAP ONE TO FILE IT`));
      const rows = all ? s.rows : s.rows.slice(0, 30);
      for (const r of rows) {
        const el = row(ddmm(r.d), h('span', r.t, h('small.cat', { dataset: { by: r.by } }, ` · ${r.c}${r.by === 'model' ? ' (AI)' : r.by === 'none' ? ' — tap to file' : ''}`)), gbp(r.a, true), { wrap: true, tone: r.a > 0 ? 'up' : undefined, onClick: () => refile(r) });
        el.classList.add('txn');
        el.dataset.k = r.k;
        p.body.append(el);
      }
      if (s.rows.length > rows.length) p.body.append(h('div.keyrow', button(`SHOW ALL ${s.rows.length}`, () => ((all = true), paint()))));
    } else if (view === 'year' && s.year) {
      const y = s.year;
      p.body.append(h('div.spendtot', h('b', `${gbp(y.out)} out`), h('span', ` · ${gbp(y.in)} in · ${y.months.length} month${y.months.length === 1 ? '' : 's'}`)));
      const most = Math.max(1, ...y.months.map((m) => m.out));
      for (const m of y.months) p.body.append(bar(monthName(m.month).slice(0, 3).toUpperCase(), m.out / most, gbp(m.out)));
      p.body.append(h('div.lab', 'BY CATEGORY'));
      for (const c of y.categories) p.body.append(row(cap(c.c), gbp(c.spent)));
    } else {
      p.body.append(h('div.lab', `${monthName(s.month).toUpperCase()} AGAINST ${monthName(prevMonth(s.month)).toUpperCase()}`), ...s.changes.map((l) => h('p.change', l)));
    }
    p.body.append(h('p.note.privacy', 'No bank access, ever: only what you add. Only names the rules can’t place go to a free AI.'));
  };

  p.el.append(file);
  p.foot!.append(
    button('ADD STATEMENT', pick),
    button('EXPORT AS CSV', async () => {
      try {
        const csv = await brain.spendingCsv();
        const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'ghosty-spending.csv' });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
      } catch (e) {
        toast(`Could not export: ${(e as Error).message}`, 'bad');
      }
    }),
    button('FORGET ALL', () => {
      const m = modal('Forget all spending?', h('div.confirm', h('p.note', 'Every row, rule and budget goes from the brain. Your bank is not touched: Ghosty never had access to it.'), h('div.row', button('CANCEL', () => m.close()), button('FORGET ALL', async () => {
        m.close();
        try {
          set(await brain.spendingForget());
          toast('Spending forgotten', 'ok');
        } catch (e) {
          toast(`Could not forget it: ${(e as Error).message}`, 'bad');
        }
      }, 'warn'))));
    }, 'warn'),
  );
  return { el: p.el, refresh: () => load(s?.month) };
}
