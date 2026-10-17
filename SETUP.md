# Setting up Ghosty

Ghosty is one Cloudflare Worker. It serves the interface and runs the brain (agent,
memory, encrypted keys) from the same address, `https://ghosty.<your-subdomain>.workers.dev`.
Everything runs on free plans.

## 1. GitHub repository

The code lives in a private GitHub repository (yours: `wvks62vknw-sys/Ghosty`).

## 2. Connect it to Cloudflare (one time)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** → pick the repo.
2. Worker name **`ghosty`**. **Root directory: `apps/edge`**. Leave the build command empty and
   the deploy command as `npx wrangler deploy`. Deploy.

That's all the dashboard work. Every push to `main` redeploys. Settings live in
`apps/edge/wrangler.jsonc`:

| Setting | What it is |
|---|---|
| `OWNER_KEY_HASH` | SHA-256 of your owner password. The password itself is stored nowhere. |
| `OWNER_EMAIL` | Your email (used by the optional Cloudflare login, step 5). |
| `GITHUB_REPO` | `owner/name` of this repository, for self-editing. |

No secrets are needed. The brain makes its own encryption key for the API keys you give it (kept in
its private storage, which only the brain can read; set a `VAULT_KEY` secret if you want the key kept
separately).
To set your own instead, add a `VAULT_KEY` secret (32 random bytes, base64) **before** saving
any keys, and never change it afterwards.

**Changing the owner password:** pick a long random password (at least 30 random characters — its
fingerprint is in the code, so a short or guessable password could be cracked), put its SHA-256 in
`OWNER_KEY_HASH` (in a browser console:
`[...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR-PASSWORD')))].map(b=>b.toString(16).padStart(2,'0')).join('')`),
and push. Or add an `OWNER_KEY` secret on the Worker with the password itself (24+ characters).

## 3. Open Ghosty

Your address is shown on the Worker's overview page (**Domains & Routes**). Open it, enter your
owner password on the pairing screen, then go to **System** and add a free AI key:
**Gemini** (aistudio.google.com/apikey) is the best free model for building things;
**Groq** (console.groq.com/keys) is the fastest for chat and gives Ghosty speech recognition.
Add several free keys (Gemini, Groq, Cerebras, OpenRouter, Mistral, NVIDIA NIM, SambaNova, Cohere — each one
in the System tab says how to get it in a minute): Ghosty spreads its work across all of them, so it runs out
far less often, and a provider whose daily allowance is used up is left alone until it resets. A model that is
only seconds from being free again is waited for rather than swapped for a weaker one. And when every model
really is out, Ghosty is never useless: simple asks (the time, the weather, your agenda, what it remembers,
buses or traffic nearby) are still answered from the tool itself with no AI, and every "no model" reply tells
you the exact time the first one is back. Two more free sources need no key at all:
- **Cloudflare Workers AI** is connected automatically (the `ai` binding in `apps/edge/wrangler.jsonc`) and
  used when the keys are busy — a free daily allowance on your own Cloudflare account.
- **Pollinations** (an open text endpoint, one reply every 30 seconds, best effort) is the last resort for
  chat and the first choice for Ghosty's own study drills, so your keys stay yours. Nothing secret is ever
  sent there, and never a picture: a photo from the Lens only goes to a key of yours or to Workers AI on
  your own account. Set the `KEYLESS_MODELS` variable to `0` in `wrangler.jsonc` if you would rather it
  never used an open endpoint.

**Ghosty studies on its own:** the Library tab's **SELF-STUDY** panel shows what it reads around the clock
(a curriculum of thousands of topics across maths, science, computing, finance, law, health, history and
more, from Wikipedia, MDN, arXiv, OpenStax, the Swift book and the classics on Project Gutenberg), the study notes it writes with a free
model, and how its self-set drills go. Type a field into FOCUS to put it first. Everything it learns is
filed in the library (open any notebook on the shelf); **EXPORT TO GITHUB** writes every notebook as
Markdown to a `library` branch of your repository, so it costs nothing on your phone and is readable
anywhere. It stays within the free plan on its own: it waits while the day's database allowance is low.

