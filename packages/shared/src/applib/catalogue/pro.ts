import type { AppDef, CalcOutput, Skin } from '../types';

/**
 * THE PRO ROUND's catalogue layer (docs/build-plan/APPLIB-PRO.md, the DATA lane): which apps lead the Library, the few apps
 * whose family look or colour does not suit them, and each calculator's answer said in words. Every family file passes its
 * apps through pro(), so the family files keep the apps themselves and this file keeps the curation in one readable place.
 *
 * Bands come from the same public source the calc names (NHS, GOV.UK, WCAG, Environment and Climate Change Canada, the
 * American Wood Council); a band is the first whose upTo the value is at most, and the last leaves upTo out.
 */

/** The essentials: the apps people install most and the best made. Ghosty's own screens are always essential. */
export const ESSENTIAL = new Set<string>([
  // Office
  'day-planner', 'read-later', 'writer', 'capture', 'checklists', 'projects', 'goals', 'timesheet', 'shifts', 'meeting-notes',
  'habits', 'books', 'job-hunt', 'expense-claims', 'mileage-log', 'leave-tracker', 'idea-bank', 'focus-sessions', 'weekly-review',
  'holiday-allowance',
  // Creative
  'shot-list', 'song-ideas', 'practice-log', 'moodboard', 'contrast-check', 'palettes', 'print-size', 'depth-of-field',
  'exposure-value', 'camera-kit', 'writing-log', 'story-bible', 'sketchbook', 'art-portfolio', 'commissions', 'craft-projects',
  'row-counter', 'knitting-gauge', 'gig-diary', 'film-diary',
  // Games
  'sudoku', 'daily-sudoku', 'minesweeper', 'nonograms', 'sliding-puzzle', 'daily-word', 'hangman', 'word-hunt-big', 'patience',
  'quiz-night', 'snake', 'block-drop', 'dots-boxes', 'merge-tiles', 'reaction-time', 'typing-test', 'memory-match', 'score-keeper',
  'board-game-shelf', 'game-backlog',
  // Learning
  'periodic-table', 'exam-planner', 'highway-code', 'course-tracker', 'vocabulary-book', 'language-daily', 'quadratic-solver',
  'triangle-solver', 'weighted-grade', 'maths-formulas', 'study-log', 'history-dates', 'planets', 'element-cards',
  'morse-code', 'git-commands', 'speech-practice',
  // Health & food
  'workout-log', 'food-log', 'meds', 'run-plans', 'first-run', 'home-workout', 'tabata', 'yoga-flow', 'progress-photos', 'ride-log',
  'symptoms', 'pace-tools', 'meditate', 'fasting', 'drinks', 'sourdough', 'meal-planner', 'houseplants', 'bmi', 'daily-energy',
  'hydration', 'alcohol-units', 'caffeine-count', 'recipe-scaler', 'one-rep-max', 'calm-breathing', 'weight-log', 'blood-pressure',
  'sleep-diary', 'wine-cellar', 'coffee-brews',
  // Money & home
  'receipts', 'envelope-budget', 'net-worth', 'subscriptions', 'spending-diary', 'savings-pots', 'ious', 'meter-readings',
  'home-inventory', 'monthly-budget', 'emergency-fund', 'mortgage-calc', 'mortgage-overpay', 'remortgage-check', 'loan-calc',
  'debt-payoff', 'savings-growth', 'inflation-calc', 'stamp-duty', 'pension-planner', 'self-employed-tax', 'payslips', 'invoices',
  'business-books', 'margin-markup', 'minimum-wage', 'returns-tracker', 'home-maintenance', 'renting', 'diy-projects', 'energy-use',
  'ev-charging', 'paint-calc', 'tiles-calc', 'car-costs', 'fuel-log',
  // Utilities
  'take-home-pay', 'vat-calc', 'tip-split', 'discount-calc', 'percent-sums', 'unit-price', 'trip-fuel', 'pay-converter',
  'currency-sums', 'password-strength', 'length-convert', 'weight-convert', 'volume-convert', 'temperature-convert',
  'fraction-decimal', 'shift-hours', 'tally-counter', 'countdowns', 'parcels', 'emergency-kit',
  // Family & life
  'keep-in-touch', 'gift-planner', 'bucket-list', 'family-calendar', 'chores', 'emergency-card', 'baby-tracker', 'baby-book',
  'parent-care', 'family-history', 'family-cookbook', 'guest-list', 'wish-list', 'christmas-planner', 'travel-journal', 'pet-care',
  'dog-walks', 'star-chart', 'growth-log', 'dates-to-remember', 'gratitude-journal', 'dream-journal', 'wedding-planner', 'first-aid-kit',
  // Developer & maker
  'parts-bin', 'filament-spools', 'print-log', 'resistor-bands', 'ohms-law', 'led-resistor', 'print-cost', 'build-log', 'subnet-calc',
  'bug-tracker', 'side-projects', 'code-snippets', 'til-log', 'ship-checklist', 'http-status', 'regex-guide',
  // Travel & world
  'trips', 'hikes', 'tickets-passes', 'car-logbook', 'trip-spend', 'packing', 'travel-papers', 'time-zones', 'fuel-economy', 'walking-time',
  'french-phrases', 'spanish-phrases', 'nato-alphabet', 'plug-types', 'places-visited', 'flight-log', 'rail-journeys', 'stays',
  'where-i-parked', 'before-you-fly', 'camping-kit', 'daylight', 'wind-chill',
  // Your data
  'health-steps', 'health-sleep', 'health-heart', 'health-workouts', 'health-weight', 'listening-year', 'watch-history',
  'book-highlights', 'reading-history', 'runs-rides', 'statement-reader', 'table-explorer',
]);

