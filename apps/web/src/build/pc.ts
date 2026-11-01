/**
 * A PC BUILD (BRIEF-REST-D 1): from a budget and a use (gaming, editing, school) to a parts list by type — CPU, board,
 * memory, storage, graphics, power, case, cooling — from a small curated table of real parts with typical prices from
 * October 2026 (prices move weekly: the honest line says so, and PRICE IT LIVE makes a line real). The compatibility check
 * is code: the CPU's socket against the board's, the memory type, the board's size against the case, the power the parts
 * draw against the supply (the graphics card maker's own figure, and 30% of headroom over the parts' draw), the card's
 * length against the case, the cooler's height and socket. A change that cannot fit (a board of the wrong socket) is
 * refused with the reason; a CPU of another socket brings a board and memory that fit with it, and says so. Pure.
 */
import type { Box, Design, Item2D, Line, Params, PcSlot, View2D } from './kits';

export interface Part {
  id: string;
  slot: PcSlot;
  name: string;
  gbp: number;
  /** CPU and board: the socket; memory and board: 'DDR4' or 'DDR5'; board and case: 'ATX' or 'mATX'. */
  socket?: string;
  mem?: 'DDR4' | 'DDR5';
  form?: 'ATX' | 'mATX';
  /** CPU: its power (W); graphics: its board power (W) and the maker's suggested supply (W); supply: its watts. */
  watts?: number;
  psuRec?: number;
  /** Graphics: a typical card's length (mm); case: the longest card and tallest cooler it takes (mm); cooler: its height. */
  len?: number;
  gpuMax?: number;
  coolerMax?: number;
  height?: number;
  sockets?: string[];
  /** CPU: a cooler in the box; built-in graphics. */
  boxCooler?: boolean;
  igpu?: boolean;
  note?: string;
}

