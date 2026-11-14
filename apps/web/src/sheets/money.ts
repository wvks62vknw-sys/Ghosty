/**
 * YOUR SPENDING AS A BUDGET SHEET (NEXT ROUND, editors.c1 with money.c4): MONEY's own figures (each month's money out by category, money in,
 * and the budgets he set, as the brain's spending sums give them) laid out as a fresh workbook to play with: SPENDING (months down, categories
 * across, each row's total and each column's total as formulas, money in and what was left), BUDGETS (each budget, what was spent this
 * month and what is left, as formulas), and a bar chart of each month's money out. A copy: changing it never changes his money. Pure.
 */
import { addr, colName, emptySheet, newBook, type Book, type Cell } from './model';

export interface MoneyMonth {
  month: string;
  out: number;
  in: number;
  categories: { c: string; spent: number }[];
}
export interface MoneyBudget {
  category: string;
  monthly: number;
  spent: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pounds = { n: 'currency' as const };

/** The workbook of his spending, months oldest first. `made` is the day it was made ("2026-11-14"), for its title. */
export function moneyBook(months: MoneyMonth[], budgets: MoneyBudget[], made: string): Book {
  const ms = [...months].sort((a, b) => a.month.localeCompare(b.month));
  // the categories, the biggest over all the months first
  const totals = new Map<string, number>();
  for (const m of ms) for (const x of m.categories) totals.set(x.c, (totals.get(x.c) ?? 0) + x.spent);
  const cats = [...totals].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const cells: Record<string, Cell> = {};
  const put = (r: number, c: number, cell: Cell) => (cells[addr(r, c)] = cell);
  const head = ['Month', ...cats.map(cap), 'Money out', 'Money in', 'Left over'];
  head.forEach((t, c) => put(0, c, { v: t, x: { b: 1, ...(c ? { a: 'r' as const } : {}) } }));
  const outCol = cats.length + 1;
  const last = ms.length;
  ms.forEach((m, i) => {
    const r = i + 1;
    put(r, 0, { v: `${MONTHS[+m.month.slice(5, 7) - 1]} ${m.month.slice(0, 4)}` });
    cats.forEach((c, j) => {
      const v = m.categories.find((x) => x.c === c)?.spent ?? 0;
      put(r, j + 1, { v: Math.round(v * 100) / 100, x: pounds });
    });
    put(r, outCol, { f: cats.length ? `SUM(B${r + 1}:${colName(cats.length)}${r + 1})` : '0', x: { ...pounds, b: 1 } });
    put(r, outCol + 1, { v: Math.round(m.in * 100) / 100, x: pounds });
    put(r, outCol + 2, { f: `${colName(outCol + 1)}${r + 1}-${colName(outCol)}${r + 1}`, x: pounds });
  });
  const tr = last + 1;
  put(tr, 0, { v: 'Total', x: { b: 1 } });
  for (let c = 1; c <= outCol + 2; c++) put(tr, c, { f: last ? `SUM(${colName(c)}2:${colName(c)}${last + 1})` : '0', x: { ...pounds, b: 1 } });
  put(tr + 1, 0, { v: 'Average', x: { i: 1 } });
  for (let c = 1; c <= outCol + 2; c++) put(tr + 1, c, { f: last ? `AVERAGE(${colName(c)}2:${colName(c)}${last + 1})` : '0', x: { ...pounds, i: 1 } });
  const widths: Record<number, number> = { 0: 120 };
  for (let c = 1; c <= outCol + 2; c++) widths[c] = 112;
  const spending = { ...emptySheet('Spending'), cells, widths, frozen: true };

  const bcells: Record<string, Cell> = {};
  ['Budget', 'A month', 'Spent this month', 'Left'].forEach((t, c) => (bcells[addr(0, c)] = { v: t, x: { b: 1, ...(c ? { a: 'r' as const } : {}) } }));
  budgets.forEach((b, i) => {
    const r = i + 2;
    bcells[`A${r}`] = { v: cap(b.category) };
    bcells[`B${r}`] = { v: Math.round(b.monthly * 100) / 100, x: pounds };
    bcells[`C${r}`] = { v: Math.round(b.spent * 100) / 100, x: pounds };
    bcells[`D${r}`] = { f: `B${r}-C${r}`, x: pounds };
  });
  if (budgets.length) {
    const r = budgets.length + 2;
    bcells[`A${r}`] = { v: 'Total', x: { b: 1 } };
    for (const c of ['B', 'C', 'D']) bcells[`${c}${r}`] = { f: `SUM(${c}2:${c}${r - 1})`, x: { ...pounds, b: 1 } };
  } else bcells.A2 = { v: 'No budgets set yet: set them in MONEY → BUDGETS, or type your own here.' };
  const budgetSheet = { ...emptySheet('Budgets'), cells: bcells, widths: { 0: 150, 1: 110, 2: 140, 3: 110 }, frozen: true };

  const book = newBook(`My spending, ${made}`);
  return {
    ...book,
    from: 'from MONEY',
    sheets: [spending, budgetSheet],
    charts: last ? [{ id: `${book.id}c`, sheet: 'Spending', kind: 'bars', title: 'Money out each month', labels: `A2:A${last + 1}`, values: `${colName(outCol)}2:${colName(outCol)}${last + 1}` }] : [],
  };
}