**Fresh knowledge every day:** every morning (06:10 UTC) Ghosty gathers the day's BBC news (world, UK, Birmingham,
technology, science), Hacker News' front page, the newest AI and machine-learning papers on arXiv and Wikipedia's
current events into its library — no AI, no key, about twenty small requests — and, when a free model is there,
sums the day up in three levels. **Library → FRESH TODAY** shows the day's entries (tap one to read it;
**DIGEST NOW** gathers again). Nothing to set up.

**A memory of you:** every night (03:20 your time) Ghosty looks back over the day's conversation with a free model
and keeps what you said about yourself — likes, dislikes, people, places, routines, goals, work — as a profile in
your own words, plus a diary entry for the day. **Memory → ME** shows the profile (add a line, or tap ✕ to remove
one); **Memory → DIARY** shows the entries, and **REFLECT NOW** does tonight's reflection at once. It never keeps
anything it read on the web, and never a password, key or card number. If no free model is reachable that night,
it quietly tries again the next.

**Projects that run for days:** for anything too big for one conversation — "research the best way to do X over
the next few days, then build it" — Ghosty proposes a plan of 3 to 12 steps and a pace (steady: a step every 20
minutes; fast: every 3). You approve the plan once; it then works through the steps on its own, research on the
cheap free models and building on the strong ones, so a long job no longer runs a key dry in one go. Every step's
result is filed in the library ("Project: …" on the shelf) and you get a notification as steps finish (every step
for a short project, every third for a long one, and a final report with any links). **Workshop → PROJECTS**
shows each project's progress and steps (tap a done step for its result) with PAUSE, RESUME, CANCEL and RUN NEXT
NOW; saying "carry on" resumes a paused project. If no model is free, a step waits a quarter of an hour; if a step
fails three times, the project pauses and tells you once.

**Teach Ghosty from your own books:** open the **Library** tab and drop in PDFs, Word files, e-books or notes
(or import a web page, an arXiv paper id, a CVE id, a GitHub repo or a Project Gutenberg book by its
number — the whole text, chapter by chapter, free). Reading happens in your browser and
searching uses no AI, so a big library costs nothing. Scanned PDFs (photos of pages) are converted by
Workers AI. Storage: the free plan's Durable Object storage holds several GB — thousands of books' worth of text.

To check which version you're running, open **System → Status → VERSION**. If it says **NEWER SHIPPED**,
press **RELOAD TO GET THE NEW VERSION**.

## 3b. Put Ghosty on your phone (optional)

- **iPhone:** open your Ghosty address in Safari → Share → **Add to Home Screen**. Open Ghosty from the new icon.
- **Android:** open it in Chrome → ⋮ → **Install app**.

Then in **Links → Phone** press **TURN ON NOTIFICATIONS**. Reminders and the results of
scheduled tasks now reach the phone even when Ghosty is closed. **SEND TEST** checks it works.

## 3c. Link your email (optional)

Ghosty can check, search and read your email and send email as you. Every email it sends waits
for your OK, and reading never marks anything as read unless you ask.

**Gmail** (needs 2-Step Verification, myaccount.google.com/security):
1. Open **myaccount.google.com/apppasswords**, type a name (e.g. *Ghosty*) and press **Create**.
2. Copy the 16-letter app password Google shows (not your normal password).
3. In Ghosty open **Links** (tap the GHOSTY logo → LINKS) → **Email**: pick your provider, type your
   address and the app password, and press **LINK EMAIL**. Ghosty signs in once to check it.

