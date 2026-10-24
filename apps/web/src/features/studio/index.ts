/**
 * 3D STUDIO tab: Tony Stark's lab bench on the phone. A holographic three.js scene (studio/viewer.ts)
 * where any model can be turned, TAKEN APART (each part flies out from the centre, a slider from
 * 0 to 100 %), REASSEMBLED, isolated part by part, cut open with a SECTION plane and MEASURED
 * between two taps — plus screenshots, built-in samples, a CATALOGUE of thousands of real, freely
 * licensed models (catalog.ts; each opened with its credit), MAKE ANYTHING from words (the
 * catalogue first, then the brain's free generators, a stand-in from shapes when they are busy),
 * textured models from a photo, any .glb/.gltf from Files (nothing uploaded), a ROOM built from its
 * measurements (the SPACE PLANNER's JSON), and the owner's own Spline scenes (iframe, "Powered by
 * Spline" under it — Spline itself has no API for making models). UNDO goes back to the model before.
 *
 * three.js is loaded only when this tab first opens, and stops drawing when the tab is left.
 * A test reads and drives it through window.__ghosty.studio.
 */
import { headers } from '../../api/brain';
import { send } from '../../assistant/session';
import { clear, h } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { button, row, toast, undo as offerUndo } from '../../ui/components';
import { planToRoom } from '../../space/roomjson';
import { space } from '../../space/store';
import { parseRoom, type RoomPlan } from '../../studio/room';
import { splineEmbedUrl } from '../../studio/spline';
import { creditLine, goodMatch, GROUPS, searchCatalog, standIn, type CatalogItem, type SearchHit } from '../../../../../packages/shared/src/models3d';
import { fetchModel, forget, keep, keptFile, keptInMemory, listKept, loadCatalog, readLines, thumbUrl, type Kept } from './catalog';
import { Viewer, type Axis, type ModelSource, type ViewMode } from '../../studio/viewer';
import type { WalkState } from '../../studio/walk';

/** The samples that ship with Ghosty (public/models), each credited as its licence asks. */
export const SAMPLES = [
  { id: 'reactor', title: 'Arc reactor', note: 'built in · 16 parts', file: '', credit: 'Made for Ghosty from simple shapes' },
  { id: 'toycar', title: 'Toy car', note: 'Khronos sample · CC0', file: 'ToyCar.glb', credit: 'Toy car by Guido Odendahl and Eric Chadwick, CC0 (Khronos glTF Sample Assets)' },
  { id: 'chair', title: 'Sheen chair', note: 'Khronos sample · CC0', file: 'SheenChair.glb', credit: 'Sheen chair © 2020 Wayfair LLC, by Eric Chadwick, CC0 (Khronos glTF Sample Assets)' },
  { id: 'sofa', title: 'Glam velvet sofa', note: 'Khronos sample · CC BY 4.0', file: 'GlamVelvetSofa.glb', credit: 'Glam velvet sofa © 2021 Wayfair LLC, by Eric Chadwick, CC BY 4.0 (Khronos glTF Sample Assets)' },
  { id: 'truck', title: 'Milk truck', note: 'Khronos sample · CC BY 4.0', file: 'CesiumMilkTruck.glb', credit: 'Cesium Milk Truck © 2017 Cesium, CC BY 4.0; Cesium logo is a trademark of Cesium (Khronos glTF Sample Assets)' },
] as const;
export type SampleId = (typeof SAMPLES)[number]['id'];

type Pane = 'models' | 'parts' | 'tools' | 'make' | 'room' | 'spline';
const PANES: { id: Pane; label: string }[] = [
  { id: 'models', label: 'MODELS' },
  { id: 'parts', label: 'PARTS' },
  { id: 'tools', label: 'CUT · MEASURE' },
  { id: 'make', label: 'MAKE · PHOTO' },
  { id: 'room', label: 'ROOM' },
  { id: 'spline', label: 'SPLINE' },
];

/** A model made from a picture, as the brain lists it (/api/m3d). */
interface MadeModel {
  id: string;
  title: string;
  at: number;
  bytes: number;
  faces?: number;
  /** Which free maker made it, whether it has its colours, and its credit (the brain says). */
  maker?: string;
  textured?: boolean;
  credit?: string;
}

/** What open_studio asks for. */
export interface StudioArgs {
  sample?: string;
  /** A catalogue model's id ('ov:…' or 'ph:…'). */
  catalog?: string;
  /** Words to MAKE IT from (make_3d): the catalogue first, then the brain's makers. */
  make?: string;
  model?: string;
  title?: string;
  room?: unknown;
  spline?: string;
}

let wanted: StudioArgs | null = null;
let controller: { apply(a: StudioArgs): void } | null = null;

/** Open the studio, optionally on a sample, a made model, a room or a Spline scene (open_studio). */
export function openStudio(args: StudioArgs = {}): void {
  wanted = args;
  go('studio');
  if (wanted && controller) {
    const a = wanted;
    wanted = null;
    controller.apply(a);
  }
}

/** Shrink a photo to a JPEG at most `max` px on its long side (the 3-D maker needs no more). */
async function shrinkPhoto(file: File, max = 1024): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = h('canvas', { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('could not read the photo'))), 'image/jpeg', 0.9));
}

const errText = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 200);