/** The table (typical UK prices, October 2026; each a first estimate). */
export const PARTS: Part[] = [
  // processors
  { id: 'r5-5600', slot: 'cpu', name: 'AMD Ryzen 5 5600', gbp: 85, socket: 'AM4', mem: 'DDR4', watts: 65, boxCooler: true, note: '6 cores' },
  { id: 'r5-7600', slot: 'cpu', name: 'AMD Ryzen 5 7600', gbp: 150, socket: 'AM5', mem: 'DDR5', watts: 65, boxCooler: true, igpu: true, note: '6 cores' },
  { id: 'r5-8600g', slot: 'cpu', name: 'AMD Ryzen 5 8600G', gbp: 160, socket: 'AM5', mem: 'DDR5', watts: 65, boxCooler: true, igpu: true, note: '6 cores, strong built-in graphics' },
  { id: 'r7-7800x3d', slot: 'cpu', name: 'AMD Ryzen 7 7800X3D', gbp: 300, socket: 'AM5', mem: 'DDR5', watts: 120, note: '8 cores, the gaming favourite' },
  { id: 'r9-9900x', slot: 'cpu', name: 'AMD Ryzen 9 9900X', gbp: 330, socket: 'AM5', mem: 'DDR5', watts: 120, igpu: true, note: '12 cores, for editing' },
  { id: 'i5-14400f', slot: 'cpu', name: 'Intel Core i5-14400F', gbp: 125, socket: 'LGA1700', watts: 65, boxCooler: true, note: '10 cores, no built-in graphics' },
  // boards
  { id: 'b550', slot: 'board', name: 'MSI B550-A PRO', gbp: 95, socket: 'AM4', mem: 'DDR4', form: 'ATX' },
  { id: 'a620', slot: 'board', name: 'ASRock A620M Pro RS', gbp: 80, socket: 'AM5', mem: 'DDR5', form: 'mATX' },
  { id: 'b650', slot: 'board', name: 'MSI B650 GAMING PLUS WIFI', gbp: 140, socket: 'AM5', mem: 'DDR5', form: 'ATX' },
  { id: 'b760', slot: 'board', name: 'MSI PRO B760M-P DDR4', gbp: 95, socket: 'LGA1700', mem: 'DDR4', form: 'mATX' },
  // memory
  { id: 'ddr4-16', slot: 'ram', name: 'Corsair Vengeance LPX 16 GB (2 × 8) DDR4-3200', gbp: 35, mem: 'DDR4' },
  { id: 'ddr4-32', slot: 'ram', name: 'Corsair Vengeance LPX 32 GB (2 × 16) DDR4-3200', gbp: 60, mem: 'DDR4' },
  { id: 'ddr5-16', slot: 'ram', name: 'Kingston FURY Beast 16 GB (2 × 8) DDR5-5600', gbp: 55, mem: 'DDR5' },
  { id: 'ddr5-32', slot: 'ram', name: 'Corsair Vengeance 32 GB (2 × 16) DDR5-6000', gbp: 95, mem: 'DDR5' },
  { id: 'ddr5-64', slot: 'ram', name: 'Corsair Vengeance 64 GB (2 × 32) DDR5-6000', gbp: 180, mem: 'DDR5' },
  // storage
  { id: 'ssd1', slot: 'ssd', name: 'Crucial P3 Plus 1 TB NVMe SSD', gbp: 55 },
  { id: 'ssd2', slot: 'ssd', name: 'WD Black SN770 2 TB NVMe SSD', gbp: 110 },
  // graphics (board power, the maker’s suggested supply, a typical card’s length)
  { id: 'igpu', slot: 'gpu', name: 'None: the processor’s built-in graphics', gbp: 0, watts: 0, psuRec: 0, len: 0 },
  { id: 'arc-b580', slot: 'gpu', name: 'Intel Arc B580 12 GB', gbp: 250, watts: 190, psuRec: 600, len: 272 },
  { id: 'rtx-5060', slot: 'gpu', name: 'NVIDIA GeForce RTX 5060 8 GB', gbp: 270, watts: 145, psuRec: 550, len: 240 },
  { id: 'rtx-5060ti', slot: 'gpu', name: 'NVIDIA GeForce RTX 5060 Ti 16 GB', gbp: 400, watts: 180, psuRec: 600, len: 250 },
  { id: 'rtx-5070', slot: 'gpu', name: 'NVIDIA GeForce RTX 5070 12 GB', gbp: 520, watts: 250, psuRec: 650, len: 285 },
  { id: 'rx-9070xt', slot: 'gpu', name: 'AMD Radeon RX 9070 XT 16 GB', gbp: 650, watts: 304, psuRec: 750, len: 320 },
  { id: 'rtx-5070ti', slot: 'gpu', name: 'NVIDIA GeForce RTX 5070 Ti 16 GB', gbp: 750, watts: 300, psuRec: 750, len: 330 },
  // power
  { id: 'psu550', slot: 'psu', name: 'Corsair CX550 (550 W, 80 Plus Bronze)', gbp: 55, watts: 550 },
  { id: 'psu650', slot: 'psu', name: 'MSI MAG A650BN (650 W, 80 Plus Bronze)', gbp: 60, watts: 650 },
  { id: 'psu750', slot: 'psu', name: 'Corsair RM750e (750 W, 80 Plus Gold)', gbp: 95, watts: 750 },
  { id: 'psu850', slot: 'psu', name: 'Corsair RM850e (850 W, 80 Plus Gold)', gbp: 115, watts: 850 },
  // cases
  { id: 'q300l', slot: 'case', name: 'Cooler Master MasterBox Q300L', gbp: 45, form: 'mATX', gpuMax: 360, coolerMax: 157 },
  { id: 'popair', slot: 'case', name: 'Fractal Design Pop Air', gbp: 75, form: 'ATX', gpuMax: 405, coolerMax: 170 },
  { id: '4000d', slot: 'case', name: 'Corsair 4000D Airflow', gbp: 90, form: 'ATX', gpuMax: 360, coolerMax: 170 },
  // cooling
  { id: 'stock', slot: 'cooler', name: 'The cooler in the processor’s box', gbp: 0, height: 60, sockets: ['AM4', 'AM5', 'LGA1700'] },
  { id: 'ak400', slot: 'cooler', name: 'DeepCool AK400', gbp: 30, height: 155, sockets: ['AM4', 'AM5', 'LGA1700'] },
  { id: 'pa120se', slot: 'cooler', name: 'Thermalright Peerless Assassin 120 SE', gbp: 35, height: 155, sockets: ['AM4', 'AM5', 'LGA1700'] },
];
export const SLOTS: { id: PcSlot; name: string }[] = [
  { id: 'cpu', name: 'Processor (CPU)' }, { id: 'board', name: 'Motherboard' }, { id: 'ram', name: 'Memory (RAM)' }, { id: 'ssd', name: 'Storage' },
  { id: 'gpu', name: 'Graphics card' }, { id: 'psu', name: 'Power supply' }, { id: 'case', name: 'Case' }, { id: 'cooler', name: 'CPU cooler' },
];
export const PC_LINE = 'Prices move weekly: these are typical prices from October 2026, not quotes.';
export const partById = (id: string | undefined) => PARTS.find((p) => p.id === id);

