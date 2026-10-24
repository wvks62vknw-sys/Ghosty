/**
 * The owner's request read into a mini-app (no model): which kind of app, what it is about, its goal,
 * unit, items, steps and look, the plain questions worth asking (two at most), and anything asked for
 * that a web mini-app cannot honestly do (sync, live data, reminders, logins, background work…). The
 * model's own reading arrives as build_app's arguments and fills what this misses; this decides what
 * is assumed, asked and refused.
 */
import type { AccentId, GlyphId } from './look';
import type { AppBrief, AppShape, CalcKind, Limit, ListKind, Question, TimerStep } from './types';

const SHAPE_WORDS: [AppShape, RegExp][] = [
  ['habits', /\bhabits?\b|\bstreaks?\b|\bdaily goals\b/],
  ['cards', /\bflash ?cards?\b|\bflashcards?\b|\brevis(?:e|ion|ing)\b|\bvocab(?:ulary)?\b|\bquiz(?:zes)?\b|\btimes ?tables?\b|\bspellings?\b|\bmemori[sz]e\b|\blearn(?:ing)? (?:my |the |some )?(?:words|verbs|phrases|facts|capitals)\b/],
  ['game', /\bgames?\b|\b2048\b|\bpuzzles?\b|\bto play\b/],
  ['timer', /\btimers?\b|\bcount ?down\b|\bpomodoro\b|\bintervals?\b|\bhiit\b|\btabata\b|\bstopwatch\b|\bplanks?\b|\bmeditat\w*|\b(?:seconds?|secs?|minutes?|mins?) (?:on|off|rest|work)\b|\begg timer\b|\bboil(?:ed|ing)? (?:an )?eggs?\b/],
  ['calc', /\bcalculat(?:or|e|es|ing)\b|\btips?\b|\bsplit(?:ting)?\b|\bconvert(?:er|s|ing)?\b|\bconversions?\b|\bfuel\b|\bpetrol\b|\bdiesel\b|\bmpg\b|\bvat\b|\bmortgage\b|\bloans?\b|\brepayments?\b|\bpercent(?:age)?s?\b/],
  ['counter', /\bcounter\b|\btally\b|\bscore(?:board|keeper|s)?\b|\bkeep(?:ing)? score\b|\bclicker\b|\bcount (?:up|people|laps|reps)\b/],
  ['list', /\blists?\b|\bto-?dos?\b|\bchecklists?\b|\bshopping\b|\bgrocer(?:y|ies)\b|\bpacking\b|\bchores\b|\berrands\b/],
  ['notes', /\bnotes?\b|\bnotepad\b|\bjournal\b|\bdiary\b|\bjot\b|\bideas\b|\bmemos?\b/],
  ['tracker', /\btrack(?:er|ing|s)?\b|\blog(?:ger|ging)?\b|\bintake\b|\bhow (?:much|many)\b|\bwater\b|\bhydrat\w*|\bspend(?:ing)?\b|\bbudget\b|\bcalories\b|\bweigh(?:t|ing)?\b|\bsleep\b|\bsteps\b|\bcaffeine\b|\bcoffees?\b|\bmood\b|\bcigarettes?\b|\bsmoking\b|\bsavings?\b|\balcohol\b|\bfive a day\b|\b5 a day\b/],
];

