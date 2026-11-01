/**
 * DESIGN A BUILD's price table and cut list (BRIEF-REST-D 1c). Pure, so the node test reads it too.
 *
 * THE PRICE TABLE: typical UK prices for each material, curated by hand in the month PRICE_MONTH names, each a FIRST
 * ESTIMATE and never a quote: a line becomes real and dated only when he gives its shop page (PRICE IT LIVE, the money
 * pack's price watch). Timber is priced by the metre of its section, boards by the sheet, fixings by the box or the
 * kilo, sealant by the tube, a fitted unit or a trade's job each.
 *
 * THE CUT LIST: the lengths a design needs, packed into the lengths timber is sold in (2.4, 3.0, 3.6 and 4.8 m) by first
 * fit, longest first, with a saw cut allowed between pieces; each bar is then the shortest stock length that holds what is
 * cut from it, and the waste is said. A piece longer than the longest bar is joined over a support, and says so.
 */

/** When the table was written (YYYY-MM) and the honest line that goes with every price from it. */
export const PRICE_MONTH = '2026-10';
export const PRICE_LINE = 'Typical prices from October 2026, not quotes';
/** On the sheet, the export and the catalogue: every number a design gives. */
export const ESTIMATE = 'FIRST ESTIMATE · NEVER CERTIFIED';
export const ESTIMATE_WORDS = 'Every number here is a first estimate, never certified.';
/** A line with its first letter small, to go mid-sentence ("typical prices from October 2026, not quotes"). */
export const lowFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The lengths timber is sold in, shortest first (m). */
export const STOCK = [2.4, 3.0, 3.6, 4.8] as const;
/** A saw cut between two pieces (m). */
export const KERF = 0.003;

export interface Price {
  name: string;
  /** What one is: 'm' (a metre of a section), 'sheet', 'box', 'kg', 'tube', 'roll', 'bag', 'tin', 'm²', 'm³', 'tonne', 'each', 'job', 'pack'. */
  unit: string;
  gbp: number;
  /** Shown beside the price ("about 400 a kilo"). */
  note?: string;
}

