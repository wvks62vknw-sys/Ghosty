/**
 * ONE HOME PAGE FOR YOUR SITES (NEXT ROUND, sites.u8): one link that lists only the pages he chose, so people have a single address for
 * everything he publishes. Which pages are on it is kept on this phone (he ticks ON MY HOME PAGE on a page's card in the Workshop);
 * PUBLISH MY HOME PAGE makes the page here, hands it over and asks in the chat, and it goes up only after his APPROVE, as every page.
 */
import { esc } from '../../../../packages/shared/src/sitekit/html';
import type { PublishedSite } from '../../../../packages/shared/src/protocol';

const KEY = 'ghosty.sites.home';
export const HOME_TITLE = 'My pages';
export const homeAsk = 'Publish my home page as a page';

export function chosen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
export function choose(name: string, on: boolean): string[] {
  const next = on ? [...new Set([...chosen(), name])] : chosen().filter((x) => x !== name);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* kept for this visit only */
  }
  return next;
}

/** The page: a title, and a card for each chosen page (its title and address), in the order of the list. No script. */
export function homePage(sites: PublishedSite[], urlOf: (s: PublishedSite) => string, owner = ''): string {
  const title = owner ? `${owner}: my pages` : HOME_TITLE;
  const cards = sites
    .map((s) => `<li><a href="${esc(urlOf(s))}" target="_top" rel="noopener"><b>${esc(s.title)}</b><span>${esc(urlOf(s).replace(/^https?:\/\//, ''))}</span></a></li>`)
    .join('\n');
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(`${title}: ${sites.length} page${sites.length === 1 ? '' : 's'}`)}">
<style>
body{margin:0;font:17px/1.45 -apple-system,system-ui,sans-serif;background:white;color:black}
main{max-width:34em;margin:0 auto;padding:calc(24px + env(safe-area-inset-top)) 16px 32px}
h1{font-size:28px;margin:0 0 16px}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
a{display:flex;flex-direction:column;gap:4px;min-height:44px;padding:14px 16px;border:1px solid silver;border-radius:12px;color:inherit;text-decoration:none}
a:focus-visible{outline:3px solid black}
span{font-size:14px;opacity:.7;overflow-wrap:anywhere}
@media (prefers-color-scheme:dark){body{background:black;color:white}a{border-color:dimgray}a:focus-visible{outline-color:white}}
</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
<ul>
${cards}
</ul>
</main>
</body>
</html>
`;
}
