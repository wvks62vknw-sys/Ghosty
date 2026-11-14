import type { AppDef, AppGlyph, Field, FieldType, CalcInput, CalcOutput } from '../types';

/**
 * The Library's Utilities (docs/build-plan/APPLIB.md, list in docs/build-plan/applib/catalogue-tools.md): unit
 * converters, everyday sums, tallies, timers, checklists and small logs. Every unit factor is an exact definition from
 * the SI and the UK Weights and Measures Act 1985 unless named otherwise. Nothing here calls a server or costs money.
 */

const fd = (id: string, label: string, type: FieldType, extra: Partial<Field> = {}): Field => ({ id, label, type, ...extra });
const inp = (id: string, label: string, def: number, extra: Partial<CalcInput> = {}): CalcInput => ({ id, label, default: def, ...extra });
const out = (id: string, label: string, expr: string, extra: Partial<CalcOutput> = {}): CalcOutput => ({ id, label, expr, ...extra });
const money = (id: string, label: string, expr: string, dp = 2): CalcOutput => ({ id, label, expr, format: 'money', dp });

/** A unit converter: each unit's size in one base unit; the answer is value × from ÷ to. */
function converter(o: {
  id: string; name: string; glyph: AppGlyph; pitch: string; keywords: string[]; what: string;
  units: [string, number][]; from: number; to: number; value: number; tests: [number, number, number, number][]; source: string;
}): AppDef {
  const choices = o.units.map(([label, value]) => ({ label, value }));
  return {
    id: o.id, name: o.name, family: 'tools', glyph: o.glyph, pitch: o.pitch, keywords: o.keywords, archetype: 'calc',
    tour: [`Type a ${o.what} and pick the unit it is in.`, 'Pick the unit you want and the answer updates as you type.', 'Swap the two units to convert the other way.'],
    calc: {
      inputs: [inp('value', 'Value', o.value, { step: 0.01 }), inp('from', 'From', o.from, { choices }), inp('to', 'To', o.to, { choices })],
      outputs: [out('result', 'Result', 'value * from / to', { dp: 4 })],
      tests: o.tests.map(([value, from, to, result]) => ({ in: { value, from, to }, out: { result } })),
      source: o.source,
    },
  };
}
const SI = 'SI definitions and the UK Weights and Measures Act 1985 (exact factors)';

