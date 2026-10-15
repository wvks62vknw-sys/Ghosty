/**
 * Self-study: Ghosty keeps reading on its own, without AI and without keys. Once an hour (a
 * repeating background job, switchable in the Library tab) it takes the next topic — first
 * questions the owner asked that its library couldn't answer, then a built-in curriculum —
 * finds a good source (Wikipedia, MDN for web/JS topics, arXiv for AI research) and saves
 * it to the library for good. One source per session keeps each run small (free-plan CPU
 * and database limits), and the log of what it studied is a note in the library too.
 */
import { importSource } from './importers';
import type { Library } from './store';

export interface StudyState {
  on: boolean;
  /** Next curriculum topic. */
  i: number;
  /** Questions the library couldn't answer, newest last. */
  gaps: string[];
  last?: { at: number; topic: string; title?: string; passages?: number; error?: string };
  sessions: number;
}

export const STUDY_KEY = 'study:state';
const UA = 'Ghosty/2.0 (personal assistant; https://github.com/wvks62vknw-sys/Ghosty)';

type Src = 'wiki' | 'mdn' | 'arxiv';
/** The curriculum: coding, games, systems, security, maths and AI — what makes Ghosty a better builder. */
export const CURRICULUM: [string, Src][] = [
  ['JavaScript event loop', 'mdn'], ['Promise', 'mdn'], ['async function', 'mdn'], ['Canvas API', 'mdn'], ['requestAnimationFrame', 'mdn'],
  ['WebGL API', 'mdn'], ['Web Audio API', 'mdn'], ['Gamepad API', 'mdn'], ['Pointer events', 'mdn'], ['Web Workers API', 'mdn'],
  ['IndexedDB API', 'mdn'], ['Fetch API', 'mdn'], ['CSS Grid layout', 'mdn'], ['CSS flexbox', 'mdn'], ['Content Security Policy', 'mdn'],
  ['Game programming', 'wiki'], ['Game loop', 'wiki'], ['Collision detection', 'wiki'], ['A* search algorithm', 'wiki'], ['Procedural generation', 'wiki'],
  ['Perlin noise', 'wiki'], ['Entity component system', 'wiki'], ['Quadtree', 'wiki'], ['Verlet integration', 'wiki'], ['Sprite (computer graphics)', 'wiki'],
  ['Minimax', 'wiki'], ['Alpha–beta pruning', 'wiki'], ['Finite-state machine', 'wiki'], ['Tetris', 'wiki'], ['Breakout clone', 'wiki'],
  ['Binary search algorithm', 'wiki'], ['Hash table', 'wiki'], ['Dynamic programming', 'wiki'], ['Dijkstra\'s algorithm', 'wiki'], ['Union–find', 'wiki'],
  ['Trie', 'wiki'], ['Heap (data structure)', 'wiki'], ['Red–black tree', 'wiki'], ['Big O notation', 'wiki'], ['Regular expression', 'wiki'],
  ['Test-driven development', 'wiki'], ['Software design pattern', 'wiki'], ['SOLID', 'wiki'], ['Code refactoring', 'wiki'], ['Version control', 'wiki'],
  ['HTTP', 'wiki'], ['WebSocket', 'wiki'], ['REST', 'wiki'], ['OAuth', 'wiki'], ['Cross-site scripting', 'wiki'],
  ['SQL injection', 'wiki'], ['Public-key cryptography', 'wiki'], ['Database index', 'wiki'], ['ACID', 'wiki'], ['CAP theorem', 'wiki'],
  ['Linear algebra', 'wiki'], ['Quaternion', 'wiki'], ['Bézier curve', 'wiki'], ['Fast Fourier transform', 'wiki'], ['Bayes\' theorem', 'wiki'],
  ['Transformer (deep learning architecture)', 'wiki'], ['Attention (machine learning)', 'wiki'], ['Retrieval-augmented generation', 'wiki'], ['Reinforcement learning', 'wiki'], ['Large language model', 'wiki'],
  ['chain-of-thought prompting large language models', 'arxiv'], ['program synthesis large language models code generation', 'arxiv'], ['self-refine iterative refinement feedback', 'arxiv'], ['tool use language model agents', 'arxiv'], ['retrieval augmented generation knowledge-intensive', 'arxiv'],
];

