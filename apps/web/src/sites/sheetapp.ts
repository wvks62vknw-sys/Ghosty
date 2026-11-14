/**
 * A SHEET AS A MINI-APP (NEXT ROUND, sites.s8): the first column of the sheet open in SHEETS, read on the phone, becomes a list app for
 * his Home Screen. The words go in his own chat message ("Make a list app called Shopping with: milk; eggs; bread"), so the brain gets
 * only what he chose, and the app is built after his APPROVE like every app. Up to 40 rows; a heading row is left out.
 */
export const MAX_ROWS = 40;

/** The first column of a CSV, without its heading, empty cells or repeats. */
export function firstColumn(csv: string): string[] {
  const rows = csv.replace(/\r/g, '').split('\n');
  const cell = (line: string): string => {
    if (line.startsWith('"')) {
      const m = /^"((?:[^"]|"")*)"/.exec(line);
      return m ? m[1]!.replace(/""/g, '"') : '';
    }
    return line.split(',')[0] ?? '';
  };
  const vals = rows.map((l) => cell(l).replace(/[;\n]/g, ' ').trim()).filter(Boolean);
  const seen = new Set<string>();
  return vals.slice(1).filter((v) => !seen.has(v.toLowerCase()) && (seen.add(v.toLowerCase()), true)).slice(0, MAX_ROWS);
}

/** What he says in the chat for it. */
export const sheetAppWords = (title: string, items: string[]): string => `Make a list app called ${title.replace(/[:;]/g, ' ').trim() || 'My list'} with: ${items.join('; ')}`;
