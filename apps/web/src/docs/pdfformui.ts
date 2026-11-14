/**
 * FILL AND SIGN A PDF, the screen (NEXT ROUND, editors.s12; DOCUMENTS → FILL AND SIGN A PDF, or "fill in a PDF form"): the PDF's pages
 * as pictures with its boxes marked, and each box as a field to type into, tick or choose from; SIGN opens a pad to draw a signature
 * with a finger (kept on this phone for next time only if he presses KEEP IT), then a tap on the page puts it there; UNDO steps back;
 * SAVE and SHARE make the filled PDF here (docs/pdfform.ts). What could not be filled is said by name. Nothing is sent anywhere.
 */
import { h, clear } from '../core/dom';
import { button, modal } from '../ui/components';
import { saveBlob, shareBlob } from '../convert/run';
import { sizeWords } from '../convert/bytes';
import { sayError } from '../ui/hisWords';
import { drawPage, fillForm, keepSignature, keptSignature, readForm, type FormField, type FormRead, type Placed, type Signature } from './pdfform';

/** What the checks read (window.__ghosty.pdfform). */
export const pdfFormState = { open: false, name: '', fields: 0, cannot: [] as string[], filled: 0, signed: false, placed: null as Placed | null, made: { name: '', size: 0 }, said: '', kept: false };
const expose = () => {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.pdfform = pdfFormState;
};

