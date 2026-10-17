/**
 * VEHICLE CHECK (palette command vehicle_check, and the Lens READ chip): type or paste one UK
 * plate → CHECK → that vehicle's public record from the brain (POST /api/vehicle: DVSA's MOT
 * history, and DVLA's tax details when that key is set) as a card — make, model, colour, fuel,
 * first used, the MOT verdict, a mileage sparkline, every test with its advisories and defects.
 *
 * Looked up once, not saved: nothing leaves the phone until CHECK is pressed, the answer lives in
 * this sheet only (no localStorage, no IndexedDB, no chat entry, no library), and it is gone when
 * the sheet closes. Never anything about who owns the car: the services don't have it.
 */
import { formatPlate, isPlate, normalisePlate, OFFICIAL_CHECKS, type MotTest, type VehicleAnswer, type VehicleReport } from '../../../../packages/shared/src/plates';
import { headers } from '../api/brain';
import { clear, h } from '../core/dom';
import { button, modal, spark } from './components';

/** What the sheet shows, readable by a test at window.__ghosty.vehicle (cleared when it closes). */
export const vehicleState = { open: false, status: '' as '' | 'checking' | 'shown' | 'error', plate: '', verdict: '' };

let sheet: { close(): void } | null = null;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ukDate = (iso: string | null | undefined) => {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};
const miles = (n: number, unit: 'mi' | 'km' | null) => `${n.toLocaleString('en-GB')} ${unit === 'km' ? 'km' : 'mi'}`;

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.vehicle = vehicleState;
}

