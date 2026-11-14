# NEXT ROUND: SECURITY (lane-security), 14 November 2026

This round's big move is **"Safe, private and in your hands"**, and this lane leads it. The aim: all your locks on one screen, every
approval listed, and the fixes that live in your Cloudflare account set out as plain steps.

## What I built

### Settings → SECURITY, a screen of its own (security.u1)
- One line per lock, each **green, amber or red** with a word (OK, LOOK or FIX), and the count at the top ("7/9 locks green"):
  - **Sign-in:** your owner key's length. 32 or more characters is green; a shorter one works but shows amber. With Cloudflare
    Access it is green.
  - **Backup:** green within a day and a half, amber within a week, red after that, or if it failed, or if there is none.
  - **Your keys:** green when the lock on your service keys has its own key kept as a Cloudflare secret (VAULT_KEY); amber when
    that key is kept beside them.
  - **Faces:** how many are kept, on this phone only.
  - **Telegram:** not linked, or paired with your chat only, is green. Linked but waiting for the pairing code is amber.
  - **Previews:** green when no change previews are built, amber when they are on.
  - **Demo:** amber while the public demo is open (it only ever shows a made-up Sam), green once DEMO_OFF=1 closes it.
  - **Public doors:** amber until you add Cloudflare's free rate-limit rule and tap DONE.
  - **Approvals:** how many you approved and turned down this week.
- An amber line with a fix opens STEPS at that guide.
- Nothing secret ever reaches the screen. The brain answers yes or no for each of its locks, and the only thing read about your
  owner key is its length, on the phone.
- When the brain can't be reached, the phone's own locks still show, and the brain's lines say they can't be checked right now.

### Every approval, listed (security.u4)
- Every APPROVE and NOT NOW, from the phone or from Telegram, in one list: what it was, whether you said yes, where you answered,
  and when.
- CLEAR LIST empties it. Nothing you approved is undone.

### The card names the page whose words came before it (security.u6)
- When reading a page or a feed leads to an approval card, the card says "Asked after reading <that page>: judge its words
  yourself."
- The approvals list keeps that page too.

### A waiting APPROVE reaches your lock screen (security.s10)
- When you walk away from a waiting approval, a phone notification says what is waiting, as Telegram already did.
- It is sent once per approval, and only for the approval really waiting.
- A tap opens the chat at the card, and you answer there. An iPhone notification from a web app can't carry buttons, and the
  answer is always your tap.

### STEPS: the fixes that live in your Cloudflare account (the two half-done items, security.u8, and more)
- **Stop hammering hard:** the free rate-limit rule for the public doors, with its exact settings. DONE turns that line green.
- **Keep previews apart:** turn off preview addresses, or give previews their own settings without your live keys.
- **Give the keys' lock its own key:** MAKE ONE makes a random VAULT_KEY on the phone, shown once and kept nowhere. The guide
  says plainly that the keys you already added need adding again once.
- **A longer owner key:** MAKE ONE makes a 40-character random key. The guide says to remove the old fingerprint, sign in again,
  and make a fresh backup, because old backups open with the old key.

## How to try it on your phone
- Settings → SECURITY (under Ghosty), or say "how safe am I?" or "show my security".
- Tap an amber line: its steps open.
- Make an approval (for example, ask me to email someone), answer it, and see it listed under APPROVALS.
- Leave the app with an approval waiting: a notification arrives, and its tap opens the card.

## Checks
- **Brain:** `apps/edge/test/securityscreen.test.mjs` covers the approvals list from either channel, the locks reported with
  nothing secret in them, the page named on the card, every green/amber/red rule, the keys STEPS makes, and the lock-screen
  notification once and only for the approval really waiting.
- **Specs:**
  - `tests/securitylane.spec.mjs` (new; its word is at the end of check.yml's `all=`) covers:
    - the row and the nine locks;
    - the approvals and their empty state;
    - STEPS with MAKE ONE and DONE;
    - offline;
    - every key at 44 pt, nothing sideways and no word cut, at 440 and 390, at BODY 21 and in all seven looks.
  - settings, tabs and look specs rerun green.

## What is left
- **A few seconds to take it back (security.u5).** Every spec that taps APPROVE expects the answer at once, so a countdown means
  updating each of them to the new truth. Next in line.
- **A nightly self-check in the Brief (security.u7)**, the owner key change walked through in the app (u2, beyond STEPS), the slow
  lock on the phone's keys copy (u3), tighter page rules (u10), one tap to lock everything (u11), weak or reused passwords (s1),
  "has this password leaked?" (s2), the phone privacy walkthrough (s5), locked notes (s6), travel mode (s8), approvals in the
  Brief (c1), a scam check on letters in the Lens (c2), approvals read aloud (c4), and sharing by expiring link (c5): built in the
  order of the brief as time allows; this section is updated with each merge.
