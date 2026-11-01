/**
 * THE CONVERT SHEET (BRIEF-REST-E part 1; MAKE → CONVERT, "convert this to PDF", a file dropped on the chat): choose or
 * drop a file (or several) → what it is and its size → the conversions that apply → done on this phone with a progress
 * line → SAVE and SHARE (the iPhone's share sheet; a plain download elsewhere), each result's size said. The tools that
 * take no file sit under it: a QR code made, units, money at a rate, base64, Unix time, a pasted table, a recording.
 * Video is said as not done. Nothing is uploaded anywhere.
 */
import { h, clear } from '../core/dom';
import { button, modal, toast } from '../ui/components';
import { KIND_WORDS, MIME, sizeWords, VIDEO_KINDS, type Kind } from './bytes';
import { forKinds, GROUP_WORDS, VIDEO_LINE, type Conversion } from './list';
import { makeQr, qrPng, qrSvg, wifiText, type Ecc } from './qr';
import { base64Asked, convertUnits, dateToUnix, nice, unitOf, unitsAsked, unixAsked, unixToDate } from './units';
import { base64ToText, textToBase64 } from './bytes';
import { pastedTable, toCsv } from './table';
import { encodeWav } from './audio';
import { decodeSound, pick, runConversion, saveBlob, shareBlob, zipOf, type Output, type Picked } from './run';
import { pdfPageCount } from './pdfpages';
import { noteConverted } from './tally';
import { run } from '../commands/registry';
import type { Doc } from '../docs/model';

/** A document read here, opened in DOCUMENTS (the sheet's command: MAKE → DOCUMENTS). */
const openDoc = async (doc: Doc) => {
  if (!(await run('open_docs', { doc }))) toast('DOCUMENTS isn’t in this build', 'warn');
};

export const convertState = { open: false, picked: [] as { name: string; kind: string; size: number }[], offered: [] as string[], outputs: [] as { name: string; size: number; type: string; note?: string }[], said: '', runs: 0 };
let current: { close(): void } | null = null;

