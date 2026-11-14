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

### A few seconds to take it back (security.u5)
- After APPROVE on anything that sends, posts, pays, publishes or ships, the card counts down four seconds: "Approved. It leaves
  in 4 seconds: TAKE IT BACK stops it."
- TAKE IT BACK brings the card back and nothing leaves. A repaint of the chat keeps the countdown going, and a reload sends
  nothing.
- Approvals that change nothing outside (forget, a project) still answer at once.

### The nightly self-check, told once in the Brief (security.u7)
- When the Brief opens, your locks are checked with the same rules as the SECURITY screen.
- A lock that slipped since you were last told shows up once, as a SECURITY row in YOUR DAY, and tapping it opens the screen.
- The row stays for the rest of that day, then stays quiet until something changes again.
- A lock that can't be checked right now is never news.

### Has this password leaked? (security.s2)
- On the SECURITY screen, type a password and tap CHECK. The box empties at once.
- Only the first five characters of the password's scrambled fingerprint leave the phone. The free public list of leaked
  passwords (no key needed) sends back every fingerprint that starts that way, padded so even the size of the answer says
  nothing.
- The match is made on the phone, and nothing is kept.

### Approvals in the Brief (security.c1)
- Beside the self-check, YOUR DAY gets one APPROVALS row: what you approved and turned down yesterday, and anything still
  waiting. A tap opens the waiting card, or the list.

### Approvals read aloud while talking (security.c4)
- When an approval comes up while you're talking to me, I say exactly what will happen: "If you approve, I'll do exactly this:
  … Tap APPROVE on the card when you're sure; your voice alone never approves."
- The approve itself stays a tap.

### One tap to lock everything (security.u11)
- LOCK EVERYTHING on the SECURITY screen, or say "lock everything" (that opens the same confirm; the lock is still your tap).
- Once locked:
  - Telegram is unpaired.
  - The public demo is left as it is: it never touches your data or your Cloudflare storage (a rule of its own), and DEMO_OFF=1
    in Cloudflare closes it.
  - Nothing that publishes, sends, pays or ships runs; no approval is even asked.
- Tools that only read still work.
- It stays locked until you type your owner key under UNLOCK. A wrong key keeps it locked. Pair Telegram again in Links
  afterwards.

### Said in the chat, with no model
- "Lock everything", "has my password leaked?", "show my approvals" and "how safe am I?" open the screen at the right place,
  with one line.

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
- On the SECURITY screen, under HAS IT LEAKED?, type a password you use and tap CHECK.

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
  - settings, tabs, look, brief and foresight specs rerun green.
  - Specs that tap APPROVE on something that leaves were updated to the new truth, as strict as before: chatpass's approval part
    and speaker's never-a-lock part now also check the countdown. Those two, plus sites, websites, apps, gamesites and ui, rerun
    green.

## What is left
- The owner key change walked through in the app (u2, beyond STEPS).
- The slow lock on the phone's keys copy (u3): that copy is opened in the brain, and a slow lock there could use more of the free
  plan's compute per request than it allows, which would break the copy's one job (standing in while the database is paused).
  It is left for a version that does the slow part on the phone.
- tighter page rules (u10), weak or reused passwords (s1), the phone privacy walkthrough (s5), locked notes (s6), travel mode (s8), a scam check on letters in the Lens (c2), and sharing by expiring link (c5): built in the
  order of the brief as time allows; this section is updated with each merge.