/** Apps laid out like another family's (a money sum in Utilities looks like a bank app, a cellar like a gallery). */
export const SKIN: Record<string, Skin> = {
  // money sums that live in other families
  'take-home-pay': 'money', 'vat-calc': 'money', 'tip-split': 'money', 'discount-calc': 'money', 'unit-price': 'money',
  'pay-converter': 'money', 'currency-sums': 'money', 'trip-fuel': 'money', 'shift-hours': 'money', 'overtime-pay': 'money',
  'day-rate': 'money', 'meeting-cost': 'money', 'expense-claims': 'money', 'timesheet': 'money', 'trip-spend': 'money',
  'print-cost': 'money',
  // trackers that want rings and trends
  habits: 'body', 'dog-walks': 'body', 'growth-log': 'body', 'baby-tracker': 'body', 'commute-times': 'body',
  // collections that want a gallery
  'wine-cellar': 'create', 'coffee-brews': 'create', 'tea-journal': 'create', 'cocktail-book': 'create', 'home-bar': 'create',
  'restaurant-notes': 'create', 'family-cookbook': 'create', 'keepsakes': 'create', 'baby-book': 'create', 'kid-quotes': 'create',
  'gallery-visits': 'create', 'listening-log': 'create', 'board-game-shelf': 'create', 'film-diary': 'create',
  // the outdoors and places
  'bird-list': 'world', 'nature-diary': 'world', 'stargazing-log': 'world', 'ride-log': 'world',
  'swim-log': 'world', 'climbing-log': 'world', 'travel-journal': 'world', 'shoot-spots': 'world',
  // the garden and home are warm
  houseplants: 'life', 'grow-calendar': 'life', 'harvest-log': 'life', 'seed-box': 'life', 'home-maintenance': 'life',
  appliances: 'life', 'storage-boxes': 'life', 'moving-house': 'life', 'home-inventory': 'life',
  // papers and work are documents
  'family-papers': 'office', 'send-later': 'office', 'interview-prep': 'office', 'answer-practice': 'office', 'post-room': 'office',
  'travel-papers': 'office', 'lab-notebook': 'office',
  // utilities in other families
  'oven-temps': 'tools', 'gas-marks': 'tools', 'kitchen-units': 'tools', 'paint-calc': 'tools', 'tiles-calc': 'tools',
  'flooring-calc': 'tools', 'wallpaper-calc': 'tools', 'concrete-calc': 'tools', 'gravel-calc': 'tools', 'topsoil-calc': 'tools',
  'turf-calc': 'tools', 'bricks-calc': 'tools', 'fence-calc': 'tools', 'stud-wall': 'tools', 'timber-calc': 'tools',
  'loft-insulation': 'tools', 'time-zones': 'tools', 'travel-units': 'tools',
  // technical
  'coding-log': 'maker', 'cube-times': 'maker',
};