/** The screen, open on a PDF's bytes (or empty, saying to choose one). */
export function openPdfForm(bytes?: Uint8Array, name = ''): void {
  expose();
  let src: Uint8Array | null = bytes ?? null;
  let fileName = name;
  let form: FormRead | null = null;
  const values = new Map<string, string | boolean>();
  let sig: Signature | null = keptSignature();
  let placed: Placed | null = null;
  let placing = false;
  const past: { values: [string, string | boolean][]; placed: Placed | null }[] = [];
  const snap = () => {
    past.push({ values: [...values], placed });
    if (past.length > 60) past.shift();
  };

  const said = h('p.pprsaid', { 'aria-live': 'polite' });
  const say = (w: string) => {
    said.textContent = w;
    pdfFormState.said = w;
  };
  const fileIn = h('input', { type: 'file', hidden: true, accept: '.pdf,application/pdf', 'aria-label': 'Choose a PDF form' }) as HTMLInputElement;
  const pagesBox = h('div.pdfpages');
  const fieldsBox = h('div.pdffields');
  const sigBox = h('div.pdfsig');
  const outBox = h('div.dcouts');
  const body = h('div.pprsheet.pdfform', said, fileIn);

  const filledCount = () => form?.fields.filter((f) => {
    const v = values.has(f.id) ? values.get(f.id) : f.value;
    return typeof v === 'boolean' ? v : !!String(v ?? '').trim();
  }).length ?? 0;
  const paintState = () => {
    pdfFormState.fields = form?.fields.length ?? 0;
    pdfFormState.cannot = form?.cannot.map((c) => c.name) ?? [];
    pdfFormState.filled = filledCount();
    pdfFormState.signed = !!sig;
    pdfFormState.placed = placed;
  };

  // ---------------------------------------------------------------- the pages, with the boxes and the signature drawn on them
  const pageViews: { wrap: HTMLElement; scale: number; page: number }[] = [];
  const paintMarks = () => {
    for (const v of pageViews) {
      v.wrap.querySelectorAll('.pdfmark').forEach((e) => e.remove());
      const hgt = form!.sizes[v.page]!.h;
      const wid = form!.sizes[v.page]!.w;
      // placed in shares of the page, so a page drawn smaller than its picture still lines up
      const put = (el: HTMLElement, [x1, y1, x2, y2]: [number, number, number, number]) => {
        el.style.left = `${(x1 / wid) * 100}%`;
        el.style.top = `${((hgt - y2) / hgt) * 100}%`;
        el.style.width = `${((x2 - x1) / wid) * 100}%`;
        el.style.height = `${((y2 - y1) / hgt) * 100}%`;
      };
      for (const f of form!.fields.filter((x) => x.page === v.page)) {
        const m = h('span.pdfmark', { 'aria-hidden': 'true' });
        put(m, f.rect);
        const val = values.has(f.id) ? values.get(f.id)! : f.value;
        m.textContent = typeof val === 'boolean' ? (val ? '✓' : '') : String(val);
        v.wrap.append(m);
      }
      if (placed && placed.page === v.page && sig) {
        const [x1, y1, x2, y2] = placed.rect;
        const c = h('canvas.pdfmark.pdfsigmark', { 'aria-hidden': 'true' }) as HTMLCanvasElement;
        c.width = Math.max(1, Math.round((x2 - x1) * v.scale * 2));
        c.height = Math.max(1, Math.round((y2 - y1) * v.scale * 2));
        put(c, placed.rect);
        drawStrokes(c, sig);
        v.wrap.append(c);
      }
    }
  };
  const paintPages = async () => {
    if (!src || !form) return;
    clear(pagesBox);
    pageViews.length = 0;
    const width = Math.max(240, Math.min(560, (body.clientWidth || 360) - 8));
    for (let p = 0; p < form.pages && p < 12; p++) {
      const { canvas, scale } = await drawPage(src, p, width);
      canvas.className = 'pdfpage';
      canvas.setAttribute('aria-label', `Page ${p + 1} of the form${placing ? ': tap where your signature goes' : ''}`);
      const wrap = h('div.pdfwrap', canvas);
      wrap.addEventListener('click', (e) => {
        if (!placing || !sig || !form) return;
        const r = canvas.getBoundingClientRect();
        const k = canvas.width / r.width / scale;
        const px = (e.clientX - r.left) * k;
        const py = form.sizes[p]!.h - (e.clientY - r.top) * k;
        const w = Math.min(180, form.sizes[p]!.w * 0.4);
        const hh = w / Math.max(1, sig.aspect);
        snap();
        placed = { page: p, rect: [px - w / 2, py - hh / 2, px + w / 2, py + hh / 2] };
        placing = false;
        paintMarks();
        paintState();
        paintSig();
        say(`Your signature is on page ${p + 1}. UNDO takes it off; tap SIGN to move it.`);
      });
      pagesBox.append(wrap);
      pageViews.push({ wrap, scale, page: p });
    }
    if (form.pages > 12) pagesBox.append(h('small.dcnote', `The first 12 of ${form.pages} pages are shown; every page is kept in the PDF.`));
    paintMarks();
  };

  // ---------------------------------------------------------------- the boxes as fields
  const fieldEl = (f: FormField): HTMLElement => {
    const cur = values.has(f.id) ? values.get(f.id)! : f.value;
    const where = form!.pages > 1 ? ` (page ${f.page + 1})` : '';
    if (f.kind === 'check') {
      const box = h('button.pdftick', { type: 'button', role: 'checkbox', 'aria-checked': String(!!cur), 'aria-label': `${f.label}${where}` }, cur ? '✓' : '');
      box.addEventListener('click', () => {
        snap();
        const on = !(values.has(f.id) ? values.get(f.id) : f.value);
        values.set(f.id, on);
        box.setAttribute('aria-checked', String(on));
        box.textContent = on ? '✓' : '';
        paintMarks();
        paintState();
      });
      return h('div.pdfcheck', box, h('span', `${f.label}${where}`));
    }
    if (f.kind === 'choice') {
      const sel = h('select', { 'aria-label': `${f.label}${where}` }, h('option', { value: '' }, '—'), ...(f.options ?? []).map((o) => h('option', { value: o.value }, o.label))) as HTMLSelectElement;
      sel.value = String(cur);
      sel.addEventListener('change', () => {
        snap();
        values.set(f.id, sel.value);
        paintMarks();
        paintState();
      });
      return h('label.pprf', h('small', `${f.label}${where}`), sel);
    }
    const input = (f.multi ? h('textarea', { 'aria-label': `${f.label}${where}`, rows: 3 }) : h('input', { type: 'text', 'aria-label': `${f.label}${where}`, autocomplete: 'off' })) as HTMLInputElement;
    input.value = String(cur);
    let before = '';
    input.addEventListener('focus', () => (before = input.value));
    input.addEventListener('input', () => {
      values.set(f.id, input.value);
      paintState();
    });
    input.addEventListener('change', () => {
      if (input.value === before) return;
      // one UNDO step for each box he changed
      past.push({ values: [...values].map(([k, v]) => [k, k === f.id ? before : v] as [string, string | boolean]), placed });
      paintMarks();
    });
    return h('label.pprf', h('small', `${f.label}${where}`), input);
  };
  const paintFields = () => {
    if (!form) return clear(fieldsBox);
    clear(fieldsBox,
      h('h3.dch', `THE FORM’S BOXES · ${form.fields.length}`),
      ...(form.fields.length ? form.fields.map(fieldEl) : [h('p.dcnote', 'This PDF has no boxes to fill in. You can still sign it: SIGN, then tap the page.')]),
      ...(form.cannot.length ? [h('p.pdfcannot', `Not filled here: ${form.cannot.map((c) => `${c.name} (${c.why})`).join('; ')}.`)] : []),
    );
  };

  // ---------------------------------------------------------------- the signature pad
  const drawStrokes = (c: HTMLCanvasElement, s: Signature) => {
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    g.lineWidth = Math.max(2, c.width / 160);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--g-ink-1').trim() || 'currentColor';
    for (const st of s.strokes) {
      g.beginPath();
      for (let k = 0; k + 1 < st.length; k += 2) (k ? g.lineTo : g.moveTo).call(g, st[k]! * c.width, st[k + 1]! * c.height);
      if (st.length === 2) g.lineTo(st[0]! * c.width + 1, st[1]! * c.height);
      g.stroke();
    }
  };
  const paintSig = () => {
    clear(sigBox,
      h('h3.dch', 'YOUR SIGNATURE'),
      h('div.dcrow',
        button(sig ? 'SIGN AGAIN' : 'SIGN', () => openPad(), 'on'),
        ...(sig ? [button(placing ? 'TAP THE PAGE…' : 'PUT IT ON THE PAGE', () => {
          placing = true;
          paintSig();
          say('Tap the page where your signature goes.');
          pagesBox.scrollIntoView({ block: 'start', behavior: 'smooth' });
        })] : []),
        ...(placed ? [button('TAKE IT OFF', () => {
          snap();
          placed = null;
          paintMarks();
          paintState();
          paintSig();
          say('Your signature is taken off the page.');
        })] : []),
        ...(keptSignature() ? [button('FORGET MY SIGNATURE', () => {
          keepSignature(null);
          pdfFormState.kept = false;
          paintSig();
          say('Your signature is no longer kept on this phone.');
        })] : []),
      ),
      h('small.dcnote', keptSignature() ? 'Your signature is kept on this phone for next time (FORGET MY SIGNATURE lets it go).' : 'Your signature is not kept after you leave, unless you press KEEP IT when you draw it.'),
    );
  };
  const openPad = () => {
    const pad = h('canvas.pdfpad', { 'aria-label': 'Draw your signature here with your finger' }) as HTMLCanvasElement;
    const strokes: number[][] = [];
    let keepIt = false;
    let cur: number[] | null = null;
    const at = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))] as const;
    };
    const redraw = () => drawStrokes(pad, { strokes, aspect: 3 });
    pad.addEventListener('pointerdown', (e) => {
      pad.setPointerCapture(e.pointerId);
      cur = [...at(e)];
      strokes.push(cur);
      redraw();
      e.preventDefault();
    });
    pad.addEventListener('pointermove', (e) => {
      if (!cur) return;
      cur.push(...at(e));
      redraw();
    });
    const up = () => (cur = null);
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    const padSaid = h('p.pprsaid', { 'aria-live': 'polite' }, 'Sign with your finger in the box.');
    const keepBtn = button('KEEP IT', () => {
      keepIt = !keepIt;
      keepBtn.setAttribute('aria-pressed', String(keepIt));
      padSaid.textContent = keepIt ? 'It will be kept on this phone for next time.' : 'It will not be kept after you leave.';
    });
    keepBtn.setAttribute('aria-pressed', 'false');
    const m = modal('SIGN', h('div.pprsheet', pad, padSaid,
      h('div.dcrow',
        button('DONE', () => {
          if (!strokes.length) return void (padSaid.textContent = 'Sign in the box first.');
          sig = { strokes: strokes.map((s) => [...s]), aspect: pad.width / pad.height };
          if (keepIt) pdfFormState.kept = keepSignature(sig);
          placing = true;
          m.close();
          paintSig();
          paintState();
          if (placed) placed = null;
          paintMarks();
          say(`Signed${keepIt ? ' and kept on this phone' : ''}. Now tap the page where it goes.`);
        }, 'on'),
        button('CLEAR', () => {
          strokes.length = 0;
          redraw();
        }),
        keepBtn,
        button('CANCEL', () => m.close()),
      ),
    ));
    requestAnimationFrame(() => {
      const w = Math.max(240, pad.clientWidth || 320);
      pad.width = w * 2;
      pad.height = Math.round((w / 3) * 2);
    });
  };

  // ---------------------------------------------------------------- make it
  const make = async (share: boolean) => {
    if (!src || !form) return say('Choose a PDF form first.');
    (document.activeElement as HTMLElement | null)?.blur?.();
    say('Filling the PDF on this phone…');
    try {
      const changed = new Map<string, string | boolean>();
      for (const f of form.fields) if (values.has(f.id)) changed.set(f.id, values.get(f.id)!);
      const bytes = await fillForm(src, changed, sig, placed);
      const out = `${fileName.replace(/\.pdf$/i, '') || 'Form'} (filled).pdf`;
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      pdfFormState.made = { name: out, size: blob.size };
      clear(outBox, h('div.cvout', h('div.cvoutt', h('b', out), h('small', sizeWords(blob.size))), h('div.cvbtns', button('SAVE', () => saveBlob(blob, out)), button('SHARE', async () => {
        if (!(await shareBlob(blob, out))) saveBlob(blob, out);
      }))));
      if (share && !(await shareBlob(blob, out))) saveBlob(blob, out);
      const n = filledCount();
      say(`Made on this phone: ${out}, ${sizeWords(blob.size)}. ${n} of ${form.fields.length} box${form.fields.length === 1 ? '' : 'es'} filled${placed ? `, signed on page ${placed.page + 1}` : sig ? '; your signature is not on a page yet' : ''}.${form.cannot.length ? ` Not filled: ${form.cannot.map((c) => c.name).join(', ')}.` : ''}`);
    } catch (e) {
      say(sayError(e, 'fill the PDF'));
    }
  };

  const keys = h('div.dcrow',
    button('UNDO', () => {
      const p = past.pop();
      if (!p) return say('Nothing to undo.');
      values.clear();
      for (const [k, v] of p.values) values.set(k, v);
      placed = p.placed;
      paintFields();
      paintMarks();
      paintState();
      paintSig();
      say('Undone.');
    }),
    button('SAVE PDF', () => void make(false), 'on'),
    button('SHARE', () => void make(true)),
  );

  const load = async (b: Uint8Array, n: string) => {
    src = b;
    fileName = n;
    pdfFormState.name = n;
    values.clear();
    placed = null;
    past.length = 0;
    say(`Reading ${n} on this phone…`);
    clear(outBox);
    try {
      form = await readForm(b);
    } catch (e) {
      form = null;
      paintState();
      return say(sayError(e, 'read that PDF'));
    }
    paintState();
    clear(body, said, fileIn, h('div.dcrow', button('CHOOSE ANOTHER PDF', () => fileIn.click())), sigBox, pagesBox, fieldsBox, keys, outBox, h('small.dcnote', 'Filled and signed here; nothing is sent anywhere. The PDF keeps your words in its boxes, so any PDF reader shows them.'));
    paintSig();
    paintFields();
    await paintPages();
    const can = form.fields.length;
    say(`${form.title || n}: ${form.pages} page${form.pages === 1 ? '' : 's'}, ${can ? `${can} box${can === 1 ? '' : 'es'} to fill` : 'no boxes to fill (you can still sign it)'}.${form.cannot.length ? ` I cannot fill ${form.cannot.length === 1 ? 'one' : form.cannot.length}: ${form.cannot.map((c) => c.name).join(', ')}.` : ''}`);
  };
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') return say('That is not a PDF: choose a .pdf file.');
    await load(new Uint8Array(await f.arrayBuffer()), f.name);
  });

  clear(body, said, fileIn, h('p.dcnote', 'Choose a PDF form (a council form, a school slip, a lease): type into its boxes, tick its boxes, sign it with your finger, and save or share it. Nothing is sent anywhere.'), h('div.dcrow', button('CHOOSE A PDF', () => fileIn.click(), 'on')));
  say('No PDF chosen yet.');
  pdfFormState.open = true;
  modal('FILL IN AND SIGN', body, () => {
    pdfFormState.open = false;
  });
  if (src) void load(src, fileName || 'Form.pdf');
}
