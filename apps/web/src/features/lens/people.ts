/**
 * PEOPLE (OWNER-ISSUES 55, 56): the Machine's eyes, on his phone and nowhere else.
 *
 *  - HIM: ENROL ME takes five looks from the front camera (three at least) and keeps them on this phone; from then on,
 *    with PEOPLE open and him in the picture, a thin WHITE box with the label ADMIN — his, nobody else's — and "It's you."
 *    once a session ("I think it's you." below certainty). "Who am I?" → "Admin."; "is this me?" → "Yes." — a word.
 *  - PEOPLE HE INTRODUCES IN PERSON: with someone in the picture, "Ghosty, this is Sam" (typed or said, here or in the
 *    chat) → three looks of that face, kept on this phone with the name. Next time, here only: a thin box with "Sam", or
 *    "Sam?" and "I think it's Sam" below certainty; "who's this?" → "Sam.", else "I don't know them: introduce us."
 *  - Nobody else, ever: a face nobody introduced gets no name and no guess; nothing here runs on God's Eye, CCTV, a web
 *    picture, a screenshot or a photo (vision/faces.ts takes only the live camera). Faces never leave the phone: not to
 *    the brain (these turns never reach the chat, and the Lens tells the brain only that PEOPLE is open), not to
 *    BACKUP & RESTORE; each one goes in one tap in Settings → PRIVACY → FACES.
 */
import { clear, h } from '../../core/dom';
import { settings } from '../../state/app';
import { button, toast } from '../../ui/components';
import { listen, speak, voiceSupport } from '../../assistant/voice';
import { bestMatch, faceAsked, iou, introAsked, steadyLooks, type FaceMatch, type KnownFace } from '../../vision/facemath';
import { faces, FACES_SIZE, type FaceSeen } from '../../vision/faces';
import { addPerson, knownFaces, saveMe } from '../../vision/facestore';
import type { LensContext, Mode } from './index';
// [restc] CHECK IT'S LIVE: a quick challenge before a face is saved (features/lens/liveness.ts)
import { confirmLive, liveEye, liveState, needsLive } from './liveness';

/**
 * [cards] Someone he introduced, recognised for sure: their PERSON card in the chat once a session — only when the guardian
 * knows them (his named person, a person whose car he named); anyone else gets nothing. The face never leaves the phone:
 * the card holds what GUARDIAN shows, not a picture (BRIEF-SIDEWAYS 2b).
 */
const carded = new Set<string>();
function seenPerson(name: string): void {
  const k = name.toLowerCase();
  if (carded.has(k)) return;
  carded.add(k);
  void import('../core/cards')
    .then((c) => {
      const card = c.mayBringUp() ? c.personNow(name) : null;
      if (card) c.postCard(card);
    })
    .catch(() => undefined);
}

/** One face followed from look to look: where it is, its numbers (and when), who it is. */
interface Track {
  box: FaceSeen['box'];
  emb?: number[];
  embAt: number;
  match: FaceMatch | null;
}

/** What PEOPLE is doing, for the specs (window.__ghosty.lens.people) — on this phone only, like everything here. */
export const peopleState = {
  enrolled: false,
  looks: 0,
  known: 0,
  faces: [] as { label: string; me: boolean; sure: boolean }[],
  said: '',
  enrolling: false,
  /** [restc] the live-face check: running, its challenge, its last verdict (numbers only, no face). */
  live: liveState,
};

/** "It's you." once a session. */
let greeted = false;
/** The mode while it is open (faceTurn answers only then). */
let open: { turn(text: string, voice: boolean): Promise<boolean> } | null = null;
/** RE-ENROL in Settings → PRIVACY → FACES: PEOPLE starts enrolling as it opens. */
let enrolOnOpen = false;
export function enrolNext(): void {
  enrolOnOpen = true;
}

/** Look again this often (ms), and a face's numbers are fresh this long. */
const LOOK_MS = 350;
const FRESH_MS = 1500;