export type PcBuild = Record<PcSlot, string>;
/** The builds I start from, cheapest first, each one that passes the check. */
export const PRESETS: { use: Params['use']; parts: PcBuild }[] = [
  { use: 'school', parts: { cpu: 'r5-8600g', board: 'a620', ram: 'ddr5-16', ssd: 'ssd1', gpu: 'igpu', psu: 'psu550', case: 'q300l', cooler: 'stock' } },
  { use: 'gaming', parts: { cpu: 'r5-5600', board: 'b550', ram: 'ddr4-16', ssd: 'ssd1', gpu: 'arc-b580', psu: 'psu650', case: 'popair', cooler: 'stock' } },
  { use: 'gaming', parts: { cpu: 'r5-7600', board: 'a620', ram: 'ddr5-32', ssd: 'ssd1', gpu: 'rtx-5060', psu: 'psu650', case: 'popair', cooler: 'stock' } },
  { use: 'gaming', parts: { cpu: 'r5-7600', board: 'b650', ram: 'ddr5-32', ssd: 'ssd1', gpu: 'rtx-5060ti', psu: 'psu650', case: 'popair', cooler: 'stock' } },
  { use: 'gaming', parts: { cpu: 'r5-7600', board: 'b650', ram: 'ddr5-32', ssd: 'ssd2', gpu: 'rtx-5070', psu: 'psu750', case: '4000d', cooler: 'ak400' } },
  { use: 'gaming', parts: { cpu: 'r7-7800x3d', board: 'b650', ram: 'ddr5-32', ssd: 'ssd2', gpu: 'rx-9070xt', psu: 'psu850', case: 'popair', cooler: 'pa120se' } },
  { use: 'editing', parts: { cpu: 'r5-7600', board: 'b650', ram: 'ddr5-32', ssd: 'ssd2', gpu: 'rtx-5060', psu: 'psu650', case: 'popair', cooler: 'ak400' } },
  { use: 'editing', parts: { cpu: 'r9-9900x', board: 'b650', ram: 'ddr5-64', ssd: 'ssd2', gpu: 'rtx-5060ti', psu: 'psu750', case: '4000d', cooler: 'pa120se' } },
];
export const priceOf = (b: Partial<PcBuild>) => Object.values(b).reduce((s, id) => s + (partById(id)?.gbp ?? 0), 0);

/** The best build for the budget and the use: the dearest that fits it, else the cheapest (said to be over). */
export function pickPc(budget: number, use: Params['use']): { parts: PcBuild; over: number } {
  const list = PRESETS.filter((x) => x.use === use).sort((a, b) => priceOf(a.parts) - priceOf(b.parts));
  const fits = list.filter((x) => priceOf(x.parts) <= budget);
  const pick = fits[fits.length - 1] ?? list[0]!;
  return { parts: { ...pick.parts }, over: Math.max(0, priceOf(pick.parts) - budget) };
}

/** What the parts draw at full load (W): the CPU, the card, and 75 W for the board, memory, drives and fans. */
export const drawOf = (b: Partial<PcBuild>) => (partById(b.cpu)?.watts ?? 0) + (partById(b.gpu)?.watts ?? 0) + 75;
/** The supply it needs: the card maker's figure, or the draw with 30% headroom, whichever is more (to the 50 W). */
export const supplyNeeded = (b: Partial<PcBuild>) => Math.max(partById(b.gpu)?.psuRec ?? 0, Math.ceil((drawOf(b) * 1.3) / 50) * 50);

