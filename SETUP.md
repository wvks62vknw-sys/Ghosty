# Setting up Ghosty 2.0

About 20–30 minutes, once. Everything here is on free plans.
You need: a **GitHub** account and a **Cloudflare** account.

Ghosty has two parts that Cloudflare builds straight from your GitHub repository:

- **ghosty-brain**: a Worker. It holds the AI, memory and keys, and runs the tools. It has no public address.
- **ghosty**: a Pages site. This is the interface you open. It passes `/api` requests to the brain.

---

## 1. Put the code on GitHub

Create a **private** repository called `ghosty` and put this folder's contents in it, with
`MAP.md` at the top level. You can upload through the GitHub website (drag the files in) or
push with git. Your default branch must be `main`.

## 2. Make two secrets

Open any browser tab, press **F12** (or right-click → Inspect), go to **Console**, paste this
and press Enter:

```js
const r = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
console.log('VAULT_KEY =', r(), '\nOWNER_KEY =', r());
```

Keep both somewhere safe, such as a password manager:
- **VAULT_KEY** encrypts your API keys inside the brain. Never change it, or saved keys stop working.
- **OWNER_KEY** is your password for Ghosty until you set up step 6.

## 3. Deploy the brain (Worker)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository**. Pick `ghosty`.
2. Project name: **`ghosty-brain`**. Root directory: **`apps/edge`**. Deploy command: `npx wrangler deploy`.
3. Deploy. It may say the brain isn't secured yet; that's expected.
4. Open the Worker → **Settings → Variables and Secrets** and add:

| Name | Type | Value |
|---|---|---|
| `VAULT_KEY` | Secret | from step 2 |
| `OWNER_KEY` | Secret | from step 2 |
| `OWNER_EMAIL` | Text | your email |
| `GITHUB_REPO` | Text | `your-github-username/ghosty` |
| `PAGES_PROJECT` | Text | `ghosty` |

## 4. Deploy the interface (Pages)

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick `ghosty`.
2. Project name **`ghosty`**, framework preset **None**, build command **`npm run build`**,
   output directory **`dist`**, root directory **`apps/web`**. Save and deploy.
3. Open the Pages project → **Settings → Bindings → Add → Service binding**: variable name
   **`BRAIN`**, service **`ghosty-brain`**. Add it for both **Production** and **Preview**.
4. **Deployments** → latest → **Retry deployment**, so the binding takes effect.

> **Your site address.** If `ghosty.pages.dev` is already taken, Cloudflare gives you something like
> `ghosty-4xk.pages.dev`. Wherever this guide says `ghosty.pages.dev`, use your address, and
> set the brain's `PAGES_PROJECT` to the part before `.pages.dev` (e.g. `ghosty-4xk`).

## 5. Open Ghosty

Go to `https://ghosty.pages.dev`. On the pairing screen, enter your **OWNER_KEY**. Then go to
**System** and add a free AI key. **Gemini** (aistudio.google.com/apikey) is the best free
model for building things; **Groq** (console.groq.com/keys) is the fastest for chat and gives
you Whisper speech recognition.

## 6. Lock it to you with Cloudflare Access (recommended)

This puts a Cloudflare login (a one-time email code) in front of Ghosty and its previews, so nobody else can reach it.

1. Dashboard → **Zero Trust**. Choose a team name, for example `ghosty-yourname`, on the free plan.
2. **Access → Applications → Add an application → Self-hosted.**
   Add both domains: `ghosty.pages.dev` and `*.ghosty.pages.dev`.
   Add a policy: **Allow**, Include **Emails**, set to your email.
3. On the application's **Overview** page, copy the **Application Audience (AUD) Tag**.
4. On the brain Worker (step 3.4), add the text variables `ACCESS_TEAM` (your team name) and `ACCESS_AUD`.

Ghosty now accepts your Cloudflare login. Keep `OWNER_KEY` as a backup, or delete it so the
Cloudflare login is the only way in.

## 7. Let Ghosty edit itself

1. GitHub → **Settings → Developer settings → Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories → `ghosty`**
   - Permissions: **Contents: Read and write**, **Pull requests: Read and write**,
     **Commit statuses: Read**, **Checks: Read** (if listed). Metadata is read-only by default.
2. In Ghosty → **System**, paste it into **GitHub token** and save.
3. Try: *"Add a panel to the Brief tab showing the time in Tokyo and New York."*
   Ghosty will read its code, write the change and open it in **Workshop**, with a preview link
   once Cloudflare has built it (1–2 minutes). Check the preview, then press **SHIP IT** (or say "ship it").
   Changes to the brain go live when shipped. **Versions → ↶** rolls back to any earlier version.

## What's protected

Ghosty can change almost all of its own code. It **cannot** change its login lock,
permission rules, encrypted vault, self-edit pipeline or CI checks unless you press
**Workshop → Kernel lock → Unlock for 15 min**. It always asks before shipping a change or
rolling back. It treats web pages and feeds as information, never as orders.

## Free-plan limits

| Service | Free limit | What it means for Ghosty |
|---|---|---|
| Workers | 100,000 requests/day, 10 ms CPU per request | Plenty for one person |
| Durable Objects | 100,000 requests/day, 5 GB | Memory, chat and keys |
| Pages | 500 builds/month | About 15 self-edits a day |
| GitHub Actions | 2,000 minutes/month for private repos | About 1 minute per check |

If the brain's logs (Worker → Logs) show **"Exceeded CPU"** errors often, the Workers Paid plan
($5/month) raises the limit. Nothing else needs to change.

## Troubleshooting

- **"BRAIN service binding is missing"**: redo step 4.3, then redeploy Pages.
- **Pairing screen keeps rejecting the key**: check `OWNER_KEY` on the Worker. It must be at least 24 characters.
- **"No AI key is set"**: add one in **System**.
- **Self-edit says not set up**: check `GITHUB_REPO` (format `user/ghosty`) and the GitHub token.
- **Preview link 404s**: the Pages build takes 1–2 minutes. Ask Ghosty to *"check change #N"*.

## Local preview (optional, for developers)

```
cd apps/edge && npm install && npm test
cd ../web && npm install && npm run build
cd ../.. && node tests/preview-server.mjs   # http://localhost:8788, owner key printed
```