const WHITE = '#ffffff';
const KNOWN = '#62e4ff';

export function createPeopleMode(L: LensContext): Mode {
  const S = L.state;
  let known: KnownFace[] = [];
  let tracks: Track[] = [];
  let lastLook = 0;
  let busy = false;
  let visit = 0;
  let loadingModels: Promise<boolean> | null = null;

  const say = h('div.pplsay', { role: 'status', 'aria-live': 'polite' });
  const lead = h('div.note.pplnote');
  const enrolBtn = button('ENROL ME', () => void enrol(), 'warn');
  const field = h('input.pplin', { placeholder: 'this is Sam · who’s this?', autocomplete: 'off', enterKeyHint: 'send', 'aria-label': 'Talk to PEOPLE' });
  const sendBtn = button('SAY', () => void typed());
  const micBtn = button('MIC', () => void heard());
  micBtn.setAttribute('aria-label', 'Say it (heard on this phone only)');
  const askRow = h('div.row.pplask', field, sendBtn, micBtn);
  const priv = h('div.note.pplpriv', 'Faces stay on this phone: never sent to my brain, never in backups. I only see while I’m open. Delete them any time in Settings → PRIVACY → FACES.');
  const root = h('div.stackf.people', say, lead, enrolBtn, askRow, priv);

  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void typed();
  });

  const speakIt = (text: string, voice: boolean) => {
    say.textContent = text;
    peopleState.said = text;
    // the phone's own voice only: not even the words go to the brain's voice
    if (voice || settings.get().speak) void speak(text, { here: true }).catch(() => undefined);
  };

  const refresh = async () => {
    known = await knownFaces();
    const me = known.find((p) => p.me);
    peopleState.enrolled = !!me;
    peopleState.looks = me?.looks.length ?? 0;
    peopleState.known = known.filter((p) => !p.me).length;
    enrolBtn.hidden = !!me;
    const others = peopleState.known;
    lead.textContent = me
      ? `I know your face${others ? ` and ${others} ${others === 1 ? 'person' : 'people'} you introduced` : ''}. Point the camera at someone and say “this is …” to introduce them.`
      : `ENROL ME takes five looks at you with the front camera (the face models load once, ${FACES_SIZE}). Then I’ll know you when PEOPLE is open.`;
  };

  /** The face models, once (the status line says what is loading). */
  const models = (): Promise<boolean> =>
    (loadingModels ??= faces
      .load((t) => L.status(t, 'mid'))
      .then(() => true)
      .catch((e: unknown) => {
        loadingModels = null;
        L.status(String((e as Error)?.message ?? e), 'off');
        return false;
      }));

  /** Which faces get their numbers this look: at most one, the biggest that has none fresh (one face's numbers take a moment). */
  const pickFor = (now: number) => (fs: FaceSeen[]): number[] => {
    const need = fs
      .map((f, i) => {
        const t = tracks.find((x) => iou(x.box, f.box) > 0.3);
        return { i, area: f.box.w * f.box.h, fresh: !!t?.emb && now - t.embAt < FRESH_MS };
      })
      .filter((x) => !x.fresh)
      .sort((a, b) => b.area - a.area);
    return need.slice(0, 1).map((x) => x.i);
  };

  /** One look: the faces followed, matched, drawn, and "It's you." when it is him. */
  const step = async (now: number) => {
    if (!(await models())) return;
    const look = await faces.look(L.camera, pickFor(now));
    const next: Track[] = look.faces.map((f) => {
      const prev = tracks.find((x) => iou(x.box, f.box) > 0.3);
      if (f.emb) return { box: f.box, emb: f.emb, embAt: now, match: bestMatch(f.emb, known) };
      return { box: f.box, emb: prev?.emb, embAt: prev?.embAt ?? 0, match: prev?.match ?? null };
    });
    tracks = next;
    paint();
    const me = tracks.find((t) => t.match?.me);
    if (me?.match?.sure && !greeted) {
      greeted = true;
      speakIt('It’s you.', false);
    } else if (me && !me.match?.sure && !greeted) say.textContent = peopleState.said = 'I think it’s you.';
    L.status(tracks.length ? `${tracks.length} face${tracks.length === 1 ? '' : 's'} in view` : 'looking for faces', 'ok');
  };

  /** The boxes: ADMIN in thin white for him, a name for someone he introduced, faint corners for anyone else (no name, no guess). */
  const paint = () => {
    const c = L.overlay();
    if (!c) return;
    peopleState.faces = [];
    for (const t of tracks) {
      const v = L.viewBox(t.box);
      const m = t.match;
      if (!m) {
        // nobody he introduced: corners only, no label
        c.strokeStyle = 'rgba(255,255,255,.35)';
        c.lineWidth = 1;
        c.setLineDash([]);
        const k = Math.min(v.w, v.h) * 0.18;
        c.beginPath();
        for (const [x, y, dx, dy] of [[v.x, v.y, 1, 1], [v.x + v.w, v.y, -1, 1], [v.x, v.y + v.h, 1, -1], [v.x + v.w, v.y + v.h, -1, -1]] as const) {
          c.moveTo(x + dx * k, y);
          c.lineTo(x, y);
          c.lineTo(x, y + dy * k);
        }
        c.stroke();
        peopleState.faces.push({ label: '', me: false, sure: false });
        continue;
      }
      const label = m.me ? (m.sure ? 'ADMIN' : 'ADMIN?') : m.sure ? m.name : `${m.name}?`;
      const color = m.me ? WHITE : KNOWN;
      c.strokeStyle = color;
      c.lineWidth = 1.5;
      c.setLineDash(m.sure ? [] : [5, 4]);
      c.strokeRect(v.x, v.y, v.w, v.h);
      c.setLineDash([]);
      c.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
      const tw = c.measureText(label).width + 12;
      const ty = v.y >= 20 ? v.y - 20 : v.y + 2;
      c.fillStyle = m.me ? WHITE : 'rgba(2, 7, 13, .82)';
      c.fillRect(v.x - 0.75, ty, tw, 18);
      c.fillStyle = m.me ? '#05080c' : color;
      c.fillText(label, v.x + 5.25, ty + 13);
      peopleState.faces.push({ label, me: m.me, sure: m.sure });
      if (!m.me && m.sure) seenPerson(m.name);
    }
  };

  /** Make sure the camera is on and the face models are here; `front`: turn to the front camera (enrolling himself). */
  const ready = async (front: boolean): Promise<boolean> => {
    if (S.camera !== 'on') {
      if (front) S.facing = 'user';
      await L.startCamera();
    } else if (front && S.facing !== 'user') await L.flip();
    if (S.camera !== 'on') return false;
    return models();
  };

  /** A fresh look with every face's numbers (at most three), from this very frame. */
  const fullLook = async (): Promise<Track[]> => {
    const look = await faces.look(L.camera, (fs) => fs.map((_, i) => i).slice(0, 3));
    const now = performance.now();
    tracks = look.faces.map((f) => ({ box: f.box, emb: f.emb, embAt: now, match: f.emb ? bestMatch(f.emb, known) : null }));
    paint();
    return tracks;
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const PROMPTS = ['Look at the screen', 'Turn a little to your left', 'Now a little to your right', 'Chin up a touch', 'Back to the middle'];

  /** ENROL ME: five looks at him from the front camera (three at least), kept on this phone. */
  const enrol = async () => {
    if (peopleState.enrolling) return;
    peopleState.enrolling = true;
    const mine = visit;
    try {
      if (!(await ready(true))) return void toast('The camera or the face models did not start', 'warn');
      // [restc] his face becomes ADMIN: a live face first (a photo held up is not him), unless he turned the check off
      if (needsLive('enrol') && !(await confirmLive('enrol', L.camera, { who: 'me', say: (t) => speakIt(t, false), alive: () => mine === visit, status: (t) => L.status(t, 'mid') }))) return;
      const looks: number[][] = [];
      const until = Date.now() + 30_000;
      while (looks.length < 5 && Date.now() < until && mine === visit) {
        say.textContent = `${PROMPTS[looks.length]}…`;
        await wait(650);
        const look = await faces.look(L.camera, (fs) => (fs.length === 1 ? [0] : []));
        const f = look.faces.length === 1 ? look.faces[0] : undefined;
        if (!f?.emb) {
          L.status(look.faces.length > 1 ? 'just you in the picture, please' : 'I can’t see your face yet', 'mid');
          continue;
        }
        if (f.box.w < look.frame.w * 0.15) {
          L.status('come a little closer', 'mid');
          continue;
        }
        looks.push(f.emb);
        L.status(`${looks.length} of 5 looks`, 'ok');
      }
      if (mine !== visit) return;
      const kept = steadyLooks(looks);
      if (kept.length < 3) return speakIt('I didn’t get a clear enough look. Try again with your face filling more of the picture.', false);
      await saveMe(kept);
      greeted = false;
      await refresh();
      speakIt('Done. I know your face now. It stays on this phone, and I only see while I’m open.', false);
    } catch (e) {
      toast(String((e as Error)?.message ?? e), 'warn');
    } finally {
      peopleState.enrolling = false;
    }
  };

  /** "This is Sam": three looks of the one face in the picture that is not him, kept on this phone with the name. */
  const introduce = async (name: string, voice: boolean): Promise<void> => {
    let ts = await fullLook();
    let others = ts.filter((t) => !t.match?.me);
    if (!ts.length) return speakIt('I can’t see a face. Point the camera at them, then tell me.', voice);
    if (!others.length) return speakIt('That’s you — I know you.', voice);
    if (others.length > 1) return speakIt('I can see more than one face: introduce them one at a time.', voice);
    const already = others[0]!.match;
    if (already?.sure) return speakIt(already.name.toLowerCase() === name.toLowerCase() ? `I know them already: ${already.name}.` : `I know them as ${already.name}. If that’s wrong, forget ${already.name} in Settings → PRIVACY → FACES first.`, voice);
    // [restc] a person is saved: a live face first, the one being introduced (the face nearest where they were)
    const mine = visit;
    const at = others[0]!.box;
    if (needsLive('introduce') && !(await confirmLive('introduce', L.camera, { who: 'them', near: () => ({ x: at.x + at.w / 2, y: at.y + at.h / 2 }), say: (t) => speakIt(t, voice), alive: () => mine === visit, status: (t) => L.status(t, 'mid') }))) return;
    const looks: number[][] = [others[0]!.emb!].filter(Boolean);
    for (let i = 0; i < 4 && looks.length < 3; i++) {
      await wait(450);
      ts = await fullLook();
      others = ts.filter((t) => !t.match?.me);
      if (others.length === 1 && others[0]!.emb) looks.push(others[0]!.emb);
    }
    const kept = steadyLooks(looks);
    if (kept.length < 2) return speakIt('I didn’t get a clear look at them: try again with their face nearer the camera.', voice);
    await addPerson(name, kept);
    await refresh();
    tracks = [];
    speakIt(`Hello, ${name}. I’ll know you next time — on this phone only.`, voice);
  };

  /** The questions, answered in a word from this very look. */
  const answer = async (q: 'me' | 'isme' | 'who', voice: boolean): Promise<void> => {
    const ts = await fullLook();
    if (!ts.length) return speakIt('I can’t see a face.', voice);
    const enrolled = known.some((p) => p.me);
    const me = ts.find((t) => t.match?.me);
    if (q === 'who') {
      const other = ts.filter((t) => !t.match?.me).sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0];
      if (!other) return speakIt('That’s you.', voice);
      const m = other.match;
      return speakIt(m ? (m.sure ? `${m.name}.` : `I think it’s ${m.name}.`) : 'I don’t know them: introduce us.', voice);
    }
    // "who am I?" / "is this me?": the face nearest the camera
    const front = [...ts].sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0]!;
    const m = front.match;
    if (!enrolled && !m) return speakIt('I don’t know your face yet: tap ENROL ME.', voice);
    if (m?.me) return speakIt(q === 'me' ? (m.sure ? 'Admin.' : 'Admin, I think.') : m.sure ? 'Yes.' : 'I think so.', voice);
    if (m) return speakIt(q === 'me' ? (m.sure ? `${m.name}.` : `${m.name}, I think.`) : `No. That’s ${m.name}.`, voice);
    return speakIt(q === 'me' ? 'I don’t know you.' : me ? 'Yes.' : 'No.', voice);
  };

  /** His words, here or from the chat: true when they were for PEOPLE (and answered here, never in the chat). */
  const turn = async (text: string, voice: boolean): Promise<boolean> => {
    const name = introAsked(text);
    const q = name ? null : faceAsked(text);
    if (!name && !q) return false;
    if (S.camera !== 'on' || !(await models())) {
      speakIt('Open the camera first (START), then tell me.', voice);
      return true;
    }
    if (name) await introduce(name, voice);
    else await answer(q!, voice);
    return true;
  };

  const typed = async () => {
    const t = field.value.trim();
    if (!t) return void field.focus();
    field.value = '';
    if (!(await turn(t, false))) speakIt('Here I answer “this is …”, “who’s this?” and “who am I?”. Anything else, ask me in the chat.', false);
  };

  const heard = async () => {
    // on this phone only: the recording never goes to the brain's recogniser
    if (!voiceSupport.browserStt) return void toast('I can’t hear on the phone alone in this browser: type it instead.', 'warn');
    try {
      const t = await listen(false, (x) => (say.textContent = x));
      if (t && !(await turn(t, true))) speakIt('Say “this is …”, “who’s this?” or “who am I?”.', true);
    } catch (e) {
      toast(String((e as Error)?.message ?? e), 'warn');
    }
  };

  return {
    id: 'people',
    enter() {
      visit++;
      clear(L.panel, root);
      say.textContent = '';
      tracks = [];
      open = { turn };
      void refresh().then(() => {
        if (enrolOnOpen) {
          enrolOnOpen = false;
          void enrol();
        } else if (peopleState.enrolled && S.camera === 'on') void models();
      });
      L.status(S.camera === 'on' ? 'looking for faces' : 'camera off · START to open it', S.camera === 'on' ? 'ok' : undefined);
    },
    leave() {
      visit++;
      open = null;
      tracks = [];
      peopleState.faces = [];
      // the face models go with the mode (their memory back); the files stay in the cache
      faces.release();
      liveEye.release();
      loadingModels = null;
    },
    tick(now) {
      if (busy || peopleState.enrolling || liveState.running || now - lastLook < LOOK_MS) return;
      lastLook = now;
      busy = true;
      void step(now)
        .catch((e: unknown) => L.status(String((e as Error)?.message ?? e), 'off'))
        .finally(() => (busy = false));
    },
  };
}

/**
 * His words from the chat while PEOPLE is open with the camera on (assistant/session.ts asks first, before the stop and
 * the raising readings): "this is Sam", "who's this?", "who am I?" are answered here, on the phone, and never go to the
 * brain. false: not for PEOPLE (or PEOPLE is not open).
 */
export async function faceTurn(text: string, voice = false): Promise<boolean> {
  if (!open) return false;
  return open.turn(text, voice);
}

/** PEOPLE is open: the main microphone hears on the phone only (assistant core voice turn). */
export const peopleOpen = (): boolean => !!open;