/** The check, line by line: ok or not, in words. */
export function checkPc(b: Partial<PcBuild>): { ok: boolean; text: string }[] {
  const cpu = partById(b.cpu);
  const board = partById(b.board);
  const ram = partById(b.ram);
  const gpu = partById(b.gpu);
  const psu = partById(b.psu);
  const box = partById(b.case);
  const cooler = partById(b.cooler);
  const out: { ok: boolean; text: string }[] = [];
  if (cpu && board) out.push(cpu.socket === board.socket ? { ok: true, text: `The ${cpu.name} (${cpu.socket}) fits the ${board.name}.` } : { ok: false, text: `The ${cpu.name} is ${cpu.socket}; the ${board.name} is ${board.socket}: it will not fit.` });
  if (board && ram) out.push(board.mem === ram.mem ? { ok: true, text: `${ram.mem} memory, as the board takes.` } : { ok: false, text: `The board takes ${board.mem}; that memory is ${ram.mem}: it will not go in.` });
  if (board && box) out.push(box.form === 'ATX' || board.form === 'mATX' ? { ok: true, text: `The ${board.form === 'mATX' ? 'micro-ATX' : 'ATX'} board fits the ${box.name}.` } : { ok: false, text: `The board is full ATX; the ${box.name} only takes micro-ATX.` });
  if (gpu && psu) {
    const need = supplyNeeded(b);
    const w = psu.watts ?? 0;
    out.push(w >= need ? { ok: true, text: `Power: about ${drawOf(b)} W at full load; ${w} W is enough (${need} W needed, with headroom).` } : { ok: false, text: `Power: short by ${need - w} W. The parts draw about ${drawOf(b)} W and ${gpu.watts ? `the card’s maker asks for ${gpu.psuRec} W` : 'that needs headroom'}: a ${need} W supply at least.` });
  }
  if (gpu && box && gpu.len) out.push(gpu.len <= (box.gpuMax ?? 0) ? { ok: true, text: `The card (about ${gpu.len} mm) fits the case (up to ${box.gpuMax} mm).` } : { ok: false, text: `The card is about ${gpu.len} mm; the case takes ${box.gpuMax} mm at most.` });
  if (cooler && box) {
    const sock = cooler.sockets?.includes(cpu?.socket ?? '') ?? false;
    out.push(cooler.id === 'stock' && !cpu?.boxCooler ? { ok: false, text: `The ${cpu?.name ?? 'processor'} comes with no cooler: pick one.` } : !sock ? { ok: false, text: `That cooler does not fit ${cpu?.socket}.` } : (cooler.height ?? 0) <= (box.coolerMax ?? 0) ? { ok: true, text: `The cooler (${cooler.height} mm) fits under the case’s ${box.coolerMax} mm.` } : { ok: false, text: `The cooler is ${cooler.height} mm tall; the case takes ${box.coolerMax} mm.` });
  }
  if (gpu?.id === 'igpu') out.push(cpu?.igpu ? { ok: true, text: 'No graphics card: the processor’s own graphics drive the screen.' } : { ok: false, text: `The ${cpu?.name ?? 'processor'} has no graphics of its own: it needs a card.` });
  return out;
}

/**
 * A part picked by hand: the build with it, or the reason it was refused. A board of another socket is refused; a CPU of
 * another socket brings the board and memory that fit it (said in `said`).
 */