/** The curated table (October 2026; UK builders' merchants and DIY sheds, typical, VAT in). */
export const PRICES = {
  t47x50: { name: 'Treated timber 47 × 50 mm', unit: 'm', gbp: 1.6 },
  t47x75: { name: 'Treated timber 47 × 75 mm (C16)', unit: 'm', gbp: 2.4 },
  t47x100: { name: 'Treated timber 47 × 100 mm (C24)', unit: 'm', gbp: 3.3 },
  t47x150: { name: 'Treated timber 47 × 150 mm (C24)', unit: 'm', gbp: 5.2 },
  batten: { name: 'Treated batten 25 × 38 mm', unit: 'm', gbp: 0.75 },
  fascia: { name: 'Fascia and barge board 22 × 100 mm', unit: 'm', gbp: 2.1 },
  shiplap: { name: 'Shiplap cladding 12 × 125 mm (110 mm showing)', unit: 'm', gbp: 2.2 },
  pse44: { name: 'Planed pine 44 × 44 mm', unit: 'm', gbp: 2.4 },
  decking: { name: 'Treated deck board 28 × 120 mm', unit: 'm', gbp: 2.6 },
  skirting: { name: 'MDF skirting board 119 mm, primed', unit: 'm', gbp: 3.2 },
  osb11: { name: 'OSB3 board 11 mm, 2440 × 1220', unit: 'sheet', gbp: 19 },
  osb18: { name: 'OSB3 board 18 mm, 2440 × 1220', unit: 'sheet', gbp: 31 },
  ply18: { name: 'Birch plywood 18 mm, 2440 × 1220', unit: 'sheet', gbp: 78 },
  mfc18: { name: 'Melamine-faced board 18 mm, 2440 × 1220', unit: 'sheet', gbp: 42 },
  mdf18: { name: 'MDF 18 mm, 2440 × 1220', unit: 'sheet', gbp: 36 },
  pine18: { name: 'Pine furniture board 18 mm (edge-glued)', unit: 'm²', gbp: 34 },
  oak27: { name: 'Solid oak worktop 27 mm', unit: 'm²', gbp: 140 },
  hardboard: { name: 'Hardboard 3 mm, 2440 × 1220', unit: 'sheet', gbp: 9 },
  plasterboard: { name: 'Plasterboard 12.5 mm, 2400 × 1200', unit: 'sheet', gbp: 10.5 },
  pir50: { name: 'PIR insulation board 50 mm, 2400 × 1200', unit: 'sheet', gbp: 27 },
  pir75: { name: 'PIR insulation board 75 mm, 2400 × 1200', unit: 'sheet', gbp: 36 },
  pir100: { name: 'PIR insulation board 100 mm, 2400 × 1200', unit: 'sheet', gbp: 46 },
  membrane: { name: 'Breather membrane, 50 m² roll', unit: 'roll', gbp: 45 },
  vcl: { name: 'Vapour control layer, 50 m² roll', unit: 'roll', gbp: 30 },
  felt: { name: 'Shed roof felt, 10 m × 1 m roll', unit: 'roll', gbp: 32 },
  epdm: { name: 'EPDM rubber roof, one piece, with its glue', unit: 'm²', gbp: 11 },
  poly4: { name: 'Polycarbonate glazing 4 mm, cut to size', unit: 'm²', gbp: 38 },
  block: { name: 'Concrete block 440 × 215 × 100 mm (7 N)', unit: 'each', gbp: 2.2 },
  mortar: { name: 'Ready mortar mix, 25 kg bag', unit: 'bag', gbp: 6.5 },
  dpc: { name: 'Damp-proof course 100 mm, 30 m roll', unit: 'roll', gbp: 9 },
  lintel: { name: 'Steel box lintel, 2.7 m', unit: 'each', gbp: 105 },
  concrete: { name: 'Ready-mixed concrete, delivered', unit: 'm³', gbp: 145 },
  hardcore: { name: 'MOT type 1 hardcore, loose', unit: 'tonne', gbp: 48 },
  mesh: { name: 'A142 steel mesh sheet, 4.8 × 2.4 m', unit: 'sheet', gbp: 45 },
  dpm: { name: 'Damp-proof membrane, 4 × 25 m', unit: 'roll', gbp: 60 },
  slab600: { name: 'Paving slab 600 × 600 mm, grey', unit: 'each', gbp: 9 },
  sand: { name: 'Sharp sand, 25 kg bag', unit: 'bag', gbp: 4.5 },
  groundscrew: { name: 'Ground screw 68 × 800 mm, fitted', unit: 'each', gbp: 42 },
  garagedoor: { name: 'Up-and-over garage door 2.13 × 1.98 m, steel, with frame', unit: 'each', gbp: 520 },
  doubledoor: { name: 'Double-glazed double doors 1.5 × 2.1 m, with frame', unit: 'each', gbp: 1100 },
  window: { name: 'Double-glazed window 1.2 × 1.0 m, with frame', unit: 'each', gbp: 320 },
  electrician: { name: 'A registered electrician: a new circuit, a consumer unit, four sockets and two lights', unit: 'job', gbp: 1200 },
  thinge: { name: 'T-hinge 300 mm, galvanised', unit: 'each', gbp: 4 },
  hasp: { name: 'Hasp and staple, galvanised', unit: 'each', gbp: 5 },
  screws70: { name: 'Wood screws 5.0 × 70 mm, box of 200', unit: 'box', gbp: 11 },
  screws50: { name: 'Wood screws 4.0 × 50 mm, box of 200', unit: 'box', gbp: 7.5 },
  screws40: { name: 'Wood screws 4.0 × 40 mm, box of 200', unit: 'box', gbp: 6.5 },
  bolts: { name: 'Coach bolts M8 × 100 mm with nuts and washers, pack of 10', unit: 'pack', gbp: 8 },
  nails50: { name: 'Galvanised round nails 50 mm', unit: 'kg', gbp: 6, note: 'about 400 a kilo' },
  clouts: { name: 'Galvanised clout nails 20 mm', unit: 'kg', gbp: 7, note: 'about 1,000 a kilo' },
  sealant: { name: 'Exterior frame sealant, 310 ml tube', unit: 'tube', gbp: 6.5 },
  adhesive: { name: 'Grab adhesive, 310 ml tube', unit: 'tube', gbp: 5.5 },
  preserver: { name: 'Exterior wood treatment, 5 litre tin', unit: 'tin', gbp: 32 },
  emulsion: { name: 'Emulsion paint, 5 litre tin', unit: 'tin', gbp: 28 },
  varnish: { name: 'Clear satin varnish, 750 ml tin', unit: 'tin', gbp: 14 },
  carpet: { name: 'Carpet and underlay, fitted', unit: 'm²', gbp: 32 },
  laminate: { name: 'Laminate flooring 8 mm with underlay', unit: 'm²', gbp: 22 },
  radiator: { name: 'Double-panel radiator (type 22), 600 mm high, with valves', unit: 'each', gbp: 0 },
  ufhmat: { name: 'Electric underfloor heating mat, 150 W a m², with thermostat', unit: 'm²', gbp: 38 },
  rail: { name: 'Wardrobe hanging rail with ends, 1 m', unit: 'each', gbp: 6 },
  slider: { name: 'Sliding wardrobe door 0.9 m wide, with its track share', unit: 'each', gbp: 95 },
  bracket: { name: 'Anti-tip wall bracket with fixings', unit: 'each', gbp: 3 },
} satisfies Record<string, Price>;
export type PriceId = keyof typeof PRICES;

