// DOCUMENTS, PRO EDITION's own helpers for tests/docspro-*.mjs (the kit itself is tests/editorsharness.mjs; the paper tools' is editorspaperkit.mjs).
import { goDocs, docOf, exported } from './editorspaperkit.mjs';

export { goDocs, docOf, exported };

/** A document of his: a heading, body paragraphs, a second heading with its own, a list item. */
export const proDoc = (id = 'dpro', title = 'Boiler service') => ({
  id, title, kind: 'document', at: Date.now() + 4000,
  blocks: [
    { id: `${id}1`, t: 'h1', runs: [{ text: 'What happened' }] },
    { id: `${id}2`, t: 'p', runs: [{ text: 'The boiler stopped on Monday night.' }] },
    { id: `${id}3`, t: 'p', runs: [{ text: 'Please fix the tap soon.' }] },
    { id: `${id}4`, t: 'h1', runs: [{ text: 'What I ask' }] },
    { id: `${id}5`, t: 'p', runs: [{ text: 'Send an engineer this week.' }] },
    { id: `${id}6`, t: 'ul', runs: [{ text: 'Mornings are best' }] },
  ],
});

/** The document open on the phone, from MY DOCUMENTS. */
export async function openDoc(h, page, title) {
  await goDocs(page);
  await page.locator('.dcopen', { hasText: title }).first().click();
  return h.until(page, (t) => window.__ghosty?.docs?.view === 'doc' && window.__ghosty.docs.title === t, title);
}
export const pill = (page, id) => page.locator(`#pg-docs .dcpills button[data-panel="${id}"]`).click();
export const tool = (page, words) => page.locator('#pg-docs .dctools button', { hasText: new RegExp(`^${words}$`) }).click();
export const said = (page) => page.evaluate(() => window.__ghosty.docs.said);

/** A Word file put back into the editor through OPEN A FILE; resolves when it is open. */
export async function reopen(h, page, bytes, name) {
  await page.locator('.dcbar button', { hasText: 'MY DOCUMENTS' }).first().click();
  await page.setInputFiles('.dcsheet input[type=file][accept*=".docx"]', { name, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: bytes });
  return h.until(page, (n) => window.__ghosty?.docs?.view === 'doc' && /from a file|Kept in My documents/.test(window.__ghosty.docs.said) && JSON.parse(window.__ghosty.docs.json).from === n, name);
}
