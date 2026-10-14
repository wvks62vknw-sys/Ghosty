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

No secrets are needed. The brain makes its own encryption key for the API keys you give it.
To set your own instead, add a `VAULT_KEY` secret (32 random bytes, base64) **before** saving
any keys, and never change it afterwards.

**Changing the owner password:** pick a long random password, put its SHA-256 in
`OWNER_KEY_HASH` (in a browser console:
`[...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR-PASSWORD')))].map(b=>b.toString(16).padStart(2,'0')).join('')`),
and push. Or add an `OWNER_KEY` secret on the Worker with the password itself (24+ characters).

## 3. Open Ghosty

Your address is shown on the Worker's overview page (**Domains & Routes**). Open it, enter your
owner password on the pairing screen, then go to **System** and add a free AI key:
**Gemini** (aistudio.google.com/apikey) is the best free model for building things;
**Groq** (console.groq.com/keys) is the fastest for chat and gives Ghosty speech recognition.

## 4. Let Ghosty edit itself

1. GitHub → **Settings → Developer settings → Fine-grained tokens → Generate new token**.
   - Repository access: **Only select repositories →** this repo
   - Permissions: **Contents: Read and write**, **Pull requests: Read and write**,
     **Commit statuses: Read**, **Checks: Read** (if listed).
2. In Ghosty → **System**, paste it into **GitHub token** and save.
3. Try: *"Add a panel to the Brief tab showing the time in Tokyo and New York."*
   Ghosty reads its code, writes the change and shows it in **Workshop**. Cloudflare builds a
   preview of each change (1–2 minutes); the link appears on the change. Previews start with an
   empty brain (no keys or memory), so use them to look at the interface. Press **SHIP IT**
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
| Durable Objects | 100,000 requests/day, 5 GB | Memory, chat and keys |
| Workers Builds | 3,000 build minutes/month | Each change is about 1–2 minutes |
| Worker Previews | 100 per Worker | Old previews can be deleted from the dashboard |
| GitHub Actions | 2,000 minutes/month for private repos | About 1 minute per check |

If the Worker's logs show **"Exceeded CPU"** errors often, the Workers Paid plan ($5/month)
raises the limit. Nothing else needs to change.

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
