# NEXT ROUND: SECURITY

Your lane: **Security**. Read `docs/build-plan/NEXT-ROUND.md` first: the rules, how the code is checked, and the protocol. This file is your work, in order.

## The big moves you are part of

- **One list and one morning page** (led by PLAN). You get one to-do list and one day-and-week timeline that every screen reads and changes, so there are no more separate copies. Each morning the Brief picks up a live line from every room, so one page tells you your whole day. Yours: `security.c1`.
- **The camera as the front door** (led by LENS). Whatever you point the Lens at, it offers the next useful step: a receipt goes to Money, a poster to the diary, a book to the shelf, a letter into an editable document. The camera becomes the quickest way into every room. Yours: `security.c2`.
- **Safe, private and in your hands** (you LEAD it: make the pieces meet as one thing). One screen shows every lock in green, amber or red, every approval is listed, and you get a few seconds to take one back before it leaves. Your backups, your data and other people's turns at the mic stay visibly under your control. Yours: `security.u1`, `security.s10`, `security.u5`, `security.u4`, `security.u6`, `security.u7`, `security.u11`, `security.c4`, `security.s2`.

## 1. The next round: build every one, whole and specialist-grade

- **A Security screen of its own** (`security.u1`, M). One screen with a green, amber or red line for sign-in, last backup, keys, faces, Telegram, previews and recent approvals.
  - Their words: A Security screen of its own. Why: One place showing: how you're signed in, last backup, keys added, faces kept, Telegram paired, previews on/off, the last approvals, with a green/amber/red line each. Builds on: SYSTEM's STATUS and PRIVACY panels, the health checks.
  - Why now: One green, amber or red screen shows all your locks at once as Ghosty takes on more abilities.

## 3. Finish what is half done

- **Doors that slow down hammering** (S). Missing: Counted per Cloudflare server, so it is best effort rather than a hard limit. Fix: Add Cloudflare's free rate-limit rule for the public doors; a short step-by-step guide in System can walk you through it.
- **Change previews kept apart** (S) (picked for this round). Missing: Branch previews may still run with your live secrets. Fix: In Cloudflare, switch off branch previews or give them their own settings without your live keys.

## 4. Soon: build them all once 1 to 3 are whole

- **Waiting approvals reach your lock screen** (`security.s10`, S). A waiting APPROVE also arrives as a phone notification that opens straight on its card, so nothing sits unseen. *Reshaped to keep his rules: Reshaped: iPhone web notifications can't carry buttons, so a tap opens the card and you approve there.*
  - Their words: Approve from the lock screen. Why: APPROVE / NOT NOW right in the notification. Builds on: push notifications, approval cards.
- **A few seconds to take it back** (`security.u5`, M). After you approve a send or a post, a short countdown lets you cancel before it actually leaves.
  - Their words: Undo window after APPROVE. Why: A few seconds to cancel an approved send or post before it leaves. Builds on: the approval flow, the social queue.
- **Show which page planted the words** (`security.u6`, S). When reading a page leads to an approval card, the card names that page, so you can judge the instruction yourself.
  - Their words: 'Why was this asked?' on the planted-words card. Why: The card names the page whose words came before it, so you can see the planted instruction yourself. Builds on: the planted-words guard, the trail.
- **A nightly self-check** (`security.u7`, S). Each night Ghosty checks its own locks (vault key, previews, demo, backup age) and tells you once in the Brief if anything slipped.
  - Their words: Daily self-audit. Why: Each night the brain checks itself (key length, vault key set, previews, demo on, backup age) and tells you once if anything slipped. Builds on: the daily jobs, the health checks.

## 5. Later: build the best of these, as many as stay whole and green; list the rest in your report

- **Owner key check and change** (`security.u2`, M). Ghosty warns if your key is too short and walks you through a new long random one without losing your keys or backups.
  - Their words: Owner key strength check and rotation. Why: Ghosty tells you if your key is too short, and walks you through a new long random one without losing the vault or backups. Builds on: owner key sign-in, the vault's re-seal, backup.
- **Slow-made lock on your keys copy** (`security.u3`, S). Your phone's copy of your service keys gets the same slow, hard-to-guess lock your daily backup already uses. *Reshaped to keep his rules: As written it is already built: the phone backup is locked with 600,000 rounds. The keys copy inside it still uses one quick scramble, so the fix moves there.*
  - Their words: Slow-made backup lock. Why: Make the backup's key the slow, guess-resistant way, reading old backups as before and writing new ones safer. Builds on: encrypted backup.
- **A list of every approval** (`security.u4`, S). Every APPROVE and NOT NOW in one list, with what, when and whether it came from the phone or Telegram.
  - Their words: An approvals history. Why: Every APPROVE and NOT NOW in one list (what, when, from phone or Telegram), so you can see what Ghosty did for you. Builds on: the approval cards, the trail.
- **Guided free limits on public doors** (`security.u8`, S). A step-by-step guide to switching on the free rate limit in your Cloudflare account, so anyone hammering the public doors is stopped hard.
  - Their words: Hard limits via free Cloudflare rules. Why: A guided one-time setup of Cloudflare's free rate-limit rules for the public doors. Builds on: the doors' allowances.
- **A CHECK key on links** (`security.u9`, S). Links in replies and feeds get a small CHECK key showing where they really go and any scam signs, before you open them. *Reshaped to keep his rules: Reshaped: iPhone keeps long-press on links for itself, so it is a key, using the scam check that already exists.*
  - Their words: Link check before you tap. Why: Long-press any link to see where it really goes and whether it looks like a known scam pattern. Builds on: the guardian's link check, safe links.
  - Also covers `lens.u13`: Scam check for QR links. Before a link from a parking sticker opens, it's checked against free public lists of known scam sites (none that need a key) and you get a clear warning.
