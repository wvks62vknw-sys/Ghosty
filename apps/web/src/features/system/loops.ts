/**
 * SYSTEM → LOOPS, beside the OFFLINE BRAIN REPORT CARD (GYM ideas, part 4): every way Ghosty practises by himself
 * on one card — the GYM, drills, SCHOOL practice, self-study, the weekly run, the voice, and the lessons his
 * checked work makes — each with what it practised this week, what improved (the real numbers, before → after),
 * what was rejected and why, and ROLLBACK for the weekly brain. The words come from packages/shared/src/loops.ts
 * `loopRows`; the brain's numbers from GET /api/training/loops, the GYM's from this phone's records. State for
 * specs at window.__ghosty.loops.
 */
import { loopRows, type BrainLoops, type LoopRow, type PhoneLoops } from '../../../../../packages/shared/src/loops';
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { metaById } from '../../gym/meta';
import { gymWeek } from '../../gym/session';
import { sentSince } from '../../offline/star';
import { flushStars, starBox } from '../../offline/starbox';
import { button, niceCase, panel, toast, type Panel } from '../../ui/components';
import { loadAll } from '../gym/store';

const WEEK = 7 * 86_400_000;
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** What the card shows, for specs (window.__ghosty.loops). */
export const loopsState = { rows: [] as LoopRow[], brain: false, since: 0, loads: 0 };

/** This phone's loops this week: the GYM's records and the lessons sent. */
async function phoneLoops(now: number): Promise<PhoneLoops> {
  const recs = await loadAll().catch(() => new Map());
  const games = [...recs.values()].map((r) => gymWeek(r, niceCase(metaById(r.id)?.title ?? r.id), now));
  const box = starBox.get();
  const s = sentSince(box, now - WEEK);
  return { gym: { games }, star: { think: s.think, gym: s.gym, waiting: box.queue.length, over: box.day === new Date(now).toISOString().slice(0, 10) ? box.over : 0 } };
}

export function loopsPanel(): Panel & { refresh(): void } {
  const p = panel('LOOPS', { grow: false, cls: 'loops' });
  const head = h('div.note.loopshead');
  const list = h('div.loopsrows');
  p.body.append(head, list, h('div.note.small', 'Measured, not claimed: a new GYM version is kept only if it beats his past selves, a new brain only if it passes its test, and lessons come only from answers an exact check passed.'));

  const paint = (rows: LoopRow[], b: BrainLoops | null, now: number) => {
    loopsState.rows = rows;
    loopsState.brain = !!b;
    loopsState.since = b?.since ?? now - WEEK;
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.loops = loopsState;
    head.textContent = b ? `This week, since ${day(b.since)}: what each loop practised, what got better, and what was thrown out.` : 'The brain is not reachable: only this phone’s loops are shown.';
    p.setStatus(b ? `${rows.length} LOOPS` : 'PHONE ONLY', b ? 'ok' : 'mid');
    clear(
      list,
      ...rows.map((r) => {
        const el = h(
          'div.loop',
          { dataset: { loop: r.id } },
          h('b.loopname', r.name),
          h('div.loopline', h('span.k', 'Practised'), h('span.v', r.practised)),
          h('div.loopline', h('span.k', 'Improved'), h('span.v', r.improved)),
          h('div.loopline', h('span.k', 'Rejected'), h('span.v', r.rejected)),
        );
        if (r.rollback)
          el.append(
            button('ROLLBACK', async (bt) => {
              bt.disabled = true;
              try {
                const st = await brain.selftrain.rollback();
                toast(`The newest brain is gone; back to ${st.models.find((m) => m.commit === st.active)?.label ?? 'the stock Qwen3'}`, 'ok');
              } catch (e) {
                toast(String((e as Error)?.message ?? e).slice(0, 160), 'warn');
              }
              refresh();
            }, 'warn loopback'),
          );
        return el;
      }),
    );
  };

  function refresh(): void {
    void (async () => {
      const now = Date.now();
      // (what is waiting goes first, so the numbers include it)
      await flushStars().catch(() => 0);
      const [b, ph] = await Promise.all([brain.selftrain.loops().catch(() => null), phoneLoops(now)]);
      loopsState.loads++;
      paint(loopRows(b, ph), b, now);
    })();
  }
  return Object.assign(p, { refresh });
}
