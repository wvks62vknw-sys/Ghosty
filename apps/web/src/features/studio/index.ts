/**
 * 3D STUDIO tab: Tony Stark's lab bench on the phone. A holographic three.js scene (studio/viewer.ts)
 * where any model can be turned, TAKEN APART (each part flies out from the centre, a slider from
 * 0 to 100 %), REASSEMBLED, isolated part by part, cut open with a SECTION plane and MEASURED
 * between two taps — plus screenshots, built-in samples, models made from a picture (make_3d in
 * the brain, best effort), any .glb/.gltf from Files (nothing uploaded), a ROOM built from its
 * measurements (the SPACE PLANNER's JSON), and the owner's own Spline scenes (iframe, "Powered by
 * Spline" under it — Spline itself has no API for making models).
 *
 * three.js is loaded only when this tab first opens, and stops drawing when the tab is left.
 * A test reads and drives it through window.__ghosty.studio.
 */
import { headers } from '../../api/brain';
import { send } from '../../assistant/session';
import { clear, h } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { button, row, toast } from '../../ui/components';
import { parseRoom, type RoomPlan } from '../../studio/room';
import { splineEmbedUrl } from '../../studio/spline';
import { Viewer, type Axis, type ModelSource } from '../../studio/viewer';

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
  { id: 'make', label: 'PHOTO → 3D' },
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
}

/** What open_studio asks for. */
export interface StudioArgs {
  sample?: string;
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
    view.append(h('div.studiohud', vtitle, vstat), vmeasure, credit);
    const V = new Viewer(view);

    // ---- the bar under the scene: take apart, the slider, turntable, frame, screenshot
    const slider = h('input', { type: 'range', min: '0', max: '100', value: '0', step: '1', 'aria-label': 'How far apart', class: 'studioslider' });
    const pct = h('span.studiopct', '0%');
    const apart = button('TAKE APART', () => void V.animateTo(V.explode > 0.5 ? 0 : 1), 'on');
    apart.classList.add('studioapart');
    const turn = button('TURNTABLE', () => V.setTurntable(!V.controls?.autoRotate));
    const shot = button('SHOT', () => void screenshot());
    const fit = button('FRAME', () => V.frame());
    slider.addEventListener('input', () => V.setExplode(Number(slider.value) / 100));
    const bar = h('div.studiobar', apart, h('label.studiorange', slider, pct), h('div.studiobtns', turn, fit, shot));

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