- **Tighter rules for the app's pages** (`security.u10`, M). Tighten the app's page rules so stray code has even fewer ways in; you won't see it, but Ghosty gets harder to trick.
  - Their words: Stricter page policy. Why: Trusted Types and a tighter media list in the app's page policy, now that only a handful of raw-HTML spots remain. Builds on: the tightened page headers.
- **One tap to lock everything** (`security.u11`, M). One tap or 'lock everything' unpairs Telegram and pauses the demo and publishing until you unlock with your key.
  - Their words: Panic button. Why: One tap (or 'lock everything'): ends all phone sessions, unpairs Telegram, pauses the demo and publishing until you unlock with your key. Builds on: sign-in, Telegram unpair, demo switch.
- **Find weak or reused passwords** (`security.s1`, M). Open your password manager's export on the phone and see which passwords are reused or weak; nothing leaves the phone.
  - Their words: Password health from your own exports. Why: Check a password-manager export on the phone for reused or weak passwords; nothing leaves the phone. Builds on: safe file imports, on-phone processing.
- **Has this password leaked?** (`security.s2`, S). Check a password against the free public list of leaked ones; only a five-character piece of its scrambled form ever leaves the phone.
  - Their words: Has this password leaked?. Why: Check a password against the free public list of leaked passwords; only the first few characters of its scrambled fingerprint ever leave the phone, never the password. Builds on: public-web-only reading, on-phone processing.
- **A walk through your phone's privacy** (`security.s5`, S). A guided check of your iPhone's own privacy settings, location sharing and app permissions, in plain steps.
  - Their words: Phone privacy walkthrough. Why: A guided check of the phone's own settings (location sharing, app permissions) in plain steps. Builds on: the coach, checklists.
- **Locked notes** (`security.s6`, M). A notes page locked with your key, kept on the phone and inside the locked backup.
  - Their words: Secure notes. Why: A notes page locked with your owner key, kept on the phone and in the encrypted backup. Builds on: the backup lock, the workspace.
- **Travel mode** (`security.s8`, M). Hide chosen screens and memories until you switch them back yourself, for crossing borders; no location used.
  - Their words: Travel mode. Why: Hides chosen screens and memories until you switch it off yourself (no location used). Builds on: settings, memory.
- **Approvals in the Brief** (`security.c1`, S). The morning Brief lists what you approved yesterday and anything still waiting for you.
  - Their words: Approvals in the Brief. Why: The morning Brief lists yesterday's approvals and anything still waiting. With: PLAN AND HOME (build it into their area, small and additive).
- **Scam check on letters in the Lens** (`security.c2`, S). Point the Lens at a letter and tap CHECK FOR A SCAM, using the same public checks; QR links already get warnings. *Reshaped to keep his rules: Partly built: QR links in the Lens already show scam warnings before opening.*
  - Their words: Scam check in the Lens. Why: Point the camera at a letter or a QR code and hear whether it looks like a scam, before you scan or pay. With: LENS (build it into their area, small and additive).
- **Approvals read aloud while talking** (`security.c4`, S). When an approval comes up while you're talking, Ghosty reads exactly what will happen aloud; you still tap APPROVE yourself. *Reshaped to keep his rules: Your voice is never a lock on its own, so the approve itself stays a tap.*
  - Their words: Spoken APPROVE read back. Why: When you approve by voice, Ghosty first reads back exactly what will happen; recognising your voice never replaces APPROVE. With: VOICE, MEANINGS AND COLOURS (build it into their area, small and additive).
- **Share what you make by expiring link** (`security.c5`, M). Share a document, deck or game by a link that ends after a day, with private details flagged before it goes.
  - Their words: Safe sharing of what you make. Why: Documents, decks and games shared by an expiring link, with private details flagged before they go. With: MAKE / EDITORS (build it into their area, small and additive).

## 6. Everything else, at the level of the best app of its kind (his words: "every single little feature … the absolute best", "and even more things")

Go screen by screen through your lane and compare each with the best dedicated apps of its kind (1Password Watchtower, Have I Been Pwned and Apple's Safety Check). For each screen, list what they have that Ghosty lacks and build it, within his rules. Then fix every rough edge you find: a dead key, a missing state in his words, a slow open, a cut word at BODY 21, a look that breaks in one of the seven worlds. Add your own ideas too. Put the list, with what you built and what is left, in your report.

## Built into your area by other lanes (expect their small additions; keep their intent when you merge)

- `consistency.c3` from CONSISTENCY: Security status in the house
- `voice.c6` from VOICE: Guardian on an unknown voice

## Left out (do not build these as written)

- `security.u12` Per-key usage watch: Already built: AI ROOM shows each service's use today against its allowance; the warning part is polish3.s9.
- `security.s3` Scam message checker: Already built: 'is this a scam?' and forwarded Telegram messages are checked from public records with no keys.
- `security.s4` Your domain's health: Already built: the domain look-up reads certificates, email-spoofing records and page headers from public sources.
- `security.s7` Share once, then gone: Duplicate of sharing what you make by expiring link; Lens pictures already share for 24 hours.
- `security.s9` List of your phones: Already built: Links → Notifications lists each device with a remove key and UNDO.
- `security.c3` Money-safe mode: Mostly built: forwarded messages are already scam-checked and every payment already waits for APPROVE.