interface Subject {
  re: RegExp;
  title: string;
  unit: string;
  unit1: string;
  goal?: number;
  dir: 'reach' | 'limit';
  mode: 'sum' | 'last';
  period?: 'day' | 'week';
  amounts: number[];
  money?: boolean;
  accent: AccentId;
  glyph: GlyphId;
}
/** What people track most, with honest starting goals (each listed as assumed until the owner says). */
const SUBJECTS: Subject[] = [
  { re: /\bwater\b|\bhydrat\w*/, title: 'Water', unit: 'glasses', unit1: 'glass', goal: 8, dir: 'reach', mode: 'sum', amounts: [1], accent: 'cyan', glyph: 'drop' },
  { re: /\bcoffees?\b|\bcaffeine\b|\bteas?\b|\bcuppas?\b/, title: 'Coffee', unit: 'cups', unit1: 'cup', goal: 3, dir: 'limit', mode: 'sum', amounts: [1], accent: 'orange', glyph: 'cup' },
  { re: /\bsav(?:e|es|ing|ings)\b/, title: 'Savings', unit: '£', unit1: '£', dir: 'reach', mode: 'sum', period: 'week', amounts: [5, 10, 20], money: true, accent: 'green', glyph: 'coins' },
  { re: /\bspend(?:ing)?\b|\bbudget\b|\bmoney\b|\bexpenses?\b/, title: 'Spending', unit: '£', unit1: '£', goal: 30, dir: 'limit', mode: 'sum', amounts: [1, 5, 10], money: true, accent: 'green', glyph: 'coins' },
  { re: /\bcalories\b|\bkcal\b/, title: 'Calories', unit: 'kcal', unit1: 'kcal', goal: 2000, dir: 'limit', mode: 'sum', amounts: [100, 250, 500], accent: 'orange', glyph: 'bolt' },
  { re: /\bweigh(?:t|ing)?\b/, title: 'Weight', unit: 'kg', unit1: 'kg', dir: 'limit', mode: 'last', amounts: [], accent: 'indigo', glyph: 'heart' },
  { re: /\bsleep\b/, title: 'Sleep', unit: 'hours', unit1: 'hour', goal: 8, dir: 'reach', mode: 'last', amounts: [6, 7, 8, 9], accent: 'indigo', glyph: 'moon' },
  { re: /\bsteps\b|\bwalking\b/, title: 'Steps', unit: 'steps', unit1: 'step', goal: 10000, dir: 'reach', mode: 'sum', amounts: [1000, 2000, 5000], accent: 'green', glyph: 'bolt' },
  { re: /\bmood\b|\bfeel(?:ing)?\b/, title: 'Mood', unit: 'out of 5', unit1: 'out of 5', goal: 4, dir: 'reach', mode: 'last', amounts: [1, 2, 3, 4, 5], accent: 'pink', glyph: 'smile' },
  { re: /\breading\b|\bpages\b|\bbooks?\b/, title: 'Reading', unit: 'pages', unit1: 'page', goal: 20, dir: 'reach', mode: 'sum', amounts: [5, 10, 20], accent: 'purple', glyph: 'note' },
  { re: /\balcohol\b|\bunits\b|\bdrinks\b|\bpints?\b/, title: 'Alcohol', unit: 'units', unit1: 'unit', goal: 14, dir: 'limit', mode: 'sum', period: 'week', amounts: [1, 2, 3], accent: 'purple', glyph: 'cup' },
  { re: /\bcigarettes?\b|\bsmok\w*|\bvap\w*/, title: 'Cigarettes', unit: 'cigarettes', unit1: 'cigarette', goal: 5, dir: 'limit', mode: 'sum', amounts: [1], accent: 'red', glyph: 'bolt' },
  { re: /\bexercis\w*|\bworkouts?\b|\bactive minutes\b|\bgym\b/, title: 'Exercise', unit: 'minutes', unit1: 'minute', goal: 30, dir: 'reach', mode: 'sum', amounts: [10, 20, 30], accent: 'orange', glyph: 'dumbbell' },
  { re: /\bfive a day\b|\b5 a day\b|\bfruit\b|\bveg(?:etables|gies)?\b/, title: 'Five a day', unit: 'portions', unit1: 'portion', goal: 5, dir: 'reach', mode: 'sum', amounts: [1], accent: 'green', glyph: 'heart' },
  { re: /\bmedic\w*|\btablets?\b|\bpills?\b|\bdoses?\b/, title: 'Medication', unit: 'doses', unit1: 'dose', goal: 1, dir: 'reach', mode: 'sum', amounts: [1], accent: 'teal', glyph: 'heart' },
];