const looksLikeQuestion = (t: string) => /\?\s*$/.test(t) || /^(what|how|why|who|when|where|which|explain|tell me about|define|describe)\b/i.test(t.trim());

/** Remember a question the library couldn't answer, to study it later. */
export async function noteGap(storage: DurableObjectStorage, question: string): Promise<void> {
  const q = question.replace(/\s+/g, ' ').trim();
  if (q.length < 8 || q.length > 200 || !looksLikeQuestion(q)) return;
  const st = await loadStudy(storage);
  if (!st.on || st.gaps.some((g) => g.toLowerCase() === q.toLowerCase())) return;
  st.gaps = [...st.gaps, q].slice(-20);
  await storage.put(STUDY_KEY, st);
}

export async function loadStudy(storage: DurableObjectStorage): Promise<StudyState> {
  return { on: true, i: 0, gaps: [], sessions: 0, ...((await storage.get<StudyState>(STUDY_KEY)) ?? {}) };
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${new URL(url).hostname} answered ${r.status}`);
  return (await r.json()) as T;
}

/** Find one good source for a topic: a URL or arXiv id that importSource can read. */
export async function findSource(topic: string, src: Src): Promise<string | null> {
  if (src === 'mdn') {
    const j = await getJson<{ documents?: { mdn_url: string }[] }>(`https://developer.mozilla.org/api/v1/search?locale=en-US&size=1&q=${encodeURIComponent(topic)}`);
    const u = j.documents?.[0]?.mdn_url;
    if (u) return `https://developer.mozilla.org${u}`;
  }
  if (src === 'arxiv') {
    const r = await fetch(`https://export.arxiv.org/api/query?max_results=1&sortBy=relevance&search_query=${encodeURIComponent(`all:${topic}`)}`, { headers: { 'User-Agent': UA } });
    const id = r.ok ? (await r.text()).match(/<id>https?:\/\/arxiv\.org\/abs\/(\d{4}\.\d{4,5})(?:v\d+)?<\/id>/)?.[1] : undefined;
    if (id) return id;
  }
  const j = await getJson<{ query?: { search?: { title: string }[] } }>(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(topic)}`);
  const t = j.query?.search?.[0]?.title;
  return t ? `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(t.replace(/ /g, '_'))}` : null;
}

/** One study session: one topic, one source, saved to the library. Never throws. */
export async function studySession(storage: DurableObjectStorage, lib: Library): Promise<StudyState> {
  const st = await loadStudy(storage);
  if (!st.on || !lib.available) return st;
  const gap = st.gaps.shift();
  const [topic, src]: [string, Src] = gap ? [gap, /\b(js|javascript|css|html|dom|browser|web api|canvas|webgl)\b/i.test(gap) ? 'mdn' : 'wiki'] : CURRICULUM[st.i % CURRICULUM.length]!;
  if (!gap) st.i = (st.i + 1) % CURRICULUM.length;
  st.sessions++;
  try {
    const source = await findSource(topic, src);
    if (!source) throw new Error('no source found');
    const already = lib.list().some((d) => d.source === source || (/^\d{4}\./.test(source) && d.source.includes(source)));
    if (already) {
      st.last = { at: Date.now(), topic, title: 'already in the library' };
    } else {
      const r = await importSource(lib, source);
      st.last = { at: Date.now(), topic, title: r.doc.title, passages: r.passages };
      await lib.note('notes_study', "Ghosty's study log", 'notes', { heading: `Studied: ${topic}`, text: `${new Date().toISOString().slice(0, 16).replace('T', ' ')} — studied "${topic}" from ${source}: saved "${r.doc.title}" (${r.passages} passages).` });
    }
  } catch (e) {
    st.last = { at: Date.now(), topic, error: String((e as Error)?.message ?? e).slice(0, 200) };
    if (gap) st.gaps.push(gap); // try that question again later
    st.gaps = st.gaps.slice(-20);
  }
  await storage.put(STUDY_KEY, st);
  return st;
}