/** The licence's own page for a credit line, linked next to it (CC BY asks for that), or null. */
export function licenceLink(credit: string): { label: string; href: string } | null {
  if (/CC BY 4\.0/.test(credit)) return { label: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' };
  if (/\bCC0\b/.test(credit)) return { label: 'CC0 1.0', href: 'https://creativecommons.org/publicdomain/zero/1.0/' };
  if (/TRELLIS\.2/.test(credit)) return { label: 'MIT LICENCE', href: 'https://huggingface.co/microsoft/TRELLIS.2-4B' };
  if (/Stable Fast 3D/.test(credit)) return { label: 'STABILITY COMMUNITY LICENCE', href: 'https://stability.ai/community-license-agreement' };
  return null;
}

/** A SHOT with the model's credit burned into its foot (a CC BY model must stay credited when shared). */
async function burnCredit(png: Blob, credit: string): Promise<Blob> {
  if (!credit) return png;
  const bmp = await createImageBitmap(png);
  const c = h('canvas', { width: bmp.width, height: bmp.height });
  const g = c.getContext('2d');
  if (!g) return png;
  g.drawImage(bmp, 0, 0);
  bmp.close();
  const size = Math.max(12, Math.round(c.width * 0.026));
  g.font = `${size}px -apple-system, system-ui, sans-serif`;
  // the credit in as many lines as it needs, never cut short
  const lines: string[] = [];
  let line = '';
  for (const w of credit.split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > c.width - size * 2 && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  const lh = Math.round(size * 1.35);
  const band = lines.length * lh + size;
  g.fillStyle = 'rgba(0, 0, 0, 0.62)';
  g.fillRect(0, c.height - band, c.width, band);
  g.fillStyle = '#ffffff';
  g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, size, c.height - band + size / 2 + i * lh));
  return new Promise((res) => c.toBlob((b) => res(b ?? png), 'image/png'));
}

