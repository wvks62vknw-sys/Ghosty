/**
 * SETTINGS → OFFLINE MAPS and OFFLINE EYES (BRIEF-OFFLINE-1): the packs he keeps on the phone so the map of his area and the Lens's
 * own reading work with no signal. Each pack is a row in the Wikipedia pack's own words (wiki/view.ts): its name, what is in it,
 * its size said before the tap (`Get · about 70 MB`), its licence, GET (which waits for Wi-Fi where the browser says it is on mobile
 * data, shows "piece 3 of 1,200 · 24 MB of about 70 MB" with STOP, and carries on from where it stopped), and once it is here "<name>,
 * <month>, <size> on your phone" with DELETE (the UNDO bar holds the delete back). One download at a time. The files and the rule are
 * offline/pack.ts; the map's are offline/maps.ts, the Lens's are offline/eyes.ts.
 */
import { firstSentence, para, rest } from '../../ui/oneline';
import { clear, h } from '../../core/dom';
import { capsWords, probeCaps, takesLarger } from '../../offline/capability';
import { CANNOT, EYES_PACKS, markLens } from '../../offline/eyes';
import { largerList, setSizeChoice, sizeChoice, sizeInUse } from '../../offline/sizes';
import { mapPack } from '../../offline/maps';
import { packChanged, SPEAKER_PACK } from '../../offline/speakerpack';
import { deletePack, getPack, gettingWords, goneFiles, isHere, keptAll, keptWords, mobileWords, offMobileData, onMobileData, progressLine, readLog, sizeSaid, sizeWords, type GetProgress, type PackDef } from '../../offline/pack';
import { button, panel, toast, undo, type Panel } from '../../ui/components';
import { sayError } from '../../ui/hisWords';

/** One download at a time across both panels; every panel repaints when it moves. */
let getting: { id: string; ctl: AbortController; line: string; frac: number } | null = null;
let failed: { id: string; text: string } | null = null;
const painters = new Set<() => void>();
const repaintAll = (): void => painters.forEach((f) => f());
/** Packs hidden while the UNDO bar is up (their files go when the bar does). */
const leaving = new Set<string>();

async function fetchPack(p: PackDef): Promise<void> {
  if (getting) return;
  failed = null;
  const ctl = new AbortController();
  getting = { id: p.id, ctl, line: '', frac: 0 };
  const show = (line: string, frac = getting?.frac ?? 0) => {
    if (!getting) return;
    getting.line = line;
    getting.frac = frac;
    repaintAll();
  };
  try {
    if (onMobileData()) {
      show(mobileWords(p));
      await offMobileData(ctl.signal);
      if (ctl.signal.aborted) throw Object.assign(new Error('stopped'), { name: 'AbortError' });
    }
    show(gettingWords(p));
    await getPack(p, (x: GetProgress) => show(progressLine(x.piece, x.of, x.got, x.total), x.total ? Math.min(1, x.got / x.total) : 0), ctl.signal);
    markLens(p.id);
    packChanged(p.id);
    getting = null;
    repaintAll();
    toast(`${p.name} is on your phone: it works with or without a signal.`, 'ok');
  } catch (e) {
    const stopped = (e as Error)?.name === 'AbortError';
    getting = null;
    failed = { id: p.id, text: stopped ? 'Stopped; what came so far stays: GET carries on from there.' : sayError(e, 'get that pack') };
    repaintAll();
  }
}

function remove(p: PackDef): void {
  leaving.add(p.id);
  repaintAll();
  const size = sizeWords(keptAll()[p.id]?.bytes ?? p.bytes);
  undo(
    `${p.name} (${size}) deleted from this phone.`,
    () => {
      leaving.delete(p.id);
      repaintAll();
    },
    async () => {
      await deletePack(p);
      packChanged(p.id);
      leaving.delete(p.id);
      repaintAll();
    },
  );
}

