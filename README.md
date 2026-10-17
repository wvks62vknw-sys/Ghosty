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
  arXiv papers, CVEs, GitHub repositories and whole Project Gutenberg books. They are read in your browser and kept forever in Ghosty's
  own database with full-text search (plus meaning search through Workers AI, no key). Every message is
  looked up there first, so only the few passages that matter reach the AI — and with no AI available at
  all, Ghosty answers straight from the library. A built-in starter library covers algorithms, system
  design, compilers, maths, AI research, PyTorch/JAX/Triton/CUDA, reinforcement learning, production code,
  debugging and security.
- **Grows by itself**: research answers become notes in its library, every shipped change is logged and
  its own changed source files are re-read, and the **Workshop → Training Ground** has it solve 40 verified
  coding exercises — it isn't done with one until every hidden test passes; mistakes become lessons.
- **Linked to your life**: email (app password; sending always asks you), Spotify, **Telegram** (one bot
  token and a pairing code, then text, voice notes and photos from the Telegram app, with reminders and
  task results sent back there), push notifications on demand — all set up in the **Links** tab — live public CCTV (the West Midlands motorways, London, Durham, New York,
  California, Finland, Canada, Sydney), live motorway incidents and the West Midlands' safety-camera sites (no key),
  live buses and trams, live road traffic anywhere (free TomTom key), and a ROAD AHEAD mode that follows your
  phone on the God's Eye globe with what lies ahead.
- **Every screen one tap away**: tap the **GHOSTY** logo (or **SYSTEMS** in the phone dock, or press **M**)
  for the systems deck — every screen with what it does, plus quick actions.
- **Games and mini-apps**: widgets are built on GK, Ghosty's widget kit (`apps/web/public/widget-kit.js`),
  so Ghosty writes only the game itself — a complete example game in its handbook is run by the browser
  tests on every change.
- **Free AI, used sparingly**: only the tools a message needs are sent, old tool output is shortened during
  long tasks, short rate limits are waited out, a provider that has used its day's allowance is left alone
  until it resets, and when the keys run dry Ghosty falls back to **Cloudflare Workers AI** (no key — runs
  on your Cloudflare account) and the open **Pollinations** endpoint (no key, no account).
- **Self-study**: around the clock Ghosty reads a curriculum of thousands of topics (Wikipedia, MDN, arXiv,
  OpenStax, the Swift book, the classics on Project Gutenberg) into its library, writes study notes with a free model, drills itself with
  questions it marks without AI, and can export every notebook as Markdown to a `library` branch of its own
  repository.
- **The Lens**: the phone's camera, on the phone — names what it sees (80 kinds of thing, boxes and counts,
  a 1,000-class scene line), reads text in pictures into the library, tracks hands and seven gestures, asks a
  picture-capable model about a still, and opens a crop in Google Lens, Bing, Yandex or TinEye (named, never
  white-labelled). Vendored MediaPipe and Tesseract.js; no face recognition, no number-plate lookups.
- **Recon**: passive, keyless reconnaissance of a domain, host, IP or address (DNS and email posture, RDAP
  registration, certificates and the subdomains they reveal, Wayback history, hosting and open ports seen by
  Shodan's free InternetDB, the HTTP fingerprint) — in the **Threats** tab or in chat, where Ghosty chains on
  with its other tools. Infrastructure only, never a person.
- **Tools work together**: one turn can chain many tools (a photo's labels → a search → a saved note; a recon
  report → an imported page), read-only tools run side by side, and the long tools report their steps in chat.
- **Real ears, its own voice, pictures**: speech to text with Groq's Whisper or Cloudflare Workers AI's (no
  key), replies read in Ghosty's own voice (MeloTTS on Workers AI; the phone's voice as the fallback), and
  pictures made on request (flux-1-schnell, free) that the chat shows and Telegram sends as photos.
- **Guard rails**: a fast self-check rejects the mistakes free models make most (placeholder comments,
  half-deleted files, duplicate declarations, missing imports, unregistered tabs, blocked feed hosts),
  and coding turns are routed to the strongest free models with room for longer replies.

Runs on free tiers: one Cloudflare Worker + Durable Object, GitHub, and free AI keys
(Gemini, Groq, Cerebras, OpenRouter, Mistral).
