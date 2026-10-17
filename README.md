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
- **Pages, apps and widgets that work first time**: its handbook carries a complete single-file **app page
  kit** (design tokens, glass cards, 44 px buttons, a pink octopus mascot, toast, modal, saved state — nothing
  fetched), a **quality loop** (plan → build on the kit → `check_html` → self-review → fix → publish) and a
  motion/3D playbook. `check_html` reads a page the way a browser would and reports, line by line, what
  would break; **nothing is published with errors**, and warnings ride along with the link.
- **Daily upgrade ideas**: every morning Ghosty looks at what you asked that week, what it couldn't
  answer, what went wrong and what it knows about you, and proposes one to three upgrades it can build
  for itself — each free, phone-first and one change. They wait in **Workshop → UPGRADE IDEAS** (it tells
  you once when there's a new one); **BUILD** starts one in the chat, **DISMISS** drops it, **THINK NOW**
  asks right away.
- **Free AI, used sparingly**: only the tools a message needs are sent, old tool output is shortened during
  long tasks, short rate limits are waited out, a provider that has used its day's allowance is left alone
  until it resets, and when the keys run dry Ghosty falls back to **Cloudflare Workers AI** (no key — runs
  on your Cloudflare account) and the open **Pollinations** endpoint (no key, no account).
- **Self-study**: around the clock Ghosty reads a curriculum of thousands of topics (Wikipedia, MDN, arXiv,
  OpenStax, the Swift book, the classics on Project Gutenberg) into its library, from the basics of each field
  up through intermediate to advanced, writes study notes with a free model, drills itself with
  questions it marks without AI, and can export every notebook as Markdown to a `library` branch of its own
  repository.
- **Fresh knowledge every day**: every morning it gathers the day's news (BBC: world, UK, Birmingham, technology,
  science), Hacker News' front page, the newest AI and machine-learning papers on arXiv and Wikipedia's current
  events into its library with no AI at all, and sums the day up in three levels (one line, more detail, for an
  expert) when a free model is there — so it answers about today, not last year. **Library → FRESH TODAY**.
- **A memory of you**: every night it looks back over the day's conversation and keeps what you said about
  yourself — your likes, your people, your places, your routines and plans — as a profile in your own words
  (**Memory → ME**, where you can add or remove any line) and writes a diary entry (**Memory → DIARY**). Never
  anything it read on the web, never a password or a card number.
- **Projects that run for days**: ask for something big — "research the options over the next few days, then
  build it" — and it plans 3–12 steps for your approval, then works through them on its own schedule, a step every
  few minutes, research on the cheap free models and building on the strong ones, filing every result in the
  library and telling you as it goes. **Workshop → PROJECTS** shows progress; pause, resume, cancel, or run the
  next step now; "carry on" resumes a paused project.
