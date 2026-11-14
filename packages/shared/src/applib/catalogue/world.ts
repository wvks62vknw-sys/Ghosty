import type { AppDef } from '../types';
import { pro } from './pro';

/**
 * The Library's world apps (docs/build-plan/APPLIB.md, list docs/build-plan/applib/catalogue-world.md).
 * Nothing here reads location or calls a server: rates, offsets and distances are his own inputs, and every
 * calc carries its public source and tests worked from it. Phrasebooks write each language in its own script,
 * with a romanisation after non-Latin scripts. Apps that need live data or their own engineering are listed in
 * docs/build-plan/APPLIB-CAT-C.md, never faked here.
 */

type Card = { q: string; a: string };
const list = (text: string): Card[] =>
  text.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
    const i = s.indexOf('=');
    return { q: s.slice(0, i).trim(), a: s.slice(i + 1).trim() };
  });

/** The fourteen phrases every phrasebook carries, in this order. */
const PHRASES = ['Hello', 'Goodbye', 'Please', 'Thank you', 'Yes', 'No', 'Excuse me', 'Sorry', 'Do you speak English?', 'I don\'t understand', 'How much is it?', 'Where is the toilet?', 'The bill, please', 'Help'];

function phrasebook(id: string, lang: string, keywords: string[], answers: string[], tip: string): AppDef {
  if (answers.length !== PHRASES.length) throw new Error(`${id}: ${answers.length} phrases`);
  return {
    id, name: `${lang} Phrases`, family: 'world', glyph: 'chat', archetype: 'deck',
    pitch: `The ${lang} phrases a traveller needs most, written in ${lang} as it is read.`,
    keywords: [lang.toLowerCase(), 'phrases', 'phrasebook', ...keywords],
    tour: ['Each card is one phrase; say it aloud before you turn it.', tip, 'Ten minutes a day the week before you go is enough.'],
    deck: { mode: 'srs', cards: PHRASES.map((q, i) => ({ q, a: answers[i] ?? '' })) },
  };
}

/** UTC offsets for the time-zone calc (IANA time zone database; summer and winter shown where clocks change). */
const ZONES: { label: string; value: number }[] = [
  ['Honolulu (UTC−10)', -10], ['Los Angeles, winter (UTC−8)', -8], ['Los Angeles, summer (UTC−7)', -7],
  ['New York, winter (UTC−5)', -5], ['New York, summer (UTC−4)', -4], ['São Paulo (UTC−3)', -3],
  ['London, winter (UTC+0)', 0], ['London summer, Paris winter (UTC+1)', 1], ['Paris, summer (UTC+2)', 2],
  ['Istanbul, Moscow (UTC+3)', 3], ['Dubai (UTC+4)', 4], ['Karachi (UTC+5)', 5], ['Delhi (UTC+5:30)', 5.5],
  ['Dhaka (UTC+6)', 6], ['Bangkok (UTC+7)', 7], ['Beijing, Singapore (UTC+8)', 8], ['Tokyo (UTC+9)', 9],
  ['Sydney, winter (UTC+10)', 10], ['Sydney, summer (UTC+11)', 11], ['Auckland, summer (UTC+13)', 13],
].map(([label, value]) => ({ label: label as string, value: value as number }));

/** The sixteen compass points, 22.5 degrees apart. */
const COMPASS: Card[] = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  .map((p, i) => ({ q: p, a: `${i * 22.5}°` }));

