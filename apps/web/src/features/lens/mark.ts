/**
 * MARK MY WORK (Lens → READ → MARK): a page of his own answers, read on the phone, marked by the brain the way SCHOOL
 * marks (POST /api/school/markwork: sums worked out by the code, short answers matched to the mark scheme, the rest by
 * the cheap model against it). The owner corrects the text first, since handwriting is hard for the phone to read
 * (said so on screen); he names the subject and the level (its bands), and may add the questions or the mark scheme,
 * typed, pasted or read from a second photo. The result: marks per question, the total, a band only "as this marking
 * scheme sees it" (never a real exam grade), a line for each miss, and KEEP AS REVISION CARDS puts the misses in
 * LEARN (POST /api/learn/card, general cards). Nothing is kept anywhere else: it is not a school record.
 */
import { headers } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { loadImageFile } from '../../vision/camera';
import { cleanOcr } from '../../vision/ocrtext';
import type { LensContext } from './index';

/** The brain's answer (apps/edge/src/school/markwork.ts `WorkResult`, with the misses as cards). */
export interface WorkMark {
  n: string;
  given: string;
  got: number;
  max: number;
  how: 'exact' | 'model' | 'pending' | 'unanswered';
  right?: string;
  missed?: string;
}
export interface WorkResult {
  subject: string;
  level: string;
  marks: WorkMark[];
  raw: number;
  max: number;
  grade: string;
  marked: { exact: number; model: number; pending: number };
  scheme: boolean;
  honest: string;
  wrong: string[];
  cards: { front: string; back: string }[];
}

/** What MARK is doing, for a spec at window.__ghosty.lens.mark. */
export interface MarkState {
  open: boolean;
  status: 'idle' | 'reading' | 'marking' | 'done' | 'error';
  result: WorkResult | null;
  kept: number;
  error: string;
}

const LEVELS: [string, string][] = [['ks2', 'KS2'], ['ks3', 'KS3'], ['gcse', 'GCSE'], ['alevel', 'A-LEVEL'], ['degree', 'DEGREE']];
const HOW: Record<WorkMark['how'], string> = { exact: 'checked exactly', model: 'marked by the model', pending: 'waiting for a marker', unanswered: 'not answered' };

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body), credentials: 'same-origin' });
  const j = (await r.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!r.ok) throw new Error(j?.error ?? (r.status === 401 ? 'Not signed in.' : `Ghosty could not be reached (${r.status}).`));
  return j as T;
}

