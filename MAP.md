# Ghosty — code map

Read this before changing anything. It says where things live and how to make the most
common changes. Keep changes small, follow the patterns of the neighbouring code, and do
not add npm packages (the build has only TypeScript and esbuild).

## Two halves

| Part | Folder | Runs on | Deploys when |
|---|---|---|---|
| **Interface** | `apps/web/` | your browser (Cloudflare Pages) | every branch gets a preview; `main` goes live |
| **Brain** | `apps/edge/` | Cloudflare Worker + Durable Object | when a change reaches `main` |
| Shared types | `packages/shared/src/protocol.ts` | both | — |

The interface talks to the brain only through `/api/*` (`apps/web/functions/api/[[path]].ts`
forwards to the brain). Public data feeds go through `/api/proxy?url=…` (brain caches them).

## Protected kernel (you cannot edit these without the owner unlocking the kernel)

`apps/edge/src/kernel/*` (auth, permissions, vault, protected list) · `apps/edge/src/index.ts`
· `apps/edge/src/agent.ts` · `apps/edge/src/env.ts` · `apps/edge/src/tools/{index,types,repo}.ts`
· `apps/edge/src/github.ts` · `apps/edge/wrangler*` · `apps/edge/package.json` · `apps/web/functions/*`
· `apps/web/public/_headers` · `.github/*`. The exact list is `PROTECTED_PATHS` in
`apps/edge/src/kernel/protected.ts`. New brain tools go in **`apps/edge/src/tools/extra.ts`**
(unprotected), which is registered automatically.

## Interface map (`apps/web/src/`)

