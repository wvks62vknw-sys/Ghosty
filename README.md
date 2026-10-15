# Ghosty 2.0

A personal AI for exactly one person. It answers only to you, it can act on the world
through tools, and it can **rebuild itself**: ask for a feature and it edits its own code,
lets you check a preview, ships it when you say so, and can roll any change back.

- **Set up:** [SETUP.md](SETUP.md)
- **Code map** (Ghosty reads this before every self-edit): [MAP.md](MAP.md)

```
apps/web     interface: God's Eye globe, arc reactor, briefings, threats, markets, workshop
apps/edge    brain: agent loop, tools, model router, memory, encrypted keys, self-edit
packages/shared   types shared by both
tests/       local preview server + browser test
```

## How Ghosty learns

- **Handbook** (`apps/edge/src/knowledge/`): playbooks on how to engineer changes without mistakes —
  method, self-review checklist, strict TypeScript, a catalogue of CI errors and fixes, debugging, and
  complete worked examples for this codebase (new tab, panel + feed, brain tool, screen action, widget).
  Ghosty looks them up with `study` before it builds anything.
- **Lessons**: whenever a check fails and Ghosty fixes it, it records the cause and a rule with
  `learn_lesson`. Lessons are put in its instructions from then on (most-repeated first) and are listed
  in **Memory → Lessons learned**, where you can delete any that are wrong.
- **Self-evolution**: ask Ghosty to upgrade itself (or press **Workshop → Upgrade roadmap → UPGRADE
  YOURSELF**). It audits what it has, plans the upgrade as small shippable steps, builds them one by one
  (you ship each), and adds what it learned to its handbook so every later version knows it too.
  **CARRY ON** continues with the next step.
- **Library (offline brain)**: the **Library** tab takes books, PDFs, Word files, e-books, notes, web pages,
  arXiv papers, CVEs and GitHub repositories. They are read in your browser and kept forever in Ghosty's
  own database with full-text search (plus meaning search through Workers AI, no key). Every message is
  looked up there first, so only the few passages that matter reach the AI — and with no AI available at
  all, Ghosty answers straight from the library. A built-in starter library covers algorithms, system
  design, compilers, maths, AI research, PyTorch/JAX/Triton/CUDA, reinforcement learning, production code,
  debugging and security.
- **Grows by itself**: research answers become notes in its library, every shipped change is logged and
  its own changed source files are re-read, and the **Workshop → Training Ground** has it solve 40 verified
  coding exercises — it isn't done with one until every hidden test passes; mistakes become lessons.
- **Linked to your life**: email (app password; sending always asks you), Spotify, push notifications on
  demand, and live public CCTV (London, New York, California, Finland) on the God's Eye globe.
- **Games and mini-apps**: widgets are built on GK, Ghosty's widget kit (`apps/web/public/widget-kit.js`),
  so Ghosty writes only the game itself — a complete example game in its handbook is run by the browser
  tests on every change.
- **Free AI, used sparingly**: only the tools a message needs are sent, old tool output is shortened during
  long tasks, short rate limits are waited out, and when the keys run dry Ghosty falls back to
  **Cloudflare Workers AI** (no key — runs on your Cloudflare account) and **GitHub Models** (your GitHub
  token with the "Models" permission).
- **Guard rails**: a fast self-check rejects the mistakes free models make most (placeholder comments,
  half-deleted files, duplicate declarations, missing imports, unregistered tabs, blocked feed hosts),
  and coding turns are routed to the strongest free models with room for longer replies.

Runs on free tiers: one Cloudflare Worker + Durable Object, GitHub, and free AI keys
(Gemini, Groq, Cerebras, OpenRouter, Mistral).
