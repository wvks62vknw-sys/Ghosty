# Deploy your own Ghosty

Plain steps from a fork to a Ghosty of your own on your own Cloudflare account (the Workers free plan). Nothing is shared:
your Ghosty is a separate brain with its own storage, its own keys and its own owner, you. Nothing of the person who made
this repository comes with it, and nothing of yours goes anywhere else. Allow about half an hour, most of it waiting.

## What you need

- A free **Cloudflare** account (no card is needed for the free plan).
- A free **GitHub** account, to fork this repository.
- An **iPhone or Android phone** with a modern browser (Safari 16+ or Chrome). Ghosty is a web app: you add it to your Home
  Screen and it opens like any other app.
- A way to keep one long password: iCloud Keychain / Passwords, or any password manager. It is the only way into your Ghosty,
  and nobody (not Cloudflare, not me) can recover it for you.

## 1. Fork

On GitHub, open this repository and press **Fork**. You now have your own copy; every change below is made in your copy.

## 2. Take the previous owner's settings out of `wrangler.jsonc`

`wrangler.jsonc` (at the top of the repository) is the deploy configuration. In the original it holds the first owner's own
settings. They are harmless to anyone else but they are not yours, and the deploy will fail on the ones that name his Cloudflare
account, so change them in your fork:

| Setting | What to do |
| --- | --- |
| `OWNER_KEY_HASH` (under `vars`) | **Delete the line.** It is the fingerprint of the first owner's password; with it left in, your Ghosty would accept his password and not yours. Your own is made in step 5. |
| `OWNER_EMAIL` (under `vars`) | Delete it, or put your own address: it is only used with Cloudflare Access, which you do not need. |
| `GITHUB_REPO` (under `vars`) | Put your fork, as `your-name/Ghosty`. (Only used if you later give Ghosty a GitHub token so he can change his own code.) |
| `PUBLIC_ORIGIN` (under `vars`) | Put the address your Worker will have, `https://ghosty.<your-subdomain>.workers.dev`, once you see it in step 4 (you can leave it for now and change it after). |
| `kv_namespaces`, the two bindings `SITES` and `VAULT` | **Delete both entries**, in `wrangler.jsonc` and in `apps/edge/wrangler.jsonc`. Their ids are namespaces in the first owner's account. Ghosty works without them (pages he publishes and keys are kept in his own database instead). If you want them, create your own (`wrangler kv namespace create SITES`) and put in your ids. |
| `previews` block | Delete its `kv_namespaces` entry for the same reason. |

Keep the two files in step: `apps/edge/test/config.test.mjs` checks that they agree.

Everything else stays as it is: the Durable Object (`GhostyAgent`) and its migration are what give your Ghosty a brain of his
own, the `ai` binding is Cloudflare's free Workers AI, and `assets` is the app itself.

## 3. Deploy

Any one of these. (All three build the app with `npm run build` in `apps/web` and deploy the Worker in `apps/edge`.)

