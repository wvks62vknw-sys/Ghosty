# Ghosty Wave 0 — shared context for builders

Ghosty (this repo) is a personal AI for ONE non-technical owner who uses it on an **iPhone 13 in Safari, added to the
Home Screen**. Brain: Cloudflare Worker + Durable Object (`apps/edge`). Interface: PWA (`apps/web`). Read `MAP.md` first.

Hard rules
- Everything free. No new npm packages (MAP.md). No external `<script>`; CSP is strict (`apps/web/public/_headers`, protected — do not loosen it).
- Kernel files are protected (MAP.md "Protected kernel"): do not edit `apps/edge/src/kernel/*`, `apps/edge/src/index.ts`, `agent.ts`, `env.ts`, `tools/{index,types,repo}.ts`, `.github/*`, `apps/web/public/_headers`, build scripts — unless your brief says so. New brain tools go in `apps/edge/src/tools/extra.ts` or a new tools file registered the way neighbouring ones are (look how `tools/studio.ts` is registered).
- Follow the code style of neighbouring files: comment density, naming, plain-English UI strings written for a non-technical owner (UPPERCASE button labels, short honest status lines).
- Build DOM with `h()` + `textContent`; never fetched/user text into innerHTML.
- Prompt budgets in `apps/edge/test/prompt.test.mjs` must still pass; never raise the limits, trim text instead.
- Every fix/feature comes with a test that FAILS on the old code (edge: `apps/edge/test/*.test.mjs` with `node --test`, added to the `test` script list in `apps/edge/package.json` only if a NEW file — NOTE package.json is protected; prefer appending tests to an existing test file that is already in the list). Browser behaviour: a spec in `tests/*.spec.mjs`.

How to run things
- Brain: `cd apps/edge && npm test` (all must pass; ~3 min) and `npx tsc --noEmit -p .` if there is a typecheck script (`npm run check`).
- Interface: `cd apps/web && npm run check` (typecheck + build to `apps/web/dist`).
- Preview server (serves dist + a mock brain): from repo root `node tests/preview-server.mjs <PORT> &` — use YOUR port given in your brief. Owner key in the preview: `preview-owner-key-0123456789`.
- Browser specs: `BASE=http://localhost:<PORT> node tests/<name>.spec.mjs /tmp/<you>-shots`. Chromium is at /opt/pw-browsers.
- **WebKit (Safari's engine)** is installed for Playwright at `/tmp/claude-0/wk/browsers`: run with `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/wk/browsers` and `import { webkit } from 'playwright'`. Mobile WebKit has no `mouse.wheel`; use a desktop-WebKit context at `{ width: 390, height: 664 }` (see `tests/scroll.spec.mjs`). WebKit ignores Chromium flags like `--use-fake-device-for-media-stream`; there is no fake camera/mic in WebKit — for camera/mic paths, test the parts that do not need a live device and the permission/error wording.
- Kill only your own preview server: `ps -eo pid,args | awk '/preview-server.mjs <PORT>/ && !/awk/ {print $1}' | xargs -r kill` (never `pkill -f`, it can kill your own shell).

Finish
- Commit on your branch with clear messages (end each commit message with the two lines:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01ES7c6SvDr3ASLUXV6NSh36`). Do not push.
- Final report: what you changed (files), what tests you added and that they fail on the old code, every check you ran and its result, anything you could not do and why. Be exact; do not claim checks you did not run.