    // ---- MODELS
    const modelsPane = h('div.studiopane');
    const fileIn = h('input', { type: 'file', accept: '.glb,.gltf,model/gltf-binary,model/gltf+json', hidden: true, 'aria-label': 'Open a 3-D model file' });
    const made: MadeModel[] = [];
    const madeBox = h('div.studiolist');
    const paintModels = () => {
      clear(
        modelsPane,
        h('div.lab', 'SAMPLES'),
        ...SAMPLES.map((s) => row(s.title, s.note, '›', { onClick: () => void loadSample(s.id) })),
        h('div.lab', 'FROM YOUR PHONE'),
        h('div.note', 'Any .glb (or a self-contained .gltf) from Files — it opens here and is never uploaded.'),
        h('div.row.wrap', button('OPEN A FILE…', () => fileIn.click())),
        fileIn,
        h('div.lab', 'MADE FROM PICTURES · KEPT 24 H'),
        madeBox,
      );
      clear(madeBox, ...(made.length ? made.map((m) => madeRow(m)) : [h('div.note', 'None today. PHOTO → 3D turns a picture into a model (free, a few a day).')]));
    };
    const madeRow = (m: MadeModel) => {
      const r = row(new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), m.title, '✕', { onClick: () => void loadMade(m.id, m.title) });
      const x = r.lastChild as HTMLElement;
      x.classList.add('del');
      x.title = 'Forget this model';
      x.addEventListener('click', async (e) => {
        e.stopPropagation();
        await fetch(`/api/m3d/${encodeURIComponent(m.id)}`, { method: 'DELETE', headers: headers(), credentials: 'same-origin' }).catch(() => null);
        void refreshMade();
      });
      return r;
    };
    const refreshMade = async () => {
      try {
        const r = await fetch('/api/m3d', { headers: headers(), credentials: 'same-origin' });
        const j = (await r.json()) as { models?: MadeModel[] };
        made.splice(0, made.length, ...(j.models ?? []));
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

    // ---- PHOTO → 3D
    const makePane = h('div.studiopane');
    const photoIn = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'Choose a photo to turn into 3-D' });
    const preview = h('img.studiothumb', { alt: '' });
    preview.hidden = true;
    const makeStatus = h('div.studioreadout', '');
    const describe = h('input', { placeholder: 'Or describe one object, e.g. "a vintage brass telescope"', 'aria-label': 'Describe an object to model' });
    let photo: Blob | null = null;
    let making = false;
    const makeBtn = button('MAKE 3-D', () => void makeFromPhoto(), 'on');
    photoIn.addEventListener('change', async () => {
      const f = photoIn.files?.[0];
      photoIn.value = '';
      if (!f) return;
      try {
        photo = await shrinkPhoto(f);
        if (preview.src) URL.revokeObjectURL(preview.src);
        preview.src = URL.createObjectURL(photo);
        preview.hidden = false;
        makeStatus.textContent = 'Ready: press MAKE 3-D.';
      } catch (e) {
        toast(`Could not read that photo: ${errText(e)}`, 'bad');
      }
    });
    const makeFromPhoto = async () => {
      if (making) return;
      if (!photo) return void photoIn.click();
      making = true;
      makeBtn.disabled = true;
      makeStatus.textContent = 'Making the model… this takes 20 seconds to 2 minutes.';
      try {
        const r = await fetch('/api/m3d', { method: 'POST', headers: headers({ 'content-type': 'image/jpeg', 'x-title': encodeURIComponent('From a photo') }), body: photo, credentials: 'same-origin' });
        const j = (await r.json().catch(() => ({}))) as { model?: MadeModel; error?: string };
        if (!r.ok || !j.model) throw new Error(j.error ?? `the brain answered ${r.status}`);
        makeStatus.textContent = 'Made. Opening it…';
        await loadMade(j.model.id, j.model.title);
        void refreshMade();
      } catch (e) {
        makeStatus.textContent = `Not made: ${errText(e)}`;
      } finally {
        making = false;
        makeBtn.disabled = false;
      }
    };
    const askGhosty = () => {
      const t = describe.value.trim();
      if (!t) return void toast('Describe one object first', 'warn');
      describe.value = '';
      void send(`Make a 3D model of ${t}`);
      toast('Asked Ghosty — it draws the object, then models it (watch the chat)', 'ok');
    };
    describe.addEventListener('keydown', (e) => e.key === 'Enter' && askGhosty());
    const paintMake = () =>
      clear(
        makePane,
        h('div.note', 'A photo of ONE object on a plain background works best. The model is made by the free Hunyuan3D-2 demo on Hugging Face: shape only (clay, no colours), 20 s to 2 min, and only about 2–3 a day without a free Hugging Face token (SYSTEM → KEYS). Kept 24 hours.'),
        h('div.row.wrap', button('CHOOSE A PHOTO', () => photoIn.click()), makeBtn),
        photoIn,
        preview,
        makeStatus,
        h('div.lab', 'NO PHOTO?'),
        h('div.keyrow', describe, button('ASK GHOSTY', askGhosty)),
      );

    // ---- ROOM
    const roomPane = h('div.studiopane');
    const num = (label: string, value: string) => h('input', { type: 'number', inputMode: 'decimal', min: '50', max: '5000', value, 'aria-label': label, placeholder: label });
    const rw = num('Width (cm)', '400');
    const rd = num('Depth (cm)', '300');
    const rh = num('Height (cm)', '240');
    const rjson = h('textarea', { rows: 4, placeholder: 'Optional: paste the SPACE PLANNER’s JSON — {"room":{"w":400,"d":300,"h":240},"items":[{"name":"Sofa","w":200,"d":90,"h":85,"x":20,"y":200,"rot":0}]}', 'aria-label': 'Room JSON' });
    const roomNote = h('div.studioreadout', '');
    const buildRoom = async () => {
      let plan: RoomPlan;
      try {
        plan = rjson.value.trim() ? parseRoom(rjson.value) : parseRoom({ room: { w: rw.value, d: rd.value, h: rh.value } });
      } catch (e) {
        roomNote.textContent = errText(e);
        return;
      }
      await loadAny({ kind: 'room', plan });
      roomNote.textContent = V.info.warnings.length ? `Check: ${V.info.warnings.join('; ')}.` : `Built: ${plan.room.w} × ${plan.room.d} cm${plan.items?.length ? `, ${plan.items.length} item${plan.items.length === 1 ? '' : 's'}` : ''}. Drag to walk round it; INSIDE VIEW stands you in it.`;
    };
    const paintRoom = () =>
      clear(
        roomPane,
        h('div.note', 'Type the room’s inside size in centimetres, or paste a plan from the SPACE PLANNER, and walk round it in 3-D. TAKE APART lifts the walls away.'),
        h('div.studioroom', h('label', 'W', rw), h('label', 'D', rd), h('label', 'H', rh)),
        rjson,
        h('div.row.wrap', button('BUILD ROOM', () => void buildRoom(), 'on'), button('INSIDE VIEW', () => V.insideView())),
        roomNote,
      );

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
      credit.textContent = V.info.credit;
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
    };
    V.onChange = paintState;

    // `active`: the tab is showing, so a load that lands after the owner left (a 2-minute photo
    // model) does not restart drawing behind another tab. `asked`: something was asked to load, so
    // the first visit's default reactor does not replace it.
    let active = false;
    let asked = false;
    const loadAny = async (src: ModelSource) => {
      asked = true;
      vstat.textContent = 'loading…';
      try {
        await V.load(src);
        if (active) V.start();
      } catch (e) {
        vstat.textContent = `Could not open it: ${errText(e)}`;
        toast(`Could not open the model: ${errText(e)}`, 'bad');
      }
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
    const loadMade = async (id: string, title = 'From a picture') => {
      asked = true;
      vstat.textContent = 'fetching your model…';
      try {
        const r = await fetch(`/api/m3d/${encodeURIComponent(id)}`, { headers: headers(), credentials: 'same-origin' });
        if (!r.ok) throw new Error(r.status === 404 ? 'that model is gone (models are kept 24 hours)' : `the brain answered ${r.status}`);
        await loadAny({ kind: 'glb', data: await r.arrayBuffer(), title, metres: false, credit: 'Made from a picture by Hunyuan3D-2 (Tencent), via Hugging Face' });
      } catch (e) {
        vstat.textContent = `Could not open it: ${errText(e)}`;
      }
    };
    const screenshot = async () => {
      const blob = await V.screenshot();
      if (!blob) return void toast('Nothing to capture yet', 'warn');
      const name = `Ghosty 3D ${new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.')}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      S.lastShot = { bytes: blob.size, type: blob.type };
      if (navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file], title: name }).catch((e: unknown) => {
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
          void loadAny({ kind: 'room', plan });
        } catch (e) {
          toast(errText(e), 'warn');
        }
      } else if (a.model) void loadMade(a.model, a.title);
      else if (a.sample) void loadSample(a.sample);
    };

    // ---- what a test can read and drive (window.__ghosty.studio)
    const S = {
      viewer: V,
      lastShot: null as null | { bytes: number; type: string },
      loadSample: (id: string) => loadSample(id),
      loadRoom: (plan: unknown) => loadAny({ kind: 'room', plan: parseRoom(plan) }),
      show: (p: Pane) => show(p),
      state: () => ({
        title: V.info.title,
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
        void (async () => {
          if (!(await V.init())) {
            vstat.textContent = V.error;
            return;
          }
          if (!active) return;
          V.start();
          const a = wanted;
          wanted = null;
          if (a && (a.sample || a.model || a.room || a.spline)) apply(a);
          else if (first && !V.model && !asked) void loadSample('reactor');
          first = false;
          void refreshMade();
        })();
      },
      leave() {
        // Nothing is drawn while the studio is not showing (the phone's battery and memory).
        active = false;
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
