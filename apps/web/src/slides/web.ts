/**
 * A DECK AT ITS OWN LINK (NEXT ROUND sites.s3, built with sites.s4): the deck as one read-only page that plays on any phone. Each slide
 * is drawn as a picture (the same drawing as the editor and the PDF) one under another, swiped like a book with the page's own scroll
 * snap; no script at all, so it runs under the strictest page policy. A skipped slide is left out; the notes stay on the phone.
 */
import { esc } from '../../../../packages/shared/src/sitekit/html';
import { textOf } from '../docs/model';
import type { Deck } from './model';
import { slideSvg } from './render';

const titleOf = (deck: Deck, i: number): string => {
  const s = deck.slides[i];
  return s ? textOf(s.title).trim() : '';
};

export function deckPage(deck: Deck, image: (id: string) => string | null): string {
  const shown = deck.slides.map((s, i) => ({ s, i })).filter((x) => !x.s.skip);
  const n = shown.length;
  const slides = shown
    .map(({ s, i }, k) => `<section aria-label="Slide ${k + 1} of ${n}${titleOf(deck, i) ? `: ${esc(titleOf(deck, i))}` : ''}">${slideSvg(deck, s, { image, n: k + 1, of: n })}</section>`)
    .join('\n');
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(deck.title || 'Slides')}</title>
<meta name="description" content="${esc(`${deck.title || 'Slides'}: ${n} slide${n === 1 ? '' : 's'}`)}">
<style>
html{scroll-snap-type:y mandatory;background:black;color:white}
body{margin:0;font:16px/1.4 -apple-system,system-ui,sans-serif}
header{padding:calc(16px + env(safe-area-inset-top)) 16px 8px;text-align:center}
h1{margin:0;font-size:20px}
header p{margin:4px 0 0;opacity:.7;font-size:14px}
section{scroll-snap-align:center;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}
section svg{display:block;width:100%;height:auto;max-height:calc(100dvh - 24px)}
@media (prefers-reduced-motion:reduce){html{scroll-snap-type:none}}
</style>
</head>
<body>
<header><h1>${esc(deck.title || 'Slides')}</h1><p>${n} slide${n === 1 ? '' : 's'} · swipe up for the next</p></header>
<main>
${slides}
</main>
</body>
</html>
`;
}