const LIMITS: [Limit['key'], RegExp, string][] = [
  ['live', /\blive\b|\breal[- ]?time\b|\btrain times\b|\bbus times\b|\bdepartures\b|\bweather\b|\bforecast\b|\bnews\b|\b(?:stock|share) prices?\b|\bcrypto\b|\bbitcoin\b|\bexchange rates?\b|\bcurrenc(?:y|ies)\b|\bfixtures\b|\btraffic\b|\blatest (?:scores|results|prices)\b/, "a mini-app can't fetch live data: it works offline and nothing is fetched (Ghosty can look that up for you in chat)"],
  ['sync', /\bshar(?:e|ed|ing)\b|\bsync(?:s|ed|ing)?\b|\bwith my (?:wife|husband|partner|family|kids|children|friends?|mum|dad|team|flatmates?)\b|\bbetween (?:our|two|both) phones\b|\bboth of us\b|\bwe can both\b|\beveryone can see\b/, "it can't sync between phones (that needs a server and accounts): each phone that opens the link keeps its own copy"],
  ['notify', /\bremind(?:er|ers|s)?\b|\bnotif(?:y|ies|ication|ications)\b|\balerts?\b|\bping me\b|\bnag me\b|\balarms?\b/, "it can't send reminders or notifications, or ring while it is closed (Ghosty's own reminders can: say \"remind me…\")"],
  ['login', /\blog ?ins?\b|\bsign ?ins?\b|\baccounts?\b|\bpasswords?\b|\busernames?\b/, 'no logins or accounts: what you save stays on the phone'],
  ['background', /\bin the background\b|\bautomatically\b|\bpedometer\b|\bcount(?:s)? my steps\b|\bgps\b|\bmy location\b|\bwhere i am\b|\btrack my (?:run|runs|walk|walks|ride|rides|route)\b/, "it can't run in the background or read the phone's sensors or location: you add entries yourself"],
  ['store', /\bapp store\b|\bplay store\b|\bgoogle play\b|\bnative app\b|\breal app\b/, "it is a web app on your Ghosty, not an App Store app: it installs to the Home Screen from Safari's Share menu and opens full screen"],
  ['camera', /\bcamera\b|\bphotos?\b|\bpictures?\b|\bscan(?:s|ner|ning)?\b/, "it can't use the camera or keep photos"],
  ['payment', /\btake payments?\b|\bpayments?\b|\bcheckout\b|\bmy bank\b|\bbank account\b|\bcard details\b/, "it can't take payments or see your bank"],
];

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30 };
const num = (s: string | undefined) => (s === undefined ? NaN : NUM_WORDS[s.toLowerCase()] ?? parseFloat(s.replace(/,/g, '')));
const NUMBER = '(\\d[\\d,]*(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty)';

/** "milk, eggs and bread" → ["Milk", "Eggs", "Bread"] (two or more, each a few words). */
export function itemsIn(text: string): string[] {
  const PART = '[^,.;:!?]{1,40}';
  const LIST = `((?:${PART},\\s*)+${PART}?\\s+(?:and|&)\\s+${PART}|${PART}\\s+(?:and|&)\\s+${PART}|(?:${PART},\\s*){2,}${PART})`;
  // the nearest lead-in wins: "packing for Spain with passport, charger and sun cream" lists what comes after "with"
  for (const lead of [':', '\\bwith', '\\bincluding', '\\blike', '\\bfor', '\\bof']) {
    const m = text.match(new RegExp(`${lead}\\s+${LIST}`, 'i'));
    if (!m) continue;
    const items = m[1]!
      .split(/\s*,\s*|\s+(?:and|&)\s+/i)
      .map((x) => x.trim().replace(/^(?:my|the|a|an|some)\s+/i, ''))
      .filter((x) => x && x.split(/\s+/).length <= 5)
      .map((x) => x.charAt(0).toUpperCase() + x.slice(1));
    if (items.length >= 2) return items.slice(0, 40);
  }
  return [];
}

