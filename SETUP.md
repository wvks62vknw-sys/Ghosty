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
Add several free keys (Gemini, Groq, Cerebras, OpenRouter, Mistral): Ghosty spreads its work across all of
them, so it runs out far less often, and a provider whose daily allowance is used up is left alone until it
resets. Two more free sources need no key at all:
- **Cloudflare Workers AI** is connected automatically (the `ai` binding in `apps/edge/wrangler.jsonc`) and
  used when the keys are busy — a free daily allowance on your own Cloudflare account.
- **Pollinations** (an open text endpoint, one reply every 30 seconds, best effort) is the last resort for
  chat and the first choice for Ghosty's own study drills, so your keys stay yours. Nothing secret is ever
  sent there. Set the `KEYLESS_MODELS` variable to `0` in `wrangler.jsonc` if you would rather it never
  used an open endpoint.

**Ghosty studies on its own:** the Library tab's **SELF-STUDY** panel shows what it reads around the clock
(a curriculum of thousands of topics across maths, science, computing, finance, law, health, history and
more, from Wikipedia, MDN, arXiv, OpenStax and the Swift book), the study notes it writes with a free
model, and how its self-set drills go. Type a field into FOCUS to put it first. Everything it learns is
filed in the library (open any notebook on the shelf); **EXPORT TO GITHUB** writes every notebook as
Markdown to a `library` branch of your repository, so it costs nothing on your phone and is readable
anywhere. It stays within the free plan on its own: it waits while the day's database allowance is low.

**Teach Ghosty from your own books:** open the **Library** tab and drop in PDFs, Word files, e-books or notes
(or import a web page, an arXiv paper id, a CVE id or a GitHub repo). Reading happens in your browser and
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


## 3e. Live traffic (optional, free)

God's Eye shows live public CCTV where operators publish it (London, County Durham, New York, California,
Finland, Ontario, British Columbia, Sydney, Calgary). Many places — Birmingham included, and National
Highways' motorway cameras — don't publish theirs, so for everywhere else Ghosty uses live traffic:
1. Create a free account at [developer.tomtom.com](https://developer.tomtom.com/user/register) (no card).
2. Dashboard → **Keys** → copy **My first API key**.
3. In Ghosty: **Links → Live traffic** (or **System → Keys → TomTom traffic**), paste it and press **SAVE**.

Then ask *"show me the cameras in Birmingham city centre"* or *"how's the traffic on the M6?"*: God's Eye
flies there with every road coloured by speed, and Ghosty lists crashes, closures and queues with delays.
The free plan allows 50,000 map tiles and 2,500 lookups a day.

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

## 5. Cloudflare login (optional, recommended)

Puts a Cloudflare email-code login in front of Ghosty and its previews.

1. Worker → **Settings → Domains & Routes** → enable **Cloudflare Access** for the workers.dev
   address and previews, allowing only your email.
2. From the Access application's overview, copy the **Application Audience (AUD) Tag**, and
   note your Zero Trust team name.
3. Add `ACCESS_TEAM` and `ACCESS_AUD` under `vars` in `apps/edge/wrangler.jsonc` (and under
   `previews.vars`), then push.

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