/** A panel of packs: the rows, and under them whatever the pack set has to say (what cannot run on the phone, the licences). */
function packsPanel(title: string, cls: string, lead: string, packs: () => PackDef[], foot: string[], extra?: (here: Set<string>) => Promise<HTMLElement[]>): Panel & { refresh(): void } {
  const p = panel(title, { grow: false, cls, status: 'Checking this phone…' });
  const rows = h('div.wikioffers');
  const more = h('div.eyesizes');
  p.body.append(...para('p.note', lead), rows, more, ...foot.flatMap((t) => para('p.note', t)));
  const paint = async (): Promise<void> => {
    const list = packs();
    const here = new Set<string>();
    for (const d of list) if (!leaving.has(d.id) && (await isHere(d))) here.add(d.id);
    const was = readLog();
    clear(
      rows,
      ...list.map((d) => {
        const size = sizeSaid(d);
        const mine = getting?.id === d.id;
        const kept = keptAll()[d.id];
        const gone = goneFiles.has(d.id);
        const note =
          was?.id === d.id && !mine
            ? `GET stopped at piece ${was.piece} of ${was.of} when Ghosty closed: GET carries on from there.`
            : gone
              ? `${d.name} was on this phone, and iPhone has cleared some of it to make room (Ghosty did not); GET fetches only what is missing.`
              : '';
        const on = here.has(d.id) && kept;
        // (a pack that stopped short offers RETRY, with its size still said before the tap)
        const retry = failed?.id === d.id && !mine;
        const get = button(`${retry ? 'RETRY' : 'Get'} · ${size}`, () => void fetchPack(d), 'on');
        get.dataset.case = 'keep';
        get.dataset.act = 'get';
        get.setAttribute('aria-label', `${retry ? 'Retry' : 'Get'} ${d.name}, ${size}, on Wi-Fi`);
        get.disabled = !!getting;
        const stop = button('STOP', () => getting?.ctl.abort());
        stop.dataset.act = 'stop';
        const del = button('DELETE', () => remove(d), 'warn');
        del.dataset.act = 'delete';
        del.setAttribute('aria-label', `Delete ${d.name} from the phone`);
        const second = largerList().some((l) => l.pack.id === d.id);
        return h(
          'div.wikioffer',
          { dataset: { pack: d.id, state: on ? 'here' : mine ? 'getting' : retry ? 'failed' : 'offered', size: second ? 'larger' : 'standard' } },
          h('b', d.name),
          second ? h('small.packsize', `Larger, ${sizeWords(d.bytes)}, for a newer phone`) : null,
          h('span', firstSentence(d.what)[0]),
          on ? h('small.packkept', { role: 'status' }, keptWords(d, kept!)) : h('small', `${size} · ${d.month} · on Wi-Fi`) /* state: settings.packs empty */,
          // a card says what it is, what it costs and the one key: the licence and the rest of what it says are one tap away
          rest([firstSentence(d.what)[1], d.licence, d.note].filter(Boolean).join(' ')),
          note ? h('small.note', note) : null,
          /* state: settings.packs error */
          failed?.id === d.id ? h('small.wikierr', { role: 'alert' }, failed.text) : null,
          /* state: settings.packs loading */
          mine ? h('div.wikiprog', { role: 'status' }, h('div.gauge', h('i', { style: { width: `${Math.round((getting!.frac || 0) * 100)}%` } })), h('small.packline', getting!.line)) : null,
          h('div.row', on ? del : mine ? stop : get),
        );
      }),
    );
    if (extra) clear(more, ...(await extra(here)));
    p.setStatus(here.size ? `${here.size} of ${list.length} here` : 'Not on this phone');
  };
  painters.add(() => void paint());
  void paint();
  return Object.assign(p, { refresh: () => void paint() });
}

/** SETTINGS → OFFLINE MAPS: the map of his area. */
export const mapsPanel = (): Panel & { refresh(): void } =>
  packsPanel(
    'OFFLINE MAPS',
    'offmaps',
    'The map for your area, kept on this phone for when there is no signal: the 3D map and the journey draw from it, and say so. Fetched only when you tap, on Wi-Fi.',
    () => [mapPack()],
    ['Works with no signal: the map, its labels, the journey’s pins and path. Needs a signal, and says so: an address, a route, live traffic, rain and railways, the flat map’s other styles.'],
  );

/** SETTINGS → OFFLINE EYES: the Lens's own reading. */
export const eyesPanel = (): Panel & { refresh(): void } =>
  packsPanel(
    'OFFLINE EYES',
    'offeyes',
    'What the Lens reads with, kept on this phone so it works with no signal. Nothing of what it sees is ever sent. Fetched only when you tap, on Wi-Fi.',
    () => EYES_PACKS.flatMap((d) => [d, ...largerList().filter((l) => l.of === d.id).map((l) => l.pack)]),
    [CANNOT],
    sizesBlock,
  );

/** SETTINGS → VOICE MODEL: the model that tells voices apart better, kept on this phone on his tap. */
export const voiceModelPanel = (): Panel & { refresh(): void } =>
  packsPanel(
    'VOICE MODEL',
    'offvoice',
    'A small free model that tells voices apart, kept on this phone. Nothing you say is sent to it or from it. Fetched only when you tap, on Wi-Fi.',
    () => [SPEAKER_PACK],
    ['It only ever helps me know it is you, or someone you introduced with them there. It is never a lock: a recording of you can fool it, and everything that matters still needs your tap. Without it, or with no signal, I use what I did before.'],
  );
/**
 * OFFLINE EYES' sizes (offline/sizes.ts): what this phone reports, whether a larger size would be chosen for it, and for each pack that
 * has a larger one the choice (AUTO, STANDARD, LARGER) with the size in use and why. With no larger model on this site it says so, in
 * the words of what the phone could take, so the owner's phone check reads the phone even then.
 */
async function sizesBlock(here: Set<string>): Promise<HTMLElement[]> {
  const caps = await probeCaps();
  const t = takesLarger(caps);
  const list = largerList();
  const out: HTMLElement[] = [h('p.note', { dataset: { eyes: 'caps' } }, `This phone: ${capsWords(caps)}; ${t.ok ? `a larger size would be chosen for it (${t.why}).` : `a larger size is not chosen for it by itself: ${t.why}.`}`)];
  if (!list.length) out.push(h('p.note', { dataset: { eyes: 'one' } }, 'One size only for now: the Lens uses the one above on every phone.'), rest('No larger free model with a clear licence is on this site yet.'));
  for (const l of list) {
    const std = EYES_PACKS.find((d) => d.id === l.of);
    const cur = sizeChoice(l.of);
    const use = sizeInUse(l.of, caps, here.has(l.pack.id));
    const pick = (v: 'auto' | 'standard' | 'larger') => {
      const b = button(v === 'auto' ? 'AUTO' : v === 'standard' ? 'STANDARD' : 'LARGER', () => {
        setSizeChoice(l.of, v);
        repaintAll();
      }, cur === v ? 'on' : undefined);
      b.dataset.act = `size-${v}`;
      b.setAttribute('aria-pressed', String(cur === v));
      return b;
    };
    out.push(h('div.eyesize', { dataset: { of: l.of } }, h('small', `${std?.name ?? l.of}: in use ${use.size === 'larger' ? 'the larger size' : 'the standard size'} (${use.why})`), h('div.row', pick('auto'), pick('standard'), pick('larger'))));
  }
  return out;
}