export const TOOLS: AppDef[] = [
  // ——— Pay, tax and everyday sums ———
  {
    id: 'take-home-pay', name: 'Take-Home Pay', family: 'tools', glyph: 'wallet', from: 'tools.21', archetype: 'calc',
    pitch: 'Your take-home pay after tax, National Insurance, pension and student loan.',
    keywords: ['take home', 'salary', 'net pay', 'income tax', 'national insurance', 'student loan'],
    tour: ['Put in your yearly salary before tax.', 'Add your pension percent and pick your student loan plan.', 'Rest of UK rates for 2026 to 2027; Scotland’s bands differ.'],
    calc: {
      inputs: [
        inp('salary', 'Salary', 30000, { unit: '£ a year', min: 0, step: 500 }),
        inp('pension', 'Pension', 0, { unit: '%', min: 0, max: 60, step: 0.5 }),
        inp('plan', 'Student Loan', 0, { choices: [{ label: 'None', value: 0 }, { label: 'Plan 1', value: 1 }, { label: 'Plan 2', value: 2 }, { label: 'Plan 4', value: 4 }, { label: 'Plan 5', value: 5 }] }),
        inp('pg', 'Postgraduate Loan', 0, { choices: [{ label: 'No', value: 0 }, { label: 'Yes', value: 1 }] }),
      ],
      outputs: [
        money('pen', 'Pension', 'salary * pension / 100'),
        money('allowance', 'Personal Allowance', 'max(0, 12570 - max(0, salary - pen - 100000) / 2)', 0),
        money('tax', 'Income Tax', 'min(max(0, salary - pen - allowance), 37700) * 0.2 + clamp(salary - pen - allowance - 37700, 0, 87440) * 0.4 + max(0, salary - pen - allowance - 125140) * 0.45'),
        money('ni', 'National Insurance', '(clamp(salary, 12570, 50270) - 12570) * 0.08 + max(0, salary - 50270) * 0.02'),
        money('loan', 'Student Loan', 'if(plan == 0, 0, max(0, salary - if(plan == 1, 26900, if(plan == 2, 29385, if(plan == 4, 33795, 25000)))) * 0.09) + pg * max(0, salary - 21000) * 0.06'),
        money('net', 'Take-Home A Year', 'salary - pen - tax - ni - loan'),
        money('month', 'Take-Home A Month', 'net / 12'),
      ],
      tests: [
        { in: { salary: 30000, pension: 0, plan: 0, pg: 0 }, out: { tax: 3486, ni: 1394.4, net: 25119.6, month: 2093.3 } },
        { in: { salary: 60000, pension: 5, plan: 2, pg: 0 }, out: { tax: 10232, ni: 3210.6, loan: 2755.35, net: 40802.05 } },
        { in: { salary: 110000, pension: 0, plan: 0, pg: 0 }, out: { allowance: 7570, tax: 33432, net: 72357.4 } },
      ],
      estimate: true,
      source: 'GOV.UK Rates and thresholds for employers 2026 to 2027: income tax, Class 1 NI and student loan thresholds',
    },
  },
  {
    id: 'vat-calc', name: 'VAT', family: 'tools', glyph: 'receipt', from: 'tools.21', archetype: 'calc',
    pitch: 'Add VAT to a price or take it off, at the standard, reduced or zero rate.',
    keywords: ['vat', 'add vat', 'remove vat', 'ex vat', 'inc vat', 'tax'],
    tour: ['Type an amount.', 'Pick whether it is before VAT or already includes it.', 'See the price without VAT, the VAT and the price with it.'],
    calc: {
      inputs: [
        inp('amount', 'Amount', 100, { unit: '£', min: 0 }),
        inp('mode', 'Amount Is', 1, { choices: [{ label: 'Before VAT', value: 1 }, { label: 'Including VAT', value: 0 }] }),
        inp('rate', 'Rate', 20, { choices: [{ label: 'Standard 20%', value: 20 }, { label: 'Reduced 5%', value: 5 }, { label: 'Zero 0%', value: 0 }] }),
      ],
      outputs: [
        money('net', 'Before VAT', 'if(mode == 1, amount, amount / (1 + rate / 100))'),
        money('vat', 'VAT', 'net * rate / 100'),
        money('gross', 'With VAT', 'net + vat'),
      ],
      tests: [
        { in: { amount: 100, mode: 1, rate: 20 }, out: { net: 100, vat: 20, gross: 120 } },
        { in: { amount: 120, mode: 0, rate: 20 }, out: { net: 100, vat: 20 } },
        { in: { amount: 105, mode: 0, rate: 5 }, out: { net: 100, vat: 5 } },
      ],
      estimate: true,
      source: 'GOV.UK VAT rates: standard 20%, reduced 5%, zero 0%',
    },
  },
  {
    id: 'tip-split', name: 'Tip & Split', family: 'tools', glyph: 'people', from: 'tools.22', archetype: 'calc',
    pitch: 'Work out the tip and each person’s share of the bill in a second.',
    keywords: ['tip', 'split bill', 'restaurant', 'service charge', 'share', 'gratuity'],
    tour: ['Type the bill total.', 'Pick the tip percent; set it to zero if service is already added.', 'See the tip, the total and what each person pays.'],
    calc: {
      inputs: [
        inp('bill', 'Bill', 84, { unit: '£', min: 0 }),
        inp('tip', 'Tip', 12.5, { unit: '%', min: 0, max: 30, step: 0.5 }),
        inp('people', 'People', 4, { min: 1, max: 30 }),
      ],
      outputs: [
        money('tipamt', 'Tip', 'bill * tip / 100'),
        money('total', 'Total', 'bill + tipamt'),
        money('each', 'Each Pays', 'total / people'),
      ],
      tests: [
        { in: { bill: 84, tip: 12.5, people: 4 }, out: { tipamt: 10.5, total: 94.5, each: 23.63 } },
        { in: { bill: 60, tip: 0, people: 3 }, out: { each: 20 } },
      ],
      source: 'Percentage arithmetic: tip = bill × percent ÷ 100',
    },
  },
  {
    id: 'discount-calc', name: 'Discount', family: 'tools', glyph: 'tag', from: 'tools.22', archetype: 'calc',
    pitch: 'The sale price and saving, with a second discount taken off the first.',
    keywords: ['discount', 'sale price', 'percent off', 'saving', 'offer', 'voucher'],
    tour: ['Type the full price.', 'Add the percent off, and any extra percent taken at the till.', 'See the final price and what you save.'],
    calc: {
      inputs: [
        inp('price', 'Price', 80, { unit: '£', min: 0 }),
        inp('off', 'Percent Off', 25, { unit: '%', min: 0, max: 100 }),
        inp('extra', 'Extra Off', 0, { unit: '%', min: 0, max: 100 }),
      ],
      outputs: [
        money('final', 'You Pay', 'price * (1 - off / 100) * (1 - extra / 100)'),
        money('saved', 'You Save', 'price - final'),
        out('overall', 'Overall Off', 'if(price > 0, saved / price * 100, 0)', { unit: '%', dp: 1 }),
      ],
      tests: [
        { in: { price: 80, off: 25, extra: 0 }, out: { final: 60, saved: 20, overall: 25 } },
        { in: { price: 100, off: 20, extra: 10 }, out: { final: 72, overall: 28 } },
      ],
      source: 'Successive percentage discounts multiply: price × (1 − a) × (1 − b)',
    },
  },
  {
    id: 'percent-sums', name: 'Percent Sums', family: 'tools', glyph: 'calc', from: 'tools.22', archetype: 'calc',
    pitch: 'Percent of, what percent, and percentage change between two numbers.',
    keywords: ['percent', 'percentage', 'percent change', 'increase', 'decrease', 'ratio'],
    tour: ['Type two numbers, A and B.', 'See A percent of B, and A as a percent of B.', 'The change line shows the rise or fall from A to B.'],
    calc: {
      inputs: [inp('a', 'A', 20, { step: 0.01 }), inp('b', 'B', 50, { step: 0.01 })],
      outputs: [
        out('aofb', 'A% Of B', 'a / 100 * b', { dp: 2 }),
        out('aasb', 'A As % B', 'if(b != 0, a / b * 100, 0)', { unit: '%', dp: 2 }),
        out('change', 'Change A To B', 'if(a != 0, (b - a) / abs(a) * 100, 0)', { unit: '%', dp: 2 }),
      ],
      tests: [
        { in: { a: 20, b: 50 }, out: { aofb: 10, aasb: 40, change: 150 } },
        { in: { a: 80, b: 60 }, out: { aofb: 48, change: -25 } },
      ],
      source: 'Percentage definitions: part ÷ whole × 100; change = (new − old) ÷ old × 100',
    },
  },
  {
    id: 'unit-price', name: 'Unit Price', family: 'tools', glyph: 'cart', from: 'tools.22', archetype: 'calc',
    pitch: 'Which of two packs is cheaper per 100 g, per litre or each.',
    keywords: ['unit price', 'price per kg', 'cheaper', 'compare packs', 'shopping', 'per 100g'],
    tour: ['Type pack A’s price and size, then pack B’s, in the same unit.', 'See each pack’s price per 100 of that unit.', 'The last line shows how much dearer B is than A.'],
    calc: {
      inputs: [
        inp('pa', 'Price A', 2.5, { unit: '£', min: 0.01 }),
        inp('sa', 'Size A', 500, { unit: 'g or ml', min: 0.01 }),
        inp('pb', 'Price B', 4, { unit: '£', min: 0.01 }),
        inp('sb', 'Size B', 1000, { unit: 'g or ml', min: 0.01 }),
      ],
      outputs: [
        money('ua', 'A Per 100', 'pa / sa * 100', 3),
        money('ub', 'B Per 100', 'pb / sb * 100', 3),
        out('dearer', 'B Dearer By', '(ub / ua - 1) * 100', { unit: '%', dp: 1 }),
      ],
      tests: [
        { in: { pa: 2.5, sa: 500, pb: 4, sb: 1000 }, out: { ua: 0.5, ub: 0.4, dearer: -20 } },
        { in: { pa: 1, sa: 100, pb: 3, sb: 200 }, out: { ub: 1.5, dearer: 50 } },
      ],
      source: 'Unit pricing as in the Price Marking Order 2004: price ÷ quantity',
    },
  },
  {
    id: 'trip-fuel', name: 'Trip Fuel Cost', family: 'tools', glyph: 'car', from: 'tools.22', archetype: 'calc',
    pitch: 'What a journey costs in fuel from its miles, your mpg and the pump price.',
    keywords: ['fuel cost', 'trip cost', 'petrol', 'mpg', 'journey', 'split fuel'],
    tour: ['Type the miles, your car’s mpg and the price per litre.', 'Set how many share the car to split the cost.', 'One UK gallon is 4.54609 litres.'],
    calc: {
      inputs: [
        inp('miles', 'Miles', 100, { min: 0 }),
        inp('mpg', 'Economy', 50, { unit: 'mpg', min: 1 }),
        inp('price', 'Fuel Price', 140, { unit: 'p per litre', min: 1 }),
        inp('people', 'Sharing', 1, { min: 1, max: 9 }),
        inp('ret', 'Return Trip', 1, { choices: [{ label: 'One way', value: 1 }, { label: 'There and back', value: 2 }] }),
      ],
      outputs: [
        out('litres', 'Fuel', 'miles * ret / mpg * 4.54609', { unit: 'litres', dp: 1 }),
        money('cost', 'Cost', 'litres * price / 100'),
        money('each', 'Each Pays', 'cost / people'),
      ],
      tests: [
        { in: { miles: 100, mpg: 50, price: 140, people: 1, ret: 1 }, out: { litres: 9.09, cost: 12.73 } },
        { in: { miles: 100, mpg: 50, price: 140, people: 2, ret: 2 }, out: { cost: 25.46, each: 12.73 } },
      ],
      source: 'UK gallon = 4.54609 litres (Weights and Measures Act 1985)',
    },
  },
  {
    id: 'pay-converter', name: 'Pay Converter', family: 'tools', glyph: 'coins', from: 'tools.22', archetype: 'calc',
    pitch: 'Swap hourly pay into weekly, monthly and yearly pay, before tax.',
    keywords: ['hourly rate', 'salary', 'weekly pay', 'annual', 'pay', 'wage'],
    tour: ['Type your hourly rate and hours a week.', 'See your weekly, monthly and yearly pay before tax.', 'A year is counted as 52 weeks.'],
    calc: {
      inputs: [
        inp('hourly', 'Hourly Rate', 12.71, { unit: '£', min: 0, step: 0.01 }),
        inp('hours', 'Hours A Week', 37.5, { min: 0, max: 100, step: 0.5 }),
      ],
      outputs: [
        money('week', 'Weekly', 'hourly * hours'),
        money('month', 'Monthly', 'week * 52 / 12'),
        money('year', 'Yearly', 'week * 52', 0),
      ],
      tests: [
        { in: { hourly: 12.71, hours: 37.5 }, out: { week: 476.63, year: 24784.5 } },
        { in: { hourly: 20, hours: 40 }, out: { week: 800, month: 3466.67, year: 41600 } },
      ],
      source: 'GOV.UK pay conversion: 52 weeks a year, 12 months a year',
    },
  },
  {
    id: 'ratio-scaler', name: 'Ratio Scaler', family: 'tools', glyph: 'layers', from: 'tools.22', archetype: 'calc',
    pitch: 'Scale any amount up or down by ratio, from recipes to mixes and dilutions.',
    keywords: ['ratio', 'scale', 'recipe', 'proportion', 'dilution', 'mix'],
    tour: ['Type the amount the original uses and what it makes.', 'Type what you want to make instead.', 'See the new amount, and the scale factor for the rest.'],
    calc: {
      inputs: [
        inp('amount', 'Amount', 200, { min: 0 }),
        inp('makes', 'It Makes', 4, { min: 0.01 }),
        inp('want', 'I Want', 6, { min: 0 }),
      ],
      outputs: [
        out('factor', 'Scale Factor', 'want / makes', { dp: 3 }),
        out('scaled', 'New Amount', 'amount * factor', { dp: 2 }),
      ],
      tests: [
        { in: { amount: 200, makes: 4, want: 6 }, out: { factor: 1.5, scaled: 300 } },
        { in: { amount: 90, makes: 6, want: 2 }, out: { scaled: 30 } },
      ],
      source: 'Direct proportion: new = amount × wanted ÷ original',
    },
  },
  {
    id: 'shift-hours', name: 'Shift Hours', family: 'tools', glyph: 'clock', archetype: 'calc',
    pitch: 'Hours worked between two times, across midnight and less breaks, with the pay.',
    keywords: ['shift', 'hours worked', 'time sheet', 'night shift', 'breaks', 'pay'],
    tour: ['Type the start and end times as hours and minutes.', 'Take off unpaid break minutes; night shifts across midnight work.', 'Add your hourly rate to see the shift’s pay.'],
    calc: {
      inputs: [
        inp('sh', 'Start Hour', 9, { min: 0, max: 23 }),
        inp('sm', 'Start Minute', 0, { min: 0, max: 59 }),
        inp('eh', 'End Hour', 17, { min: 0, max: 23 }),
        inp('em', 'End Minute', 30, { min: 0, max: 59 }),
        inp('brk', 'Break', 30, { unit: 'min', min: 0, max: 240 }),
        inp('rate', 'Hourly Rate', 0, { unit: '£', min: 0, step: 0.01 }),
      ],
      outputs: [
        out('mins', 'Minutes Worked', 'max(0, if(eh * 60 + em >= sh * 60 + sm, 0, 1440) + eh * 60 + em - sh * 60 - sm - brk)', { dp: 0 }),
        out('hours', 'Hours Worked', 'mins / 60', { dp: 2 }),
        money('pay', 'Pay', 'hours * rate'),
      ],
      tests: [
        { in: { sh: 9, sm: 0, eh: 17, em: 30, brk: 30, rate: 0 }, out: { mins: 480, hours: 8 } },
        { in: { sh: 22, sm: 0, eh: 6, em: 0, brk: 0, rate: 15 }, out: { hours: 8, pay: 120 } },
      ],
      source: 'Clock arithmetic: 1,440 minutes a day, with a shift past midnight carried into the next day',
    },
  },
  {
    id: 'currency-sums', name: 'Currency Sums', family: 'tools', glyph: 'globe', archetype: 'calc',
    pitch: 'Convert money at a rate you type, with the card fee shown, offline.',
    keywords: ['currency', 'exchange rate', 'euros', 'dollars', 'travel money', 'convert'],
    tour: ['Type the amount in pounds and the rate (how much one pound buys).', 'Add your card’s foreign fee percent, if it has one.', 'Or type a foreign price to see it in pounds.'],
    calc: {
      inputs: [
        inp('gbp', 'Pounds', 100, { unit: '£', min: 0 }),
        inp('rate', 'Rate', 1.15, { unit: 'per £1', min: 0.0001, step: 0.0001 }),
        inp('fee', 'Card Fee', 0, { unit: '%', min: 0, max: 10, step: 0.01 }),
        inp('foreign', 'Foreign Price', 50, { min: 0 }),
      ],
      outputs: [
        out('got', 'You Get', 'gbp * rate', { dp: 2 }),
        money('back', 'Foreign Price In £', 'foreign / rate * (1 + fee / 100)'),
        money('feecost', 'Fee On That', 'foreign / rate * fee / 100'),
      ],
      tests: [
        { in: { gbp: 100, rate: 1.15, fee: 0, foreign: 50 }, out: { got: 115, back: 43.48 } },
        { in: { gbp: 10, rate: 1.25, fee: 2.99, foreign: 100 }, out: { got: 12.5, back: 82.39, feecost: 2.39 } },
      ],
      source: 'Exchange arithmetic: foreign = pounds × rate, with a percentage card fee added',
    },
  },
  {
    id: 'speed-time', name: 'Speed & Time', family: 'tools', glyph: 'timer', archetype: 'calc',
    pitch: 'Average speed and pace from a distance and time, in km/h, mph and min per km.',
    keywords: ['speed', 'pace', 'average speed', 'distance', 'time', 'mph'],
    tour: ['Type the distance in kilometres.', 'Type the time it took in hours and minutes.', 'See speed in km/h and mph, and pace per km and per mile.'],
    calc: {
      inputs: [
        inp('km', 'Distance', 10, { unit: 'km', min: 0.01, step: 0.01 }),
        inp('h', 'Hours', 0, { min: 0 }),
        inp('m', 'Minutes', 50, { min: 0, step: 0.1 }),
      ],
      outputs: [
        out('kmh', 'Speed', 'km / ((h * 60 + m) / 60)', { unit: 'km/h', dp: 2 }),
        out('mph', 'Speed', 'kmh / 1.609344', { unit: 'mph', dp: 2 }),
        out('pace', 'Pace', '(h * 60 + m) / km', { unit: 'min per km', dp: 2 }),
        out('pacemi', 'Pace', '(h * 60 + m) / (km / 1.609344)', { unit: 'min per mile', dp: 2 }),
      ],
      tests: [
        { in: { km: 10, h: 0, m: 50 }, out: { kmh: 12, mph: 7.46, pace: 5, pacemi: 8.05 } },
        { in: { km: 42.195, h: 4, m: 0 }, out: { kmh: 10.55, pace: 5.69 } },
      ],
      source: 'Speed = distance ÷ time; 1 mile = 1.609344 km (international mile)',
    },
  },
  {
    id: 'height-angle', name: 'Height By Angle', family: 'tools', glyph: 'tree', from: 'tools.7', archetype: 'calc',
    pitch: 'Work out the height of a tree or building from your distance and the angle up.',
    keywords: ['height', 'tree height', 'clinometer', 'angle', 'building height', 'measure'],
    tour: ['Pace or measure your distance from the base.', 'Read the angle to the top with any clinometer or angle app.', 'Add your eye height; the answer is a first estimate.'],
    calc: {
      inputs: [
        inp('dist', 'Distance', 20, { unit: 'm', min: 0.1, step: 0.1 }),
        inp('angle', 'Angle Up', 45, { unit: '°', min: 0, max: 89, step: 0.5 }),
        inp('eye', 'Eye Height', 1.6, { unit: 'm', min: 0, max: 3, step: 0.05 }),
      ],
      outputs: [
        out('height', 'Height', 'eye + dist * tan(angle)', { unit: 'm', dp: 1 }),
        out('grade', 'Slope', 'tan(angle) * 100', { unit: '%', dp: 0 }),
      ],
      tests: [
        { in: { dist: 20, angle: 45, eye: 1.6 }, out: { height: 21.6, grade: 100 } },
        { in: { dist: 30, angle: 30, eye: 1.5 }, out: { height: 18.82 } },
      ],
      estimate: true,
      source: 'Forestry Commission clinometer method: height = distance × tan(angle) + eye height',
    },
  },
  {
    id: 'password-strength', name: 'Password Strength', family: 'tools', glyph: 'lock', from: 'tools.59', archetype: 'calc',
    pitch: 'How strong a password or passphrase pattern is, in bits and time to guess.',
    keywords: ['password', 'passphrase', 'strength', 'entropy', 'security', 'crack time'],
    tour: ['Pick the kind of characters, or random words, it is built from.', 'Type its length; nothing you type is the password itself.', 'Aim for 80 bits or more for anything that matters.'],
    calc: {
      inputs: [
        inp('length', 'Length', 16, { unit: 'characters or words', min: 1, max: 64 }),
        inp('pool', 'Built From', 94, { choices: [{ label: 'Digits only', value: 10 }, { label: 'Lower case', value: 26 }, { label: 'Upper and lower', value: 52 }, { label: 'Letters and digits', value: 62 }, { label: 'All keyboard symbols', value: 94 }, { label: 'Random words (7,776)', value: 7776 }] }),
        inp('rate', 'Attacker Speed', 10000000000, { choices: [{ label: 'Online, throttled', value: 100 }, { label: 'Offline, slow hash', value: 10000 }, { label: 'Offline, fast hash', value: 10000000000 }] }),
      ],
      outputs: [
        out('bits', 'Strength', 'length * ln(pool) / ln(2)', { unit: 'bits', dp: 1 }),
        out('years', 'Years To Guess', 'bits * log10(2) - log10(2 * rate * 31557600)', { unit: 'as a power of 10', dp: 1 }),
      ],
      tests: [
        { in: { length: 16, pool: 94, rate: 10000000000 }, out: { bits: 104.9, years: 13.77 } },
        { in: { length: 6, pool: 7776, rate: 100 }, out: { bits: 77.55 } },
        { in: { length: 8, pool: 26, rate: 10000000000 }, out: { bits: 37.6 } },
      ],
      estimate: true,
      source: 'NIST SP 800-63 entropy: bits = length × log2(pool size); half the space searched on average',
    },
  },
  {
    id: 'screen-density', name: 'Screen Density', family: 'tools', glyph: 'phone', archetype: 'calc',
    pitch: 'Pixels per inch and aspect ratio of any screen from its resolution and size.',
    keywords: ['ppi', 'pixel density', 'screen size', 'resolution', 'aspect ratio', 'display'],
    tour: ['Type the screen’s width and height in pixels.', 'Type its diagonal size in inches.', 'See pixels per inch, the pixel size and the shape.'],
    calc: {
      inputs: [
        inp('w', 'Width', 2560, { unit: 'px', min: 1 }),
        inp('h', 'Height', 1440, { unit: 'px', min: 1 }),
        inp('diag', 'Diagonal', 27, { unit: 'inches', min: 0.5, step: 0.1 }),
      ],
      outputs: [
        out('ppi', 'Density', 'hypot(w, h) / diag', { unit: 'ppi', dp: 1 }),
        out('pitch', 'Pixel Size', '25.4 / ppi', { unit: 'mm', dp: 3 }),
        out('ratio', 'Aspect Ratio', 'w / h', { unit: ': 1', dp: 3 }),
      ],
      tests: [
        { in: { w: 2560, h: 1440, diag: 27 }, out: { ppi: 108.79, ratio: 1.778 } },
        { in: { w: 1920, h: 1080, diag: 24 }, out: { ppi: 91.79 } },
      ],
      source: 'Pixel density = diagonal pixels (Pythagoras) ÷ diagonal inches; 1 inch = 25.4 mm',
    },
  },

  {
    id: 'room-area', name: 'Room Area', family: 'tools', glyph: 'ruler', archetype: 'calc',
    pitch: 'Floor area, wall area and volume of a room in metric and imperial.',
    keywords: ['room size', 'floor area', 'square metres', 'square feet', 'wall area', 'volume'],
    tour: ['Measure the room’s length, width and height in metres.', 'See the floor in m² and ft², and the walls in m².', 'Volume helps size a heater, dehumidifier or air purifier.'],
    calc: {
      inputs: [
        inp('len', 'Length', 4, { unit: 'm', min: 0, step: 0.01 }),
        inp('wid', 'Width', 3.5, { unit: 'm', min: 0, step: 0.01 }),
        inp('height', 'Height', 2.4, { unit: 'm', min: 0, step: 0.01 }),
      ],
      outputs: [
        out('floor', 'Floor', 'len * wid', { unit: 'm²', dp: 2 }),
        out('floorft', 'Floor', 'floor / 0.09290304', { unit: 'ft²', dp: 1 }),
        out('walls', 'Walls', '2 * (len + wid) * height', { unit: 'm²', dp: 2 }),
        out('volume', 'Volume', 'floor * height', { unit: 'm³', dp: 2 }),
      ],
      tests: [
        { in: { len: 4, wid: 3.5, height: 2.4 }, out: { floor: 14, floorft: 150.7, walls: 36, volume: 33.6 } },
        { in: { len: 10, wid: 10, height: 3 }, out: { floor: 100, floorft: 1076.4 } },
      ],
      source: 'Rectangle area and volume; 1 ft² = 0.09290304 m² (exact)',
    },
  },
  {
    id: 'ladder-angle', name: 'Ladder Angle', family: 'tools', glyph: 'tool', archetype: 'calc',
    pitch: 'How far out to stand a ladder’s foot for the safe 75 degree angle.',
    keywords: ['ladder', 'ladder safety', '1 in 4', 'angle', 'height', 'diy'],
    tour: ['Put in the height where the ladder rests against the wall.', 'Stand the foot one unit out for every four units up.', 'Add a metre above the landing point if you step off there.'],
    calc: {
      inputs: [
        inp('height', 'Resting Height', 4, { unit: 'm', min: 0.5, step: 0.1 }),
        inp('above', 'Extra Above', 0, { unit: 'm', min: 0, max: 2, step: 0.1 }),
      ],
      outputs: [
        out('base', 'Foot Out From Wall', 'height / 4', { unit: 'm', dp: 2 }),
        out('length', 'Ladder Length', 'hypot(height, height / 4) + above', { unit: 'm', dp: 2 }),
        out('angle', 'Angle', 'atan(4)', { unit: '°', dp: 1 }),
      ],
      tests: [
        { in: { height: 4, above: 0 }, out: { base: 1, length: 4.12, angle: 75.96 } },
        { in: { height: 6, above: 1 }, out: { base: 1.5, length: 7.18 } },
      ],
      estimate: true,
      source: 'HSE leaflet INDG455 Safe use of ladders: one unit out for every four units up (about 75°)',
    },
  },
  {
    id: 'average-calc', name: 'Average', family: 'tools', glyph: 'chart', archetype: 'calc',
    pitch: 'Mean, total, lowest, highest and range of up to six numbers.',
    keywords: ['average', 'mean', 'total', 'range', 'numbers', 'statistics'],
    tour: ['Type up to six numbers.', 'Set Count to how many you typed so blanks are left out.', 'See the mean, total, lowest, highest and range.'],
    calc: {
      inputs: [
        inp('a', 'First', 12, { step: 0.01 }), inp('b', 'Second', 15, { step: 0.01 }), inp('c', 'Third', 9, { step: 0.01 }),
        inp('d', 'Fourth', 0, { step: 0.01 }), inp('e2', 'Fifth', 0, { step: 0.01 }), inp('f', 'Sixth', 0, { step: 0.01 }),
        inp('n', 'Count', 3, { min: 1, max: 6 }),
      ],
      outputs: [
        out('total', 'Total', 'a + if(n >= 2, b, 0) + if(n >= 3, c, 0) + if(n >= 4, d, 0) + if(n >= 5, e2, 0) + if(n >= 6, f, 0)', { dp: 2 }),
        out('mean', 'Mean', 'total / n', { dp: 2 }),
        out('low', 'Lowest', 'min(a, if(n >= 2, b, a), if(n >= 3, c, a), if(n >= 4, d, a), if(n >= 5, e2, a), if(n >= 6, f, a))', { dp: 2 }),
        out('high', 'Highest', 'max(a, if(n >= 2, b, a), if(n >= 3, c, a), if(n >= 4, d, a), if(n >= 5, e2, a), if(n >= 6, f, a))', { dp: 2 }),
        out('range', 'Range', 'high - low', { dp: 2 }),
      ],
      tests: [
        { in: { a: 12, b: 15, c: 9, d: 0, e2: 0, f: 0, n: 3 }, out: { total: 36, mean: 12, low: 9, high: 15, range: 6 } },
        { in: { a: 1, b: 2, c: 3, d: 4, e2: 5, f: 6, n: 6 }, out: { mean: 3.5, range: 5 } },
      ],
      source: 'Arithmetic mean = total ÷ count; range = highest − lowest',
    },
  },
  {
    id: 'fraction-decimal', name: 'Fractions', family: 'tools', glyph: 'pie', archetype: 'calc',
    pitch: 'Turn a fraction into a decimal and a percent, and see it in sixteenths.',
    keywords: ['fraction', 'decimal', 'percent', 'inches', 'sixteenths', 'convert'],
    tour: ['Type the top and bottom of the fraction.', 'See it as a decimal and a percent.', 'The sixteenths line helps with tape measures in inches.'],
    calc: {
      inputs: [inp('top', 'Top', 3, { step: 1 }), inp('bottom', 'Bottom', 8, { min: 1, step: 1 })],
      outputs: [
        out('dec', 'Decimal', 'top / bottom', { dp: 4 }),
        out('pct', 'Percent', 'dec * 100', { unit: '%', dp: 2 }),
        out('sixteenths', 'Nearest Sixteenths', 'round(dec * 16)', { unit: '/16', dp: 0 }),
        out('mm', 'If Inches', 'dec * 25.4', { unit: 'mm', dp: 2 }),
      ],
      tests: [
        { in: { top: 3, bottom: 8 }, out: { dec: 0.375, pct: 37.5, sixteenths: 6, mm: 9.53 } },
        { in: { top: 1, bottom: 3 }, out: { dec: 0.3333, sixteenths: 5 } },
      ],
      source: 'Fraction = top ÷ bottom; 1 inch = 25.4 mm (exact)',
    },
  },
  {
    id: 'bulb-swap', name: 'Bulb Swap', family: 'tools', glyph: 'spark', archetype: 'calc',
    pitch: 'What swapping old bulbs for LEDs saves in a year at your electricity price.',
    keywords: ['led', 'light bulb', 'energy saving', 'lighting', 'electricity', 'swap'],
    tour: ['Put in the old bulb’s watts and the LED’s watts.', 'Add how many bulbs, the hours a day and your unit price.', 'See the yearly saving and how fast the new bulbs pay back.'],
    calc: {
      inputs: [
        inp('old', 'Old Bulb', 60, { unit: 'W', min: 0 }),
        inp('led', 'LED Bulb', 8, { unit: 'W', min: 0 }),
        inp('count', 'Bulbs', 6, { min: 1 }),
        inp('hours', 'Hours A Day', 4, { min: 0, max: 24, step: 0.5 }),
        inp('price', 'Unit Price', 26, { unit: 'p per kWh', min: 0, step: 0.1 }),
        inp('cost', 'LED Price Each', 3, { unit: '£', min: 0, step: 0.1 }),
      ],
      outputs: [
        out('kwh', 'Energy Saved', '(old - led) * count * hours * 365 / 1000', { unit: 'kWh a year', dp: 0 }),
        money('saving', 'Saved A Year', 'kwh * price / 100'),
        out('payback', 'Pays Back In', 'if(saving > 0, cost * count / saving * 12, 0)', { unit: 'months', dp: 1 }),
      ],
      tests: [
        { in: { old: 60, led: 8, count: 6, hours: 4, price: 26, cost: 3 }, out: { kwh: 455.52, saving: 118.44, payback: 1.82 } },
        { in: { old: 50, led: 5, count: 1, hours: 2, price: 30, cost: 0 }, out: { kwh: 32.85, saving: 9.86 } },
      ],
      estimate: true,
      source: 'Energy Saving Trust: kWh = watts × hours ÷ 1,000, times your unit rate',
    },
  },

  // ——— Unit converters ———
  converter({
    id: 'length-convert', name: 'Length', glyph: 'ruler', what: 'length', value: 1, from: 1609.344, to: 1000,
    pitch: 'Convert lengths between metric and imperial: mm to miles, inches to metres.',
    keywords: ['length', 'convert', 'inches', 'centimetres', 'feet', 'miles'],
    units: [['Millimetres', 0.001], ['Centimetres', 0.01], ['Metres', 1], ['Kilometres', 1000], ['Inches', 0.0254], ['Feet', 0.3048], ['Yards', 0.9144], ['Miles', 1609.344], ['Nautical miles', 1852]],
    tests: [[1, 1609.344, 1000, 1.609344], [12, 0.0254, 0.01, 30.48], [6, 0.3048, 1, 1.8288]], source: SI,
  }),
  converter({
    id: 'weight-convert', name: 'Weight', glyph: 'dumbbell', what: 'weight', value: 1, from: 6.35029318, to: 1,
    pitch: 'Convert weights: grams, kilos and tonnes to ounces, pounds and stones.',
    keywords: ['weight', 'convert', 'kilograms', 'pounds', 'stones', 'ounces'],
    units: [['Grams', 0.001], ['Kilograms', 1], ['Tonnes', 1000], ['Ounces', 0.028349523125], ['Pounds', 0.45359237], ['Stones', 6.35029318]],
    tests: [[1, 6.35029318, 1, 6.35029318], [1, 1, 0.45359237, 2.20462], [8, 0.028349523125, 0.001, 226.796]], source: SI,
  }),
  converter({
    id: 'volume-convert', name: 'Volume', glyph: 'bottle', what: 'volume', value: 1, from: 0.56826125, to: 0.001,
    pitch: 'Convert volumes: millilitres, litres, UK and US pints, gallons and spoons.',
    keywords: ['volume', 'convert', 'litres', 'pints', 'gallons', 'cups'],
    units: [['Millilitres', 0.001], ['Litres', 1], ['Cubic metres', 1000], ['Teaspoons', 0.005], ['Tablespoons', 0.015], ['Metric cups', 0.25], ['UK fluid ounces', 0.0284130625], ['UK pints', 0.56826125], ['UK gallons', 4.54609], ['US fluid ounces', 0.0295735295625], ['US pints', 0.473176473], ['US gallons', 3.785411784]],
    tests: [[1, 0.56826125, 0.001, 568.26125], [1, 4.54609, 3.785411784, 1.20095], [2, 1, 0.56826125, 3.51951]], source: SI,
  }),
  converter({
    id: 'area-convert', name: 'Area', glyph: 'grid', what: 'area', value: 1, from: 4046.8564224, to: 10000,
    pitch: 'Convert areas: square metres, hectares, acres, square feet and more.',
    keywords: ['area', 'convert', 'acres', 'hectares', 'square feet', 'square metres'],
    units: [['Square centimetres', 0.0001], ['Square metres', 1], ['Hectares', 10000], ['Square kilometres', 1000000], ['Square inches', 0.00064516], ['Square feet', 0.09290304], ['Square yards', 0.83612736], ['Acres', 4046.8564224], ['Square miles', 2589988.110336]],
    tests: [[1, 4046.8564224, 10000, 0.404686], [100, 0.09290304, 1, 9.290304], [1, 10000, 4046.8564224, 2.47105]], source: SI,
  }),
  converter({
    id: 'speed-convert', name: 'Speed', glyph: 'bolt', what: 'speed', value: 70, from: 0.44704, to: 0.2777777777777778,
    pitch: 'Convert speeds between mph, km/h, metres per second and knots.',
    keywords: ['speed', 'convert', 'mph', 'kmh', 'knots', 'metres per second'],
    units: [['Metres per second', 1], ['Kilometres per hour', 0.2777777777777778], ['Miles per hour', 0.44704], ['Knots', 0.5144444444444445], ['Feet per second', 0.3048]],
    tests: [[70, 0.44704, 0.2777777777777778, 112.654], [10, 0.5144444444444445, 0.2777777777777778, 18.52]], source: SI,
  }),
  {
    id: 'temperature-convert', name: 'Temperature', family: 'tools', glyph: 'sun', archetype: 'calc',
    pitch: 'Convert temperatures between Celsius, Fahrenheit and Kelvin.',
    keywords: ['temperature', 'celsius', 'fahrenheit', 'kelvin', 'convert', 'degrees'],
    tour: ['Type a temperature and pick its scale.', 'Pick the scale you want and the answer updates as you type.', 'Water freezes at 0 °C, 32 °F and 273.15 K.'],
    calc: {
      inputs: [
        inp('value', 'Value', 20, { step: 0.1 }),
        inp('from', 'From', 0, { choices: [{ label: 'Celsius', value: 0 }, { label: 'Fahrenheit', value: 1 }, { label: 'Kelvin', value: 2 }] }),
        inp('to', 'To', 1, { choices: [{ label: 'Celsius', value: 0 }, { label: 'Fahrenheit', value: 1 }, { label: 'Kelvin', value: 2 }] }),
      ],
      outputs: [
        out('c', 'In Celsius', 'if(from == 0, value, if(from == 1, (value - 32) * 5 / 9, value - 273.15))', { unit: '°C', dp: 2 }),
        out('result', 'Result', 'if(to == 0, c, if(to == 1, c * 9 / 5 + 32, c + 273.15))', { dp: 2 }),
      ],
      tests: [
        { in: { value: 20, from: 0, to: 1 }, out: { result: 68 } },
        { in: { value: 212, from: 1, to: 0 }, out: { result: 100 } },
        { in: { value: 0, from: 2, to: 0 }, out: { result: -273.15 } },
      ],
      source: 'SI Brochure: K = °C + 273.15; °F = °C × 9 ÷ 5 + 32',
    },
  },
  converter({
    id: 'data-convert', name: 'Data Size', glyph: 'chip', what: 'file size', value: 1, from: 1073741824, to: 1000000000,
    pitch: 'Convert data sizes between bits, bytes, decimal GB and binary GiB.',
    keywords: ['data size', 'megabytes', 'gigabytes', 'gib', 'bytes', 'convert'],
    units: [['Bits', 0.125], ['Bytes', 1], ['Kilobytes (kB)', 1000], ['Megabytes (MB)', 1000000], ['Gigabytes (GB)', 1000000000], ['Terabytes (TB)', 1000000000000], ['Kibibytes (KiB)', 1024], ['Mebibytes (MiB)', 1048576], ['Gibibytes (GiB)', 1073741824], ['Tebibytes (TiB)', 1099511627776]],
    tests: [[1, 1073741824, 1000000000, 1.073741824], [1, 1000000000000, 1099511627776, 0.909495], [8, 0.125, 1, 1]], source: 'IEC 80000-13 decimal and binary prefixes',
  }),
  converter({
    id: 'pressure-convert', name: 'Pressure', glyph: 'cloud', what: 'pressure', value: 32, from: 6894.757293168, to: 100000,
    pitch: 'Convert pressure: psi, bar, kilopascals, atmospheres and mmHg.',
    keywords: ['pressure', 'psi', 'bar', 'tyre pressure', 'kpa', 'convert'],
    units: [['Pascals', 1], ['Kilopascals', 1000], ['Bar', 100000], ['Millibar', 100], ['Psi', 6894.757293168], ['Atmospheres', 101325], ['mmHg', 133.322387415]],
    tests: [[32, 6894.757293168, 100000, 2.20632], [1, 101325, 1000, 101.325]], source: 'SI and NIST SP 811 conversion factors',
  }),
  converter({
    id: 'energy-convert', name: 'Energy', glyph: 'fire', what: 'amount of energy', value: 1, from: 3600000, to: 1000,
    pitch: 'Convert energy: joules, kilowatt hours, calories, kilocalories and BTU.',
    keywords: ['energy', 'kwh', 'calories', 'joules', 'btu', 'convert'],
    units: [['Joules', 1], ['Kilojoules', 1000], ['Megajoules', 1000000], ['Watt hours', 3600], ['Kilowatt hours', 3600000], ['Calories', 4.184], ['Kilocalories', 4184], ['BTU', 1055.05585262]],
    tests: [[1, 3600000, 1000, 3600], [100, 4184, 1000, 418.4], [1, 3600000, 1055.05585262, 3412.14]], source: 'SI and NIST SP 811 (thermochemical calorie, international table BTU)',
  }),
  converter({
    id: 'power-convert', name: 'Power', glyph: 'battery', what: 'power', value: 100, from: 745.69987158227, to: 1000,
    pitch: 'Convert power: watts, kilowatts, horsepower, metric horsepower and BTU per hour.',
    keywords: ['power', 'horsepower', 'kilowatts', 'watts', 'bhp', 'convert'],
    units: [['Watts', 1], ['Kilowatts', 1000], ['Horsepower', 745.69987158227], ['Metric horsepower', 735.49875], ['BTU per hour', 0.29307107]],
    tests: [[100, 745.69987158227, 1000, 74.57], [1, 1000, 735.49875, 1.35962]], source: 'NIST SP 811 conversion factors',
  }),
  converter({
    id: 'time-convert', name: 'Time Units', glyph: 'hourglass', what: 'length of time', value: 90, from: 60, to: 3600,
    pitch: 'Convert time between seconds, minutes, hours, days, weeks and years.',
    keywords: ['time', 'convert', 'seconds', 'minutes', 'hours', 'days'],
    units: [['Seconds', 1], ['Minutes', 60], ['Hours', 3600], ['Days', 86400], ['Weeks', 604800], ['Years (365 days)', 31536000]],
    tests: [[90, 60, 3600, 1.5], [2, 604800, 86400, 14]], source: 'SI second; 60 s a minute, 24 hours a day',
  }),
  converter({
    id: 'angle-convert', name: 'Angles', glyph: 'compass', what: 'angle', value: 1, from: 57.29577951308232, to: 1,
    pitch: 'Convert angles between degrees, radians, gradians and turns.',
    keywords: ['angle', 'degrees', 'radians', 'gradians', 'convert', 'turns'],
    units: [['Degrees', 1], ['Radians', 57.29577951308232], ['Gradians', 0.9], ['Turns', 360], ['Arcminutes', 0.016666666666666666]],
    tests: [[1, 57.29577951308232, 1, 57.2958], [180, 1, 57.29577951308232, 3.14159], [100, 0.9, 1, 90]], source: 'SI Brochure: 1 rad = 180° ÷ π',
  }),

  // ——— Timers ———
  {
    id: 'deep-work', name: 'Deep Work', family: 'tools', glyph: 'brain', archetype: 'timer',
    pitch: 'Fifty-minute blocks of deep work with ten-minute breaks between them.',
    keywords: ['deep work', 'focus', 'long session', 'work blocks', 'study', 'concentration'],
    tour: ['Silence notifications and close every tab you do not need.', 'Work the full fifty minutes; note distractions to deal with later.', 'Stand up and move in each ten-minute break.'],
    timer: { steps: [{ name: 'Deep Work', secs: 3000 }, { name: 'Break', secs: 600 }], rounds: 3 },
  },
  {
    id: 'screen-break', name: 'Screen Break', family: 'tools', glyph: 'eye', archetype: 'timer',
    pitch: 'Every twenty minutes, look at something far away for twenty seconds.',
    keywords: ['eye strain', 'screen break', '20 20 20', 'eyes', 'rest', 'desk'],
    tour: ['Start it when you sit down at a screen.', 'At each chime, look at something about 20 feet away.', 'Blink often while you look; then carry on.'],
    timer: { steps: [{ name: 'Screen Time', secs: 1200 }, { name: 'Look Far Away', secs: 20 }], rounds: 12 },
  },
  {
    id: 'power-nap', name: 'Power Nap', family: 'tools', glyph: 'moon', archetype: 'timer',
    pitch: 'A short nap with time to drift off, then a gentle chime to wake.',
    keywords: ['nap', 'power nap', 'rest', 'sleep timer', 'siesta', 'recharge'],
    tour: ['Lie down somewhere quiet and start the timer.', 'Five minutes to settle, then twenty minutes of rest.', 'Get up when it chimes, before deep sleep sets in.'],
    timer: { steps: [{ name: 'Settle', secs: 300 }, { name: 'Nap', secs: 1200 }], rounds: 1 },
  },
  {
    id: 'tidy-sprint', name: 'Tidy Sprint', family: 'tools', glyph: 'home', archetype: 'timer',
    pitch: 'Short bursts of tidying with a breather between, room by room.',
    keywords: ['tidy', 'cleaning', 'declutter', 'chores', 'sprint', 'housework'],
    tour: ['Pick one room or one surface.', 'Tidy fast until the chime, then breathe.', 'Three rounds clears more than you think.'],
    timer: { steps: [{ name: 'Tidy', secs: 600 }, { name: 'Breather', secs: 120 }], rounds: 3 },
  },

  // ——— Tallies ———
  {
    id: 'tally-counter', name: 'Tally Counter', family: 'tools', glyph: 'plus', archetype: 'counter',
    pitch: 'A big, simple clicker for counting anything, with separate tallies.',
    keywords: ['tally', 'counter', 'clicker', 'count', 'head count', 'click'],
    tour: ['Tap a tally to add one.', 'Rename or add tallies to count different things at once.', 'Undo takes back a wrong tap.'],
    counter: { names: ['Count', 'Second Count'], step: 1, reset: 'never' },
  },
  {
    id: 'lap-counter', name: 'Lap Counter', family: 'tools', glyph: 'flag', archetype: 'counter',
    pitch: 'Count laps, lengths or reps without losing your place, fresh each day.',
    keywords: ['laps', 'lengths', 'swimming', 'track', 'count', 'reps'],
    tour: ['Tap once at the end of each lap or length.', 'It starts again at zero each day.', 'Use a second tally for sets or rounds.'],
    counter: { names: ['Laps', 'Sets'], step: 1, reset: 'daily' },
  },
  {
    id: 'door-count', name: 'Door Count', family: 'tools', glyph: 'people', archetype: 'counter',
    pitch: 'Count people in and out at an event so you always know who is inside.',
    keywords: ['people counter', 'event', 'capacity', 'door', 'in and out', 'attendance'],
    tour: ['Tap In for each person entering and Out for each leaving.', 'In minus Out is how many are inside.', 'It starts fresh each day.'],
    counter: { names: ['In', 'Out'], step: 1, reset: 'daily' },
  },
  {
    id: 'stock-take', name: 'Stock Take', family: 'tools', glyph: 'box', from: 'tools.26', archetype: 'counter',
    pitch: 'Count items shelf by shelf with a tally for each, then export the totals.',
    keywords: ['stock take', 'stocktake', 'count', 'inventory', 'shelf', 'tally'],
    tour: ['Rename the tallies to the things you are counting.', 'Tap as you count each one on the shelf.', 'Export the totals as CSV when you are done.'],
    counter: { names: ['Item A', 'Item B', 'Item C', 'Damaged'], step: 1, reset: 'never' },
  },

  // ——— Checklists ———
  {
    id: 'emergency-kit', name: 'Emergency Kit', family: 'tools', glyph: 'shield', archetype: 'checklist',
    pitch: 'A home emergency kit for a power cut or flood, from the UK government’s advice.',
    keywords: ['emergency', 'grab bag', 'power cut', 'flood', 'prepare', 'kit'],
    tour: ['Gather each item into one bag or box.', 'Keep it where everyone at home can reach it.', 'Check the dates and batteries every few months.'],
    checklist: {
      repeat: 'never',
      sections: [
        { name: 'Essentials', items: ['Torch and spare batteries', 'Battery or wind-up radio', 'Bottled water', 'Food that keeps', 'First aid kit', 'Medicines you need'] },
        { name: 'Power And Contact', items: ['Charged power bank and cables', 'List of important numbers on paper', 'Some cash'] },
        { name: 'Papers', items: ['Copies of passports and IDs', 'Insurance details', 'Spare keys'] },
        { name: 'Comfort', items: ['Warm clothes and blankets', 'Toiletries', 'Things for children or pets'] },
      ],
    },
  },
  {
    id: 'digital-clean', name: 'Digital Tidy', family: 'tools', glyph: 'shield', archetype: 'checklist',
    pitch: 'A weekly tidy of your phone and accounts: updates, backups and space.',
    keywords: ['digital', 'phone tidy', 'backup', 'updates', 'storage', 'security'],
    tour: ['Work down the list once a week.', 'It starts fresh each Monday.', 'Two-step sign-in is the single best protection you can add.'],
    checklist: {
      repeat: 'weekly',
      sections: [
        { name: 'Safety', items: ['Install system updates', 'Update apps', 'Check two-step sign-in is on', 'Review new app permissions'] },
        { name: 'Backups', items: ['Photos backed up', 'Phone backup finished'] },
        { name: 'Space', items: ['Delete screenshots you are done with', 'Clear downloads', 'Empty recently deleted', 'Unsubscribe from one mailing list'] },
      ],
    },
  },
  {
    id: 'breakdown-kit', name: 'Car Kit', family: 'tools', glyph: 'car', archetype: 'checklist',
    pitch: 'What to keep in the car for a breakdown or winter journey.',
    keywords: ['car kit', 'breakdown', 'winter driving', 'boot', 'emergency', 'road trip'],
    tour: ['Pack each item into a box in the boot.', 'Add the winter section from October.', 'Check the torch and the tyre pressures monthly.'],
    checklist: {
      repeat: 'never',
      sections: [
        { name: 'All Year', items: ['Warning triangle', 'Hi-vis vest', 'Torch', 'First aid kit', 'Phone charger', 'Tyre inflator or spare', 'Breakdown cover number'] },
        { name: 'Winter', items: ['Ice scraper and de-icer', 'Blanket', 'Warm coat and gloves', 'Shovel', 'Water and snacks', 'Screen wash rated for frost'] },
      ],
    },
  },

  // ——— Reference ———

  // ——— Small logs ———
  {
    id: 'countdowns', name: 'Countdowns', family: 'tools', glyph: 'hourglass', from: 'tools.40', archetype: 'log',
    pitch: 'Holidays, gigs and birthdays on a calendar, with a nudge on the day.',
    keywords: ['countdown', 'days until', 'holiday', 'birthday', 'event', 'anniversary'],
    tour: ['Add the big day with a photo and its date.', 'The calendar shows what is coming and you get a nudge on the day.', 'Tick Yearly for birthdays and anniversaries.'],
    log: {
      fields: [
        fd('event', 'Event', 'text', { required: true }),
        fd('date', 'Date', 'date', { required: true }),
        fd('kind', 'Kind', 'choice', { options: ['Holiday', 'Birthday', 'Gig', 'Anniversary', 'Deadline', 'Other'] }),
        fd('yearly', 'Yearly', 'check'),
        fd('photo', 'Photo', 'photo'),
      ],
      title: 'event', sub: '{kind}', date: 'date', sort: { field: 'date', dir: 'asc' }, group: 'kind',
      stats: [{ label: 'Coming Up', kind: 'count', period: 'all' }, { label: 'This Month', kind: 'count', period: 'month' }],
      views: ['list', 'calendar', 'gallery'],
      remind: { field: 'date', words: 'Today: {event}' },
    },
    sample: [
      { event: 'Lake District weekend', date: '2026-12-11', kind: 'Holiday', yearly: false },
      { event: 'Mum’s birthday', date: '2027-01-19', kind: 'Birthday', yearly: true },
      { event: 'Concert at the arena', date: '2026-11-28', kind: 'Gig', yearly: false },
    ],
  },
  {
    id: 'parcels', name: 'Parcels', family: 'tools', glyph: 'box', archetype: 'log',
    pitch: 'Every parcel you are expecting with its tracking number and delivery day.',
    keywords: ['parcels', 'deliveries', 'tracking', 'orders', 'courier', 'post'],
    tour: ['Add a parcel with the shop, the tracking number and the expected day.', 'Move it to Delivered when it arrives.', 'You get a nudge on the expected day.'],
    log: {
      fields: [
        fd('what', 'What', 'text', { required: true }),
        fd('from', 'From', 'text'),
        fd('tracking', 'Tracking', 'text'),
        fd('carrier', 'Carrier', 'text'),
        fd('due', 'Expected', 'date'),
        fd('status', 'Status', 'choice', { options: ['Ordered', 'Shipped', 'Out Today', 'Delivered', 'Problem'], default: 'Ordered' }),
      ],
      title: 'what', sub: '{from} · {carrier}', date: 'due', sort: { field: 'due', dir: 'asc' }, group: 'status',
      stats: [{ label: 'On The Way', kind: 'count', period: 'all' }, { label: 'This Week', kind: 'count', period: 'week' }],
      views: ['board', 'list', 'calendar'],
      remind: { field: 'due', words: '{what} should arrive today' },
    },
    sample: [
      { what: 'Running shoes', from: 'Sports shop', tracking: 'TRK 4821 0093', carrier: 'Courier', due: '2026-11-16', status: 'Shipped' },
      { what: 'Printer ink', from: 'Office supplier', carrier: 'Post', due: '2026-11-15', status: 'Out Today' },
      { what: 'Birthday present', from: 'Gift shop', tracking: 'GB 2290 1182', carrier: 'Post', due: '2026-11-12', status: 'Delivered' },
    ],
  },
  {
    id: 'key-holders', name: 'Key Holders', family: 'tools', glyph: 'key', archetype: 'log',
    pitch: 'Who holds a spare key to what, and when they got it, all in one list.',
    keywords: ['spare keys', 'key holder', 'keys', 'neighbour', 'access', 'locks'],
    tour: ['Add each spare key and who has it.', 'Note what the key opens and when you handed it over.', 'Tick Returned when it comes back.'],
    log: {
      fields: [
        fd('who', 'Who', 'text', { required: true }),
        fd('opens', 'Opens', 'choice', { options: ['Front Door', 'Back Door', 'Garage', 'Shed', 'Car', 'Office', 'Post Box', 'Other'] }),
        fd('given', 'Given', 'date', { default: 'today' }),
        fd('returned', 'Returned', 'check'),
        fd('note', 'Note', 'text'),
      ],
      title: 'who', sub: '{opens}', date: 'given', sort: { field: 'given', dir: 'desc' }, group: 'opens',
      stats: [{ label: 'Keys Out', kind: 'count', period: 'all' }, { label: 'Holders', kind: 'distinct', field: 'who', period: 'all' }],
      views: ['list', 'board'],
    },
    sample: [
      { who: 'Next-door neighbour', opens: 'Front Door', given: '2025-06-01', returned: false, note: 'For emergencies' },
      { who: 'Dog walker', opens: 'Back Door', given: '2026-09-14', returned: false },
      { who: 'Window cleaner', opens: 'Garage', given: '2026-03-02', returned: true },
    ],
  },
];
