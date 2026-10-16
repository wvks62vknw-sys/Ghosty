/**
 * General programming knowledge Ghosty can look up with `study`: languages, the web
 * platform, algorithms and architecture. Dense on purpose — each playbook is the
 * cheat-sheet a senior engineer keeps in their head.
 */
import type { Playbook } from './types';

export const CODING: Playbook[] = [
  {
    id: 'algorithms',
    title: 'Algorithms and data structures cheat-sheet (with when to use what)',
    tags: ['algorithm', 'algorithms', 'data structure', 'sort', 'search', 'graph', 'bfs', 'dfs', 'dijkstra', 'pathfinding', 'a*', 'dynamic programming', 'recursion', 'complexity', 'big o', 'tree', 'heap', 'hash'],
    body: `COMPLEXITY: O(1) hash lookup · O(log n) binary search/heap op · O(n) one pass · O(n log n) sort · O(n²) nested loops (fine up to ~5,000 items) · O(2ⁿ) brute force subsets (n ≤ 20).

PICK THE STRUCTURE
- Lookup by key → Map / object / dict (O(1)). Membership → Set.
- Ordered, append/pop at end → array (stack). Queue → array with a head index (shift() is O(n)), or deque in Python.
- Always need the smallest/largest next → binary heap (priority queue).
- Ranges/sorted data → sorted array + binary search.
- Relationships → graph as adjacency list: Map<node, neighbours[]>.
- Grid worlds → 2D array or flat array index = y * cols + x.

CORE ALGORITHMS
- Binary search (sorted array, find first index where pred is true):
  lo = 0, hi = n; while (lo < hi) { mid = (lo + hi) >> 1; if (pred(a[mid])) hi = mid; else lo = mid + 1; } return lo;
- BFS (shortest path in steps, unweighted grid/graph): queue of start; seen set; pop, push unseen neighbours with prev[n] = cur; rebuild the path from prev.
- DFS (explore everything, flood fill, connected components, cycle detection): recursion or an explicit stack.
- Dijkstra (weighted, non-negative): dist map, min-heap of [dist, node]; pop smallest, skip if stale, relax neighbours.
- A* (grid pathfinding for games): Dijkstra with priority g + h, h = Manhattan distance (4-way) or octile (8-way). Cap iterations to stay responsive.
- Topological sort (dependencies/build order): Kahn's algorithm with in-degree counts.
- Union-find (grouping, Kruskal, connectivity): parent array with path compression.
- Two pointers / sliding window: subarray sums, longest substring without repeats.
- Prefix sums: range sums in O(1) after O(n) setup.
- Dynamic programming: define state (dp[i] = best answer for the first i items), transition, base case; memoise recursion or fill a table. Classics: knapsack, longest common subsequence, edit distance, coin change, grid paths.
- Backtracking (sudoku, n-queens, word search): choose → recurse → undo; prune early.
- Minimax + alpha-beta (turn-based game AI): score terminal states, depth limit, order moves best-first.
- Randomness: Fisher–Yates shuffle; seeded RNG for reproducible levels (mulberry32: a += 0x6D2B79F5; t = Math.imul(a ^ a >>> 15, 1 | a); …).
- Sorting: use the built-in sort with a comparator (a, b) => a - b (numbers!). JS default sort is by string.

PITFALLS: off-by-one at boundaries (< vs <=), integer division (Math.floor / //), floating point equality (compare with an epsilon), mutating an array while iterating it, recursion depth on big inputs (use an explicit stack), modifying a shared default object.`,
  },
  {
    id: 'javascript',
    title: 'Modern JavaScript: the essentials and the traps',
    tags: ['javascript', 'js', 'es6', 'async', 'await', 'promise', 'closure', 'array methods', 'dom', 'events', 'json', 'class', 'module'],
    body: `- Variables: const by default, let when reassigned, never var. === and !== only.
- Arrays: map (transform), filter (keep), find / findIndex (first match → undefined / -1), some / every, reduce((acc, x) => …, init), flatMap, includes, slice (copy) vs splice (mutates), sort mutates (copy first: [...a].sort()), at(-1) for last.
- Objects: spread {...a, b: 1} (shallow), Object.entries / keys / values / fromEntries, optional chaining a?.b?.c, nullish a ?? fallback (keeps 0 and ''), || treats 0/'' as missing.
- Copies: structuredClone(obj) for deep copies of plain data.
- Strings: template literals, padStart, includes, split/join, trim, localeCompare for sorting text, toLocaleString() for numbers with separators, Intl.NumberFormat / Intl.DateTimeFormat for currency and dates.
- Numbers: Number(x) (NaN on garbage) vs parseInt(x, 10) / parseFloat; Number.isFinite; toFixed returns a string; Math.round(x * 100) / 100 for 2 decimals as a number.
- Dates: Date.now() ms; new Date(ms); months are 0-based; store timestamps (ms) and format at display time; time zones via toLocaleString(undefined, { timeZone }).
- Functions: arrow functions keep the outer this; default params; rest (...args); closures capture variables (in loops use let/const, not var).
- Async: async/await with try/catch; Promise.all for parallel, Promise.allSettled when some may fail; never forget await (a Promise is always truthy); setTimeout(fn, ms) once, setInterval repeats — always keep the id to clear it.
- fetch: const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); const data = await r.json(); — fetch only rejects on network failure. Add a timeout with AbortController.
- JSON: JSON.parse throws on bad input — wrap in try/catch; JSON.stringify(x, null, 2) to pretty print; Maps/Sets/Dates don't round-trip.
- Classes: class A { #private = 1; constructor() {} method() {} static make() {} get x() {} }.
- Events: el.addEventListener('click', fn); e.preventDefault(); event delegation: one listener on a parent + e.target.closest('.item').
- DOM: document.createElement, el.textContent (safe), el.append(...), el.replaceChildren(...), classList.add/remove/toggle, dataset, querySelector (may be null).
- Performance: avoid layout thrashing (read sizes, then write styles); requestAnimationFrame for animation; debounce input handlers (setTimeout reset); use DocumentFragment or replaceChildren for big lists.
- Errors: throw new Error('clear message'); catch where you can do something useful; show the user a message instead of failing silently.`,
  },
  {
    id: 'css-layout',
    title: 'CSS: layout, responsive design and making things look good',
    tags: ['css', 'style', 'layout', 'flexbox', 'grid', 'responsive', 'mobile', 'design', 'animation', 'look', 'theme', 'beautiful'],
    body: `- Box model: * { box-sizing: border-box } so width includes padding and border.
- Flexbox (one direction): display:flex; gap: 8px; align-items:center; justify-content:space-between; flex:1 to fill; flex-wrap:wrap for chips/buttons.
- Grid (two directions): display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:12px — a responsive card grid with no media queries.
- Centering anything: display:grid; place-items:center.
- Responsive: fluid widths (max-width + width:100%), clamp() for font sizes (font-size: clamp(14px, 2vw, 18px)), @media (max-width: 600px) { … } for phone tweaks. Always add <meta name="viewport" content="width=device-width,initial-scale=1">.
- Full-height app: html, body { height: 100% } or min-height: 100dvh (dynamic viewport on phones).
- Scrolling areas: overflow:auto on the inner container, never on body when the layout is fixed.
- Positioning: position:relative parent + position:absolute child; position:fixed for overlays; position:sticky; top:0 for sticky headers. z-index works only on positioned elements.
- Colours: define once as custom properties (:root { --accent: #5ce1ff }) and use var(--accent). Ghosty's look: background #02070d, text #e6f6ff, accent #5ce1ff, good #52f2b5, warn #ffd24d, bad #ff4d6a; thin borders rgba(92,225,255,.25); uppercase letter-spaced labels.
- Polish: consistent spacing scale (4/8/12/16/24), one or two font sizes per screen, transitions (transition: transform .15s, opacity .15s), hover AND active states, focus-visible outlines for keyboard users, large touch targets (≥ 40px).
- Animation: prefer transform and opacity (GPU-friendly); @keyframes for loops; respect prefers-reduced-motion.
- Text: line-height 1.4–1.6 for reading; text-overflow: ellipsis needs white-space:nowrap; overflow:hidden.`,
  },
  {
    id: 'web-apis',
    title: 'Browser APIs: canvas, audio, storage, timers, sensors, workers',
    tags: ['canvas', 'audio', 'storage', 'localstorage', 'indexeddb', 'geolocation', 'notifications', 'clipboard', 'speech', 'webgl', 'worker', 'requestanimationframe', 'browser', 'api'],
    body: `- Canvas 2D: ctx = canvas.getContext('2d'); set canvas.width/height in device pixels (× devicePixelRatio) and ctx.scale(dpr, dpr) for sharpness; fillRect, beginPath/arc/fill, strokeStyle/lineWidth, fillText, drawImage, save/restore around transforms, globalAlpha, shadowBlur for glow. Clear each frame.
- Animation: requestAnimationFrame(loop) with dt = (t - last) / 1000 capped (tab switching gives huge dt).
- Web Audio: new AudioContext() only after a user gesture; OscillatorNode for beeps, GainNode for volume envelopes; AudioBuffer for noise; <audio> for music files.
- Storage: localStorage (strings, ~5 MB, synchronous; JSON.stringify objects); IndexedDB for big data; both unavailable in sandboxed widgets (use GK.save, in-memory).
- Clipboard: await navigator.clipboard.writeText(text) (needs a user gesture + secure context).
- Speech: speechSynthesis.speak(new SpeechSynthesisUtterance(text)); recognition is not available everywhere.
- Geolocation: navigator.geolocation.getCurrentPosition(ok, err, { timeout }) — needs permission (blocked in widgets).
- Pointer events (one API for mouse/touch/pen): pointerdown/move/up, setPointerCapture; touch-action:none on game canvases to stop scrolling.
- Keyboard: e.key for characters ('a', 'Enter'), e.code for physical keys ('KeyA', 'Space') — games use e.code.
- Visibility: document.hidden / visibilitychange to pause games and polling.
- Workers: new Worker(url) for heavy computation without freezing the UI; postMessage both ways.
- Fullscreen: el.requestFullscreen() (may be blocked inside iframes).
- Vibration: navigator.vibrate(50) on Android.
- Dates/time zones: Intl.DateTimeFormat().resolvedOptions().timeZone.`,
  },
  {
    id: 'python',
    title: 'Python: idiomatic, correct scripts',
    tags: ['python', 'py', 'pip', 'script', 'pandas', 'requests', 'flask', 'fastapi', 'automation', 'csv', 'file'],
    body: `- Structure: functions + main(); if __name__ == "__main__": main(). argparse for options. Type hints help readers.
- Files: from pathlib import Path; Path("data.txt").read_text(encoding="utf-8"); with open(p, newline="", encoding="utf-8") as f: for CSV (csv.DictReader / DictWriter).
- JSON: json.load(f) / json.dump(obj, f, indent=2).
- HTTP: requests.get(url, timeout=10); r.raise_for_status(); r.json(). (stdlib: urllib.request.)
- Data: list/dict/set comprehensions; collections.Counter, defaultdict, deque; itertools (groupby needs sorted input, combinations, permutations, chain); heapq for priority queues; bisect for sorted inserts.
- Strings: f"{value:.2f}", f"{n:,}"; str.split/join/strip; re for patterns.
- Dates: from datetime import datetime, timedelta, timezone; datetime.now(timezone.utc); zoneinfo.ZoneInfo("Europe/London").
- Errors: catch specific exceptions (except ValueError as e:), never bare except:; raise with a clear message.
- Pitfalls: mutable default args (def f(x=None): x = x or []), integer vs float division (// vs /), modifying a list while iterating, is vs == (use == for values), shadowing builtins (list, dict, id).
- Packages: requirements.txt, python -m venv .venv, pip install -r requirements.txt.
- Web: FastAPI (async, auto docs) or Flask for small servers; pandas for tabular data (read_csv, groupby, agg, to_csv); matplotlib for charts (plt.savefig).
- Games: pygame (pygame.init(); clock.tick(60); event loop; screen.blit) — but for Ghosty, prefer a GK widget so it runs on the owner's phone.`,
  },
  {
    id: 'sql-data',
    title: 'SQL and data modelling',
    tags: ['sql', 'database', 'query', 'sqlite', 'postgres', 'mysql', 'schema', 'join', 'index', 'data model', 'd1'],
    body: `- Model: one table per thing (users, orders), a primary key id, foreign keys for relationships (orders.user_id → users.id), a join table for many-to-many. Store money as integer cents, times as UTC timestamps.
- Queries: SELECT cols FROM t WHERE … ORDER BY … LIMIT n; JOIN … ON a.id = b.a_id (LEFT JOIN keeps rows without matches); GROUP BY with COUNT/SUM/AVG and HAVING for filtering groups.
- Always parameterise: db.prepare('SELECT * FROM users WHERE email = ?').bind(email) — never build SQL by concatenating input (SQL injection).
- Indexes on columns used in WHERE / JOIN / ORDER BY; a UNIQUE index enforces uniqueness.
- Transactions for multi-step changes (BEGIN … COMMIT) so they all happen or none do.
- Upsert: INSERT … ON CONFLICT(key) DO UPDATE SET …
- Pagination: WHERE id > :last ORDER BY id LIMIT 50 (keyset) beats OFFSET for big tables.
- Ghosty itself stores data in its Durable Object storage (ctx.storage.get/put of JSON values) — no SQL needed for small personal data.`,
  },
  {
    id: 'http-apis',
    title: 'Working with web APIs (REST, JSON, auth, errors, rate limits)',
    tags: ['api', 'apis', 'rest', 'http', 'json', 'endpoint', 'webhook', 'oauth', 'cors', 'rate limit', 'integration', 'fetch'],
    body: `- Read the API's docs for: base URL, auth (API key header, bearer token, OAuth), rate limits, response shape. Prefer APIs that need no key for owner-facing features, or store keys in Ghosty's vault.
- Request: method (GET read, POST create, PUT/PATCH update, DELETE), headers (Content-Type: application/json, Authorization: Bearer …), query params encoded with encodeURIComponent / URLSearchParams, JSON body with JSON.stringify.
- Response: check status (2xx ok; 400 your input is wrong; 401/403 auth; 404 missing; 429 rate limited → wait Retry-After; 5xx server problem → retry later with backoff). Parse JSON defensively: fields may be missing — use ?. and ?? defaults.
- Timeouts: AbortController + setTimeout (10–15 s). Retries: only idempotent requests, with exponential backoff (1 s, 2 s, 4 s).
- CORS: browsers block cross-site responses unless the API allows the origin. Ghosty's interface uses /api/proxy (FEED_HOSTS); brain tools fetch server-side (no CORS); widgets can only use APIs that send Access-Control-Allow-Origin: *.
- Caching: cache stable responses (the proxy's ttl); don't poll faster than the data changes.
- Free, keyless APIs that work well: Open-Meteo (weather), Frankfurter (FX rates), CoinGecko (crypto), USGS (quakes), NASA EONET, Wikipedia REST, OpenStreetMap Nominatim (1 req/s, needs a User-Agent), REST Countries, Open Library, PokeAPI, JokeAPI.`,
  },
  {
    id: 'regex-text',
    title: 'Regular expressions and text processing',
    tags: ['regex', 'regexp', 'regular expression', 'parse', 'text', 'string', 'match', 'replace', 'validate'],
    body: `- Basics: . any char, \\d digit, \\w word char, \\s space, [abc] set, [^abc] not, ^ start, $ end, * 0+, + 1+, ? 0/1, {2,4}, (group), (?:non-capturing), (?<name>named), a|b, \\b word boundary.
- Lazy vs greedy: .*? stops at the first match. Flags: g (all), i (ignore case), m (^/$ per line), s (. matches newline), u (unicode).
- JS: str.match(re) (null when no match!), str.matchAll(/…/g) for every match with groups, str.replace(/x/g, (m, g1) => …), re.test(str). Escape user text before putting it in a regex: s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&').
- Don't parse HTML or JSON with regex — use DOMParser / JSON.parse. For CSV with quotes, use a real parser (split(',') breaks on quoted commas).
- Common: email-ish /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/, UK postcode /^[A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}$/i, ISO date /^\\d{4}-\\d{2}-\\d{2}$/, hex colour /^#[0-9a-f]{6}$/i.`,
  },
  {
    id: 'git-workflow',
    title: 'Git and change management',
    tags: ['git', 'github', 'branch', 'commit', 'merge', 'pull request', 'version control', 'diff'],
    body: `- One logical change per commit/change, with a message that says what and why ("Add rain radar panel to Brief").
- Branch per feature; merge when checks pass; never rewrite shared history.
- Read the diff before shipping: unexpected files, debug leftovers, duplicated code, removed lines you didn't mean to remove.
- Roll back by reverting (a new commit undoing the change), not by deleting history. Ghosty: list_versions / restore_version.
- Conflicts: keep both sides' intent; re-run the checks after resolving.
- For Ghosty's own changes, the self-edit tools do all of this (propose_change = branch + commit + PR; ship_change = merge).`,
  },
  {
    id: 'architecture',
    title: 'Software architecture and clean code principles',
    tags: ['architecture', 'design', 'clean code', 'refactor', 'structure', 'modules', 'patterns', 'maintainable', 'state management', 'separation'],
    body: `- Separate concerns: data (fetching, storage) / logic (pure functions) / presentation (DOM, canvas). Pure functions are easy to test and reuse.
- Apps with a backend (UI + API + database): study "clean-architecture" for the full layering, then "auth", "crud api", "database schema".
- Single source of truth for state; derive everything else; update via one function (setState / save + render).
- Small modules with clear exports; names that say what things ARE (fetchForecast, not doStuff); functions under ~40 lines.
- Make illegal states unrepresentable: unions ('idle' | 'loading' | 'error' | 'ready') instead of several booleans.
- Validate at the edges (user input, API responses), trust inside.
- Errors: fail loudly in development, gracefully for users (message + retry), never swallow silently.
- Don't repeat yourself — but don't abstract until you have three real uses.
- Performance last: correct → clear → fast. Measure before optimising.
- Common patterns: observer/events (Emitter), state machine (game scenes, wizard steps), strategy (swap algorithms), adapter (wrap a third-party API in your own interface), cache with TTL, queue for background work.
- Security by default: escape output, parameterise queries, least privilege for tokens, secrets never in code or logs.
- Documentation: a short header comment per file saying what it is for; comments explain WHY, code shows HOW.`,
  },
  {
    id: 'data-viz',
    title: 'Charts and data visualisation (without libraries)',
    tags: ['chart', 'charts', 'graph', 'plot', 'visualisation', 'visualization', 'dashboard', 'sparkline', 'bar chart', 'line chart', 'data'],
    body: `- Pick the form: change over time → line; compare categories → bars (sorted); part of whole → stacked bar (avoid pies with > 4 slices); distribution → histogram; relationship → scatter.
- Scales: x = left + (v - min) / (max - min) * width; y = bottom - (v - min) / (max - min) * height (y grows downward on screen). Guard max === min.
- Nice ticks: step = 10 ** Math.floor(Math.log10(range / 5)) times 1, 2 or 5; label with toLocaleString().
- Canvas line chart: beginPath, moveTo first point, lineTo the rest, stroke; fill under with a translucent gradient for polish.
- Bars: width = plotWidth / n * 0.7; label values on or above bars; start bars at zero.
- Always: title, units, readable labels, at most 5–7 colours, highlight the important series in the accent colour and the rest dim.
- In Ghosty's interface use spark(), bar(), dial() from ui/components; in widgets draw on a canvas.`,
  },
];
