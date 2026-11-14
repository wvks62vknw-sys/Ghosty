# NEXT ROUND — LENS: the camera as the front door

The Lens lane's report for the next round (brief: `NEXT-ROUND.md`; task: `next/lens.md`). Point the Lens at a thing and the card under the picture offers the next useful step, in one tap or in his words, and the step lands in the room it belongs to: Money, HOME, the diary, Contacts, the timetables, the NHS's own page.

Every new card says each of its states in his words, has 44 pt keys, works in all seven worlds (it is the one view's card row, which every world shares), answers to more than one wording by voice, is listed in Abilities (`lens:jobs`) and WHAT'S NEW, and is proved by `tests/lens2.spec.mjs` at 440×956 and 390×844 (or by the spec that owns its screen, named below). The pure readers are unit-tested in `apps/edge/test/lens-one.test.mjs`.

## 1. The next-round picks: built, whole

| Item | What he gets | How to try it | Proved by |
|---|---|---|---|
| `lens.c1` (+ `money.c3`) receipts and bills | A receipt is its own card: **INTO SPENDING** files its total in this month's spending through the statement importer **by the rules alone** (no model sees the shop's name) and says the budget line; **KEEP A WARRANTY** uses HOME's own warranty reader. A bill on the letter card (now headed A BILL) gets **ADD TO MY BILLS**: HOME keeps it and arms a reminder two days before it is due. | Point at a till receipt; at a gas bill. | lens2 `[receipt]` `[bill]`: the month's spending holds the row; HOME's own words come back |
| `lens.u1` whole menus line by line | A menu (four lines or more) goes as **words only**, one line of English asked for each line. Each line's English is laid over that line in the picture (OCR line boxes kept as shares of the text's box, so they follow the camera); the card lists every line with its English, READ ALOUD and COPY. | Point at a French or Italian menu. | lens2 `[menu]`: five lines drawn in order, the plate stood down, no picture sent |
| `lens.u7` the allergy list on packets | **WHAT I AVOID**: the 14 UK allergens and five ways of eating, kept on this phone only, set by a sheet or in his words ("I'm allergic to milk", "I'm vegan", "I avoid gluten"). Every packet then gets **NOT FOR YOU / CHECK / FINE FOR YOU** from its listed allergens, ingredients and the UK front-of-pack bands; where the open database is silent it says "check the pack", never guesses. | Scan a packet, say "I'm allergic to milk". | lens2 `[avoid]`; unit tests for the verdict and the words |

## 3. Half done, finished

- **PHOTO TOOLS**: when the free online tools are asleep or over their free limit, BACKGROUND offers **CUT IT OUT ON THIS PHONE** (the cut-out model if kept, else the first cut from depth, said which), shown with the same BEFORE/AFTER, SAVE and SHARE, "Cut out on this phone: nothing left it." With neither pack kept it names the download and its size and opens the editor's BRAIN tray where the pack is offered: it never starts a download itself. SHARPER and ERASE say plainly they must wait. Proved by `tests/photo.spec.mjs` (and `photoedit.spec`).

## 4. Soon: all four built

| Item | What he gets | Proved by |
|---|---|---|
| `lens.u6` pages snap themselves | SCAN → DOCUMENT has **AUTO** (on by default, remembered): a page whose corners hold still for about 0.9 s is taken once, straightened, added to the PDF, "Page 3 kept. Turn to the next page."; it re-arms only when the page is turned or moved away. | `tests/scan.spec.mjs` (AUTO part); unit tests for `steadyStep` in `scan.test.mjs` |
| `lens.s1` business card to contact | A business card is read only as printed (name near the top, title, company, numbers, email, web, postcode line). **ADD TO CONTACTS** makes a vCard on the phone for the share sheet (or a .vcf); CALL, WRITE, COPY. **Nobody is looked up**; nothing about the person goes to the brain. A QR contact code gets ADD TO CONTACTS too. "Add them to my contacts". | lens2 `[contact]`: the vCard's fields; no chat carries the name |
| `lens.s7` bus stop sign to next buses | A bus stop sign: its name, stop letter, the buses, where they go, its text code. **NEXT BUSES** / "when's the next bus" asks the brain's free, keyless departures **by the stop's name on the sign, never by where he is**; the times come up on the card. With no stop sign in view the words go to the brain as before. | lens2 `[stop]`: one ask, by name alone, no position |
| `lens.s10` stars and planets in AIM | AIM gains a **SKY** chip: the Sun (with a never-look warning), the Moon with its phase in words, Mercury to Saturn and about 40 bright named stars, worked out entirely on the phone from public orbital elements and a star table; stars only once it is dark; nothing fetched. | `tests/aim.spec.mjs` (sky part, fixed evening clock); unit tests at the end of `aim.test.mjs` (Pole Star, solstices, equinox noon, full and new moon, three oppositions, Venus and Mercury elongations) |

## 5. Later: the best of them, built