**iCloud, Yahoo, AOL, Fastmail:** the same, with an app password from your account's security
settings (the form links to the right page). **Google Workspace** has its own choice. **Any other provider**:
choose *Other* and type the IMAP and SMTP servers too (add `:port` if not 993 / 465; `:587` means STARTTLS). **Outlook.com / Hotmail / Live** can't be linked: Microsoft no longer allows
app passwords for mail. To cut Ghosty off, delete the app password at your provider (or press
UNLINK in Links). Try: *"Any new email?"* or *"Reply to Ann's email and say Friday works."*


## 3d. Link Spotify (optional)

Ghosty can show what's playing on your Spotify and control it ("play some Queen", "skip", "turn it down").
1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → **Create app** (any name).
2. Under **Redirect URIs** add exactly your Ghosty address with a trailing slash, e.g. `https://ghosty.you.workers.dev/`
   (**Links → Spotify** shows it with a **COPY** button). Tick **Web API** and save.
3. Copy the app's **Client ID** into **Links → Spotify** and press **LINK SPOTIFY**, then allow access.

No client secret is needed (PKCE), and the sign-in is kept encrypted in your brain. Reading what's playing works on any
account; play, pause, skip and volume need **Spotify Premium**, and Spotify must be open on some device.
A new Spotify app is in "development mode": add your own Spotify email under the app's **User Management** if it asks.


## 3e. Birmingham, the West Midlands and live traffic

