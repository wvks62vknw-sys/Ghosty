/**
 * The 3D STUDIO's 3-D ENGINE pane (BRIEF-ENGINE-3D-1), the way DESIGN A BUILD is one: a stage of its own over the studio's view where he
 * builds a scene with his fingers (one finger turns it, two pinch and slide it, a tap places or selects, handles move, turn and
 * size), and under it the numbers (sizes typed in cm), the library (the parametric set, and the FREE MODELS shelf that downloads
 * only on his tap on Wi-Fi), the materials, SAVE and OPEN, and EXPORT to glTF. A test reads and drives it through
 * window.__ghosty.engine3d.
 */
import type { ScreenContext } from '../../../../packages/shared/src/awareness';
import { clear, h } from '../core/dom';
import { button, toast, undo as offerUndo } from '../ui/components';
import { Drops } from './drop';
import { Engine } from './engine';
import { exportGltf, type Exported } from './gltf';
import { freeShelf, forgetFile, getWords, keptFile, keptIds, loadFree, modelFile, onMobileData, waitWords, type FreeModel } from './library';
import { bytesWords, creditsOf, ESTIMATE, MATERIALS, newScene, PARAMETRIC, PRIMITIVES, readScene, sizeWords, WORKING, type Obj, type Product, type Scene } from './scene';
import { currentScene, forgetScene, restoreScene, saveAs, savedScenes, setCurrent } from './store';
import { project } from './camera';
import type { Tool } from './edit';
import { EngineView } from './view';
import { sayError } from '../ui/hisWords';

export interface EnginePane {
  el: HTMLElement;
  engine: Engine;
  view: EngineView;
  enter(): Promise<void>;
  leave(): void;
  loadScene(s: Scene): void;
  context(): ScreenContext | null;
}

const NUM_FIELDS: { key: 'w' | 'd' | 'h' | 'x' | 'z' | 'y' | 'rot'; label: string; unit: string; min?: number }[] = [
  { key: 'w', label: 'Width', unit: 'cm', min: 1 },
  { key: 'd', label: 'Depth', unit: 'cm', min: 1 },
  { key: 'h', label: 'Height', unit: 'cm', min: 1 },
  { key: 'x', label: 'Across', unit: 'cm' },
  { key: 'z', label: 'Along', unit: 'cm' },
  { key: 'y', label: 'Off the ground', unit: 'cm', min: 0 },
  { key: 'rot', label: 'Turn', unit: '°', min: 0 },
];

const TOOLS: { id: Tool; label: string; aria: string }[] = [
  { id: 'move', label: 'MOVE', aria: 'Move: drag the thing across the ground' },
  { id: 'turn', label: 'TURN', aria: 'Turn: drag round the thing' },
  { id: 'size', label: 'SIZE', aria: 'Size: drag a knob at the width, the depth or the top' },
];

