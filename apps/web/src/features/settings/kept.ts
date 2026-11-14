/**
 * SETTINGS → PRIVACY → WHAT I KEEP ABOUT YOU (NEXT ROUND, polish3.s2, with memory.s6): everything kept about him, by kind, counted
 * where it lives, each with its own key to forget it. Memory and places live in his brain (counted from it; forgotten item by item
 * on their own screens, with UNDO there); his face and voice and the people he introduced live on this phone only (forgotten here,
 * asked first). EXPORT MY MEMORY gives everything remembered as one plain document he can keep or print, saved on the phone.
 */
import { brain } from '../../api/brain';
import { h } from '../../core/dom';
import { button, confirmSheet, row, toast } from '../../ui/components';
import { showPanel } from '../../ui/sections';
import { sayError } from '../../ui/hisWords';
import type { MemoryItem } from '../../../../../packages/shared/src/protocol';

export const KEPT_WORDS = {
  head: 'WHAT I KEEP ABOUT YOU',
  counting: 'Counting what I keep…',
  noBrain: 'I can’t reach my brain, so memory and places can’t be counted now.',
  memory: (n: number) => (n ? `${n} ${n === 1 ? 'thing' : 'things'} remembered, in your brain` : 'Nothing remembered yet'),
  places: (n: number, names: string[]) => (n ? `${n} ${n === 1 ? 'place' : 'places'} saved: ${names.slice(0, 3).join(', ')}${n > 3 ? ` and ${n - 3} more` : ''}` : 'No places saved'),
  faces: (me: boolean, others: number) => (me || others ? `${me ? 'Your face' : 'Not your face'}${others ? ` and ${others} ${others === 1 ? 'person' : 'people'} you introduced` : ''}, on this phone only` : 'No faces kept'),
  voices: (me: boolean, others: number) => (me || others ? `${me ? 'Your voice' : 'Not your voice'}${others ? ` and ${others} ${others === 1 ? 'person' : 'people'} you introduced` : ''}, on this phone only` : 'No voices kept'),
  exported: (name: string) => `Saved ${name}: everything I remember, as one document on your phone.`,
};

/** Everything remembered as one plain document, grouped by kind, newest first in each. Pure. */
export function memoryDocument(items: Pick<MemoryItem, 'kind' | 'text' | 'at'>[], now = Date.now()): string {
  const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const groups: [MemoryItem['kind'], string][] = [['profile', 'About you'], ['fact', 'Things you told me'], ['diary', 'Diary'], ['lesson', 'Lessons']];
  const out = [`What Ghosty remembers about you`, `Written on ${day(now)}: ${items.length} ${items.length === 1 ? 'thing' : 'things'}.`, ''];
  for (const [kind, title] of groups) {
    const some = items.filter((x) => x.kind === kind).sort((a, b) => b.at - a.at);
    if (!some.length) continue;
    out.push(title, ...some.map((x) => `- ${x.text.replace(/\s+/g, ' ').trim()} (${day(x.at)})`), '');
  }
  if (!items.length) out.push('Nothing remembered yet.');
  return `${out.join('\n').trimEnd()}\n`;
}

const keyRow = (k: string, v: string, ...keys: HTMLButtonElement[]) => {
  const r = row(k, v, null, { wrap: true });
  r.classList.add('keptrow');
  r.dataset.kept = k.toLowerCase();
  return h('div.keptkind', { dataset: { kind: k.toLowerCase() } }, r, keys.length ? h('div.keyrow', ...keys) : '');
};

/** The block, painted now and again on each open. */
export function keptBlock(): { el: HTMLElement; refresh(): Promise<void> } {
  const el = h('div.keptblock', h('div.lab', KEPT_WORDS.head));
  const body = h('div.keptbody');
  el.append(body);
  let painting = 0;
  const refresh = async () => {
    const mine = ++painting;
    body.replaceChildren(h('p.note.waiting', { dataset: { wait: KEPT_WORDS.counting } }, KEPT_WORDS.counting));
    const [mem, pl, faces, voices] = await Promise.all([
      brain.memoryTimeline().then((r) => r.items, () => null),
      brain.places().then((r) => r.places, () => null),
      import('../../vision/facestore').then((m) => m.knownFaces()).catch(() => []),
      import('../../assistant/voicestore').then((m) => m.knownVoices()).catch(() => []),
    ]);
    if (mine !== painting) return;
    const out: HTMLElement[] = [];
    if (!mem || !pl) out.push(h('p.note', { dataset: { case: 'keep' } }, KEPT_WORDS.noBrain));
    if (mem) {
      const open = button('OPEN TO FORGET', () => showPanel('memory', 'TIMELINE'));
      const exp = button('EXPORT MY MEMORY', async (b) => {
        b.disabled = true;
        try {
          const items = (await brain.memoryTimeline()).items;
          const name = `ghosty-memory-${new Date().toISOString().slice(0, 10)}.txt`;
          const blob = new Blob([memoryDocument(items)], { type: 'text/plain' });
          const run = await import('../../convert/run');
          if (!(await run.shareBlob(blob, name))) run.saveBlob(blob, name);
          toast(KEPT_WORDS.exported(name), 'ok');
        } catch (e) {
          toast(sayError(e, 'export your memory'), 'bad');
        } finally {
          b.disabled = false;
        }
      });
      exp.dataset.act = 'exportmemory';
      out.push(keyRow('MEMORY', KEPT_WORDS.memory(mem.length), open, exp));
    }
    if (pl) out.push(keyRow('PLACES', KEPT_WORDS.places(pl.length, pl.map((p) => p.label)), ...(pl.length ? [button('OPEN TO FORGET', () => showPanel('memory', 'ABOUT YOU'))] : [])));
    const meFace = faces.some((f) => f.id === 'me');
    const otherFaces = faces.filter((f) => f.id !== 'me').length;
    const forgetFaces = button('FORGET ALL FACES', async () => {
      if (!(await confirmSheet('Forget every face?', 'Your face and everyone you introduced go from this phone for good.', 'FORGET THEM'))) return;
      const fs = await import('../../vision/facestore');
      for (const f of await fs.knownFaces()) await fs.forgetFace(f.id);
      void refresh();
    }, 'warn');
    forgetFaces.dataset.act = 'forgetfaces';
    out.push(keyRow('FACES', KEPT_WORDS.faces(meFace, otherFaces), ...(faces.length ? [forgetFaces] : [])));
    const meVoice = voices.some((v) => v.id === 'me');
    const otherVoices = voices.filter((v) => v.id !== 'me').length;
    const forgetVoices = button('FORGET ALL VOICES', async () => {
      if (!(await confirmSheet('Forget every voice?', 'Your voice and everyone you introduced go from this phone for good.', 'FORGET THEM'))) return;
      const vs = await import('../../assistant/voicestore');
      for (const v of await vs.knownVoices()) await vs.forgetVoice(v.id);
      void refresh();
    }, 'warn');
    forgetVoices.dataset.act = 'forgetvoices';
    out.push(keyRow('VOICES', KEPT_WORDS.voices(meVoice, otherVoices), ...(voices.length ? [forgetVoices] : [])));
    body.replaceChildren(...out);
  };
  void refresh();
  return { el, refresh };
}