- **From Cloudflare's dashboard:** Workers & Pages, Create, *Import a repository*, choose your fork, leave the build settings
  as they are (the repository's own `wrangler.jsonc` says what to run), Deploy.
- **The deploy button:** open `https://deploy.workers.cloudflare.com/?url=https://github.com/<you>/Ghosty` and follow it.
  Cloudflare copies your fork into your account and deploys it.
- **From a computer:** `git clone` your fork, then `npm install` and `npx wrangler login` and `npx wrangler deploy`.

## 4. Open it on your phone

Cloudflare shows the address of your Worker, `https://ghosty.<your-subdomain>.workers.dev`. Open it in Safari or Chrome on
your phone. It is secured by default: until you set an owner it refuses every request except a health check, and the app knows that means "no owner yet".

## 5. The first run (the app walks you through it)

The first time, with no owner set, the app opens a short wizard instead of the sign-in:

1. **Make your key.** It makes a long random key on your phone and shows it. Copy it into Passwords (or any password manager)
   now. It is stored on this phone, and nowhere else.
2. **Tell Cloudflare it is yours.** The wizard also shows a second value: the *fingerprint* (SHA-256) of your key. In the
   Cloudflare dashboard, open your Worker, **Settings, Variables and secrets, Add**: name `OWNER_KEY_HASH`, type *Secret*,
   value the fingerprint, then Deploy. The key itself is never sent to Cloudflare, only its fingerprint, so nobody who can
   read your Cloudflare settings can read your key. (If you would rather set your own password, put its SHA-256 here instead:
   `printf %s 'your password' | shasum -a 256`.)
3. **Pair this phone.** Press I ADDED IT: the app checks that your Worker now knows the fingerprint and signs this phone in.
4. **Your name.** What should he call you?
5. **Home.** An address or a postcode, saved in your own brain (skip it if you prefer; add it any time under Memory).
6. **Three things to try**, and you are in.

Then add it to your Home Screen (Safari: Share, Add to Home Screen) so it opens as an app.

If you already have a key (or you set `OWNER_KEY_HASH` yourself), the wizard's first screen has *I already have a key* and
goes straight to the sign-in.

## 6. Keys you may add, and what each one unlocks

None is needed to start. Ghosty works from the first minute on Cloudflare's free Workers AI, the public feeds, and the phone
itself; one free AI key makes him noticeably better, and the app's KEYS screen marks the one it would like most. In SYSTEM, KEYS
on the phone you can add any of these; each goes into your brain's encrypted vault (and a sealed copy on your phone) and nowhere
else:

| Key | What it unlocks | Cost |
| --- | --- | --- |
| Google AI Studio, Groq, Cerebras, OpenRouter, Mistral AI, NVIDIA, SambaNova, Cohere | A better and faster AI, and more of it when a free allowance is used up; Groq also lets him understand your voice. Each key's own screen says which provider and how to get it | free tiers (some ask for a phone number) |
| GitHub token | He can change his own code when you ask (new panels, fixes), and export his library | free |
| Telegram bot | Talk to him from Telegram: text, voice notes, photos; his notifications there | free |
| Tavily, Brave | Better web search (otherwise DuckDuckGo) | free tiers (Brave may ask for a card) |
| TomTom, Mapbox | Live traffic detail; extra map styles | free tiers |
| TfWM, Bus Open Data | UK buses and trams, live | free |
| DVSA MOT history, DVLA vehicle enquiry | Vehicle checks by registration (UK) | free |
| AISstream | Live ships everywhere (the Baltic works without) | free |
| Email (an app password) | He can check, search and read your email, and send as you (each one waits for your OK) | free |
| Hugging Face, Kaggle | The 3-D model maker; free GPUs for training the offline brain | free |
| Pl@ntNet | Plant names from a photo | free |
| Website form (Formspree) | A contact form on a website he builds for you, sending to your inbox | free tier |

Spotify is linked from LINKS (playback needs Spotify Premium, Spotify's rule).

## 7. What is free, and what is not

On the free plan nothing bills by surprise: when a free allowance runs out, that part rests until midnight UTC; Cloudflare does
not charge you for it. At the time of writing (check Cloudflare's pricing page, these move):

- Workers: 100,000 requests a day. The app's own files are served free.
- Durable Objects (his brain's database): 100,000 requests a day, 5 million rows read and 100,000 rows written a day.
- Workers AI: a free daily allowance of "neurons" (about 10,000): enough for ordinary chat; more AI keys (above) spread the load.
- KV (only if you add it): 100,000 reads and 1,000 writes a day.

What **would** cost money, only if you choose it: a paid Workers plan; a paid tier on a key above; a custom domain name. Nothing in
Ghosty buys, subscribes or pays for anything, and anything that matters waits for your OK.

## 8. What never leaves your phone

The camera and the microphone (the Lens, the tuner and the coach, counting your reps): what they see and hear is worked on
by code on your phone and is not sent. People and faces you teach him are kept on the phone. A run's route is held in memory and
never saved. The offline brain, if you download one, lives in your phone's storage. Your key stays on your phone; Cloudflare
holds only its fingerprint. Your sealed key copy is encrypted before it leaves.

What your brain holds (your memory, agenda, places, chat history and the keys you add) is in your own Durable Object, on your
own Cloudflare account, and nowhere else. There is no shared server, no account with anyone, no analytics.

## 9. The review link, and switching it off

Your Ghosty also serves `/demo`, a read-only demo of the app on made-up sample data (a person called Sam), with a tour page at
`/demo/tour`: send it to someone who would like to look, and nothing of yours is in it (its own separate brain, with no keys
and no way into yours). It is capped, and it asks for nothing. To close it at once, add the variable `DEMO_OFF` with the value
`1` in the Cloudflare dashboard (Settings, Variables and secrets): the pages answer "not found" and the door is shut.

## 10. Licences of what is inside

Ghosty's own code is the repository's. The engines and models vendored in `apps/web/public/vendor` keep their own licences, each
folder holding the licence text and a note of where it came from:

| In | What | Licence |
| --- | --- | --- |
| `vendor/stockfish` | Stockfish 19 (lite, single-threaded WebAssembly), for rated chess | GPL-3.0 (`LICENCE`; source: upstream, named in `SOURCE.md`) |
| `vendor/doom` | the DOOM engine (doomgeneric), for the arcade (the free game data is fetched on a tap) | GPL-2.0 |
| `vendor/quake` | WebQuake, for the arcade | GPL-2.0 |
| `vendor/dos` | DOSBox in WebAssembly (the `emulators` package) | GPL-2.0 |
| `vendor/mediapipe`, `vendor/pose` | MediaPipe Tasks Vision and its pose model, for the Lens and counting reps | Apache-2.0 |
| `vendor/models` | MediaPipe's EfficientDet-Lite0 object detector, EfficientNet-Lite0 classifier and gesture recogniser, for the Lens | Apache-2.0 according to their MediaPipe model cards (this repository does not restate it: check before you redistribute) |
| `vendor/tesseract` | Tesseract.js and its core, reading text from a picture | Apache-2.0 |
| `vendor/clip` | ONNX Runtime Web (MIT) and MobileCLIP-S0, which names what the camera sees | MIT; the MobileCLIP weights carry Apple's research-model licence: read `LICENSE-mobileclip-weights.txt` before you use your Ghosty for anything but yourself |
| `vendor/depth` | Depth Anything V2 (the small model), for measuring | Apache-2.0 (see its README about the metric checkpoint, which carries no licence tag) |
| `vendor/faces` | SFace, from the OpenCV Zoo | see its README and `LICENSE-sface.txt` |
| `vendor/webllm` | WebLLM, the offline brain's runtime (the model weights come from Hugging Face on a tap) | Apache-2.0 |
| `vendor/three`, `vendor/leaflet`, `vendor/maplibre`, `vendor/zxing` | three.js; Leaflet; MapLibre GL; the barcode reader | MIT; BSD-2; BSD-3; MIT and Apache-2.0 |
| `models` | sample 3-D models from the Khronos glTF sample assets | CC0 / CC BY 4.0, each credited where it is shown |

Because the app ships GPL-licensed engines, anyone you give a copy of your deployed app to is entitled to the source of those
parts, which is upstream's (linked in each `SOURCE.md`) and this repository's.

## If something goes wrong

- *The wizard says the key is not accepted yet.* The variable may not have deployed: wait a minute, check its name is exactly
  `OWNER_KEY_HASH` and its value is the fingerprint the wizard showed, and press I ADDED IT again.
- *The deploy fails on KV.* You left the first owner's `kv_namespaces` in `wrangler.jsonc`: delete them (step 2).
- *You lost your key.* Make a new one: delete `OWNER_KEY_HASH` in the dashboard, deploy, and the wizard comes back on a phone
  that has no key saved. Your brain's data is kept; only the way in changes.
