# NEXT ROUND · the SEE lane (14 Nov 2026)

This lane covers God's Eye and the map, along with what they reach: the cameras, THREATS, the journey planner and the Brief's view of the world outside.

## What I built

**1. Getting there, from an appointment (see.c1).** An appointment in AGENDA that has a place now has GETTING THERE on its card. One tap shows:
- **when to leave**: a public transport journey that gets you there five minutes early, for example "Leave by 08:14 to arrive 08:52 (38 min, 1 change)";
- **the weather when you arrive**, for that place and that hour;
- **road reports along the way**, from the West Midlands motorways (outside them, it says so);
- **the public cameras along the route**, each with a fresh picture. Tap one to watch it live on God's Eye.

It also works by voice: "how do I get to my next appointment?", "trip mode" or "when should I leave for my meeting?".

Where you start from never goes to the brain finer than the square kilometre around you.

**2. Your journey with no signal (the half-done one, see.u9).**
- The last journey you plan is kept on the phone.
- With no signal, the planner says it can't plan a new one and offers the kept one.
- The kept journey opens on the offline map with "this journey was planned today at 08:14, so its times may be out of date".
- Tapping a step now moves whichever map is showing, including the offline one.

**3. Your own camera wall (see.u2).**
- On a public camera's card, PIN TO WALL keeps that camera, up to nine of them.
- WALL in God's Eye's bar, or "my camera wall", shows them all live, each picture refreshing every few seconds.
- EDIT takes a camera off the wall.
- The wall is kept on your phone.

**4. Rain radar, full screen (see.s3, with see.u1's replay).**
- RAIN in the bar, or "rain radar", plays back the last two hours of rain over home, with PLAY, PAUSE and a slider.
- It adds one line for home from a free forecast, such as "Light rain at Birmingham in about 20 minutes".
- The radar itself only has past frames. The two hours ahead come from the forecast line, as the brief reshaped it.

**5. The world in your morning Brief (see.c2).** The Brief has a new card, THE WORLD, with:
- the threat level;
- road reports on your commute between your saved home and work;
- a fresh picture from the public camera nearest home. Tap it to watch live.

**6. One-tap layer sets (see.u3).** COMMUTE, STORM and SKY sit at the top of WHAT TO SHOW. You can also say "commute view", "storm layers" or "sky mode".

**7. Search shows every match (see.u6).**
- Typing "BAW" lists every matching flight, ship, satellite and city to pick from.
- An exact call sign goes straight to its card.

**8. A nudge before the space station passes (see.u4).**
- NUDGE ME on a satellite's card, or under the ISS row in THREATS, puts the next pass into your diary with a reminder ten minutes before.
- It is the diary's own reminder, sent by the brain's Web Push, so it comes even with the phone locked.

**9. A camera's timelapse (see.u12).** A camera's card keeps the last minute of pictures on the phone. Once it has three, TIMELAPSE plays them back.

**10. Fuel stations and car chargers on the map (see.s7).**
- FUEL & CHARGE on the map shows what OpenStreetMap has mapped in the view, through the free Overpass service.
- Tap one for its brand, its hours and how many cars can charge at once.
- If you're zoomed out too far, it asks you to zoom in.

All of these are in WHAT'S NEW and in Abilities, along with every wording you can use for them.

## How to try it on your phone

1. Put an appointment with a place in AGENDA. Tap it, then tap GETTING THERE.
2. Plan a journey and open it. Then turn on Airplane mode and open the journey planner again: your last journey is there, with its warning.
3. In God's Eye, turn on CCTV cameras near London. Tap a camera, then PIN TO WALL. Tap WALL in the bar.
4. Tap RAIN in God's Eye's bar.
5. Open the Brief and look for THE WORLD.
6. Say "commute view". Type "BA" in God's Eye's search.
7. Tap a satellite, then NUDGE ME.

## How it was checked

- **Two new browser specs, at 440 × 956 and 390 × 844:**
  - `seetrip` covers everything above, with the public feeds stood in: 136 checks in about 90 s, green. Its word is at the end of check.yml's `all=`.
  - `seelane` (God's Eye's layers never covering the cameras, in all seven looks) is still green with the new keys added.
- **Other specs, green:** journey, agenda, planlane, brief, meaning, abilities, map, offlinemaps, eye, seepass and threats.
- **Brain suite:** the whole suite is green on the merged tree (2,235 tests).
- **Ratchets:** green. The STATES ratchet lists the new screens (`eye.wall`, `eye.rain`, `world.brief`), and the catalogue has every new entry.

## His rules, kept

- **Location:** "Here" is never sent finer than about a kilometre.
- **Data sources:**
  - The weather, the radar, the cameras and the fuel map are public and free, with no new keys.
  - Every feed is asked about your saved home, a destination or the map's view, never about you.
- **No strangers:** none is identified. The cameras are public road cameras.
- **Your data:** the wall and the kept journey stay on the phone.

## What is left

- **Not built yet:**
  - see.s1, following a flight by its number with its route and arrival time;
  - see.s8, a live departures board for your station;
  - see.s5, air quality and pollen on the globe;
  - see.s6, river gauges in NEAR HOME;
  - see.u10, the globe read aloud as it moves;
  - see.u11, the globe ready in half the time;
  - see.c3, from the Lens to the globe;
  - see.c4, geography on the live globe;
  - see.c5, car fault to a job sheet.
- **Replay:** see.u1's replay of quakes and storms on the globe. Only the radar replays.
- **Specialist sweep, what Google Maps, Citymapper, Flightradar24 and MarineTraffic have that Ghosty still lacks:**
  - live departure boards (s8);
  - a flight's route and arrival time (s1);
  - a ship's port calls;
  - turn-by-turn voice guidance;
  - saved lists of places on the map.

  Each needs its own careful piece. They are listed here rather than half built.
- **Lost time:** the session lost about an hour and a half to the usage limit, so these wait for the next round.