/** Apps whose own colour says what they are better than their family's (wine red, coffee brown, night blue). */
export const HUE: Record<string, number> = {
  'wine-cellar': 345, 'coffee-brews': 28, 'tea-journal': 88, 'sleep-diary': 245, meditate: 265, 'calm-breathing': 195,
  houseplants: 125, sourdough: 38, 'blood-pressure': 355, 'ev-charging': 150, 'energy-use': 48, 'christmas-planner': 2,
  'bird-list': 140, 'stargazing-log': 235, 'dream-journal': 275, 'gratitude-journal': 40, 'pet-care': 30, 'dog-walks': 32,
};

type Band = NonNullable<CalcOutput['bands']>[number];
type Words = { bands?: Band[]; explain?: string };
const zero = (none: string, some: string): Band[] => [{ upTo: 0, words: none, tone: 'good' }, { words: some, tone: 'ok' }];
const flag = (no: string, yes: string): Band[] => [{ upTo: 0.5, words: no, tone: 'bad' }, { words: yes, tone: 'good' }];

/** Each calculator's outputs said in words: app id, then output id. */
export const WORDS: Record<string, Record<string, Words>> = {
  // ——— Health & food ———
  bmi: {
    bmi: {
      bands: [
        { upTo: 18.49, words: 'Underweight', tone: 'warn' },
        { upTo: 24.99, words: 'Healthy weight', tone: 'good' },
        { upTo: 29.99, words: 'Overweight', tone: 'warn' },
        { upTo: 39.99, words: 'Obese', tone: 'bad' },
        { words: 'Severely obese', tone: 'bad' },
      ],
      explain: 'The NHS healthy range for adults is 18.5 to 24.9, though BMI cannot tell muscle from fat.',
    },
    low: { explain: 'The lightest weight in the healthy range for your height.' },
    high: { explain: 'The heaviest weight in the healthy range for your height.' },
  },
  'waist-ratio': {
    ratio: {
      bands: [
        { upTo: 0.399, words: 'Below the usual range', tone: 'ok' },
        { upTo: 0.499, words: 'Healthy', tone: 'good' },
        { upTo: 0.599, words: 'Increased health risk', tone: 'warn' },
        { words: 'High health risk', tone: 'bad' },
      ],
      explain: 'The NHS says keep your waist to less than half your height.',
    },
  },
  'alcohol-units': {
    week: {
      bands: [{ upTo: 14, words: 'Within the low-risk guideline', tone: 'good' }, { words: 'Over 14 units a week', tone: 'bad' }],
      explain: 'The UK Chief Medical Officers advise no more than 14 units a week, spread over three or more days.',
    },
    units: { explain: 'One unit is 10 ml of pure alcohol, about what an adult body clears in an hour.' },
  },
  'caffeine-count': {
    mg: {
      bands: [
        { upTo: 200, words: 'Moderate', tone: 'good' },
        { upTo: 400, words: 'Within the daily guide', tone: 'ok' },
        { words: 'Over 400 mg a day', tone: 'bad' },
      ],
      explain: 'EFSA finds up to 400 mg a day safe for most adults, and 200 mg a day in pregnancy.',
    },
  },
  'daily-energy': {
    day: { explain: 'About what you burn in a day, so eating this much keeps your weight steady.' },
    rest: { explain: 'What your body uses at complete rest, before any movement.' },
  },
  'protein-need': { g: { explain: 'The UK reference intake, enough for nearly every healthy adult.' } },
  hydration: { drinks: { explain: 'EFSA counts food as about a fifth of your water, so this is the part to drink.' } },
  'one-rep-max': { epley: { explain: 'An estimate of the most you could lift once, best from sets of ten reps or fewer.' } },
  'exercise-energy': { kcal: { explain: 'An average for the activity, so your own figure may be a little higher or lower.' } },
  'recipe-scaler': { factor: { explain: 'Multiply every ingredient by this, though baking times may need checking.' } },
  'pace-tools': { kmh: { explain: 'Your average speed over the whole distance.' } },
  // ——— Money & home ———
  'monthly-budget': {
    left: {
      bands: [
        { upTo: -0.01, words: 'Overspent', tone: 'bad' },
        { upTo: 0, words: 'Nothing left over', tone: 'warn' },
        { words: 'Money left over', tone: 'good' },
      ],
      explain: 'What is left each month once every planned cost and saving is paid.',
    },
  },
  'emergency-fund': {
    target: { explain: 'MoneyHelper suggests enough to cover three to six months of essential costs.' },
    covered: {
      bands: [
        { upTo: 0.99, words: 'Under a month', tone: 'bad' },
        { upTo: 2.99, words: 'Building up', tone: 'warn' },
        { upTo: 5.99, words: 'Three months covered', tone: 'ok' },
        { words: 'Six months or more', tone: 'good' },
      ],
    },
  },
  'stamp-duty': {
    tax: { bands: zero('No Stamp Duty to pay', 'Stamp Duty to pay'), explain: 'Due to HMRC within 14 days of completion, usually paid by your solicitor.' },
  },
  'child-benefit-charge': {
    pct: {
      bands: [
        { upTo: 0, words: 'No charge', tone: 'good' },
        { upTo: 99, words: 'Part taken back', tone: 'warn' },
        { words: 'All taken back', tone: 'bad' },
      ],
      explain: 'One percent is taken back for every £200 of income over £60,000.',
    },
  },
  'savings-tax': { tax: { bands: zero('No tax to pay', 'Tax to pay'), explain: 'Interest under your allowances is tax free, and banks pay it without tax taken off.' } },
  'gains-tax': { tax: { bands: zero('No tax to pay', 'Tax to pay'), explain: 'The first £3,000 of gains each tax year is free of Capital Gains Tax.' } },
  'dividend-tax': { tax: { bands: zero('No tax to pay', 'Tax to pay'), explain: 'The first £500 of dividends each tax year is tax free.' } },
  'minimum-wage': {
    short: {
      bands: [{ upTo: 0, words: 'At or above the legal minimum', tone: 'good' }, { words: 'Below the legal minimum', tone: 'bad' }],
      explain: 'Your employer must pay at least the legal minimum for your age, and ACAS can help if not.',
    },
  },
  'remortgage-check': {
    change: {
      bands: [{ upTo: 0, words: 'No monthly saving', tone: 'warn' }, { words: 'You would save each month', tone: 'good' }],
      explain: 'The difference in monthly payments, before the fees are won back.',
    },
  },
  'unit-price': {
    dearer: {
      bands: [
        { upTo: -0.05, words: 'B is the better buy', tone: 'good' },
        { upTo: 0.05, words: 'Same price', tone: 'ok' },
        { words: 'A is the better buy', tone: 'good' },
      ],
      explain: 'Comparing the price per 100 shows the better value whatever the pack size.',
    },
  },
  'offer-compare': {
    gap: {
      bands: [
        { upTo: -1, words: 'Offer A is worth more', tone: 'ok' },
        { upTo: 1, words: 'Worth the same', tone: 'ok' },
        { words: 'Offer B is worth more', tone: 'ok' },
      ],
      explain: 'Salary plus employer pension and holiday, less the cost of the commute, over a year.',
    },
  },
  'mortgage-calc': { monthly: { explain: 'Your repayment each month, if the rate stays the same for the whole term.' } },
  'mortgage-overpay': { saved: { explain: 'The interest you would not pay by overpaying, if the rate stays the same.' } },
  'loan-calc': { monthly: { explain: 'The same payment each month until the loan is cleared, at the APR you enter.' } },
  'debt-payoff': { months: { explain: 'How long until the debt is clear if you pay this much each month and add nothing.' } },
  'savings-growth': { final: { explain: 'What the pot could be worth, if the rate stays the same and nothing is taken out.' } },
  'inflation-calc': { future: { explain: 'What the same things would cost after prices rise at this rate each year.' } },
  'pension-planner': { final: { explain: 'A first estimate in future pounds, so the line below shows it in today’s money.' } },
  'self-employed-tax': { bill: { explain: 'Income Tax and Class 4 National Insurance on your profit, due by 31 January.' } },
  'rental-yield': { gross: { explain: 'A year’s rent as a share of the price, before any costs.' } },
  'break-even': { units: { explain: 'Sell more than this and every extra sale is profit.' } },
  'margin-markup': { profit: { explain: 'What you keep from each sale once the cost is paid.' } },
  'lisa-bonus': { bonus: { explain: 'The government adds 25% to what you pay in, up to £1,000 a year.' } },
  'gift-aid': { charity: { explain: 'The charity claims 25p for every £1 you give, if you pay enough UK tax.' } },
  'redundancy-pay': { pay: { explain: 'The legal minimum after two years of work, and your contract may give more.' } },
  'sick-pay': { weekly: { explain: 'The legal minimum from your employer, and your contract may give more.' } },
  'energy-use': { year: { explain: 'What running it costs over a year at the unit rate on your bill.' } },
  'ev-charging': { ppm: { explain: 'What each mile costs in electricity, to set against petrol or diesel.' } },
  'car-costs': { ppm: { explain: 'Everything the car costs you, spread over every mile you drive.' } },
  'paint-calc': { litres: { explain: 'Buy a little extra, as walls with a new colour or bare plaster soak up more.' } },
  'tiles-calc': { tiles: { explain: 'Includes the extra for cuts and breakages.' } },
  // ——— Utilities ———
  'take-home-pay': { month: { explain: 'Your pay after Income Tax, National Insurance, pension and any student loan.' } },
  'vat-calc': { gross: { explain: 'The price with VAT added at the rate you choose.' } },
  'tip-split': { each: { explain: 'What each person pays, tip included.' } },
  'discount-calc': { final: { explain: 'Two discounts multiply, so 20% then 10% is 28% off, not 30%.' } },
  'trip-fuel': { cost: { explain: 'The fuel for the trip at your car’s miles per gallon and today’s price.' } },
  'pay-converter': { year: { explain: 'Over 52 weeks, before tax.' } },
  'password-strength': {
    bits: {
      bands: [
        { upTo: 39.9, words: 'Easy to guess', tone: 'bad' },
        { upTo: 59.9, words: 'Fair', tone: 'warn' },
        { upTo: 79.9, words: 'Strong', tone: 'ok' },
        { words: 'Very strong', tone: 'good' },
      ],
      explain: 'Each extra bit doubles the guesses needed, and length adds the most.',
    },
  },
  // ——— Learning ———
  'quadratic-solver': {
    n: {
      bands: [
        { upTo: 0.5, words: 'No real roots', tone: 'ok' },
        { upTo: 1.5, words: 'One repeated root', tone: 'ok' },
        { words: 'Two real roots', tone: 'ok' },
      ],
      explain: 'The discriminant decides it: above zero gives two roots, zero gives one, below zero gives none.',
    },
  },
  'weighted-grade': {
    need: {
      bands: [
        { upTo: 0, words: 'Already secured', tone: 'good' },
        { upTo: 100, words: 'Within reach', tone: 'ok' },
        { words: 'Out of reach', tone: 'bad' },
      ],
      explain: 'The mark you need on what is left to reach your target overall.',
    },
  },
  'z-score': { z: { explain: 'How many standard deviations the value sits from the mean.' } },
  'half-life': { pct: { explain: 'What is left after this time, halving once every half-life.' } },
  // ——— Creative ———
  'contrast-check': {
    ratio: {
      bands: [
        { upTo: 2.999, words: 'Fails for all text', tone: 'bad' },
        { upTo: 4.499, words: 'Large text only', tone: 'warn' },
        { upTo: 6.999, words: 'Passes AA', tone: 'ok' },
        { words: 'Passes AAA', tone: 'good' },
      ],
      explain: 'WCAG asks for 4.5 to 1 for normal text and 3 to 1 for large text.',
    },
    aa: { bands: flag('Fails AA', 'Passes AA') },
    aaa: { bands: flag('Fails AAA', 'Passes AAA') },
    large: { bands: flag('Fails for large text', 'Passes for large text') },
  },
  'exposure-value': { ev: { explain: 'Each step of one EV halves or doubles the light, and EV 15 is bright sun.' } },
  'depth-of-field': { depth: { explain: 'Everything between the near and far limits looks sharp.' } },
  'print-size': { wcm: { explain: 'At this many pixels per inch, and 300 is the usual mark for a sharp print.' } },
  // ——— Games ———
  'elo-calc': { nr: { explain: 'Your rating after the game, using the same sum chess federations use.' } },
  // ——— Developer & maker ———
  'beam-deflection': {
    ratio: {
      bands: [
        { upTo: 239.9, words: 'Sags more than span over 240', tone: 'bad' },
        { upTo: 359.9, words: 'Within span over 240', tone: 'warn' },
        { words: 'Within span over 360', tone: 'good' },
      ],
      explain: 'Floors are usually held to span over 360 so they do not feel bouncy, a first estimate only.',
    },
  },
  'ohms-law': { i: { explain: 'The current through the resistor at this voltage.' } },
  'led-resistor': { r: { explain: 'Pick the next standard value up so the LED never runs too hot.' } },
  // ——— Travel & world ———
  'wind-chill': {
    feels: {
      bands: [
        { upTo: -54.5, words: 'Extreme frostbite risk', tone: 'bad' },
        { upTo: -47.5, words: 'Severe frostbite risk', tone: 'bad' },
        { upTo: -39.5, words: 'Very high frostbite risk', tone: 'bad' },
        { upTo: -27.5, words: 'High frostbite risk', tone: 'bad' },
        { upTo: -9.5, words: 'Moderate risk', tone: 'warn' },
        { words: 'Low risk', tone: 'good' },
      ],
      explain: 'How cold the wind makes bare skin feel, on the scale the Met Office uses.',
    },
  },
  'summit-temperature': {
    top: {
      bands: [{ upTo: 0, words: 'Freezing at the top', tone: 'warn' }, { words: 'Above freezing at the top', tone: 'ok' }],
      explain: 'Air cools about 6.5 °C for every 1,000 m you climb, before any wind chill.',
    },
  },
  'walking-time': { total: { explain: 'Naismith’s rule, with time for short stops, for a fit walker on good paths.' } },
  'fuel-economy': { mpg: { explain: 'In UK gallons, so higher is better.' } },
  daylight: { len: { explain: 'From sunrise to sunset on that day at that latitude.' } },
};

/** The curation applied to a family's apps (tier always set; hue, skin and words only where given). */
export function pro(apps: AppDef[]): AppDef[] {
  return apps.map((a) => {
    const d: AppDef = { ...a, tier: a.archetype === 'screen' || ESSENTIAL.has(a.id) ? 'essential' : 'more' };
    if (SKIN[a.id] && SKIN[a.id] !== a.family && !a.skin) d.skin = SKIN[a.id];
    if (HUE[a.id] != null && a.hue == null) d.hue = HUE[a.id];
    const w = WORDS[a.id];
    if (w && a.calc) d.calc = { ...a.calc, outputs: a.calc.outputs.map((o) => (w[o.id] ? { ...o, ...w[o.id] } : o)) };
    return d;
  });
}
