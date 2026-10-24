/**
 * SCAN: point at something and get something useful, in three parts.
 *
 * CODE — barcodes and QR codes, read live on the phone (a look every ~300 ms at a shrunk frame;
 * a box round the code, one beep, then a card). A product's barcode asks the brain
 * (/api/lookup/barcode: Open Food Facts and its sister databases, a web search when none knows
 * it); a book's ISBN asks Open Library through the brain. A QR code is shown as what it is: a web
 * address with its real site picked out and warnings for the usual tricks, and an OPEN button
 * (never opened by itself); Wi-Fi details, a contact, a place, an email, a phone number.
 *
 * DOCUMENT — a page photographed: its corners found (or dragged by hand), straightened to A4,
 * cleaned up; more pages added; EXPORT PDF (made on the phone, scan/pdf.ts) through the share
 * sheet or as a download; READ ALL turns the pages into text for the library, on a tap.
 *
 * TRANSLATE — the text in a picture (the READ reader) → the brain's translator → both shown.
 *
 * Nothing leaves the phone until a lookup or a translation is asked for, and nothing is saved
 * unless SAVE is pressed. The state a test reads is at window.__ghosty.scan.
 */
import { headers } from '../../api/brain';
import { speakIn, voiceIn } from '../../assistant/voice';
import { offlineReady, translateOffline } from '../../offline/brain';
import { OFFLINE_TRANSLATION_NOTE, shouldFallBack } from '../../offline/prompt';
import { settings } from '../../state/app';
import { run } from '../../commands/registry';
import { clear, h } from '../../core/dom';
import { bar, button, toast, undo } from '../../ui/components';
import { drawScaled, loadImageFile } from '../../vision/camera';
import { cleanOcr, titleFrom } from '../../vision/ocrtext';
import { LANGUAGES, langName, type LookupResult } from '../../../../../packages/shared/src/scan';
import { freeBarcodes, readCodes, readerName, warmBarcodes, type FoundCode } from '../../scan/barcode';
import { classifyCode, describeCode, type CodeInfo } from '../../scan/codes';
import { defaultQuad, findPageIn, straighten, type Quad } from '../../scan/page';
import { makePdf, type PdfPage } from '../../scan/pdf';
import type { LensContext, Mode, ModeOpts } from './index';

type Sub = 'code' | 'document' | 'translate';

interface StoredPage extends PdfPage {
  thumb: string;
}

/** What SCAN is doing, for tests and the console (window.__ghosty.scan). */
export interface ScanState {
  sub: Sub;
  status: string;
  /** Every code read since SCAN was entered (newest last). */
  codes: { text: string; format: string; kind: string }[];
  lookup: LookupResult | null;
  pages: number;
  pdf: { bytes: number; head: string; pages: number; via: 'share' | 'download' } | null;
  original: string;
  translation: string;
  /** The language the translation is in (a code). */
  to?: string;
  /** 'offline': the brain could not be reached and the phone's own model translated (roughly). */
  engine: string;
  error: string;
}

export const scanState: ScanState = { sub: 'code', status: '', codes: [], lookup: null, pages: 0, pdf: null, original: '', translation: '', engine: '', error: '' };

const LOOK_MS = 300;
const MAX_PAGES = 30;
const LANG_KEY = 'ghosty.scan.to';

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.scan = scanState;
}

const errText = (e: unknown) => String((e as Error)?.message ?? e);

/** The beep's sound, made (or woken) by a tap in SCAN: iPhone Safari keeps a context made outside a tap silent,
 *  and a code is found long after the tap that started the scan. One context, reused for every beep. */
let beeper: AudioContext | null = null;
function wakeBeeper(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    beeper ??= new Ctx();
    if (beeper.state === 'suspended') void beeper.resume().catch(() => undefined);
  } catch {
    /* no sound: the box and the card say it */
  }
}

/** One short beep and a buzz where the phone can (iOS has no vibration for the web). */
function beep(): void {
  try {
    const a = beeper;
    if (a && a.state === 'running') {
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = 1760;
      g.gain.value = 0.08;
      o.connect(g).connect(a.destination);
      o.start();
      o.stop(a.currentTime + 0.09);
    }
  } catch {
    /* no sound: the box and the card say it */
  }
  navigator.vibrate?.(60);
}

async function copyText(t: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(t);
    toast('Copied', 'ok');
  } catch {
    toast('Copy blocked by the browser', 'warn');
  }
}

/** Open a web address the owner chose to open, in a new tab with nothing of Ghosty's passed on. */
function openOut(href: string): void {
  const a = h('a', { href, target: '_blank', rel: 'noopener noreferrer' });
  a.click();
}

const kv = (k: string, v: string | Node) => h('div.scankv', h('b', k), typeof v === 'string' ? h('span', v) : v);

