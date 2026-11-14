/**
 * A MENU OR PRICE LIST PAGE FROM A SHEET (NEXT ROUND, sites.s6, reshaped to his rules): the first columns of the sheet open in SHEETS
 * (the item, its price, and a short note when there is a third column), made into one clean page here on the phone and handed over to
 * wait; it goes up only after his APPROVE in the chat, and every later change goes up the same way (never silently), each one undoable.
 * A row whose first cell ends with ":" (or has no price) is a heading.
 */
import { esc } from '../../../../packages/shared/src/sitekit/html';

export interface MenuRow {
  item: string;
  price: string;
  note: string;
}
const cells = (line: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
};
/** The sheet's rows as a menu: its heading row left out, empty rows dropped, 120 rows at most. */
export function menuRows(csv: string): MenuRow[] {
  const rows = csv.replace(/\r/g, '').split('\n').map(cells).filter((r) => r.some(Boolean));
  return rows.slice(1, 121).map((r) => ({ item: r[0] ?? '', price: r[1] ?? '', note: r[2] ?? '' })).filter((r) => r.item);
}
const priceOf = (p: string): string => (/^\d+(\.\d{1,2})?$/.test(p) ? `£${Number(p).toFixed(2)}` : p);

/** The page: the title, then each heading with its items and prices. No script. */
export function menuPage(title: string, rows: MenuRow[]): string {
  const parts: string[] = [];
  let open = false;
  for (const r of rows) {
    const heading = r.item.endsWith(':') || (!r.price && !r.note);
    if (heading) {
      if (open) parts.push('</ul>');
      parts.push(`<h2>${esc(r.item.replace(/:$/, ''))}</h2>`, '<ul>');
      open = true;
      continue;
    }
    if (!open) {
      parts.push('<ul>');
      open = true;
    }
    parts.push(`<li><div class="row"><span class="item">${esc(r.item)}</span><span class="price">${esc(priceOf(r.price))}</span></div>${r.note ? `<p>${esc(r.note)}</p>` : ''}</li>`);
  }
  if (open) parts.push('</ul>');
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(`${title}: ${rows.filter((r) => r.price).length} items with prices`)}">
<style>
body{margin:0;font:17px/1.45 Georgia,"Times New Roman",serif;background:white;color:black}
main{max-width:34em;margin:0 auto;padding:calc(24px + env(safe-area-inset-top)) 16px 40px}
h1{font:700 30px/1.15 -apple-system,system-ui,sans-serif;margin:0 0 8px}
h2{font:600 15px/1.3 -apple-system,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin:28px 0 8px;padding-bottom:6px;border-bottom:2px solid black}
ul{list-style:none;margin:0;padding:0}
li{padding:10px 0;border-bottom:1px solid gainsboro}
.row{display:flex;gap:12px;align-items:baseline}
.item{flex:1;overflow-wrap:anywhere}
.price{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:700}
li p{margin:4px 0 0;font-size:15px;color:dimgray}
@media (prefers-color-scheme:dark){body{background:black;color:white}h2{border-color:white}li{border-color:dimgray}li p{color:silver}}
</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
${parts.join('\n')}
</main>
</body>
</html>
`;
}
