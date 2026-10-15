/**
 * Ghosty-specific playbooks: how its own code is organised and complete worked examples
 * of the changes asked for most often. Keep these accurate when the code changes —
 * a wrong playbook teaches wrong code.
 */
import type { Playbook } from './types';

export const GHOSTY: Playbook[] = [
  {
    id: 'edit-mechanics',
    title: 'How propose_change / update_change edits work (and how not to break them)',
    tags: ['edit', 'replace', 'write', 'find', 'propose', 'update', 'json', 'arguments', 'cut off', 'truncated', 'mechanics'],
    body: `edits is a list of { path, action, ... }:
- "replace": { path, action: "replace", find, replace } — find must appear EXACTLY ONCE in the current file. Several replace edits on the same file apply one after another, so the second find must match the file AFTER the first edit.
- "write":   { path, action: "write", content } — the COMPLETE file. Use for new files. For an existing file only if you really rewrite all of it.
- "delete":  { path, action: "delete" }.
Max 25 edits per change.

Rules that prevent most failures:
1. Copy find snippets from repo_read output character-for-character: same indentation (spaces, not tabs), same quotes, same trailing commas. 1–4 distinctive lines is ideal; a single short common line (like "});") will match many times.
2. To INSERT code, find an anchor line and replace it with anchor + new code (keep the anchor!).
   find:    "export const TABS: TabDef[] = [coreTab, eyeTab"
   replace: "export const TABS: TabDef[] = [coreTab, clocksTab, eyeTab"
3. Never write placeholders such as "// ... existing code ..." or "// rest unchanged" — the file really becomes that comment and everything else is deleted. The self-check rejects this.
4. Keep each tool call reasonably small. Free models' replies are cut off at a few thousand words; a cut-off reply produces invalid JSON arguments and the change fails with "arguments were not valid JSON". If a file is large, change it with several small replace edits instead of a write. If a feature is large, split it over several changes.
5. Inside JSON strings, newlines are \\n and quotes are escaped — the tool-calling layer does this for you; just make sure the code text itself is right.
6. update_change takes the same edit format and applies on top of the change branch, so read the file from the branch (repo_read with ref = branch name) before fixing it.`,
  },
  {
    id: 'interface-api',
    title: 'Interface reference: exact helpers and signatures (apps/web/src)',
    tags: ['interface', 'ui', 'web', 'panel', 'row', 'pager', 'button', 'dial', 'page', 'h', 'dom', 'components', 'design', 'api', 'reference', 'frontend'],
    body: `core/dom.ts
- h(spec, props?, ...children) → element. spec 'div', 'div.cls', 'span.a.b', 'div#id'. props: { onclick, style: {...} | 'css', dataset, class, title, type, value, ... }. Children: Node | string | number | null | false. Text is set with textContent (safe).
- clear(el, ...children) empties then appends. append(el, ...children).
- $(selector, root?) → element | null.
- fmt.n(x, decimals) '--' for null; fmt.km(x); fmt.ago(ms timestamp) '5m ago'; fmt.time(date) 'HH:MM'. pad(n) '07'.
- icon(svgPathMarkup, cls?) for icons from constant strings only.

ui/components.ts
- panel(title, { status?, footer?, grow?, cls? }) → { el, body, foot, title, setStatus(text, light?: 'ok' | 'mid' | 'off') }. Append p.el to a column; put content in p.body.
- row(label | null, value: string | Node, number?: string | null, { onClick?, sev?: 0-3, tone?: 'up' | 'dn' | 'bad', wrap? }) → HTMLElement.
- pager<T>(panel, rowHeightPx, (item: T) => HTMLElement, emptyText?: () => string) → { set(items: T[]) }. Needs panel(..., { footer: true }) for the page buttons.
- button(label, (b) => void, cls?) — cls like 'warn' or 'on'.
- spark(values: number[], w?, h?) SVG sparkline. bar(label, frac 0-1, text, color?). dial(label, frac 0-1, text, color?).
- toast(message, '' | 'warn' | 'bad' | 'ok'). modal(title, contentNode, onClose?) → { close() }. empty(status) placeholder block.

ui/page.ts
- page(root, { tag, sub?, leftLabel?, rightLabel? }) → { root, tag, big, sub, left, right, dials([[label, frac, text, color?], ...]) }. big/sub are the hero readout; left/right are panel columns.

shell/tabs.ts
- TabDef { id, title, icon: '<svg path markup>', scene: 'globe' | 'backdrop', primary?, mount(root) → TabInstance }.
- TabInstance { enter?(), leave?(), describe?(): string }. enter() runs each time the tab opens (start feeds there); describe() tells Ghosty what is on screen.
- go(tabId) switches tab.

api/feed.ts
- new Feed<T>(name, async loader, everyMs). feed.start() (idempotent), feed.data (T | null), feed.status ('IDLE' | 'SYNC' | 'LIVE' | 'STALE' | 'NO FEED'), feed.onChange(fn).
- fetchJson<T>(url, ttlSeconds?) / fetchText(url, ttl?) go through /api/proxy — the host must be in FEED_HOSTS (apps/edge/src/index.ts, kernel).

engine/scheduler.ts
- onFrame((dt, now) => void, everySeconds?) → stop function. The ONLY way to animate or tick.

state/app.ts
- settings.get() → { name, theme, units: 'metric' | 'imperial', speak, voice, home, currency: 'gbp' | 'usd' | 'eur' }. settings.subscribe(fn).
- home() → { name, lat, lon } (owner's place). ui store has the current tab.

assistant/session.ts
- send(text) sends a message to Ghosty as if the owner typed it (use for "ask Ghosty about this" buttons; call go('core') first so the chat is visible).

Styles (apps/web/styles.css): colours var(--c) primary, var(--a) accent, var(--r) alert, rgba(var(--cr), .2) tints. Reuse existing classes (.note, .lab, .tabs, .rw); add new CSS at the end of styles.css with a comment naming the feature.`,
  },
  {
    id: 'recipe-tab',
    title: 'Worked example: add a new tab (complete, correct code)',
    tags: ['tab', 'new tab', 'page', 'screen', 'interface', 'recipe', 'example', 'feature', 'dock'],
    body: `Goal: a CLOCKS tab with the time in three cities.

Edit 1 — write apps/web/src/features/clocks/index.ts:

/** CLOCKS tab: the time in a few cities, updated every second while open. */
import { h } from '../../core/dom';
import { onFrame } from '../../engine/scheduler';
import type { TabDef } from '../../shell/tabs';
import { panel, row } from '../../ui/components';
import { page } from '../../ui/page';

const CITIES: [name: string, tz: string][] = [
  ['LONDON', 'Europe/London'],
  ['NEW YORK', 'America/New_York'],
  ['TOKYO', 'Asia/Tokyo'],
];

const timeIn = (tz: string): string =>
  new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const clocksTab: TabDef = {
  id: 'clocks',
  title: 'CLOCKS',
  icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  scene: 'backdrop',
  mount(root) {
    const P = page(root, { tag: 'WORLD CLOCKS' });
    const p = panel('CITIES');
    P.left.append(p.el);
    const cells = CITIES.map(([name]) => {
      const v = h('span', '--:--');
      p.body.append(row(name, v));
      return v;
    });
    const tick = () => {
      CITIES.forEach(([, tz], i) => {
        cells[i]!.textContent = timeIn(tz);
      });
      P.big.textContent = new Date().toLocaleTimeString('en-GB');
    };
    tick();
    let stop: (() => void) | null = null;
    return {
      enter() {
        stop ??= onFrame(tick, 1);
      },
      leave() {
        stop?.();
        stop = null;
      },
      describe: () => 'Clocks: ' + CITIES.map(([n, tz]) => n + ' ' + timeIn(tz)).join(', '),
    };
  },
};

Edit 2 — replace in apps/web/src/features/index.ts (two replace edits):
  find "import { coreTab } from './core';"  →  "import { clocksTab } from './clocks';\\nimport { coreTab } from './core';"
  find "[coreTab, eyeTab,"                   →  "[coreTab, eyeTab, clocksTab,"

Edit 3 — MAP.md: add the tab to the features list.

Why it is correct: every import exists and is exported; cells[i]! handles noUncheckedIndexedAccess; the timer uses onFrame and stops on leave(); text uses textContent; nothing runs at import time except constants.`,
  },
  {
    id: 'recipe-panel',
    title: 'Worked example: add a panel with live data to an existing tab',
    tags: ['panel', 'data', 'feed', 'list', 'add panel', 'recipe', 'example', 'interface', 'live'],
    body: `Pattern (inside mount() of features/<tab>/index.ts, after "const P = page(...)"):

const p = panel('MY PANEL', { footer: true, status: 'SYNC' });
const list = pager(p, 44, (x: Item) => row(x.label, x.value, x.extra));
P.right.append(p.el);
const paint = () => {
  list.set(myFeed.data ?? []);
  p.setStatus(myFeed.status, myFeed.status === 'LIVE' ? 'ok' : 'off');
};
myFeed.onChange(paint);
paint();

…and in the returned TabInstance:  enter() { myFeed.start(); }  (add to the existing enter, don't create a second one).

The feed — new file apps/web/src/data/<name>.ts:

import { Feed, fetchJson } from '../api/feed';

export interface Item { label: string; value: string; extra: string }

interface Raw { results?: { name: string; price: number; change: number }[] }

export const myFeed = new Feed<Item[]>('my-feed', async () => {
  const j = await fetchJson<Raw>('https://api.example.com/data', 300);
  return (j.results ?? []).map((r) => ({ label: r.name, value: r.price.toFixed(2), extra: (r.change >= 0 ? '+' : '') + r.change.toFixed(1) + '%' }));
}, 300_000);

CHECK BEFORE PROPOSING: is api.example.com in FEED_HOSTS in apps/edge/src/index.ts? If not, the proxy answers 403 and the panel shows NO FEED forever. index.ts is kernel: ask the owner to unlock the kernel and add the host in the same change, or use a host already allowed (repo_read apps/edge/src/index.ts to see the list).`,
  },
  {
    id: 'recipe-brain-tool',
    title: 'Worked example: give Ghosty a new ability (a brain tool)',
    tags: ['tool', 'ability', 'brain', 'skill', 'extra', 'api', 'integration', 'recipe', 'example', 'backend', 'edge'],
    body: `New tools go in apps/edge/src/tools/extra.ts (unprotected; registered automatically). Example — currency conversion:

import { arg, type Tool } from './types';

export const extraTools: Tool[] = [
  {
    name: 'convert_currency',
    description: 'Convert an amount between currencies (ISO codes like GBP, USD, EUR) at today\\'s rate. Use when the owner asks about exchange rates or prices in another currency.',
    parameters: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' }, amount: { type: 'number' } },
      required: ['from', 'to'],
    },
    risk: 'auto',
    async run(a) {
      const from = arg.str(a, 'from').trim().toUpperCase().slice(0, 3);
      const to = arg.str(a, 'to').trim().toUpperCase().slice(0, 3);
      const amount = arg.num(a, 'amount', 1);
      const r = await fetch('https://api.frankfurter.app/latest?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
      if (!r.ok) throw new Error('the rate service answered ' + r.status);
      const j = (await r.json()) as { rates?: Record<string, number>; date?: string };
      const rate = j.rates?.[to];
      if (rate === undefined) throw new Error('no rate for ' + from + ' to ' + to);
      return amount + ' ' + from + ' = ' + (amount * rate).toFixed(2) + ' ' + to + ' (rate ' + rate + ', ' + (j.date ?? 'today') + ')';
    },
  },
];

Rules:
- Tool names: lower_snake_case, unique (a name clashing with a built-in tool is ignored).
- The description says WHAT it does and WHEN to use it — the model chooses tools from descriptions.
- Validate arguments with arg.str / arg.num / arg.bool; throw Error with a clear message on failure (the model sees "Error: ...").
- Return compact text for the model, clipped: clip(text, 4000) from './types'.
- Text from the outside world: return asData('source name', text) (import { asData } from '../kernel/permissions').
- Brain tools fetch() directly (FEED_HOSTS only limits the interface proxy). Keep it to a few requests per call.
- Anything that sends/publishes/pays/deletes for the owner: risk: 'confirm'.
- Needs an API key? Read it with await ctx.vault.get('name'). Adding a NEW key to the System tab means editing keys.ts, which is kernel — ask the owner to unlock it.
- Need storage? ctx.storage.get/put with a unique prefix, e.g. 'mytool:'.`,
  },
  {
    id: 'recipe-screen-action',
    title: 'Worked example: let Ghosty act on screen (a client command)',
    tags: ['command', 'client', 'screen', 'action', 'control', 'ui tool', 'interface action', 'recipe'],
    body: `Three places, same name everywhere:
1. packages/shared/src/protocol.ts — add the name to CLIENT_COMMANDS.
2. apps/web/src/commands/builtin.ts — add to an existing register(...) call:
   { id: 'my_action', title: 'My action', hidden: true, run: (a) => { /* use a?.field */ } },
3. A client tool for the brain. tools/ui.ts is the usual place for built-in ones; for a new ability put it in tools/extra.ts:
   { name: 'my_action', description: '…', parameters: { type: 'object', properties: { … } }, risk: 'auto', side: 'client',
     async run(a, ctx) { ctx.emit({ t: 'client', name: 'my_action', args: a }); return 'Done on screen.'; } }
The emit name must be in CLIENT_COMMANDS or TypeScript rejects it.`,
  },
  {
    id: 'widgets',
    title: 'Instant widgets: when and how',
    tags: ['widget', 'widgets', 'html', 'quick', 'mini app', 'calculator', 'timer', 'tool', 'instant'],
    body: `Use create_widget when the owner wants a small standalone tool NOW (timer, calculator, converter, checklist, mini dashboard). It installs in seconds with no build.

How widgets run: one HTML document inside a sandboxed iframe (allow-scripts only, opaque origin).
- Inline <style> and <script> only; no external scripts unless you really need a library (allowed, but prefer plain JS).
- localStorage/sessionStorage/cookies THROW in the sandbox. Wrap any use in try/catch, or keep state in variables (it resets on reload).
- fetch() works only with APIs that send Access-Control-Allow-Origin: * (the origin is "null").
- No forms submission, no popups, no alert/confirm/prompt (blocked) — build the UI in the page.
- Look: background #02070d, text #e6f6ff, accent #5ce1ff, font system-ui; responsive (it is shown on phones too).
- Under 100 KB. Complete document, nothing left out.
- Test it in your head: click every button once; what happens with empty input?`,
  },
  {
    id: 'kernel',
    title: 'Protected kernel: what you cannot edit alone, and what to do instead',
    tags: ['kernel', 'protected', 'locked', 'unlock', 'permission', 'index.ts', 'agent.ts', 'keys', 'feed_hosts', 'wrangler', 'ci'],
    body: `Protected (edits are refused unless the owner presses Workshop → Kernel lock → Unlock):
apps/edge/src/kernel/*, apps/edge/src/index.ts (FEED_HOSTS proxy allowlist), agent.ts, env.ts, github.ts, push.ts, keys.ts, tools/index.ts, tools/types.ts, tools/repo.ts, wrangler config, every package.json / lockfile / dotfile, apps/web/build.mjs, apps/web/public/_headers, .github/*.

What to do:
- Need a new data host for the interface? → It must go in FEED_HOSTS (index.ts). Tell the owner exactly which host and why, ask them to unlock the kernel, then include that edit in the same change.
- Need a new API key in the System tab? → keys.ts (kernel). Same: explain, ask for unlock.
- Need a new tool? → tools/extra.ts (NOT tools/index.ts).
- Need new npm packages? → Not possible (installs are kernel and the build has none). Write the code yourself.
- Never try to work around the kernel (e.g. copying protected logic elsewhere to change it). The lock exists to keep the owner safe.`,
  },
  {
    id: 'shipping',
    title: 'Previews, shipping, rollbacks — the release process',
    tags: ['ship', 'deploy', 'release', 'preview', 'rollback', 'restore', 'live', 'merge', 'workshop'],
    body: `- propose_change opens a change (branch + pull request). Cloudflare builds a private preview of it in 1–2 minutes. CI runs typecheck, tests, the Cloudflare build and a real-browser run.
- wait_for_checks waits up to ~6 minutes and returns PASSED or the exact errors.
- Only when every check passed: tell the owner what changed + preview link, and ask to ship. Previews have no keys/memory and never ask for the password.
- ship_change needs the owner's approval (pinned to the exact commit). After shipping, Ghosty checks the live deploy and rolls back automatically if it fails.
- list_versions / restore_version roll back any time (approval needed). A rollback is a new commit, so it can be undone.
- discard_change closes a change you no longer want. Don't leave broken changes open.`,
  },
];