export const studioTab: TabDef = {
  id: 'studio',
  title: '3D STUDIO',
  icon: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  scene: 'backdrop',
  blurb: 'take models apart, rooms in 3-D',
  mount(root) {
    const view = h('div.studioview');
    const vtitle = h('div.studiotitle', '3D STUDIO');
    const vstat = h('div.studiostat', 'loading the lab…');
    const vmeasure = h('div.studiomeasure');
    vmeasure.hidden = true;
    const credit = h('div.studiocredit');
    // WALK's joystick: push the knob to walk (up = forward); drag anywhere else on the scene to look about.
    const knob = h('div.studioknob');
    const stick = h('div.studiostick', { 'aria-label': 'Walk: push to move', role: 'slider' }, knob);
    stick.hidden = true;
    const modeBar = h('div.studiomodes');
    view.append(h('div.studiohud', vtitle, vstat), vmeasure, credit, stick, modeBar);
    const V = new Viewer(view);
    let stickId: number | null = null;
    const stickMove = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect();
      const R = r.width / 2;
      let dx = e.clientX - (r.left + R);
      let dy = e.clientY - (r.top + R);
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      V.walkInput = { fwd: -dy / R, side: dx / R };
    };
    const stickEnd = () => {
      stickId = null;
      knob.style.transform = '';
      V.walkInput = { fwd: 0, side: 0 };
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      stickMove(e);
    });
    stick.addEventListener('pointermove', (e) => e.pointerId === stickId && stickMove(e));
    stick.addEventListener('pointerup', stickEnd);
    stick.addEventListener('pointercancel', stickEnd);
    // Arrow keys and WASD walk too (a computer).
    const keys = new Set<string>();
    const keyInput = () => {
      const k = (a: string, b: string) => (keys.has(a) || keys.has(b) ? 1 : 0);
      V.walkInput = { fwd: k('arrowup', 'w') - k('arrowdown', 's'), side: k('arrowright', 'd') - k('arrowleft', 'a') };
    };
    const onKey = (e: KeyboardEvent) => {
      if (V.mode !== 'walk' || (e.target as HTMLElement)?.closest?.('input, textarea')) return;
      const k = e.key.toLowerCase();
      if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) return;
      e.preventDefault();
      if (e.type === 'keydown') keys.add(k);
      else keys.delete(k);
      keyInput();
    };

    // ---- the bar under the scene: take apart, the slider, turntable, frame, screenshot
    const slider = h('input', { type: 'range', min: '0', max: '100', value: '0', step: '1', 'aria-label': 'How far apart', class: 'studioslider' });
    const pct = h('span.studiopct', '0%');
    const apart = button('TAKE APART', () => void V.animateTo(V.explode > 0.5 ? 0 : 1), 'on');
    apart.classList.add('studioapart');
    const turn = button('TURNTABLE', () => V.setTurntable(!V.controls?.autoRotate));
    const shot = button('SHOT', () => void screenshot());
    const fit = button('FRAME', () => V.frame());
    const undo = button('UNDO', () => void undoLoad());
    undo.disabled = true;
    slider.addEventListener('input', () => V.setExplode(Number(slider.value) / 100));
    const bar = h('div.studiobar', apart, h('label.studiorange', slider, pct), h('div.studiobtns', turn, fit, shot, undo));

    const seg = h('div.studioseg');
    const panel = h('div.studiopanel');
    const hud = h('div.hud.studio', view, bar, seg, panel);
    root.append(hud);

    let pane: Pane = 'models';
    const segBtns = PANES.map((p) => {
      const b = button(p.label, () => show(p.id));
      b.dataset.pane = p.id;
      return b;
    });
    seg.append(...segBtns);

    // ---- MODELS: the catalogue of real models first, then the samples, your files and your models
    const modelsPane = h('div.studiopane');
    const fileIn = h('input', { type: 'file', accept: '.glb,.gltf,model/gltf-binary,model/gltf+json', hidden: true, 'aria-label': 'Open a 3-D model file' });
    const made: MadeModel[] = [];
    /** Forgotten with the UNDO bar still up: off the list, still on the brain. */
    const madeGoing = new Set<string>();
    const madeBox = h('div.studiolist');
    const keptBox = h('div.studiolist');
    let keptList: Kept[] = [];
    const findIn = h('input', { type: 'search', placeholder: 'Search: “oak dining chair”, “kettle”…', 'aria-label': 'Search the catalogue', enterKeyHint: 'search' });
    const shelfSel = h('select', { 'aria-label': 'Shelf' }, h('option', { value: '' }, 'EVERY SHELF'), ...GROUPS.map((g) => h('option', { value: g }, g.toUpperCase())));
    const catNote = h('div.note', 'Thousands of real models — furniture and everyday things — free to use (CC0 or CC BY 4.0), each shown with its maker’s credit. Nothing is downloaded until you open one.');
    const catGrid = h('div.studiogrid');
    const catMore = h('div.row.wrap');
    const creditBox = h('div.studiocredits');
    let catItems: CatalogItem[] = [];
    let catHits: SearchHit[] = [];
    let shown = 0;
    const findBtn = button('FIND', () => void runSearch(findIn.value), 'on');
    findIn.addEventListener('keydown', (e) => e.key === 'Enter' && void runSearch(findIn.value));
    shelfSel.addEventListener('change', () => void runSearch(findIn.value));
    // Thumbnails are fetched only when their card scrolls into view.
    const seen = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((es) => {
          for (const e of es) {
            if (!e.isIntersecting) continue;
            seen?.unobserve(e.target);
            const img = e.target as HTMLImageElement;
            void thumbUrl(img.dataset.src ?? '').then((u) => (u ? (img.src = u) : img.classList.add('none')));
          }
        }, { rootMargin: '200px' })
      : null;
    const card = (it: CatalogItem) => {
      const img = h('img.studiocardimg', { alt: '', loading: 'lazy', decoding: 'async' });
      img.dataset.src = it.thumb;
      if (seen) seen.observe(img);
      else void thumbUrl(it.thumb).then((u) => (u ? (img.src = u) : img.classList.add('none')));
      const c = h('button.studiocard', { type: 'button', title: creditLine(it) }, img, h('span.studiocardname', it.name), h('span.studiocardby', `${it.licence} · ${it.author}`));
      c.dataset.id = it.id;
      c.addEventListener('click', () => void openItem(it));
      return c;
    };
    const paintGrid = () => {
      const next = catHits.slice(shown, shown + 24);
      catGrid.append(...next.map((x) => card(x.item)));
      shown += next.length;
      clear(catMore, ...(shown < catHits.length ? [button(`SHOW MORE (${catHits.length - shown})`, paintGrid)] : []));
    };
    async function runSearch(q: string, group = shelfSel.value): Promise<number> {
      shelfSel.value = group;
      catNote.textContent = catItems.length ? 'searching…' : 'opening the catalogue…';
      const { items, note } = await loadCatalog();
      catItems = items;
      catHits = searchCatalog(items, q, { group, limit: 240 });
      shown = 0;
      clear(catGrid);
      paintGrid();
      const shelf = group ? ` on the ${group} shelf` : '';
      catNote.textContent = !items.length
        ? `The catalogue could not be opened${note ? ` (${note})` : ''}.`
        : catHits.length
          ? `${q.trim() ? `${catHits.length >= 240 ? '240+' : catHits.length} found${shelf}` : `${catHits.length >= 240 ? 'The first 240' : catHits.length} models${shelf}`} of ${items.length.toLocaleString('en-GB')} · tap one to open it${note ? ` · ${note}` : ''}`
          : `Nothing called that${shelf} — MAKE · PHOTO can make one.`;
      if (!catHits.length && q.trim()) clear(catMore, button('MAKE IT', () => ((describe.value = q.trim()), show('make'), void makeAnything(q.trim()))));
      return catHits.length;
    }
    const showCredit = (it: CatalogItem | null) => {
      const lic = it ? licenceLink(creditLine(it)) : null;
      clear(creditBox, ...(it ? [h('div.studioreadout', creditLine(it)), h('div.row.wrap', h('a.studiosource', { href: it.page, target: '_blank', rel: 'noopener noreferrer' }, `ITS PAGE ON ${it.source === 'Poly Haven' ? 'POLY HAVEN' : 'SKETCHFAB'} ›`), ...(lic ? [h('a.studiosource', { href: lic.href, target: '_blank', rel: 'noopener noreferrer license' }, `THE ${lic.label} LICENCE ›`.replace('LICENCE LICENCE', 'LICENCE'))] : []))] : []));
    };
    async function openItem(it: CatalogItem): Promise<boolean> {
      asked = true;
      vstat.textContent = `fetching ${it.name}…`;
      try {
        const data = await fetchModel(it, (pct) => (vstat.textContent = `fetching ${it.name}…${pct !== null ? ` ${pct}%` : ''}`));
        // Poly Haven's models are measured in real metres; Sketchfab's are in whatever units their maker used.
        const ok = await loadAny({ kind: 'glb', data, title: it.name, metres: it.source === 'Poly Haven', credit: creditLine(it) });
        showCredit(ok ? it : null);
        return ok;
      } catch (e) {
        vstat.textContent = `Could not open ${it.name}: ${errText(e)}`;
        toast(`Could not open ${it.name}: ${errText(e)}`, 'bad');
        return false;
      }
    }
    async function openCatalogId(id: string): Promise<boolean> {
      const { items } = await loadCatalog();
      catItems = items;
      const it = items.find((i) => i.id === id);
      if (!it) {
        toast('That catalogue model is not in the list any more', 'warn');
        return false;
      }
      show('models');
      return openItem(it);
    }
    const paintModels = () => {
      clear(
        modelsPane,
        h('div.lab', 'CATALOGUE · REAL MODELS'),
        h('div.keyrow', findIn, findBtn),
        shelfSel,
        catNote,
        catGrid,
        catMore,
        creditBox,
        h('div.lab', 'SAMPLES'),
        ...SAMPLES.map((s) => row(s.title, s.note, '›', { onClick: () => void loadSample(s.id) })),
        h('div.lab', 'FROM YOUR PHONE'),
        h('div.note', 'Any .glb (or a self-contained .gltf) from Files — it opens here and is never uploaded.'),
        h('div.row.wrap', button('OPEN A FILE…', () => fileIn.click())),
        fileIn,
        h('div.lab', 'YOUR MODELS · KEPT ON THIS PHONE'),
        keptBox,
        h('div.lab', 'MADE TODAY · ON THE BRAIN 24 H'),
        madeBox,
      );
      paintKept();
      clear(madeBox, ...(made.length ? made.map((m) => madeRow(m)) : [h('div.note', 'None today. MAKE · PHOTO makes one from words or a photo (free, a few a day).')]));
    };
    const paintKept = () =>
      clear(
        keptBox,
        ...(keptList.length
          ? keptList.map((k) => {
              const r = row(new Date(k.at).toLocaleDateString([], { day: 'numeric', month: 'short' }), k.title, '✕', {
                onClick: async () => {
                  const data = await keptFile(k.id);
                  if (!data) return void toast('That model is no longer on this phone', 'warn');
                  await loadAny({ kind: 'glb', data, title: k.title, metres: k.metres, credit: k.credit });
                },
              });
              const x = r.lastChild as HTMLElement;
              x.classList.add('del');
              x.title = 'Remove it from this phone';
              // UNDO keeps the very same model again (its file is read before it goes)
              x.addEventListener('click', async (e) => {
                e.stopPropagation();
                const file = await keptFile(k.id);
                await forget(k.id);
                void refreshKept();
                if (file)
                  offerUndo(`Removed from this phone: ${k.title}`, async () => {
                    await keep(k, file);
                    void refreshKept();
                    toast(`Back on this phone: ${k.title}`, 'ok');
                  });
              });
              return r;
            })
          : [h('div.note', 'Models made for you are kept here, on this phone, after the brain’s day is up.')]),
      );
    const refreshKept = async () => {
      keptList = await listKept();
      if (pane === 'models') paintKept();
    };
    const madeRow = (m: MadeModel) => {
      const r = row(new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), m.title, '✕', { onClick: () => void loadMade(m.id, m.title, m) });
      const x = r.lastChild as HTMLElement;
      x.classList.add('del');
      x.title = 'Forget this model';
      // Off the list with UNDO; the brain forgets it only when the bar goes (it keeps no copy to bring back).
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        madeGoing.add(m.id);
        r.remove();
        offerUndo(
          `Forgotten: ${m.title}`,
          () => {
            madeGoing.delete(m.id);
            void refreshMade();
          },
          async () => {
            await fetch(`/api/m3d/${encodeURIComponent(m.id)}`, { method: 'DELETE', headers: headers(), credentials: 'same-origin', keepalive: true }).catch(() => null);
            madeGoing.delete(m.id);
            void refreshMade();
          },
        );
      });
      return r;
    };
    const refreshMade = async () => {
      try {
        const r = await fetch('/api/m3d', { headers: headers(), credentials: 'same-origin' });
        const j = (await r.json()) as { models?: MadeModel[] };
        made.splice(0, made.length, ...(j.models ?? []).filter((x) => !madeGoing.has(x.id)));
      } catch {
        // offline: the samples still work
      }
      if (pane === 'models') paintModels();
    };
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files?.[0];
      fileIn.value = '';
      if (!f) return;
      if (f.size > 60_000_000) return void toast('That file is too big for the phone (60 MB at most)', 'warn');
      await loadAny({ kind: 'glb', data: await f.arrayBuffer(), title: f.name.replace(/\.(glb|gltf)$/i, ''), metres: true, credit: 'Your file — opened on this phone only' });
    });

    // ---- PARTS
    const partsPane = h('div.studiopane');
    const paintParts = () => {
      const iso = button(V.isolated ? 'ISOLATE: ON' : 'ISOLATE', () => V.setIsolate(!V.isolated), V.isolated ? 'on' : '');
      const all = button('SHOW ALL', () => V.showAll());
      const rows = V.parts.map((p) => {
        const r = row(p.hidden ? 'HIDDEN' : p.id === V.selected ? 'SELECTED' : `#${p.id + 1}`, p.name, p.hidden ? '○' : '●', { onClick: () => V.select(p.id === V.selected ? null : p.id) });
        r.classList.toggle('sel', p.id === V.selected);
        r.classList.toggle('off', p.hidden);
        const eye = r.lastChild as HTMLElement;
        eye.classList.add('eye');
        eye.title = p.hidden ? 'Show this part' : 'Hide this part';
        eye.addEventListener('click', (e) => {
          e.stopPropagation();
          V.toggleHidden(p.id);
        });
        return r;
      });
      clear(partsPane, h('div.row.wrap', iso, all), h('div.note', V.parts.length ? `${V.parts.length} parts · tap one (here or on the model) to light it up; ISOLATE shows it alone; ● hides it.` : 'Open a model first.'), h('div.studiolist', ...rows));
    };

    // ---- CUT · MEASURE
    const toolsPane = h('div.studiopane');
    const cut = h('input', { type: 'range', min: '0', max: '100', value: '50', 'aria-label': 'Where to cut', class: 'studioslider' });
    cut.addEventListener('input', () => V.section && V.setSection(V.section.axis, Number(cut.value) / 100));
    const paintTools = () => {
      const axisBtn = (a: Axis | null, label: string) => button(label, () => V.setSection(a, Number(cut.value) / 100), (V.section?.axis ?? null) === a ? 'on' : '');
      const mBtn = button(V.measuring ? 'MEASURING — TAP TWO POINTS' : 'MEASURE', () => V.setMeasuring(!V.measuring), V.measuring ? 'on' : '');
      clear(
        toolsPane,
        h('div.lab', 'SECTION'),
        h('div.note', 'Cut the model open along an axis and slide the cut through it.'),
        h('div.row.wrap.studioaxes', axisBtn(null, 'OFF'), axisBtn('x', 'X'), axisBtn('y', 'Y'), axisBtn('z', 'Z')),
        cut,
        h('div.lab', 'MEASURE'),
        h('div.note', V.info.metres ? 'Tap two points on the model: the straight-line distance between them, in real units (glTF models and rooms are in metres).' : 'Tap two points on the model: the distance in the model’s own units (a model made from a picture has no real size).'),
        h('div.row.wrap', mBtn, button('CLEAR', () => V.clearMeasure())),
        h('div.studioreadout', V.measureText() || (V.measuring ? `${V.measure.points.length} of 2 points` : '—')),
      );
    };

    // ---- MAKE · PHOTO: make anything from words, and a textured model from a photo
    const makePane = h('div.studiopane');
    const describe = h('input', { placeholder: 'Type anything: “a brass telescope”, “a red armchair”', 'aria-label': 'What to make', enterKeyHint: 'go' });
    const makeNote = h('div.studioreadout', '');
    const drawn = h('img.studiothumb', { alt: 'The picture it is being made from' });
    drawn.hidden = true;
    const askBox = h('div.row.wrap');
    let makingAny = false;
    const makeItBtn = button('MAKE IT', () => void makeAnything(describe.value), 'on');
    describe.addEventListener('keydown', (e) => e.key === 'Enter' && void makeAnything(describe.value));
    /** Words → the catalogue's real model when there is a good one, else a generated one, else a stand-in at once. */
    async function makeAnything(text: string, fresh = false): Promise<void> {
      const t = text.replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!t) return void toast('Type one thing to make', 'warn');
      if (makingAny) return;
      makingAny = true;
      makeItBtn.disabled = true;
      clear(askBox);
      drawn.hidden = true;
      makeNote.classList.remove('bad');
      try {
        if (!fresh) {
          makeNote.textContent = 'looking in the catalogue…';
          const { items } = await loadCatalog();
          catItems = items;
          const hit = searchCatalog(items, t, { limit: 1 })[0];
          if (goodMatch(hit) && (await openItem(hit!.item))) {
            makeNote.textContent = `Found a real model: ${creditLine(hit!.item)}.`;
            clear(askBox, button('MAKE A NEW ONE INSTEAD', () => void makeAnything(t, true)));
            return;
          }
        }
        makeNote.textContent = 'Nothing real by that name — making one: a picture first, then 3-D. Usually under 2 minutes, up to about 5 when the free queue is long; keep Ghosty open (leaving the app may stop it).';
        const r = await fetch('/api/m3d/generate', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ prompt: t }), credentials: 'same-origin' });
        let model: MadeModel | null = null;
        let fail: { error?: string; code?: string } | null = null;
        if (!(r.headers.get('content-type') ?? '').includes('ndjson')) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          fail = { error: j.error ?? `the brain answered ${r.status}` };
        } else
          await readLines(r, (l) => {
            if (typeof l.step === 'string') makeNote.textContent = l.step;
            if (typeof l.picture === 'string' && l.picture.startsWith('data:image/')) {
              drawn.src = l.picture;
              drawn.hidden = false;
            }
            if (l.model && typeof l.model === 'object') model = l.model as MadeModel;
            if (typeof l.error === 'string') fail = { error: l.error, code: typeof l.code === 'string' ? l.code : undefined };
          });
        const m = model as MadeModel | null;
        if (m) {
          await loadMade(m.id, m.title, m);
          makeNote.textContent = `Made by ${m.maker ?? 'a free generator'}${m.textured === false ? ' (shape only, no colours)' : m.textured ? ', with its colours' : ''}. Kept on this phone; it has no real size, so MEASURE reads in its own units.`;
          void refreshMade();
          return;
        }
        const f = (fail ?? { error: 'the brain stopped answering before the model was ready' }) as { error?: string; code?: string };
        await standInFor(t, f.error ?? 'it could not be made', f.code);
      } catch (e) {
        await standInFor(t, errText(e), undefined);
      } finally {
        makingAny = false;
        makeItBtn.disabled = false;
      }
    }
    /** The honest fallback: say why, and show a simple model built from shapes straight away. */
    const standInFor = async (t: string, why: string, code: string | undefined) => {
      const s = standIn(t);
      await loadAny({ kind: 'parts', parts: s.parts, title: `${s.title} — stand-in`, credit: 'A simple stand-in built by Ghosty from shapes, at the usual size — not a real model' });
      makeNote.textContent = `Not made: ${why.replace(/\.$/, '')}. Showing a simple stand-in built from shapes instead (real size, in parts).`;
      makeNote.classList.add('bad');
      clear(
        askBox,
        button('TRY AGAIN', () => void makeAnything(t, true)),
        // The brain's chat can draw it with its own free picture maker when the studio's route cannot.
        ...(code === 'no_picture' ? [button('ASK GHOSTY', () => (void send(`Make a new 3D model of ${t}`), toast('Asked Ghosty — it draws the object, then models it (watch the chat)', 'ok')))] : []),
      );
    };

    const photoIn = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'Choose a photo to turn into 3-D' });
    const preview = h('img.studiothumb', { alt: 'Your photo' });
    preview.hidden = true;
    const cutout = h('img.studiothumb', { alt: 'Your photo with the background removed' });
    cutout.hidden = true;
    const makeStatus = h('div.studioreadout', '');
    let photo: Blob | null = null;
    let making = false;
    const makeBtn = button('MAKE 3-D', () => void makeFromPhoto(), 'on');
    const takePhoto = async (f: File) => {
      try {
        photo = await shrinkPhoto(f);
        if (preview.src) URL.revokeObjectURL(preview.src);
        preview.src = URL.createObjectURL(photo);
        preview.hidden = false;
        cutout.hidden = true;
        makeStatus.textContent = 'Ready: press MAKE 3-D.';
      } catch (e) {
        toast(`Could not read that photo: ${errText(e)}`, 'bad');
      }
    };
    photoIn.addEventListener('change', async () => {
      const f = photoIn.files?.[0];
      photoIn.value = '';
      if (f) await takePhoto(f);
    });
    async function makeFromPhoto(): Promise<void> {
      if (making) return;
      if (!photo) return void photoIn.click();
      making = true;
      makeBtn.disabled = true;
      makeStatus.classList.remove('bad');
      makeStatus.textContent = 'Sending the photo… usually 10 seconds to 2 minutes, up to about 5 when the free queue is long; keep Ghosty open (leaving the app may stop it).';
      try {
        const r = await fetch('/api/m3d?stream=1', { method: 'POST', headers: headers({ 'content-type': 'image/jpeg', 'x-title': encodeURIComponent('From a photo') }), body: photo, credentials: 'same-origin' });
        let model: MadeModel | null = null;
        let fail = '';
        if (!(r.headers.get('content-type') ?? '').includes('ndjson')) fail = ((await r.json().catch(() => ({}))) as { error?: string }).error ?? `the brain answered ${r.status}`;
        else
          await readLines(r, (l) => {
            if (typeof l.step === 'string') makeStatus.textContent = l.step;
            if (typeof l.cutout === 'string' && l.cutout.startsWith('data:image/')) {
              cutout.src = l.cutout;
              cutout.hidden = false;
            }
            if (l.model && typeof l.model === 'object') model = l.model as MadeModel;
            if (typeof l.error === 'string') fail = l.error;
          });
        const m = model as MadeModel | null;
        if (!m) throw new Error(fail || 'the brain stopped answering before the model was ready');
        makeStatus.textContent = `Made by ${m.maker ?? 'a free generator'}${m.textured === false ? ' — shape only: the free makers that paint it were busy' : ', with its colours'}. Opening it…`;
        await loadMade(m.id, m.title, m);
        void refreshMade();
      } catch (e) {
        makeStatus.textContent = `Not made: ${errText(e)}`;
        makeStatus.classList.add('bad');
      } finally {
        making = false;
        makeBtn.disabled = false;
      }
    }
    const paintMake = () =>
      clear(
        makePane,
        h('div.lab', 'MAKE ANYTHING'),
        h('div.note', 'Type one thing. Ghosty opens a real model from the catalogue when there is a good one; if not, a free generator draws it and makes it 3-D (a few a day; more with a token from a FREE Hugging Face account in SYSTEM → KEYS — a token from an account that can pay is never used, so nothing is ever charged); if the generators are busy you get a simple stand-in at once.'),
        h('div.keyrow', describe, makeItBtn),
        makeNote,
        drawn,
        askBox,
        h('div.lab', 'PHOTO → TEXTURED 3D'),
        h('div.note', 'A photo of ONE object works best. The background is removed and a model with its colours is made by free models on Hugging Face (TRELLIS.2 with a free account’s token, else Stable Fast 3D). If they are busy you are told why. Kept 24 hours on the brain, and on this phone.'),
        h('div.row.wrap', button('CHOOSE A PHOTO', () => photoIn.click()), makeBtn),
        photoIn,
        h('div.studiopics', preview, cutout),
        makeStatus,
      );

    // ---- ROOM
    const roomPane = h('div.studiopane');
    const num = (label: string, value: string) => h('input', { type: 'number', inputMode: 'decimal', min: '50', max: '5000', value, 'aria-label': label, placeholder: label });
    const rw = num('Width (cm)', '400');
    const rd = num('Depth (cm)', '300');
    const rh = num('Height (cm)', '240');
    const rjson = h('textarea', { rows: 4, placeholder: 'Optional: paste the SPACE PLANNER’s JSON — {"room":{"w":400,"d":300,"h":240},"items":[{"name":"Sofa","w":200,"d":90,"h":85,"x":20,"y":200,"rot":0}]}', 'aria-label': 'Room JSON' });
    const roomNote = h('div.studioreadout', '');
    let ceiling = false;
    let lastRoom: RoomPlan | null = null;
    const builtText = (plan: RoomPlan) => {
      const ops = plan.openings ?? [];
      const doors = ops.filter((o) => o.type === 'door').length;
      const wins = ops.length - doors;
      const bits = [plan.rooms && plan.rooms.length > 1 ? `${plan.rooms.length} rooms` : '', doors ? `${doors} door${doors === 1 ? '' : 's'}` : '', wins ? `${wins} window${wins === 1 ? '' : 's'}` : '', plan.items?.length ? `${plan.items.length} item${plan.items.length === 1 ? '' : 's'}` : ''].filter(Boolean);
      return V.info.warnings.length ? `Check: ${V.info.warnings.join('; ')}.` : `Built: ${plan.room.w} × ${plan.room.d} cm${bits.length ? `, ${bits.join(', ')}` : ''}. WALK stands you in it; AERIAL looks down on it.`;
    };
    const showRoom = async (plan: RoomPlan) => {
      lastRoom = plan;
      await loadAny({ kind: 'room', plan, ceiling });
      roomNote.textContent = builtText(plan);
      paintModes();
    };
    const buildRoom = async () => {
      let plan: RoomPlan;
      try {
        plan = rjson.value.trim() ? parseRoom(rjson.value) : parseRoom({ room: { w: rw.value, d: rd.value, h: rh.value } });
      } catch (e) {
        roomNote.textContent = errText(e);
        return;
      }
      await showRoom(plan);
    };
    const fromPlanner = async () => {
      try {
        await showRoom(parseRoom(planToRoom(space.get().plan)));
      } catch (e) {
        roomNote.textContent = errText(e);
      }
    };
    const ceilBtn = button('CEILING: OFF', () => {
      ceiling = !ceiling;
      ceilBtn.textContent = ceiling ? 'CEILING: ON' : 'CEILING: OFF';
      ceilBtn.classList.toggle('on', ceiling);
      if (lastRoom && V.info.room) {
        // Rebuilding the room resets the view: WALK stands the walker back where they were, looking the same way.
        const mode = V.mode;
        const walk = V.walk ? { ...V.walk } : null;
        void showRoom(lastRoom).then(() => mode !== 'orbit' && setMode(mode, walk));
      }
    });
    const paintRoom = () =>
      clear(
        roomPane,
        h('div.note', 'Your SPACE PLANNER plan — rooms, doors, windows and furniture — built in 3-D; or type a room’s inside size in centimetres, or paste Room JSON. WALK stands you inside at eye height (push the joystick to walk, drag to look); AERIAL looks straight down.'),
        h('div.row.wrap', button('FROM MY PLAN', () => void fromPlanner(), 'on'), ceilBtn),
        h('div.studioroom', h('label', 'W', rw), h('label', 'D', rd), h('label', 'H', rh)),
        rjson,
        h('div.row.wrap', button('BUILD ROOM', () => void buildRoom()), button('INSIDE VIEW', () => V.insideView())),
        roomNote,
      );
    // ORBIT / WALK / AERIAL, on the scene while a room is showing.
    const setMode = (m: ViewMode, keep: WalkState | null = null) => {
      V.setMode(m, keep);
      stick.hidden = V.mode !== 'walk';
      paintModes();
    };
    const paintModes = () => {
      modeBar.hidden = !V.info.room;
      stick.hidden = V.mode !== 'walk';
      clear(modeBar, ...(['orbit', 'walk', 'aerial'] as const).map((m) => button(m.toUpperCase(), () => setMode(m), V.mode === m ? 'on' : '')));
    };

    // ---- SPLINE
    const splinePane = h('div.studiopane');
    const splineIn = h('input', { type: 'url', placeholder: 'https://my.spline.design/your-scene-…/', 'aria-label': 'Spline public URL' });
    const splineNote = h('div.studioreadout', '');
    const splineBox = h('div.studiosplinebox');
    let splineUrl = '';
    const showSpline = (input: string) => {
      const c = splineEmbedUrl(input);
      if (!c.ok) {
        splineNote.textContent = c.why;
        splineNote.classList.add('bad');
        return false;
      }
      splineNote.classList.remove('bad');
      splineNote.textContent = '';
      splineUrl = c.url;
      paintSplineFrame();
      return true;
    };
    const paintSplineFrame = () => {
      if (!splineUrl) return void clear(splineBox);
      const frame = h('iframe', { src: splineUrl, title: 'Spline scene', loading: 'lazy', referrerPolicy: 'no-referrer', allow: 'fullscreen', sandbox: 'allow-scripts allow-same-origin allow-popups' });
      clear(splineBox, h('div.studiospline', frame), h('a.studiopowered', { href: 'https://spline.design', target: '_blank', rel: 'noopener noreferrer' }, 'Powered by Spline'), h('div.row.wrap', button('REMOVE', () => ((splineUrl = ''), paintSplineFrame()))));
    };
    splineIn.addEventListener('keydown', (e) => e.key === 'Enter' && showSpline(splineIn.value));
    const paintSpline = () => {
      clear(
        splinePane,
        h('div.note', 'Made something in Spline? In Spline press Export → Public URL, copy the link and paste it here: the scene opens below, live. Only my.spline.design links are accepted.'),
        h('div.keyrow', splineIn, button('SHOW', () => showSpline(splineIn.value), 'on')),
        splineNote,
        splineBox,
      );
      paintSplineFrame();
    };

    const panes: Record<Pane, { el: HTMLElement; paint: () => void }> = {
      models: { el: modelsPane, paint: paintModels },
      parts: { el: partsPane, paint: paintParts },
      tools: { el: toolsPane, paint: paintTools },
      make: { el: makePane, paint: paintMake },
      room: { el: roomPane, paint: paintRoom },
      spline: { el: splinePane, paint: paintSpline },
    };
    function show(p: Pane) {
      pane = p;
      for (const b of segBtns) b.classList.toggle('on', b.dataset.pane === p);
      panes[p].paint();
      clear(panel, panes[p].el);
      hud.dataset.pane = p;
    }

    // ---- the viewer's state onto the screen
    const paintState = () => {
      vtitle.textContent = V.info.title || '3D STUDIO';
      vstat.textContent = V.parts.length ? `${V.parts.length} PARTS · ${V.info.triangles.toLocaleString('en-GB')} TRIANGLES${V.selected !== null ? ` · ${V.parts[V.selected]?.name ?? ''}` : ''}` : V.error || 'no model';
      if (credit.dataset.text !== V.info.credit) {
        credit.dataset.text = V.info.credit;
        const lic = licenceLink(V.info.credit);
        clear(credit, V.info.credit, ...(lic ? [' · ', h('a.studiolic', { href: lic.href, target: '_blank', rel: 'noopener noreferrer license' }, lic.label)] : []));
      }
      const t = Math.round(V.explode * 100);
      slider.value = String(t);
      pct.textContent = `${t}%`;
      apart.textContent = V.explode > 0.5 ? 'REASSEMBLE' : 'TAKE APART';
      turn.classList.toggle('on', !!V.controls?.autoRotate);
      const m = V.measureText();
      vmeasure.hidden = !V.measuring && !m;
      vmeasure.textContent = m ? `◆ ${m}` : V.measuring ? `MEASURE · tap point ${V.measure.points.length + 1} of 2` : '';
      if (pane === 'parts') paintParts();
      if (pane === 'tools') paintTools();
      paintModes();
    };
    V.onChange = paintState;

    // `active`: the tab is showing, so a load that lands after the owner left (a 2-minute photo
    // model) does not restart drawing behind another tab. `asked`: something was asked to load, so
    // the first visit's default reactor does not replace it.
    let active = false;
    let asked = false;
    // UNDO: the models shown before this one (a few, newest last), to go back to.
    const history: ModelSource[] = [];
    let current: ModelSource | null = null;
    const loadAny = async (src: ModelSource, back = false): Promise<boolean> => {
      asked = true;
      vstat.textContent = 'loading…';
      try {
        await V.load(src);
        if (active) V.start();
        if (current && !back) history.push(current);
        if (history.length > 3) history.shift();
        current = src;
        undo.disabled = !history.length;
        return true;
      } catch (e) {
        vstat.textContent = `Could not open it: ${errText(e)}`;
        toast(`Could not open the model: ${errText(e)}`, 'bad');
        return false;
      }
    };
    const undoLoad = async () => {
      const prev = history.pop();
      if (!prev) return;
      await loadAny(prev, true);
      undo.disabled = !history.length;
      toast(`Back to ${V.info.title || 'the model before'}`, 'ok');
    };
    const loadSample = async (id: SampleId | string) => {
      const s = SAMPLES.find((x) => x.id === id);
      if (!s) return;
      asked = true;
      if (!s.file) return loadAny({ kind: 'reactor' });
      vstat.textContent = `fetching ${s.title}…`;
      try {
        const r = await fetch(`/models/${s.file}`);
        if (!r.ok) throw new Error(`${r.status}`);
        // A sample with many parts already is taken apart by its parts; a one-piece one is split.
        await loadAny({ kind: 'glb', data: await r.arrayBuffer(), title: s.title, metres: true, credit: s.credit });
      } catch (e) {
        vstat.textContent = `Could not fetch the sample: ${errText(e)}`;
      }
    };
    const loadMade = async (id: string, title = 'From a picture', info?: Partial<MadeModel>) => {
      asked = true;
      vstat.textContent = 'fetching your model…';
      try {
        const r = await fetch(`/api/m3d/${encodeURIComponent(id)}`, { headers: headers(), credentials: 'same-origin' });
        if (!r.ok) throw new Error(r.status === 404 ? 'that model is gone (models are kept 24 hours)' : `the brain answered ${r.status}`);
        const data = await r.arrayBuffer();
        // Opened by Ghosty from the chat: the brain's list says which free maker made it.
        if (!info?.credit && !made.some((m) => m.id === id)) await refreshMade();
        const credit = info?.credit || made.find((m) => m.id === id)?.credit || 'Made from a picture by a free 3-D maker on Hugging Face';
        if (await loadAny({ kind: 'glb', data: data.slice(0), title, metres: false, credit })) {
          // The brain keeps it a day; this phone keeps it until it is removed.
          await keep({ id: `m3d:${id}`, title, credit, at: Date.now(), bytes: data.byteLength, metres: false }, data);
          void refreshKept();
        }
      } catch (e) {
        vstat.textContent = `Could not open it: ${errText(e)}`;
      }
    };
    const screenshot = async () => {
      const raw = await V.screenshot();
      if (!raw) return void toast('Nothing to capture yet', 'warn');
      const shotCredit = V.info.credit;
      const blob = await burnCredit(raw, shotCredit).catch(() => raw);
      const name = `Ghosty 3D ${new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.')}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      S.lastShot = { bytes: blob.size, type: blob.type, credit: shotCredit, burned: blob !== raw };
      if (navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file], title: name, ...(shotCredit ? { text: shotCredit } : {}) }).catch((e: unknown) => {
          if ((e as Error)?.name !== 'AbortError') toast(`Could not share it: ${errText(e)}`, 'bad');
        });
      } else {
        const url = URL.createObjectURL(file);
        const a = h('a', { href: url, download: name });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    };

    const apply = (a: StudioArgs) => {
      if (a.spline) {
        show('spline');
        splineIn.value = a.spline;
        showSpline(a.spline);
      }
      if (a.room) {
        try {
          const plan = parseRoom(typeof a.room === 'string' ? a.room : (a.room as object));
          show('room');
          rw.value = String(plan.room.w);
          rd.value = String(plan.room.d);
          if (plan.room.h) rh.value = String(plan.room.h);
          void showRoom(plan);
        } catch (e) {
          toast(errText(e), 'warn');
        }
      } else if (a.catalog) void openCatalogId(a.catalog);
      else if (a.make) {
        show('make');
        describe.value = a.make;
        void makeAnything(a.make);
      }
      else if (a.model) void loadMade(a.model, a.title);
      else if (a.sample) void loadSample(a.sample);
    };

    // ---- what a test can read and drive (window.__ghosty.studio)
    const S = {
      viewer: V,
      lastShot: null as null | { bytes: number; type: string; credit?: string; burned?: boolean },
      loadSample: (id: string) => loadSample(id),
      loadRoom: (plan: unknown) => showRoom(parseRoom(plan)),
      fromPlanner: () => fromPlanner(),
      setMode: (m: ViewMode) => setMode(m),
      setCeiling: (on: boolean) => on !== ceiling && ceilBtn.click(),
      show: (p: Pane) => show(p),
      search: (q: string, group = '') => runSearch(q, group),
      openCatalog: (id: string) => openCatalogId(id),
      makeAnything: (t: string, fresh = false) => makeAnything(t, fresh),
      undo: () => undoLoad(),
      state: () => ({
        title: V.info.title,
        credit: V.info.credit,
        hits: catHits.slice(0, 24).map((x) => ({ id: x.item.id, name: x.item.name, licence: x.item.licence })),
        catalogue: catItems.length,
        makeNote: makeNote.textContent,
        photoNote: makeStatus.textContent,
        kept: keptList.map((k) => k.title),
        keptInMemory: keptInMemory(),
        undo: history.length,
        standIn: current?.kind === 'parts',
        parts: V.parts.map((p) => ({ name: p.name, visible: p.obj.visible, pos: [p.obj.position.x, p.obj.position.y, p.obj.position.z] as [number, number, number], home: [p.home.x, p.home.y, p.home.z] as [number, number, number] })),
        explode: V.explode,
        selected: V.selected,
        section: V.section,
        measure: V.measureText(),
        room: V.info.room,
        warnings: V.info.warnings,
        spline: splineUrl,
        error: V.error,
        running: !!V.renderer,
        mode: V.mode,
        walk: V.walk ? { ...V.walk } : null,
        camera: V.camera ? [V.camera.position.x, V.camera.position.y, V.camera.position.z] : null,
        ceiling,
        rooms: V.roomPlan?.rooms?.length ?? (V.info.room ? 1 : 0),
        openings: V.roomPlan?.openings?.length ?? 0,
        boxes: V.parts.length,
      }),
    };
    const g = window as unknown as { __ghosty?: Record<string, unknown> };
    (g.__ghosty ??= {}).studio = S;

    controller = { apply };
    show('models');
    let first = true;
    return {
      enter() {
        active = true;
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', onKey);
        void (async () => {
          if (!(await V.init())) {
            vstat.textContent = V.error;
            return;
          }
          if (!active) return;
          V.start();
          const a = wanted;
          wanted = null;
          if (a && (a.sample || a.catalog || a.make || a.model || a.room || a.spline)) apply(a);
          else if (first && !V.model && !asked) void loadSample('reactor');
          first = false;
          void refreshMade();
          void refreshKept();
        })();
      },
      leave() {
        // Nothing is drawn while the studio is not showing (the phone's battery and memory).
        active = false;
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        keys.clear();
        stickEnd();
        V.stop();
        V.setTurntable(false);
      },
      describe: () =>
        V.parts.length
          ? `3D Studio: ${V.info.title}, ${V.parts.length} parts, ${Math.round(V.explode * 100)}% taken apart${V.selected !== null ? `, "${V.parts[V.selected]?.name}" selected` : ''}${V.section ? `, cut along ${V.section.axis.toUpperCase()}` : ''}${V.measureText() ? `, measured ${V.measureText()}` : ''}.`
          : '3D Studio: no model open.',
    };
  },
};
