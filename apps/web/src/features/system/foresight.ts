/**
 * SYSTEM → REPORT CARD → FORESIGHT (OWNER-ISSUES 61a, 74(3); the brain's ledger, apps/edge/src/foresight.ts), beside WHAT I
 * LEARNED TO DO: how often each kind of prediction came out right (a bar each: rain, trains, the commute, his questions,
 * with how many were scored), the last ten scored with ✓ or ✗ and what happened, the ones still open — his questions with
 * RIGHT / WRONG / UNKNOWN, the only score they get — and the honest footer: scored only against the feeds and his word.
 */
import { calibrationLine, expectLine, FORE_KINDS, kindWord, proofLine, type ForesightInfo } from '../../../../../packages/shared/src/foresight';
import { clear, h } from '../../core/dom';
import { loadForesight } from '../../state/foresight';
import { bar, panel, row, type Panel } from '../../ui/components';
import { tagged, verdictButtons } from '../brief/foresight';

const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export function foresightPanel(): Panel & { refresh(): void } {
  const p = panel('FORESIGHT', { grow: false, cls: 'foresightrc' });
  const draw = (info: ForesightInfo | null) => {
    if (!info) {
      p.setStatus('NOT REACHABLE', 'mid');
      return void clear(p.body, h('div.note', 'I can’t reach the brain right now, so I can’t show my record.'));
    }
    const all = info.calibration.all;
    p.setStatus(all.n ? `${all.n} SCORED` : 'NOTHING SCORED YET', all.n ? 'ok' : 'off');
    const bars = FORE_KINDS.map((k) => {
      const c = info.calibration[k];
      const b = bar(kindWord(k, info.items).toUpperCase(), c.n ? c.share : 0, c.n ? `${Math.round(c.share * 100)}% · ${c.n}` : 'none yet');
      b.dataset.kind = k;
      b.title = calibrationLine(k, c, info.items);
      return b;
    });
    const scored = info.items.filter((x) => x.outcome && x.outcome.right !== null).sort((a, b) => b.outcome!.at - a.outcome!.at).slice(0, 10);
    const open = info.items.filter((x) => !x.outcome).sort((a, b) => b.at - a.at).slice(0, 10);
    const parts: Node[] = [h('div.forebars', ...bars)];
    parts.push(h('div.lab', 'LAST SCORED'));
    if (scored.length) for (const x of scored) parts.push(tagged(row(x.outcome!.right ? '✓' : '✗', proofLine(x), day(x.outcome!.at), { wrap: true, tone: x.outcome!.right ? 'up' : 'bad' }), x.outcome!.right ? 'foreok' : 'forebad'));
    else parts.push(h('div.note', 'Nothing scored yet: each prediction is checked when its time comes.'));
    parts.push(h('div.lab', 'STILL OPEN'));
    if (open.length) {
      for (const x of open) {
        parts.push(tagged(row(x.kind === 'answer' ? 'YOURS' : 'FEED', x.kind === 'answer' ? `${expectLine(x)} · “${x.subject}”` : expectLine(x), day(x.by), { wrap: true }), 'foreopen'));
        if (x.kind === 'answer') parts.push(verdictButtons(x, draw, true));
      }
    } else parts.push(h('div.note', info.items.length ? 'Nothing open: everything made so far has been scored.' : 'Nothing yet: I make the day’s predictions each morning at six.'));
    parts.push(h('div.note.small.forefoot', ['Scored only against the feeds and your own word, and never changed afterwards.', ...info.notes].join(' ')));
    clear(p.body, ...parts);
  };
  const refresh = () => void loadForesight(true).then(draw);
  return Object.assign(p, { refresh });
}