| Item | What he gets | Proved by |
|---|---|---|
| `lens.s2` medicine box (reshaped) | Name, strength and form read; READ ALOUD; **OPEN THE NHS PAGE** opens the NHS's own public search for it **on his tap**. Never advice: "the leaflet in the box and your pharmacist do". | lens2 `[medicine]`: the link, nothing sent before |
| `lens.s3` appliance running cost | A rating plate gives about what an hour at full power costs, at 25p a unit until he keeps his own price on the phone (SET MY PRICE). Always **a first estimate**. "What does it cost to run". | lens2 `[rating]` |
| `lens.u8` two packets compared | After a second food packet, **COMPARE** ("which is better"): the two side by side per 100 g, the better figure marked, one line, from the databases' own figures (a missing figure picks neither). | lens2 `[compare]` |
| `lens.u14` addresses abroad | A street line abroad (rue, Straße, calle, via, rua, straat… and a number) with its postcode and town is an address card with **ON THE MAP**, found by the free place finder the map already uses, on his tap. UK addresses read as before. | lens2 `[print]`; unit tests |

## 6. The specialist sweep

Compared with Google Lens, Apple Visual Look Up and Live Text, Seek, Yuka, Photomath, Microsoft Lens and Google Translate's camera. Fixed this round:

- **Downloads on mobile data**: GET THE EYES and GET THE NAMER said "on Wi-Fi" but would start on mobile data. Now on mobile data (or data saver) his tap waits and says so; files already kept on the phone still load. (lens2 `[states]`)
- **A receipt with savings** filed the SUBTOTAL: HOME's receipt reader now takes the last whole-word TOTAL. **A bill's "please pay by 14 December"** was read as £14: a day after the label is a date. (homeadmin tests)
- **Menus read as UNKNOWN**: a real menu has few common words, so it was never put into English; each language now knows its menu's dishes and headings. (lens-one tests)
- **READ ALOUD** could not be stopped and said "no voice" while it was speaking: a second tap stops it, and "no voice" is said only when there truly is none.
- **ADD TO CONTACTS** tapped twice while the share sheet opened threw.
- **UK traffic lights on every packet**: each figure per 100 g carries its HIGH / MEDIUM / LOW band in words and colour. (lens2 `[product]`)
- **TRANSLATE for languages the phone cannot name** (Polish, Swedish, Turkish…) when the words do not read as English; the card's TRANSLATE now works **in place** (it used to leave for ASK and could send the words twice), says "Putting it into English…" while out and TRY AGAIN when the English did not come back. (lens2 `[unnamed]`)
- **A translation that came back late** (a cold brain) was laid over the next words the Lens read: now it lands only on the words it was asked for.
- **UNDO after ADD TO AGENDA**: a misread date comes out again in one tap. (lens2 `[date]`)
- **A mushroom safety line**: a fungus card says never to eat a wild mushroom because a photo named it. (lens tests)
- **Print he can use** (as Live Text does): a parcel number gets TRACK (Royal Mail's public page, on his tap); °F, fl oz, oz, lb, inches, feet and km are put into his units on the phone; prices in another currency get IN POUNDS at today's rate from the free feed MARKETS already uses. (lens2 `[print]`)
- **AIM taps**: a tap took the first label box under the finger, so with the night sky on a star's label could take a tap meant for the Moon or a plane; now the nearest mark wins.

Still open from the sweep (ranked, each small unless marked):

1. FREEZE should read the frame it holds (today a frozen frame is never read).
2. "May contain" (Open Food Facts' traces) in the allergy line: the brain's lookup must ask for the traces field first.
3. EDIT a misread sum or receipt total, worked out again on the phone; UNDO after INTO SPENDING (the brain has no way to take one row out yet).
4. The family when the species is unsure (as Seek does).
5. Menu lines he can tap to hear one line and see its original.
6. Signs translated with no signal by the phone's offline brain, marked rough (SCAN already does it).
7. FIND IT ONLINE on the thing card (the existing picture-search sheet on the crop).
8. SCAN's page strip: rotate, reorder, a 44 pt remove key, the PDF named from its page, no double KEEP PAGE (M).
9. Receipts in other currencies are filed as pounds; the cards region is rebuilt whole under aria-live (a screen reader hears every card again).

(Items 2 and 8 were started by two builders at about 03:30; the owner's account hit its usage limit and both stopped with nothing whole, so neither is in.)

## Not built this round (left for the next)

`lens.u3` handwritten maths step by step (L), `lens.u4` offline species pack (L), `lens.u5` live tape measure (L), `lens.u9` the usual card first, `lens.u10` hands-free "tell me what you see", `lens.u11` hold several snaps, `lens.u12` a diary of places, `lens.s4` car warning lights, `lens.s5` plant care and watering reminders, `lens.s6` washing symbols, `lens.s8` a precise colour name, `lens.c5` "will it fit?" with MAKE.

## Decisions

- Receipts go into spending through the existing statement importer with `rulesOnly`, so there is no new brain route and no protected file is touched; HOME's bill and warranty readers are reused as they are.
- The deck allows three to five YOU CAN lines a screen and the Lens already had five, so the new jobs are one Abilities entry (`lens:jobs`) with every wording as an ask.
- The bus stop asks by the stop's name on the sign, never by position: the brain's departures tool can find a stop by name, so his rule (the brain never gets live GPS) holds without a new route.
- The medicine card opens the NHS's public search on his tap (the NHS content service needs a key he has not added), and says nothing medical of its own.
- AIM's sky tests were folded into `aim.test.mjs`, which the brain's fixed test list already runs, rather than edit `apps/edge/package.json`.
- One constellation's Latin name is also the name of a product the rules keep out of the code, so the sky calls it "the Twins".
