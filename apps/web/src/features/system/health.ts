/**
 * SYSTEM → HEALTH (BRIEF-RELIABILITY 1, 4, 5, 6): what is real, at a glance, in his words.
 *   HEALTH     one honest line at the top ("Everything is working." / "3 things need you." / "Offline: 41 of 60 things still work."),
 *              then every ability under its mark with the one reason and the one key to put it right (NEEDS KEY → the key's row,
 *              OFFLINE → the offline brain's page, DEGRADED → RETRY, which runs the ability's own check)
 *   CRASHES    "No crashes this week." or the records (the screen, the hour, his words), each with THAT FELT OFF prefilled
 *   FELT OFF   the moments he filed, with the week's count
 *   THE BRAIN  the brain itself, each line one sentence, every number with its unit and "as of": reachable, its version's day, its
 *              store, the clock's jobs with the last run of each, the keys by name, the feeds, the GPU job
 * The report card (reportcard.ts) links here and does not repeat it. Every wait is said (ui/wait.ts); the page asks for one request,
 * kept ten minutes, and only when it opens.
 */
import type { Ability } from '../../../../../packages/shared/src/abilities';
import { briefLine, clockOf, jobLine, MARKS, stale, type BrainHealth, type FeltList, type Mark } from '../../../../../packages/shared/src/health';
import { allMarked, countLine, isOffline, fixIt, healthState, loadHealth, retry, type Marked } from '../../abilities/health';
import { screenName } from '../../abilities/registry';
import { brain, lastSeen } from '../../api/brain';
import { clear, fmt, h } from '../../core/dom';
import { crashes, thisWeek } from '../../core/crash';
import { goToPanel } from '../../ui/sections';
import { button, empty, panel, row, type Panel } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { waiting } from '../../ui/wait';
import { more } from '../lifeui';
import { keysLine } from './words';
import { BUILD } from '../../state/build';
import { feltSheet } from '../core/feltoff';

const ORDER: Mark[] = ['NEEDS KEY', 'DEGRADED', 'OFFLINE', 'WORKING'];
const FIX: Record<'key' | 'offline' | 'retry', string> = { key: 'PUT IN THE KEY', offline: 'THE OFFLINE BRAIN', retry: 'RETRY' };
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** One ability under its mark: his line, the mark as a word, the one reason, the one key to put it right. */
function abilityRow(a: Ability, m: Marked, again: () => void): HTMLElement {
  const line = h('p.hline', { dataset: { case: 'keep' } }, a.line);
  const mark = h('span.g-truth.hmark', { dataset: { case: 'keep', mark: m.mark } }, m.mark);
  const why = m.why ? h('p.g-truth.hwhy', { dataset: { case: 'keep' } }, m.why) : null;
  const r = h('div.hrow', { dataset: { id: a.id, mark: m.mark, case: 'keep' } }, h('div.hhead', line, mark), why);
  if (m.fix) {
    const b = button(FIX[m.fix], async (btn) => {
      if (m.fix === 'key') return fixIt(a, m);
      if (m.fix === 'offline') return goToPanel('settings', 'OFFLINE BRAIN');
      btn.disabled = true;
      btn.textContent = 'CHECKING…';
      await retry(a);
      again();
    }, m.fix === 'retry' ? 'on hfix' : 'hfix');
    b.dataset.case = 'keep';
    b.dataset.fix = m.fix;
    r.append(h('div.row.wrap.hkeys', b));
  }
  return r;
}