/** One MOT test: a line (date, PASS/FAIL, mileage, how many notes) that opens to its defects and advisories. */
function testRow(t: MotTest, open: boolean): HTMLElement {
  const adv = t.defects.filter((d) => d.type === 'ADVISORY').length;
  const other = t.defects.length - adv;
  const notes = [adv ? `${adv} advisor${adv === 1 ? 'y' : 'ies'}` : '', other ? `${other} defect${other === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'no notes';
  const list = h('ul.vcdefects', ...t.defects.map((d) => h(`li${d.dangerous || d.type === 'DANGEROUS' ? '.bad' : d.type === 'ADVISORY' ? '' : '.mid'}` as 'li', h('b', d.type.toLowerCase()), ' ', d.text)));
  list.hidden = !open || !t.defects.length;
  const row = h(
    `div.vctest${t.result === 'FAILED' ? '.fail' : ''}` as 'div',
    { role: 'button', tabIndex: 0, 'aria-expanded': String(!list.hidden) },
    h('span.vcdate', ukDate(t.date)),
    h(`span.chip${t.result === 'PASSED' ? '.good' : '.bad'}` as 'span', t.result === 'PASSED' ? 'PASS' : 'FAIL'),
    h('span.vcmiles', t.odometer != null ? miles(t.odometer, t.unit) : 'mileage not read'),
    h('span.vcnotes', notes),
  );
  const toggle = () => {
    if (!t.defects.length) return;
    list.hidden = !list.hidden;
    row.setAttribute('aria-expanded', String(!list.hidden));
  };
  row.addEventListener('click', toggle);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
  return h('div.vctestwrap', row, list);
}

function linksRow(links: readonly { title: string; url: string }[]): HTMLElement {
  return h('div.vclinks', h('small.lab', 'FREE OFFICIAL CHECKS'), ...links.map((l) => h('a.lnk', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, `${l.title} ↗`)));
}

/** The record as a card. */
export function vehicleCard(r: VehicleReport, links: readonly { title: string; url: string }[]): HTMLElement {
  const light = r.mot.state === 'valid' || r.mot.state === 'first_due' ? 'ok' : r.mot.state === 'none' ? 'mid' : 'off';
  const facts = [r.colour, r.fuel, r.firstUsed ? `first used ${ukDate(r.firstUsed)}` : '', r.engineCc ? `${r.engineCc.toLocaleString('en-GB')} cc` : ''].filter(Boolean);
  const warn: HTMLElement[] = [];
  if (r.mileage.drops.length) warn.push(h('div.vcwarn', h('b', 'MILEAGE WENT DOWN'), ` ${r.mileage.drops.map((d) => `${d.from.toLocaleString('en-GB')} → ${d.to.toLocaleString('en-GB')} mi on ${ukDate(d.date)}`).join('; ')}. An odometer does not run backwards: ask why before buying.`));
  if (/^yes$/i.test(r.recall)) warn.push(h('div.vcwarn', h('b', 'SAFETY RECALL'), ' at least one recall has not been fixed. A dealer for the make can check it for free.'));
  const sparkBox = r.mileage.points.length >= 2 ? h('div.vcspark', spark(r.mileage.points.map((p) => p.miles), 240, 40), h('small.note', `${ukDate(r.mileage.points[0]!.date)} → ${ukDate(r.mileage.points.at(-1)!.date)}`)) : null;
  const dvla = r.dvla
    ? h('div.vcrow', h('span.k', 'DVLA'), h('span.v', [`tax: ${r.dvla.taxStatus || '?'}${r.dvla.taxDue ? ` (due ${ukDate(r.dvla.taxDue)})` : ''}`, r.dvla.motStatus ? `MOT: ${r.dvla.motStatus}` : '', r.dvla.co2 != null ? `CO2 ${r.dvla.co2} g/km` : '', r.dvla.year ? `made ${r.dvla.year}` : ''].filter(Boolean).join(' · ')))
    : null;
  const latest = r.tests[0];
  return h(
    'div.vccard',
    h('div.vchead', h('span.vcplate', r.plate), h('div.vcname', h('b', [r.make, r.model].filter(Boolean).join(' ') || 'Make and model not on record'), h('small', facts.join(' · ')))),
    h(`div.vcverdict.${light}` as 'div', h('i'), h('span', r.mot.text)),
    ...warn,
    h(
      'div.vcrow',
      h('span.k', 'MILEAGE'),
      h('span.v', r.mileage.last != null ? `${miles(r.mileage.last, r.mileage.unit)} at the last test (${ukDate(r.mileage.at)})` : 'no reading on record'),
    ),
    sparkBox,
    latest ? h('div.vcrow', h('span.k', 'LAST TEST'), h('span.v', `${r.advisories} advisor${r.advisories === 1 ? 'y' : 'ies'} · ${latest.defects.length - r.advisories} other note${latest.defects.length - r.advisories === 1 ? '' : 's'}`)) : null,
    /^(no|unknown)$/i.test(r.recall) ? h('div.vcrow', h('span.k', 'RECALLS'), h('span.v', /^no$/i.test(r.recall) ? 'all fixed' : 'none known')) : null,
    dvla,
    r.tests.length ? h('div.vchist', h('small.lab', `MOT HISTORY · ${r.tests.length} TEST${r.tests.length === 1 ? '' : 'S'} · TAP ONE FOR ITS NOTES`), ...r.tests.map((t, i) => testRow(t, i === 0))) : null,
    h('small.note.vcsource', `From the official record: ${r.sources.join(' and ')}. Shown once, not saved.`),
    linksRow(links),
  );
}

/** Open the sheet; with a plate it is filled in, and `run` checks it straight away (the owner's tap on the Lens chip). */
export function openVehicleCheck(plate = '', run = false): void {
  sheet?.close();
  expose();
  const input = h('input.vcinput', { type: 'text', value: plate ? formatPlate(plate) : '', placeholder: 'AB12 CDE', maxlength: 10, autocomplete: 'off', autocapitalize: 'characters', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'search', 'aria-label': 'Number plate' });
  const out = h('div.vcout');
  let gen = 0;
  const check = async () => {
    const p = normalisePlate(input.value);
    if (!isPlate(p)) {
      vehicleState.status = 'error';
      clear(out, h('div.vcerr', 'That is not a UK number plate. Type it like AB12 CDE, A123 BCD, ABC 123D or ABZ 1234.'));
      return;
    }
    const g = ++gen;
    input.value = formatPlate(p);
    Object.assign(vehicleState, { status: 'checking', plate: formatPlate(p), verdict: '' });
    btn.disabled = true;
    clear(out, h('div.note', `Checking ${formatPlate(p)} with the official record…`));
    try {
      // Straight to the brain with no cache (api/brain.ts keeps copies of some answers on the device: not this one).
      const r = await fetch('/api/vehicle', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ plate: p }), credentials: 'same-origin', cache: 'no-store' });
      const a = (await r.json().catch(() => null)) as (VehicleAnswer & { error?: string }) | null;
      if (g !== gen) return;
      if (a && a.ok) {
        Object.assign(vehicleState, { status: 'shown', verdict: a.report.verdict });
        clear(out, vehicleCard(a.report, a.links));
      } else {
        vehicleState.status = 'error';
        const msg = a && !a.ok && a.message ? a.message : a?.error ?? `The check failed (HTTP ${r.status}).`;
        clear(out, h('div.vcerr', msg), linksRow(a && !a.ok && a.links?.length ? a.links : OFFICIAL_CHECKS));
      }
    } catch (e) {
      if (g !== gen) return;
      vehicleState.status = 'error';
      clear(out, h('div.vcerr', `Could not reach Ghosty: ${String((e as Error)?.message ?? e).slice(0, 120)}`), linksRow(OFFICIAL_CHECKS));
    } finally {
      if (g === gen) btn.disabled = false;
    }
  };
  const btn = button('CHECK', () => void check(), 'on');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void check();
    }
  });
  const body = h(
    'div.vcwrap',
    h('div.vcbanner', h('b', 'LOOKED UP ONCE, NOT SAVED'), h('span', 'One car, only when you press CHECK: the official MOT and vehicle record, shown here and gone when you close this. Never who owns it.')),
    h('div.vcform', input, btn),
    out,
  );
  Object.assign(vehicleState, { open: true, status: '', plate: '', verdict: '' });
  sheet = modal('VEHICLE CHECK', body, () => {
    // Closing forgets it: the card goes with the sheet, and the test handle is emptied.
    gen++;
    sheet = null;
    Object.assign(vehicleState, { open: false, status: '', plate: '', verdict: '' });
  });
  if (plate && run) void check();
  else input.focus();
}
