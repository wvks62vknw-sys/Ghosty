// THE RATCHET (BRIEF-SHELL, BRIEF-SHELL-2; the old look goes, never grows): the count of hard-coded hex colours, rgba() calls and px radii in
// the declarations of styles.css OUTSIDE THE SYSTEM section (which holds THE SCAN's and the shell's own drawing, all tokens) only goes down.
// Each pass writes its new number here. Before BRIEF-SHELL-2: 506 hex, 1,023 rgba, 475 px radii = 2,004; after: 506, 1,016, 470 = 1,992.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export const CEILING = { hex: 506, rgba: 1016, radiusPx: 470, total: 1992 };
const css = readFileSync(new URL('../../web/styles.css', import.meta.url), 'utf8');

export function count(text) {
  const a = text.indexOf('THE SYSTEM (BRIEF-DESIGN-SYSTEM');
  const start = text.lastIndexOf('/* ===', a);
  const end = text.indexOf('/* ==== end THE SYSTEM ==== */');
  const outside = (text.slice(0, start) + text.slice(end + 30)).replace(/\/\*[\s\S]*?\*\//g, '');
  const decls = [...outside.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]).join(';');
  const hex = (decls.match(/(?<![\w-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])/g) ?? []).length;
  const rgba = (decls.match(/rgba?\(/g) ?? []).length;
  const radiusPx = decls.split(';').filter((d) => /border(-[a-z]+)*-radius\s*:/.test(d)).reduce((n, d) => n + (d.match(/\d*\.?\d+px/g) ?? []).length, 0);
  return { hex, rgba, radiusPx, total: hex + rgba + radiusPx };
}

test('the old look only goes down: hex colours, rgba() calls and px radii outside THE SYSTEM', () => {
  const now = count(css);
  console.log(`ratchet: ${JSON.stringify(now)} (ceiling ${JSON.stringify(CEILING)})`);
  for (const k of Object.keys(CEILING)) assert.ok(now[k] <= CEILING[k], `${k}: ${now[k]} is over ${CEILING[k]}; the old look must not grow (put new drawing in THE SYSTEM, in tokens)`);
});
test('the section the count leaves out holds no raw colour of its own', () => {
  const a = css.indexOf('THE SYSTEM (BRIEF-DESIGN-SYSTEM');
  const sys = css.slice(css.lastIndexOf('/* ===', a), css.indexOf('/* ==== end THE SYSTEM ==== */'));
  const shell = sys.slice(sys.indexOf('THE SHELL IN THE SCAN (BRIEF-SHELL-2'));
  assert.ok(shell.length > 1000);
  assert.equal((shell.replace(/\/\*[\s\S]*?\*\//g, '').match(/(?<![\w-])#[0-9a-fA-F]{3,8}(?![\w-])/g) ?? []).length, 0, 'a hex colour in the shell section');
});