/** The MARK view, in place of READ's panel; BACK TO READ puts READ back. */
export function openMark(L: LensContext, text: string, back: () => void): void {
  const S = L.state;
  const st: MarkState = { open: true, status: 'idle', result: null, kept: 0, error: '' };
  S.mark = st;
  let level = 'gcse';

  const answers = h('textarea.lensocr.markans', { rows: 8, placeholder: 'Your answers, one per question: "1) 7 + 5 = 12", "2) Paris"…', 'aria-label': 'Your answers, as read from the photo' });
  answers.value = text;
  const subject = h('input.marksubj', { placeholder: 'Subject, e.g. maths', 'aria-label': 'Subject', autocapitalize: 'none' });
  const scheme = h('textarea.lensocr.markscheme', { rows: 4, placeholder: 'The questions or the mark scheme, if you have them (optional): "1. 12 [1]", "2. Paris [1]"…', 'aria-label': 'The questions or the mark scheme' });
  const levels = h('div.row.wrap.marklevels');
  const paintLevels = () =>
    clear(levels, ...LEVELS.map(([id, label]) => {
      const b = button(label, () => {
        level = id;
        paintLevels();
      }, id === level ? 'on' : '');
      b.setAttribute('aria-pressed', String(id === level));
      // shown as written (KS2, GCSE, A-level), not sentence case
      b.dataset.label = label === 'A-LEVEL' ? 'A-level' : label === 'DEGREE' ? 'Degree' : label;
      return b;
    }));
  paintLevels();
  const out = h('div.stackf.markresult');
  const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'A photo of the questions or the mark scheme' });
  file.hidden = true;
  const schemePhoto = button('READ A PHOTO OF IT', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    st.status = 'reading';
    schemePhoto.disabled = true;
    try {
      const r = await L.reader.read(await loadImageFile(f, 2048), (s) => L.status(s, 'mid'));
      const t = cleanOcr(r);
      scheme.value = [scheme.value.trim(), t].filter(Boolean).join('\n');
      L.status(t ? 'mark scheme read · check it, then MARK IT' : 'No text found in that photo', t ? 'ok' : 'mid');
      st.status = 'idle';
    } catch (e) {
      st.status = 'error';
      st.error = String((e as Error)?.message ?? e);
      toast(`Could not read it: ${st.error}`, 'bad');
    } finally {
      schemePhoto.disabled = false;
    }
  });

  const render = (r: WorkResult) => {
    const list = h('div.marklist', ...r.marks.map((m) => {
      const ok = m.how !== 'pending' && m.got >= m.max;
      return h(`div.markq${ok ? '.ok' : m.how === 'pending' ? '.wait' : '.miss'}` as 'div',
        h('div.markqhead', h('b', `Q${m.n}`), h('span.markqmark', m.how === 'pending' ? '–' : `${m.got}/${m.max}`), h('span.markqhow', `${ok ? '✓ ' : m.how === 'pending' ? '' : '✗ '}${HOW[m.how]}`)),
        m.given ? h('div.markqgiven', m.given) : null,
        !ok && m.missed ? h('div.markqmiss', m.missed) : null);
    }));
    const keep = r.cards.length
      ? button(`KEEP AS REVISION CARDS (${r.cards.length})`, async (b) => {
        b.disabled = true;
        let kept = 0;
        for (const c of r.cards) {
          try {
            await post('/learn/card', { course: 'general', front: c.front, back: c.back });
            kept++;
          } catch {
            /* one card that fails is said below */
          }
        }
        st.kept = kept;
        b.textContent = kept ? `KEPT IN LEARN (${kept})` : 'KEEP AS REVISION CARDS';
        b.disabled = kept > 0;
        toast(kept === r.cards.length ? `${kept} revision card${kept === 1 ? '' : 's'} in LEARN · REVISE` : kept ? `${kept} of ${r.cards.length} cards kept: Ghosty could not be reached for the rest` : 'Could not keep the cards: Ghosty could not be reached', kept === r.cards.length ? 'ok' : 'warn');
      }, 'on')
      : null;
    clear(out,
      h('div.markhead', h('span.marktotal', `${r.raw} / ${r.max}`), h('span.markgrade', r.grade)),
      h('div.note.markhonest', r.honest),
      list,
      r.wrong.length ? h('div.markwrong', h('b', 'WHAT WAS MISSED'), ...r.wrong.map((w) => h('div', w))) : h('div.note', 'Nothing missed.'),
      h('div.row.wrap', keep, button('MARK AGAIN', () => void mark())),
      h('div.note', 'Not kept anywhere: this is your work, not a school record. The cards are yours to revise in LEARN.'));
  };

  const markBtn = button('MARK IT', () => void mark(), 'on');
  const mark = async () => {
    const a = answers.value.trim();
    if (!a) return void toast('No answers to mark: read a page first, or type them in', 'warn');
    st.status = 'marking';
    st.error = '';
    markBtn.disabled = true;
    clear(out, h('div.note', 'Marking… sums are worked out exactly; written answers go to the model with the mark scheme.'));
    L.status('marking your work…', 'mid');
    try {
      const r = await post<WorkResult>('/school/markwork', { subject: subject.value.trim(), level, answers: a, scheme: scheme.value.trim() });
      st.result = r;
      st.status = 'done';
      render(r);
      L.status(`marked: ${r.raw} of ${r.max}`, 'ok');
    } catch (e) {
      st.status = 'error';
      st.error = String((e as Error)?.message ?? e);
      clear(out, h('div.note.bad', `Could not mark it: ${st.error}`));
      L.status('marking failed', 'off');
    } finally {
      markBtn.disabled = false;
    }
  };

  clear(L.panel,
    h('div.stackf.markview',
      h('div.row', h('b.marktitle', 'MARK MY WORK'), button('BACK TO READ', () => {
        st.open = false;
        back();
      })),
      h('div.note.markwarn', 'Handwriting is hard for the phone to read: check every answer below and correct it before marking. One answer per line, numbered as on the page.'),
      answers,
      subject,
      levels,
      scheme,
      h('div.row.wrap', schemePhoto, markBtn),
      out),
    file);
}
