# THE APPS ROUND · the SEE lane: WEATHER (14 Nov 2026)

## What I built

**Weather is an app of its own now.** It used to be a card in the Brief and a radar sheet. It opens full screen from the Weather card under the Brief's weather (the App Kit's Home card), or when you say "weather app", "open the weather", "10 day forecast" or "hourly forecast". It shows:

- **Now**: the temperature, the sky, today's high and low, what it feels like, and one dry line from Ghosty ("Rain on its way. The umbrella earns its keep today.").
- **The next hour**: when rain starts or stops ("Light rain at Home in about 20 minutes"), with a bar for each quarter hour.
- **The next 24 hours as a graph**: temperature, rain, wind or UV, one tap each.
- **Ten days**: the sky and the chance of rain for each day, with its range drawn against the whole fortnight.
- **The details**:
  - feels like, dew point and humidity;
  - pressure, and whether it is rising, steady or falling;
  - visibility, wind and gusts, UV and how strong it is;
  - sunrise and sunset, today's daylight and how much it gained or lost on yesterday;
  - the moon and how much of it is lit;
  - today against yesterday at the same hour.
- **The air**: its quality, PM2.5, and the grass, birch and alder pollen.
- **RAIN RADAR**: the last two hours played back. This is the full-screen radar from the last round.

**Places**:
- Your saved places (Home, Work and the rest, from Memory → ABOUT YOU → PLACES) appear as tabs.
- ADD puts in any town or city. Its tab is kept, and one it can't find is said plainly.
- Each place's last forecast is kept on the phone. With no signal it still shows: "No signal: this is the forecast from 14:05."

**Where it comes from**: Open-Meteo's forecast, air quality and place search, all free with no key. It is only ever asked about a saved place or a city you named, never about where you are.

## How to try it on your phone

1. Open the Brief and tap the Weather card, or say "weather app".
2. Tap Work. Then type a city in "Add a town or city" and tap ADD.
3. Under NEXT 24 HOURS, tap RAIN, WIND or UV.
4. Turn on Airplane mode and open it again. The last forecast is there, with its time.

## How it was checked

- **The new spec, `seeweather`** (its word is at the end of check.yml's `all=`): 79 checks at 440 × 956 and 390 × 844, in about 12 s. It covers:
  - the hero, the next hour and the graph (24 points, then 24 bars for rain);
  - ten days, every detail and the air;
  - the tabs, adding a city, and a city it can't find;
  - the kept forecast with no signal;
  - every key at 44 pt and nothing running off the side;
  - the wordings, and the pure sums (moon, daylight, pressure trend, pollen and UV words).
- **Other specs, green on the merged tree**: brief, seetrip and seelane.
- **Brain suite and ratchets**: the whole brain suite passes (2,363 tests), and the ratchets are green.

## What is left

- **"Here" asked by the phone itself.** The phone can only reach the hosts the site's security rules list, and those rules may only be tightened, never relaxed. Open-Meteo isn't on that list, so every forecast goes through the brain's proxy. Ghosty therefore shows saved places and named cities, never your position. Adding Open-Meteo to that list is your call.
- **Official warnings and pushed alerts for home.** The Met Office and MeteoAlarm feeds aren't on the brain's list of allowed hosts. Push alerts need a small brain-side watcher, using the reminders' Web Push.
- **Radar played forward**, lightning, and satellite cloud.
- **Today against the 30-year normal.** Today it is compared with yesterday instead.
- **A personality from your CHARACTER dials.** For now it is one dry voice.
- **The App Kit, in part.** The app uses the kit's Home card (in the Brief), its skeleton while loading, and its state cards for the empty and error states. Its own screens (the graph, ten days, the details) are drawn from the design tokens: the kit's list frame is built for lists of things, which a forecast isn't.
- **Weather as a screen of its own** (a fifth screen in PLAN, with its deck, Jump bar and hub entries). It's built but not landed: five specs (deck, hubcards, tabs, tabs2 and nav) encode PLAN as four screens, and a hub card needs an instrument and two readings. It waits, whole, for a round with the budget to move those specs too. Today Weather opens full screen from the Brief's card and by voice.
- **Section 2 of my file**, my other apps against their leaders, and **section 3**, the new apps: none started.
