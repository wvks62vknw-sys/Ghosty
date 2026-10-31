/**
 * SYSTEM → OFFLINE BRAIN REPORT CARD: what the small model on this phone can and cannot do, measured
 * here, not claimed. RUN CHECK asks its 20 fixed questions (offline/bench.ts) once as in chat and once
 * with THINK HARDER; QUICK CHECK only as in chat. Each kind of question gets its score both ways and the
 * time it took, then a plain-English verdict, and every check is kept on this phone so the weeks show as
 * a small graph. A new model (Stage 2's weekly one) shows as NEW MODEL until it is checked
 * (offline/harder.ts `needsCheck`, `onNewModel`).
 */
import { clear, h, svgEl } from '../../core/dom';
import { catScores, CATS, overall, summarise, trend, voiceLine, type Run } from '../../offline/bench';
import { offlineBrain, offlineReady, offlineSupport } from '../../offline/brain';
import { modelKey, needsCheck, reportCard, runReportCard, stopThinking, thinking } from '../../offline/harder';
import { goToPanel } from '../../ui/sections';
import { bar, button, panel, toast, type Panel } from '../../ui/components';
import { independenceBlock } from './independence';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const secs = (ms: number) => (ms >= 90_000 ? `${Math.round(ms / 60_000)} min` : `${Math.max(0, Math.round(ms / 1000))} s`);
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** The weeks as a graph: right answers as in chat (solid) and with THINK HARDER (dashed), 0–100 %. */
function graph(runs: ReturnType<typeof trend>): SVGSVGElement {
  const W = 300;
  const H = 70;
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'rcgraph', role: 'img', 'aria-label': 'Report card scores over time' });
  for (const y of [0, 0.5, 1]) s.append(svgEl('line', { x1: 0, x2: W, y1: (H - 4 - y * (H - 8)).toFixed(1), y2: (H - 4 - y * (H - 8)).toFixed(1), class: 'grid' }));
  const x = (i: number) => (runs.length < 2 ? W / 2 : 6 + (i / (runs.length - 1)) * (W - 12));
  const y = (v: number) => H - 4 - v * (H - 8);
  const line = (vals: (number | null)[], cls: string) => {
    const pts = vals.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean);
    if (pts.length >= 2) s.append(svgEl('polyline', { points: pts.join(' '), class: cls, fill: 'none' }));
    vals.forEach((v, i) => v != null && s.append(svgEl('circle', { cx: x(i).toFixed(1), cy: y(v).toFixed(1), r: 2.2, class: cls })));
  };
  line(runs.map((r) => r.plain), 'plain');
  line(runs.map((r) => r.think), 'think');
  return s;
}

