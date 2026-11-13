/**
 * THE VIDEO EDITOR'S SCREEN (BRIEF-EDITOR-VIDEO; MAKE → VIDEO, "my videos", "edit a video"): the strip of clips across the top, the
 * picture under it at the project's shape with PLAY and a scrub bar, the tools as pills (TRIM, SPLIT, SPEED, ORDER, TRANSITION,
 * TITLE, GRADE, SOUND, SUBTITLES, OVERLAY, MOVE, CROP, SCENES, QUIET, EXPORT, PROJECT), each opening its controls in a tray. The
 * clips are kept untouched in the phone's own database; the project saves 200 ms after a change; undo is sixty deep. Every wait
 * and every refusal is said in a sentence. Nothing of a clip leaves the phone except the sound of one he asks to subtitle.
 */
import { clear, h } from '../core/dom';
import { sayError } from '../ui/hisWords';
import { button, toast } from '../ui/components';
import { sizeWords } from '../convert/bytes';
import { encodeWav } from '../convert/audio';
import {
  ASPECTS, clipLen, clock, duration, flatGrade, History, lengthWords, moveClip, newProject, place, removeClip, setSpeed, setTransition, shape, splitAt, trimClip, uid, transitionCap,
  type Aspect, type Clip, type Overlay, type Project, type Source, type TransitionKind,
} from './model';
import { addAudio, addMain, addPip, addTitle, copyGrade, cutRanges, splitMany } from './edit';
import { Feeder, Player, CODEC_LINE, probe } from './preview';
import { parseCube, LutError } from './lut';
import { cuesFromWords, pieces, toSrt, toVtt } from './subs';
import { findCuts, histogram } from './scenes';
import { findPauses, rmsSeries, timeSaved, type Pause } from './quiet';
import { AUDIO_BITRATE, PRESETS, QUALITIES, aboutSize, choosePath, estimateBytes, recorderBytes, exportVideo, pathWords, videoBitrate, Cancelled, type Exported, type PathInfo } from './export';
import { decodeAudio, renderMix } from './mix';
import { Reader } from './reader';
import { MAX_BYTES, autosaver, binProject, bytesOfProject, importZip, listProjects, loadProject, posterBlob, projectZip, putSource, removeProject, room, saveProject, sourceBlob, type Kept } from './store';
import { choices, name, slider, stepper } from './ui';
import { Crunch } from './crunch';
import { STEADY_MAX_MS, costWords, restrength, steadyClip, steadyGuess } from './steady';
import { unsteady, rekey } from './steadymath';
import { choose, leftReason, reason, type Pick_ } from './bestmath';
import { cutFromTicks, nameWords, scoreClips, unitLen, type Scored, type Tick } from './best';
import { findBeats, movedWords, onTimeline, snapToBeats, type Beats } from './beat';
import { tempoWords } from './beatmath';
import { EYES_NAMER, eyesHere, eyesKept } from '../offline/eyes';
import { transformAt } from './math';
import { buildSpec, planFrame } from './compose';
import { ui } from '../state/app';
import { noteVideos } from './tally';
import { handTo, isVideoFile, takeHanded } from './files';
export { isVideoFile, takeHanded };

export const VIDEO_TITLE = 'VIDEO';
type Tool = 'trim' | 'split' | 'speed' | 'order' | 'transition' | 'title' | 'grade' | 'sound' | 'subtitles' | 'overlay' | 'move' | 'crop' | 'scenes' | 'quiet' | 'export' | 'project';
const TOOLS: [Tool, string][] = [
  ['trim', 'TRIM'], ['split', 'SPLIT'], ['speed', 'SPEED'], ['order', 'ORDER'], ['transition', 'TRANSITION'], ['title', 'TITLE'], ['grade', 'GRADE'], ['sound', 'SOUND'],
  ['subtitles', 'SUBTITLES'], ['overlay', 'OVERLAY'], ['move', 'MOVE'], ['crop', 'CROP'], ['scenes', 'SCENES'], ['quiet', 'QUIET'], ['export', 'EXPORT'], ['project', 'PROJECT'],
];

/** What the specs read (window.__ghosty.video). */
export const videoState = {
  open: false,
  tool: 'trim' as Tool,
  clips: 0,
  length: 0,
  lengthSaid: '',
  line: '',
  savedSaid: 0,
  selected: '',
  exportPath: '',
  exportSaid: '',
  exportSize: '',
  exportDone: null as null | { bytes: number; frames: number; audioPackets: number; path: string; seconds: number; ext: string; w: number; h: number; durationMs: number; fellBack?: string },
  cues: 0,
  history: 0,
  offlineSaid: false,
  wasHeld: false,
  proxyAfter: 120_000,
  cuts: [] as number[],
  pauses: [] as Pause[],
  /** VIDEO 2: what each pass measured, for the specs and the report. */
  steady: null as null | { ms: number; clipMs: number; perSecond: number; loses: number; window: number; frames: number; said: string; readMs: number; workMs: number; lagMs: number },
  steadyWhy: '',
  best: null as null | { ms: number; clips: number; perClip: number; picks: { clip: string; from: number; to: number; reason: string; on: boolean }[]; left: { clip: string; reason: string }[]; line: string; namer: boolean; total: number },
  beat: null as null | { bpm: number; ms: number; musicMs: number; perMinute: number; said: string; moved: number; biggest: number; line: string },
  rough: false,
};

const reduced = (): boolean => !!matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const lsGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* it works without */
  }
};

type Nodes = (Node | null | false)[];
type Ask = { files?: File[]; open?: string };