const secsOf = (n: number, unit: string) => Math.round(/^m/i.test(unit) ? n * 60 : /^h/i.test(unit) ? n * 3600 : n);
const DUR = `${NUMBER}\\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\\b`;

/** Timer steps written in the request ("30 seconds on, 10 off, 8 rounds"; "warm up 5 min, run 20 min"). */
export function stepsIn(text: string): { steps: TimerStep[]; rounds?: number } {
  const t = text.toLowerCase();
  const rounds = num(t.match(new RegExp(`${NUMBER}\\s*(?:rounds|sets|times|x)\\b`))?.[1]);
  const r = Number.isFinite(rounds) && rounds >= 1 && rounds <= 99 ? Math.round(rounds) : undefined;
  const onOff = t.match(new RegExp(`${DUR}\\s*(?:on|work(?:ing)?)\\b[^0-9]{0,20}${NUMBER}\\s*(seconds?|secs?|s|minutes?|mins?|m)?\\s*(?:off|rest(?:ing)?)\\b`));
  if (onOff) {
    const work = secsOf(num(onOff[1]), onOff[2]!);
    const rest = secsOf(num(onOff[3]), onOff[4] ?? onOff[2]!);
    return { steps: [{ name: /\bplank/.test(t) ? 'Plank' : 'Work', secs: work }, { name: 'Rest', secs: rest }], rounds: r };
  }
  if (/\btabata\b/.test(t)) return { steps: [{ name: 'Work', secs: 20 }, { name: 'Rest', secs: 10 }], rounds: r ?? 8 };
  if (/\bpomodoro\b/.test(t)) return { steps: [{ name: 'Focus', secs: 1500 }, { name: 'Break', secs: 300 }], rounds: r ?? 4 };
  const named = [...t.matchAll(new RegExp(`([a-z][a-z' -]{1,24}?)\\s+(?:for\\s+)?${DUR}`, 'g'))]
    .map((m) => ({ name: m[1]!.replace(/^(?:a|an|the|then|and|with|timer|for|my|me)\s+/g, '').replace(/\b(?:timer|for)\b/g, '').trim(), secs: secsOf(num(m[2]), m[3]!) }))
    .filter((s) => s.name && s.secs > 0 && !/^(?:make|me|app|an?|timer|countdown)$/.test(s.name));
  if (named.length) return { steps: named.slice(0, 20).map((s) => ({ name: s.name.charAt(0).toUpperCase() + s.name.slice(1), secs: Math.min(s.secs, 86_400) })), rounds: r };
  const bare = t.match(new RegExp(DUR));
  if (bare) return { steps: [{ name: 'Timer', secs: Math.min(secsOf(num(bare[1]), bare[2]!), 86_400) }], rounds: r };
  return { steps: [], rounds: r };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Read one request. */
export function readApp(requestIn: string): AppBrief {
  const request = requestIn.slice(0, 2000);
  const t = request.toLowerCase().replace(/[’']/g, "'");
  const b: AppBrief = { request, items: [], questions: [], limits: [] };
  for (const [key, re, text] of LIMITS) if (re.test(t)) b.limits.push({ key, text });
  const hits = SHAPE_WORDS.filter(([, re]) => re.test(t)).map(([s]) => s);
  // A "routine" with durations is a timer; durations with a habit word stay habits.
  if (!hits.length && /\broutine\b/.test(t)) hits.push(new RegExp(DUR).test(t) ? 'timer' : 'list');
  b.shape = hits[0];
  // "track my water" and "a water tracker" are trackers even when "count" or "list" also appear
  if (hits.includes('tracker') && b.shape === 'counter' && SUBJECTS.some((s) => s.re.test(t))) b.shape = 'tracker';
  const colour = t.match(/\b(red|pink|purple|indigo|blue|cyan|teal|mint|green|yellow|orange)\b/)?.[1] as AccentId | undefined;
  if (colour) b.accent = colour;

  switch (b.shape) {
    case 'tracker': {
      const s = SUBJECTS.find((x) => x.re.test(t));
      const free = t.match(/\btrack(?:s|ing)?\s+(?:my |how much |how many |the |our )?([a-z][a-z -]{1,28}?)(?=\s+(?:intake|each|every|per|a day|daily|with|and|for|on|in|i)\b|[,.!?]|$)/)?.[1] ?? t.match(/\b([a-z]{3,20}) (?:tracker|log|intake)\b/)?.[1];
      if (s) {
        Object.assign(b, { subject: s.title.toLowerCase(), title: s.title, unit: s.unit, goal: s.goal, dir: s.dir, mode: s.mode, period: s.period ?? 'day', money: !!s.money, glyph: s.glyph });
        b.accent ??= s.accent;
        b.items = s.amounts.map(String);
      } else if (free && !/^(?:my|it|this|that|things?|stuff)$/.test(free.trim())) {
        Object.assign(b, { subject: free.trim(), title: cap(free.trim()), unit: 'times', dir: 'reach', mode: 'sum', period: 'day', glyph: 'star' });
        b.items = ['1'];
      }
      if (/\b(?:a|per|each|every) week\b|\bweekly\b/.test(t)) b.period = 'week';
      if (/\b(?:a|per|each|every) day\b|\bdaily\b/.test(t)) b.period = 'day';
      // the goal and its unit, when the owner said them
      const money = t.match(/£\s?(\d[\d,]*(?:\.\d+)?)/);
      const amount = t.match(new RegExp(`${NUMBER}\\s*(glasses|cups|litres?|liters?|l|ml|steps|pages|hours|hrs|kcal|calories|units|minutes|mins|portions|cigarettes|kg|stone|st|lbs?|times)\\b`));
      if (money && b.money) b.goal = num(money[1]);
      else if (amount) {
        const v = num(amount[1]);
        const u = amount[2]!;
        if (/^(?:litres?|liters?|l)$/.test(u)) Object.assign(b, { unit: 'ml', goal: v * 1000 }), (b.items = ['250', '500']);
        else if (u === 'ml') Object.assign(b, { unit: 'ml', goal: v }), (b.items = ['250', '500']);
        else if (/^(?:kg|stone|st|lbs?)$/.test(u)) Object.assign(b, { unit: u === 'stone' || u === 'st' ? 'st' : u.startsWith('lb') ? 'lb' : 'kg', goal: v });
        else Object.assign(b, { goal: v, ...(b.unit === 'times' ? { unit: u } : {}) });
      } else if (/\bml\b|\blitres?\b/.test(t) && b.subject === 'water') Object.assign(b, { unit: 'ml', goal: 2000 }), (b.items = ['250', '500']);
      if (!b.subject) b.questions.push({ key: 'subject', text: 'What do you want to track each day?' });
      else if (b.goal === undefined && b.mode !== 'last') b.questions.push({ key: 'goal', text: `What is your ${b.period === 'week' ? 'weekly' : 'daily'} goal?`, fallback: 'no goal — it just adds up' });
      else if (b.goal !== undefined && !amount && !money) b.questions.push({ key: 'goal', text: `What is your ${b.period === 'week' ? 'weekly' : 'daily'} ${b.dir === 'limit' ? 'limit' : 'goal'}?`, fallback: `${b.money ? '£' : ''}${b.goal}${b.money ? '' : ` ${b.unit}`}` });
      break;
    }
    case 'list': {
      b.list = /\bshopping\b|\bgrocer(?:y|ies)\b|\bfood shop\b/.test(t) ? 'shopping' : /\bpacking\b|\bpack\b|\bholiday\b|\btrip\b|\btravel\b/.test(t) ? 'packing' : /\bto-?dos?\b|\btasks?\b|\bjobs\b|\bchores\b|\berrands\b/.test(t) ? 'todo' : 'checklist';
      const where = request.match(/\bfor ((?:[A-Z][\w'-]+)(?: [A-Z][\w'-]+)?)/)?.[1];
      b.title = b.list === 'shopping' ? 'Shopping' : b.list === 'packing' ? (where ? `Packing for ${where}` : 'Packing') : b.list === 'todo' ? 'To-do' : cap(t.match(/\b([a-z]{3,20}) (?:check)?list\b/)?.[1] ?? 'checklist');
      b.glyph = b.list === 'shopping' ? 'cart' : b.list === 'packing' ? 'case' : 'list';
      b.items = itemsIn(request);
      break;
    }
    case 'timer': {
      const s = stepsIn(request);
      b.steps = s.steps;
      b.rounds = s.rounds;
      b.glyph = 'clock';
      b.title = /\bplank/.test(t) ? 'Plank timer' : /\bpomodoro\b/.test(t) ? 'Focus timer' : /\btabata\b/.test(t) ? 'Tabata' : /\bhiit\b|\bintervals?\b|\bon\b.*\boff\b/.test(t) ? 'Intervals' : /\bmeditat/.test(t) ? 'Meditation' : /\beggs?\b/.test(t) ? 'Egg timer' : 'Timer';
      if (!b.steps.length) {
        if (/\bmeditat/.test(t)) b.steps = [{ name: 'Breathe', secs: 600 }];
        else if (/\beggs?\b/.test(t)) b.steps = [{ name: 'Soft-boiled egg', secs: 360 }];
        if (b.steps.length) b.questions.push({ key: 'steps', text: 'How long should it time?', fallback: `${Math.round(b.steps[0]!.secs / 60)} minutes` });
        else {
          b.steps = [{ name: 'Timer', secs: 600 }];
          b.questions.push({ key: 'steps', text: 'How long should it time, and are there steps (like 30 seconds on, 10 off)?', fallback: 'one 10-minute timer' });
        }
      }
      break;
    }
    case 'calc': {
      b.calc = (/\bfuel\b|\bpetrol\b|\bdiesel\b|\bmpg\b|\bmiles per gallon\b/.test(t) ? 'fuel' : /\bvat\b/.test(t) ? 'vat' : /\bmortgage\b|\bloans?\b|\brepayments?\b|\binterest\b/.test(t) ? 'loan' : /\bconvert(?:er|s|ing)?\b|\bconversions?\b|\bunits?\b|\bcooking\b|\binches\b|\bcm\b|\bkg\b|\bcelsius\b|\bfahrenheit\b/.test(t) ? 'units' : /\btips?\b|\bsplit(?:ting)?\b|\bbill\b|\brestaurant\b/.test(t) ? 'tip' : /\bpercent(?:age)?s?\b|%/.test(t) ? 'percent' : undefined) as CalcKind | undefined;
      if (!b.calc) {
        b.calc = 'tip';
        b.questions.push({ key: 'calc', text: 'What should it work out?', fallback: 'a tip and the bill split between people' });
      }
      b.title = { tip: 'Tip & split', units: 'Converter', fuel: 'Fuel cost', vat: 'VAT', loan: 'Loan', percent: 'Percent' }[b.calc];
      b.glyph = b.calc === 'tip' || b.calc === 'loan' || b.calc === 'vat' ? 'coins' : 'calc';
      break;
    }
    case 'counter': {
      const m = request.match(/\b(?:with|between|for)\s+((?:me|[A-Z][\w'-]*)(?:\s*,\s*(?:me|[A-Z][\w'-]*))*\s+(?:and|&|vs\.?|v)\s+(?:me|[A-Z][\w'-]*))/);
      if (m) b.items = m[1]!.split(/\s*,\s*|\s+(?:and|&|vs\.?|v)\s+/).map((x) => (x.toLowerCase() === 'me' ? 'Me' : x)).slice(0, 8);
      const teams = num(t.match(new RegExp(`${NUMBER}\\s+(?:teams|players|people)`))?.[1]);
      if (!b.items.length && Number.isFinite(teams) && teams >= 2 && teams <= 8) b.items = Array.from({ length: teams }, (_, i) => `Player ${i + 1}`);
      const game = t.match(/\b(darts|pool|snooker|cards|cribbage|scrabble|football|tennis|badminton|golf|quiz night|dominoes|bowls|table tennis)\b/)?.[1];
      b.title = game ? cap(game) : /\bscore/.test(t) ? 'Scoreboard' : cap(t.match(/\bcount(?:er)? (?:for |of )?(?:my |the )?([a-z]{3,16})\b/)?.[1] ?? 'counter');
      if (!b.items.length && (game || /\bscore/.test(t))) b.questions.push({ key: 'players', text: 'Who is playing?', fallback: 'Home and Away' });
      b.glyph = 'plus';
      break;
    }
    case 'habits': {
      b.items = itemsIn(request);
      b.title = 'Habits';
      b.glyph = 'calendar';
      if (!b.items.length) b.questions.push({ key: 'habits', text: 'Which habits do you want to keep?', fallback: 'Walk, Read and Drink water (change them in the app)' });
      break;
    }
    case 'notes': {
      const about = t.match(/\b(?:for|of) (?:my |our )?([a-z]{3,16})\b/)?.[1];
      b.title = about && !/^(?:notes?|me|work)$/.test(about) ? cap(about) : /\bjournal\b/.test(t) ? 'Journal' : /\bdiary\b/.test(t) ? 'Diary' : 'Notes';
      b.glyph = 'note';
      break;
    }
    case 'cards': {
      const topic = request.match(/\b(?:for|on|about|of|to learn|learning|revise|revising)\s+(?:my |the |some )?([^,.!?]{2,40}?)(?=\s+(?:with|so|for|that|to)\b|[,.!?]|$)/i)?.[1]?.trim();
      const tt = /\btimes ?tables?\b/.test(t) ? 'Times tables' : topic && !/^(?:me|it|this|flash ?cards?)$/i.test(topic) ? cap(topic) : undefined;
      if (tt) b.subject = tt;
      b.title = tt ?? 'Flash cards';
      b.glyph = 'cards';
      if (!tt) b.questions.push({ key: 'topic', text: 'What should the flash cards be about?' });
      break;
    }
    case 'game':
      b.title = 'Merge';
      b.glyph = 'die';
      break;
    default:
      break;
  }
  // Nothing a mini-app can be: the request needs live data, payments or the phone's sensors, or says no kind of app at all.
  const hard = b.limits.filter((x) => x.key === 'live' || x.key === 'payment' || x.key === 'background');
  if (b.limits.some((x) => x.key === 'live')) {
    b.refuse = `That needs live data, and ${b.limits.find((x) => x.key === 'live')!.text}.${b.shape ? ` I can make a ${shapeNoun(b.shape)} you fill in yourself instead.` : ''}`;
  } else if (!b.shape && hard.length) {
    b.refuse = `A mini-app can't do that: ${hard.map((x) => x.text).join('; ')}.`;
  } else if (!b.shape) {
    b.questions.unshift({ key: 'shape', text: 'What should the app do: track something each day, keep a list, time something, work something out, keep score, tick off habits, hold notes, test you with flash cards, or be a game?' });
  }
  b.questions = b.questions.slice(0, 2);
  return b;
}

/** The kind of app in plain words. */
export const shapeNoun = (s: AppShape): string => ({ tracker: 'tracker', list: 'list', timer: 'timer', calc: 'calculator', counter: 'counter', habits: 'habit grid', notes: 'notes pad', cards: 'flash-card deck', game: 'game' })[s];

/** List kinds, exported for the plan. */
export type { ListKind };
/** The questions that block the build (no fallback), and those the approval asks with a fallback. */
export const blocking = (qs: Question[]) => qs.filter((q) => q.fallback === undefined);
