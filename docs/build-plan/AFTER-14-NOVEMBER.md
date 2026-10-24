# Ghosty after 14 November: what runs on its own, and the few things only you can do

Plain words, no jargon. This is the guide PLAN.md section 8 promised. It describes Ghosty as built by 24 October;
anything merged after that is logged in UPGRADES.md and may add a line or two here.

## The short version

Nothing stops on 14 November. Ghosty is not run by Claude: Claude only built him. Everything Ghosty does day to day
runs on free services with no card on file, from his own alarms, on your phone and in his brain on Cloudflare.
What ends on 14 November is the Claude Max plan that paid for the building sessions. If you want big new features
built the way they were built these three weeks, that needs a Claude session again (or Ghosty's own self-edit, below).

## What keeps running by itself

- **Ghosty himself**: the brain (on Cloudflare's free plan) and the interface (the website you installed on the phone)
  stay up. The chat, voice, Telegram, Lens, God's Eye, Library, Learn, School, GYM, Workshop, Memory, Agenda: all of
  it. The free models he thinks with (Gemini first, then Groq, Cerebras, OpenRouter, Mistral, NVIDIA, SambaNova and
  Cohere as backups) stay free; when one reaches its daily free limit he moves to the next and says so.
- **Every night**: the reflection (what you said about yourself that day goes into WHO YOU ARE, and a diary line),
  and at 06:10 UK time-ish (06:10 UTC) the "Fresh knowledge" notebook in the Library fills with the day's news,
  papers and events, so he can answer about today.
- **Every week**: the offline brain (the small AI living on your phone) is trained on Kaggle's free GPUs from the
  week's lessons, checked against the gate, and only kept if it is better. It needs the Kaggle key and the Hugging
  Face training token saved in SYSTEM → KEYS (done once). SYSTEM → OFFLINE BRAIN TRAINING shows where the week is.
- **Every month**: from the first Friday of each month the offline brain is retrained from the stock model on every
  kept week, so small weekly drifts are reset. Same gate, same rollback; TRAIN FROM SCRATCH runs it early.
- **School**: STUDY ALL reads the curriculum a field at a time; the school loop sets the next paper; the GYM trains
  while the tab is open. NIGHT SCHOOL (SYSTEM) does the study and the GYM's TRAIN ALL overnight while the phone is
  plugged in and open on Ghosty; the morning report is in the inbox.
- **Self-edit**: when you ask Ghosty to change himself (a new panel, a fix, a feature), he edits his own code on
  GitHub, the checks build and click through him in a real browser, and he shows you a view-only preview. He ships
  only when you say so, checks the deploy himself and rolls back if it fails. This is how Ghosty keeps growing without
  Claude: ask for the change in the chat, read his summary, tap SHIP IT.

## The few things you may ever need to do

1. **Say yes.** Shipping a self-edit, sending an email, publishing a page, spending anything: all wait for your OK in
   the interface. Nothing goes out without it.
2. **Renew a key when a service expires it.** Most of the keys in SYSTEM → KEYS never expire (Gemini, Groq, Telegram,
   Tavily, Kaggle, Hugging Face, Pl@ntNet). A GitHub token can be given an expiry when it is made: if Ghosty says the
   GitHub token no longer works, make a new one; the steps are written next to the key in SYSTEM → KEYS, and the TEST
   button tells you the moment it works again. A key that stops working shows red in that list.
3. **Keep the phone able to work overnight** if you want Night School: plugged in, on Wi-Fi, open on Ghosty (the
   screen stays on, dimmed). iOS does not let a website know the battery level, so the card says that honestly.
4. **Install updates by reloading.** After a self-edit ships, Ghosty offers RELOAD; a reload picks up the new version.
   The phone also keeps the offline brain and its models; "ADD" downloads (the bigger brain, search by meaning) are
   asked for on Wi-Fi and only once.
5. **If something is wrong and Ghosty cannot fix it himself**: the whole story of the build is in
   `docs/build-plan/HANDOFF.md`, written for the next helper. A Claude (or any other capable assistant) session that
   starts by reading it can carry on where this one stopped. Nothing in Ghosty depends on a particular model.

## Free limits and what happens when one is hit

Every service Ghosty uses is on its free plan with no card, so nothing can bill you. When a free limit is reached for
the day or the week, that part waits and says so in plain words:

| Where | Free limit | What Ghosty does when it is reached |
|---|---|---|
| Gemini and the backup brains | daily or per-minute request limits per provider | moves to the next free brain; the chat says which one answered |
| Kaggle | about 30 GPU hours a week | the week's training waits until the hours come back (the card says when) |
| Hugging Face Spaces (3D STUDIO, PHOTO TOOLS) | a shared free queue; a sleeping Space takes about a minute to wake | shows the queue place or "try again in a minute" |
| Pl@ntNet | 500 plant identifications a day | PLANT offers ASK GHOSTY INSTEAD (the seeing model) |
| Tavily search | 1,000 searches a month | falls back to DuckDuckGo |
| Pictures shared for a Lens ask | 30 a day | says so; the phone's own detector still answers |

## What was never built in, on purpose

No face recognition, no camera feeds from strangers' cameras, no scraping of other chat apps, no key cycling to dodge
a limit, no money-making routes, no paid tier anywhere. Official exam papers stay private and are never trained on.
Those were your rules and they hold after 14 November as they did before.

## Where to look

- **SYSTEM**: status of every part, the keys and their TEST buttons, OFFLINE BRAIN TRAINING, NIGHT SCHOOL, the SPEED
  card (how long every model call takes, by provider).
- **UPGRADES.md** (in `docs/build-plan`): everything that was changed, with before and after.
- **OWNER-ISSUES.md**: the list of what you asked for and where each item stands; item 37 is what only you can do.