export function healthPanels(): { panels: Panel[]; refresh(force?: boolean): void } {
  const hp = panel('HEALTH', { grow: false, cls: 'healthpn' });
  const cp = panel('CRASHES', { grow: false, cls: 'crashpn' });
  const fp = panel('FELT OFF', { grow: false, cls: 'feltpn' });
  const bp = panel('THE BRAIN', { grow: false, cls: 'brainpn' });

  // ---- HEALTH
  const top = h('p.g-truth.healthtop', { dataset: { case: 'keep' } });
  const list = h('div.healthlist');
  const paintHealth = (): void => {
    const marked = allMarked();
    const line = countLine();
    top.textContent = line;
    const bad = marked.filter((x) => x.m.mark !== 'WORKING').length;
    hp.setStatus(healthState.get().reach ? (bad ? `${bad} NOT WORKING` : 'ALL WORKING') : 'OFFLINE', bad ? 'mid' : 'ok');
    clear(list);
    if (!marked.length) return void list.append(empty('Nothing known yet', 'I will list every ability once my brain has told me what it can do.'));
    for (const mark of ORDER) {
      const rows = marked.filter((x) => x.m.mark === mark);
      if (!rows.length) continue;
      const rowsEl = rows.map((x) => abilityRow(x.a, x.m, paintHealth));
      if (mark === 'WORKING') {
        // every one works: folded, so the ones that need him come first and the page stays short
        const d = h('details.hworking', { dataset: { case: 'keep' } }, h('summary', `WORKING · ${rows.length}`), ...rowsEl);
        list.append(d);
      } else list.append(h('div.hgroup', { dataset: { mark } }, h('p.g-truth.hgrouphead', { dataset: { case: 'keep' } }, `${mark} · ${rows.length}`), ...rowsEl));
    }
  };
  hp.body.append(top, list, h('div.row.wrap.hkeys', button('CHECK AGAIN', () => void refresh(true), 'hagain')));

  // ---- CRASHES
  const crashList = h('div.crashlist');
  const paintCrashes = (): void => {
    const recs = thisWeek();
    cp.setStatus(recs.length ? `${recs.length} THIS WEEK` : 'NONE THIS WEEK', recs.length ? 'mid' : 'ok');
    clear(crashList);
    if (!recs.length) return void crashList.append(h('p.g-truth.nocrash', { dataset: { case: 'keep' } }, 'No crashes this week.'));
    for (const r of recs) {
      const when = `${day(r.at)}, ${clockOf(r.at)}`;
      const b = button('THAT FELT OFF', () => feltSheet({ screen: r.screen, words: `${screenName(r.screen)} stopped at ${clockOf(r.at)}: ${r.words}` }), 'feltb');
      b.dataset.case = 'keep';
      crashList.append(h('div.crashrow', { dataset: { screen: r.screen, case: 'keep' } }, h('p.g-truth', { dataset: { case: 'keep' } }, `${screenName(r.screen)} · ${when}`), h('p.crashwords', { dataset: { case: 'keep' } }, r.words), h('div.row.wrap', b)));
    }
  };
  cp.body.append(crashList);
  crashes.subscribe(paintCrashes);

  // ---- FELT OFF
  const feltBox = h('div.feltlist');
  const paintFelt = (l: FeltList | null, failed = ''): void => {
    clear(feltBox);
    if (failed) return void feltBox.append(h('p.g-truth', { dataset: { case: 'keep' } }, failed));
    if (!l) return;
    fp.setStatus(l.week ? `${l.week} THIS WEEK` : 'NONE THIS WEEK', l.week ? 'mid' : 'ok');
    if (!l.moments.length) return void feltBox.append(empty('Nothing has felt off yet', 'Tap THAT FELT OFF under a reply, or press and hold the house line, and I will keep the moment.'));
    feltBox.append(h('p.g-truth.feltweek', { dataset: { case: 'keep' } }, `${l.week} moment${l.week === 1 ? '' : 's'} felt off this week${l.top ? `; the most on ${screenName(l.top.screen)}` : ''}.`));
    for (const m of l.moments.slice(0, 20)) {
      feltBox.append(h('div.feltrowv', { dataset: { screen: m.screen, case: 'keep' } },
        h('p.g-truth', { dataset: { case: 'keep' } }, `${screenName(m.screen)} · ${day(m.at)}, ${clockOf(m.at)}`),
        h('p.feltwords', { dataset: { case: 'keep' } }, m.words || m.did.join(', ') || m.text.slice(0, 120))));
    }
  };
  fp.body.append(feltBox);

  // ---- THE BRAIN
  const brainBox = h('div.brainlines');
  const asOf = (t: number) => `as of ${clockOf(t)}`;
  const paintBrain = (b: BrainHealth | null): void => {
    clear(brainBox);
    const st = healthState.get();
    const at = st.at || Date.now();
    if (!st.reach || !b) {
      bp.setStatus('CANNOT BE REACHED', 'mid');
      brainBox.append(row('BRAIN', 'I cannot reach my brain right now; what is kept on this phone still works.', null, { tone: 'dn', wrap: true }));
      if (b) brainBox.append(row('LAST HEARD', `my last account was at ${clockOf(st.at)} on ${day(st.at)}.`, null, { wrap: true }));
      return;
    }
    bp.setStatus('REACHABLE', 'ok');
    const lines: [string, string][] = [['BRAIN', `I am reachable (${asOf(at)}).`]];
    lines.push(['VERSION', BUILD.at ? `I and this app were built on ${day(Date.parse(BUILD.at))}.` : 'This is a development build, so I have no build day.']);
    const m = lastSeen.get().status?.meter;
    if (m) lines.push(['STORE', `Today I have read ${fmt.n(m.reads)} rows and written ${fmt.n(m.writes)}: ${Math.min(999, Math.round(Math.max(0, m.level) * 100))}% of my free allowance, which resets at ${clockOf(m.resetAt)} (as of ${clockOf(st.at)}).`]);
    for (const j of b.jobs.filter((x) => x.kind !== 'reminder' && x.kind !== 'task')) lines.push([j.title.toUpperCase().slice(0, 28), `${j.title} ${jobLine(j)} (${asOf(at)}).`]);
    for (const f of b.feeds) {
      const old = stale(f.id, f.at, at);
      lines.push([f.name.toUpperCase(), f.at ? `Last good read at ${clockOf(f.at)} on ${day(f.at)}${old ? ', which is older than it should be' : ''}${f.failed ? '; the last try failed' : ''} (${asOf(at)}).` : `Not read yet (${asOf(at)}).`]);
    }
    const have = b.keys.filter((k) => k.set).map((k) => k.label);
    const miss = b.keys.filter((k) => !k.set).map((k) => k.label);
    lines.push(['KEYS', keysLine(have, miss, asOf(at))]);
    if (b.gpu) lines.push(['TRAINING', `My weekly training job had ${fmt.n(b.gpu.left, 1)} of ${fmt.n(b.gpu.total, 1)} free GPU hours left${b.gpu.at ? ` when it last started, ${day(b.gpu.at)}` : ''} (${asOf(at)}).`]);
    for (const [k, v] of lines) brainBox.append(row(k, v, null, { wrap: true }));
    if (miss.length) brainBox.append(more(`Not added yet: ${miss.join(', ')}.`, 'WHICH'));
  };
  bp.body.append(brainBox);

  async function refresh(force = false): Promise<void> {
    const done1 = waiting(hp.body, 'Looking at everything I can do…');
    const done2 = waiting(bp.body, 'Asking my brain how it is…');
    const done3 = waiting(fp.body, 'Reading what felt off…');
    paintHealth();
    paintCrashes();
    try {
      const b = await loadHealth(force);
      // the store's own line comes from the status the brain gives anyway
      await brain.status().catch(() => undefined);
      paintHealth();
      paintBrain(b);
    } finally {
      done1();
      done2();
    }
    try {
      paintFelt(await brain.feltList());
    } catch (e) {
      paintFelt(null, sayError(e, 'read what felt off'));
    } finally {
      done3();
    }
  }
  paintHealth();
  paintCrashes();
  paintBrain(healthState.get().brain);
  healthState.subscribe(() => {
    paintHealth();
    paintBrain(healthState.get().brain);
  });

  return { panels: [hp, cp, fp, bp], refresh: (force) => void refresh(force) };
}

/**
 * The Brief's first line: the same count when anything needs him, and nothing otherwise. It reads the kept account and asks
 * for a fresh one only when the Brief is opened (never on the first screen's path), at most once in ten minutes.
 */
export function briefHealth(): HTMLElement {
  const el = h('p.brhealth', { dataset: { case: 'keep' } });
  el.hidden = true;
  const paint = (): void => {
    const line = briefLine(allMarked().map((x) => x.m.mark), isOffline());
    el.textContent = line;
    el.hidden = !line;
  };
  healthState.subscribe(paint);
  paint();
  void loadHealth();
  return el;
}

export { MARKS };