- **The Lens**: the phone's camera, on the phone — names what it sees (80 kinds of thing, boxes and counts,
  a 1,000-class scene line), reads text in pictures into the library, tracks hands and seven gestures, asks a
  picture-capable model about a still, and opens a crop in Google Lens, Bing, Yandex or TinEye (named, never
  white-labelled). NAME mode names thousands of everyday things, on the phone (4,624 names, about 33,000
  with MORE NAMES, from Apple's MobileCLIP-S0 under ONNX Runtime Web). Vendored MediaPipe, Tesseract.js and
  ONNX Runtime; no face recognition, no number-plate lookups.
- **Scan anything** (Lens → SCAN): barcodes and QR codes read on the phone (vendored ZXing) — a product's
  barcode becomes a card from Open Food Facts (Nutri-Score, nutrition, allergens) or its sister databases, a
  book's ISBN one from Open Library, a QR link is shown with its real site and warnings and opened only on
  your tap; documents photographed, straightened and exported as a PDF made on the phone; signs and menus
  read and translated (Workers AI's free translator). In chat: `lookup_barcode`, `translate_text`.
  **AIM: point the phone at the sky or the street** — labels float over aircraft (callsign, height, distance),
  ships, buses and trams, hilltops, towers and landmarks, and the space station when it is up, with a compass
  ribbon and the horizon; tap one for its card, or ask WHAT'S THAT? (Places: Wikipedia, OpenStreetMap.)
- **Measure, plan, fit** (Lens → MEASURE, the **SPACE** tab, `find_furniture`): real sizes from a photo —
  a bank card or an A4 sheet on the wall sets the scale exactly (a door's height or a typed distance gives an
  estimate), then two taps make a length and four a wall's width × height, in cm and ft/in with how far to
  trust them. The SPACE PLANNER draws the room to scale with furniture in common UK sizes to drag about,
  marks walkways under 70 cm, answers WILL IT FIT?, and MAKE SPACE proposes up to three layouts that free the
  most floor (PNG/JSON export, kept on the phone). In chat, Ghosty finds furniture that fits at UK shops
  (IKEA, Argos, Dunelm, John Lewis, Wayfair, DFS, Habitat, B&Q, eBay), reading each shop's own page for the
  price and the size — never a guessed price — best fit then cheapest first, with links.
- **Vehicle check**: photograph or type ONE UK number plate and see that car's official record — make, model,
  colour, MOT valid until, every MOT test with its mileage and advisories, a warning when the mileage went down,
  unfixed recalls (DVSA MOT history, free key; DVLA tax status when its registrations reopen). Lens READ offers
  CHECK THIS VEHICLE? and looks nothing up until you tap it. Shown once, never saved anywhere; never who owns it.
- **Sound check** (Lens → SOUND): LISTEN records a few seconds of whatever is playing and says plainly if it
  is clipping, humming, boomy or harsh ("clipping: turn the volume down a couple of notches"); TEST TONE plays
  a tone that gets louder and a sweep through the speaker under test and says where it starts to distort
  ("distorts above ~70% volume") and how its bass and treble fall away — worked out on the phone, with charts.
  **Best settings and spare parts**: show Ghosty a speaker, amp, soundbar or TV and it looks up the settings
  its manual and reviewers recommend, sources named (`gadget_settings`); show it a broken part and it finds
  it in UK shops with prices read off their pages, best match first (`find_part`). Never a guessed setting
  or price.
- **3D STUDIO**: a Stark-style holographic lab (vendored three.js): turn any model, **TAKE APART** and
  **REASSEMBLE** it (one-piece models are split into their real pieces), isolate or hide parts, cut it open
  with a **SECTION** plane, **MEASURE** between two taps, screenshot it. Free samples (Khronos glTF, credited),
  any .glb from Files, **PHOTO → 3D** (a picture or a described object becomes a model through the free
  Hunyuan3D-2 demo on Hugging Face — best effort, a few a day), a **ROOM** built from its measurements or the
  space planner's JSON, and your own **Spline** scenes framed with "Powered by Spline". In chat: `make_3d`.
- **Recon**: passive, keyless reconnaissance of a domain, host, IP or address (DNS and email posture, RDAP
  registration, certificates and the subdomains they reveal, Wayback history, hosting and open ports seen by
  Shodan's free InternetDB, the HTTP fingerprint) — in the **Threats** tab or in chat, where Ghosty chains on
  with its other tools. Infrastructure only, never a person.
- **Journeys**: a door-to-door public-transport planner (bus, tram, train, metro, coach, ferry, with the walks
  between) anywhere in the world, free and keyless (Transitous over the open timetables operators publish, live
  times where they exist): **GO** on God's Eye or *"how do I get to X"*, the options drawn on the map leg by leg
  with every stop, the steps in a JOURNEY sheet, and *"next buses from X"* for departures.
- **Tools work together**: one turn can chain many tools (a photo's labels → a search → a saved note; a recon
  report → an imported page), read-only tools run side by side, and the long tools report their steps in chat.
- **An offline brain on the phone**: download a small AI (≈352 MB, once, in Settings → Offline brain) and
  Ghosty keeps talking with no signal, when every free model is busy, or always if you prefer: it runs on the
  iPhone itself (WebLLM on WebGPU, iOS 26+), free and private, knows your memory, agenda and library copy,
  and each such reply says "Answered on your phone (offline)".
- **Real ears, its own voice, pictures**: speech to text with Groq's Whisper or Cloudflare Workers AI's (no
  key), replies read in Ghosty's own voice (MeloTTS on Workers AI; the phone's voice as the fallback), and
  pictures made on request (flux-1-schnell, free) that the chat shows and Telegram sends as photos.
- **Guard rails**: a fast self-check rejects the mistakes free models make most (placeholder comments,
  half-deleted files, duplicate declarations, missing imports, unregistered tabs, blocked feed hosts),
  and coding turns are routed to the strongest free models with room for longer replies.

- **Token discipline**: the prompt is a quarter of what it was (one line per tool group, only the groups a
  message turns on, the rest by name), tool results are cut to a budget each, and the conversation is kept
  within a character budget — so free models' per-minute allowances last; when every model is out, simple
  asks are still answered without AI, with the exact time the first model is back.

Runs on free tiers: one Cloudflare Worker + Durable Object, GitHub, and free AI keys
(Gemini, Groq, Cerebras, OpenRouter, Mistral, NVIDIA NIM, SambaNova, Cohere).
