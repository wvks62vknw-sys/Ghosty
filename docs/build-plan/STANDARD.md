# THE BAR — what "finished" means in Ghosty (the owner's words, 2 Nov 2026, 00:20)

"It needs to be max possible depth, every feature must blow your mind and must not be simply made, it must have a lot of
detail and work put into it in every single place." And before it: "other AIs can do a limited amount of things at a very
good quality but we need all our features to be the absolute best quality anybody has ever seen, they can't just be a
slop job or a quick job."

Every brief from here points at this file first. A feature is not done because it exists, passes its spec and is in
the catalogue. It is done when it meets every line below on HIS iPHONE, and he has tried it and said so.

## The ten tests

1. THE FIVE SECONDS. A stranger handed the phone understands what this screen is for and what to do first within five
   seconds, with no words from anyone. If it needs explaining, it is not finished.
2. SPEED FELT. First words or first movement within two seconds; anything longer says what it is doing and how long,
   and can be cancelled by a tap or by talking over it. Nothing ever waits in silence.
3. EVERY STATE DESIGNED. Empty, first use, loading, partial, error, offline, no permission, no key, the hundredth use with
   a year of data: each is a deliberate screen with its own words, not a blank, a spinner or a stack trace. List them in
   the report.
4. THE DETAIL TEST. Pick any three pixels of the screen: the type, the spacing, the alignment, the colour, the motion
   are chosen, consistent with the rest of Ghosty, and would survive a designer's look. Numbers are formatted as a
   person writes them. Dates are said as he says them. Nothing is a default.
5. ONE VOICE. Ghosty says "I", in the voice of the prompt, in every line of every screen, card, toast and error; the
   same thing has the same name everywhere; no jargon, no tool names, no code words he can read.
6. SHOW YOUR DAD. The feature can be demonstrated to someone in under a minute from the dock, with no phrase to remember,
   and the demonstration impresses: it does something real, with real data, visibly well.
7. THE PHONE, NOT THE BROWSER. Checked at 440 × 956 and 390 × 844 in Chromium AND in WebKit; the known iPhone traps
   (safe areas, Safari's bars, WebGPU memory, the network's filters, voices, the camera's permission) each considered and
   handled in words. What cannot be tried in the sandbox is named for his five-minute phone check.
8. SMALL MOMENTS. The transitions, the haptics-by-sound, the first-run moment, the "done" moment, the undo: each
   crafted. Superior is felt in tiny moments more than in the count of features (OWNER-ISSUES 74).
9. HONEST DEPTH. Where the real thing is not yet there (a stand-in model, a first estimate, a table written from memory,
   a feed that is two months behind), the screen says so in one plain line, and the feature sits under IN THE WORKS on its
   hub until it is the real thing. No pretending.
10. PROVEN, NOT PRESENT. The spec checks the detail, not the presence: the words on the empty state, the two-second
    budget, the cancel, the state after an error, the 44 pt, the names for VoiceOver, both widths, both browsers.

## What a builder delivers against it

- A MEASURE first: the feature as it is, against the ten tests, with screenshots at both widths; the list of what fails.
- The fixes, by test, each with its rule written where it lives and a check that catches the next instance.
- A before/after: the same screenshots, the same measurements (first words in ms, taps to reach, states covered).
- The owner's five-minute phone check: exact taps, what he should see, what to say if he does not.
- IN THE WORKS labels for anything left below the bar, with the one line saying why.

## What this costs, honestly

Depth at this level is a day of one strong builder per area, with a reviewer, every time. A week's credits cover two or
three areas, not the whole app. The order he chose: Ask and voice first; Lens; Make; Learn and the arcade; Life; Plan; Me.