export function pickPart(b: PcBuild, slot: PcSlot, id: string): { build: PcBuild; said?: string } | { refused: string } {
  const part = partById(id);
  if (!part || part.slot !== slot) return { refused: 'That is not a part I have in the table.' };
  const next: PcBuild = { ...b, [slot]: id };
  const cpu = partById(next.cpu)!;
  if (slot === 'board' && part.socket !== cpu.socket) return { refused: `The ${part.name} is ${part.socket}; the ${cpu.name} needs ${cpu.socket}. Pick the processor first and I’ll pick a board that fits it.` };
  if (slot === 'ram' && part.mem !== partById(next.board)?.mem) return { refused: `The board takes ${partById(next.board)?.mem}; that memory is ${part.mem}.` };
  if (slot === 'cpu' && partById(b.board)?.socket !== part.socket) {
    const board = PARTS.filter((x) => x.slot === 'board' && x.socket === part.socket).sort((a, c) => a.gbp - c.gbp)[0];
    if (!board) return { refused: `I have no ${part.socket} board in the table.` };
    next.board = board.id;
    const size = partById(b.ram)?.name.match(/(\d+) GB/)?.[1] ?? '16';
    const ram = PARTS.find((x) => x.slot === 'ram' && x.mem === board.mem && x.name.includes(`${size} GB`)) ?? PARTS.find((x) => x.slot === 'ram' && x.mem === board.mem)!;
    next.ram = ram.id;
    if (next.cooler === 'stock' && !part.boxCooler) next.cooler = 'ak400';
    return { build: next, said: `A ${part.socket} processor needs a ${part.socket} board: I swapped in the ${board.name} and ${ram.mem} memory.` };
  }
  return { build: next };
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** The PC as a design: the bill by type, the check, a side drawing of the case, the parts in 3-D, the build in steps. */
export function pcDesign(p: Params): Design {
  const picked = p.pc && SLOTS.every((s) => partById(p.pc?.[s.id])) ? (p.pc as PcBuild) : pickPc(p.budget, p.use).parts;
  const over = Math.max(0, priceOf(picked) - p.budget);
  const lines: Line[] = SLOTS.map((s, i) => {
    const part = partById(picked[s.id])!;
    return { id: `pc-${s.id}-${i}`, group: s.id, name: part.name, size: s.name, material: part.note ?? '', n: 1, unit: 'each', qty: 1, per: 'each', rate: part.gbp, total: part.gbp, ...(s.id === 'cooler' && part.id === 'stock' ? { note: 'in the processor’s box: nothing to buy' } : {}) };
  }).filter((l) => l.total > 0 || l.group === 'cooler' || l.group === 'gpu');
  const compat = checkPc(picked);
  const box = partById(picked.case)!;
  const gpu = partById(picked.gpu)!;
  const cooler = partById(picked.cooler)!;
  const mini = box.form === 'mATX';
  const W = 0.23;
  const H = mini ? 0.41 : 0.47;
  const D = mini ? 0.39 : 0.45;
  const boxes: Box[] = [
    { id: 'case-floor', group: 'case', label: 'Case', x: 0, y: 0.01, z: 0, w: W, h: 0.02, d: D, color: 0x1d2026, out: [0, -0.15, 0] },
    { id: 'case-back', group: 'case', label: 'Case', x: 0, y: H / 2, z: -D / 2 + 0.01, w: W, h: H, d: 0.02, color: 0x1d2026, out: [0, 0, -0.2] },
    { id: 'case-side', group: 'case', label: 'Case', x: -W / 2 + 0.01, y: H / 2, z: 0, w: 0.02, h: H, d: D, color: 0x2a2e36, out: [-0.25, 0, 0] },
    { id: 'case-front', group: 'case', label: 'Case', x: 0, y: H / 2, z: D / 2 - 0.01, w: W, h: H, d: 0.02, color: 0x22262d, out: [0, 0, 0.25] },
    { id: 'case-top', group: 'lid', label: 'Case top', x: 0, y: H - 0.01, z: 0, w: W, h: 0.02, d: D, color: 0x1d2026, out: [0, 0.3, 0] },
    { id: 'case-glass', group: 'lid', label: 'Glass side panel', x: W / 2 - 0.005, y: H / 2, z: 0, w: 0.006, h: H, d: D, color: 0x9fd3ff, out: [0.35, 0, 0], glass: true },
    { id: 'board', group: 'board', label: 'Motherboard', x: -W / 2 + 0.03, y: H - 0.03 - (mini ? 0.122 : 0.15), z: -0.02, w: 0.01, h: mini ? 0.244 : 0.305, d: mini ? 0.244 : 0.244, color: 0x2f5d3a, out: [-0.12, 0, 0] },
    { id: 'cpu', group: 'cpu', label: 'Processor', x: -W / 2 + 0.04, y: H - 0.1, z: -0.03, w: 0.006, h: 0.04, d: 0.04, color: 0xb9bcc2, out: [0, 0, 0] },
    { id: 'cooler', group: 'cooler', label: 'CPU cooler', x: -W / 2 + 0.035 + Math.min(0.15, (cooler.height ?? 60) / 1000) / 2, y: H - 0.1, z: -0.03, w: Math.min(0.15, (cooler.height ?? 60) / 1000), h: 0.12, d: cooler.id === 'stock' ? 0.09 : 0.13, color: cooler.id === 'stock' ? 0x30333a : 0x9aa3ad, out: [0.15, 0.1, 0] },
    { id: 'ram', group: 'ram', label: 'Memory', x: -W / 2 + 0.05, y: H - 0.1, z: 0.05, w: 0.035, h: 0.13, d: 0.02, color: 0x3a3f47, out: [0.1, 0, 0.05] },
    { id: 'ssd', group: 'ssd', label: 'SSD', x: -W / 2 + 0.042, y: H - 0.22, z: -0.02, w: 0.004, h: 0.022, d: 0.08, color: 0x24262b, out: [0.08, -0.05, 0] },
    { id: 'psu', group: 'psu', label: 'Power supply', x: 0, y: 0.06, z: -D / 2 + 0.1, w: 0.15, h: 0.086, d: 0.16, color: 0x2b2b2b, out: [0, -0.1, -0.2] },
  ];
  if (gpu.len) boxes.push({ id: 'gpu', group: 'gpu', label: 'Graphics card', x: -W / 2 + 0.06, y: H - 0.27, z: -D / 2 + 0.02 + gpu.len / 2000, w: 0.05, h: 0.12, d: gpu.len / 1000, color: 0x4c5560, out: [0.2, 0, 0] });
  // the side drawing: the case, where the card, the cooler and the supply go, against its limits
  const pad = 0.12;
  const items: Item2D[] = [
    { t: 'rect', x: pad, y: pad, w: D, h: H, k: 'wall' },
    { t: 'rect', x: pad + 0.02, y: pad + H - 0.33, w: 0.244, h: 0.305, k: 'part', label: 'board' },
    { t: 'rect', x: pad + 0.02, y: pad + 0.02, w: 0.16, h: 0.086, k: 'part', label: 'power' },
    ...(gpu.len ? [{ t: 'rect' as const, x: pad + 0.02, y: pad + H - 0.33, w: gpu.len / 1000, h: 0.03, k: 'board' as const, label: 'card' }, { t: 'dim' as const, a: [pad + 0.02, pad + H - 0.33] as [number, number], b: [pad + 0.02 + gpu.len / 1000, pad + H - 0.33] as [number, number], text: `card ${gpu.len} mm (case takes ${box.gpuMax})`, off: -0.05 }] : []),
    { t: 'dim', a: [pad, pad + H], b: [pad + D, pad + H], text: `${Math.round(D * 1000)} mm`, off: 0.05 },
    { t: 'dim', a: [pad + D, pad], b: [pad + D, pad + H], text: `${Math.round(H * 1000)} mm`, off: -0.05 },
    { t: 'text', x: pad + D / 2, y: pad + H + 0.1, text: `cooler ${cooler.height} mm (case takes ${box.coolerMax})` },
  ];
  const view: View2D = { title: 'SIDE (THE CASE OPEN)', w: D + 2 * pad, h: H + 2 * pad + 0.06, items, words: `The case, from the open side: ${Math.round(H * 1000)} mm tall and ${Math.round(D * 1000)} mm deep; the board high at the back, ${gpu.len ? `the card under it, about ${gpu.len} mm long against the ${box.gpuMax} mm the case takes` : 'no graphics card'}; the cooler ${cooler.height} mm tall against ${box.coolerMax} mm; the power supply at the bottom.` };
  const total = r2(lines.reduce((s, l) => s + l.total, 0));
  return {
    params: { ...p, pc: picked }, kind: 'pc', title: `${p.use === 'school' ? 'School' : p.use === 'editing' ? 'Editing' : 'Gaming'} PC, about £${Math.round(total)}`, concept: false,
    summary: `${partById(picked.cpu)!.name}, ${gpu.len ? gpu.name : 'built-in graphics'}, ${partById(picked.ram)!.name.match(/\d+ GB/)?.[0] ?? ''} memory, ${partById(picked.ssd)!.name.match(/\d+ TB/)?.[0] ?? ''} SSD${over ? `: £${Math.round(over)} over your £${p.budget}, the cheapest honest build I can name` : `, under your £${p.budget}`}`,
    groups: SLOTS.map((s) => ({ id: s.id, name: s.name })), lines, boxes, views: [view], compat,
    steps: [
      'On the board’s box, on a table: the processor into its socket (match the triangle, no force), the lever down.',
      'The memory in the two slots the board’s manual names (usually the 2nd and 4th), pressed till both clips click.',
      'The SSD in the top M.2 slot, under its heatsink, its one screw.',
      `The cooler: ${cooler.id === 'stock' ? 'the box cooler has its paste on already' : 'a pea of paste in the middle of the processor, then the cooler, screwed down evenly'}; its fan to CPU_FAN.`,
      'The board into the case on its standoffs (the rear plate first), nine screws; the power supply in, fan down.',
      `${gpu.len ? 'The card in the top long slot till it clicks, screwed to the case, its power cable from the supply.' : 'No card: the screen goes into the board’s own outputs.'}`,
      'The cables: the 24-pin and the 8-pin CPU power, the front panel’s pins (the manual’s picture), the fans.',
      'Power on: into the BIOS, check the memory runs at its rated speed (turn on EXPO or XMP), then install the system from a USB stick.',
    ],
    tools: ['A Phillips No. 2 screwdriver (a magnetic tip helps)', 'Cable ties', 'A USB stick of 16 GB for the system', 'A torch'],
    hours: 3, safety: ['Unplugged while you build; touch the case’s bare metal first to lose any static.', 'Never open the power supply: it holds a charge even when unplugged.'],
    law: [], notes: [...p.notes, PC_LINE, 'Windows 11 Home costs about £100 from Microsoft (not in the total); Linux is free.'], total,
  };
}