**Works with no key at all** (God's Eye, and in chat):
- **Motorway cameras** — National Highways' public CCTV stills around Birmingham (M6 incl. Spaghetti
  Junction and the Bromford viaduct, M5, M42, M54, A38(M)): a new frame every 20–30 seconds. Ask *"show me the
  cameras at M6 junction 6"* or tap the **CCTV CAMERAS** layer. Birmingham's own streets have no public
  cameras (the council doesn't publish its CCTV), so there Ghosty shows the nearest motorway camera and says so.
  The pictures are Crown copyright, for your own viewing only — they are never republished.
- **Live motorway incidents** — National Highways' own list: crashes, queues, closures, roadworks, with the
  delay in minutes, lanes closed and when it should clear, placed at the junctions they name
  (**ROAD INCIDENTS** layer; ask *"what's happening on the M6?"* or *"any bottlenecks around Birmingham?"*).
  Plus the *usual* speed at this time of day on the nearest stretch, from National Highways' traffic counts
  (not live — the live counts have been paused by National Highways since September 2026).
- **Safety cameras** — West Midlands Police's own enforcement sites: mobile-van sites, average-speed routes and
  motorway variable-limit gantries (the **ANPR / SPEED** layer over the West Midlands, with 2024 offence counts
  and the limit; data published January 2025 — the newer Birmingham average-speed routes announced in 2025 are
  not in it yet), alongside the OpenStreetMap-mapped ANPR and camera locations.
- **Live buses and trams** — the **BUSES & TRAMS** layer and *"buses near me"*: without a key Ghosty uses
  bustimes.org's community feed (updated about once a minute); with the free keys below it uses the official feeds.
- **Journeys** — a door-to-door planner by bus, tram, train, metro, coach and ferry, with the walks between,
  anywhere in the world: press **GO** on God's Eye (FROM is *Here*; LEAVE NOW, LEAVE AT or ARRIVE BY), or ask
  *"how do I get to Moseley?"*, *"train to Coventry at 9"*, *"next buses from New Street"*. The options are
  drawn on the map leg by leg in the line's colour with every stop, and the JOURNEY sheet lists the steps
  (which stop or platform, how many stops, where to get off); tap a step to look there. Free, no key:
  powered by [Transitous](https://transitous.org), a community router over the open timetables operators
  publish; times are live where the operator publishes a live feed (marked *live*), otherwise the timetable.
- **ROAD AHEAD** — say *"I'm driving up the M6"* or press **ROAD AHEAD** on God's Eye: the globe follows your
  phone's GPS heading-up and the panel shows your speed, the nearest junction, and what is ahead of you —
  road reports, safety-camera sites, buses, and the motorway cameras ahead (opened only when you tap one).
  Your position stays on the phone; it never goes to Ghosty's brain.

**Free keys that make it better** (System → Keys, each takes two minutes):
- **TfWM transport** — [api-portal.tfwm.org.uk](https://api-portal.tfwm.org.uk/signup): the official live
  positions of every West Midlands bus and Metro tram (10,000 requests a day). Paste the Application ID and Key
  as `id key`. The feed requires the credit *Powered by TfWM part of West Midlands Combined Authority Open Data*,
  which Ghosty shows.
- **Bus Open Data** — [data.bus-data.dft.gov.uk](https://data.bus-data.dft.gov.uk/account/signup/): live buses
  anywhere in England, every 10 seconds (no trams).
- **TomTom traffic** — [developer.tomtom.com](https://developer.tomtom.com/user/register): every road coloured
  by speed on God's Eye and the numbers (speed vs normal, incidents with delays) anywhere, not just the motorways.
  Dashboard → **Keys** → copy **My first API key** → **Links → Live traffic**. Free: 50,000 map tiles and
  2,500 lookups a day.

Not available anywhere free: Birmingham City Council's street CCTV, National Rail train positions, and live
motorway speed counts (WebTRIS is a monthly archive). Ghosty says so rather than pretending.

## 3f. The Lens: your phone's camera, reading and hands

Open **Systems → LENS** (or tell Ghosty *"read this"* / *"what is this?"*). Everything in the Lens runs
on the phone itself with libraries served from your Ghosty: no picture leaves the phone unless you
press ASK GHOSTY or SEARCH, no account, no key. The first use of each mode downloads its model once
(5–14 MB each) and keeps it. Needs iOS 16.4 or newer (WebAssembly SIMD); Safari will ask for the camera
the first time.

- **SEE** — names what the camera sees as it moves: boxes around 80 kinds of everyday thing (people,
  cars, buses, bikes, dogs, bottles, laptops…), a line about the scene from a 1,000-class classifier,
  and a running count. Tap a box for actions: ASK GHOSTY about it, SEARCH for it (reverse image), READ
  the text on it, SAVE a note. FREEZE holds the frame.
- **READ** — a still (or a photo from your camera roll) is read as text on the phone, with a progress
  bar; the text can be edited, copied, saved to the library (it appears as SCANNED and is searchable,
  on the phone and in Ghosty's memory) or sent to Ghosty as a question — the text, not the picture, so
  any model can answer.
- **HANDS** — 21 points per hand drawn live and seven gestures recognised: thumbs up saves a SEE note,
  open palm freezes, a V flips the camera, a pointing finger captures and reads, a fist stops.
- **ASK** — a question about what the camera sees ("what is this plant?", "translate this sign", "is
  this safe to eat?"). The still goes to a model that can see pictures (Gemini's free key or Workers AI's
  Llama 4 on your own account — never the open Pollinations endpoint); with none reachable Ghosty says so
  and answers from what the phone itself saw (the labels and the text). What the phone saw and any text
  it read go to the brain marked as data, not as your words.
- **SEARCH** — draw a box on a still and open it in Google Lens, Bing Visual Search, Yandex Images or
  TinEye (named as such; each opens in its own tab). The engines need a web address for the picture, so
  the crop is published at `https://<your Ghosty>/i/<random id>` for 24 hours (FORGET NOW removes it
  at once; at most 30 a day).

- **SCAN** — three things in one tile:
  - **CODE**: point at a barcode or QR code and hold still (or PICK PHOTO). A box, a beep, then a card.
    A food or household product shows its name, Nutri-Score, nutrition per 100 g and allergens from
    Open Food Facts (credited on the card: its data is open, ODbL); a book shows title, author, year and a
    description from Open Library; a number nobody knows gets a web search. A QR code with a web address
    shows the address with the real website in bold, warns you about tricks (not https, look-alike names
    like "paypal.com.something-else.ru", hidden addresses, link shorteners) and opens only when you tap
    OPEN. Wi-Fi codes show the network and password (COPY PASSWORD, then Settings → Wi-Fi), contact
    cards, places (SHOW ON MAP), emails and phone numbers are shown plainly. ASK GHOSTY and SAVE send the
    card as text, only when you tap them.
  - **DOCUMENT**: lay the page flat on something darker and CAPTURE PAGE (or PICK PHOTO). Ghosty finds
    the page's corners; drag any that are wrong, then KEEP PAGE — it is straightened to A4 and cleaned up
    (CLEAN UP: OFF keeps the colours). Add more pages, then EXPORT PDF: the share sheet opens (Save to
    Files, Mail, WhatsApp…). READ ALL reads the pages into text you can save to the library.
  - **TRANSLATE**: CAPTURE a sign or a menu (or type the text), pick the language (English first), and
    the text is translated by Workers AI's free translator on your Cloudflare account (no key; a chat
    model stands in when it is unavailable). The phone reads the Latin alphabet; for other scripts,
    type or paste the text.

What the Lens will not do: recognise faces, read number plates to look anyone up, or track people. No
face model is included, and that is on purpose.

## 3g. Recon: what the internet knows about a domain

**Threats → RECON**, or ask *"recon example.com"* in chat. Passive, keyless sources only, and only for
domains, hosts, IPs and web addresses — never a person:

- DNS records and email posture (SPF, DMARC) from dns.google; registration (registrar, dates, name
  servers) from RDAP; every certificate ever issued, and the subdomains they reveal, from crt.sh;
  first and latest snapshots from the Wayback Machine; hosting (network, country, open ports seen by
  Shodan's free InternetDB) for each address; the site's HTTP fingerprint (server, redirects, which
  security headers are missing, robots/sitemap/security.txt).
- Each line names its source. SAVE TO LIBRARY files the report (kind RECON); ASK GHOSTY ABOUT THIS
  sends it to chat, where Ghosty can chain on — fetch the site, import an interesting page, or look up
  a subdomain — in the same turn.

## 3h. Telegram: talk to Ghosty from the Telegram app

Text, voice notes and photos from Telegram, and Ghosty's reminders and task results back to it.
Free; the whole setup is one token and a 6-digit code.

1. In Telegram open **@BotFather** ([t.me/BotFather](https://t.me/BotFather)) and send `/newbot`: a
   name, then a username ending in `bot`. BotFather shows a token (numbers, a colon, then letters).
   Already have a bot? `/mybots` → the bot → **API Token**.
2. In Ghosty open **System → Keys → Telegram bot**, paste the token and press **SAVE**. Ghosty connects
   the bot itself (it points the bot's webhook at your Ghosty, with a secret only the two of them know)
   and shows a 6-digit pairing code — also in **Links → Telegram**, big, with a countdown (15 minutes;
   **NEW CODE** makes another).
3. Open your bot in Telegram, press **START** and send it the code. It answers *"Paired."* From then on
   only you can talk to it: anyone else gets *"This bot answers only to its owner."* once and is ignored.

In the chat, talk as you would in Ghosty: text, a voice note (heard with Workers AI, or your Groq key), or
a photo with a question (it goes to a model that can see pictures). A reply that needs your approval comes
with **APPROVE / DECLINE** buttons; a picture Ghosty made arrives as a photo; `/status`, `/stop` and
`/unpair` work as commands. Things on the screen (the globe, maps, the camera, widgets) only happen in the
Ghosty app, and the brain says so. The conversation is the same one you see in the app.

**With Cloudflare Access (step 5):** Telegram calls `/api/telegram/hook` itself, so the login must let that
one path through — add a **Bypass** policy for the path `/api/telegram/hook`, exactly like `/s/*` and
`/i/*` below. The brain still checks its secret on every call.

The token is kept encrypted in the vault (and its KV mirror), never shown again; **REMOVE** in System →
Keys disconnects the bot. **Links → Telegram → UNPAIR** forgets the chat (a new code pairs it again).

## 3i. Real ears, Ghosty's own voice, and pictures

- **Ears:** press the microphone and talk. The phone records, turns the recording into WAV and the brain
  writes down the words — Groq's Whisper with your Groq key, otherwise Cloudflare Workers AI's Whisper
  (free, no key, there as soon as Ghosty runs on Cloudflare). Voice notes on Telegram are heard the same way.
- **Voice:** **Settings → Voice** has *Ghosty's own voice (from the brain)* — the default: replies are read
  by MeloTTS on Workers AI, the same voice on every device — and *This phone's voice*, which uses the voice
  picked in the list under it. If the brain cannot speak right now (no Workers AI, the day's 2,000 sentences
  used up, a clip that does not play), the phone's voice takes over by itself.
- **Pictures:** say *"draw me a red fox in the snow"*, *"make a logo for my bakery"*. Ghosty writes a full
  description and makes the picture with Workers AI (flux-1-schnell, free): the chat shows it, Telegram sends
  it as a photo, and the link (`https://<your Ghosty>/i/<id>`) lasts 7 days. Up to 40 a day.

## 4. Let Ghosty edit itself

1. GitHub → **Settings → Developer settings → Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories →** this repo
   - Permissions: **Contents: Read and write**, **Pull requests: Read and write**,
     **Commit statuses: Read**, **Checks: Read** (if listed).
2. In Ghosty → **System**, paste it into **GitHub token** and save.
3. Try: *"Add a panel to the Brief tab showing the time in Tokyo and New York."*
   Ghosty reads its code, writes the change and shows it in **Workshop**. Cloudflare builds a
   preview of each change (1–2 minutes); the link appears on the change. Previews start with an
   empty brain (no keys or memory) and no password, so use them to look at the interface only.
   **A preview never asks for your password** — if one does, don't type it. Press **SHIP IT**
   (or say "ship it") to put the change live. **Versions → ↶** rolls back.

If no preview link ever appears, turn on **Worker → Settings → Build → Builds for non-production
branches**. Shipping still works without previews.

Once a day (05:40 UTC, so before you are up) Ghosty also thinks about what it could build for itself,
from what you asked that week, what it couldn't answer and what went wrong. New ideas appear in
**Workshop → UPGRADE IDEAS**, with a notification the first time each one appears. **BUILD** hands an
idea to the chat (it then goes through the same change → preview → SHIP IT flow), **DISMISS** drops it,
and **THINK NOW** asks straight away. Nothing is built or shipped without you; with no free model
reachable that morning it simply tries again the next day.

## 5. Cloudflare login (optional, recommended)

Puts a Cloudflare email-code login in front of Ghosty and its previews.

1. Worker → **Settings → Domains & Routes** → enable **Cloudflare Access** for the workers.dev
   address and previews, allowing only your email.
2. From the Access application's overview, copy the **Application Audience (AUD) Tag**, and
   note your Zero Trust team name.
3. Add `ACCESS_TEAM` and `ACCESS_AUD` under `vars` in `apps/edge/wrangler.jsonc` (and under
   `previews.vars`), then push.
4. Let three paths through without a login, or they stop working: published pages (`/s/*`) are meant
   for other people, the Lens's SEARCH publishes a crop at `/i/<id>` that the reverse-image engines
   must be able to fetch, and Telegram calls `/api/telegram/hook` itself (step 3h). In the Access
   application add a **Bypass** policy for the paths `/s/*`, `/i/*` and `/api/telegram/hook` (Zero Trust →
   Access → Applications → your application → Policies → Add, action Bypass, include Everyone, with the
   path in the application's settings), or make them their own application with a Bypass policy.

## What's protected

Ghosty can change almost all of its own code. It **cannot** change its login lock, permission
rules, encrypted vault, deploy settings, self-edit pipeline or CI checks unless you press
**Workshop → Kernel lock → Unlock for 15 min**. It always asks before shipping a change or
rolling back. It treats web pages and feeds as information, never as orders.

## Free-plan limits

| Service | Free limit | What it means for Ghosty |
|---|---|---|
| Workers | 100,000 requests/day, 10 ms CPU per request | Plenty for one person; the interface's files don't count |
| Durable Objects | 100,000 requests/day, 5 GB, **5 million rows read and 100,000 rows written a day** | Memory, chat, keys and the library. Ghosty reads only the rows it needs; if the daily allowance still runs out, the database pauses until midnight UTC (see below) |
| Workers Builds | 3,000 build minutes/month | Each change is about 1–2 minutes |
| Worker Previews | 100 per Worker | Old previews can be deleted from the dashboard |
| GitHub Actions | 2,000 minutes/month for private repos | About 1 minute per check |

If the Worker's logs show **"Exceeded CPU"** errors often, the Workers Paid plan ($5/month)
raises the limit. Nothing else needs to change.

### Keep Ghosty working when the database is paused

If Cloudflare's free daily database allowance runs out, the database pauses until midnight UTC
(1am UK summer time). Nothing is lost, and there is nothing to set up: Ghosty shows a small
**MEMORY PAUSED** tag and keeps working.

- **Your keys**: every key you give Ghosty (System → Keys, the email login, the Spotify link) is
  kept encrypted in the database and, in the same encrypted form, in a KV mirror (the `VAULT`
  namespace in `wrangler.jsonc`; KV is free with its own allowance, and previews never see it). A key
  saved while paused is kept in the mirror at once and works at once; the brain writes it to the
  database itself on its first request after the reset. Your device also keeps an encrypted copy
  (sealed with your owner key, which the brain never stores) and sends it with each request, as a
  last resort. The System tab shows NOT KNOWN WHILE PAUSED for a key the brain cannot see right now,
  rather than guessing "not set".
- **Your memory, agenda, reminders, widgets and documents** come from the copy on your device.
  Anything you add or change meanwhile shows at once and is saved to Ghosty automatically after the
  reset. Reminders ring from your device while Ghosty is open.
- **Chat and tools**: web search, weather, directions, traffic and cameras, email (with your
  approval, as always), radio, Spotify, the screen and widgets all work. Every tab shows what it last
  knew.
- **Waits for the reset**: importing web pages into the library, push notifications to your phone,
  self-study and code changes.
- **The meter**: System → STATUS shows DATABASE TODAY — how much of the day's allowance is used,
  for reads and writes, and which work used it (chat, searches, the study job, the device mirror…).
  Past 70% the optional readers (self-study, the device's library copy) wait for the reset on their
  own, so a busy day slows Ghosty's reading rather than pausing its memory.

Optional extra backup: you can also save keys as Cloudflare **secrets** (Workers & Pages → ghosty →
Settings → Variables and Secrets → Add → Secret). Ghosty recognises the usual names: `GEMINI_KEY`,
`GEMINI_API_KEY`, `GOOGLE_API_KEY`, `GROQ_KEY`, `GROQ_API_KEY`, `TOMTOM_KEY`, `GITHUB_TOKEN` and so on
(the key's name in capitals, then `_KEY`, `_API_KEY` or `_TOKEN`). Workers Paid ($5/month) removes the
daily limit altogether.

## Troubleshooting

- **Build fails with "Could not detect a directory containing static files"**: the root
  directory isn't `apps/edge` (Worker → Settings → Build).
- **Pairing screen rejects the password**: it must match `OWNER_KEY_HASH` exactly (dashes included).
- **"No AI key is set"**: add one in **System**.
- **Self-edit says not set up**: add the GitHub token (step 4).

## Local preview (optional, for developers)

```
cd apps/edge && npm install && npm test     # also builds the interface
cd ../.. && node tests/preview-server.mjs   # http://localhost:8788, owner key printed
```