export function enginePane(view: HTMLElement): EnginePane {
  const engine = new Engine(currentScene());
  const stage = h('div.e3stage');
  stage.hidden = true;
  view.append(stage);
  const eview = new EngineView(stage, engine);

  // ---- the stage's own marks: the scene's name and count, FRAME, UNDO, REDO; the tools; the armed hint
  const title = h('b.e3title');
  const frameKey = button('FRAME', () => engine.frame(), 'e3chip');
  frameKey.setAttribute('aria-label', 'Frame the whole scene');
  const undoKey = button('UNDO', () => void engine.undo(), 'e3chip');
  const redoKey = button('REDO', () => void engine.redo(), 'e3chip');
  for (const b of [frameKey, undoKey, redoKey]) b.dataset.case = 'keep';
  stage.append(h('div.e3hud', title, h('div.e3chips', frameKey, undoKey, redoKey)));
  const toolKeys = TOOLS.map((t) => {
    const b = button(t.label, () => engine.setTool(t.id), 'e3tool');
    b.dataset.tool = t.id;
    b.dataset.case = 'keep';
    b.setAttribute('aria-label', t.aria);
    return b;
  });
  // ---- PHYSICS (physics.ts, drop.ts): off until he turns it on; DROP IT lets the selected thing fall
  const drops = new Drops(engine);
  eview.tick = (ms, force) => drops.tick(ms, force);
  const dropKey = button('DROP IT', () => void (engine.selected && drops.drop(engine.selected)), 'e3tool');
  dropKey.dataset.case = 'keep';
  dropKey.setAttribute('aria-label', 'Drop it: the selected thing falls and lands on what is under it');
  const tools = h('div.e3tools', { role: 'group', 'aria-label': 'What a drag does to the selected thing' }, ...toolKeys, dropKey);
  const hintText = h('span');
  const hintMid = button('IN THE MIDDLE', () => {
    if (engine.armed) engine.place(engine.armed.kind, 0, 0, engine.armed.over ?? {}), engine.arm(null);
  }, 'e3chip');
  const hintCancel = button('CANCEL', () => engine.arm(null), 'e3chip');
  for (const b of [hintMid, hintCancel]) b.dataset.case = 'keep';
  const hint = h('div.e3hint', { role: 'status' }, hintText, hintMid, hintCancel);
  hint.hidden = true;
  const say = h('p.e3say', { role: 'status', 'aria-live': 'polite' });
  stage.append(tools, hint);

  // ---- the panel under the stage
  const est = h('p.e3est', ESTIMATE);
  const inspector = h('div.e3inspector');
  const library = h('div.e3library');
  const things = h('div.e3things', { role: 'group', 'aria-label': 'Everything in the scene' });
  const sceneBox = h('div.e3scene');
  const physKey = button('PHYSICS: OFF', () => void (drops.on ? drops.turnOff() : drops.turnOn()), 'e3act');
  physKey.dataset.case = 'keep';
  physKey.setAttribute('aria-pressed', 'false');
  physKey.setAttribute('aria-label', 'Physics is off. Tap to turn it on: things you drop then fall and land.');
  const phys = h('div.e3acts.e3phys', physKey);
  const el = h('div.studiopane.e3pane', est, say, phys, things, inspector, library, sceneBox);

  // ---- the library: PARAMETRIC and FREE MODELS
  let shelf: 'param' | 'free' = 'param';
  let freeQuery = '';
  let freeNote = '';
  let freeRows: FreeModel[] = [];
  let freeLoaded = false;
  let kept = new Set<string>();
  let getting = '';
  const free = { fetches: 0, waited: 0, listed: 0, last: '' };
  const said = (t: string) => {
    say.textContent = t;
    engine.last = t;
  };
  drops.say = said;

  const card = (p: Product) => {
    const b = button(h('span.e3cardin', h('b', p.name), h('small', `${p.w} × ${p.d} × ${p.h} cm`)), () => (engine.armed?.kind === p.kind ? engine.arm(null) : engine.arm({ kind: p.kind, label: p.name })), 'e3card');
    b.dataset.kind = p.kind;
    b.dataset.case = 'keep';
    b.setAttribute('aria-label', `${p.name}, ${p.w} by ${p.d} by ${p.h} centimetres. Tap, then tap the ground to put it there.`);
    b.setAttribute('aria-pressed', String(engine.armed?.kind === p.kind));
    return b;
  };

  const getModel = async (m: FreeModel, then?: (id: string) => void) => {
    if (getting) return;
    if (onMobileData() && !kept.has(m.id)) {
      free.waited++;
      free.last = 'waited';
      freeNote = waitWords(m);
      said(freeNote);
      paintLibrary();
      return;
    }
    getting = m.id;
    freeNote = kept.has(m.id) ? `${m.name} is already on this phone.` : `On Wi-Fi: getting ${m.name} (${bytesWords(m.kb)})…`;
    paintLibrary();
    try {
      if (!kept.has(m.id)) free.fetches++;
      const glb = await modelFile(m, (pct) => {
        if (pct !== null) {
          freeNote = `On Wi-Fi: getting ${m.name} (${bytesWords(m.kb)}) ${pct}%`;
          paintLibrary();
        }
      });
      kept.add(m.id);
      const got = await eview.attachModel(m.id, glb);
      if (!got) throw new Error('its shapes could not be read');
      free.last = 'got';
      const ref = { id: m.id, title: m.name, credit: m.credit, licence: m.licence, kb: m.kb };
      if (then) then(m.id);
      else {
        const [sw, sh, sd] = got.size;
        // a model stands at its own size, in cm, at the middle, unless it is the size of a room
        const k = Math.max(sw, sh, sd) > 6 ? 6 / Math.max(sw, sh, sd) : 1;
        engine.arm({ kind: 'model', label: m.name, over: { name: m.name, w: Math.round(sw * k * 100), d: Math.round(sd * k * 100), h: Math.round(sh * k * 100), mat: 'white', model: ref } });
      }
      freeNote = `${m.name} is on this phone (${bytesWords(m.kb)}). Tap the ground to put it there. ${m.credit}`;
      said(freeNote);
    } catch (e) {
      free.last = 'failed';
      freeNote = sayError(e, `get ${m.name}`);
      said(freeNote);
    } finally {
      getting = '';
      paintLibrary();
      paintThings();
    }
  };

  const freeRow = (m: FreeModel) => {
    const have = kept.has(m.id);
    const get = button(have ? 'ON THIS PHONE' : getWords(m), () => void getModel(m), 'e3get');
    get.dataset.id = m.id;
    get.dataset.case = 'keep';
    get.disabled = !!getting && getting !== m.id;
    get.setAttribute('aria-label', have ? `${m.name} is on this phone: tap to put it in the scene` : `Get ${m.name}, ${bytesWords(m.kb)}, on Wi-Fi`);
    const out = have ? button('REMOVE', () => void forgetFile(m.id).then(async () => ((kept = new Set(await keptIds())), paintLibrary())), 'e3get ghost') : null;
    if (out) {
      out.dataset.case = 'keep';
      out.setAttribute('aria-label', `Remove ${m.name} from this phone`);
    }
    return h('div.e3free', { role: 'listitem', dataset: { id: m.id } }, h('div.e3freetx', h('b', m.name), h('small', `${m.licence} · by ${m.author} · ${bytesWords(m.kb)}`)), h('div.e3freeacts', get, out));
  };

  async function refreshFree() {
    const rows = await freeShelf(freeQuery);
    kept = new Set(await keptIds());
    freeRows = rows;
    freeLoaded = true;
    free.listed = rows.length;
    paintLibrary();
  }

  function paintLibrary() {
    const pills = h('div.e3pills', { role: 'group', 'aria-label': 'Library shelves' });
    for (const [id, label] of [['param', 'PARAMETRIC'], ['free', 'FREE MODELS']] as const) {
      const b = button(label, () => {
        shelf = id;
        if (id === 'free' && !freeLoaded) void refreshFree();
        paintLibrary();
      }, `e3pill${shelf === id ? ' on' : ''}`);
      b.dataset.shelf = id;
      b.dataset.case = 'keep';
      b.setAttribute('aria-pressed', String(shelf === id));
      pills.append(b);
    }
    if (shelf === 'param') {
      clear(library, h('h3.e3h', 'LIBRARY'), pills, h('p.e3note', 'Tap one, then tap the ground. Each is built from its width, depth and height.'), h('div.e3cards', ...PRIMITIVES.map(card), ...PARAMETRIC.map(card), ...WORKING.map(card)));
      return;
    }
    const q = h('input.e3q', { type: 'search', placeholder: 'chair, sofa, lamp…', value: freeQuery, 'aria-label': 'Search the free models', enterKeyHint: 'search' });
    q.addEventListener('input', () => {
      freeQuery = q.value;
      void refreshFree().then(() => document.querySelector<HTMLInputElement>('.e3q')?.focus());
    });
    clear(library,
      h('h3.e3h', 'LIBRARY'),
      pills,
      h('p.e3note', 'Free models from Objaverse (Sketchfab), CC0 or CC BY 4.0, each listed with its licence, its author and its download size. Nothing is downloaded until you tap GET, and only on Wi-Fi. The credit travels with the model into your saved scene and your file.'),
      q,
      freeNote ? h('p.e3note.e3free-note', { role: 'status' }, freeNote) : null,
      h('div.e3frees', { role: 'list', 'aria-label': 'Free models' }, ...(freeLoaded ? freeRows.map(freeRow) : [h('p.e3note', 'Reading the list…')]), freeLoaded && !freeRows.length ? h('p.e3note', 'No free model matches that, or the list could not be read (offline?).') : null),
    );
  }

  // ---- what is in the scene, as keys (a thing under another can always be picked here)
  function paintThings() {
    const sc = engine.scene;
    clear(things, ...sc.objects.map((o) => {
      const b = button(o.name, () => engine.select(engine.selected === o.id ? '' : o.id), `e3thing${o.id === engine.selected ? ' on' : ''}`);
      b.dataset.id = o.id;
      b.dataset.case = 'keep';
      b.setAttribute('aria-pressed', String(o.id === engine.selected));
      b.setAttribute('aria-label', `${o.name}, ${sizeWords(o)}${o.kind === 'model' && !(o.model && eview.hasModel(o.model.id)) ? ', its file is not on this phone' : ''}`);
      return b;
    }));
    things.hidden = !sc.objects.length;
  }

  // ---- the inspector: typed numbers, materials, the selected thing's own words
  const fields: Partial<Record<(typeof NUM_FIELDS)[number]['key'], HTMLInputElement>> = {};
  let nameIn: HTMLInputElement | null = null;
  let builtFor = '';
  const swatches = new Map<string, HTMLButtonElement>();
  const modelLine = h('p.e3note.e3model');

  function buildInspector(o: Obj) {
    builtFor = o.id;
    for (const k of Object.keys(fields)) delete fields[k as keyof typeof fields];
    swatches.clear();
    nameIn = h('input.e3name', { type: 'text', value: o.name, maxLength: 40, 'aria-label': 'Name of the selected thing', enterKeyHint: 'done' });
    nameIn.addEventListener('change', () => nameIn && engine.set(o.id, { name: nameIn.value }));
    const grid = h('div.e3fields', ...NUM_FIELDS.map((f) => {
      const input = h('input.e3num', { type: 'number', inputMode: 'decimal', step: f.key === 'rot' ? '5' : '1', ...(f.min !== undefined ? { min: String(f.min) } : {}), value: String(o[f.key]), 'aria-label': `${f.label} in ${f.unit === '°' ? 'degrees' : 'centimetres'}`, enterKeyHint: 'done' });
      input.dataset.key = f.key;
      input.addEventListener('change', () => {
        const v = Number(input.value);
        if (Number.isFinite(v) && input.value.trim() !== '') engine.set(o.id, { [f.key]: v });
        else sync();
      });
      fields[f.key] = input;
      return h('label.e3field', h('span', f.label), input, h('small', f.unit));
    }));
    const mats = h('div.e3mats', { role: 'group', 'aria-label': 'Material' }, ...MATERIALS.map((m) => {
      const b = button(h('i.e3sw', { style: `--sw: #${m.hex.toString(16).padStart(6, '0')}` }), () => engine.set(o.id, { mat: m.id }), 'e3swatch');
      b.dataset.mat = m.id;
      b.dataset.case = 'keep';
      b.setAttribute('aria-label', m.name);
      b.title = m.name;
      swatches.set(m.id, b);
      return b;
    }));
    const dup = button('DUPLICATE', () => void engine.duplicateSelected(), 'e3act');
    const del = button('DELETE', () => {
      const gone = engine.removeSelected();
      if (gone) offerUndo(`${gone.name} deleted`, () => void engine.undo());
    }, 'e3act');
    const done = button('DONE', () => engine.select(''), 'e3act');
    for (const b of [dup, del, done]) b.dataset.case = 'keep';
    clear(inspector, h('h3.e3h', 'THE SELECTED THING'), nameIn, grid, h('p.e3note', { class: 'e3matname' }), mats, modelLine, h('div.e3acts', dup, del, done));
  }

  function sync() {
    const o = engine.obj;
    if (!o) {
      builtFor = '';
      inspector.hidden = true;
      clear(inspector);
      return;
    }
    inspector.hidden = false;
    if (builtFor !== o.id) buildInspector(o);
    for (const f of NUM_FIELDS) {
      const input = fields[f.key];
      if (input && document.activeElement !== input) input.value = String(o[f.key]);
    }
    if (nameIn && document.activeElement !== nameIn) nameIn.value = o.name;
    for (const [id, b] of swatches) {
      b.classList.toggle('on', id === o.mat);
      b.setAttribute('aria-pressed', String(id === o.mat));
    }
    const mn = inspector.querySelector<HTMLElement>('.e3matname');
    if (mn) mn.textContent = `${MATERIALS.find((m) => m.id === o.mat)?.name ?? ''} · ${sizeWords(o)}`;
    if (o.model) {
      const has = eview.hasModel(o.model.id);
      clear(modelLine, has ? `${o.model.credit}. Exported as its shapes and base colours, not its pictures.` : `${o.model.title}: its file is not on this phone. `);
      if (!has) {
        const b = button(`GET ${bytesWords(o.model.kb)}`, () => void fetchFor(o), 'e3get');
        b.dataset.case = 'keep';
        modelLine.append(b);
      }
    } else clear(modelLine);
  }

  async function fetchFor(o: Obj) {
    const m = o.model && (await loadFree()).find((i) => i.id === o.model!.id);
    if (!m || !o.model) return;
    const fm = (await freeShelf(m.name)).find((x) => x.id === m.id);
    if (fm) await getModel(fm, () => engine.onChange());
  }

  // ---- the scene: its name, SAVE, OPEN, NEW, EXPORT
  let exported: (Exported & { name: string; unloaded: number }) | null = null;
  let exportText = '';
  const nameField = h('input.e3name', { type: 'text', maxLength: 40, 'aria-label': 'Name of the scene', enterKeyHint: 'done' });
  nameField.addEventListener('change', () => engine.commit({ ...engine.scene, name: nameField.value.trim().slice(0, 40) || 'Untitled scene' }));

  function doExport() {
    const models = Object.fromEntries(engine.scene.objects.flatMap((o) => (o.model && eview.models.get(o.model.id) ? [[o.id, eview.models.get(o.model.id)!] as const] : [])));
    const x = exportGltf(engine.scene, models);
    const unloaded = engine.scene.objects.filter((o) => o.kind === 'model' && !models[o.id]).length;
    exportText = x.text;
    exported = { ...x, name: engine.scene.name, unloaded };
    const file = `${engine.scene.name.replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'scene'}.gltf`;
    try {
      const a = h('a', { href: URL.createObjectURL(new Blob([x.text], { type: 'model/gltf+json' })), download: file, style: 'display:none' });
      document.body.append(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 4000);
    } catch {
      /* no downloads here: the text is still held for the spec and the console */
    }
    const credits = creditsOf(engine.scene).length;
    said(`${file}: ${x.nodes} nodes, ${x.triangles.toLocaleString('en-GB')} triangles, ${x.materials.length} materials, ${Math.max(1, Math.round(x.bytes / 1000))} kB.${unloaded ? ` ${unloaded} model${unloaded === 1 ? '' : 's'} not on this phone, written as boxes.` : ''}${credits ? ` ${credits} credit${credits === 1 ? '' : 's'} in the file.` : ''}`);
    paintScene();
  }

  function paintScene() {
    const rows = savedScenes().map((e) => {
      const open = button(h('span.e3rowin', h('b', e.name), h('small', `${e.scene.objects.length} thing${e.scene.objects.length === 1 ? '' : 's'} · ${e.scene.ground.w / 100} × ${e.scene.ground.d / 100} m`)), () => {
        engine.load(e.scene);
        void loadKeptModels();
        said(`${e.name} is open.`);
      }, 'e3open');
      open.dataset.id = e.id;
      open.dataset.case = 'keep';
      open.setAttribute('aria-label', `Open ${e.name}`);
      const del = button('DELETE', () => {
        const gone = forgetScene(e.id);
        paintScene();
        if (gone) offerUndo(`${gone.name} deleted`, () => (restoreScene(gone), paintScene()));
      }, 'e3act');
      del.dataset.case = 'keep';
      del.setAttribute('aria-label', `Delete the saved scene ${e.name}`);
      return h('div.e3saved', { role: 'listitem', dataset: { id: e.id } }, open, del);
    });
    const save = button('SAVE', () => {
      const e = saveAs(nameField.value || engine.scene.name, engine.scene);
      nameField.value = e.name;
      engine.commit({ ...engine.scene, name: e.name });
      said(`${e.name} is saved on this phone.`);
      paintScene();
    }, 'e3act on');
    const exp = button('EXPORT glTF', doExport, 'e3act');
    const fresh = button('NEW', () => {
      const was = engine.scene;
      engine.load(newScene());
      offerUndo('Scene cleared', () => engine.load(was));
    }, 'e3act');
    for (const b of [save, exp, fresh]) b.dataset.case = 'keep';
    /* state: studio.engine empty */
    clear(sceneBox, h('h3.e3h', 'THE SCENE'), nameField, h('div.e3acts', save, exp, fresh), rows.length ? h('div.e3savedlist', { role: 'list', 'aria-label': 'Saved scenes' }, ...rows) : h('p.e3note', 'Nothing saved yet. SAVE keeps this scene on this phone.'));
    if (document.activeElement !== nameField) nameField.value = engine.scene.name;
  }

  // ---- the stage's marks follow the engine
  const paintStage = () => {
    const n = engine.scene.objects.length;
    title.textContent = `${n} ${n === 1 ? 'THING' : 'THINGS'} · ${engine.scene.name.toUpperCase()}`;
    undoKey.disabled = !engine.undoList.length;
    redoKey.disabled = !engine.redoList.length;
    tools.hidden = !engine.obj;
    for (const b of toolKeys) {
      const on = b.dataset.tool === engine.tool;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    // (put in the row only while it can be used: a hidden attribute loses to the keys' own display rule)
    if (drops.on && engine.obj) {
      if (!dropKey.isConnected) tools.append(dropKey);
    } else dropKey.remove();
    physKey.textContent = drops.loading ? 'PHYSICS: LOADING…' : drops.on ? 'PHYSICS: ON' : 'PHYSICS: OFF';
    physKey.setAttribute('aria-pressed', String(drops.on));
    physKey.disabled = drops.loading;
    physKey.setAttribute('aria-label', drops.on ? 'Physics is on. Tap to turn it off.' : 'Physics is off. Tap to turn it on: things you drop then fall and land.');
    hint.hidden = !engine.armed;
    hintText.textContent = engine.armed ? `Tap the ground to put the ${engine.armed.label.toLowerCase()} there` : '';
    for (const b of el.querySelectorAll<HTMLElement>('.e3card')) b.setAttribute('aria-pressed', String(b.dataset.kind === engine.armed?.kind));
    for (const b of things.querySelectorAll<HTMLElement>('.e3thing')) {
      b.classList.toggle('on', b.dataset.id === engine.selected);
      b.setAttribute('aria-pressed', String(b.dataset.id === engine.selected));
    }
  };
  let lastScene: Scene | null = null;
  engine.onChange = () => {
    if (lastScene !== engine.scene) {
      lastScene = engine.scene;
      paintThings();
      if (document.activeElement !== nameField) nameField.value = engine.scene.name;
    }
    paintStage();
    sync();
    eview.sync();
    eview.request();
  };
  engine.onSceneChange = (s) => setCurrent(s);

  // ---- the touch on the stage's canvas (its own pointer events; the page does not scroll under a finger here)
  const at = (e: PointerEvent): [number, number] => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  stage.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      /* a synthetic touch cannot be captured: the events still arrive */
    }
    const [x, y] = at(e);
    engine.pointerDown(e.pointerId, x, y);
  });
  stage.addEventListener('pointermove', (e) => {
    const [x, y] = at(e);
    engine.pointerMove(e.pointerId, x, y);
  });
  stage.addEventListener('pointerup', (e) => {
    const [x, y] = at(e);
    engine.pointerUp(e.pointerId, x, y);
  });
  stage.addEventListener('pointercancel', (e) => engine.pointerCancel(e.pointerId));
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    engine.wheel(e.deltaY);
  }, { passive: false });

  async function loadKeptModels() {
    kept = new Set(await keptIds());
    for (const o of engine.scene.objects) {
      if (o.kind !== 'model' || !o.model || eview.hasModel(o.model.id)) continue;
      const m = { id: o.model.id } as FreeModel;
      try {
        const glb = await keptFile(m.id);
        if (glb) await eview.attachModel(m.id, glb);
      } catch {
        /* the model stays a ghost box until his tap */
      }
    }
    engine.onChange();
  }

  // ---- what a test (and the console) reads and drives
  const api = {
    engine,
    state: () => ({
      on: !stage.hidden,
      ...eview.state(),
      scene: engine.scene,
      name: engine.scene.name,
      objects: engine.scene.objects,
      selected: engine.selected,
      tool: engine.tool,
      armed: engine.armed?.label ?? '',
      cam: { ...engine.cam },
      size: { ...engine.size },
      undo: engine.undoList.length,
      redo: engine.redoList.length,
      saved: savedScenes().map((e) => ({ id: e.id, name: e.name, things: e.scene.objects.length })),
      estimateLines: el.querySelectorAll('.e3est').length,
      shelf,
      free: { ...free, rows: freeRows.map((r) => ({ id: r.id, name: r.name, kb: r.kb, licence: r.licence, author: r.author })), note: freeNote, kept: [...kept] },
      exported: exported ? { name: exported.name, bytes: exported.bytes, nodes: exported.nodes, meshes: exported.meshes, materials: exported.materials, triangles: exported.triangles, unloaded: exported.unloaded } : null,
      last: engine.last,
      handles: engine.handles().map((hd) => ({ kind: hd.kind, at: screenOf(hd.at) })),
      physics: drops.state(),
    }),
    place: (kind: string, x: number, z: number, over?: Partial<Obj>) => engine.place(kind as Product['kind'], x, z, over),
    select: (id: string) => engine.select(id),
    set: (id: string, p: Partial<Obj>) => engine.set(id, p),
    tool: (t: Tool) => engine.setTool(t),
    arm: (kind: string) => {
      const p = [...PRIMITIVES, ...PARAMETRIC, ...WORKING].find((x) => x.kind === kind);
      engine.arm(p ? { kind: p.kind, label: p.name } : null);
    },
    load: (s: unknown) => {
      const sc = readScene(s);
      if (sc) engine.load(sc);
      return !!sc;
    },
    undo: () => engine.undo(),
    redo: () => engine.redo(),
    save: (name: string) => {
      nameField.value = name;
      return saveAs(name, engine.scene).id;
    },
    open: (id: string) => {
      const e = savedScenes().find((x) => x.id === id);
      if (e) engine.load(e.scene);
      return !!e;
    },
    forget: (id: string) => !!forgetScene(id),
    exportNow: () => {
      doExport();
      return exportText;
    },
    exportText: () => exportText,
    free: { open: () => void refreshFree(), get: (id: string) => freeRows.find((r) => r.id === id) && getModel(freeRows.find((r) => r.id === id)!), reset: () => Object.assign(free, { fetches: 0, waited: 0, last: '' }) },
    /** Where a point of the scene (cm from the ground's middle, cm up) is on the stage, in page pixels; null behind the eye. */
    screenOf: (x: number, y: number, z: number) => screenOf([x / 100, y / 100, z / 100]),
    ground: () => ({ w: engine.scene.ground.w, d: engine.scene.ground.d }),
    /** PHYSICS (physics.ts): on loads the package (the first time only), drop lets a thing fall, bench times frames with the world in them. */
    physics: {
      on: async () => {
        const ok = await drops.turnOn();
        engine.onChange();
        return ok;
      },
      off: () => drops.turnOff(),
      drop: (id: string) => drops.drop(id),
      bench: (n = 60) => eview.bench(n),
      state: () => drops.state(),
    },
    handleScreen: (kind: string) => api.state().handles.find((x) => x.kind === kind)?.at ?? null,
  };

  function screenOf(p: [number, number, number]): { x: number; y: number } | null {
    const r = stage.getBoundingClientRect();
    const q = project(engine.cam, p, engine.size.w, engine.size.h);
    return q ? { x: Math.round(r.left + q.x), y: Math.round(r.top + q.y) } : null;
  }

  const expose = () => {
    const g = window as unknown as { __ghosty?: Record<string, unknown> };
    (g.__ghosty ??= {}).engine3d = api;
  };
  expose();

  paintLibrary();
  paintScene();
  paintThings();
  paintStage();
  sync();

  let on = false;
  return {
    el,
    engine,
    view: eview,
    async enter() {
      on = true;
      expose();
      stage.hidden = false;
      const ok = await eview.init();
      if (!on) return;
      if (!ok) {
        said(eview.error || 'This phone cannot draw 3-D just now.');
        toast(eview.error || 'This phone cannot draw 3-D just now.', 'warn');
        return;
      }
      eview.start();
      await loadKeptModels();
    },
    leave() {
      on = false;
      drops.leave();
      stage.hidden = true;
      eview.stop();
    },
    loadScene(s) {
      engine.load(s);
      void loadKeptModels();
    },
    context() {
      if (!on) return null;
      const o = engine.obj;
      const n = engine.scene.objects.length;
      return {
        screen: 'studio',
        title: '3-D engine',
        line: `the 3-D engine, scene “${engine.scene.name}”, ${n} thing${n === 1 ? '' : 's'}${o ? `, ${o.name} selected` : ''}`.slice(0, 160),
        ...(o ? { selected: { kind: 'object', id: o.id, label: `the ${o.name.toLowerCase()}`, detail: `${sizeWords(o)}` } } : {}),
        at: Date.now(),
      };
    },
  };
}