/** A radiator of a length (m): a type 22 at 600 mm high, priced from its length (the table's line, a first estimate). */
export const radiatorPrice = (len: number) => Math.round(45 + 85 * len);

/** £ to the penny as he reads it: "£1,234.50"; whole pounds when there are no pence. */
export function pounds(n: number): string {
  const v = Math.round(n * 100) / 100;
  return `£${v.toLocaleString('en-GB', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------- the cut list

/** A length a design needs (m), how many, and what it is for. */
export interface Cut {
  len: number;
  n: number;
  label?: string;
}
/** One bar bought: its stock length and the pieces cut from it. */
export interface Bar {
  len: number;
  pieces: number[];
}
export interface CutPlan {
  bars: Bar[];
  /** The bars by stock length, longest first: "3 × 2.4 m". */
  stock: { len: number; n: number }[];
  bought: number;
  used: number;
  waste: number;
  wastePct: number;
  /** Pieces longer than the longest bar, joined over a support (their count). */
  joined: number;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Pack the cuts into stock lengths: first fit, longest first; each bar then the shortest stock length that holds it. */
export function cutList(cuts: Cut[], stock: readonly number[] = STOCK, kerf = KERF): CutPlan {
  const longest = stock[stock.length - 1]!;
  const pieces: number[] = [];
  let joined = 0;
  for (const c of cuts) {
    for (let i = 0; i < c.n; i++) {
      let left = r3(c.len);
      if (left <= 0) continue;
      // longer than any bar: whole bars, the rest a piece of its own (joined over a support)
      if (left > longest) joined++;
      while (left > longest) {
        pieces.push(longest);
        left = r3(left - longest);
      }
      if (left > 0.005) pieces.push(left);
    }
  }
  pieces.sort((a, b) => b - a);
  const bars: { cap: number; used: number; pieces: number[] }[] = [];
  for (const p of pieces) {
    const bar = bars.find((b) => b.used + (b.pieces.length ? kerf : 0) + p <= b.cap + 1e-9);
    if (bar) {
      bar.used = r3(bar.used + (bar.pieces.length ? kerf : 0) + p);
      bar.pieces.push(p);
    } else bars.push({ cap: longest, used: p, pieces: [p] });
  }
  const out: Bar[] = bars.map((b) => ({ len: stock.find((s) => s + 1e-9 >= b.used) ?? longest, pieces: b.pieces }));
  const bought = r3(out.reduce((s, b) => s + b.len, 0));
  const used = r3(pieces.reduce((s, p) => s + p, 0));
  const counts = new Map<number, number>();
  for (const b of out) counts.set(b.len, (counts.get(b.len) ?? 0) + 1);
  const waste = r3(bought - used);
  return {
    bars: out,
    stock: [...counts].map(([len, n]) => ({ len, n })).sort((a, b) => b.len - a.len),
    bought,
    used,
    waste,
    wastePct: bought ? Math.round((waste / bought) * 1000) / 10 : 0,
    joined,
  };
}

/** "3 × 2.4 m + 1 × 3.6 m · 0.90 m waste (9%)" */
export function cutWords(c: CutPlan): string {
  if (!c.bars.length) return '';
  const lens = c.stock.map((s) => `${s.n} × ${s.len.toFixed(1)} m`).join(' + ');
  return `${lens} · ${c.waste.toFixed(2)} m waste (${Math.round(c.wastePct)}%)${c.joined ? ` · ${c.joined} joined over a support` : ''}`;
}

/** Sheets of a board for an area (m²) with a share for cutting (0.1 = 10%): whole sheets. */
export const sheetsFor = (area: number, sheet = 2.44 * 1.22, extra = 0.1) => Math.max(1, Math.ceil((area * (1 + extra)) / sheet - 1e-9));
/** Boxes of 200 for a count of screws. */
export const boxesFor = (n: number, per = 200) => Math.max(1, Math.ceil(n / per));
/** Kilos of nails (to the half kilo) for a count, at so many a kilo. */
export const kilosFor = (n: number, perKg: number) => Math.max(0.5, Math.ceil((n / perKg) * 2) / 2);