/** The screen's page: `start` opens what was asked (files handed over, a project); `stop` ends a recording and the player. */
export function videoParts(): { el: HTMLElement; start(o: Ask): Promise<void>; stop(): void } {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  let project: Project = newProject();
  let hist = new History(project);
  let sel = '';
  let selOv = '';
  let tool: Tool = 'trim';
  let pps = 60;
  let kept: Kept[] = [];
  let hold = false;
  let pickingColour = false;
  let exporting: { cancelled: boolean } | null = null;
  let recording: { stop(): void } | null = null;
  let stopped = false;
  const stopFns: (() => void)[] = [];
  const posters = new Map<string, string>();
  let savedOnce = false;

  const feeder = new Feeder();
  // VIDEO 2: the one worker for the steadying, the scores and the beat (made when first asked), and what each has found
  const crunch = new Crunch();
  let steadying: { cancelled: boolean } | null = null;
  let beats: (Beats & { src: string }) | null = null;
  let scored: Scored | null = null;
  let bestTarget = 30;
  let bestPick: { picks: (Pick_ & { on: boolean; word: string | null })[]; left: { unit: Pick_['unit']; why: string }[]; short: number } | null = null;
  let bestBusy: { cancelled: boolean } | null = null;
  const canvas = h('canvas.vdcanvas', { 'aria-label': 'The picture at this moment', role: 'img' }) as HTMLCanvasElement;
  let player: Player | null = null;
  // (the picture's engine is made when there is a clip to draw: an empty editor opens at once, and its shaders are not compiled for nothing)
  const ensurePlayer = () => (player ??= makePlayer());
  const makePlayer = (): Player | null => {
    try {
      const p = new Player(canvas, feeder, project, { audio: true, still: reduced(), onTick: onTick, onEnd: () => renderTransport(), onLost: () => say('The picture’s engine was reset by the phone; I’m starting it again.'), onRough: () => { videoState.rough = true; say('A reversed clip plays roughly here, because the phone cannot play backwards: it seeks to each picture. The file I make is exact.'); } });
      p.blobOf = (id) => blobFor(id, true);
      return p;
    } catch {
      say('This phone can’t draw video pictures here (no WebGL2), so I can’t edit on it.');
      return null;
    }
  };

  // ---------------------------------------------------------------- the elements
  const line = h('p.vdline', { 'aria-live': 'polite' });
  const lineAct = h('span.vdlineact');
  const saved = h('span.vdsaved', { 'aria-live': 'polite' });
  const undoB = name(button('UNDO', () => undo(), 'vdundo'), 'Undo');
  const redoB = name(button('REDO', () => redo(), 'vdredo'), 'Redo');
  const nameIn = h('input.vdname', { type: 'text', 'aria-label': 'Name of this video', maxLength: 60 }) as HTMLInputElement;
  nameIn.addEventListener('change', () => {
    project = { ...project, name: nameIn.value.trim() || 'My video' };
    hist.now = project;
    autosave.change(project);
  });
  const titleLine = h('div.vdtitleline', { hidden: true });
  const stage = h('div.vdstage', canvas);
  const stageWrap = h('div.vdstagewrap', stage);
  const playB = name(button('PLAY', () => togglePlay(), 'vdplay'), 'Play');
  const timeEl = h('output.vdtime');
  const scrub = h('input.vdscrub', { type: 'range', min: '0', max: '0', step: '10', value: '0', 'aria-label': 'Scrub through the video' }) as HTMLInputElement;
  const strip = h('div.vdstrip', { tabIndex: 0, 'aria-label': 'The clips, left to right' });
  const track = h('div.vdtrack');
  const lanes = h('div.vdlanes');
  const head = h('div.vdhead');
  strip.append(track, lanes, head);
  const zoomRow = h('div.vdzoom', name(button('–', () => zoom(0.7), 'vdz'), 'Zoom the time out'), h('span', 'time'), name(button('+', () => zoom(1.4), 'vdz'), 'Zoom the time in'));
  const addIn = h('input', { type: 'file', hidden: true, multiple: true, accept: 'video/*,.mov,.mp4,.m4v,.webm', 'aria-label': 'Choose video clips to add' }) as HTMLInputElement;
  const addB = name(button('ADD A CLIP', () => addIn.click(), 'vdadd on'), 'Add a clip from your phone');
  const pills = h('div.vdpills', { role: 'tablist', 'aria-label': 'Tools' });
  const tray = h('div.vdtray', { role: 'tabpanel' });
  const empty = h('div.vdempty');
  const root = h('div.vd', { dataset: { tool: 'trim' } }, h('div.vdbar', nameIn, undoB, redoB, saved), h('div.vdlinerow', line, lineAct), titleLine, stageWrap, h('div.vdtransport', playB, timeEl, scrub), h('div.vdstripbar', addB, zoomRow), strip, empty, pills, tray, addIn);

  // ---------------------------------------------------------------- saying
  const say = (words: string, act?: HTMLElement | null) => {
    line.textContent = words;
    videoState.line = words;
    clear(lineAct, act);
  };
  const autosave = autosaver(() => {
    void refreshKept().then(() => noteVideos(kept.filter((k) => !k.gone).length, project.name, lengthWords(duration(project))));
    if (savedOnce) return;
    savedOnce = true;
    videoState.savedSaid++;
    saved.textContent = 'Saved';
    saved.classList.add('show');
    setTimeout(() => saved.classList.remove('show'), 2400);
  });
  const sel_ = (): Clip | undefined => project.main.find((c) => c.id === sel);
  const selClip = (): Clip | undefined => sel_() ?? undefined;
  const selOverlay = (): Overlay | undefined => project.overlays.find((o) => o.id === selOv);
  const blobFor = async (id: string, preview = false): Promise<Blob | null> => {
    const s = project.sources[id];
    if (preview && s?.proxy) {
      const px = await sourceBlob(project.id, `${id}.proxy`);
      if (px) return px;
    }
    return sourceBlob(project.id, id);
  };

  // ---------------------------------------------------------------- the project and its history
  const refreshState = () => {
    const d = duration(project);
    videoState.clips = project.main.length;
    videoState.length = d;
    videoState.lengthSaid = lengthWords(d);
    videoState.selected = sel;
    videoState.cues = project.subs.length;
    videoState.history = hist.depth;
    videoState.tool = tool;
  };
  const commit = (next: Project | null, words?: string) => {
    if (!next) return;
    project = { ...next, at: Date.now() };
    hist.push(project);
    after();
    if (words) say(words);
  };
  const after = () => {
    player?.setProject(project);
    player?.resize(640);
    autosave.change(project);
    renderAll();
    if (player) void player.seek(Math.min(player.t, duration(project))).catch(() => undefined);
  };
  const undo = () => {
    const p = hist.undo();
    if (!p) return;
    project = p;
    sel = project.main.some((c) => c.id === sel) ? sel : '';
    after();
    say('Undone.');
  };
  const redo = () => {
    const p = hist.redo();
    if (!p) return;
    project = p;
    after();
    say('Done again.');
  };
  /** A change shown as it is dragged (not in the history); `commit` it when let go. */
  const live = (fn: (p: Project) => void) => {
    const q = structuredClone(project);
    fn(q);
    player?.setProject(q);
    if (player) void player.seek(player.t);
    return q;
  };
  const setPlayhead = () => {
    if (!player) return;
    project.playhead = Math.round(player.t);
    autosave.change(project);
  };

  // ---------------------------------------------------------------- the player's tick and the transport
  const onTick = (t: number) => {
    timeEl.textContent = `${clock(t, true)} / ${clock(duration(project), true)}`;
    scrub.value = String(Math.round(t));
    movePlayhead(t);
  };
  function renderTransport() {
    const d = duration(project);
    scrub.max = String(d);
    scrub.disabled = d <= 0;
    playB.disabled = d <= 0;
    const playing = !!player?.playing;
    playB.textContent = playing ? 'PAUSE' : 'PLAY';
    playB.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    const t = player?.t ?? 0;
    timeEl.textContent = `${clock(t, true)} / ${clock(d, true)}`;
    scrub.value = String(Math.round(t));
    movePlayhead(t);
    // where he left the playhead is kept with the project (it reopens there)
    if (player && !playing && Math.abs(project.playhead - t) > 40 && d > 0) setPlayhead();
  }
  const togglePlay = () => {
    if (!player || duration(project) <= 0) return;
    if (player.playing) {
      player.pause();
      setPlayhead();
    } else player.play();
    renderTransport();
  };
  scrub.addEventListener('input', () => {
    player?.pause();
    void player?.seek(Number(scrub.value)).then(() => {
      renderTransport();
      setPlayhead();
    });
  });
  const movePlayhead = (t: number) => {
    head.style.transform = `translateX(${(t / 1000) * pps}px)`;
    if (player?.playing && !reduced()) {
      const x = (t / 1000) * pps;
      if (x < strip.scrollLeft + 16 || x > strip.scrollLeft + strip.clientWidth - 40) strip.scrollLeft = Math.max(0, x - strip.clientWidth / 3);
    }
  };
  const zoom = (k: number) => {
    pps = Math.max(12, Math.min(240, pps * k));
    renderStrip();
  };
  // a pinch on the strip zooms time
  const touches = new Map<number, number>();
  let pinch0 = 0;
  let pps0 = 0;
  strip.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, e.clientX);
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch0 = Math.abs(a! - b!);
      pps0 = pps;
    }
  });
  strip.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, e.clientX);
    if (touches.size === 2 && pinch0 > 8) {
      const [a, b] = [...touches.values()];
      pps = Math.max(12, Math.min(240, (pps0 * Math.abs(a! - b!)) / pinch0));
      renderStrip();
    }
  });
  for (const ev of ['pointerup', 'pointercancel'] as const) strip.addEventListener(ev, (e) => touches.delete(e.pointerId));

  // ---------------------------------------------------------------- the strip
  async function posterUrl(src: string): Promise<string> {
    const k = `${project.id}/${src}`;
    const got = posters.get(k);
    if (got) return got;
    const b = await posterBlob(project.id, src);
    if (!b) return '';
    const u = URL.createObjectURL(b);
    posters.set(k, u);
    return u;
  }
  const at = (e: PointerEvent | MouseEvent): number => ((e.clientX - track.getBoundingClientRect().left) / pps) * 1000;
  function renderStrip() {
    const pl = place(project.main);
    const d = duration(project);
    const width = Math.max(strip.clientWidth, (d / 1000) * pps + 64);
    track.style.width = `${width}px`;
    lanes.style.width = `${width}px`;
    head.style.height = '100%';
    clear(track);
    pl.forEach((x) => {
      const tile = h('div.vdtile', {
        role: 'button', tabIndex: 0,
        'aria-label': `Clip ${x.index + 1}, ${lengthWords(x.len)}${x.clip.speed !== 1 ? `, at ${x.clip.speed}×` : ''}${x.clip.id === sel ? ', selected' : ''}`,
        dataset: { id: x.clip.id, index: String(x.index) },
        style: { left: `${(x.start / 1000) * pps}px`, width: `${Math.max(56, (x.len / 1000) * pps)}px` },
      });
      if (x.clip.id === sel) tile.classList.add('on');
      void posterUrl(x.clip.src).then((u) => u && (tile.style.backgroundImage = `url(${u})`));
      tile.append(h('b', `${x.index + 1}`), h('small', lengthWords(x.len)));
      if (x.tin) tile.append(h('i.vdtr', { 'aria-hidden': 'true', title: x.tin.kind }, { crossfade: '⨯', dip: '◐', wipe: '▶', slide: '⇥', cut: '' }[x.tin.kind] ?? ''));
      tile.addEventListener('click', (e) => {
        if (dragged) return;
        sel = x.clip.id;
        const t = Math.max(x.start, Math.min(x.start + x.len - 1, at(e)));
        player?.pause();
        void player?.seek(t).then(() => {
          renderTransport();
          setPlayhead();
        });
        renderStrip();
        renderTray();
      });
      tile.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tile.click()));
      if (x.clip.id === sel && tool === 'trim') addHandles(tile, x.clip);
      if (tool === 'order') addDrag(tile, x.index);
      track.append(tile);
    });
    // the other tracks, as thin bars under the clips
    clear(lanes);
    const lane = (label: string, items: { start: number; len: number; text: string }[], cls: string) => {
      if (!items.length) return;
      const l = h(`div.vdlane.${cls}`, { 'aria-label': `${label}: ${items.length}` });
      for (const it of items) l.append(h('span.vdbar_', { style: { left: `${(it.start / 1000) * pps}px`, width: `${Math.max(16, (it.len / 1000) * pps)}px` } }, it.text));
      lanes.append(l);
    };
    lane('Titles', project.overlays.filter((o) => o.title).map((o) => ({ start: o.start, len: o.len, text: o.title!.text })), 'ti');
    lane('Pictures in pictures', project.overlays.filter((o) => o.clip).map((o) => ({ start: o.start, len: o.len, text: 'picture' })), 'pi');
    lane('Music', project.music.map((a) => ({ start: a.start, len: a.len, text: project.sources[a.src]?.name ?? 'music' })), 'mu');
    lane('Voice', project.voice.map((a) => ({ start: a.start, len: a.len, text: 'voice' })), 'vo');
    lane('Subtitles', project.subs.map((c) => ({ start: c.start, len: c.end - c.start, text: c.text })), 'su');
    movePlayhead(player?.t ?? 0);
  }

  let dragged = false;
  /** Handles on the ends of the selected clip, 44 pt wide: drag to trim (the in and out said as they move). */
  function addHandles(tile: HTMLElement, c: Clip) {
    for (const side of ['in', 'out'] as const) {
      const hd = h(`div.vdhandle.${side}`, { role: 'slider', tabIndex: 0, 'aria-label': side === 'in' ? 'Trim the start of the clip' : 'Trim the end of the clip', 'aria-valuetext': clock(side === 'in' ? c.in : c.out, true) });
      let x0 = 0;
      let in0 = c.in;
      let out0 = c.out;
      let draft: Project | null = null;
      hd.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        hd.setPointerCapture(e.pointerId);
        x0 = e.clientX;
        in0 = c.in;
        out0 = c.out;
        dragged = true;
        player?.pause();
      });
      hd.addEventListener('pointermove', (e) => {
        if (!hd.hasPointerCapture(e.pointerId)) return;
        const dMs = ((e.clientX - x0) / pps) * 1000 * c.speed;
        draft = trimClip(project, c.id, side === 'in' ? in0 + dMs : in0, side === 'out' ? out0 + dMs : out0);
        if (draft) {
          const nc = draft.main.find((z) => z.id === c.id)!;
          tile.style.width = `${Math.max(56, (clipLen(nc) / 1000) * pps)}px`;
          say(`In ${clock(nc.in, true)}, out ${clock(nc.out, true)}: ${lengthWords(clipLen(nc))} on the timeline.`);
        }
      });
      const end = (e: PointerEvent) => {
        if (!hd.hasPointerCapture(e.pointerId)) return;
        hd.releasePointerCapture(e.pointerId);
        setTimeout(() => (dragged = false), 0);
        if (draft) commit(draft, `Trimmed: ${lengthWords(clipLen(draft.main.find((z) => z.id === c.id)!))} on the timeline.`);
        draft = null;
      };
      hd.addEventListener('pointerup', end);
      hd.addEventListener('pointercancel', end);
      hd.addEventListener('keydown', (e) => {
        const k = e.key === 'ArrowLeft' ? -100 : e.key === 'ArrowRight' ? 100 : 0;
        if (k) commit(trimClip(project, c.id, side === 'in' ? c.in + k : c.in, side === 'out' ? c.out + k : c.out));
      });
      tile.append(hd);
    }
  }

  /** ORDER by a press and a drag: the tile follows the finger, the strip scrolls near its edge, and it lands where it is let go. */
  function addDrag(tile: HTMLElement, index: number) {
    let x0 = 0;
    let left0 = 0;
    let scroll = 0;
    let go = false;
    tile.style.touchAction = 'none';
    tile.addEventListener('pointerdown', (e) => {
      tile.setPointerCapture(e.pointerId);
      x0 = e.clientX;
      left0 = parseFloat(tile.style.left);
      go = true;
      dragged = false;
    });
    tile.addEventListener('pointermove', (e) => {
      if (!go) return;
      if (Math.abs(e.clientX - x0) > 6) dragged = true;
      if (!dragged) return;
      tile.style.left = `${left0 + e.clientX - x0}px`;
      tile.classList.add('lift');
      const r = strip.getBoundingClientRect();
      clearInterval(scroll);
      if (e.clientX < r.left + 40 || e.clientX > r.right - 40) scroll = window.setInterval(() => (strip.scrollLeft += e.clientX < r.left + 40 ? -14 : 14), 30);
    });
    const end = (e: PointerEvent) => {
      if (!go) return;
      go = false;
      clearInterval(scroll);
      const moved = dragged;
      setTimeout(() => (dragged = false), 0);
      if (!moved) return;
      const pl = place(project.main);
      const centre = ((parseFloat(tile.style.left) + tile.offsetWidth / 2) / pps) * 1000;
      const to = pl.filter((x) => x.index !== index && x.start + x.len / 2 < centre).length;
      void e;
      const next = moveClip(project, index, to);
      if (next) commit(next, `Moved clip ${index + 1} to place ${to + 1}.`);
      else renderStrip();
    };
    tile.addEventListener('pointerup', end);
    tile.addEventListener('pointercancel', end);
  }

  // ---------------------------------------------------------------- the pills and what is under them
  const pillEls = new Map<Tool, HTMLButtonElement>();
  for (const [id, label] of TOOLS) {
    const b = button(label, () => pick(id), 'vdpill');
    b.setAttribute('role', 'tab');
    b.dataset.tool = id;
    pillEls.set(id, b);
    pills.append(b);
  }
  function pick(t: Tool) {
    tool = t;
    root.dataset.tool = t;
    for (const [id, b] of pillEls) {
      b.classList.toggle('on', id === t);
      b.setAttribute('aria-selected', String(id === t));
    }
    titleLine.hidden = t !== 'title';
    renderStrip();
    renderTray();
    refreshState();
  }
  const need = (words = 'Tap a clip in the strip first, and I’ll work on that one.'): HTMLElement => h('p.vdnote', words);
  const row = (...kids: (Node | null | false)[]) => h('div.vdrow', ...kids);
  const note = (t: string) => h('p.vdnote', t);
  const act = (label: string, fn: (b: HTMLButtonElement) => void, cls = '') => button(label, fn, `vdkey${cls ? ` ${cls}` : ''}`);
  const fileKey = (label: string, accept: string, onFiles: (f: File[]) => void, extra = ''): HTMLElement => {
    const inp = h('input', { type: 'file', hidden: true, accept, 'aria-label': label, dataset: { pick: extra } }) as HTMLInputElement;
    inp.addEventListener('change', () => {
      const f = [...(inp.files ?? [])];
      inp.value = '';
      if (f.length) onFiles(f);
    });
    return h('span.vdfile', act(label, () => inp.click()), inp);
  };

  function renderAll() {
    renderStrip();
    renderTray();
    renderTransport();
    renderEmpty();
    undoB.disabled = !hist.canUndo;
    redoB.disabled = !hist.canRedo;
    root.dataset.empty = String(!project.main.length);
    if (document.activeElement !== nameIn) nameIn.value = project.name;
    refreshState();
  }
  function renderEmpty() {
    clear(empty);
    if (project.main.length) return;
    empty.append(
      h('p.vdempty1', 'No video yet. Add a clip from your phone and I’ll start one.'),
      h('p.vdnote', 'Your clips stay on this phone, untouched: everything I do is a recipe laid over them, so you can always go back.'),
    );
    if (kept.filter((k) => !k.gone && k.id !== project.id).length) empty.append(act('MY VIDEOS', () => pick('project')));
  }

  // ---------------------------------------------------------------- the trays
  function renderTray() {
    clear(tray);
    tray.dataset.tool = tool;
    const c = selClip();
    const fn: Record<Tool, () => Nodes> = {
      trim: () => (c ? trimTray(c) : [need()]),
      split: splitTray,
      speed: () => (c ? speedTray(c) : [need()]),
      order: () => (c ? orderTray(c) : [need('Tap a clip, then MOVE it, or press and drag it along the strip.')]),
      transition: () => (c ? transitionTray(c) : [need('Tap the clip that comes first; the transition goes between it and the next.')]),
      title: titleTray,
      grade: () => (c ? gradeTray(c) : [need()]),
      sound: soundTray,
      subtitles: subtitlesTray,
      overlay: overlayTray,
      move: () => (c ? moveTray(c) : [need()]),
      crop: cropTray,
      scenes: scenesTray,
      quiet: quietTray,
      export: exportTray,
      project: projectTray,
    };
    tray.append(...(fn[tool]().filter(Boolean) as Node[]));
  }

  function trimTray(c: Clip): Nodes {
    const s = project.sources[c.src];
    return [
      h('p.vdsay', `In ${clock(c.in, true)} · out ${clock(c.out, true)} · ${lengthWords(clipLen(c))} on the timeline`),
      note('Drag the handles on the ends of the clip in the strip, or step them here.'),
      stepper('Start', () => clock(selClip()?.in ?? 0, true), () => commit(trimClip(project, c.id, (selClip()?.in ?? 0) - 500, selClip()!.out)), () => commit(trimClip(project, c.id, (selClip()?.in ?? 0) + 500, selClip()!.out))),
      stepper('End', () => clock(selClip()?.out ?? 0, true), () => commit(trimClip(project, c.id, selClip()!.in, (selClip()?.out ?? 0) - 500)), () => commit(trimClip(project, c.id, selClip()!.in, (selClip()?.out ?? 0) + 500))),
      s ? note(`The whole clip is ${lengthWords(s.dur)}; the part you cut away is not gone, only hidden.`) : null,
    ];
  }

  function splitTray(): Nodes {
    const t = player?.t ?? 0;
    return [
      h('p.vdsay', `The playhead is at ${clock(t, true)}.`),
      act('SPLIT AT THE PLAYHEAD', () => {
        // (where the playhead is now, not where it was when this tray was drawn)
        const at = player?.t ?? t;
        const n = splitAt(project, at);
        if (!n) return say('I can’t split there: it’s too near the edge of a clip, or in a transition.');
        commit(n, `Split at ${clock(at, true)}: now ${n.main.length} clips.`);
      }, 'on'),
      note('Move the playhead with the scrub bar, then split. The two halves can be sped, graded and moved on their own.'),
    ];
  }

  function speedTray(c: Clip): Nodes {
    const words = (v: number) => `${v}× makes this clip ${lengthWords((c.out - c.in) / v)} (it is ${lengthWords(clipLen(c))})`;
    return [
      h('p.vdsay', words(c.speed)),
      choices('Speed', [0.25, 0.5, 1, 1.5, 2, 3, 4].map((v) => ({ id: v, label: `${v}×` })), c.speed, (v) => commit(setSpeed(project, c.id, v), `${words(v)}.`)),
      slider({ label: 'Speed', min: 0.25, max: 4, step: 0.05, value: c.speed, say: (v) => `${v.toFixed(2)}×`, change: (v) => commit(setSpeed(project, c.id, v)), reset: 1 }),
      note('One speed for the whole clip, from a quarter to four times. Its sound speeds up or slows with it.'),
      h('h4.vdh', 'STEADY'),
      ...steadyNodes(c),
      h('h4.vdh', 'REVERSE AND RAMP'),
      ...reverseRampNodes(c),
    ];
  }

  // ---------------------------------------------------------------- STEADY, REVERSE and RAMP (VIDEO 2)
  const replaceClip = (id: string, next: Clip): Project => {
    const q = structuredClone(project);
    const i = q.main.findIndex((x) => x.id === id);
    if (i >= 0) q.main[i] = next;
    return fixTransitions(q);
  };
  /** A transition is never longer than half of either clip it joins (a ramp or a steadying changes a clip's length). */
  const fixTransitions = (q: Project): Project => {
    for (let i = 0; i < q.main.length; i++) {
      const c = q.main[i]!;
      c.next.len = Math.min(c.next.len, transitionCap(c, q.main[i + 1]));
      if (c.next.kind !== 'cut' && c.next.len < 100) c.next = { kind: 'cut', len: 0 };
    }
    if (q.main.length) q.main[q.main.length - 1]!.next = { kind: 'cut', len: 0 };
    return q;
  };
  const failed = (e: unknown, again: () => void, what: string) => {
    const dead = crunch.dead;
    say(dead ? `${dead} Nothing was changed.` : sayError(e, what), act('RETRY', () => (crunch.revive(), again()), 'vdinline'));
  };
  function steadyNodes(c: Clip): Nodes {
    const out: Nodes = [];
    const span = c.out - c.in;
    const guess = steadyGuess(span, project.fps);
    if (steadying) {
      out.push(act('STOP STEADYING', () => steadying && (steadying.cancelled = true), 'vdstop'));
      return out;
    }
    out.push(h('p.vdsay.vdsteadysay', c.steady ? `Steadied: ${costWords(c, c.steady.strength)} (the camera’s path averaged over ${c.steady.window ? (c.steady.window / c.steady.fps).toFixed(1) : '1.3'} s).` : `Takes about ${guess} s for this clip, on the phone.`));
    out.push(act('STEADY', () => void runSteady(c.id, c.steady?.strength ?? 0.5), c.steady ? 'vdsteady' : 'on vdsteady'));
    if (c.steady) {
      const r = c.steady;
      out.push(slider({
        label: 'Steadier', min: 0.1, max: 1, step: 0.05, value: r.strength, reset: 0.5,
        say: (v) => costWords(c, v),
        input: (v) => live((q) => { const z = q.main.find((m) => m.id === c.id); if (z?.steady) { z.steady.strength = v; rekey(z); } }),
        change: (v) => commit(replaceClip(c.id, restrength(c, v)), `Steadier: ${costWords(c, v)}.`),
      }));
      out.push(row(
        act('STEADY AGAIN', () => void runSteady(c.id, r.strength)),
        act('TAKE THE STEADYING OFF', () => commit(editClip(c.id, (z) => unsteady(z)), 'The steadying is off: the clip is as it was.')),
      ));
    }
    out.push(note('I measure how the camera moved between neighbouring frames, smooth that path, and lay the difference on the clip as keys. A slow pan stays; the shake goes, and the edges are cropped to hide the picture’s moving border. All on the phone.'));
    return out;
  }
  async function runSteady(id: string, strength: number) {
    const c = project.main.find((x) => x.id === id);
    if (!c || steadying) return;
    player?.pause();
    const run = { cancelled: false };
    steadying = run;
    renderTray();
    const clipMs = c.out - c.in;
    if (clipMs > STEADY_MAX_MS) {
      steadying = null;
      renderTray();
      return say(`That clip is ${lengthWords(clipMs)} long. I steady up to ${lengthWords(STEADY_MAX_MS)} at a time: trim it or split it, and steady each part.`);
    }
    say(`Steadying… about ${steadyGuess(clipMs, project.fps)} s`);
    const again = () => void runSteady(id, strength);
    try {
      const r = await steadyClip(project, c, strength, await blobFor(c.src, false), feeder, crunch, {
        cancel: run,
        onProgress: (done, of, left) => say(`Steadying… ${done} of ${of} frames, about ${Math.max(1, Math.round(left))} s left`),
      });
      if (!r.ok) {
        videoState.steadyWhy = r.why;
        if (!r.cancelled && crunch.dead) failed(new Error(r.why), again, 'steady it');
        else say(r.why);
      } else {
        const said = `Steadier: loses ${r.loses}% at the edges. Steadied in ${Math.max(1, Math.round(r.ms / 1000))} s; undo takes it off.`;
        videoState.steady = { ms: r.ms, clipMs: r.clipMs, perSecond: r.ms / 1000 / Math.max(0.1, r.clipMs / 1000), loses: r.loses, window: r.window, frames: r.frames, said, readMs: r.readMs, workMs: r.workMs, lagMs: r.lagMs };
        videoState.steadyWhy = '';
        steadying = null;
        commit(replaceClip(id, r.clip), said);
      }
    } catch (e) {
      failed(e, again, 'steady it');
    } finally {
      steadying = null;
      renderTray();
    }
  }
  function reverseRampNodes(c: Clip): Nodes {
    const span = c.out - c.in;
    const ramp = (c.tr.keys.speed ?? []) as { t: number; v: number }[];
    const before = lengthWords(clipLen(c));
    const out: Nodes = [];
    out.push(row(
      act('REVERSE', () => {
        const next = editClip(c.id, (z) => { z.reverse = !z.reverse; if (z.steady) rekey(z); });
        commit(fixTransitions(next), c.reverse ? 'This clip plays forwards again.' : 'This clip plays backwards. The preview seeks backwards and will be rough until you export; the file is exact.');
      }, c.reverse ? 'vdchoice on' : 'vdchoice'),
      act('RAMP', () => {
        if (ramp.length) return say(`The ramp makes this clip ${lengthWords(clipLen(c))}: change its two ends below.`);
        const next = editClip(c.id, (z) => { z.tr.keys.speed = [{ t: 0, v: 1 }, { t: span, v: 2 }]; if (z.steady) rekey(z); });
        const z = next.main.find((m) => m.id === c.id)!;
        commit(fixTransitions(next), `A ramp from 1× to 2×: this clip is ${lengthWords(clipLen(z))} (it was ${before}).`);
      }, ramp.length ? 'vdchoice on' : 'vdchoice'),
    ));
    if (c.reverse) out.push(h('p.vdsay', 'Playing backwards: the picture’s end first.'));
    if (ramp.length) {
      const set = (i: 0 | 1, v: number, say_ = true) => commit(fixTransitions(editClip(c.id, (z) => { const k = z.tr.keys.speed!; k[i === 0 ? 0 : k.length - 1]!.v = v; if (z.steady) rekey(z); })), say_ ? `The ramp makes this clip ${lengthWords(clipLen(editClip(c.id, (z) => { const k = z.tr.keys.speed!; k[i === 0 ? 0 : k.length - 1]!.v = v; }).main.find((m) => m.id === c.id)!))} (it is ${before}).` : undefined);
      out.push(h('p.vdsay.vdrampsay', `The ramp makes this clip ${before}: ${ramp[0]!.v.toFixed(2)}× at the start, ${ramp[ramp.length - 1]!.v.toFixed(2)}× at the end.`));
      out.push(slider({ label: 'Ramp starts at', min: 0.25, max: 4, step: 0.05, value: ramp[0]!.v, say: (v) => `${v.toFixed(2)}×`, change: (v) => set(0, v), reset: 1 }));
      out.push(slider({ label: 'Ramp ends at', min: 0.25, max: 4, step: 0.05, value: ramp[ramp.length - 1]!.v, say: (v) => `${v.toFixed(2)}×`, change: (v) => set(1, v), reset: 2 }));
      out.push(choices('The sound in a ramp', [{ id: 'pitch', label: 'SOUND PITCHED' }, { id: 'drop', label: 'SOUND DROPPED' }], c.rampSound ?? 'pitch', (v) => commit(editClip(c.id, (z) => (z.rampSound = v)), v === 'drop' ? 'The ramped clip plays without its sound.' : 'The sound rises and falls in pitch with the speed.')));
      out.push(act('TAKE THE RAMP OFF', () => commit(fixTransitions(editClip(c.id, (z) => { delete z.tr.keys.speed; delete z.rampSound; if (z.steady) rekey(z); })), 'The ramp is off: one speed again.')));
    }
    out.push(note('REVERSE plays the clip backwards. RAMP changes the speed along the clip: the length it makes is said above, and the sound follows it or is dropped.'));
    return out;
  }

  function orderTray(c: Clip): Nodes {
    const i = project.main.findIndex((x) => x.id === c.id);
    return [
      h('p.vdsay', `Clip ${i + 1} of ${project.main.length}`),
      row(
        act('MOVE LEFT', () => commit(moveClip(project, i, i - 1), `Moved to place ${i}.`)),
        act('MOVE RIGHT', () => commit(moveClip(project, i, i + 1), `Moved to place ${i + 2}.`)),
        act('DELETE CLIP', () => {
          const was = project;
          commit(removeClip(project, c.id), 'The clip is out.');
          sel = '';
          say('The clip is out of the video; the original is still on your phone.', act('UNDO', () => (project = was, hist.undo(), after(), say('Put back.')), 'vdinline'));
        }),
      ),
      note('Or press a clip in the strip and drag it along; the strip scrolls when you reach its edge.'),
    ];
  }

  function transitionTray(c: Clip): Nodes {
    const i = project.main.findIndex((x) => x.id === c.id);
    const next = project.main[i + 1];
    if (!next) return [need('This is the last clip. A transition goes between a clip and the one after it.')];
    const cap = transitionCap(c, next);
    const kinds: { id: TransitionKind; label: string }[] = [{ id: 'cut', label: 'CUT' }, { id: 'crossfade', label: 'CROSSFADE' }, { id: 'dip', label: 'DIP TO BLACK' }, { id: 'wipe', label: 'WIPE' }, { id: 'slide', label: 'SLIDE' }];
    return [
      h('p.vdsay', c.next.kind === 'cut' ? `A plain cut into clip ${i + 2}.` : `A ${kinds.find((k) => k.id === c.next.kind)!.label.toLowerCase()}, ${(c.next.len / 1000).toFixed(1)} s, into clip ${i + 2}.`),
      choices('Transition', kinds, c.next.kind, (k) => commit(setTransition(project, i, k, c.next.len || Math.min(1000, cap)), k === 'cut' ? 'A plain cut.' : `A ${k} into clip ${i + 2}: the two clips overlap by it.`)),
      c.next.kind !== 'cut' ? stepper('Length', () => `${((selClip()?.next.len ?? 0) / 1000).toFixed(1)} s`, () => commit(setTransition(project, i, selClip()!.next.kind, (selClip()?.next.len ?? 0) - 100)), () => commit(setTransition(project, i, selClip()!.next.kind, (selClip()?.next.len ?? 0) + 100))) : null,
      note(cap < 200 ? 'These clips are too short for a transition.' : `Up to ${(cap / 1000).toFixed(1)} s: no more than half of the shorter clip.`),
    ];
  }

  function titleTray(): Nodes {
    const titles = project.overlays.filter((o) => o.title);
    const cur = titles.find((o) => o.id === selOv) ?? titles[0];
    if (cur) selOv = cur.id;
    // the line above the picture: where the words are typed (never a caret on the picture)
    clear(titleLine);
    const inp = h('input.vdtitlein', { type: 'text', value: cur?.title?.text ?? '', placeholder: 'Type the title here', 'aria-label': 'The title’s words', disabled: !cur }) as HTMLInputElement;
    inp.addEventListener('input', () => {
      if (!cur) return;
      live((q) => (q.overlays.find((o) => o.id === cur.id)!.title!.text = inp.value));
    });
    inp.addEventListener('change', () => cur && commit(editOv(cur.id, (o) => (o.title!.text = inp.value)), 'Title changed.'));
    titleLine.append(h('label.vdlabel', 'TITLE'), inp);
    const out: Nodes = [
      act('ADD A TITLE AT THE PLAYHEAD', () => {
        const t = Math.round(player?.t ?? 0);
        const r = addTitle(project, t, Math.min(3000, Math.max(1000, duration(project) - t || 3000)));
        selOv = r.id;
        commit(r.p, `A title from ${clock(t, true)}: type its words in the line above the picture.`);
        setTimeout(() => (titleLine.querySelector('input') as HTMLInputElement | null)?.focus(), 30);
      }, 'on'),
    ];
    for (const o of titles) {
      const t = o.title!;
      out.push(h('div.vdcard', { dataset: { id: o.id }, class: `vdcard${o.id === selOv ? ' on' : ''}` },
        act(`“${t.text.slice(0, 24) || '…'}” · ${clock(o.start, true)}`, () => (selOv = o.id, renderTray()), 'vdlist'),
        o.id === selOv ? h('div.vdcardbody',
          choices('Position', [{ id: 'top', label: 'TOP' }, { id: 'middle', label: 'MIDDLE' }, { id: 'bottom', label: 'BOTTOM' }], t.pos, (v) => commit(editOv(o.id, (z) => (z.title!.pos = v)))),
          choices('Appear', [{ id: 'none', label: 'NO FADE-IN' }, { id: 'fade', label: 'FADE IN' }, { id: 'rise', label: 'RISE IN' }], t.appear, (v) => commit(editOv(o.id, (z) => (z.title!.appear = v)))),
          choices('Leave', [{ id: 'none', label: 'NO FADE-OUT' }, { id: 'fade', label: 'FADE OUT' }, { id: 'rise', label: 'RISE OUT' }], t.leave, (v) => commit(editOv(o.id, (z) => (z.title!.leave = v)))),
          stepper('Starts', () => clock(project.overlays.find((z) => z.id === o.id)?.start ?? 0, true), () => commit(editOv(o.id, (z) => (z.start = Math.max(0, z.start - 250)))), () => commit(editOv(o.id, (z) => (z.start += 250)))),
          stepper('Lasts', () => lengthWords(project.overlays.find((z) => z.id === o.id)?.len ?? 0), () => commit(editOv(o.id, (z) => (z.len = Math.max(500, z.len - 250)))), () => commit(editOv(o.id, (z) => (z.len += 250)))),
          act('DELETE THE TITLE', () => (selOv = '', commit({ ...project, overlays: project.overlays.filter((z) => z.id !== o.id) }, 'The title is out.'))),
        ) : null));
    }
    if (!titles.length) out.push(note('A title is words over the picture for a few seconds, in the app’s own type.'));
    return out;
  }
  const editOv = (id: string, fn: (o: Overlay) => void): Project => {
    const q = structuredClone(project);
    const o = q.overlays.find((x) => x.id === id);
    if (o) fn(o);
    return q;
  };
  const editClip = (id: string, fn: (c: Clip) => void): Project => {
    const q = structuredClone(project);
    const c = q.main.find((x) => x.id === id) ?? q.overlays.find((o) => o.clip?.id === id)?.clip;
    if (c) fn(c);
    return q;
  };

  const GRADES: { k: 'exposure' | 'contrast' | 'highlights' | 'shadows' | 'whites' | 'blacks' | 'temp' | 'tint' | 'vibrance' | 'saturation'; label: string; min: number; max: number; step: number; say(v: number): string }[] = [
    { k: 'exposure', label: 'Exposure', min: -3, max: 3, step: 0.05, say: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} stops` },
    { k: 'contrast', label: 'Contrast', min: -1, max: 1, step: 0.02, say: (v) => `${Math.round(v * 100)}` },
    { k: 'highlights', label: 'Highlights', min: -1, max: 1, step: 0.02, say: (v) => `${Math.round(v * 100)}` },
    { k: 'shadows', label: 'Shadows', min: -1, max: 1, step: 0.02, say: (v) => `${Math.round(v * 100)}` },
    { k: 'whites', label: 'Whites', min: -1, max: 1, step: 0.02, say: (v) => `${Math.round(v * 100)}` },
    { k: 'blacks', label: 'Blacks', min: -1, max: 1, step: 0.02, say: (v) => `${Math.round(v * 100)}` },
    { k: 'temp', label: 'Warmth', min: -1, max: 1, step: 0.02, say: (v) => (v === 0 ? 'neutral' : v > 0 ? `warmer ${Math.round(v * 100)}` : `cooler ${Math.round(-v * 100)}`) },
    { k: 'tint', label: 'Tint', min: -1, max: 1, step: 0.02, say: (v) => `${Math.round(v * 100)}` },
    { k: 'vibrance', label: 'Vibrance', min: -1, max: 1, step: 0.02, say: (v) => `${Math.round(v * 100)}` },
    { k: 'saturation', label: 'Colour', min: -1, max: 1, step: 0.02, say: (v) => `${Math.round(v * 100)}` },
  ];
  function gradeTray(c: Clip): Nodes {
    const out: Nodes = [];
    const holdKey = act('HOLD TO SEE THE ORIGINAL', () => undefined, 'vdhold');
    const set = (on: boolean) => {
      hold = on;
      if (player) {
        player.ungraded = on;
        player.draw();
      }
      if (on) videoState.wasHeld = true;
    };
    holdKey.addEventListener('pointerdown', (e) => (holdKey.setPointerCapture(e.pointerId), set(true)));
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) holdKey.addEventListener(ev, () => hold && set(false));
    holdKey.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && set(true));
    holdKey.addEventListener('keyup', () => set(false));
    out.push(row(holdKey, act('COPY THE GRADE TO EVERY CLIP', () => commit(copyGrade(project, c.id), `This clip’s grade${c.lut ? ' and its LUT' : ''} is on all ${project.main.length} clips.`)), act('RESET THE GRADE', () => commit(editClip(c.id, (z) => ((z.grade = flatGrade()), delete z.lut)), 'The grade is back to flat.'))));
    for (const g of GRADES) out.push(slider({ label: g.label, min: g.min, max: g.max, step: g.step, value: c.grade[g.k], say: g.say, input: (v) => live((q) => (q.main.find((z) => z.id === c.id)!.grade[g.k] = v)), change: (v) => commit(editClip(c.id, (z) => (z.grade[g.k] = v))), reset: 0 }));
    const mid = c.grade.curve.length === 3 ? c.grade.curve[1]![1] - 0.5 : 0;
    const curve = (v: number): [number, number][] => (Math.abs(v) < 0.005 ? [[0, 0], [1, 1]] : [[0, 0], [0.5, 0.5 + v], [1, 1]]);
    out.push(slider({ label: 'Midtones curve', min: -0.3, max: 0.3, step: 0.01, value: mid, say: (v) => (v === 0 ? 'straight' : v > 0 ? `lifted ${Math.round(v * 100)}` : `pulled ${Math.round(-v * 100)}`), input: (v) => live((q) => (q.main.find((z) => z.id === c.id)!.grade.curve = curve(v))), change: (v) => commit(editClip(c.id, (z) => (z.grade.curve = curve(v)))), reset: 0 }));
    out.push(row(
      fileKey(c.lut ? 'CHANGE THE LUT' : 'ADD A LUT (.cube)', '.cube,text/plain', async (f) => {
        try {
          const l = parseCube(await f[0]!.text());
          const id = uid();
          const q = structuredClone(project);
          q.luts[id] = { name: l.title || f[0]!.name, size: l.size, data: [...l.data] };
          q.main.find((z) => z.id === c.id)!.lut = id;
          commit(q, `LUT “${q.luts[id]!.name}” on this clip: ${l.size} points a side.`);
        } catch (e) {
          say(e instanceof LutError ? sayError(e, 'read that file as a LUT') : 'I couldn’t read that file as a LUT.');
        }
      }, 'lut'),
      c.lut ? act('TAKE THE LUT OFF', () => commit(editClip(c.id, (z) => delete z.lut), 'The LUT is off.')) : null,
    ));
    out.push(note(c.lut ? `LUT: ${project.luts[c.lut]?.name ?? ''}. Hold the key to compare with the original.` : 'A LUT is a colour look from a .cube file (17 or 33 points a side is what colourists’ tools write).'));
    return out;
  }
  // holding the picture shows the original too (said once)
  canvas.addEventListener('pointerdown', () => {
    if (pickingColour) return;
    if (!player || tool !== 'grade') return;
    player.ungraded = true;
    player.draw();
    videoState.wasHeld = true;
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const)
    canvas.addEventListener(ev, () => {
      if (player?.ungraded && !hold) {
        player.ungraded = false;
        player.draw();
      }
    });

  // ---------------------------------------------------------------- sound
  const audioCtx = () => new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  /** A music file or a recording as a source: decoded here (a file the phone cannot read is said), kept, and placed at the playhead. */
  async function addSoundFile(kind: 'music' | 'voice', file: Blob, label: string) {
    const ac = audioCtx();
    const buf = await decodeAudio(ac, file);
    void ac.close();
    if (!buf) return say(kind === 'music' ? 'Your phone can’t read that music file. An MP3, an M4A or a WAV usually works.' : 'Your phone can’t read that recording.');
    const r = room(kept.filter((k) => !k.gone), file.size, MAX_BYTES, project.id);
    if (!r.fits) return say(r.words);
    const id = uid();
    await putSource(project.id, id, file, null);
    const src: Source = { id, name: label, kind: 'audio', size: file.size, dur: Math.round(buf.duration * 1000), w: 0, h: 0, fps: 0, hasAudio: true };
    player?.buffers.set(id, buf);
    const t = Math.round(player?.t ?? 0);
    const res = addAudio(project, kind, src, t);
    commit(res.p, kind === 'music' ? `Music “${label}” from ${clock(t, true)}, ${lengthWords(res.p.music.at(-1)!.len)}. It fades in and out; SOUND has its level.` : `Voice-over added at ${clock(t, true)}, ${lengthWords(src.dur)}. UNDO takes it back.`);
    if (kind === 'voice') say(`Voice-over added at ${clock(t, true)}, ${lengthWords(src.dur)}.`, act('UNDO', () => undo(), 'vdinline'));
  }

  function soundTray(): Nodes {
    const c = selClip();
    const out: Nodes = [];
    if (c) out.push(slider({ label: 'This clip’s own sound', min: 0, max: 2, step: 0.05, value: c.volume, say: (v) => (v === 0 ? 'off' : `${Math.round(v * 100)}%`), input: (v) => live((q) => (q.main.find((z) => z.id === c.id)!.volume = v)), change: (v) => commit(editClip(c.id, (z) => (z.volume = v))), reset: 1 }));
    else out.push(note('Tap a clip to set its own sound; music and a voice-over work without one.'));
    out.push(h('h4.vdh', 'MUSIC'));
    out.push(fileKey('ADD MUSIC', 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac', (f) => void addSoundFile('music', f[0]!, f[0]!.name.replace(/\.[^.]+$/, '')), 'music'));
    for (const a of project.music) {
      out.push(h('div.vdcard', { dataset: { id: a.id } },
        h('b', project.sources[a.src]?.name ?? 'Music'),
        slider({ label: 'Music level', min: 0, max: 1.5, step: 0.05, value: a.gain, say: (v) => `${Math.round(v * 100)}%`, change: (v) => commit({ ...structuredClone(project), music: project.music.map((z) => (z.id === a.id ? { ...z, gain: v } : z)) }), reset: 0.7 }),
        slider({ label: 'Fade in', min: 0, max: 5000, step: 100, value: a.fadeIn, say: (v) => `${(v / 1000).toFixed(1)} s`, change: (v) => commit({ ...structuredClone(project), music: project.music.map((z) => (z.id === a.id ? { ...z, fadeIn: v } : z)) }), reset: 500 }),
        slider({ label: 'Fade out', min: 0, max: 5000, step: 100, value: a.fadeOut, say: (v) => `${(v / 1000).toFixed(1)} s`, change: (v) => commit({ ...structuredClone(project), music: project.music.map((z) => (z.id === a.id ? { ...z, fadeOut: v } : z)) }), reset: 800 }),
        act('TAKE THE MUSIC OUT', () => commit({ ...structuredClone(project), music: project.music.filter((z) => z.id !== a.id) }, 'The music is out.')),
      ));
    }
    out.push(h('h4.vdh', 'ON THE BEAT'));
    out.push(h('p.vdsay.vdbeatsay', videoState.beat?.line ?? (project.music.length ? 'I can find the music’s beat and cut to it.' : 'I need music on the timeline to find its beat: add some above.')));
    out.push(row(act('ON THE BEAT', () => void runBeat(), 'on vdbeat'), act('SNAP TO THE BEAT', () => void runSnap(), 'vdsnap')));
    out.push(note('I find the beat in the music on the phone, and SNAP TO THE BEAT moves each cut to its nearest beat if one is within 0.4 s. UNDO puts them back.'));
    out.push(h('h4.vdh', 'YOUR VOICE'));
    const level = h('div.vdlevel', { 'aria-hidden': 'true' }, h('i'));
    const recKey = act(recording ? 'STOP' : 'RECORD A VOICE-OVER', () => void record(recKey, level), recording ? 'vdrec on' : 'vdrec');
    out.push(row(recKey, project.voice.length ? act('UNDO THE RECORDING', () => undo()) : null), level);
    out.push(row(fileKey('A RECORDING FROM A FILE', 'audio/*,.wav,.m4a,.mp3', (f) => void addSoundFile('voice', f[0]!, 'Voice-over'), 'voice')));
    for (const a of project.voice) out.push(h('div.vdcard', { dataset: { id: a.id } }, h('b', `Voice at ${clock(a.start, true)}, ${lengthWords(a.len)}`), act('TAKE IT OUT', () => commit({ ...structuredClone(project), voice: project.voice.filter((z) => z.id !== a.id) }, 'The voice is out.'))));
    out.push(slider({ label: 'Music drops under your voice by', min: 0, max: 24, step: 1, value: project.duck, say: (v) => (v === 0 ? 'not at all' : `${v} dB`), change: (v) => commit({ ...structuredClone(project), duck: v }, v ? `The music drops ${v} dB under your voice, and comes back after.` : 'The music keeps its level under your voice.'), reset: 12 }));
    out.push(note('Use headphones to record over the music; the picture plays silently while you speak.'));
    return out;
  }

  // ---------------------------------------------------------------- ON THE BEAT (VIDEO 2)
  async function ensureBeats(): Promise<(Beats & { src: string }) | null> {
    const m = project.music[0];
    if (!m) return null;
    if (beats && beats.src === m.src) return beats;
    await player?.loadSound();
    const buf = player?.buffers.get(m.src);
    if (!buf) throw new Error('that music would not open');
    say(`Listening for the beat… about ${Math.max(1, Math.round(buf.duration * 0.05))} s`);
    const b = await findBeats(buf, crunch);
    if (!b) return null;
    beats = { ...b, src: m.src };
    const line = `The music is at ${tempoWords(b.tempo.bpm)}, found in ${(b.ms / 1000).toFixed(1)} s.`;
    videoState.beat = { bpm: b.tempo.bpm, ms: b.ms, musicMs: b.musicMs, perMinute: b.ms / 1000 / Math.max(1 / 60, b.musicMs / 60_000), said: line, moved: 0, biggest: 0, line };
    return beats;
  }
  async function runBeat() {
    if (!project.music.length) {
      const l = 'I need music on the timeline to find its beat: add some with ADD MUSIC above.';
      videoState.beat = { ...(videoState.beat ?? { bpm: 0, ms: 0, musicMs: 0, perMinute: 0, said: '', moved: 0, biggest: 0 }), line: l };
      say(l);
      return renderTray();
    }
    try {
      const b = await ensureBeats();
      if (!b) {
        const l = 'I couldn’t find a steady beat in this music, so I’ve left the cuts where they are.';
        videoState.beat = { ...(videoState.beat ?? { bpm: 0, ms: 0, musicMs: 0, perMinute: 0, said: '', moved: 0, biggest: 0 }), line: l };
        say(l);
      } else say(`${videoState.beat!.line} SNAP TO THE BEAT moves each cut onto one.`);
      renderTray();
    } catch (e) {
      failed(e, () => void runBeat(), 'find the beat');
    }
  }
  async function runSnap() {
    if (!project.music.length) return void runBeat();
    try {
      const b = await ensureBeats();
      if (!b) return void runBeat();
      if (project.main.length < 2) return say('There are no cuts to move: add a second clip first.');
      const r = snapToBeats(project, onTimeline(b, project.music[0]!));
      if (!r.moved.length) {
        const l = `Every cut is already on a beat, or more than 0.4 s from the nearest one${r.stuck ? `; ${r.stuck} could not move for want of picture to move into` : ''}.`;
        videoState.beat = { ...videoState.beat!, moved: 0, biggest: 0, line: l };
        say(l);
        return renderTray();
      }
      const l = `${movedWords(r.moved.length, r.biggest)}${r.stuck ? `; ${r.stuck} more had no picture to move into` : ''}. UNDO puts them back.`;
      videoState.beat = { ...videoState.beat!, moved: r.moved.length, biggest: r.biggest, line: l };
      commit(r.p, l);
    } catch (e) {
      failed(e, () => void runSnap(), 'snap the cuts');
    }
  }

  async function record(key: HTMLButtonElement, level: HTMLElement) {
    if (recording) return recording.stop();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return say('I need the microphone for that: the phone asks once. You can also add a recording from a file.');
    }
    const mr = new MediaRecorder(stream);
    const parts: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
    const ac = audioCtx();
    const an = ac.createAnalyser();
    an.fftSize = 512;
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    let raf = 0;
    const bar = level.querySelector('i') as HTMLElement;
    const draw = () => {
      an.getByteTimeDomainData(buf);
      let s = 0;
      for (const v of buf) s += ((v - 128) / 128) ** 2;
      bar.style.width = `${Math.min(100, Math.sqrt(s / buf.length) * 320)}%`;
      raf = requestAnimationFrame(draw);
    };
    draw();
    const t0 = Math.round(player?.t ?? 0);
    if (player) {
      player.silent = true;
      void player.seek(t0).then(() => player?.play());
    }
    recording = {
      stop: () => {
        cancelAnimationFrame(raf);
        mr.stop();
      },
    };
    key.textContent = 'STOP';
    key.classList.add('on');
    say('Recording… speak, then STOP. The picture is playing along.');
    const done = new Promise<void>((ok) => (mr.onstop = () => ok()));
    mr.start();
    await done;
    stream.getTracks().forEach((t) => t.stop());
    void ac.close();
    recording = null;
    if (player) {
      player.pause();
      player.silent = false;
    }
    const blob = new Blob(parts, { type: parts[0]?.type || 'audio/webm' });
    try {
      const ac2 = audioCtx();
      const decoded = await decodeAudio(ac2, blob);
      void ac2.close();
      if (!decoded) throw new Error('unreadable');
      const wav = new Blob([encodeWav({ rate: decoded.sampleRate, channels: [decoded.getChannelData(0).slice()] }) as BlobPart], { type: 'audio/wav' });
      if (player) await player.seek(t0);
      await addSoundFile('voice', wav, 'Voice-over');
    } catch {
      say('I couldn’t keep that recording. Try again, or add a recording from a file.');
    }
    renderTray();
  }

  // ---------------------------------------------------------------- subtitles
  const brainHeard = () => lsGet('ghosty.video.heard') === '1';
  function subtitlesTray(): Nodes {
    const out: Nodes = [];
    const c = selClip() ?? project.main[0];
    const firstPass = act('FROM MY BRAIN', () => {
      if (!c) return say('Add a clip first.');
      if (ui.get().connected === false || navigator.onLine === false) return say('You’re offline, so my brain can’t be reached for this. Type the lines yourself; everything else here works.');
      if (!brainHeard()) {
        clear(ask, h('p.vdsay', 'Your clip’s sound goes to your brain to be written down; nothing else leaves.'), row(act('GO ON', () => (lsSet('ghosty.video.heard', '1'), clear(ask), void writeDown(c)), 'on'), act('NOT NOW', () => clear(ask))));
        return;
      }
      void writeDown(c);
    }, 'on');
    const ask = h('div.vdask');
    out.push(row(firstPass, act('ADD A LINE AT THE PLAYHEAD', () => {
      const t = Math.round(player?.t ?? 0);
      const q = structuredClone(project);
      q.subs.push({ start: t, end: t + 2500, text: 'Type the words here', pos: 'bottom' });
      q.subs.sort((a, b) => a.start - b.start);
      commit(q, 'A line at the playhead: change its words below.');
    })), ask);
    if (!project.subs.length) out.push(note('Subtitles are drawn on the picture when I make the file, and I can save them as .srt or .vtt too.'));
    project.subs.forEach((cue, i) => {
      const inp = h('input.vdcue', { type: 'text', value: cue.text, 'aria-label': `Line ${i + 1}, from ${clock(cue.start, true)}` }) as HTMLInputElement;
      inp.addEventListener('change', () => {
        const q = structuredClone(project);
        q.subs[i]!.text = inp.value;
        commit(q);
      });
      out.push(h('div.vdcard.vdcuerow', { dataset: { i: String(i) } },
        h('span.vdcuet', `${clock(cue.start, true)}–${clock(cue.end, true)}`),
        inp,
        row(
          act(cue.pos === 'top' ? 'TOP' : 'BOTTOM', () => {
            const q = structuredClone(project);
            q.subs[i]!.pos = cue.pos === 'top' ? 'bottom' : 'top';
            commit(q);
          }),
          act('DELETE', () => commit({ ...structuredClone(project), subs: project.subs.filter((_, j) => j !== i) })),
        )));
    });
    if (project.subs.length) {
      out.push(row(
        act('SAVE .SRT', () => void saveText(toSrt(project.subs), `${project.name}.srt`, 'application/x-subrip')),
        act('SAVE .VTT', () => void saveText(toVtt(project.subs), `${project.name}.vtt`, 'text/vtt')),
      ));
    }
    return out;
  }
  async function saveText(text: string, fname: string, type: string) {
    const { saveBlob, shareBlob } = await import('../convert/run');
    const b = new Blob([text], { type: `${type};charset=utf-8` });
    if (!(await shareBlob(b, fname))) saveBlob(b, fname);
    say(`${fname} saved, ${sizeWords(b.size)}.`);
    (videoState as Record<string, unknown>).srt = text;
  }
  /** A sound cut to mono, 16 kHz, from `from` to `to` seconds, as a WAV for the hearing route. */
  async function monoWav(buf: AudioBuffer, from: number, to: number): Promise<Blob> {
    const rate = 16_000;
    const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil((to - from) * rate)), rate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0, from, to - from);
    const r = await ctx.startRendering();
    return new Blob([encodeWav({ rate, channels: [r.getChannelData(0)] }) as BlobPart], { type: 'audio/wav' });
  }
  async function writeDown(c: Clip) {
    await player?.loadSound();
    const buf = player?.buffers.get(c.src);
    const x = place(project.main).find((z) => z.clip.id === c.id);
    if (!buf || !x) return say('That clip has no sound I can read, so there is nothing for me to write down.');
    const spans = pieces(c.out - c.in, 25_000);
    const cues: Project['subs'] = [];
    const { brain } = await import('../api/brain');
    try {
      for (const [i, [a, b]] of spans.entries()) {
        say(`Writing down part ${i + 1} of ${spans.length}…`);
        const text = await brain.stt(await monoWav(buf, (c.in + a) / 1000, (c.in + b) / 1000));
        cues.push(...cuesFromWords(text, Math.round(x.start + a / c.speed), Math.round(x.start + b / c.speed)));
      }
    } catch {
      return say('Your brain is away; type them, or try when it is back.');
    }
    if (!cues.length) return say('I couldn’t hear any words in that clip. You can type the lines yourself.');
    const q = structuredClone(project);
    q.subs = [...q.subs, ...cues].sort((p1, p2) => p1.start - p2.start);
    commit(q, `${cues.length} lines from your brain. It’s a first pass from your brain: read them once, and fix any word in place.`);
  }

  // ---------------------------------------------------------------- overlays: pictures in pictures, and the chroma key
  function overlayTray(): Nodes {
    const out: Nodes = [fileKey('ADD A PICTURE-IN-PICTURE CLIP', 'video/*,.mov,.mp4,.m4v,.webm', (f) => void addFiles(f, 'pip'), 'pip')];
    const pips = project.overlays.filter((o) => o.clip);
    const cur = pips.find((o) => o.id === selOv) ?? pips[0];
    if (cur) selOv = cur.id;
    for (const o of pips) {
      out.push(h('div.vdcard', { dataset: { id: o.id }, class: `vdcard${o.id === selOv ? ' on' : ''}` },
        act(`Picture from ${clock(o.start, true)}, ${lengthWords(o.len)}`, () => (selOv = o.id, renderTray()), 'vdlist'),
        o.id === selOv ? h('div.vdcardbody',
          choices('Corner', [{ id: 'tl', label: 'TOP LEFT' }, { id: 'tr', label: 'TOP RIGHT' }, { id: 'bl', label: 'BOTTOM LEFT' }, { id: 'br', label: 'BOTTOM RIGHT' }], o.corner ?? 'br', (v) => commit(editOv(o.id, (z) => (z.corner = v)))),
          slider({ label: 'Size', min: 0.15, max: 1, step: 0.01, value: o.size ?? 0.35, say: (v) => `${Math.round(v * 100)}% of the width`, input: (v) => live((q) => (q.overlays.find((z) => z.id === o.id)!.size = v)), change: (v) => commit(editOv(o.id, (z) => (z.size = v))), reset: 0.35 }),
          stepper('Starts', () => clock(project.overlays.find((z) => z.id === o.id)?.start ?? 0, true), () => commit(editOv(o.id, (z) => (z.start = Math.max(0, z.start - 250)))), () => commit(editOv(o.id, (z) => (z.start += 250)))),
          stepper('Lasts', () => lengthWords(project.overlays.find((z) => z.id === o.id)?.len ?? 0), () => commit(editOv(o.id, (z) => (z.len = Math.max(500, z.len - 500)))), () => commit(editOv(o.id, (z) => (z.len = Math.min((z.clip!.out - z.clip!.in) / z.clip!.speed, z.len + 500))))),
          h('h4.vdh', 'CHROMA KEY'),
          row(
            act(o.clip!.chroma ? 'TAKE THE KEY OFF' : 'KEY A COLOUR OUT', () => {
              if (o.clip!.chroma) return commit(editOv(o.id, (z) => delete z.clip!.chroma), 'The key is off.');
              pickingColour = true;
              say('Tap the colour on the picture that should go clear.');
              canvas.classList.add('picking');
            }, 'vdkeyc'),
          ),
          o.clip!.chroma ? slider({ label: 'Tolerance', min: 0.02, max: 0.5, step: 0.01, value: o.clip!.chroma.tol, say: (v) => `${Math.round(v * 100)}`, change: (v) => commit(editOv(o.id, (z) => (z.clip!.chroma!.tol = v))), reset: 0.12 }) : null,
          o.clip!.chroma ? slider({ label: 'Softness', min: 0, max: 0.4, step: 0.01, value: o.clip!.chroma.soft, say: (v) => `${Math.round(v * 100)}`, change: (v) => commit(editOv(o.id, (z) => (z.clip!.chroma!.soft = v))), reset: 0.1 }) : null,
          act('DELETE THE PICTURE', () => (selOv = '', commit({ ...project, overlays: project.overlays.filter((z) => z.id !== o.id) }, 'The picture is out.'))),
        ) : null));
    }
    if (!pips.length) out.push(note('A picture in picture is a second clip over the first, in a corner. Key a colour out of it to lay a person on a new background.'));
    return out;
  }
  canvas.addEventListener('click', (e) => {
    if (!pickingColour || !player) return;
    pickingColour = false;
    canvas.classList.remove('picking');
    const o = selOverlay();
    if (!o?.clip) return;
    const r = canvas.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const q = structuredClone(project);
    delete q.overlays.find((z) => z.id === o.id)!.clip!.chroma;
    player.setProject(q);
    void player.seek(player.t).then(() => {
      const px = player!.gpu.pixel(fx, fy);
      commit(editOv(o.id, (z) => (z.clip!.chroma = { color: [px[0] / 255, px[1] / 255, px[2] / 255], tol: 0.12, soft: 0.1 })), 'That colour is clear now. Tolerance and softness are below.');
    });
  });

  // ---------------------------------------------------------------- move (position, size, turn, see-through, keyframes)
  const CH = [
    { k: 'x' as const, label: 'Across', min: -0.5, max: 0.5, step: 0.01, def: 0, say: (v: number) => `${Math.round(v * 100)}%` },
    { k: 'y' as const, label: 'Up and down', min: -0.5, max: 0.5, step: 0.01, def: 0, say: (v: number) => `${Math.round(v * 100)}%` },
    { k: 'scale' as const, label: 'Size', min: 0.25, max: 3, step: 0.01, def: 1, say: (v: number) => `${Math.round(v * 100)}%` },
    { k: 'rot' as const, label: 'Turn', min: -180, max: 180, step: 1, def: 0, say: (v: number) => `${Math.round(v)}°` },
    { k: 'opacity' as const, label: 'See-through', min: 0, max: 1, step: 0.01, def: 1, say: (v: number) => `${Math.round(v * 100)}% visible` },
  ];
  function moveTray(c: Clip): Nodes {
    const x = place(project.main).find((z) => z.clip.id === c.id)!;
    const tIn = Math.round(Math.max(0, Math.min(x.len, (player?.t ?? 0) - x.start)));
    const cur = transformAt(c.tr, tIn);
    const nKeys = CH.reduce((n, ch) => n + (c.tr.keys[ch.k]?.length ?? 0), 0);
    const out: Nodes = [h('p.vdsay', nKeys ? `${nKeys} keys: the sliders change the value at the playhead (${clock(tIn, true)} into the clip).` : 'No keys yet: the sliders hold for the whole clip.')];
    for (const ch of CH)
      out.push(slider({
        label: ch.label, min: ch.min, max: ch.max, step: ch.step, value: cur[ch.k], say: ch.say, reset: ch.def,
        input: (v) => live((q) => setChannel(q.main.find((z) => z.id === c.id)!, ch.k, v, tIn)),
        change: (v) => commit(editClip(c.id, (z) => setChannel(z, ch.k, v, tIn))),
      }));
    out.push(row(
      act('KEY AT THE PLAYHEAD', () => commit(editClip(c.id, (z) => { for (const k of CH) upsert(z, k.k, transformAt(z.tr, tIn)[k.k], tIn); }), `A key at ${clock(tIn, true)} into the clip. Move the playhead, change a slider, and it moves between the keys.`)),
      act('SMOOTH THE KEYS', () => commit(editClip(c.id, (z) => { for (const k of CH) for (const key of z.tr.keys[k.k] ?? []) key.ease = true; }), 'The moves between keys ease in and out.')),
      act('CLEAR THE KEYS', () => commit(fixTransitions(editClip(c.id, (z) => { const sp = z.tr.keys.speed; z.tr.keys = sp ? { speed: sp } : {}; delete z.steady; })), 'The keys are cleared (a speed ramp stays; take it off under SPEED).')),
    ));
    return out;
  }
  const upsert = (c: Clip, k: 'x' | 'y' | 'scale' | 'rot' | 'opacity', v: number, t: number) => {
    const keys = (c.tr.keys[k] ??= []);
    const i = keys.findIndex((z) => Math.abs(z.t - t) < 40);
    if (i >= 0) keys[i]!.v = v;
    else keys.push({ t, v });
    keys.sort((a, b) => a.t - b.t);
  };
  const setChannel = (c: Clip, k: 'x' | 'y' | 'scale' | 'rot' | 'opacity', v: number, t: number) => {
    if (c.tr.keys[k]?.length) upsert(c, k, v, t);
    else c.tr[k] = v;
  };

  // ---------------------------------------------------------------- crop, aspect and mask
  function cropTray(): Nodes {
    const c = selClip();
    const out: Nodes = [
      choices('Shape', ASPECTS.map((a) => ({ id: a.id, label: a.label.toUpperCase() })), project.aspect, (a) => commit({ ...structuredClone(project), aspect: a as Aspect }, a === 'project' ? 'The video keeps its own shape.' : `The video is ${a}.`)),
    ];
    if (!c) return [...out, need('Tap a clip to crop it, fit or fill the picture, or mask it.')];
    const z = c.crop.w;
    const px = z >= 1 ? 0.5 : c.crop.x / (1 - z);
    const py = c.crop.h >= 1 ? 0.5 : c.crop.y / (1 - c.crop.h);
    const rect = (zz: number, ax: number, ay: number) => ({ x: (1 - zz) * ax, y: (1 - zz) * ay, w: zz, h: zz });
    out.push(choices('Picture in the frame', [{ id: 'fit', label: 'FIT (BARS IF NEEDED)' }, { id: 'fill', label: 'FILL THE FRAME' }], c.fit, (v) => commit(editClip(c.id, (q) => (q.fit = v as 'fit' | 'fill')), v === 'fill' ? 'The picture fills the frame; what does not fit is cropped.' : 'The whole picture shows, with bars where it does not fit.')));
    out.push(slider({ label: 'Crop in', min: 0.25, max: 1, step: 0.01, value: z, say: (v) => (v >= 1 ? 'whole picture' : `${(1 / v).toFixed(1)}× in`), input: (v) => live((q) => (q.main.find((m) => m.id === c.id)!.crop = rect(v, px, py))), change: (v) => commit(editClip(c.id, (q) => (q.crop = rect(v, px, py)))), reset: 1 }));
    if (z < 1) {
      out.push(slider({ label: 'Crop: across', min: 0, max: 1, step: 0.01, value: px, say: (v) => `${Math.round(v * 100)}%`, change: (v) => commit(editClip(c.id, (q) => (q.crop = rect(z, v, py)))), reset: 0.5 }));
      out.push(slider({ label: 'Crop: up and down', min: 0, max: 1, step: 0.01, value: py, say: (v) => `${Math.round(v * 100)}%`, change: (v) => commit(editClip(c.id, (q) => (q.crop = rect(z, px, v)))), reset: 0.5 }));
    }
    out.push(h('h4.vdh', 'MASK'));
    out.push(choices('Mask', [{ id: 'none', label: 'NONE' }, { id: 'rect', label: 'RECTANGLE' }, { id: 'ellipse', label: 'ELLIPSE' }], c.mask?.kind ?? 'none', (k) => commit(editClip(c.id, (q) => (k === 'none' ? delete q.mask : (q.mask = { kind: k as 'rect' | 'ellipse', x: 0, y: 0, w: 0.7, h: 0.7, feather: 0.15, invert: false }))), k === 'none' ? 'The mask is off.' : `A ${k} mask: only what is inside it shows.`)));
    if (c.mask) {
      const m = c.mask;
      out.push(slider({ label: 'Mask: width', min: 0.1, max: 1, step: 0.01, value: m.w, say: (v) => `${Math.round(v * 100)}%`, change: (v) => commit(editClip(c.id, (q) => (q.mask!.w = v))), reset: 0.7 }));
      out.push(slider({ label: 'Mask: height', min: 0.1, max: 1, step: 0.01, value: m.h, say: (v) => `${Math.round(v * 100)}%`, change: (v) => commit(editClip(c.id, (q) => (q.mask!.h = v))), reset: 0.7 }));
      out.push(slider({ label: 'Mask: soft edge', min: 0, max: 0.5, step: 0.01, value: m.feather, say: (v) => `${Math.round(v * 100)}`, change: (v) => commit(editClip(c.id, (q) => (q.mask!.feather = v))), reset: 0.15 }));
      out.push(slider({ label: 'Mask: across', min: -0.5, max: 0.5, step: 0.01, value: m.x, say: (v) => `${Math.round(v * 100)}%`, change: (v) => commit(editClip(c.id, (q) => (q.mask!.x = v))), reset: 0 }));
      out.push(slider({ label: 'Mask: up and down', min: -0.5, max: 0.5, step: 0.01, value: m.y, say: (v) => `${Math.round(v * 100)}%`, change: (v) => commit(editClip(c.id, (q) => (q.mask!.y = v))), reset: 0 }));
      out.push(choices('Which side', [{ id: 'in', label: 'INSIDE SHOWS' }, { id: 'out', label: 'OUTSIDE SHOWS' }], m.invert ? 'out' : 'in', (v) => commit(editClip(c.id, (q) => (q.mask!.invert = v === 'out')))));
    }
    return out;
  }

  // ---------------------------------------------------------------- SCENES and QUIET
  async function analyseScenes(c: Clip) {
    const e = feeder.get(c.src);
    if (!e) return say('I can’t read that clip’s picture, so I can’t look for cuts in it.');
    player?.pause();
    const step = 250;
    const cv = document.createElement('canvas');
    cv.width = 32;
    cv.height = 18;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    const hs: Float32Array[] = [];
    const n = Math.floor((c.out - c.in) / step);
    // the clip's frames in turn by the phone's decoder where the file can be read that way, else the player seeking for each
    const blob = await blobFor(c.src, false);
    const reader = blob ? await Reader.open(blob) : null;
    for (let i = 0; i <= n; i++) {
      if (reader) {
        const f = await reader.frameAt(c.in + i * step);
        g.drawImage(f as unknown as CanvasImageSource, 0, 0, 32, 18);
        f.close();
      } else {
        await feeder.seek(c.src, c.in + i * step);
        g.drawImage(e.v, 0, 0, 32, 18);
      }
      hs.push(histogram(g.getImageData(0, 0, 32, 18).data));
      if (i % 4 === 0) say(`Looking for cuts… ${Math.round((i / n) * 100)}%`);
    }
    reader?.close();
    const x = place(project.main).find((z) => z.clip.id === c.id)!;
    const cuts = findCuts(hs, step).map((ms) => Math.round(x.start + (ms - 0) / c.speed));
    videoState.cuts = cuts;
    say(cuts.length ? `I found ${cuts.length} cut${cuts.length === 1 ? '' : 's'}, at ${cuts.map((t) => clock(t, true)).join(', ')}.` : 'I found no cuts: the picture keeps the same look all the way through.');
    renderTray();
    if (player) void player.seek(player.t);
  }
  function scenesTray(): Nodes {
    const c = selClip() ?? project.main[0];
    if (!c) return [need('Add a clip first.')];
    return [
      act('LOOK FOR CUTS IN THIS CLIP', () => void analyseScenes(c), 'on'),
      videoState.cuts.length ? act(`SPLIT AT THE ${videoState.cuts.length} CUT${videoState.cuts.length === 1 ? '' : 'S'}`, () => {
        const r = splitMany(project, videoState.cuts);
        videoState.cuts = [];
        commit(r.made ? r.p : null, `Split at ${r.made} cut${r.made === 1 ? '' : 's'}: the video is as long as it was.`);
      }) : null,
      note('I compare the colours of the picture four times a second; a big jump is a cut. It works on the phone, with nothing sent.'),
      h('h4.vdh', 'BEST CLIPS'),
      ...bestNodes(),
    ];
  }

  // ---------------------------------------------------------------- BEST CLIPS (VIDEO 2)
  const namerLine = 'Without the namer kept, I choose by sharpness, light and variety alone.';
  const clipNo = (id: string): number => project.main.findIndex((c) => c.id === id) + 1;
  const pickTotal = (): number => (bestPick ? bestPick.picks.filter((x) => x.on).reduce((n, x) => n + (x.to - x.from) / (project.main.find((c) => c.id === x.unit.clip)?.speed ?? 1), 0) : 0);
  function bestNodes(): Nodes {
    if (!project.main.length) return [need('Add a clip first.')];
    const out: Nodes = [];
    const typed = ![15, 30, 60].includes(bestTarget);
    out.push(choices('How long', [{ id: 15, label: '15 S' }, { id: 30, label: '30 S' }, { id: 60, label: '60 S' }], typed ? 0 : bestTarget, (v) => { bestTarget = v; bestPick = null; renderTray(); }));
    const inp = h('input.vdtitlein.vdtarget', { type: 'number', inputMode: 'numeric', min: '3', max: '600', value: String(bestTarget), 'aria-label': 'Length in seconds', placeholder: 'Or type the seconds' }) as HTMLInputElement;
    inp.addEventListener('change', () => {
      const v = Math.round(Number(inp.value));
      bestTarget = Number.isFinite(v) && v >= 3 ? Math.min(600, v) : bestTarget;
      bestPick = null;
      renderTray();
    });
    out.push(h('div.vdrow', h('label.vdlabel', 'Seconds'), inp));
    if (bestBusy) {
      out.push(act('STOP', () => bestBusy && (bestBusy.cancelled = true), 'vdstop'));
      return out;
    }
    out.push(act('BEST CLIPS', () => void runBest(), 'on vdbest'));
    if (bestPick) {
      const bp = bestPick;
      const total = pickTotal();
      out.push(h('p.vdsay.vdbestline', videoState.best?.line ?? ''));
      if (!(eyesKept(EYES_NAMER.id))) out.push(h('p.vdnote.vdnamer', namerLine));
      if (!bp.picks.length) out.push(h('p.vdsay', 'Nothing to choose from here: every clip is blurred, too dark or too bright.'));
      bp.picks.forEach((x, i) => {
        const why = `${reason(x, i === 0)}${x.word ? `: ${x.word}` : ''}`;
        const b = act(`${x.on ? '☑' : '☐'}  Clip ${clipNo(x.unit.clip)} · ${clock(x.from, true)}–${clock(x.to, true)} · ${why}`, () => { x.on = !x.on; refreshBest(); renderTray(); }, `vdchoice vdlist vdtick${x.on ? ' on' : ''}`);
        b.setAttribute('role', 'checkbox');
        b.setAttribute('aria-checked', String(x.on));
        b.setAttribute('aria-label', `Clip ${clipNo(x.unit.clip)}, ${clock(x.from, true)} to ${clock(x.to, true)}: ${why}`);
        out.push(b);
      });
      for (const l of bp.left) out.push(h('p.vdnote.vdleft', `Clip ${clipNo(l.unit.clip)} · ${clock(l.unit.from, true)}–${clock(l.unit.to, true)} · ${leftReason(l)}`));
      if (bp.picks.length) {
        out.push(h('p.vdsay.vdbesttotal', `${bp.picks.filter((x) => x.on).length} picked: ${lengthWords(total)}${project.music.length ? ', each a whole number of beats long once the music’s beat is found' : ''}.`));
        out.push(act('MAKE THE CUT', () => void makeCut(), 'on vdcut'));
      }
    }
    out.push(note('I score each stretch by how sharp it is, how well lit, how it moves and how different it looks from what I have already picked, never by who is in it. Your clips stay as they are; MAKE THE CUT builds from the ticks, and UNDO puts it all back.'));
    return out;
  }
  function refreshBest() {
    if (!bestPick || !videoState.best) return;
    videoState.best.picks = bestPick.picks.map((x) => ({ clip: x.unit.clip, from: x.from, to: x.to, reason: reason(x, false), on: x.on }));
  }
  async function runBest() {
    if (bestBusy) return;
    player?.pause();
    const run = { cancelled: false };
    bestBusy = run;
    renderTray();
    say(`Looking at your clips… about ${Math.max(2, Math.round(project.main.reduce((n, c) => n + (c.out - c.in) / 1000, 0) * 0.4))} s`);
    try {
      const sc = await scoreClips(project, (id) => blobFor(id, false), feeder, crunch, {
        cancel: run,
        onProgress: (i, of, left) => say(`Looking at clip ${i} of ${of}… about ${Math.max(1, Math.round(left))} s left`),
      });
      if (run.cancelled) return say('Stopped. Nothing was changed.');
      scored = sc;
      const r = choose(sc.units, bestTarget * 1000, unitLen(project));
      const namer = eyesKept(EYES_NAMER.id) && (await eyesHere(EYES_NAMER).catch(() => false));
      const words = namer ? await nameWords(r.picks.map((x) => sc.frames.get(x.unit)!), true) : r.picks.map(() => null);
      bestPick = { picks: r.picks.map((x, i) => ({ ...x, on: true, word: words[i] ?? null })), left: r.left, short: r.short };
      const got = r.picks.reduce((n, x) => n + unitLen(project)({ ...x.unit, from: x.from, to: x.to }), 0);
      const line = !r.picks.length
        ? 'Nothing to choose from here.'
        : r.short >= 1000
          ? `Only ${lengthWords(got)} is worth choosing from, short of the ${bestTarget} s you asked for: ${r.picks.length} stretch${r.picks.length === 1 ? '' : 'es'}, with the rest left out below.`
          : `I picked ${lengthWords(got)} for your ${bestTarget} s: ${r.picks.length} stretch${r.picks.length === 1 ? '' : 'es'}. Untick any you don’t want.`;
      videoState.best = { ms: sc.ms, clips: sc.clips, perClip: sc.ms / Math.max(1, sc.clips), picks: [], left: r.left.map((l) => ({ clip: l.unit.clip, reason: leftReason(l) })), line, namer, total: got };
      refreshBest();
      say(line);
    } catch (e) {
      failed(e, () => void runBest(), 'look at the clips');
    } finally {
      bestBusy = null;
      renderTray();
    }
  }
  async function makeCut() {
    if (!bestPick) return;
    const ticks: Tick[] = bestPick.picks.filter((x) => x.on).map((x) => ({ clip: x.unit.clip, from: x.from, to: x.to }));
    if (!ticks.length) return say('Tick at least one stretch first.');
    let beat: { period: number; first: number } | undefined;
    if (project.music.length) {
      try {
        const b = await ensureBeats();
        if (b) beat = { period: 60_000 / b.tempo.bpm, first: b.beats[0] ?? 0 };
      } catch (e) {
        return failed(e, () => void makeCut(), 'find the music’s beat');
      }
    }
    const next = cutFromTicks(project, ticks, beat);
    if (!next) return say('I couldn’t build a cut from those.');
    bestPick = null;
    sel = '';
    commit(fixTransitions(next), `Made the cut: ${lengthWords(duration(next))} from ${ticks.length} stretch${ticks.length === 1 ? '' : 'es'}${beat ? `, each a whole number of beats at ${tempoWords(60_000 / beat.period)}` : ''}. Your clips are untouched; UNDO puts everything back (titles and subtitles too).`);
  }
  async function analyseQuiet() {
    await player?.loadSound();
    if (!player || ![...player.buffers.keys()].length) return say('There’s no sound in this video to listen to.');
    say('Listening for pauses…');
    const rate = 16_000;
    const mixed = await renderMix(project, player.buffers, rate);
    const series = rmsSeries([mixed.getChannelData(0)], rate, 50);
    const pauses = findPauses(series, 50, 0.02, 600, 150);
    videoState.pauses = pauses;
    say(pauses.length ? `I found ${pauses.length} pause${pauses.length === 1 ? '' : 's'} over ${lengthWords(600)}: cutting them saves ${lengthWords(timeSaved(pauses))}.` : 'I found no pauses over 0.6 s: nothing to cut.');
    renderTray();
  }
  function quietTray(): Nodes {
    if (!project.main.length) return [need('Add a clip first.')];
    const p = videoState.pauses;
    return [
      act('LISTEN FOR PAUSES', () => void analyseQuiet(), 'on'),
      p.length ? act(`CUT THE ${p.length} PAUSE${p.length === 1 ? '' : 'S'} (SAVES ${lengthWords(timeSaved(p))})`, () => {
        const saved = timeSaved(p);
        commit(cutRanges(project, p), `Cut ${p.length} pause${p.length === 1 ? '' : 's'}: ${lengthWords(saved)} saved. UNDO puts them back.`);
        videoState.pauses = [];
      }) : null,
      note('A pause is where the whole mix, music too, stays quiet for over 0.6 s. I leave a breath at each end. Where I cut, a transition becomes a plain cut.'),
    ];
  }

  // ---------------------------------------------------------------- export
  let preset = 'wide';
  let quality = 1;
  let lastExport: Exported | null = null;
  let pathInfo: PathInfo | null = null;
  function exportTray(): Nodes {
    const d = duration(project);
    if (!d) return [need('Add a clip first, then I can make the file.')];
    const pre = PRESETS.find((x) => x.id === preset)!;
    const src = Object.values(project.sources).reduce((m, s) => Math.max(m, s.w, s.h), 0) || 1280;
    const s = shape({ ...project, aspect: pre.aspect }, pre.long === 'source' ? src : pre.long);
    const est = pathInfo?.path === 'recorder' ? recorderBytes(d, s.w, s.h, project.fps, quality) : estimateBytes(d, s.w, s.h, project.fps, quality, true);
    const out: Nodes = [];
    const pathLine = h('p.vdpath', { 'aria-live': 'polite' }, pathInfo ? pathWords(pathInfo, d) : 'Checking what this phone can do…');
    if (!pathInfo) void choosePath(s.w, s.h, project.fps).then((i) => {
      pathInfo = i;
      videoState.exportPath = i.path;
      videoState.exportSaid = pathWords(i, d);
      pathLine.textContent = videoState.exportSaid;
    });
    else {
      videoState.exportPath = pathInfo.path;
      videoState.exportSaid = pathWords(pathInfo, d);
    }
    videoState.exportSize = `${aboutSize(est)}`;
    (videoState as Record<string, unknown>).sizeSaid = est;
    out.push(
      choices('Where it is going', PRESETS.map((p) => ({ id: p.id, label: p.label.toUpperCase() })), preset, (v) => ((preset = v), renderTray())),
      h('p.vdsay', `${pre.label} (${pre.line}${pre.long === 'source' ? `: ${s.w} × ${s.h}` : ''}), ${project.fps} frames a second, ${lengthWords(d)}.`),
      choices('Quality', QUALITIES.map((q) => ({ id: q.k, label: q.label.toUpperCase() })), quality, (v) => ((quality = v), renderTray())),
      h('p.vdsay.vdsize', `The file will be ${aboutSize(est)} (${(videoBitrate(s.w, s.h, project.fps, quality) / 1e6).toFixed(1)} Mb/s).`),
      pathLine,
    );
    const prog = h('progress.vdprog', { max: '1', value: '0', hidden: true, 'aria-label': 'Export progress' }) as HTMLProgressElement;
    const words = h('p.vdsay.vdprogwords', { 'aria-live': 'polite' });
    const result = h('div.vdresult');
    const go = act('EXPORT', () => void run(), 'on vdexport');
    const stop = act('STOP', () => exporting && (exporting.cancelled = true), 'vdstop');
    stop.hidden = true;
    async function run() {
      if (exporting) return;
      player?.pause();
      exporting = { cancelled: false };
      go.disabled = true;
      stop.hidden = false;
      prog.hidden = false;
      clear(result);
      try {
        const r = await exportVideo(project, {
          preset, quality, blobOf: (id) => blobFor(id, false), cancel: exporting,
          onProgress: (p) => {
            prog.value = p.frac;
            words.textContent = p.words;
          },
        });
        lastExport = r;
        videoState.exportDone = { bytes: r.bytes, frames: r.frames, audioPackets: r.audioPackets, path: r.path, seconds: r.seconds, ext: r.ext, w: r.w, h: r.h, durationMs: r.durationMs, ...(r.fellBack ? { fellBack: r.fellBack } : {}) };
        (videoState as Record<string, unknown>).lastExport = r;
        showResult(result, r);
        await fellBack(r, pathLine, d);
        // a size said and a size measured more than twice apart is said in one line (the recorder picks its own rate on the slow path)
        const off = r.bytes < est / 2 ? 'Smaller' : r.bytes > est * 2 ? 'Bigger' : '';
        if (off) result.append(h('p.vdnote.vdsizenote', `${off} than I said (about ${sizeWords(est)}): the phone’s ${r.path === 'recorder' ? 'recorder' : 'encoder'} chose its own rate.`));
        (videoState as Record<string, unknown>).sizeSaid = est;
        say(`The file is ready: ${sizeWords(r.bytes)}, ${r.w} × ${r.h}.`);
        words.textContent = '';
      } catch (e) {
        words.textContent = '';
        say(e instanceof Cancelled ? 'Stopped. Nothing was saved, and your clips are as they were.' : sayError(e, 'make the file'));
      } finally {
        exporting = null;
        go.disabled = false;
        stop.hidden = true;
        prog.hidden = true;
        void player?.seek(player.t);
      }
    }
    out.push(row(go, stop), prog, words, result);
    if (lastExport) showResult(result, lastExport);
    out.push(note('Not in this version: Director Mode (following who is speaking would take a model that tells voices apart, a download I would ask you for first) and several cameras (syncing them by sound and a second timeline would take a day’s work). I’ve said so rather than fake them.'));
    return out;
  }
  /** The frame-by-frame path's encoder would not start and the recorder made the file: the sheet says the path it takes now. */
  async function fellBack(r: Exported, pathLine?: HTMLElement, d = duration(project)) {
    if (!r.fellBack) return;
    pathInfo = await choosePath();
    videoState.exportPath = pathInfo.path;
    videoState.exportSaid = pathWords(pathInfo, d);
    if (pathLine) pathLine.textContent = videoState.exportSaid;
    else if (tool === 'export') renderTray();
  }
  function showResult(into: HTMLElement, r: Exported) {
    clear(into,
      h('p.vdsay.vdresultline', `Saved as ${project.name}.${r.ext}: ${sizeWords(r.bytes)}, ${r.w} × ${r.h}, ${lengthWords(r.durationMs)}, made in ${Math.round(r.seconds)} s (${r.path === 'webcodecs' ? 'frame by frame' : 'in real time'}).`),
      r.fellBack ? h('p.vdnote.vdfellback', r.fellBack) : null,
      row(
        act('SAVE', () => void (async () => { const { saveBlob } = await import('../convert/run'); saveBlob(r.blob, `${project.name}.${r.ext}`); })()),
        act('SHARE', () => void (async () => {
          const { saveBlob, shareBlob } = await import('../convert/run');
          if (!(await shareBlob(r.blob, `${project.name}.${r.ext}`))) {
            saveBlob(r.blob, `${project.name}.${r.ext}`);
            say('This phone has no share sheet here, so I saved the file instead.');
          }
        })()),
        project.subs.length ? act('SAVE THE SUBTITLES (.SRT)', () => void saveText(toSrt(project.subs), `${project.name}.srt`, 'application/x-subrip')) : null,
      ));
  }

  // ---------------------------------------------------------------- projects
  async function refreshKept() {
    kept = await listProjects().catch(() => []);
  }
  async function openProject(id: string) {
    const p = await loadProject(id);
    if (!p) return say('I couldn’t open that video.');
    const reopenAt = p.playhead;
    player?.pause();
    feeder.dispose();
    project = p;
    hist = new History(project);
    sel = '';
    bestPick = null;
    scored = null;
    beats = null;
    selOv = '';
    if (project.main.length) ensurePlayer();
    await loadSources();
    player?.setProject(project);
    player?.resize(640);
    renderAll();
    await player?.seek(reopenAt).catch(() => undefined);
    renderTransport();
    say(project.main.length ? `“${project.name}”: ${project.main.length} clip${project.main.length === 1 ? '' : 's'}, ${lengthWords(duration(project))}.` : 'No video yet. Add a clip and I’ll start one.');
  }
  async function loadSources() {
    for (const [id, s] of Object.entries(project.sources)) {
      if (s.kind !== 'video') continue;
      const b = await blobFor(id, true);
      if (!b) continue;
      try {
        await feeder.open(id, b);
      } catch {
        say(CODEC_LINE);
      }
    }
    void player?.loadSound();
  }
  async function newBlank() {
    player?.pause();
    feeder.dispose();
    project = newProject();
    hist = new History(project);
    sel = '';
    bestPick = null;
    scored = null;
    beats = null;
    player?.setProject(project);
    renderAll();
    await player?.seek(0).catch(() => undefined);
    say('No video yet. Add a clip and I’ll start one.');
  }
  async function duplicate() {
    if (!project.main.length) return say('There’s nothing to copy yet.');
    await autosave.flush();
    const q: Project = { ...structuredClone(project), id: uid(), name: `${project.name} copy`, at: Date.now() };
    for (const id of Object.keys(q.sources)) {
      const b = await sourceBlob(project.id, id);
      if (b) await putSource(q.id, id, b, await posterBlob(project.id, id));
      const px = await sourceBlob(project.id, `${id}.proxy`);
      if (px) await putSource(q.id, `${id}.proxy`, px, null);
    }
    await saveProject(q);
    await refreshKept();
    await openProject(q.id);
    say(`A copy, “${q.name}”, is open; the original is as it was.`);
  }
  async function deleteCurrent() {
    const id = project.id;
    await autosave.flush();
    await binProject(id, true).catch(() => undefined);
    await refreshKept();
    const next = kept.find((k) => !k.gone);
    if (next) await openProject(next.id);
    else await newBlank();
    const t = setTimeout(() => void removeProject(id), 8000);
    say(`“${project.name === 'My video' ? 'The video' : 'It'}” is deleted from this phone.`, act('UNDO', () => {
      clearTimeout(t);
      void binProject(id, false).then(() => openProject(id)).then(() => say('Put back.'));
    }, 'vdinline'));
  }
  function projectTray(): Nodes {
    const out: Nodes = [
      row(
        act('NEW VIDEO', () => void newBlank()),
        act('DUPLICATE', () => void duplicate()),
        act('DELETE', () => void deleteCurrent()),
        act('EXPORT THE PROJECT (.ZIP)', () => void (async () => {
          if (!project.main.length) return say('There’s nothing to export yet.');
          say('Packing the project with its clips…');
          await autosave.flush();
          const z = await projectZip(project);
          const { saveBlob, shareBlob } = await import('../convert/run');
          if (!(await shareBlob(z.blob, `${project.name}.ghostyvideo.zip`))) saveBlob(z.blob, `${project.name}.ghostyvideo.zip`);
          say(`The project, with its clips, is a .zip of ${sizeWords(z.size)}.`);
        })()),
        fileKey('OPEN A PROJECT .ZIP', '.zip,application/zip', (f) => void (async () => {
          try {
            const p = await importZip(new Uint8Array(await f[0]!.arrayBuffer()));
            await saveProject(p);
            await refreshKept();
            await openProject(p.id);
            say(`“${p.name}” is open.`);
          } catch (e) {
            say(sayError(e, 'open that'));
          }
        })(), 'zip'),
      ),
    ];
    const used = kept.filter((k) => !k.gone).reduce((n, k) => n + k.bytes, 0);
    out.push(h('p.vdnote', `${kept.filter((k) => !k.gone).length} video${kept.filter((k) => !k.gone).length === 1 ? '' : 's'} on this phone, ${sizeWords(used)} of about ${sizeWords(MAX_BYTES)}.`));
    for (const k of kept.filter((x) => !x.gone))
      out.push(h('div.vdcard', { class: `vdcard${k.id === project.id ? ' on' : ''}` }, act(`${k.name} · ${k.clips} clip${k.clips === 1 ? '' : 's'} · ${sizeWords(k.bytes)}${k.id === project.id ? ' · open now' : ''}`, () => void openProject(k.id), 'vdlist')));
    return out;
  }

  // ---------------------------------------------------------------- adding clips
  async function addFiles(files: File[], mode: 'main' | 'pip' = 'main') {
    ensurePlayer();
    await refreshKept();
    for (const file of files) {
      const live = kept.filter((k) => !k.gone);
      const r = room(live, file.size, MAX_BYTES, project.id);
      if (!r.fits) {
        say(r.words);
        continue;
      }
      if (r.letGo.length) {
        say(r.words, act(`LET GO AND ADD IT`, () => void (async () => {
          for (const g of r.letGo) await removeProject(g.id);
          await refreshKept();
          clear(lineAct);
          await addFiles([file], mode);
        })(), 'vdinline'));
        continue;
      }
      const id = uid();
      say(`Opening ${file.name}…`);
      let made: { src: Source; poster: Blob | null };
      try {
        made = await probe(file, file.name, id);
      } catch {
        say(CODEC_LINE);
        continue;
      }
      await putSource(project.id, id, file, made.poster).catch(() => undefined);
      try {
        await feeder.open(id, file);
      } catch {
        say(CODEC_LINE);
        continue;
      }
      let id2 = '';
      if (mode === 'pip') {
        const res = addPip(project, made.src, Math.round(player?.t ?? 0));
        id2 = res.id;
        commit(res.p, `A picture in picture from ${clock(res.p.overlays.at(-1)!.start, true)}: pick its corner and size under OVERLAY.`);
        selOv = id2;
      } else {
        const wasEmpty = !project.main.length;
        const n = addMain(project, made.src);
        commit(n, wasEmpty ? `${file.name}: ${lengthWords(made.src.dur)}. Your first clip is in.` : `${file.name} added: ${lengthWords(made.src.dur)}.`);
        sel = n.main.at(-1)!.id;
        if (!made.src.hasAudio) say(`${file.name} added: ${lengthWords(made.src.dur)}. It has no sound I can read, so it plays silent.`);
        if (made.src.dur > videoState.proxyAfter) void makeProxy(made.src);
      }
      void player?.loadSound();
      await refreshKept();
      if (live.length === 0 && mode === 'main') pick('trim');
      renderAll();
    }
    const left = room(kept.filter((k) => !k.gone), 0, MAX_BYTES, project.id);
    if (left.free < MAX_BYTES * 0.1) toast(left.words, 'warn');
  }

  /** A long clip's PROXY the first time it is opened: a half-size copy made on the phone through the export path at a low bit rate. */
  async function makeProxy(src: Source) {
    const est = Math.max(5, Math.round((src.dur / 1000) * ((await choosePath()).path === 'webcodecs' ? 0.5 : 1)));
    say(`Making a smaller copy to scrub with… about ${est} s`);
    const t0 = performance.now();
    try {
      const mini: Project = { ...structuredClone(newProject()), id: uid(), w: src.w, h: src.h, sources: { [src.id]: src }, main: [{ ...project.main.find((c) => c.src === src.id)!, grade: flatGrade() }] };
      const r = await exportVideo(mini, { preset: 'source', quality: 0, long: Math.round(Math.max(src.w, src.h) / 2), bitrate: 700_000, silent: true, blobOf: (id) => blobFor(id, false) });
      await putSource(project.id, `${src.id}.proxy`, r.blob, null);
      const q = structuredClone(project);
      q.sources[src.id]!.proxy = r.bytes;
      project = q;
      hist.now = q;
      autosave.change(q);
      feeder.drop(src.id);
      await feeder.open(src.id, r.blob);
      (videoState as Record<string, unknown>).proxy = { src: src.id, bytes: r.bytes, seconds: (performance.now() - t0) / 1000, of: src.dur };
      say(`A smaller copy (${sizeWords(r.bytes)}) is ready for scrubbing, made in ${Math.round((performance.now() - t0) / 1000)} s. The export always uses your original.`);
      if (player) void player.seek(player.t);
    } catch {
      say('I couldn’t make a smaller copy, so scrubbing this long clip may be slow. The export is not affected.');
    }
  }

  addIn.addEventListener('change', () => {
    const f = [...(addIn.files ?? [])];
    addIn.value = '';
    if (f.length) void addFiles(f);
  });
  // a clip dropped on the screen
  root.addEventListener('dragover', (e) => e.dataTransfer?.types.includes('Files') && e.preventDefault());
  root.addEventListener('drop', (e) => {
    const f = [...(e.dataTransfer?.files ?? [])].filter((x) => x.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(x.name));
    if (!f.length) return;
    e.preventDefault();
    e.stopPropagation();
    void addFiles(f);
  });

  // ---------------------------------------------------------------- the offline line (said once)
  let offlineSaid = false;
  const offlineLine = () => {
    if (offlineSaid || (navigator.onLine !== false && ui.get().connected !== false)) return;
    offlineSaid = true;
    videoState.offlineSaid = true;
    say('You’re offline: everything here works on the phone except writing subtitles from the sound, which needs my brain.');
  };
  window.addEventListener('offline', offlineLine);
  stopFns.push(() => window.removeEventListener('offline', offlineLine));

  // ---------------------------------------------------------------- what specs and the chat can reach
  const api = {
    project: () => project,
    state: () => videoState,
    seek: async (ms: number) => {
      player?.pause();
      await player?.seek(ms);
      renderTransport();
    },
    pixel: (fx: number, fy: number) => player?.gpu.pixel(fx, fy) ?? [0, 0, 0, 0],
    play: () => player?.play(),
    pause: () => player?.pause(),
    time: () => player?.t ?? 0,
    nodeGain: (k: 'clip' | 'music' | 'voice') => player?.nodeGain(k) ?? null,
    plan: async (kind: 'clip' | 'music' | 'voice', t: number) => {
      const { mixPlan, gainAt } = await import('./math');
      const s = mixPlan(project).find((x) => x.kind === kind);
      return s ? gainAt(s, t) : null;
    },
    forceExport: async (o: { path?: 'webcodecs' | 'recorder'; silent?: boolean; preset?: string; long?: number }) => {
      const r = await exportVideo(project, { preset: o.preset ?? 'wide', quality: 0, blobOf: (id) => blobFor(id, false), ...(o.path ? { path: o.path } : {}), ...(o.silent ? { silent: true } : {}), ...(o.long ? { long: o.long } : {}) });
      (videoState as Record<string, unknown>).forced = r;
      await fellBack(r);
      return { bytes: r.bytes, frames: r.frames, audioPackets: r.audioPackets, path: r.path, seconds: r.seconds, w: r.w, h: r.h, durationMs: r.durationMs, fellBack: r.fellBack ?? '' };
    },
    whiteCount: (y0: number, y1: number) => player?.gpu.whiteCount(y0, y1) ?? 0,
    planAt: (t: number) => planFrame(project, t).layers.map((l) => ({ role: l.role, name: project.sources[l.clip.src]?.name ?? '', ov: !!l.ov })),
    /** The muxer proved in the browser where the phone's AAC encoder is missing: a short video-only file through the app's own writer. */
    muxProbe: async (o: { preset?: string; long?: number; ms?: number } = {}) => {
      const first = project.main[0];
      if (!first) return null;
      const mini: Project = { ...structuredClone(project), main: [{ ...structuredClone(first), out: Math.min(first.out, first.in + (o.ms ?? 2000)), next: { kind: 'cut', len: 0 }, grade: flatGrade() }], overlays: [], music: [], voice: [], subs: [] };
      delete mini.main[0]!.lut;
      const r = await exportVideo(mini, { preset: o.preset ?? 'wide', quality: 0, blobOf: (id) => blobFor(id, false), path: 'webcodecs', silent: true, long: o.long ?? 320 });
      (videoState as Record<string, unknown>).probe = r;
      await fellBack(r);
      return { bytes: r.bytes, frames: r.frames, w: r.w, h: r.h, path: r.path, durationMs: r.durationMs, fellBack: r.fellBack ?? '' };
    },
    lastBlob: (which: 'export' | 'probe' | 'forced') => ((videoState as Record<string, unknown>)[which === 'export' ? 'lastExport' : which] as Exported | undefined)?.blob ?? null,
    holdOriginal: (on: boolean) => {
      if (player) {
        player.ungraded = on;
        player.draw();
      }
    },
    addFiles: (f: File[]) => addFiles(f),
    pick,
    select: (id: string) => ((sel = id), renderAll()),
    commit: (p: Project) => commit(p),
    maxTexture: () => player?.gpu.maxTexture ?? 0,
    drawn: () => player?.drawn ?? 0,
    still: () => reduced(),
    /** VIDEO 2: the centre of the near-white mark on the picture as drawn (the spec's own measure of a shake), or null. */
    whiteCentre: () => player?.gpu.whiteCentre() ?? null,
    /** The transform the export would draw the main clip with at `t`: the same plan and spec it uses. */
    exportSpecAt: (t: number) => {
      const plan = planFrame(project, t);
      const spec = buildSpec(plan, project, () => ({ el: canvas, w: 1280, h: 720 }), null);
      const m = spec.main;
      return m ? { x: m.x, y: m.y, rot: m.rot, scale: m.scale } : null;
    },
    /** Make a mark's steady record from outside (the spec's reading of what was measured). */
    crunchDead: () => crunch.dead,
  };
  // (the page's handle for specs may be made a moment after a screen opened straight from the address)
  let hooks = 0;
  const hook = () => {
    if (w.__ghosty) w.__ghosty.video = api;
    else if (hooks++ < 200 && !stopped) setTimeout(hook, 50);
  };
  hook();

  const el = h('div.vdsheet', root);
  void (async () => {
    await refreshKept();
    renderAll();
    pick('trim');
  })();
  return {
    el,
    async start(o) {
      videoState.open = true;
      await refreshKept();
      const liveOnes = kept.filter((k) => !k.gone);
      if (o.open) await openProject(o.open);
      else if (project.main.length === 0 && liveOnes[0]) await openProject(liveOnes[0].id);
      else renderAll();
      pick(tool);
      if (o.files?.length) await addFiles(o.files);
      offlineLine();
    },
    stop() {
      stopped = true;
      videoState.open = false;
      recording?.stop();
      steadying && (steadying.cancelled = true);
      bestBusy && (bestBusy.cancelled = true);
      crunch.close();
      player?.pause();
      void autosave.flush();
      for (const f of stopFns) f();
      player?.dispose();
      feeder.dispose();
      feeder.root.remove();
      for (const u of posters.values()) URL.revokeObjectURL(u);
      void stopped;
    },
  };
}

// ---------------------------------------------------------------- the doors (the library, the chat, the hub)
let mounted: { take(): void } | null = null;
/** Open the editor, with these clips if there are any (the library's OPEN IN VIDEO, a clip dropped on the chat). */
export async function openVideo(files: File[] = []): Promise<void> {
  handTo(files);
  const { go } = await import('../shell/tabs');
  go('video');
  mounted?.take();
}
export const registerMounted = (m: { take(): void } | null): void => {
  mounted = m;
};