| Path | What it is |
|---|---|
| `main.ts` | boot: theme, engine, Earth data, connect to brain, open first tab |
| `features/index.ts` | **list of tabs** (dock order) |
| `features/<tab>/index.ts` | one tab each: `core`, `eye`, `brief`, `threats`, `markets`, `memory`, `workshop`, `system` |
| `features/core/reactor.ts` | the arc reactor drawing (2D canvas) |
| `ui/components.ts` | **design system**: `panel`, `pager`, `row`, `button`, `spark`, `bar`, `dial`, `toast`, `modal`, `empty` |
| `ui/page.ts` | standard tab layout: hero (big value + dials) with left/right panel columns |
| `core/dom.ts` | `h('div.class', props, ...children)` element builder, `clear`, `fmt`, `icon` |
| `core/store.ts` | `createStore` (get/set/subscribe) and `Emitter` |
| `state/app.ts` | `settings` (saved on device) and `ui` (tab, busy, voice) stores; `home()` location |
| `state/theme.ts` | colour themes (`THEMES`, `applyTheme`) |
| `data/*.ts` | live data feeds as `Feed` objects: `weather`, `news`, `hazards` (quakes, events, launches, kp), `markets` |
| `api/feed.ts` | `Feed` class (polling + LIVE/STALE/NO FEED status), `fetchJson`, `fetchText` (via proxy) |
| `api/brain.ts` | client for the brain's `/api` endpoints |
| `assistant/session.ts` | the conversation: sends messages, handles streamed events, approvals |
| `assistant/voice.ts` | speaking (speech synthesis) and listening (Whisper via brain, or browser) |
| `commands/registry.ts` | command registry, hotkeys, command palette |
| `commands/builtin.ts` | built-in commands incl. the ones the brain triggers (`open_tab`, `fly_to`, …) |
| `shell/tabs.ts` | tab registry + `go(id)` navigation |
| `shell/layout.ts` | top bar, dock, MORE launcher |
| `engine/` | WebGL2 engine: `gfx.ts` (renderer, LineSet, PointSet), `scheduler.ts` (the one frame loop: use `onFrame`), `globe.ts` (God's Eye), `camera.ts`, `geo.ts`, `world.ts`, `backdrop.ts`, `layers/{air,sats,hazards}.ts` |
| `../styles.css` | all styles. Colours: `var(--c)` primary, `var(--a)` accent, `var(--r)` alert; `rgba(var(--cr), .2)` for tints |
| `../public/` | static files (`data/world.json`, `_headers` security policy, widget host) |

## Brain map (`apps/edge/src/`)

| Path | What it is |
|---|---|
| `index.ts` | Worker entry: auth gate, `/api/proxy` feed proxy (**`FEED_HOSTS` allowlist**), forwards to agent |
| `agent.ts` | `GhostyAgent` Durable Object: agent loop, approvals, history, keys, widgets, Workshop endpoints |
| `prompt.ts` | system prompt (persona, loyalty, self-edit procedure) |
| `tools/index.ts` | registry of tools (protected) |
| `tools/extra.ts` | **where new tools go** |
| `tools/types.ts` | `Tool` interface, `arg` helpers |
| `tools/{memory,web,data,ui,widgets}.ts` | tools by area |
| `llm/router.ts`, `llm/providers.ts` | model router across free providers |
| `keys.ts` | which API keys exist (shown in System tab) |

## Recipes

**Add a panel to an existing tab** — in `features/<tab>/index.ts`:
```ts
const p = panel('MY PANEL', { footer: true });         // from ui/components
const list = pager(p, 44, (x: Item) => row('LABEL', x.text, x.value));
P.right.append(p.el);                                   // P = page(...) at the top of mount()
myFeed.onChange(() => list.set(myFeed.data ?? []));     // repaint when data changes
```
Return `enter()` that calls `myFeed.start()`.

**Add a data feed** — new file `data/<name>.ts`:
```ts
export const thing = new Feed<Thing[]>('thing', async () => {
  const j = await fetchJson<Raw>('https://api.example.com/x', 300);   // ttl seconds
  return j.items.map(...);
}, 300_000);                                                          // poll interval ms
```
Then add the host to `FEED_HOSTS` in `apps/edge/src/index.ts`, or the proxy refuses it.

**Add a tab** — create `features/<name>/index.ts` exporting a `TabDef`
(`{ id, title, icon: '<svg path markup>', scene: 'backdrop', mount(root) { const P = page(root, {tag:'TITLE'}); …; return { enter(){}, describe: () => '…' } } }`)
and add it to `TABS` in `features/index.ts`. It appears in the dock and palette automatically.

**Add a brain tool** (a new ability) — in `apps/edge/src/tools/extra.ts`:
```ts
export const myTools: Tool[] = [{
  name: 'my_tool', description: 'What it does and when to use it.',
  parameters: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
  risk: 'auto',                        // 'confirm' = owner must approve each use
  async run(a, ctx) { const q = arg.str(a, 'q'); …; return 'text for the model'; },
}];
```
Put it in `extraTools` in `tools/extra.ts` (registered automatically; names must not clash with
built-in tools). Wrap text read from the web with `asData(source, text)` from `../kernel/permissions`.
If it needs a key, add it to `KEYS` in `keys.ts` and read it with `await ctx.vault.get('name')`.

**Make the brain act on screen** — add a command in `commands/builtin.ts` (`register({ id, run })`),
add the name to `CLIENT_COMMANDS` in `packages/shared/src/protocol.ts`, and add a client tool
in `apps/edge/src/tools/ui.ts` with the same name.

**Animate something** — use `onFrame((dt) => …)` from `engine/scheduler.ts`. Never start
your own `requestAnimationFrame` or `setInterval` for animation.

## Rules

- TypeScript strict. Run `npm run check` in `apps/web` and `apps/edge` (CI does this on every change).
- Build DOM with `h()` and `textContent`. Never put fetched or user text into `innerHTML`.
- No new npm packages, no external `<script>` tags (the security policy blocks them).
- Small, focused changes. One feature per change. Explain it in the change summary.
- Keep `MAP.md` accurate when you add files or move things.