export function createScanMode(L: LensContext): Mode {
  const S = scanState;
  let sub: Sub = 'code';
  let busy = false;
  let lastLook = 0;
  /** A code was found: live looking stops until SCAN AGAIN. */
  let held = false;
  let still: HTMLCanvasElement | null = null;
  let lookupGen = 0;

  /** Scroll the Lens panel (not the page) so a card that just appeared is in view. */
  const reveal = (el: HTMLElement) =>
    requestAnimationFrame(() => {
      const p = L.panel.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (r.top < p.top || r.top > p.bottom - 60) L.panel.scrollTo({ top: L.panel.scrollTop + r.top - p.top - 8, behavior: 'smooth' });
    });
  const status = (text: string, light?: 'ok' | 'mid' | 'off') => {
    S.status = text;
    L.status(text, light);
  };

  // ---- the three parts' switches
  const subBtns = new Map<Sub, HTMLButtonElement>();
  const subRow = h('div.lenschips.scansubs');
  for (const [id, label] of [['code', 'CODE'], ['document', 'DOCUMENT'], ['translate', 'TRANSLATE']] as const) {
    const b = button(label, () => setSub(id));
    subBtns.set(id, b);
    subRow.append(b);
  }
  const body = h('div.stackf');
  const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Pick a photo' });
  file.hidden = true;
  const root = h('div.stackf', subRow, body);
  const progress = h('div.lensprog');
  progress.hidden = true;
  const setProgress = (label: string, frac?: number) => {
    progress.hidden = false;
    clear(progress, bar(label.replace(/…$/, '').toUpperCase().slice(0, 22), frac ?? 0, frac != null ? `${Math.round(frac * 100)}%` : ''));
  };

  /** Read the text in a picture with the phone's reader (READ's), showing its progress. */
  const ocr = async (src: HTMLCanvasElement | Blob, label = 'reading…'): Promise<string> => {
    try {
      const r = await L.reader.read(src, (s, f) => {
        setProgress(s || label, f);
        status(s || label, 'mid');
      });
      return cleanOcr(r);
    } finally {
      progress.hidden = true;
    }
  };

  // ======================= CODE
  const codeCard = h('div.stackf');
  const again = button('SCAN AGAIN', () => {
    held = false;
    again.hidden = true;
    clear(codeCard);
    L.clearOverlay();
    if (still) {
      still = null;
      L.showStill(null);
    }
    status(L.state.camera === 'on' ? 'looking for a code…' : 'camera off · START, or PICK PHOTO', L.state.camera === 'on' ? 'mid' : undefined);
  }, 'on');
  again.hidden = true;
  const codeBody = h('div.stackf',
    h('div.row', again, button('PICK PHOTO', () => file.click())),
    h('div.note', 'Point at a barcode or QR code and hold still: it is read on the phone. Products and books are looked up (Open Food Facts, Open Library) only once a code is found; links are never opened by themselves.'),
    codeCard,
  );

  /** Boxes round the codes found, in the picture on screen (`scale`: picture pixels → frame pixels). */
  const boxCodes = (found: FoundCode[], scale: number) => {
    if (!L.overlay()) return;
    for (const f of found) {
      if (!f.points.length) continue;
      const xs = f.points.map((p) => p.x * scale);
      const ys = f.points.map((p) => p.y * scale);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      L.drawBox({ x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }, f.format.replace(/_/g, '-').toUpperCase(), { on: true });
    }
  };

  const actions = (info: CodeInfo, extra: string) => {
    const text = `${describeCode(info)}${extra ? `\n${extra}` : ''}`;
    return h('div.row.wrap',
      button('ASK GHOSTY', () => L.setMode('ask', { text, question: 'I scanned this. What is it, and is there anything I should know?', send: true }), 'warn'),
      button('SAVE', () => void L.saveNote(titleFrom(text, 'Scanned code'), text, 'note')),
      button('COPY', () => void copyText(info.raw)),
    );
  };

  const urlCard = (info: CodeInfo): HTMLElement => {
    const u = info.url!;
    const at = u.href.indexOf(u.host);
    const before = at >= 0 ? u.href.slice(0, at) : '';
    const hostRest = u.host.slice(0, u.host.length - u.domain.length);
    const after = at >= 0 ? u.href.slice(at + u.host.length) : u.href;
    const shown = h('div.scanurl', before, hostRest, h('b', u.domain), after);
    const warns = u.warnings.map((w) => h('div.scanwarn', w));
    const open = button(u.warnings.length ? 'OPEN ANYWAY' : 'OPEN', () => {
      if (u.warnings.length && !window.confirm(`Open ${u.domain}?\n\n${u.warnings.join('\n')}`)) return;
      openOut(u.href);
    }, u.warnings.length ? 'bad' : 'on');
    return h('div.scancard', h('small', 'WEB ADDRESS'), h('div.scansite', 'Site: ', h('b', u.domain)), shown, ...warns, h('div.row.wrap', open), actions(info, ''));
  };

  const wifiCard = (info: CodeInfo): HTMLElement => {
    const w = info.wifi!;
    const pass = h('span', w.password ? '••••••••' : '(none)');
    const show = button('SHOW', (b) => {
      const on = b.textContent === 'SHOW';
      pass.textContent = on ? w.password : '••••••••';
      b.textContent = on ? 'HIDE' : 'SHOW';
    });
    show.hidden = !w.password;
    return h('div.scancard', h('small', 'WI-FI'),
      kv('NETWORK', w.ssid || '(no name)'),
      kv('SECURITY', w.security),
      kv('PASSWORD', h('span.row', pass, show)),
      w.hidden ? h('div.note', 'A hidden network: add it by name in Settings → Wi-Fi → Other.') : null,
      h('div.note', 'To join: copy the password, then Settings → Wi-Fi → pick the network → paste.'),
      h('div.row.wrap', button('COPY PASSWORD', () => void copyText(w.password))),
      // The password stays off ASK GHOSTY and SAVE: describeCode leaves it out.
      actions(info, ''),
    );
  };

  const plainCard = (label: string, info: CodeInfo, rows: (HTMLElement | null)[], more: HTMLElement[] = []): HTMLElement => h('div.scancard', h('small', label), ...rows, ...more, actions(info, ''));

  const lookupCard = (r: LookupResult, info: CodeInfo): HTMLElement => {
    const img = r.image ? h('img.scanimg', { src: r.image, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }) : null;
    img?.addEventListener('error', () => img.remove());
    const n = r.nutrition;
    const nut = n
      ? h('div.scannut', ...([['kcal', 'ENERGY', ' kcal'], ['fat', 'FAT', ' g'], ['saturates', 'SAT FAT', ' g'], ['sugars', 'SUGARS', ' g'], ['salt', 'SALT', ' g'], ['protein', 'PROTEIN', ' g']] as const).filter(([k]) => n[k] != null).map(([k, label, unit]) => h('span', h('b', label), `${n[k]}${unit}`)))
      : null;
    const grades = h('div.row.wrap',
      r.nutriscore ? h(`span.scangrade.g${r.nutriscore}`, `NUTRI-SCORE ${r.nutriscore.toUpperCase()}`) : null,
      r.ecoscore ? h(`span.scangrade.g${r.ecoscore}`, `GREEN-SCORE ${r.ecoscore.toUpperCase()}`) : null,
    );
    const web = (r.web ?? []).map((w) => h('a.scanhit', { href: w.url, target: '_blank', rel: 'noopener noreferrer' }, h('b', w.title), h('small', w.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] ?? '')));
    const head = h('div.scanhead', img, h('div',
      h('div.scantitle', r.title),
      r.brand || r.quantity ? h('div.note', [r.brand, r.quantity].filter(Boolean).join(' · ')) : null,
      r.authors?.length ? h('div.note', `${r.authors.join(', ')}${r.year ? ` · ${r.year}` : ''}${r.publisher ? ` · ${r.publisher}` : ''}${r.pages ? ` · ${r.pages} pages` : ''}`) : null,
    ));
    const extra = [
      r.brand && `Brand: ${r.brand}`,
      r.authors?.length && `By ${r.authors.join(', ')}`,
      r.nutriscore && `Nutri-Score ${r.nutriscore.toUpperCase()}`,
      r.allergens?.length && `Allergens: ${r.allergens.join(', ')}`,
      r.ingredients && `Ingredients: ${r.ingredients}`,
      r.description && `About: ${r.description.slice(0, 600)}`,
      r.url && `More: ${r.url}`,
      r.credit,
    ].filter(Boolean).join('\n');
    return h('div.scancard',
      h('small', r.kind === 'book' ? `BOOK · ISBN ${r.code}` : r.kind === 'product' ? `PRODUCT · ${r.code}` : `NOT KNOWN · ${r.code}`),
      head,
      grades.childElementCount ? grades : null,
      nut,
      r.allergens?.length ? kv('ALLERGENS', r.allergens.join(', ')) : null,
      r.ingredients ? h('div.scantext', r.ingredients) : null,
      r.description ? h('div.scantext', r.description) : null,
      ...web,
      r.note ? h('div.note', r.note) : null,
      r.url ? h('div.row.wrap', button(r.kind === 'book' ? 'OPEN LIBRARY PAGE' : 'PRODUCT PAGE', () => openOut(r.url!))) : null,
      r.credit ? h('div.scancredit', r.credit) : null,
      actions({ ...info, raw: info.code ?? info.raw }, `${r.title}\n${extra}`),
    );
  };

  const lookUp = async (info: CodeInfo) => {
    const gen = ++lookupGen;
    S.lookup = null;
    clear(codeCard, h('div.scancard', h('small', info.kind === 'isbn' ? `BOOK · ISBN ${info.code}` : `PRODUCT · ${info.code}`), h('div.note', 'Looking it up…')));
    reveal(codeCard);
    status('looking it up…', 'mid');
    try {
      const r = await fetch(`/api/lookup/barcode?code=${encodeURIComponent(info.code ?? '')}`, { headers: headers(), credentials: 'same-origin' });
      const j = (await r.json().catch(() => ({}))) as LookupResult & { error?: string };
      if (gen !== lookupGen) return;
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      S.lookup = j;
      clear(codeCard, lookupCard(j, info));
      status(j.kind === 'unknown' ? 'not in the open databases' : `${j.kind}: ${j.title}`, j.kind === 'unknown' ? 'mid' : 'ok');
    } catch (e) {
      if (gen !== lookupGen) return;
      S.error = errText(e);
      clear(codeCard, plainCard(info.kind === 'isbn' ? 'BOOK' : 'PRODUCT', info, [kv('NUMBER', info.code ?? info.raw), h('div.scanwarn', `Could not look it up: ${S.error}`)]));
      status('lookup failed', 'off');
    }
  };

  const showCode = (f: FoundCode) => {
    const info = classifyCode(f.text, f.format);
    S.codes.push({ text: f.text, format: f.format, kind: info.kind });
    if (S.codes.length > 50) S.codes.shift();
    L.state.lastAction = `scanned ${info.kind}`;
    switch (info.kind) {
      case 'isbn':
      case 'product':
        void lookUp(info);
        return;
      case 'url':
        clear(codeCard, urlCard(info));
        break;
      case 'wifi':
        clear(codeCard, wifiCard(info));
        break;
      case 'contact': {
        const c = info.contact!;
        clear(codeCard, plainCard('CONTACT', info, [kv('NAME', c.name || '(none)'), c.org ? kv('ORGANISATION', c.org) : null, ...c.phones.map((p) => kv('PHONE', p)), ...c.emails.map((e) => kv('EMAIL', e)), ...c.urls.map((u) => kv('WEB', u)), c.address ? kv('ADDRESS', c.address) : null]));
        break;
      }
      case 'geo': {
        const g = info.geo!;
        clear(codeCard, plainCard('PLACE', info, [kv('WHERE', `${g.lat.toFixed(5)}, ${g.lon.toFixed(5)}`), g.label ? kv('NAME', g.label) : null], [h('div.row.wrap', button('SHOW ON MAP', () => void run('show_map', { lat: g.lat, lon: g.lon, place: g.label })))]));
        break;
      }
      case 'email':
        clear(codeCard, plainCard('EMAIL', info, [kv('TO', info.email!.to), info.email!.subject ? kv('SUBJECT', info.email!.subject) : null, info.email!.body ? h('div.scantext', info.email!.body) : null]));
        break;
      case 'phone':
        clear(codeCard, plainCard('PHONE NUMBER', info, [kv('NUMBER', info.phone!)]));
        break;
      case 'sms':
        clear(codeCard, plainCard('TEXT MESSAGE', info, [kv('TO', info.sms!.to), info.sms!.body ? h('div.scantext', info.sms!.body) : null]));
        break;
      default:
        clear(codeCard, plainCard(`TEXT · ${f.format.toUpperCase()}`, info, [h('div.scantext', info.raw)]));
    }
    status(`${info.kind === 'text' ? 'text' : info.kind} code read`, 'ok');
    reveal(codeCard);
  };

  const found = (codes: FoundCode[], scale: number) => {
    held = true;
    again.hidden = false;
    boxCodes(codes, scale);
    beep();
    showCode(codes[0]!);
  };

  /** One look at the live frame (shrunk to 960 px: quick, and big enough for a barcode across a third of the view). */
  const look = async () => {
    const c = L.camera.capture(960);
    if (!c) return;
    const codes = await readCodes(c);
    if (sub !== 'code' || held || L.state.mode !== 'scan') return;
    if (codes.length) found(codes, L.camera.size.w / c.width);
    else L.clearOverlay();
  };

  const scanPhoto = async (c: HTMLCanvasElement) => {
    still = c;
    L.showStill(c);
    held = true;
    status('reading the codes in the photo…', 'mid');
    try {
      const codes = await readCodes(c, true);
      if (codes.length) found(codes, 1);
      else {
        again.hidden = false;
        clear(codeCard, h('div.note', 'No barcode or QR code found in that photo: try closer, flatter and in focus.'));
        status('no code in the photo', 'mid');
      }
    } catch (e) {
      S.error = errText(e);
      again.hidden = false;
      status(`The code reader could not load: ${S.error}`, 'off');
    }
  };

  // ======================= DOCUMENT
  const pages: StoredPage[] = [];
  let photo: HTMLCanvasElement | null = null;
  let quad: Quad | null = null;
  let enhanceOn = true;
  const edit = h('canvas.scanedit', { 'aria-label': 'The page: drag the four corners onto its corners' });
  const editNote = h('div.note', '');
  const enhanceBtn = button('CLEAN UP: ON', (b) => {
    enhanceOn = !enhanceOn;
    b.textContent = enhanceOn ? 'CLEAN UP: ON' : 'CLEAN UP: OFF';
    b.classList.toggle('on', enhanceOn);
  }, 'on');
  const editor = h('div.stackf', edit, editNote,
    h('div.row.wrap', button('KEEP PAGE', () => void keepPage(), 'on'), button('FIND EDGES', () => autoFind()), enhanceBtn, button('CANCEL', () => closeEditor())),
  );
  editor.hidden = true;
  const strip = h('div.scanpages');
  const pagesLabel = h('small.scancount', 'NO PAGES YET');
  const docText = h('textarea.lensocr', { rows: 6, placeholder: 'READ ALL puts the text of every page here; edit it before saving.', 'aria-label': 'Text of the pages' });
  docText.hidden = true;
  const docSave = button('SAVE TEXT TO LIBRARY', async () => {
    const t = docText.value.trim();
    if (!t) return void toast('Nothing to save yet', 'warn');
    await L.saveNote(titleFrom(t, 'Scanned document'), t, 'scan');
  });
  docSave.hidden = true;
  const docBody = h('div.stackf',
    h('div.row', button('CAPTURE PAGE', () => void openEditor(L.still(2000)), 'on'), button('PICK PHOTO', () => file.click())),
    editor,
    pagesLabel,
    strip,
    h('div.row.wrap', button('EXPORT PDF', () => exportPdf(), 'warn'), button('READ ALL', () => void readAll()), button('CLEAR', () => clearPages())),
    docText,
    h('div.row.wrap', docSave),
    h('div.note', 'Lay the page flat on something darker, fill the frame, hold still. The PDF is made on the phone and goes where you share it; READ ALL reads the pages here and saves only when you tap SAVE.'),
  );

  const scaleOf = () => (photo ? edit.width / photo.width : 1);
  const paintEditor = () => {
    const g = edit.getContext('2d');
    if (!g || !photo) return;
    g.drawImage(photo, 0, 0, edit.width, edit.height);
    if (!quad) return;
    const k = scaleOf();
    const r = edit.width / Math.max(1, edit.clientWidth || edit.width);
    g.lineWidth = 2 * r;
    g.strokeStyle = '#62e4ff';
    g.fillStyle = 'rgba(98, 228, 255, .14)';
    g.beginPath();
    quad.forEach((p, i) => (i ? g.lineTo(p.x * k, p.y * k) : g.moveTo(p.x * k, p.y * k)));
    g.closePath();
    g.fill();
    g.stroke();
    for (const p of quad) {
      g.beginPath();
      g.arc(p.x * k, p.y * k, 11 * r, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255, 178, 62, .85)';
      g.fill();
    }
  };
  const autoFind = () => {
    if (!photo) return;
    const q = findPageIn(photo);
    quad = q ?? defaultQuad(photo.width, photo.height);
    editNote.textContent = q ? 'Page found: drag a corner if it is not quite right, then KEEP PAGE.' : 'No page edge stood out: drag the four corners onto the page’s corners, then KEEP PAGE.';
    paintEditor();
  };
  const openEditor = async (c: HTMLCanvasElement | null) => {
    if (!c) return void toast('No picture yet: START the camera, or PICK PHOTO', 'warn');
    if (pages.length >= MAX_PAGES) return void toast(`${MAX_PAGES} pages at most: export these first`, 'warn');
    photo = c;
    const k = Math.min(1, 720 / Math.max(c.width, c.height));
    edit.width = Math.round(c.width * k);
    edit.height = Math.round(c.height * k);
    editor.hidden = false;
    autoFind();
    reveal(editor);
    status('place the corners, then KEEP PAGE', 'mid');
  };
  const closeEditor = () => {
    photo = null;
    quad = null;
    editor.hidden = true;
  };
  let dragging = -1;
  const toPhoto = (e: PointerEvent) => {
    const r = edit.getBoundingClientRect();
    const k = scaleOf();
    return { x: ((e.clientX - r.left) * (edit.width / r.width)) / k, y: ((e.clientY - r.top) * (edit.height / r.height)) / k };
  };
  edit.addEventListener('pointerdown', (e) => {
    if (!quad || !photo) return;
    const p = toPhoto(e);
    const reach = (36 * (edit.width / Math.max(1, edit.getBoundingClientRect().width))) / scaleOf();
    let best = -1;
    let bestD = reach;
    quad.forEach((c, i) => {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) return;
    dragging = best;
    edit.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  edit.addEventListener('pointermove', (e) => {
    if (dragging < 0 || !quad || !photo) return;
    const p = toPhoto(e);
    quad[dragging] = { x: Math.max(0, Math.min(photo.width, p.x)), y: Math.max(0, Math.min(photo.height, p.y)) };
    paintEditor();
  });
  const drop = () => (dragging = -1);
  edit.addEventListener('pointerup', drop);
  edit.addEventListener('pointercancel', drop);

  const jpegOf = (c: HTMLCanvasElement, q = 0.82): Promise<Uint8Array> =>
    new Promise((ok, bad) => c.toBlob((b) => (b ? b.arrayBuffer().then((a) => ok(new Uint8Array(a)), bad) : bad(new Error('Could not make a JPEG of the page'))), 'image/jpeg', q));

  const renderPages = () => {
    S.pages = pages.length;
    pagesLabel.textContent = pages.length ? `${pages.length} PAGE${pages.length === 1 ? '' : 'S'}` : 'NO PAGES YET';
    clear(strip, ...pages.map((p, i) => h('div.scanthumb', h('img', { src: p.thumb, alt: `Page ${i + 1}` }), h('span', String(i + 1)), button('×', () => {
      const [gone] = pages.splice(i, 1);
      renderPages();
      if (gone)
        undo(`Page ${i + 1} removed`, () => {
          pages.splice(Math.min(i, pages.length), 0, gone);
          renderPages();
        });
    }))));
  };
  const keepPage = async () => {
    if (!photo || !quad) return;
    try {
      status('straightening the page…', 'mid');
      // a breath for the status line to show before the work
      await new Promise((r) => setTimeout(r, 30));
      const flat = straighten(photo, quad, { enhance: enhanceOn, long: 1600 });
      const jpeg = await jpegOf(flat);
      pages.push({ jpeg, w: flat.width, h: flat.height, thumb: drawScaled(flat, { w: flat.width, h: flat.height }, 120).toDataURL('image/jpeg', 0.6) });
      closeEditor();
      renderPages();
      status(`page ${pages.length} kept · CAPTURE PAGE for the next, or EXPORT PDF`, 'ok');
    } catch (e) {
      S.error = errText(e);
      toast(`Could not keep the page: ${S.error}`, 'bad');
      status(S.error, 'off');
    }
  };
  const exportPdf = () => {
    if (!pages.length) return void toast('Capture a page first', 'warn');
    let bytes: Uint8Array;
    try {
      bytes = makePdf(pages, { title: `Scan ${new Date().toISOString().slice(0, 10)}` });
    } catch (e) {
      return void toast(`Could not make the PDF: ${errText(e)}`, 'bad');
    }
    const name = `Scan ${new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.')}.pdf`;
    const pdf = new File([bytes as Uint8Array<ArrayBuffer>], name, { type: 'application/pdf' });
    const head = new TextDecoder().decode(bytes.subarray(0, 8));
    // The share sheet (Save to Files, Mail, WhatsApp…) where the phone has one; a download elsewhere.
    if (navigator.canShare?.({ files: [pdf] })) {
      S.pdf = { bytes: bytes.length, head, pages: pages.length, via: 'share' };
      navigator.share({ files: [pdf], title: name }).catch((e: unknown) => {
        if ((e as Error)?.name !== 'AbortError') toast(`Could not share it: ${errText(e)}`, 'bad');
      });
    } else {
      S.pdf = { bytes: bytes.length, head, pages: pages.length, via: 'download' };
      const url = URL.createObjectURL(pdf);
      const a = h('a', { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    status(`PDF made: ${pages.length} page${pages.length === 1 ? '' : 's'}, ${Math.round(bytes.length / 1024)} KB`, 'ok');
  };
  const readAll = async () => {
    if (!pages.length) return void toast('Capture a page first', 'warn');
    if (L.reader.busy) return void toast('Still reading', 'warn');
    const out: string[] = [];
    try {
      for (let i = 0; i < pages.length; i++) {
        const t = await ocr(new Blob([pages[i]!.jpeg as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }), `page ${i + 1} of ${pages.length}…`);
        out.push(pages.length > 1 ? `— Page ${i + 1} —\n${t}` : t);
      }
      docText.value = out.join('\n\n').trim();
      docText.hidden = false;
      docSave.hidden = false;
      status(docText.value ? 'read · edit, then SAVE TEXT TO LIBRARY' : 'no text found on the pages', docText.value ? 'ok' : 'mid');
    } catch (e) {
      status(`Could not read the pages: ${errText(e)}`, 'off');
    }
  };
  const clearPages = () => {
    const was = { pages: pages.slice(), pdf: S.pdf, text: docText.value, textHidden: docText.hidden, saveHidden: docSave.hidden };
    pages.length = 0;
    S.pdf = null;
    docText.value = '';
    docText.hidden = true;
    docSave.hidden = true;
    renderPages();
    // UNDO: every page back, and what READ ALL read from them
    if (was.pages.length || was.text)
      undo(`Cleared ${was.pages.length} page${was.pages.length === 1 ? '' : 's'}`, () => {
        pages.splice(0, pages.length, ...was.pages);
        S.pdf = was.pdf;
        docText.value = was.text;
        docText.hidden = was.textHidden;
        docSave.hidden = was.saveHidden;
        renderPages();
      });
  };

  // ======================= TRANSLATE
  const lang = h('select.scanlang', { 'aria-label': 'Translate into' }, ...LANGUAGES.map((l) => h('option', { value: l.code }, l.name)));
  try {
    lang.value = localStorage.getItem(LANG_KEY) || 'en';
  } catch {
    lang.value = 'en';
  }
  lang.addEventListener('change', () => {
    try {
      localStorage.setItem(LANG_KEY, lang.value);
    } catch {
      /* remembered for this visit only */
    }
  });
  const original = h('textarea.lensocr', { rows: 4, placeholder: 'The text in the picture appears here (or type or paste some).', 'aria-label': 'Text to translate' });
  original.addEventListener('input', () => (S.original = original.value));
  const outModel = h('small');
  const outText = h('div');
  // with no signal the phone translates by itself, roughly, and this says so
  const outNote = h('small.offnote', OFFLINE_TRANSLATION_NOTE);
  outNote.hidden = true;
  const out = h('div.lensreply', outModel, outText, outNote);
  out.hidden = true;
  // READ ALOUD in the translation's own language, with the phone's voice for it (works with no signal); hidden
  // when the phone has none, and the line says so.
  const readBtn = button('READ ALOUD', () => {
    if (!speakIn(outText.textContent ?? '', S.to || lang.value)) toast(`No ${langName(S.to || lang.value)} voice on this phone to read it aloud`, 'warn');
  });
  const outActions = h('div.row.wrap',
    readBtn,
    button('COPY', () => void copyText(outText.textContent ?? '')),
    button('SAVE', () => void L.saveNote(titleFrom(original.value, 'Translation'), `${original.value.trim()}\n\n${langName(lang.value)}:\n${outText.textContent ?? ''}`, 'note')),
    button('ASK GHOSTY', () => L.setMode('ask', { text: `${original.value.trim()}\n\nTranslation (${langName(lang.value)}): ${outText.textContent ?? ''}`, question: 'I translated this. What does it mean for me, and is anything unclear?', send: true }), 'warn'),
  );
  outActions.hidden = true;
  let translating = false;
  const doTranslate = async () => {
    const text = original.value.trim();
    if (!text) return void toast('No text yet: CAPTURE, PICK PHOTO, or type some', 'warn');
    if (translating) return;
    translating = true;
    status(`translating into ${langName(lang.value)}…`, 'mid');
    try {
      const to = lang.value;
      // The brain's free translator; with no signal (or the brain down) the offline brain on this phone, if it is here.
      let j: { text?: string; from?: string; to?: string; engine?: string; error?: string };
      try {
        const r = await fetch('/api/translate', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ text, to }), credentials: 'same-origin' });
        j = (await r.json().catch(() => ({}))) as typeof j;
        if (!r.ok || typeof j.text !== 'string') throw Object.assign(new Error(j.error ?? `HTTP ${r.status}`), { status: r.status });
      } catch (e) {
        if (!shouldFallBack(e) || settings.get().offlineBrain === 'off') throw e;
        if (!(await offlineReady().catch(() => false))) throw new Error('no signal, and the offline brain isn’t on this phone (Settings → Offline brain → DOWNLOAD, on Wi-Fi) to translate without it');
        status(`no signal: translating into ${langName(to)} on your phone…`, 'mid');
        const r = await translateOffline(text, to);
        if (!r.text) throw new Error('the offline brain gave no translation');
        j = { text: r.text, to, engine: 'offline' };
      }
      const t = j.text ?? '';
      S.translation = t;
      S.engine = j.engine ?? '';
      S.to = j.to ?? to;
      outText.textContent = t;
      outText.lang = S.to;
      const from = j.from ? `${langName(j.from)} → ` : '';
      outModel.textContent = `${from}${langName(S.to)} · ${j.engine === 'offline' ? 'on your phone · rough, offline' : j.engine === 'workers-ai' ? 'free translator' : j.engine === 'model' ? 'chat model' : 'already in that language'}`;
      outNote.hidden = j.engine !== 'offline';
      readBtn.hidden = !voiceIn(S.to);
      out.hidden = false;
      outActions.hidden = false;
      reveal(out);
      status(j.engine === 'offline' ? 'translated on your phone (rough, offline)' : 'translated', 'ok');
    } catch (e) {
      S.error = errText(e);
      status(`Could not translate: ${S.error}`, 'off');
      toast(`Could not translate: ${S.error}`, 'bad');
    } finally {
      translating = false;
    }
  };
  const translatePhoto = async (c: HTMLCanvasElement | null) => {
    if (!c) return void toast('No picture yet: START the camera, or PICK PHOTO', 'warn');
    still = c;
    L.showStill(c);
    try {
      const t = await ocr(c);
      original.value = t;
      S.original = t;
      if (!t) return void status('No text found: try closer, flatter, with more light', 'mid');
      await doTranslate();
    } catch (e) {
      status(`Could not read it: ${errText(e)}`, 'off');
    }
  };
  const trBody = h('div.stackf',
    h('div.row', button('CAPTURE', () => void translatePhoto(L.still(1600)), 'on'), button('PICK PHOTO', () => file.click())),
    h('div.row', h('span.scanlbl', 'INTO'), lang, button('TRANSLATE', () => void doTranslate(), 'warn')),
    progress,
    original,
    out,
    outActions,
    h('div.note', 'The phone reads letters of the Latin alphabet (English, French, Spanish, Polish…); for other scripts, type or paste the text. Translation is done by Ghosty\'s brain (Workers AI\'s free translator); with no signal, the offline brain on this phone does it roughly, if it is downloaded.'),
  );

  // ======================= switching
  const setSub = (s: Sub) => {
    sub = s;
    S.sub = s;
    for (const [id, b] of subBtns) b.classList.toggle('on', id === s);
    L.clearOverlay();
    if (still && s !== 'code') {
      still = null;
      L.showStill(null);
    }
    if (s === 'code') {
      clear(body, codeBody);
      void warmBarcodes()
        .then(async () => S.sub === 'code' && L.state.mode === 'scan' && !held && status(`code reader ready (${await readerName()}) · ${L.state.camera === 'on' ? 'point at a code' : 'START, or PICK PHOTO'}`, 'ok'))
        .catch((e: unknown) => status(`The code reader could not load: ${errText(e)}`, 'off'));
    } else if (s === 'document') {
      clear(body, docBody);
      // the progress bar lives with whichever part reads
      docBody.insertBefore(progress, docText);
      status(pages.length ? `${pages.length} page(s) · CAPTURE PAGE for more` : 'CAPTURE PAGE, or PICK PHOTO', undefined);
    } else {
      clear(body, trBody);
      trBody.insertBefore(progress, original);
      status('CAPTURE a sign or a menu, or type the text', undefined);
    }
    if (s !== 'code' && !L.reader.warmed) void L.reader.warm().catch(() => undefined);
  };

  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      const c = await loadImageFile(f, 2048);
      if (sub === 'code') await scanPhoto(c);
      else if (sub === 'document') await openEditor(c);
      else await translatePhoto(c);
    } catch (e) {
      toast(errText(e), 'bad');
    }
  });

  return {
    id: 'scan',
    enter(opts?: ModeOpts) {
      expose();
      wakeBeeper(); // (entered from the SCAN tile: this is the tap)
      document.addEventListener('click', wakeBeeper, true);
      clear(L.panel);
      L.panel.append(root, file);
      if (opts?.sub) sub = opts.sub;
      setSub(sub);
      if (opts?.still) {
        if (sub === 'code') void scanPhoto(opts.still);
        else if (sub === 'document') void openEditor(opts.still);
        else void translatePhoto(opts.still);
      } else if (still) L.showStill(still);
    },
    leave() {
      document.removeEventListener('click', wakeBeeper, true);
      void beeper?.suspend().catch(() => undefined); // quiet until SCAN is used again
      lookupGen++;
      held = false;
      again.hidden = true;
      still = null;
      L.showStill(null);
      L.clearOverlay();
      progress.hidden = true;
      // The WebAssembly reader's memory goes back; it reloads (from the cache) on the next scan.
      freeBarcodes();
    },
    tick(now) {
      if (sub !== 'code' || held || busy || L.state.frozen || now - lastLook < LOOK_MS) return;
      lastLook = now;
      busy = true;
      void look()
        .catch((e: unknown) => {
          S.error = errText(e);
          status(`The code reader stopped: ${S.error}`, 'off');
          held = true;
          again.hidden = false;
        })
        .finally(() => (busy = false));
    },
    froze(c) {
      if (sub === 'code' && !held) void scanPhoto(c);
    },
    unfroze() {
      // the held frame was the picture being scanned: it has gone from the screen
      still = null;
    },
  };
}