export function reportCardPanel(): Panel & { refresh(): void } {
  const p = panel('OFFLINE BRAIN REPORT CARD', { grow: false, cls: 'reportcard' });
  const head = h('div.note.rchead');
  const prog = h('div.rcprog');
  const card = h('div.rccard');
  const past = h('div.rcpast');
  let ok = false;
  let ready = false;

  const start = (withThink: boolean) => {
    if (thinking.get().busy) return;
    void runReportCard(withThink)
      .then((r) => toast(r.complete ? 'Report card done' : 'Report card stopped: partial scores kept', r.complete ? 'ok' : 'warn'))
      .catch((e) => toast(String((e as Error)?.message ?? e).slice(0, 160), 'bad'))
      .finally(paint);
    paint();
  };
  const run = button('RUN CHECK', () => start(true), 'on');
  run.title = 'All 20 questions, as in chat and with THINK HARDER (about 10 minutes on an iPhone 13; an estimate)';
  const quick = button('QUICK CHECK', () => start(false));
  quick.title = 'All 20 questions, as in chat only (a few minutes)';
  const stop = button('STOP', () => stopThinking(), 'warn');
  // (the panel itself, not the Settings screen on whatever pill was last chosen: it sits under Voice & home)
  const toSettings = button('DOWNLOAD IT IN SETTINGS', () => goToPanel('settings', 'OFFLINE BRAIN'));

  /** One run: a row per kind (as in chat · with THINK HARDER · time), then the verdict. */
  const paintRun = (r: Run, live: boolean) => {
    const rows = catScores(r).map((c) => {
      const label = CATS.find((x) => x.id === c.cat)!.label;
      const plain = c.plain[1] ? `${c.plain[0]}/${c.plain[1]}` : '—';
      const think = c.think[1] ? `${c.think[0]}/${c.think[1]}` : r.withThink && live ? '…' : '—';
      return h(`div.rcrow.c-${c.cat}` as 'div', h('span.rccat', label), h('b.rcplain', plain), h('b.rcthink', think), h('span.rctime', c.plain[1] ? secs(c.plainMs + c.thinkMs) : ''));
    });
    const [pl, th] = overall(r);
    clear(
      card,
      h('div.rcrow.rchd', h('span.rccat', 'KIND'), h('b.rcplain', 'AS IN CHAT'), h('b.rcthink', 'THINK HARDER'), h('span.rctime', 'TIME')),
      ...rows,
      h('div.rcrow.rctot', h('span.rccat', 'ALL'), h('b.rcplain', r.items.length ? pct(pl) : '—'), h('b.rcthink', th == null ? '—' : pct(th)), h('span.rctime', secs(r.ms))),
      // how many of the replies the AI-sounding detector called human (bench.ts voiceLine; '' when none were judged)
      voiceLine(r) ? h('div.note.rcvoice', voiceLine(r)) : null,
      live ? null : h('div.note.rcsum', summarise(r)),
    );
  };

  function paint(): void {
    const s = reportCard.get();
    const busy = thinking.get().busy;
    const mine = busy === 'bench';
    const lastRun = s.history.at(-1);
    const fresh = needsCheck();
    if (!ok) head.textContent = 'This phone cannot run the offline brain, so there is nothing to measure here.';
    else if (!ready) head.textContent = 'The offline brain is not on this phone yet: download it first, then run the check.';
    else if (mine) head.textContent = `Checking ${modelKey().split('@')[0]} on this phone… keep Ghosty open. STOP keeps what is done.`;
    else if (lastRun) head.textContent = `${fresh ? 'NEW MODEL since the last check: run it again. ' : ''}Last checked ${day(lastRun.at)} on this phone (${lastRun.model.split('@')[0]}${lastRun.complete ? '' : ', stopped early'}).`;
    else head.textContent = 'Not checked yet. RUN CHECK asks 20 fixed questions on this phone: sums, logic puzzles, facts, exact instructions and tool calls.';
    p.setStatus(!ok ? 'UNSUPPORTED' : mine ? 'CHECKING' : !ready ? 'NOT DOWNLOADED' : fresh ? (lastRun ? 'NEW MODEL' : 'NOT RUN') : 'CHECKED', !ok ? 'off' : mine ? 'mid' : fresh ? 'mid' : 'ok');
    run.disabled = quick.disabled = !ok || !ready || !!busy;
    stop.hidden = !mine;
    toSettings.hidden = !ok || ready;
    if (mine) clear(prog, bar('CHECK', s.total ? s.done / s.total : 0, s.total ? `${s.done}/${s.total}` : '…'), h('div.note.rcline', s.line));
    else clear(prog);
    const shown = mine && s.live ? s.live : lastRun;
    if (shown) paintRun(shown, mine);
    else clear(card);
    const pts = trend(s.history);
    clear(
      past,
      pts.length >= 2
        ? h('div.rcweeks', h('div.lab', `OVER TIME · ${pts.length} CHECKS`), graph(pts), h('div.note.rclegend', h('span.k.plain', 'as in chat'), ' ', h('span.k.think', 'with THINK HARDER'), ` · ${day(pts[0]!.at)} – ${day(pts.at(-1)!.at)}`))
        : h('div.note', s.history.length ? 'The graph starts after two complete checks.' : ''),
    );
  }

  function refresh(): void {
    void (async () => {
      ok = (await offlineSupport()).ok;
      ready = ok && (await offlineReady().catch(() => false));
      paint();
    })();
  }

  p.body.append(
    head,
    h('div.keyrow', run, quick, stop, toSettings),
    prog,
    card,
    past,
    // the independence meter: how much of his week his own brains answered (OWNER-ISSUES 78)
    independenceBlock(),
    h('div.note', 'Measured on this phone, not claimed: the same 20 questions each time, one try each as in chat, then THINK HARDER (which here may only use checks that work an answer out — never ones that already know it — so its score is the model’s own). Timings depend on the phone and how warm it is.'),
  );
  reportCard.subscribe(paint);
  thinking.subscribe(paint);
  // Downloaded or deleted in SETTINGS meanwhile (or a new model): look again.
  offlineBrain.subscribe((st, prev) => {
    if (st.downloaded !== prev.downloaded || st.model !== prev.model) refresh();
  });
  refresh();
  return Object.assign(p, { refresh });
}