/** The sheet, with these files already chosen (dropped on the chat, or "convert this") or a tool opened. */
export async function openConvert(files: File[] = [], o: { tool?: string; conversion?: string; to?: string } = {}): Promise<void> {
  current?.close();
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.convert = convertState;
  convertState.open = true;
  convertState.outputs = [];
  let picked: Picked[] = [];
  let outputs: Output[] = [];
  let chosen: Conversion | null = null;
  // what his words asked for ("convert this to PDF"): chosen as soon as a file it takes is picked
  let wanted = o.conversion ?? '';

  const fileIn = h('input', { type: 'file', multiple: true, hidden: true, 'aria-label': 'Choose files to convert' }) as HTMLInputElement;
  const drop = h('div.cvdrop', { role: 'group', 'aria-label': 'Choose or drop files' },
    button('CHOOSE FILES', () => fileIn.click(), 'on'),
    h('span', 'or drop them here. Pictures, PDFs, Word, tables, sound.'),
  );
  const list = h('div.cvfiles');
  const convs = h('div.cvconvs');
  const optsBox = h('div.cvopts');
  const status = h('p.cvstatus', { 'aria-live': 'polite' }, 'Everything here happens on this phone: nothing is uploaded anywhere.');
  const results = h('div.cvresults');
  const tools = h('div.cvtools');
  const toolBox = h('div.cvtool');

  const say = (words: string) => {
    status.textContent = words;
    convertState.said = words;
  };

  const paintFiles = () => {
    convertState.picked = picked.map((p) => ({ name: p.file.name, kind: p.kind, size: p.file.size }));
    clear(list, ...picked.map((p, i) => h('div.cvfile',
      h('b', p.file.name),
      h('small', `${KIND_WORDS[p.kind]}, ${sizeWords(p.file.size)}`),
      button('×', () => {
        picked.splice(i, 1);
        paintFiles();
        paintConvs();
      }, 'cvx'),
    )));
    list.querySelectorAll('button.cvx').forEach((b, i) => b.setAttribute('aria-label', `Remove ${picked[i]?.file.name ?? 'this file'}`));
  };

  const paintConvs = () => {
    chosen = null;
    clear(optsBox);
    const kinds = picked.map((p) => p.kind);
    if (!picked.length) {
      convertState.offered = [];
      clear(convs);
      return;
    }
    if (kinds.some((k) => VIDEO_KINDS.includes(k))) {
      convertState.offered = [];
      clear(convs, h('p.cvnote', VIDEO_LINE), button('SHARE THE VIDEO', () => void shareOrSave(picked[0]!.file, picked[0]!.file.name)));
      return;
    }
    const offered = forKinds(kinds);
    convertState.offered = offered.map((c) => c.id);
    if (!offered.length) {
      clear(convs, h('p.cvnote', picked.length > 1 ? 'Nothing here takes these files together: convert them one kind at a time.' : `I have no conversion for ${KIND_WORDS[kinds[0]!]}.`));
      return;
    }
    const groups = [...new Set(offered.map((c) => c.group))];
    clear(convs, ...groups.map((g) => h('div.cvgroup',
      h('small.cvgh', GROUP_WORDS[g]),
      h('div.cvbtns', ...offered.filter((c) => c.group === g).map((c) => {
        const b = button(c.label, () => choose(c, b), 'cvbtn');
        b.dataset.id = c.id;
        if (c.note) b.title = c.note;
        return b;
      })),
    )));
  };

  const field = (label: string, input: HTMLInputElement | HTMLSelectElement) => h('label.cvfield', h('span', label), input);
  const choose = (c: Conversion, b: HTMLButtonElement) => {
    chosen = c;
    convs.querySelectorAll('button.cvbtn').forEach((x) => x.classList.toggle('on', x === b));
    const go = button('CONVERT', () => void runIt(), 'on cvgo');
    const parts: HTMLElement[] = [];
    if (c.id === 'img-resize') parts.push(field('Width in pixels', h('input', { type: 'number', min: '16', max: '8000', value: '1200', name: 'width', inputMode: 'numeric' }) as HTMLInputElement));
    if (c.id === 'img-compress') parts.push(field('Under this size (KB)', h('input', { type: 'number', min: '5', value: '500', name: 'kb', inputMode: 'numeric' }) as HTMLInputElement));
    if (c.id === 'img-crop') parts.push(field('Shape', h('select', { name: 'ratio' }, ...['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '4:5'].map((r) => h('option', { value: r }, r === '1:1' ? 'Square (1:1)' : r)))));
    if (c.id === 'images-pdf') parts.push(field('Page size', h('select', { name: 'size' }, h('option', { value: 'a4' }, 'A4'), h('option', { value: 'fit' }, 'The picture’s own shape'))));
    if (c.id === 'pdf-split' || c.id === 'pdf-png') {
      const pages = h('input', { type: 'text', name: 'pages', placeholder: c.id === 'pdf-png' ? 'All (up to 50)' : 'e.g. 1-3, 5', autocomplete: 'off' }) as HTMLInputElement;
      parts.push(field(c.id === 'pdf-png' ? 'Which pages' : 'Pages to take out', pages));
      void picked[0]!.file.arrayBuffer().then((buf) => {
        try {
          pages.placeholder = `${pages.placeholder} of ${pdfPageCount(new Uint8Array(buf))}`;
        } catch {
          /* the count is a nicety */
        }
      });
    }
    if (c.id === 'audio-trim') parts.push(field('Keep from … to …', h('input', { type: 'text', name: 'range', placeholder: '0:05 to 0:20', autocomplete: 'off' }) as HTMLInputElement));
    if (c.id === 'audio-mp3') parts.push(field('Quality', h('select', { name: 'kbps' }, h('option', { value: '128' }, '128 kbps (good)'), h('option', { value: '192' }, '192 kbps (better)'), h('option', { value: '64' }, '64 kbps (voice)'))));
    if (c.note) parts.push(h('p.cvnote', `Note: ${c.note}.`));
    clear(optsBox, ...parts, go);
  };

  const shareOrSave = async (blob: Blob, name: string) => {
    if (!(await shareBlob(blob, name))) saveBlob(blob, name);
  };

  const paintResults = () => {
    convertState.outputs = outputs.map((o) => ({ name: o.name, size: o.blob.size, type: o.blob.type, ...(o.note ? { note: o.note } : {}) }));
    const rows = outputs.map((o) => h('div.cvout',
      h('div.cvoutt', h('b', o.name), h('small', `${sizeWords(o.blob.size)}${o.note ? ` · ${o.note}` : ''}`)),
      h('div.cvbtns',
        o.doc ? button('OPEN', () => void openDoc(o.doc!)) : null,
        button('SAVE', () => saveBlob(o.blob, o.name)),
        button('SHARE', () => void shareOrSave(o.blob, o.name)),
      ),
    ));
    clear(results, ...rows, outputs.length > 1 ? button(`SAVE ALL ${outputs.length} (ZIP)`, () => void zipOf(outputs).then((z) => saveBlob(z, 'converted.zip'))) : null);
  };

  const runIt = async () => {
    if (!chosen) return;
    const opts: Record<string, string> = {};
    optsBox.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name], select[name]').forEach((i) => (opts[i.name] = i.value));
    say(`Converting on this phone: ${chosen.label.toLowerCase()}…`);
    clear(results);
    try {
      outputs = await runConversion(chosen.id, picked, opts, (words, frac) => say(`${chosen?.label ?? ''}: ${words}${frac !== undefined ? ` (${Math.round(frac * 100)}%)` : ''}`));
      convertState.runs++;
      noteConverted(`${picked[0]?.kind.toUpperCase() ?? ''} ${chosen.label.toLowerCase()}`.trim());
      paintResults();
      say(`Done on this phone: ${outputs.length === 1 ? `${outputs[0]!.name}, ${sizeWords(outputs[0]!.blob.size)}` : `${outputs.length} files, ${sizeWords(outputs.reduce((n, o) => n + o.blob.size, 0))} in all`}.`);
      if (outputs.length === 1 && outputs[0]!.doc) void openDoc(outputs[0]!.doc);
    } catch (e) {
      say(`I couldn’t: ${(e as Error).message}.`);
    }
  };

  const add = async (files: File[]) => {
    for (const f of files) picked.push(await pick(f));
    paintFiles();
    paintConvs();
    clear(results);
    if (picked.length) say(`${picked.length === 1 ? 'One file' : `${picked.length} files`}: pick what to make.`);
    const pre = (wanted && convs.querySelector<HTMLButtonElement>(`button.cvbtn[data-id="${wanted}"]`)) || (o.to && [...convs.querySelectorAll<HTMLButtonElement>('button.cvbtn')].find((b) => forKinds(picked.map((p) => p.kind)).find((c) => c.id === b.dataset.id)?.to === o.to));
    if (pre) pre.click();
  };
  fileIn.addEventListener('change', () => {
    const fs = [...(fileIn.files ?? [])];
    fileIn.value = '';
    void add(fs);
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    void add([...(e.dataTransfer?.files ?? [])]);
  });

  // ---------------------------------------------------------------- the tools with no file
  const TOOLS: [string, string, () => HTMLElement[]][] = [
    ['qr-make', 'QR CODE', qrTool],
    ['units', 'UNITS', unitsTool],
    ['money', 'MONEY', moneyTool],
    ['base64', 'BASE64', base64Tool],
    ['unix-time', 'UNIX TIME', unixTool],
    ['table-csv', 'PASTE A TABLE', tableTool],
    ['record-wav', 'RECORD', recordTool],
  ];
  const openTool = (id: string) => {
    const t = TOOLS.find((x) => x[0] === id);
    if (!t) return;
    tools.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    clear(toolBox, ...t[2]());
    (toolBox.querySelector('input, textarea') as HTMLElement | null)?.focus();
  };
  clear(tools, h('small.cvgh', 'NO FILE NEEDED'), h('div.cvbtns', ...TOOLS.map(([id, label]) => {
    const b = button(label, () => openTool(id), 'cvtoolbtn');
    b.dataset.id = id;
    return b;
  })));

  function outRow(blob: Blob, name: string): HTMLElement {
    return h('div.cvout', h('div.cvoutt', h('b', name), h('small', sizeWords(blob.size))), h('div.cvbtns', button('SAVE', () => saveBlob(blob, name)), button('SHARE', () => void shareOrSave(blob, name))));
  }
  function qrTool(): HTMLElement[] {
    const kind = h('select', { 'aria-label': 'What the code holds' }, h('option', { value: 'text' }, 'Words or a link'), h('option', { value: 'wifi' }, 'Wi-Fi details')) as HTMLSelectElement;
    const text = h('textarea.cvta', { rows: 3, placeholder: 'Words, or a link like https://…', 'aria-label': 'What the QR code says' }) as HTMLTextAreaElement;
    const ssid = h('input', { type: 'text', placeholder: 'Network name', 'aria-label': 'Wi-Fi network name', autocomplete: 'off' }) as HTMLInputElement;
    const pass = h('input', { type: 'text', placeholder: 'Password', 'aria-label': 'Wi-Fi password', autocomplete: 'off' }) as HTMLInputElement;
    const ecc = h('select', { 'aria-label': 'How much damage it survives' }, h('option', { value: 'M' }, 'Usual'), h('option', { value: 'H' }, 'Tough (survives a scratch)'), h('option', { value: 'L' }, 'Smallest')) as HTMLSelectElement;
    const wifi = h('div.cvrow', ssid, pass);
    wifi.hidden = true;
    kind.addEventListener('change', () => {
      wifi.hidden = kind.value !== 'wifi';
      text.hidden = kind.value === 'wifi';
    });
    const show = h('div.cvqr');
    const make = button('MAKE THE CODE', () => {
      try {
        const words = kind.value === 'wifi' ? wifiText(ssid.value.trim(), pass.value) : text.value.trim();
        if (!words || (kind.value === 'wifi' && !ssid.value.trim())) return say(kind.value === 'wifi' ? 'Type the network’s name first.' : 'Type the words or the link first.');
        const q = makeQr(words, ecc.value as Ecc);
        const png = new Blob([qrPng(q, 10) as BlobPart], { type: 'image/png' });
        const svg = new Blob([qrSvg(q)], { type: 'image/svg+xml' });
        const img = h('img', { src: URL.createObjectURL(png), alt: `QR code: ${kind.value === 'wifi' ? `Wi-Fi network ${ssid.value.trim()}` : words.slice(0, 80)}` }) as HTMLImageElement;
        clear(show, img, outRow(png, 'qr-code.png'), outRow(svg, 'qr-code.svg'));
        convertState.outputs = [{ name: 'qr-code.png', size: png.size, type: 'image/png', note: `version ${q.version}` }];
        say(`Made on this phone: a QR code (version ${q.version}, ${q.size} × ${q.size}). A phone’s camera reads it.`);
      } catch (e) {
        say(`I couldn’t: ${(e as Error).message}.`);
      }
    }, 'on');
    return [h('div.cvrow', kind, ecc), text, wifi, make, show];
  }
  function unitsTool(): HTMLElement[] {
    const q = h('input', { type: 'text', placeholder: '3.5 miles in km', 'aria-label': 'A measurement and what to turn it into', autocomplete: 'off', enterKeyHint: 'go' }) as HTMLInputElement;
    const ans = h('p.cvans', { 'aria-live': 'polite' });
    const go = () => {
      const r = unitsAsked(q.value);
      ans.textContent = r ? `${r.text}.` : 'Say it like “3.5 miles in km”, “100 F in C”, “5 ft 10 in cm” or “2 pints in litres”.';
    };
    q.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    return [h('div.cvrow', q, button('CONVERT', go, 'on')), ans, h('p.cvnote', 'Lengths, weights, volumes, areas, speeds, temperatures, time, data sizes, energy, power, pressure and fuel use.')];
  }
  function moneyTool(): HTMLElement[] {
    const amount = h('input', { type: 'number', step: 'any', placeholder: '40', 'aria-label': 'How much', inputMode: 'decimal' }) as HTMLInputElement;
    const rate = h('input', { type: 'number', step: 'any', placeholder: 'The rate, e.g. 1.15', 'aria-label': 'The exchange rate (how many of the other currency one buys)', inputMode: 'decimal' }) as HTMLInputElement;
    const ans = h('p.cvans', { 'aria-live': 'polite' });
    const go = () => {
      const a = Number(amount.value);
      const r = Number(rate.value);
      ans.textContent = a && r ? `${nice(a)} at ${r} is ${nice(a * r)}.` : 'Type the amount and the rate.';
    };
    const ask = button('ASK ME TODAY’S RATE', () => {
      current?.close();
      void import('../features/core/cards').then((c) => c.askInBox(`What's ${amount.value || '40'} pounds in euros at today's rate, with its source?`));
    });
    return [h('p.cvnote', 'No live rate here: the phone keeps none. Ask me in the chat and I give today’s rate with where it came from, or type a rate you have.'), h('div.cvrow', amount, rate, button('WORK IT OUT', go, 'on')), ans, ask];
  }
  function base64Tool(): HTMLElement[] {
    const inp = h('textarea.cvta', { rows: 3, placeholder: 'Words, or base64 to read', 'aria-label': 'Words or base64' }) as HTMLTextAreaElement;
    const out = h('textarea.cvta', { rows: 3, readOnly: true, 'aria-label': 'The result' }) as HTMLTextAreaElement;
    const enc = button('TO BASE64', () => (out.value = textToBase64(inp.value)), 'on');
    const dec = button('FROM BASE64', () => {
      const t = base64ToText(inp.value);
      out.value = t ?? '';
      say(t === null ? 'That isn’t base64 that holds words (a file’s base64 decodes to a file: paste it into a .txt and convert that).' : 'Read on this phone.');
    });
    return [inp, h('div.cvbtns', enc, dec), out];
  }
  function unixTool(): HTMLElement[] {
    const q = h('input', { type: 'text', placeholder: '1700000000, or 2025-03-01 14:30', 'aria-label': 'A Unix time or a date', autocomplete: 'off', enterKeyHint: 'go' }) as HTMLInputElement;
    const ans = h('p.cvans', { 'aria-live': 'polite' });
    const go = () => {
      const v = q.value.trim();
      if (/^-?\d{9,13}$/.test(v)) ans.textContent = `${v} is ${unixToDate(Number(v))}.`;
      else {
        const u = dateToUnix(v);
        ans.textContent = u === null ? (unixAsked(v)?.text ?? 'Type a Unix time (seconds since 1970) or a date.') : `${v} is Unix time ${u}.`;
      }
    };
    q.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    return [h('div.cvrow', q, button('CONVERT', go, 'on')), ans, h('p.cvnote', `The Unix time now: ${Math.floor(Date.now() / 1000)}.`)];
  }
  function tableTool(): HTMLElement[] {
    let html = '';
    const box = h('textarea.cvta', { rows: 5, placeholder: 'Paste a table from a web page or a spreadsheet', 'aria-label': 'A pasted table' }) as HTMLTextAreaElement;
    box.addEventListener('paste', (e) => (html = e.clipboardData?.getData('text/html') ?? ''));
    const show = h('div.cvqr');
    const go = button('MAKE A CSV', () => {
      const rows = pastedTable(box.value, html);
      if (!rows.length) return say('Paste a table first.');
      const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
      clear(show, outRow(blob, 'table.csv'));
      say(`A CSV of ${rows.length} rows and ${Math.max(...rows.map((r) => r.length))} columns, the first row its header.`);
    }, 'on');
    return [box, go, show];
  }
  function recordTool(): HTMLElement[] {
    let rec: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    const show = h('div.cvqr');
    const btn = button('START RECORDING', () => void toggle(), 'on');
    const toggle = async () => {
      if (rec) {
        rec.stop();
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        return say('I need the microphone for that: the phone asks once.');
      }
      const parts: Blob[] = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
      rec.onstop = async () => {
        stream?.getTracks().forEach((t) => t.stop());
        rec = null;
        btn.textContent = 'START RECORDING';
        try {
          const blob = new Blob(parts, { type: parts[0]?.type || 'audio/webm' });
          const s = await decodeSound(blob, 'webm');
          const wav = new Blob([encodeWav(s) as BlobPart], { type: 'audio/wav' });
          clear(show, outRow(wav, `recording ${new Date().toTimeString().slice(0, 5).replace(':', '.')}.wav`));
          say('Recorded on this phone, as a WAV.');
        } catch (e) {
          say(`I couldn’t: ${(e as Error).message}.`);
        }
      };
      rec.start();
      btn.textContent = 'STOP';
      say('Recording on this phone…');
    };
    return [btn, show];
  }

  const body = h('div.cvsheet', drop, fileIn, list, convs, optsBox, status, results, tools, toolBox);
  current = modal('CONVERT', body, () => {
    convertState.open = false;
    current = null;
  });
  if (files.length) await add(files);
  if (o.tool) openTool(o.tool);
  wanted = o.conversion ?? '';
  if (wanted) (convs.querySelector(`button.cvbtn[data-id="${wanted}"]`) as HTMLButtonElement | null)?.click();
}

/** Kinds a dropped file can be, for a quick word on the chat ("a PDF, 2.4 MB"). */
export const fileWords = (kind: Kind, size: number): string => `${KIND_WORDS[kind]}, ${sizeWords(size)}`;
export { MIME, unitOf, convertUnits, base64Asked, toast };