export const WORLD: AppDef[] = pro([
  /* ===================== From the owner's list ===================== */
  {
    id: 'trips', name: 'Trips', family: 'world', glyph: 'plane', archetype: 'log', from: 'world.13',
    pitch: 'A whole trip day by day: travel, stays, sights, booking numbers and costs.',
    keywords: ['trip', 'itinerary', 'holiday', 'travel', 'plan', 'bookings'],
    tour: ['Add each part of the trip on its day: a flight, a stay, a sight.', 'Calendar view lays the days out; the booking number sits on each row.', 'On the day, a nudge tells you what is next.'],
    log: {
      fields: [
        { id: 'item', label: 'What', type: 'text', required: true, hint: 'e.g. Flight to Lisbon' },
        { id: 'trip', label: 'Trip', type: 'text', hint: 'e.g. Lisbon, May' },
        { id: 'day', label: 'Day', type: 'date', required: true },
        { id: 'time', label: 'Time', type: 'time' },
        { id: 'kind', label: 'Kind', type: 'choice', options: ['Flight', 'Train', 'Drive', 'Stay', 'Sight', 'Food', 'Event', 'Note'] },
        { id: 'place', label: 'Place', type: 'text' },
        { id: 'ref', label: 'Booking ref', type: 'text' },
        { id: 'cost', label: 'Cost', type: 'money' },
        { id: 'link', label: 'Link', type: 'link' },
        { id: 'file', label: 'Photo', type: 'photo' },
        { id: 'notes', label: 'Notes', type: 'long' },
      ],
      title: 'item', sub: '{time} · {place}', meta: 'cost', date: 'day', sort: { field: 'day', dir: 'asc' }, group: 'kind',
      stats: [{ label: 'Plans', kind: 'count' }, { label: 'Booked', kind: 'sum', field: 'cost' }, { label: 'Trips', kind: 'distinct', field: 'trip' }],
      views: ['list', 'calendar', 'board'],
      remind: { field: 'day', words: '{item} today' },
    },
    sample: [
      { item: 'Flight to Lisbon', trip: 'Lisbon, May', day: '2027-05-14', time: '07:05', kind: 'Flight', place: 'Gatwick North', ref: 'K7PQ2M', cost: 142.6 },
      { item: 'Guest house in Alfama', trip: 'Lisbon, May', day: '2027-05-14', time: '14:00', kind: 'Stay', place: 'Alfama', ref: '4419020', cost: 396 },
      { item: 'Tram 28 and the castle', trip: 'Lisbon, May', day: '2027-05-15', time: '10:00', kind: 'Sight', place: 'São Jorge Castle', cost: 15 },
      { item: 'Day trip to Sintra', trip: 'Lisbon, May', day: '2027-05-16', time: '09:10', kind: 'Train', place: 'Rossio station', cost: 4.9 },
    ],
  },
  {
    id: 'tickets-passes', name: 'Tickets & Passes', family: 'world', glyph: 'tag', archetype: 'log', from: 'world.16',
    pitch: 'Boarding passes and tickets kept offline, the next one always on top.',
    keywords: ['tickets', 'passes', 'boarding', 'wallet', 'travel', 'events'],
    tour: ['Add a ticket with a photo or screenshot of its barcode.', 'The list puts the next one first and works with no signal.', 'A nudge comes on the day so you are never digging at the gate.'],
    log: {
      fields: [
        { id: 'name', label: 'Ticket', type: 'text', required: true },
        { id: 'kind', label: 'Kind', type: 'choice', options: ['Boarding pass', 'Train ticket', 'Bus ticket', 'Ferry ticket', 'Event ticket', 'Entry ticket'] },
        { id: 'date', label: 'Date', type: 'date', required: true },
        { id: 'time', label: 'Time', type: 'time' },
        { id: 'from', label: 'From', type: 'text' },
        { id: 'to', label: 'To', type: 'text' },
        { id: 'seat', label: 'Seat', type: 'text' },
        { id: 'ref', label: 'Reference', type: 'text' },
        { id: 'code', label: 'Barcode', type: 'photo' },
        { id: 'used', label: 'Used', type: 'check' },
      ],
      title: 'name', sub: '{time} · {from} to {to}', meta: 'seat', date: 'date', sort: { field: 'date', dir: 'asc' }, group: 'kind',
      stats: [{ label: 'Tickets', kind: 'count' }, { label: 'This month', kind: 'count', period: 'month' }],
      views: ['list', 'gallery', 'calendar'],
      remind: { field: 'date', words: '{name} today at {time}' },
    },
    sample: [
      { name: 'Lisbon outbound', kind: 'Boarding pass', date: '2027-05-14', time: '07:05', from: 'London Gatwick', to: 'Lisbon', seat: '14C', ref: 'K7PQ2M' },
      { name: 'Sintra return', kind: 'Train ticket', date: '2027-05-16', time: '09:10', from: 'Rossio', to: 'Sintra', ref: 'S88341' },
      { name: 'Fado evening', kind: 'Event ticket', date: '2027-05-15', time: '21:00', from: 'Alfama', to: 'Alfama', seat: 'Table 6' },
    ],
  },
  {
    id: 'car-logbook', name: 'Car Logbook', family: 'world', glyph: 'car', archetype: 'log', from: 'world.45',
    pitch: 'Fill-ups, services, MOT, tax and insurance with due dates and monthly cost.',
    keywords: ['car', 'mot', 'service', 'fuel', 'mileage', 'insurance', 'tax'],
    tour: ['Log every fill-up, service and bill with the mileage.', 'Put the next due date on MOT, tax and insurance for a nudge that day.', 'The ring shows this month\'s running cost against your limit.'],
    log: {
      fields: [
        { id: 'kind', label: 'Kind', type: 'choice', required: true, options: ['Fill-up', 'Charge', 'Service', 'MOT', 'Tax', 'Insurance', 'Tyres', 'Repair', 'Parking', 'Wash'] },
        { id: 'date', label: 'Date', type: 'date', default: 'today', required: true },
        { id: 'cost', label: 'Cost', type: 'money' },
        { id: 'mileage', label: 'Mileage', type: 'number', unit: 'miles', min: 0 },
        { id: 'litres', label: 'Litres', type: 'number', unit: 'L', min: 0, step: 0.01 },
        { id: 'where', label: 'Where', type: 'text' },
        { id: 'due', label: 'Next due', type: 'date' },
        { id: 'receipt', label: 'Receipt', type: 'photo' },
        { id: 'notes', label: 'Notes', type: 'long' },
      ],
      title: 'kind', sub: '{where} · {mileage} miles', meta: 'cost', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'kind',
      stats: [
        { label: 'This month', kind: 'sum', field: 'cost', period: 'month', goal: 250, dir: 'limit' },
        { label: 'This year', kind: 'sum', field: 'cost', period: 'year' },
        { label: 'Mileage', kind: 'max', field: 'mileage' },
        { label: 'Litres', kind: 'sum', field: 'litres', period: 'month' },
      ],
      chart: { field: 'cost', kind: 'bar', period: 'month' },
      views: ['list', 'calendar', 'board'],
      remind: { field: 'due', words: '{kind} due today' },
    },
    sample: [
      { kind: 'Fill-up', date: '2026-11-12', cost: 61.4, mileage: 48210, litres: 42.35, where: 'High Street garage' },
      { kind: 'Service', date: '2026-10-03', cost: 189, mileage: 47640, where: 'Local garage', due: '2027-10-03', notes: 'Oil, filters, wipers.' },
      { kind: 'MOT', date: '2026-06-20', cost: 54.85, mileage: 45020, where: 'Test centre', due: '2027-06-20', notes: 'Passed, one advisory on rear tyre.' },
      { kind: 'Insurance', date: '2026-03-01', cost: 412, due: '2027-03-01' },
    ],
  },
  {
    id: 'trip-spend', name: 'Trip Spend', family: 'world', glyph: 'wallet', archetype: 'log', from: 'world.23',
    pitch: 'What you spend abroad, in their money and in pounds, against a daily budget.',
    keywords: ['trip', 'spend', 'budget', 'holiday', 'currency', 'expenses'],
    tour: ['Log each spend in the local money and in pounds at your rate.', 'The ring is today against your daily budget.', 'Mark shared spends so you can settle up at the end.'],
    log: {
      fields: [
        { id: 'what', label: 'What', type: 'text', required: true },
        { id: 'date', label: 'Date', type: 'date', default: 'today', required: true },
        { id: 'category', label: 'Category', type: 'choice', options: ['Food', 'Transport', 'Stay', 'Activities', 'Shopping', 'Other'] },
        { id: 'local', label: 'Local amount', type: 'number', min: 0, step: 0.01 },
        { id: 'currency', label: 'Currency', type: 'choice', options: ['EUR', 'USD', 'JPY', 'TRY', 'AED', 'PKR', 'INR', 'THB', 'CHF', 'Other'] },
        { id: 'pounds', label: 'In pounds', type: 'money', required: true },
        { id: 'paidby', label: 'Paid by', type: 'text', default: 'Me' },
        { id: 'shared', label: 'Shared', type: 'check' },
        { id: 'receipt', label: 'Receipt', type: 'photo' },
      ],
      title: 'what', sub: '{local} {currency} · {category}', meta: 'pounds', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'category',
      stats: [
        { label: 'Today', kind: 'sum', field: 'pounds', period: 'day', goal: 80, dir: 'limit' },
        { label: 'Trip total', kind: 'sum', field: 'pounds' },
        { label: 'Average', kind: 'avg', field: 'pounds' },
      ],
      chart: { field: 'pounds', kind: 'bar', period: 'week' },
      views: ['list', 'calendar', 'board'],
    },
    sample: [
      { what: 'Grilled sardines lunch', date: '2027-05-15', category: 'Food', local: 24, currency: 'EUR', pounds: 20.5, paidby: 'Me', shared: true },
      { what: 'Castle entry', date: '2027-05-15', category: 'Activities', local: 15, currency: 'EUR', pounds: 12.81, paidby: 'Me' },
      { what: 'Day travel card', date: '2027-05-15', category: 'Transport', local: 6.8, currency: 'EUR', pounds: 5.81, paidby: 'Me' },
      { what: 'Pastries and coffee', date: '2027-05-14', category: 'Food', local: 7.4, currency: 'EUR', pounds: 6.32, paidby: 'Sam', shared: true },
    ],
  },
  {
    id: 'packing', name: 'Packing', family: 'world', glyph: 'case', archetype: 'checklist', from: 'world.15',
    pitch: 'A full packing list by section, from documents to chargers, ticked as you pack.',
    keywords: ['packing', 'list', 'suitcase', 'holiday', 'travel', 'luggage'],
    tour: ['Tick each thing as it goes in the bag.', 'Documents and money sit first: the things you cannot buy there.', 'Untick all in settings for the trip home.'],
    checklist: {
      repeat: 'never',
      sections: [
        { name: 'Documents', items: ['Passport', 'Tickets and boarding passes', 'Travel insurance details', 'GHIC card', 'Driving licence', 'Bank cards and some local cash'] },
        { name: 'Clothes', items: ['Underwear and socks', 'Tops', 'Trousers or shorts', 'Something warm', 'Rain jacket', 'Sleepwear', 'Walking shoes', 'Swimwear'] },
        { name: 'Wash bag', items: ['Toothbrush and paste', 'Deodorant', 'Sun cream', 'Razor', 'Liquids under 100 ml in a clear bag', 'Regular medicines'] },
        { name: 'Tech', items: ['Phone charger', 'Plug adapter', 'Headphones', 'Power bank'] },
        { name: 'Last things', items: ['Reusable water bottle', 'Sunglasses', 'House keys', 'Book or e-reader'] },
      ],
    },
  },
  {
    id: 'travel-papers', name: 'Travel Papers', family: 'world', glyph: 'shield', archetype: 'log', from: 'world.17',
    pitch: 'Passport, GHIC, licence and insurance with expiry dates and renewal nudges.',
    keywords: ['passport', 'ghic', 'licence', 'insurance', 'visa', 'expiry'],
    tour: ['Add each document with its expiry and a renew-by date.', 'Many countries want months left on a passport, so renew early.', 'The nudge comes on the renew-by day, not the expiry day.'],
    log: {
      fields: [
        { id: 'document', label: 'Document', type: 'choice', required: true, options: ['Passport', 'GHIC', 'Driving licence', 'Travel insurance', 'Visa', 'Railcard', 'Driving permit', 'Vaccine record'] },
        { id: 'holder', label: 'Holder', type: 'text', default: 'Me' },
        { id: 'ref', label: 'Last digits', type: 'text', hint: 'The last four only' },
        { id: 'expires', label: 'Expires', type: 'date', required: true },
        { id: 'renew', label: 'Renew by', type: 'date' },
        { id: 'country', label: 'Country', type: 'text', hint: 'For a visa' },
        { id: 'link', label: 'Official link', type: 'link' },
        { id: 'photo', label: 'Photo', type: 'photo' },
        { id: 'notes', label: 'Notes', type: 'long' },
      ],
      title: 'document', sub: '{holder} · expires {expires}', meta: 'ref', date: 'renew', sort: { field: 'expires', dir: 'asc' }, group: 'document',
      stats: [{ label: 'Documents', kind: 'count' }, { label: 'Renewals', kind: 'count', period: 'year' }],
      views: ['list', 'calendar'],
      remind: { field: 'renew', words: 'Time to renew: {document} for {holder}' },
    },
    sample: [
      { document: 'Passport', holder: 'Me', ref: '4821', expires: '2029-03-11', renew: '2028-06-01', link: 'https://www.gov.uk/renew-adult-passport' },
      { document: 'GHIC', holder: 'Me', ref: '0937', expires: '2030-01-19', renew: '2029-12-01', link: 'https://www.gov.uk/global-health-insurance-card' },
      { document: 'Driving licence', holder: 'Me', ref: '9AB2', expires: '2031-08-04', renew: '2031-06-01', notes: 'Photocard needs a new photo every ten years.' },
      { document: 'Travel insurance', holder: 'Family', expires: '2027-04-30', renew: '2027-04-15' },
    ],
  },
  {
    id: 'hikes', name: 'Hikes', family: 'world', glyph: 'mountain', archetype: 'log', from: 'world.3',
    pitch: 'Every walk and hike with distance, climb, time and the view, totted up.',
    keywords: ['hikes', 'walks', 'trails', 'hiking', 'climb', 'distance'],
    tour: ['Log each walk with its distance, climb and time.', 'The ring counts kilometres this month; the chart shows the year.', 'Gallery view turns your summit photos into a wall.'],
    log: {
      fields: [
        { id: 'route', label: 'Route', type: 'text', required: true },
        { id: 'date', label: 'Date', type: 'date', default: 'today', required: true },
        { id: 'area', label: 'Area', type: 'text', hint: 'e.g. Lake District' },
        { id: 'km', label: 'Distance', type: 'number', unit: 'km', min: 0, step: 0.1 },
        { id: 'climb', label: 'Climb', type: 'number', unit: 'm', min: 0 },
        { id: 'time', label: 'Time', type: 'duration' },
        { id: 'grade', label: 'Grade', type: 'choice', options: ['Easy', 'Moderate', 'Hard', 'Scramble'] },
        { id: 'with', label: 'With', type: 'text' },
        { id: 'rating', label: 'Rating', type: 'rating' },
        { id: 'photo', label: 'Photo', type: 'photo' },
        { id: 'notes', label: 'Notes', type: 'long' },
      ],
      title: 'route', sub: '{area} · {climb} m up', meta: 'km', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'grade',
      stats: [
        { label: 'This month', kind: 'sum', field: 'km', period: 'month', goal: 40, dir: 'reach' },
        { label: 'Climb', kind: 'sum', field: 'climb', period: 'year' },
        { label: 'Walks', kind: 'count', period: 'year' },
        { label: 'Longest', kind: 'max', field: 'km' },
      ],
      chart: { field: 'km', kind: 'bar', period: 'year' },
      views: ['list', 'gallery', 'calendar'],
    },
    sample: [
      { route: 'Catbells ridge', date: '2026-11-08', area: 'Lake District', km: 5.8, climb: 380, time: 150, grade: 'Moderate', rating: 5, notes: 'Clear all the way to Skiddaw.' },
      { route: 'Seven Sisters cliffs', date: '2026-10-19', area: 'South Downs', km: 13.2, climb: 410, time: 245, grade: 'Moderate', rating: 4 },
      { route: 'Pen y Fan horseshoe', date: '2026-09-27', area: 'Brecon Beacons', km: 16.1, climb: 930, time: 360, grade: 'Hard', rating: 5 },
      { route: 'Canal towpath loop', date: '2026-09-14', area: 'Home', km: 7.5, climb: 20, time: 95, grade: 'Easy', rating: 3 },
    ],
  },
  {
    id: 'commute-times', name: 'Commute Times', family: 'world', glyph: 'train', archetype: 'log', from: 'world.8',
    pitch: 'Your real journey times by mode, so you know which way is truly quickest.',
    keywords: ['commute', 'journey', 'times', 'train', 'bus', 'delay'],
    tour: ['Log each journey with the mode, the minutes and any delay.', 'After a few weeks the averages show the truly quicker way.', 'The chart shows which days run late.'],
    log: {
      fields: [
        { id: 'date', label: 'Date', type: 'date', default: 'today', required: true },
        { id: 'way', label: 'Direction', type: 'choice', options: ['To work', 'Home'] },
        { id: 'mode', label: 'Mode', type: 'choice', options: ['Train', 'Bus', 'Car', 'Bike', 'Walk', 'Underground', 'Mixed'] },
        { id: 'left', label: 'Left at', type: 'time', default: 'now' },
        { id: 'minutes', label: 'Minutes', type: 'duration', required: true },
        { id: 'delay', label: 'Delay', type: 'number', unit: 'min', min: 0 },
        { id: 'note', label: 'Note', type: 'text' },
      ],
      title: '{mode} · {way}', sub: 'Left {left}', meta: 'minutes', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'mode',
      stats: [
        { label: 'Average', kind: 'avg', field: 'minutes' },
        { label: 'Avg delay', kind: 'avg', field: 'delay' },
        { label: 'Best', kind: 'min', field: 'minutes' },
        { label: 'This week', kind: 'count', period: 'week' },
      ],
      chart: { field: 'minutes', kind: 'line', period: 'month' },
      views: ['list', 'calendar'],
    },
    sample: [
      { date: '2026-11-13', way: 'To work', mode: 'Train', left: '07:42', minutes: 48, delay: 6, note: 'Signal fault at the junction.' },
      { date: '2026-11-12', way: 'To work', mode: 'Bike', left: '07:30', minutes: 41, delay: 0 },
      { date: '2026-11-12', way: 'Home', mode: 'Bike', left: '17:35', minutes: 44, delay: 0 },
      { date: '2026-11-11', way: 'To work', mode: 'Train', left: '07:42', minutes: 43, delay: 1 },
    ],
  },

  /* ===================== Calculators: his own numbers, no server ===================== */
  {
    id: 'time-zones', name: 'Time Zones', family: 'world', glyph: 'globe', archetype: 'calc',
    pitch: 'Turn a time in one city into the time in another, with the day it falls on.',
    keywords: ['time', 'zones', 'world', 'clock', 'utc', 'meeting'],
    tour: ['Type the time and pick where it is, then pick where you want it.', 'Mind summer and winter: both are in the list where clocks change.', 'Day shows +1 when it is already tomorrow there.'],
    calc: {
      source: 'UTC offsets from the IANA time zone database; local time = UTC + offset',
      inputs: [
        { id: 'h', label: 'Hour', default: 9, min: 0, max: 23, step: 1 },
        { id: 'm', label: 'Minute', default: 0, min: 0, max: 59, step: 1 },
        { id: 'from', label: 'From', default: 0, choices: ZONES },
        { id: 'to', label: 'To', default: 5.5, choices: ZONES },
      ],
      outputs: [
        { id: 'raw', label: 'Minutes', expr: 'h*60 + m + (to - from)*60', dp: 0 },
        { id: 'mins', label: 'Clock minutes', expr: '(raw + 2880) % 1440', dp: 0 },
        { id: 'hour', label: 'Hour there', expr: 'floor(mins / 60)', dp: 0 },
        { id: 'minute', label: 'Minute there', expr: 'mins - hour*60', dp: 0 },
        { id: 'day', label: 'Day', expr: 'floor(raw / 1440)', dp: 0 },
      ],
      tests: [
        { in: { h: 9, m: 0, from: 0, to: 5.5 }, out: { hour: 14, minute: 30, day: 0 } },
        { in: { h: 22, m: 0, from: 1, to: 9 }, out: { hour: 6, minute: 0, day: 1 } },
        { in: { h: 2, m: 15, from: 0, to: -5 }, out: { hour: 21, minute: 15, day: -1 } },
      ],
    },
  },
  {
    id: 'travel-units', name: 'Travel Units', family: 'world', glyph: 'ruler', archetype: 'calc',
    pitch: 'Kilometres, kilos, litres and Celsius into the units you think in, and back.',
    keywords: ['units', 'convert', 'miles', 'kilometres', 'celsius', 'fahrenheit'],
    tour: ['Type into any box; each answer sits beside it.', 'A road sign of 100 km is about 62 miles.', 'The gallon here is the UK gallon, larger than the US one.'],
    calc: {
      source: 'UK Weights and Measures Act 1985: 1 mile = 1.609344 km, 1 lb = 0.45359237 kg, 1 UK gallon = 4.54609 L; °F = °C × 9/5 + 32',
      inputs: [
        { id: 'km', label: 'Kilometres', default: 10, min: 0 },
        { id: 'mi', label: 'Miles', default: 26.2, min: 0 },
        { id: 'kg', label: 'Kilograms', default: 20, min: 0 },
        { id: 'c', label: 'Celsius', default: 30 },
        { id: 'f', label: 'Fahrenheit', default: 98.6 },
        { id: 'l', label: 'Litres', default: 50, min: 0 },
      ],
      outputs: [
        { id: 'tomi', label: 'In miles', expr: 'km / 1.609344', unit: 'mi' },
        { id: 'tokm', label: 'In kilometres', expr: 'mi * 1.609344', unit: 'km' },
        { id: 'tolb', label: 'In pounds', expr: 'kg / 0.45359237', unit: 'lb' },
        { id: 'tof', label: 'In Fahrenheit', expr: 'c * 9/5 + 32', unit: '°F', dp: 1 },
        { id: 'toc', label: 'In Celsius', expr: '(f - 32) * 5/9', unit: '°C', dp: 1 },
        { id: 'togal', label: 'UK gallons', expr: 'l / 4.54609', unit: 'gal' },
      ],
      tests: [
        { in: { km: 10, mi: 26.2, kg: 20, c: 30, f: 98.6, l: 50 }, out: { tomi: 6.21, tokm: 42.16, tolb: 44.09, tof: 86, toc: 37, togal: 11 } },
        { in: { km: 100, mi: 1, kg: 1, c: 0, f: 32, l: 4.54609 }, out: { tomi: 62.14, tokm: 1.61, tolb: 2.2, tof: 32, toc: 0, togal: 1 } },
      ],
    },
  },
  {
    id: 'fuel-economy', name: 'Fuel Economy', family: 'world', glyph: 'drop', archetype: 'calc',
    pitch: 'Your real mpg and litres per 100 km from the miles driven and litres filled.',
    keywords: ['mpg', 'economy', 'fuel', 'litres', 'car', 'consumption'],
    tour: ['Fill to the brim, zero the trip, and next time fill again.', 'Type the miles on the trip and the litres the pump took.', 'Over several fills the figure settles to your true one.'],
    calc: {
      source: 'mpg = miles ÷ (litres ÷ 4.54609); L/100 km = litres ÷ (miles × 1.609344) × 100',
      estimate: true,
      inputs: [
        { id: 'miles', label: 'Miles driven', default: 400, min: 0.1 },
        { id: 'litres', label: 'Litres filled', default: 36.4, min: 0.01 },
      ],
      outputs: [
        { id: 'mpg', label: 'Economy', expr: 'miles / (litres / 4.54609)', unit: 'mpg', dp: 1 },
        { id: 'l100', label: 'Metric', expr: 'litres / (miles * 1.609344) * 100', unit: 'L/100 km', dp: 2 },
      ],
      tests: [
        { in: { miles: 400, litres: 36.4 }, out: { mpg: 49.96, l100: 5.65 } },
        { in: { miles: 300, litres: 45.4609 }, out: { mpg: 30, l100: 9.42 } },
      ],
    },
  },
  {
    id: 'great-circle', name: 'Great Circle', family: 'world', glyph: 'compass', archetype: 'calc',
    pitch: 'The shortest distance and the starting bearing between two points on Earth.',
    keywords: ['distance', 'great', 'circle', 'bearing', 'latitude', 'longitude'],
    tour: ['Type the latitude and longitude of both; south and west are negative.', 'This is the as-the-crow-flies distance, as aircraft fly it.', 'The bearing is the heading you set off on; it changes on the way.'],
    calc: {
      source: 'The haversine formula on a sphere of radius 6,371 km (Movable Type Scripts, "Calculate distance and bearing")',
      inputs: [
        { id: 'lat1', label: 'From latitude', unit: '°', default: 51.5074, min: -90, max: 90, step: 0.0001 },
        { id: 'lon1', label: 'From longitude', unit: '°', default: -0.1278, min: -180, max: 180, step: 0.0001 },
        { id: 'lat2', label: 'To latitude', unit: '°', default: 48.8566, min: -90, max: 90, step: 0.0001 },
        { id: 'lon2', label: 'To longitude', unit: '°', default: 2.3522, min: -180, max: 180, step: 0.0001 },
      ],
      outputs: [
        { id: 'h', label: 'Haversine', expr: 'sin((lat2 - lat1)/2)^2 + cos(lat1)*cos(lat2)*sin((lon2 - lon1)/2)^2', dp: 6 },
        { id: 'km', label: 'Kilometres', expr: '6371 * 2 * atan2(sqrt(h), sqrt(1 - h)) * pi / 180', unit: 'km', dp: 1 },
        { id: 'mi', label: 'Miles', expr: 'km / 1.609344', unit: 'mi', dp: 1 },
        { id: 'nm', label: 'Nautical miles', expr: 'km / 1.852', unit: 'nmi', dp: 1 },
        { id: 'b0', label: 'Raw bearing', expr: 'atan2(sin(lon2 - lon1)*cos(lat2), cos(lat1)*sin(lat2) - sin(lat1)*cos(lat2)*cos(lon2 - lon1))', dp: 1 },
        { id: 'bearing', label: 'Bearing', expr: 'if(b0 < 0, b0 + 360, b0)', unit: '°', dp: 1 },
      ],
      tests: [
        { in: { lat1: 51.5074, lon1: -0.1278, lat2: 48.8566, lon2: 2.3522 }, out: { km: 343.6, mi: 213.5, nm: 185.5, bearing: 148.1 } },
        { in: { lat1: 51.5074, lon1: -0.1278, lat2: 40.7128, lon2: -74.006 }, out: { km: 5570.2, mi: 3461.2, nm: 3007.7, bearing: 288.3 } },
      ],
    },
  },
  {
    id: 'walking-time', name: 'Walking Time', family: 'world', glyph: 'mountain', archetype: 'calc',
    pitch: 'How long a hill walk will take from distance and climb, by Naismith\'s rule.',
    keywords: ['walking', 'time', 'hike', 'naismith', 'climb', 'hills'],
    tour: ['Type the distance and the total climb from the map.', 'The rule allows 5 km an hour plus an hour for every 600 m up.', 'Add your breaks, and turn back in time to beat the dark.'],
    calc: {
      source: 'Naismith\'s rule (W. W. Naismith, 1892), in its metric form: 5 km per hour, plus 1 hour for every 600 m of ascent',
      estimate: true,
      inputs: [
        { id: 'km', label: 'Distance', unit: 'km', default: 10, min: 0, step: 0.1 },
        { id: 'up', label: 'Climb', unit: 'm', default: 600, min: 0 },
        { id: 'pace', label: 'Pace', unit: 'km/h', default: 5, min: 1, max: 10, step: 0.5 },
        { id: 'stops', label: 'Breaks', unit: 'min', default: 0, min: 0 },
      ],
      outputs: [
        { id: 'move', label: 'Moving time', expr: '(km / pace + up / 600) * 60', format: 'duration', dp: 0 },
        { id: 'total', label: 'With breaks', expr: 'move + stops', format: 'duration', dp: 0 },
      ],
      tests: [
        { in: { km: 10, up: 600, pace: 5, stops: 0 }, out: { move: 180, total: 180 } },
        { in: { km: 15, up: 900, pace: 5, stops: 45 }, out: { move: 270, total: 315 } },
      ],
    },
  },
  {
    id: 'summit-temperature', name: 'Summit Temperature', family: 'world', glyph: 'mountain', archetype: 'calc',
    pitch: 'How much colder the top will be than the valley, from the height you climb.',
    keywords: ['temperature', 'summit', 'altitude', 'mountain', 'lapse', 'cold'],
    tour: ['Type the temperature where you start and both heights.', 'Air cools about 6.5 °C for every 1,000 m in the standard atmosphere.', 'Pair it with Wind Chill for how the top will feel.'],
    calc: {
      source: 'ICAO Standard Atmosphere lapse rate, 6.5 °C per 1,000 m',
      estimate: true,
      inputs: [
        { id: 't', label: 'Start temp', unit: '°C', default: 12 },
        { id: 'h1', label: 'Start height', unit: 'm', default: 100, min: -500 },
        { id: 'h2', label: 'Summit height', unit: 'm', default: 1345, min: -500 },
      ],
      outputs: [
        { id: 'drop', label: 'Cooling', expr: '6.5 * (h2 - h1) / 1000', unit: '°C', dp: 1 },
        { id: 'top', label: 'Summit', expr: 't - drop', unit: '°C', dp: 1 },
      ],
      tests: [
        { in: { t: 12, h1: 100, h2: 1345 }, out: { drop: 8.09, top: 3.91 } },
        { in: { t: 20, h1: 0, h2: 2000 }, out: { drop: 13, top: 7 } },
      ],
    },
  },
  {
    id: 'wind-chill', name: 'Wind Chill', family: 'world', glyph: 'cloud', archetype: 'calc',
    pitch: 'How cold the air will feel on bare skin from the temperature and the wind.',
    keywords: ['wind', 'chill', 'cold', 'feels', 'like', 'weather'],
    tour: ['Type the air temperature and the wind speed in km/h.', 'The index is meant for 10 °C and below with some wind.', 'Cover skin when it falls below about −10.'],
    calc: {
      source: 'The wind chill index of the Joint Action Group for Temperature Indices (2001), used by the Met Office and Environment Canada',
      inputs: [
        { id: 't', label: 'Air temp', unit: '°C', default: 0, max: 10 },
        { id: 'v', label: 'Wind', unit: 'km/h', default: 20, min: 5 },
      ],
      outputs: [
        { id: 'feels', label: 'Feels like', expr: '13.12 + 0.6215*t - 11.37*v^0.16 + 0.3965*t*v^0.16', unit: '°C', dp: 1 },
      ],
      tests: [
        { in: { t: 0, v: 20 }, out: { feels: -5.24 } },
        { in: { t: -10, v: 30 }, out: { feels: -19.52 } },
      ],
    },
  },

  /* ===================== Phrasebooks ===================== */
  phrasebook('french-phrases', 'French', ['france', 'travel'], ['Bonjour', 'Au revoir', 'S\'il vous plaît', 'Merci', 'Oui', 'Non', 'Excusez-moi', 'Désolé (Désolée if you are a woman)', 'Parlez-vous anglais ?', 'Je ne comprends pas', 'C\'est combien ?', 'Où sont les toilettes ?', 'L\'addition, s\'il vous plaît', 'Au secours'], 'Use vous with strangers; tu is for friends and children.'),
  phrasebook('spanish-phrases', 'Spanish', ['spain', 'mexico', 'travel'], ['Hola', 'Adiós', 'Por favor', 'Gracias', 'Sí', 'No', 'Perdone', 'Lo siento', '¿Habla inglés?', 'No entiendo', '¿Cuánto cuesta?', '¿Dónde está el baño?', 'La cuenta, por favor', 'Socorro'], 'Questions open with ¿ in writing; say them with a rising voice.'),
  phrasebook('german-phrases', 'German', ['germany', 'austria', 'travel'], ['Hallo', 'Auf Wiedersehen', 'Bitte', 'Danke', 'Ja', 'Nein', 'Entschuldigung', 'Es tut mir leid', 'Sprechen Sie Englisch?', 'Ich verstehe nicht', 'Wie viel kostet das?', 'Wo ist die Toilette?', 'Die Rechnung, bitte', 'Hilfe'], 'Bitte does double duty: please, and you are welcome.'),
  phrasebook('italian-phrases', 'Italian', ['italy', 'travel'], ['Buongiorno', 'Arrivederci', 'Per favore', 'Grazie', 'Sì', 'No', 'Mi scusi', 'Mi dispiace', 'Parla inglese?', 'Non capisco', 'Quanto costa?', 'Dov\'è il bagno?', 'Il conto, per favore', 'Aiuto'], 'Ciao is for friends; buongiorno is right with anyone.'),
  phrasebook('portuguese-phrases', 'Portuguese', ['portugal', 'brazil', 'travel'], ['Olá', 'Adeus', 'Por favor', 'Obrigado (Obrigada if you are a woman)', 'Sim', 'Não', 'Com licença', 'Desculpe', 'Fala inglês?', 'Não percebo', 'Quanto custa?', 'Onde é a casa de banho?', 'A conta, por favor', 'Socorro'], 'These are as said in Portugal; Brazil differs in places.'),
  phrasebook('dutch-phrases', 'Dutch', ['netherlands', 'belgium', 'travel'], ['Hallo', 'Tot ziens', 'Alstublieft', 'Dank u wel', 'Ja', 'Nee', 'Pardon', 'Sorry', 'Spreekt u Engels?', 'Ik begrijp het niet', 'Hoeveel kost het?', 'Waar is het toilet?', 'De rekening, alstublieft', 'Help'], 'The g is said in the throat, like the ch in loch.'),
  phrasebook('greek-phrases', 'Greek', ['greece', 'cyprus', 'travel'], ['Γεια σας (yia sas)', 'Αντίο (andío)', 'Παρακαλώ (parakaló)', 'Ευχαριστώ (efcharistó)', 'Ναι (ne)', 'Όχι (óchi)', 'Συγγνώμη (signómi)', 'Συγγνώμη (signómi)', 'Μιλάτε αγγλικά; (miláte angliká?)', 'Δεν καταλαβαίνω (den katalavéno)', 'Πόσο κάνει; (póso káni?)', 'Πού είναι η τουαλέτα; (poú íne i toualéta?)', 'Τον λογαριασμό, παρακαλώ (ton logariasmó, parakaló)', 'Βοήθεια (voíthia)'], 'Ναι, ne, means yes, and the Greek question mark looks like ;.'),
  phrasebook('turkish-phrases', 'Turkish', ['turkey', 'travel'], ['Merhaba', 'Hoşça kalın', 'Lütfen', 'Teşekkür ederim', 'Evet', 'Hayır', 'Affedersiniz', 'Özür dilerim', 'İngilizce biliyor musunuz?', 'Anlamıyorum', 'Bu ne kadar?', 'Tuvalet nerede?', 'Hesap, lütfen', 'İmdat'], 'Hoşça kalın is said by the one leaving; güle güle answers it.'),
  phrasebook('polish-phrases', 'Polish', ['poland', 'travel'], ['Dzień dobry', 'Do widzenia', 'Proszę', 'Dziękuję', 'Tak', 'Nie', 'Przepraszam', 'Przepraszam', 'Czy mówi pan po angielsku?', 'Nie rozumiem', 'Ile to kosztuje?', 'Gdzie jest toaleta?', 'Poproszę rachunek', 'Pomocy'], 'Ask a woman "Czy mówi pani po angielsku?"; pan is for a man.'),
  phrasebook('russian-phrases', 'Russian', ['russia', 'cyrillic', 'travel'], ['Здравствуйте (zdravstvuyte)', 'До свидания (do svidaniya)', 'Пожалуйста (pozhaluysta)', 'Спасибо (spasibo)', 'Да (da)', 'Нет (net)', 'Извините (izvinite)', 'Простите (prostite)', 'Вы говорите по-английски? (vy govorite po-angliyski?)', 'Я не понимаю (ya ne ponimayu)', 'Сколько это стоит? (skolko eto stoit?)', 'Где туалет? (gde tualet?)', 'Счёт, пожалуйста (schyot, pozhaluysta)', 'Помогите (pomogite)'], 'Learn Cyrillic Letters first and signs start to read themselves.'),
  phrasebook('arabic-phrases', 'Arabic', ['egypt', 'gulf', 'morocco', 'travel'], ['مرحبا (marhaban)', 'مع السلامة (maʿa as-salāma)', 'من فضلك (min faḍlak)', 'شكرا (shukran)', 'نعم (naʿam)', 'لا (lā)', 'لو سمحت (law samaḥt)', 'آسف (āsif)', 'هل تتكلم الإنجليزية؟ (hal tatakallam al-injilīziyya?)', 'لا أفهم (lā afham)', 'بكم هذا؟ (bikam hādhā?)', 'أين الحمام؟ (ayna al-ḥammām?)', 'الحساب من فضلك (al-ḥisāb min faḍlak)', 'النجدة (an-najda)'], 'These are in standard Arabic, understood across the Arab world.'),
  phrasebook('urdu-phrases', 'Urdu', ['pakistan', 'travel'], ['السلام علیکم (assalām-o-alaikum)', 'خدا حافظ (khudā hāfiz)', 'براہ کرم (barāh-e-karam)', 'شکریہ (shukriya)', 'جی ہاں (jī hāñ)', 'جی نہیں (jī nahīñ)', 'معاف کیجیے (muāf kījiye)', 'معاف کیجیے (muāf kījiye)', 'کیا آپ انگریزی بولتے ہیں؟ (kyā āp angrezī bolte haiñ?)', 'میں نہیں سمجھا (maiñ nahīñ samjhā)', 'یہ کتنے کا ہے؟ (yeh kitne kā hai?)', 'ٹوائلٹ کہاں ہے؟ (ṭoilet kahāñ hai?)', 'بل دے دیجیے (bil de dījiye)', 'مدد کیجیے (madad kījiye)'], 'جی, jī, before yes or no makes it polite; a woman says سمجھی, samjhī.'),
  phrasebook('hindi-phrases', 'Hindi', ['india', 'devanagari', 'travel'], ['नमस्ते (namaste)', 'फिर मिलेंगे (phir milenge)', 'कृपया (kripayā)', 'धन्यवाद (dhanyavād)', 'हाँ (hāñ)', 'नहीं (nahīñ)', 'माफ़ कीजिए (māf kījiye)', 'माफ़ कीजिए (māf kījiye)', 'क्या आप अंग्रेज़ी बोलते हैं? (kyā āp angrezī bolte haiñ?)', 'मैं नहीं समझा (maiñ nahīñ samjhā)', 'यह कितने का है? (yah kitne kā hai?)', 'शौचालय कहाँ है? (shauchālay kahāñ hai?)', 'बिल दीजिए (bil dījiye)', 'मदद कीजिए (madad kījiye)'], 'Namaste works for hello and goodbye, with palms together.'),
  phrasebook('japanese-phrases', 'Japanese', ['japan', 'kana', 'travel'], ['こんにちは (konnichiwa)', 'さようなら (sayōnara)', 'お願いします (onegaishimasu)', 'ありがとうございます (arigatō gozaimasu)', 'はい (hai)', 'いいえ (iie)', 'すみません (sumimasen)', 'ごめんなさい (gomen nasai)', '英語を話せますか？ (eigo o hanasemasu ka?)', 'わかりません (wakarimasen)', 'いくらですか？ (ikura desu ka?)', 'トイレはどこですか？ (toire wa doko desu ka?)', 'お会計お願いします (o-kaikei onegaishimasu)', '助けて (tasukete)'], 'すみません, sumimasen, calls a waiter as well as saying excuse me.'),
  phrasebook('mandarin-phrases', 'Mandarin', ['chinese', 'china', 'pinyin', 'travel'], ['你好 (nǐ hǎo)', '再见 (zàijiàn)', '请 (qǐng)', '谢谢 (xièxie)', '是 (shì)', '不是 (bú shì)', '打扰一下 (dǎrǎo yíxià)', '对不起 (duìbuqǐ)', '你会说英语吗？ (nǐ huì shuō yīngyǔ ma?)', '我听不懂 (wǒ tīng bu dǒng)', '多少钱？ (duōshao qián?)', '洗手间在哪里？ (xǐshǒujiān zài nǎlǐ?)', '请结账 (qǐng jiézhàng)', '救命 (jiùmìng)'], 'Tones change meaning: the marks over pinyin show the pitch.'),
  phrasebook('korean-phrases', 'Korean', ['korea', 'hangul', 'travel'], ['안녕하세요 (annyeonghaseyo)', '안녕히 계세요 (annyeonghi gyeseyo)', '주세요 (juseyo)', '감사합니다 (gamsahamnida)', '네 (ne)', '아니요 (aniyo)', '실례합니다 (sillyehamnida)', '죄송합니다 (joesonghamnida)', '영어 하세요? (yeong-eo haseyo?)', '이해가 안 돼요 (ihaega an dwaeyo)', '얼마예요? (eolmayeyo?)', '화장실이 어디예요? (hwajangsiri eodiyeyo?)', '계산서 주세요 (gyesanseo juseyo)', '도와주세요 (dowajuseyo)'], '주세요, juseyo, means please give me: say it after what you want.'),

  /* ===================== Decks and guides ===================== */
  {
    id: 'nato-alphabet', name: 'Phonetic Alphabet', family: 'world', glyph: 'phone', archetype: 'deck',
    pitch: 'Spell anything clearly over the phone with the international code words.',
    keywords: ['nato', 'phonetic', 'alphabet', 'spelling', 'radio', 'phone'],
    tour: ['Each card shows a letter; say its code word.', 'Use it for booking references and postcodes on a bad line.', 'Note the spellings: Alfa and Juliett are written that way.'],
    deck: {
      mode: 'srs',
      cards: list('A=Alfa;B=Bravo;C=Charlie;D=Delta;E=Echo;F=Foxtrot;G=Golf;H=Hotel;I=India;J=Juliett;K=Kilo;L=Lima;M=Mike;N=November;O=Oscar;P=Papa;Q=Quebec;R=Romeo;S=Sierra;T=Tango;U=Uniform;V=Victor;W=Whiskey;X=X-ray;Y=Yankee;Z=Zulu'),
    },
  },
  {
    id: 'world-currencies', name: 'World Currencies', family: 'world', glyph: 'coins', archetype: 'deck',
    pitch: 'The money used in the countries you are most likely to visit.',
    keywords: ['currency', 'money', 'countries', 'travel', 'geography'],
    tour: ['Each card names a country; say its currency.', 'Several European countries outside the euro keep their own.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'France=Euro;Germany=Euro;Spain=Euro;Italy=Euro;Croatia=Euro;United States=US dollar;Canada=Canadian dollar;' +
        'Australia=Australian dollar;New Zealand=New Zealand dollar;Japan=Yen;China=Renminbi (yuan);India=Indian rupee;' +
        'Pakistan=Pakistani rupee;Switzerland=Swiss franc;Norway=Norwegian krone;Sweden=Swedish krona;Denmark=Danish krone;' +
        'Iceland=Icelandic króna;Poland=Złoty;Czechia=Czech koruna;Hungary=Forint;Romania=Leu;Turkey=Turkish lira;' +
        'United Arab Emirates=Dirham;Saudi Arabia=Riyal;Qatar=Riyal;Morocco=Dirham;Egypt=Egyptian pound;South Africa=Rand;' +
        'Brazil=Real;Mexico=Mexican peso;Thailand=Baht;South Korea=Won;Malaysia=Ringgit;Indonesia=Rupiah;Vietnam=Đồng',
      ),
    },
  },
  {
    id: 'dialling-codes', name: 'Dialling Codes', family: 'world', glyph: 'phone', archetype: 'deck',
    pitch: 'The international dialling code of every country you are likely to call.',
    keywords: ['dialling', 'codes', 'phone', 'international', 'country', 'calls'],
    tour: ['Each card names a country; say its code.', 'Dial + then the code, then the number without its first 0.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'United Kingdom=+44;Ireland=+353;France=+33;Germany=+49;Spain=+34;Italy=+39;Portugal=+351;Netherlands=+31;' +
        'Belgium=+32;Switzerland=+41;Austria=+43;Poland=+48;Greece=+30;Turkey=+90;Sweden=+46;Norway=+47;Denmark=+45;' +
        'United States and Canada=+1;Mexico=+52;Brazil=+55;Australia=+61;New Zealand=+64;Japan=+81;China=+86;' +
        'South Korea=+82;India=+91;Pakistan=+92;Bangladesh=+880;United Arab Emirates=+971;Saudi Arabia=+966;Egypt=+20;' +
        'South Africa=+27;Nigeria=+234;Kenya=+254;Thailand=+66;Singapore=+65;Malaysia=+60',
      ),
    },
  },
  {
    id: 'emergency-numbers', name: 'Emergency Numbers', family: 'world', glyph: 'bell', archetype: 'deck',
    pitch: 'The emergency number to ring in the countries you travel to, learned before you go.',
    keywords: ['emergency', 'numbers', 'police', 'ambulance', 'travel', 'safety'],
    tour: ['Learn the number for where you are going before you leave.', '112 works across the European Union and on most mobiles.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'United Kingdom=999 or 112;European Union countries=112;United States=911;Canada=911;Mexico=911;Australia=000;' +
        'New Zealand=111;Japan=110 for police, 119 for fire and ambulance;China=110 police, 120 ambulance, 119 fire;' +
        'India=112;Hong Kong=999;Brazil=190 police, 192 ambulance, 193 fire;Turkey=112;' +
        'South Africa=10111 for police, 10177 for an ambulance;Pakistan=15 for police, 1122 for rescue in many provinces',
      ),
    },
  },
  {
    id: 'driving-sides', name: 'Driving Sides', family: 'world', glyph: 'car', archetype: 'deck',
    pitch: 'Which side of the road they drive on, before you hire a car abroad.',
    keywords: ['driving', 'side', 'road', 'left', 'right', 'abroad'],
    tour: ['Each card names a country; say left or right.', 'About a third of the world drives on the left.', 'Say it again at every junction on day one.'],
    deck: {
      mode: 'quiz',
      cards: list(
        'United Kingdom=Left;Ireland=Left;Malta=Left;Cyprus=Left;Japan=Left;Australia=Left;New Zealand=Left;India=Left;' +
        'Pakistan=Left;South Africa=Left;Thailand=Left;Malaysia=Left;Singapore=Left;Indonesia=Left;Kenya=Left;Hong Kong=Left;' +
        'France=Right;Spain=Right;Germany=Right;Italy=Right;United States=Right;Canada=Right;China=Right;' +
        'United Arab Emirates=Right;Brazil=Right;Egypt=Right;Turkey=Right',
      ),
    },
  },
  {
    id: 'plug-types', name: 'Plug Types', family: 'world', glyph: 'bolt', archetype: 'guide',
    pitch: 'Every plug and socket type with its voltage and where it is used.',
    keywords: ['plug', 'adapter', 'socket', 'voltage', 'travel', 'electric'],
    tour: ['Search the country you are going to, or a type letter.', 'Check the voltage too: a plug adapter does not change it.', 'Most phone and laptop chargers accept 100 to 240 V.'],
    guide: {
      source: { name: 'Wikipedia, AC power plugs and sockets', url: 'https://en.wikipedia.org/wiki/AC_power_plugs_and_sockets' },
      sections: [
        { title: 'Type A', body: 'Two flat parallel pins, no earth. North America and Japan.', tags: ['usa', 'canada', 'japan'] },
        { title: 'Type B', body: 'Two flat parallel pins with a round earth pin. North America and Japan.', tags: ['usa', 'canada', 'japan'] },
        { title: 'Type C', body: 'Two round pins, no earth. Fits most sockets across mainland Europe and much of the world.', tags: ['europe'] },
        { title: 'Type D', body: 'Three large round pins in a triangle. India, among others.', tags: ['india'] },
        { title: 'Type E', body: 'Two round pins and a hole for the socket\'s earth pin. France, Belgium and Poland.', tags: ['france', 'belgium', 'poland'] },
        { title: 'Type F', body: 'Two round pins with earth clips on the sides. Germany, Spain, the Netherlands and most of Europe.', tags: ['germany', 'spain', 'netherlands', 'europe'] },
        { title: 'Type G', body: 'Three rectangular pins with a fuse in the plug. The UK, Ireland, Malta, Cyprus, Malaysia, Singapore and Hong Kong.', tags: ['uk', 'ireland', 'singapore', 'hong kong'] },
        { title: 'Type H', body: 'Three pins in a V. Israel.', tags: ['israel'] },
        { title: 'Type I', body: 'Two flat pins in a V with a flat earth pin. Australia, New Zealand, China and Argentina.', tags: ['australia', 'china', 'new zealand'] },
        { title: 'Type J', body: 'Three round pins in a flat triangle. Switzerland and Liechtenstein.', tags: ['switzerland'] },
        { title: 'Type K', body: 'Two round pins with a half-round earth pin below. Denmark and Greenland.', tags: ['denmark'] },
        { title: 'Type L', body: 'Three round pins in a row. Italy.', tags: ['italy'] },
        { title: 'Type M', body: 'Three large round pins in a triangle, larger than Type D. South Africa.', tags: ['south africa'] },
        { title: 'Type N', body: 'Two round pins with an earth pin, in a recessed socket. Brazil and South Africa.', tags: ['brazil', 'south africa'] },
        { title: 'Voltages', body: 'The UK and most of Europe use 230 V at 50 Hz. North America uses 120 V at 60 Hz. Japan uses 100 V, at 50 Hz in the east and 60 Hz in the west.', tags: ['voltage', 'hertz'] },
      ],
    },
  },
  {
    id: 'beaufort-scale', name: 'Beaufort Scale', family: 'world', glyph: 'wave', archetype: 'guide',
    pitch: 'Wind force 0 to 12: the speed in knots, the sea state and the wave heights.',
    keywords: ['beaufort', 'wind', 'force', 'gale', 'sailing', 'sea'],
    tour: ['Search a force number or a word like "gale".', 'Each force gives the wind in knots and the sea it raises.', 'Sea forecasts give the wind by Beaufort force.'],
    guide: {
      source: { name: 'Met Office, Beaufort wind force scale', url: 'https://www.metoffice.gov.uk/weather/guides/coast-and-sea/beaufort-scale' },
      sections: [
        { title: 'Force 0: Calm', body: 'Wind under 1 knot. Sea: calm (glassy).', tags: ['force 0', 'calm'] },
        { title: 'Force 1: Light air', body: 'Wind 1 to 3 knots. Probable wave height 0.1 m, at most about 0.1 m. Sea: calm (rippled).', tags: ['force 1', 'air'] },
        { title: 'Force 2: Light breeze', body: 'Wind 4 to 6 knots. Probable wave height 0.2 m, at most about 0.3 m. Sea: smooth (wavelets).', tags: ['force 2', 'breeze'] },
        { title: 'Force 3: Gentle breeze', body: 'Wind 7 to 10 knots. Probable wave height 0.6 m, at most about 1.0 m. Sea: slight.', tags: ['force 3', 'breeze'] },
        { title: 'Force 4: Moderate breeze', body: 'Wind 11 to 16 knots. Probable wave height 1.0 m, at most about 1.5 m. Sea: slight to moderate.', tags: ['force 4', 'breeze'] },
        { title: 'Force 5: Fresh breeze', body: 'Wind 17 to 21 knots. Probable wave height 2.0 m, at most about 2.5 m. Sea: moderate.', tags: ['force 5', 'breeze'] },
        { title: 'Force 6: Strong breeze', body: 'Wind 22 to 27 knots. Probable wave height 3.0 m, at most about 4.0 m. Sea: rough.', tags: ['force 6', 'breeze'] },
        { title: 'Force 7: Near gale', body: 'Wind 28 to 33 knots. Probable wave height 4.0 m, at most about 5.5 m. Sea: rough to very rough.', tags: ['force 7', 'gale'] },
        { title: 'Force 8: Gale', body: 'Wind 34 to 40 knots. Probable wave height 5.5 m, at most about 7.5 m. Sea: very rough to high.', tags: ['force 8', 'gale'] },
        { title: 'Force 9: Strong gale', body: 'Wind 41 to 47 knots. Probable wave height 7.0 m, at most about 10.0 m. Sea: high. The Met Office uses the descriptive term severe gale.', tags: ['force 9', 'gale'] },
        { title: 'Force 10: Storm', body: 'Wind 48 to 55 knots. Probable wave height 9.0 m, at most about 12.5 m. Sea: very high.', tags: ['force 10', 'storm'] },
        { title: 'Force 11: Violent storm', body: 'Wind 56 to 63 knots. Probable wave height 11.5 m, at most about 16.0 m. Sea: very high.', tags: ['force 11', 'storm'] },
        { title: 'Force 12: Hurricane', body: 'Wind 64 or more knots. Probable wave height 14 or more m. Sea: phenomenal.', tags: ['force 12', 'hurricane'] },
        { title: 'Knots', body: 'To convert knots to mph, multiply by 1.15; for metres per second, multiply by 0.514. Wave heights are for well-developed wind waves on the open sea.', tags: ['knots', 'units', 'waves'] },
      ],
    },
  },
  {
    id: 'cloud-spotter', name: 'Cloud Spotter', family: 'world', glyph: 'cloud', archetype: 'guide',
    pitch: 'The ten main cloud types by level, and the Latin roots that name them.',
    keywords: ['clouds', 'weather', 'sky', 'spotting', 'names'],
    tour: ['Clouds sort into low, medium and high by the height of their base.', 'Read the roots: strato is layered, cumulo heaped, nimbo rain-bearing.', 'Search a name to see its level.'],
    guide: {
      source: { name: 'Met Office, Clouds', url: 'https://www.metoffice.gov.uk/weather/learn-about/weather/types-of-weather/clouds' },
      sections: [
        { title: 'Low clouds', body: 'Base usually below 6,500 ft over the British Isles: stratocumulus, stratus, cumulus and cumulonimbus.', tags: ['low', 'stratocumulus', 'stratus', 'cumulus', 'cumulonimbus'] },
        { title: 'Medium clouds', body: 'Base usually between 6,500 and 20,000 ft over the British Isles: altocumulus, altostratus and nimbostratus.', tags: ['medium', 'altocumulus', 'altostratus', 'nimbostratus'] },
        { title: 'High clouds', body: 'Base usually 20,000 ft or above over the British Isles: cirrus, cirrocumulus and cirrostratus.', tags: ['high', 'cirrus', 'cirrocumulus', 'cirrostratus'] },
        { title: 'Stratus, strato', body: 'Flat or layered and smooth.', tags: ['names', 'roots'] },
        { title: 'Cumulus, cumulo', body: 'Heaped up or puffy, like cauliflower.', tags: ['names', 'roots'] },
        { title: 'Cirrus, cirro', body: 'High up or wispy.', tags: ['names', 'roots'] },
        { title: 'Alto', body: 'Medium level.', tags: ['names', 'roots'] },
        { title: 'Nimbus, nimbo', body: 'Rain-bearing cloud. Nimbus with stratus gives nimbostratus: flat and layered, with the potential for rain.', tags: ['names', 'roots', 'rain'] },
      ],
    },
  },
  {
    id: 'countryside-code', name: 'Countryside Code', family: 'world', glyph: 'leaf', archetype: 'guide',
    pitch: 'How to respect, protect and enjoy the countryside, from the official code.',
    keywords: ['countryside', 'code', 'walking', 'dogs', 'farm', 'outdoors'],
    tour: ['Three parts: respect everyone, protect the environment, enjoy it.', 'Search "dogs", "gates" or "fires" for the rule you need.', 'Read it before a first walk on farmland.'],
    guide: {
      source: { name: 'GOV.UK, The Countryside Code', url: 'https://www.gov.uk/government/publications/the-countryside-code/the-countryside-code-advice-for-countryside-visitors' },
      sections: [
        { title: 'Be considerate', body: 'Be considerate to those living in, working in and enjoying the countryside. Be nice, say hello, share the space.', tags: ['respect'] },
        { title: 'Gates and property', body: 'Leave gates and property as you find them.', tags: ['respect', 'gates', 'farm'] },
        { title: 'Parking', body: 'Do not block access to gateways or driveways when you park.', tags: ['respect', 'parking'] },
        { title: 'Paths and signs', body: 'Follow local signs and keep to marked paths unless wider access is available.', tags: ['respect', 'paths'] },
        { title: 'Litter', body: 'Take your litter home: leave no trace of your visit.', tags: ['protect', 'litter'] },
        { title: 'Fires', body: 'Do not light fires, and only have barbecues where signs say you can.', tags: ['protect', 'fires', 'barbecue'] },
        { title: 'Dogs', body: 'Always keep dogs under control and in sight. Dog poo: bag it and bin it in any public waste bin, or take it home.', tags: ['protect', 'dogs', 'livestock'] },
        { title: 'Nature', body: 'Care for nature: do not cause damage or disturbance. Leave rocks, stone, plants and trees as you find them.', tags: ['protect', 'wildlife'] },
        { title: 'Plan ahead', body: 'Check your route and local conditions. Plan your adventure: know what to expect and what you can do. Enjoy your visit, have fun, make a memory.', tags: ['enjoy', 'planning'] },
      ],
    },
  },

  /* ===================== Logs: places and journeys ===================== */
  {
    id: 'places-visited', name: 'Places Visited', family: 'world', glyph: 'pin', archetype: 'log',
    pitch: 'Every country and city you have been to, with the year and the highlight.',
    keywords: ['places', 'visited', 'countries', 'cities', 'travel', 'map'],
    tour: ['Add each place with when you first went and the highlight.', 'The strip counts countries and continents.', 'Gallery view makes a wall of your best travel photos.'],
    log: {
      fields: [
        { id: 'city', label: 'Place', type: 'text', required: true },
        { id: 'country', label: 'Country', type: 'text', required: true },
        { id: 'continent', label: 'Continent', type: 'choice', options: ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania', 'Antarctica'] },
        { id: 'date', label: 'First visit', type: 'date' },
        { id: 'times', label: 'Visits', type: 'number', min: 1, default: 1 },
        { id: 'rating', label: 'Rating', type: 'rating' },
        { id: 'highlight', label: 'Highlight', type: 'long' },
        { id: 'photo', label: 'Photo', type: 'photo' },
      ],
      title: '{city}, {country}', sub: 'highlight', meta: 'times', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'continent',
      stats: [
        { label: 'Countries', kind: 'distinct', field: 'country' },
        { label: 'Continents', kind: 'distinct', field: 'continent' },
        { label: 'Places', kind: 'count' },
      ],
      views: ['list', 'gallery'],
    },
    sample: [
      { city: 'Lahore', country: 'Pakistan', continent: 'Asia', date: '2019-12-20', times: 3, rating: 5, highlight: 'The old city at dusk from a rooftop.' },
      { city: 'Istanbul', country: 'Turkey', continent: 'Europe', date: '2022-04-11', times: 1, rating: 5, highlight: 'A ferry across the Bosphorus at sunset.' },
      { city: 'Granada', country: 'Spain', continent: 'Europe', date: '2023-09-02', times: 1, rating: 5, highlight: 'The palace gardens early in the morning.' },
      { city: 'Marrakesh', country: 'Morocco', continent: 'Africa', date: '2024-02-17', times: 1, rating: 4, highlight: 'Mint tea above the main square.' },
    ],
  },
  {
    id: 'flight-log', name: 'Flight Log', family: 'world', glyph: 'plane', archetype: 'log',
    pitch: 'Every flight you take with route, aircraft, seat, distance and hours flown.',
    keywords: ['flights', 'log', 'aviation', 'airports', 'miles', 'travel'],
    tour: ['Log each flight with the airport codes and the distance.', 'The strip adds up kilometres and hours this year.', 'Great Circle works out the distance from two airports\' positions.'],
    log: {
      fields: [
        { id: 'date', label: 'Date', type: 'date', default: 'today', required: true },
        { id: 'from', label: 'From', type: 'text', hint: 'e.g. LHR', required: true },
        { id: 'to', label: 'To', type: 'text', hint: 'e.g. ISB', required: true },
        { id: 'flight', label: 'Flight', type: 'text', hint: 'e.g. 785' },
        { id: 'aircraft', label: 'Aircraft', type: 'text', hint: 'e.g. Boeing 777' },
        { id: 'seat', label: 'Seat', type: 'text' },
        { id: 'cabin', label: 'Cabin', type: 'choice', options: ['Economy', 'Premium economy', 'Business', 'First'] },
        { id: 'km', label: 'Distance', type: 'number', unit: 'km', min: 0 },
        { id: 'time', label: 'Flight time', type: 'duration' },
        { id: 'notes', label: 'Notes', type: 'long' },
      ],
      title: '{from} to {to}', sub: '{aircraft} · seat {seat}', meta: 'km', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'cabin',
      stats: [
        { label: 'This year', kind: 'count', period: 'year' },
        { label: 'Distance', kind: 'sum', field: 'km', period: 'year' },
        { label: 'Hours', kind: 'sum', field: 'time', period: 'year' },
        { label: 'Longest', kind: 'max', field: 'km' },
      ],
      views: ['list', 'calendar'],
    },
    sample: [
      { date: '2026-08-02', from: 'LHR', to: 'ISB', aircraft: 'Boeing 777', seat: '32K', cabin: 'Economy', km: 6050, time: 455 },
      { date: '2026-08-24', from: 'ISB', to: 'LHR', aircraft: 'Boeing 777', seat: '41A', cabin: 'Economy', km: 6050, time: 520 },
      { date: '2026-05-14', from: 'LGW', to: 'LIS', aircraft: 'Airbus A320', seat: '14C', cabin: 'Economy', km: 1585, time: 160 },
    ],
  },
  {
    id: 'rail-journeys', name: 'Rail Journeys', family: 'world', glyph: 'train', archetype: 'log',
    pitch: 'Train journeys with times, delays and fares, so you know what you can claim.',
    keywords: ['train', 'rail', 'journeys', 'delay', 'fares', 'tickets'],
    tour: ['Log each journey with the fare and how late it arrived.', 'Most operators repay part of a fare after a 15 or 30 minute delay.', 'Tick Claimed once you have sent the claim.'],
    log: {
      fields: [
        { id: 'date', label: 'Date', type: 'date', default: 'today', required: true },
        { id: 'from', label: 'From', type: 'text', required: true },
        { id: 'to', label: 'To', type: 'text', required: true },
        { id: 'due', label: 'Due', type: 'time' },
        { id: 'delay', label: 'Delay', type: 'number', unit: 'min', min: 0 },
        { id: 'fare', label: 'Fare', type: 'money' },
        { id: 'ticket', label: 'Ticket', type: 'choice', options: ['Advance', 'Off-peak', 'Anytime', 'Season', 'Day return'] },
        { id: 'railcard', label: 'Railcard', type: 'check' },
        { id: 'claimed', label: 'Claimed', type: 'check' },
        { id: 'notes', label: 'Notes', type: 'text' },
      ],
      title: '{from} to {to}', sub: 'Due {due} · {delay} min late', meta: 'fare', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'ticket',
      stats: [
        { label: 'This month', kind: 'sum', field: 'fare', period: 'month' },
        { label: 'Journeys', kind: 'count', period: 'year' },
        { label: 'Avg delay', kind: 'avg', field: 'delay' },
        { label: 'Worst', kind: 'max', field: 'delay' },
      ],
      views: ['list', 'calendar'],
    },
    sample: [
      { date: '2026-11-10', from: 'Manchester Piccadilly', to: 'London Euston', due: '11:52', delay: 34, fare: 46.8, ticket: 'Advance', railcard: true, claimed: false },
      { date: '2026-11-03', from: 'Leeds', to: 'York', due: '18:20', delay: 2, fare: 9.6, ticket: 'Off-peak', railcard: true, claimed: false },
      { date: '2026-10-28', from: 'Bristol Temple Meads', to: 'Cardiff Central', due: '09:05', delay: 17, fare: 12.4, ticket: 'Day return', claimed: true },
    ],
  },
  {
    id: 'summits', name: 'Summits', family: 'world', glyph: 'flag', archetype: 'log',
    pitch: 'The hills and mountains you have topped, by list, height and date.',
    keywords: ['summits', 'peaks', 'munros', 'hills', 'bagging', 'mountains'],
    tour: ['Add each summit with its height and the list it belongs to.', 'Group by list to see how far through the Munros you are.', 'The strip shows your highest so far.'],
    log: {
      fields: [
        { id: 'name', label: 'Summit', type: 'text', required: true },
        { id: 'height', label: 'Height', type: 'number', unit: 'm', min: 0 },
        { id: 'region', label: 'Region', type: 'text' },
        { id: 'list', label: 'List', type: 'choice', options: ['Munro', 'Corbett', 'Wainwright', 'Welsh 3000s', 'County top', 'Abroad', 'Other'] },
        { id: 'date', label: 'Date', type: 'date', default: 'today' },
        { id: 'weather', label: 'Weather', type: 'choice', options: ['Clear', 'Cloud', 'In the clag', 'Rain', 'Snow', 'Windy'] },
        { id: 'photo', label: 'Photo', type: 'photo' },
        { id: 'notes', label: 'Notes', type: 'long' },
      ],
      title: 'name', sub: '{region} · {list}', meta: 'height', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'list',
      stats: [{ label: 'Summits', kind: 'count' }, { label: 'Highest', kind: 'max', field: 'height' }, { label: 'Regions', kind: 'distinct', field: 'region' }],
      views: ['list', 'gallery'],
    },
    sample: [
      { name: 'Ben Nevis', height: 1345, region: 'Lochaber', list: 'Munro', date: '2025-06-21', weather: 'In the clag', notes: 'Cleared for ten minutes at the top.' },
      { name: 'Yr Wyddfa', height: 1085, region: 'Eryri', list: 'Welsh 3000s', date: '2025-08-09', weather: 'Clear' },
      { name: 'Scafell Pike', height: 978, region: 'Lake District', list: 'Wainwright', date: '2026-05-03', weather: 'Windy' },
      { name: 'Helvellyn', height: 950, region: 'Lake District', list: 'Wainwright', date: '2026-07-12', weather: 'Clear', notes: 'Up by Striding Edge.' },
    ],
  },
  {
    id: 'sky-log', name: 'Sky Log', family: 'world', glyph: 'moon', archetype: 'log',
    pitch: 'What you saw in the night sky, when, with what, and how good the seeing was.',
    keywords: ['astronomy', 'stars', 'planets', 'observing', 'telescope', 'sky'],
    tour: ['Log each object with the date, time and what you used to see it.', 'Rate the seeing from 1 to 5 so you learn which nights are best.', 'The strip counts the different objects you have found.'],
    log: {
      fields: [
        { id: 'object', label: 'Object', type: 'text', required: true, hint: 'e.g. Jupiter, M31' },
        { id: 'kind', label: 'Kind', type: 'choice', options: ['Planet', 'Moon', 'Star', 'Double star', 'Galaxy', 'Nebula', 'Cluster', 'Meteor shower', 'Aurora', 'Satellite'] },
        { id: 'date', label: 'Date', type: 'date', default: 'today', required: true },
        { id: 'time', label: 'Time', type: 'time', default: 'now' },
        { id: 'with', label: 'Seen with', type: 'choice', options: ['Eye', 'Binoculars', 'Telescope', 'Camera'] },
        { id: 'seeing', label: 'Seeing', type: 'scale', min: 1, max: 5 },
        { id: 'where', label: 'Where', type: 'text' },
        { id: 'photo', label: 'Photo', type: 'photo' },
        { id: 'notes', label: 'Notes', type: 'long' },
      ],
      title: 'object', sub: '{kind} · {with}', meta: 'time', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'kind',
      stats: [{ label: 'Objects', kind: 'distinct', field: 'object' }, { label: 'Sessions', kind: 'distinct', field: 'date' }, { label: 'Avg seeing', kind: 'avg', field: 'seeing' }],
      views: ['list', 'gallery', 'calendar'],
    },
    sample: [
      { object: 'Jupiter', kind: 'Planet', date: '2026-11-11', time: '22:10', with: 'Binoculars', seeing: 4, where: 'Back garden', notes: 'Four moons in a line.' },
      { object: 'Andromeda Galaxy', kind: 'Galaxy', date: '2026-11-11', time: '22:40', with: 'Binoculars', seeing: 4, where: 'Back garden' },
      { object: 'Pleiades', kind: 'Cluster', date: '2026-11-02', time: '21:15', with: 'Eye', seeing: 3, where: 'Park' },
    ],
  },
  {
    id: 'stays', name: 'Stays', family: 'world', glyph: 'home', archetype: 'log',
    pitch: 'Every hotel, guest house and campsite, with nights, cost and what to remember.',
    keywords: ['hotels', 'stays', 'accommodation', 'nights', 'travel', 'reviews'],
    tour: ['Log each stay with the nights and what it cost.', 'Rate it and note the room to ask for next time.', 'The strip shows nights away this year.'],
    log: {
      fields: [
        { id: 'name', label: 'Place', type: 'text', required: true },
        { id: 'town', label: 'Town', type: 'text' },
        { id: 'kind', label: 'Kind', type: 'choice', options: ['Hotel', 'Guest house', 'Holiday let', 'Hostel', 'Campsite', 'Friends'] },
        { id: 'date', label: 'Check-in', type: 'date', required: true },
        { id: 'nights', label: 'Nights', type: 'number', min: 1, default: 1 },
        { id: 'cost', label: 'Cost', type: 'money' },
        { id: 'rating', label: 'Rating', type: 'rating' },
        { id: 'ref', label: 'Booking ref', type: 'text' },
        { id: 'notes', label: 'Notes', type: 'long', hint: 'Room to ask for, breakfast, parking' },
      ],
      title: 'name', sub: '{town} · {nights} nights', meta: 'cost', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'kind',
      stats: [
        { label: 'Nights', kind: 'sum', field: 'nights', period: 'year' },
        { label: 'Spent', kind: 'sum', field: 'cost', period: 'year' },
        { label: 'Avg rating', kind: 'avg', field: 'rating' },
      ],
      views: ['list', 'calendar'],
      remind: { field: 'date', words: 'Check in today: {name}' },
    },
    sample: [
      { name: 'Guest house in Alfama', town: 'Lisbon', kind: 'Guest house', date: '2027-05-14', nights: 4, cost: 396, ref: '4419020' },
      { name: 'Lakeside campsite', town: 'Keswick', kind: 'Campsite', date: '2026-11-07', nights: 2, cost: 46, rating: 4, notes: 'Pitch 12 by the water.' },
      { name: 'Station hotel', town: 'York', kind: 'Hotel', date: '2026-09-18', nights: 1, cost: 118, rating: 3, notes: 'Ask for a room away from the lift.' },
    ],
  },
  {
    id: 'where-i-parked', name: 'Where I Parked', family: 'world', glyph: 'car', archetype: 'log',
    pitch: 'A photo and a note of where you left the car, and when the ticket runs out.',
    keywords: ['parking', 'car', 'parked', 'where', 'ticket', 'bay'],
    tour: ['Snap the level sign or a landmark, and type the bay.', 'Add when the ticket runs out so you are back in time.', 'The newest one is always at the top.'],
    log: {
      fields: [
        { id: 'spot', label: 'Spot', type: 'text', required: true, hint: 'e.g. Level 3, bay 42' },
        { id: 'date', label: 'Date', type: 'date', default: 'today' },
        { id: 'time', label: 'Parked at', type: 'time', default: 'now' },
        { id: 'until', label: 'Paid until', type: 'time' },
        { id: 'cost', label: 'Cost', type: 'money' },
        { id: 'photo', label: 'Photo', type: 'photo' },
        { id: 'notes', label: 'Notes', type: 'text', hint: 'e.g. Near the blue lifts' },
      ],
      title: 'spot', sub: 'Until {until}', meta: 'cost', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [{ label: 'This month', kind: 'sum', field: 'cost', period: 'month' }, { label: 'Times', kind: 'count', period: 'month' }],
      views: ['list', 'gallery'],
    },
    sample: [
      { spot: 'Level 3, bay 42', date: '2026-11-14', time: '10:12', until: '13:12', cost: 6.5, notes: 'Near the blue lifts.' },
      { spot: 'Station car park, row F', date: '2026-11-10', time: '07:31', until: '19:00', cost: 9.2 },
    ],
  },

  /* ===================== Checklists and a timer ===================== */
  {
    id: 'hiking-kit', name: 'Hiking Kit', family: 'world', glyph: 'tent', archetype: 'checklist',
    pitch: 'The kit for a safe day on the hills, checked before you leave the house.',
    keywords: ['hiking', 'kit', 'checklist', 'walking', 'hills', 'safety'],
    tour: ['Tick it through before every hill day; it starts fresh each time.', 'Map, compass and torch matter most when the phone dies.', 'Tell someone your route and when you will be back.'],
    checklist: {
      repeat: 'never',
      sections: [
        { name: 'Navigation', items: ['Paper map in a waterproof case', 'Compass', 'Phone, fully charged', 'Power bank'] },
        { name: 'Clothing', items: ['Waterproof jacket', 'Waterproof trousers', 'Warm layer', 'Hat and gloves', 'Walking boots', 'Spare socks'] },
        { name: 'Safety', items: ['Head torch', 'Whistle', 'First aid kit', 'Emergency bag or blanket', 'Route left with someone'] },
        { name: 'Food and water', items: ['Water, at least a litre', 'Lunch', 'Extra snacks', 'Hot drink in a flask'] },
      ],
    },
  },
  {
    id: 'before-you-fly', name: 'Before You Fly', family: 'world', glyph: 'plane', archetype: 'checklist',
    pitch: 'Everything to do in the days and hours before a flight, in order.',
    keywords: ['flight', 'airport', 'checklist', 'check', 'in', 'travel'],
    tour: ['Work down it from a week out to the morning you leave.', 'Check passport validity first: some countries need months left.', 'Online check-in usually opens a day or two before.'],
    checklist: {
      repeat: 'never',
      sections: [
        { name: 'A week before', items: ['Check passport expiry against entry rules', 'Check visa or entry permit needs', 'Buy travel insurance', 'Tell your bank you are travelling', 'Order some local currency'] },
        { name: 'The day before', items: ['Check in online', 'Download boarding passes', 'Weigh the bags', 'Liquids into a clear bag', 'Charge everything'] },
        { name: 'Leaving', items: ['Passport', 'Phone and charger', 'Check the flight time and terminal', 'Leave with time to spare'] },
      ],
    },
  },
  {
    id: 'leaving-home', name: 'Leaving Home', family: 'world', glyph: 'key', archetype: 'checklist',
    pitch: 'Lock up properly before a trip: water, heating, plugs, bins and post.',
    keywords: ['leaving', 'home', 'holiday', 'lock', 'checklist', 'house'],
    tour: ['Walk round the house with the list as you leave.', 'Turn the heating down, not off, in winter to stop pipes freezing.', 'Ask a neighbour to take in parcels.'],
    checklist: {
      repeat: 'never',
      sections: [
        { name: 'Inside', items: ['Windows shut and locked', 'Heating down or on holiday mode', 'Appliances off at the wall', 'Fridge cleared of short-dated food', 'Bins emptied', 'Plants watered'] },
        { name: 'Outside', items: ['Back door and garden gate locked', 'Bins out or put away', 'Outside tap off in winter'] },
        { name: 'Arrangements', items: ['Neighbour has a key', 'Parcels and post covered', 'Timer lights set', 'Front door double-locked'] },
      ],
    },
  },
  {
    id: 'car-check', name: 'Car Check', family: 'world', glyph: 'wrench', archetype: 'checklist',
    pitch: 'The quick weekly checks before a long drive: fuel, oil, water, tyres and lights.',
    keywords: ['car', 'check', 'tyres', 'oil', 'powder', 'drive'],
    tour: ['Run through it weekly and before every long drive.', 'Check tyres cold, with the pressures from the door sill or handbook.', 'Tread must be at least 1.6 mm across the central three-quarters.'],
    checklist: {
      repeat: 'weekly',
      sections: [
        { name: 'Under the bonnet', items: ['Oil between the marks', 'Coolant at the level', 'Screen wash topped up', 'Brake fluid at the level'] },
        { name: 'Tyres', items: ['Pressures right, cold', 'Tread at least 1.6 mm', 'No cuts or bulges', 'Spare or repair kit present'] },
        { name: 'Lights and screen', items: ['Headlights and brake lights work', 'Indicators work', 'Wipers clear the screen', 'No chips in the driver\'s view'] },
        { name: 'Fuel', items: ['Enough fuel or charge for the trip'] },
      ],
    },
  },
  {
    id: 'winter-car-kit', name: 'Winter Car Kit', family: 'world', glyph: 'cloud', archetype: 'checklist',
    pitch: 'What to keep in the car through winter in case you are stuck in snow.',
    keywords: ['winter', 'car', 'kit', 'snow', 'ice', 'emergency'],
    tour: ['Pack it in October and check it each month until spring.', 'Keep the tank at least a quarter full in freezing weather.', 'A charged phone and a blanket matter most if you are stuck.'],
    checklist: {
      repeat: 'never',
      sections: [
        { name: 'Clearing', items: ['Ice scraper', 'De-icer', 'Small shovel', 'Grit or an old mat for grip'] },
        { name: 'Staying warm', items: ['Blanket', 'Warm coat, hat and gloves', 'Boots'] },
        { name: 'Just in case', items: ['Torch with spare batteries', 'Phone charger cable', 'Food and a drink', 'First aid kit', 'Jump leads', 'Hi-vis vest'] },
      ],
    },
  },
  {
    id: 'camping-kit', name: 'Camping Kit', family: 'world', glyph: 'tent', archetype: 'checklist',
    pitch: 'Tent, bedding, cooking and comfort: the camping list nothing gets left off.',
    keywords: ['camping', 'kit', 'tent', 'checklist', 'outdoors'],
    tour: ['Tick each item as it goes in the car.', 'Pitch a new tent at home once before the trip.', 'Untick everything in settings to reuse it.'],
    checklist: {
      repeat: 'never',
      sections: [
        { name: 'Shelter', items: ['Tent with poles and pegs', 'Mallet', 'Groundsheet', 'Spare guy lines'] },
        { name: 'Sleep', items: ['Sleeping bags', 'Mats or airbeds', 'Pump', 'Pillows'] },
        { name: 'Kitchen', items: ['Stove and gas', 'Lighter', 'Pan and kettle', 'Plates, mugs and cutlery', 'Cool box', 'Water carrier', 'Washing-up bowl and bags'] },
        { name: 'Comfort', items: ['Chairs', 'Lantern and head torches', 'Warm layers', 'Wash bag and towel', 'Toilet roll'] },
      ],
    },
  },
  {
    id: 'driver-breaks', name: 'Driver Breaks', family: 'world', glyph: 'timer', archetype: 'timer',
    pitch: 'A timer for long drives: a chime for a break of 15 minutes every two hours.',
    keywords: ['driving', 'break', 'tired', 'long', 'drive', 'timer'],
    tour: ['Start it as you pull away; it chimes when a break is due.', 'The Highway Code advises at least 15 minutes every two hours.', 'If you feel sleepy before then, stop somewhere safe.'],
    timer: { rounds: 4, steps: [{ name: 'Drive', secs: 7200 }, { name: 'Break', secs: 900 }] },
  },
  /* ===================== More ===================== */
  {
    id: 'daylight', name: 'Daylight', family: 'world', glyph: 'sun', archetype: 'calc',
    pitch: 'Sunrise, sunset and day length for any place and day of the year.',
    keywords: ['sunrise', 'sunset', 'daylight', 'sun', 'dark', 'hours'],
    tour: ['Type the place, the day of the year and the UTC offset.', 'Day 172 is about 21 June; day 355 is about 21 December.', 'Plan walks to be off the hill well before sunset.'],
    calc: {
      source: 'Solar declination, equation of time and sunrise hour angle with 0.833° refraction (PVEducation, "Solar Time" and "Elevation Angle")',
      estimate: true,
      inputs: [
        { id: 'lat', label: 'Latitude', unit: '°', default: 51.5074, min: -65, max: 65, step: 0.0001 },
        { id: 'lon', label: 'Longitude', unit: '°', default: -0.1278, min: -180, max: 180, step: 0.0001 },
        { id: 'n', label: 'Year day', default: 172, min: 1, max: 365, step: 1 },
        { id: 'tz', label: 'UTC offset', unit: 'h', default: 1, min: -12, max: 14, step: 0.5 },
      ],
      outputs: [
        { id: 'b', label: 'B angle', expr: '360/365*(n - 81)', dp: 3 },
        { id: 'eot', label: 'Time equation', expr: '9.87*sin(2*b) - 7.53*cos(b) - 1.5*sin(b)', unit: 'min', dp: 2 },
        { id: 'dec', label: 'Declination', expr: '23.45*sin(360/365*(284 + n))', unit: '°', dp: 2 },
        { id: 'w', label: 'Hour angle', expr: 'acos(clamp((sin(-0.833) - sin(lat)*sin(dec)) / (cos(lat)*cos(dec)), -1, 1))', unit: '°', dp: 2 },
        { id: 'noon', label: 'Solar noon', expr: '12 - lon/15 - eot/60 + tz', unit: 'h', dp: 2 },
        { id: 'rise', label: 'Sunrise', expr: '(noon - w/15) * 60', format: 'duration', dp: 0 },
        { id: 'set', label: 'Sunset', expr: '(noon + w/15) * 60', format: 'duration', dp: 0 },
        { id: 'len', label: 'Day length', expr: '2*w/15*60', format: 'duration', dp: 0 },
      ],
      tests: [
        { in: { lat: 51.5074, lon: -0.1278, n: 172, tz: 1 }, out: { rise: 282.7, set: 1281.2, len: 998.5 } },
        { in: { lat: 51.5074, lon: -0.1278, n: 355, tz: 0 }, out: { rise: 484.5, set: 953.8, len: 469.3 } },
      ],
    },
  },
  {
    id: 'sailing-terms', name: 'Sailing Terms', family: 'world', glyph: 'anchor', archetype: 'deck',
    pitch: 'The words of the sea, port to starboard and fathom to galley, learned for good.',
    keywords: ['sailing', 'nautical', 'boat', 'terms', 'sea'],
    tour: ['Each card is one word you will hear on any boat.', 'Port and left both have four letters: that is the trick.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Port=The left side, facing forward;Starboard=The right side, facing forward;Bow=The front of the boat;' +
        'Stern=The back of the boat;Aft=Towards the back;Beam=The boat\'s widest point;Keel=The backbone along the bottom of the hull;' +
        'Helm=Where the boat is steered;Galley=The kitchen;Head=The toilet;Windward=The side the wind blows from;' +
        'Leeward=The side sheltered from the wind;Knot=One nautical mile an hour;Nautical mile=1,852 metres;Fathom=Six feet of depth;' +
        'Port light colour=Red;Starboard light colour=Green;Bulkhead=An upright wall inside the hull',
      ),
    },
  },
  {
    id: 'compass-points', name: 'Compass Points', family: 'world', glyph: 'compass', archetype: 'deck',
    pitch: 'All sixteen compass points and their bearings in degrees.',
    keywords: ['compass', 'bearings', 'directions', 'navigation', 'map'],
    tour: ['Each card shows a point; say its bearing.', 'Each step round the rose is 22.5 degrees.', 'NNE is between north and north-east.'],
    deck: { mode: 'srs', cards: COMPASS },
  },
  {
    id: 'world-languages', name: 'World Languages', family: 'world', glyph: 'chat', archetype: 'deck',
    pitch: 'The official languages of countries you might visit, so you know what to learn.',
    keywords: ['languages', 'countries', 'official', 'travel', 'geography'],
    tour: ['Each card names a country; say its official languages.', 'Several countries have more than one: Switzerland has four.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Brazil=Portuguese;Argentina=Spanish;Switzerland=German, French, Italian and Romansh;Belgium=Dutch, French and German;' +
        'Canada=English and French;Pakistan=Urdu and English;India=Hindi and English, with 22 scheduled languages;Iran=Persian;' +
        'Egypt=Arabic;Austria=German;Kenya=Swahili and English;Philippines=Filipino and English;Malaysia=Malay;' +
        'Indonesia=Indonesian;Vietnam=Vietnamese;Bangladesh=Bengali;Afghanistan=Pashto and Dari;Ireland=Irish and English;' +
        'Finland=Finnish and Swedish;Morocco=Arabic and Amazigh;Sri Lanka=Sinhala and Tamil;Singapore=English, Malay, Mandarin and Tamil;' +
        'Luxembourg=Luxembourgish, French and German',
      ),
    },
  },
  {
    id: 'beach-day', name: 'Beach Day', family: 'world', glyph: 'wave', archetype: 'checklist',
    pitch: 'Everything for a day at the beach, from sun cream to the tide times.',
    keywords: ['beach', 'seaside', 'checklist', 'summer', 'swimming'],
    tour: ['Tick it through before you leave the house.', 'Check the tide times: some beaches vanish at high tide.', 'Swim where lifeguards patrol, between the flags.'],
    checklist: {
      repeat: 'never',
      sections: [
        { name: 'Before you go', items: ['Check the tide times', 'Check the weather', 'Find a lifeguarded beach'] },
        { name: 'Bag', items: ['Sun cream', 'Hats and sunglasses', 'Towels', 'Swimwear', 'Water and snacks', 'Windbreak or shade', 'Bags for rubbish'] },
        { name: 'Leaving', items: ['All litter packed up', 'Rinse off the sand', 'Count the towels'] },
      ],
    },
  },
  {
    id: 'ski-trip', name: 'Ski Trip', family: 'world', glyph: 'mountain', archetype: 'checklist',
    pitch: 'The ski trip list: clothing layers, kit, passes and the things people forget.',
    keywords: ['ski', 'snowboard', 'snow', 'checklist', 'winter', 'trip'],
    tour: ['Tick each thing as it goes in the bag.', 'Layers beat one thick coat: base, mid and shell.', 'Check your insurance covers winter sports.'],
    checklist: {
      repeat: 'never',
      sections: [
        { name: 'Papers', items: ['Passport', 'Insurance with winter sports cover', 'GHIC', 'Lift pass booking', 'Ski hire booking'] },
        { name: 'Clothing', items: ['Thermal base layers', 'Fleece mid layer', 'Ski jacket', 'Ski trousers', 'Ski socks', 'Gloves and liners', 'Neck warmer', 'Hat'] },
        { name: 'Kit', items: ['Helmet', 'Goggles', 'Sunglasses', 'High-factor sun cream and lip balm', 'Small backpack'] },
        { name: 'Evenings', items: ['Snow boots', 'Swimwear for the pool', 'Phone charger and adapter'] },
      ],
    },
  },
]);
