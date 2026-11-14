/**
 * THE TEMPLATE GALLERY (APPS ROUND, documents pro): a letter, a CV, a report, a newsletter and an invoice, each a real laid-out
 * document set in the named styles (its own look for each: the newsletter rounded, the invoice in sans), with his name and his
 * town filled in when Settings knows them and today's date. Every placeholder is in square brackets for him to type over. Pure.
 */
import { block, newDoc, newTable, type Block, type Doc, type Run } from './model';
import type { ParaFormat, StyleId } from './styles';

export type TemplateId = 'letter' | 'cv' | 'report' | 'newsletter' | 'invoice';
export interface Me {
  name?: string;
  town?: string;
  date: string;
}
export const TEMPLATES: { id: TemplateId; name: string; line: string }[] = [
  { id: 'letter', name: 'Letter', line: 'Your address and the date on the right, a greeting, three paragraphs and your name.' },
  { id: 'cv', name: 'CV', line: 'Your name large, a short profile, experience, education and skills.' },
  { id: 'report', name: 'Report', line: 'A summary, numbered sections, a table of figures and a caption.' },
  { id: 'newsletter', name: 'Newsletter', line: 'A masthead, a lead story, news in brief and dates for the diary.' },
  { id: 'invoice', name: 'Invoice', line: 'From and to, a numbered invoice, a table of work with the total, and how to pay.' },
];

const row = (...cells: string[]): Run[][] => cells.map((c) => (c ? [{ text: c }] : []));
const tableOf = (head: string[], rows: string[][]): Block => ({ ...newTable(1, head.length), rows: [row(...head), ...rows.map((r) => row(...r))], head: true });
const p = (text: string | Run[], fmt?: ParaFormat): Block => ({ ...block('p', text), ...(fmt ? { fmt } : {}) });

/** A template made into his new document. */
export function fromTemplate(id: TemplateId, me: Me): Doc {
  const name = me.name || '[Your name]';
  const town = me.town || '[Your town]';
  const styles = (s: Partial<Record<StyleId, ParaFormat>>) => s;
  if (id === 'letter') {
    const d = newDoc('[Subject of the letter]', [
      block('right', name),
      block('right', `[Your street]\n${town}\n[Postcode]`),
      block('right', me.date),
      p('[Their name]\n[Their street]\n[Their town and postcode]', { after: 18 }),
      p('Dear [their name],'),
      p('I am writing about [what it is about]. [Say what happened, with the dates.]'),
      p('[Say what you would like them to do, and by when.]'),
      p('[Anything else they need: a reference number, your phone number.]'),
      p('Yours sincerely,', { before: 12, after: 36 }),
      p(name),
    ], 'letter', 'a template: letter');
    return { ...d, styles: styles({ title: { size: 14, after: 18 }, p: { after: 10 } }) };
  }
  if (id === 'cv') {
    const d = newDoc(name, [
      { ...block('caption', `${town} · [phone] · [email]`) },
      block('h1', 'Profile'),
      p('[Two or three lines on who you are, what you are good at and the work you want next.]'),
      block('h1', 'Experience'),
      block('h2', '[Job title], [Employer]'),
      block('caption', '[Month year] to [month year]'),
      block('ul', '[What you did, with a number where you can: “ran a team of six”]'),
      block('ul', '[Something you changed for the better]'),
      block('h2', '[Job title], [Employer]'),
      block('caption', '[Month year] to [month year]'),
      block('ul', '[What you did]'),
      block('h1', 'Education'),
      p('[Qualification], [school or college], [year]'),
      block('h1', 'Skills'),
      p('[Skill] · [Skill] · [Skill] · [Language]'),
    ], 'document', 'a template: CV');
    return { ...d, styles: styles({ title: { size: 26, colour: 'blue', after: 4 }, h1: { size: 13, colour: 'blue', before: 16, after: 4 }, h2: { size: 11.5, before: 8, after: 0 }, caption: { italic: false, after: 4 }, p: { font: 'sans', size: 10.5 } }) };
  }
  if (id === 'report') {
    const d = newDoc('[Report title]', [
      block('caption', `${name} · ${me.date}`),
      block('h1', 'Summary'),
      p('[The whole report in three sentences: what you looked at, what you found, what should happen.]'),
      block('h1', '1. Background'),
      p('[Why this report was written, and for whom.]'),
      block('h1', '2. Findings'),
      block('h2', '2.1 [First finding]'),
      p('[What you found, with the evidence.]'),
      tableOf(['Item', 'Last year', 'This year'], [['[Item]', '[0]', '[0]'], ['[Item]', '[0]', '[0]'], ['Total', '[0]', '[0]']]),
      block('caption', 'Table 1: [what the table shows]'),
      block('h1', '3. Recommendations'),
      block('ol', '[What should be done first]'),
      block('ol', '[What next]'),
      block('quote', '[A line worth quoting from someone you spoke to.]'),
    ], 'document', 'a template: report');
    return { ...d, styles: styles({ title: { size: 24, after: 6 }, h1: { colour: 'blue' }, p: { line: 1.5 } }), page: { size: 'a4', margin: 'normal', numbers: true, footer: '[Report title]' } };
  }
  if (id === 'newsletter') {
    const d = newDoc('[The Newsletter]', [
      block('caption', `Issue [1] · ${me.date} · from ${name}`),
      block('h1', '[The lead story’s headline]'),
      p('[The lead story: who, what, when and where in the first two lines, then the rest.]'),
      block('quote', '[A line from someone in the story.]'),
      block('h2', 'News in brief'),
      block('ul', '[A short piece of news]'),
      block('ul', '[Another short piece of news]'),
      block('h2', 'Dates for the diary'),
      tableOf(['When', 'What', 'Where'], [['[Date]', '[Event]', `[Place in ${town}]`], ['[Date]', '[Event]', '[Place]']]),
      block('h2', 'And finally'),
      p('[Something light to finish on.]'),
    ], 'document', 'a template: newsletter');
    return { ...d, styles: styles({ title: { font: 'rounded', size: 30, colour: 'orange', after: 2 }, h1: { font: 'rounded', size: 20 }, h2: { font: 'rounded', colour: 'orange' }, p: { font: 'sans' }, caption: { italic: false, after: 14 } }) };
  }
  const d = newDoc('Invoice [0001]', [
    block('right', `${name}\n[Your street]\n${town}\n[Phone or email]`),
    block('h2', 'Bill to'),
    p('[Their name]\n[Their address]'),
    p([{ text: 'Date: ', b: true }, { text: me.date }, { text: '\nDue: ', b: true }, { text: '[date, 30 days on]' }]),
    tableOf(['Work', 'Hours or items', 'Rate', 'Amount'], [['[What you did]', '[0]', '£[0.00]', '£[0.00]'], ['[What you did]', '[0]', '£[0.00]', '£[0.00]'], ['', '', 'Total', '£[0.00]']]),
    block('h2', 'How to pay'),
    p('[Bank name] · sort code [00-00-00] · account [00000000] · reference Invoice [0001]'),
    block('caption', 'Thank you for your business.'),
  ], 'document', 'a template: invoice');
  return { ...d, styles: styles({ title: { size: 22, colour: 'green' }, h2: { colour: 'green', before: 14 }, p: { font: 'sans', size: 10.5 }, caption: { size: 10 } }) };
}
