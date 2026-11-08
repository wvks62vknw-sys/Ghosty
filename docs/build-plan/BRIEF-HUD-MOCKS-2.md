# BRIEF: HUD MOCKS, ROUND TWO — motion he can watch, the looks as a gallery, Home that knows where he is

His words: OWNER-ISSUES 157 (read it whole, and 155, 156, 139, 137, 136). The bar: "straight out of a high-production Hollywood
movie", "genuine billions poured into it", "designed for a genius playboy billionaire philanthropist". Round one
(docs/build-plan/mockups/hud/2026-11-08/: the house Home, the way round, the Lens, the 12-frame boot) was "a little better but
could still be better"; start from it, raise it, do not start over. The top tier.

## Make, under docs/build-plan/mockups/hud/2026-11-08-2/

1. THE BOOT AS A FILM: an animated HTML prototype of the boot for THE SCAN, 6 to 9 seconds, real motion (the scan assembling
   with depth and parallax, the orb forming, the stamp typing, the feeds answering, the recognition, the landing on Home), on
   the real tokens and marks, crafted shot by shot with easing, light and timing a title designer would sign; RECORDED TO A
   VIDEO with Playwright's recordVideo at 440 × 956 (convert to mp4 with ffmpeg if it is installed, else keep the webm) so he
   can WATCH it; a shot list with the ms of each beat; the sound design written as a cue sheet (what plays at each beat: the
   low hum, the tone, a short score or none), since the video has no sound. Skippable in the real thing; say how.
2. HOME, RAISED: the house Home from round one made better looking (your call where: light, depth, the plan's drawing, the
   type, the orb's presence), as frames AND a 4-second ambient motion clip (the scan's points drifting, the orb turning, the
   window's light) recorded the same way. Three places × a moment each: AT HOME (evening), OUT (midday in town), ON THE WAY
   (the commute), each visibly a different Home: what is Now, what the house shows, the colour of the light; a line on each
   saying how the phone knows (its saved places and its own sense of place, on the phone, never sent; one switch turns it off).
3. THE THEME GALLERY: the Theme page as a gallery of the seven looks, each a live-looking thumbnail of its Home (from the
   existing sheets: ORBIT, ONE INK, GROWN UP from docs/build-plan/mockups/directions/; THE SCAN, THE MAP, THE EYE from
   directions-2/; GLASS from today's app), the colour row under the chosen one, nothing else; and ONE frame of a second look's
   Home redrawn at round-one quality (THE EYE or ONE INK, your pick) so he sees two entirely different HUDs side by side.
4. THE CONTACT SHEET `contact.png` (the frames, with the video's shot list as a strip) and `README.md`: what changed from
   round one and why; the questions for him (numbered, context in each, recommendation first; fewer than ten this time, only
   the ones that change the build); the production rubric you worked to (motion, transitions, type, sound, finish) as a page
   he can hold future PRs to.

## Rules

Nothing from the network; no packages (ffmpeg only if already installed; say so); no app code; no model name anywhere;
the boundary in every frame; never live GPS to the brain; not so dark; the Machine felt and never named; stand-in fonts. Commit
before every heavy render step; progress to /tmp/claude-0/-home-user-Ghosty/63e92761-5a8f-5466-8eb4-d7d3add13ad1/scratchpad/
hud-mocks-2.md; watch your own video and look at every frame before reporting. Report: the folder, the video file's path and
length, one line per frame, the questions.
