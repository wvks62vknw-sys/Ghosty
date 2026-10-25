/**
 * REVERSE tab: reverse-engineer software with REA (Reverse Engineer Anything), run for you
 * on GitHub's free computers. Paste a link — a website, an npm package, a public GitHub
 * project or a direct file link (.apk, .dll, .exe, .zip, .asar, .jar) — and the report
 * arrives here (and as a notification) a few minutes later. Lawful research only.
 */
import { brain, headers, type ReverseJobInfo } from '../../api/brain';
import { send } from '../../assistant/session';
import { clear, h } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { button, panel } from '../../ui/components';
import { page } from '../../ui/page';

const CSS = `
.mdreport { font-size: 15px; line-height: 22px; overflow-wrap: anywhere; }
.mdreport h3 { font: 600 17px/22px var(--sf); color: var(--ink); margin: 18px 0 6px; padding-bottom: 6px; border-bottom: 1px solid var(--hair); }
.mdreport h4 { font: 600 15px/20px var(--sf); color: var(--ink2); margin: 14px 0 4px; }
.mdreport p { margin: 6px 0; } .mdreport ul { margin: 6px 0; padding-left: 18px; } .mdreport li { margin: 3px 0; }
.mdreport code { font: 400 13px var(--m); color: var(--a); background: rgba(var(--ar), .08); padding: 0 3px; border-radius: 4px; }
.mdreport details { margin: 8px 0; } .mdreport summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--ink2); font: 500 15px var(--sf); }
.mdreport pre { font: 400 12px/1.45 var(--m); color: var(--ink2); background: rgba(0,0,0,.35); padding: 10px 12px; margin: 4px 0 0; max-height: 60vh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; border-radius: 10px; }
.mdreport .warnnote { border-left: 2px solid var(--a); padding-left: 10px; }
.mdreport .revfoot { color: var(--ink3); font-size: 13px; line-height: 18px; }
.revhead { margin: 0 0 12px; } .revhead b { display: block; font: 600 22px/28px var(--sf); color: var(--ink); overflow-wrap: anywhere; } .revhead span { display: block; margin-top: 2px; font: 400 14px/19px var(--sf); color: var(--ink3); }
.mdreport hr { border: 0; border-top: 1px solid rgba(var(--cr), .15); margin: 10px 0; }
#pg-reverse .rw.link.on { box-shadow: inset 2px 0 0 var(--a); background: linear-gradient(90deg, rgba(var(--ar), .14), transparent); }
`;

/** The brain's words as a sentence: a capital at the start, a full stop at the end. */
const sentence = (t: string) => (t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}${/[.!?)]$/.test(t) ? '' : '.'}` : '');
/** 14:08, on this phone's clock. */
const clock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
/** A button shown with its words as written ("GitHub", not the sentence case that would make it "Github"). */
const asWritten = (b: HTMLButtonElement, words: string) => ((b.dataset.label = words), b);

/** What a report is about, in a word or two. */
const KIND_WORD: Record<string, string> = { web: 'Website', npm: 'Code package', repo: 'GitHub project', artifact: 'App file', auto: 'Link' };

/** Where a report has got to, in his words: "Ready · 25 Oct", "Running · 3 min", "Didn't finish". */
const STATE_WORD: Record<ReverseJobInfo['status'], (j: ReverseJobInfo) => string> = {
  done: (j) => `Ready${j.finishedAt ? ` · ${new Date(j.finishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`,
  failed: () => 'Didn’t finish',
  running: (j) => `Running · ${Math.max(1, Math.round((Date.now() - j.at) / 60_000))} min`,
  queued: () => 'Starting',
};

const KINDS: [string, string][] = [['auto', 'Ghosty can tell what it is'], ['web', 'A website'], ['npm', 'A code package (npm)'], ['repo', 'A GitHub project'], ['artifact', 'An app file (.apk, .exe, .zip…)']];

/** "2026-10-25T01:05:00.000Z" → "25 Oct 2026, 02:05" (this phone's time): the report's times in his words. */
const day = (t: number | string) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const plainTimes = (t: string) => t.replace(/\b\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?Z\b/g, (iso) => day(iso));

/**
 * Tiny markdown → DOM for the report (headings, code blocks, lists, bold, inline code), made to read on a phone:
 * times in his words, the title and the lines the header above already says left out, "(Ghosty baseline)" dropped
 * from headings, and REA's raw data (a code block, often thousands of characters of JSON) folded away.
 */
function renderMd(md: string): HTMLElement {
  const out = h('div.mdreport');
  const lines = plainTimes(md).split('\n').filter((l) => !/^# Reverse engineering report\s*$|^\*\*(Target|Kind|Started):\*\*/.test(l));
  let i = 0;
  const inline = (t: string): (string | Node)[] => {
    const parts: (string | Node)[] = [];
    const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    let last = 0;
    for (const m of t.matchAll(re)) {
      if (m.index! > last) parts.push(t.slice(last, m.index));
      const s = m[0];
      parts.push(s.startsWith('`') ? h('code', s.slice(1, -1)) : h('b', s.slice(2, -2)));
      last = m.index! + s.length;
    }
    if (last < t.length) parts.push(t.slice(last));
    return parts;
  };
  while (i < lines.length) {
    const l = lines[i]!;
    if (l.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) buf.push(lines[i++]!);
      i++;
      const raw = buf.join('\n');
      out.append(h('details', h('summary', `Show the raw data (${raw.length < 1024 ? `${raw.length} characters` : `${Math.round(raw.length / 1024)} KB`})`), h('pre', raw.slice(0, 40000))));
      continue;
    }
    if (/^#{1,3} /.test(l)) {
      const lvl = l.match(/^#+/)![0].length;
      out.append(h(lvl <= 2 ? 'h3' : 'h4', ...inline(l.replace(/^#+ /, '').replace(/\s*\(Ghosty baseline\)/i, ''))));
    } else if (/^[-*] /.test(l)) {
      const ul = h('ul');
      while (i < lines.length && /^[-*] /.test(lines[i]!)) ul.append(h('li', ...inline(lines[i++]!.slice(2))));
      out.append(ul);
      continue;
    } else if (/^> /.test(l)) out.append(h('div.note.warnnote', ...inline(l.slice(2))));
    else if (l.trim() === '---') out.append(h('hr'));
    else if (/^_.+_$/.test(l.trim())) out.append(h('p.revfoot', l.trim().slice(1, -1)));
    else if (l.trim()) out.append(h('p', ...inline(l.replace(/ {2}$/, ''))));
    i++;
  }
  return out;
}

export const reverseTab: TabDef = {
  id: 'reverse',
  title: 'REVERSE',
  icon: '<path d="M4 7h11a4 4 0 010 8H9"/><path d="M7 11l-3 4 3 4"/><circle cx="18" cy="7" r="2"/>',
  scene: 'backdrop',
  blurb: 'see how any app or site works',
  mount(root) {
    if (!document.getElementById('reverse-css')) document.head.append(h('style#reverse-css', CSS));
    // The top says what it is for in his words, the same words as the Make hub's card (shell/hubcards.ts).
    const P = page(root, { tag: 'REVERSE', sub: 'Paste a link to a website, an app or a code package. Ghosty takes it apart and tells you what it is built with and what it talks to.', leftLabel: 'NEW REPORT', rightLabel: 'REPORTS', stack: true });

    // ---- new job
    const np = panel('TAKE SOMETHING APART', { grow: false });
    const target = h('input', { placeholder: 'A link, like bbc.co.uk', 'aria-label': 'What to look at', inputmode: 'url', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
    const kind = h('select', { 'aria-label': 'What is it' }, ...KINDS.map(([v, l]) => h('option', { value: v }, l)));
    const question = h('input', { placeholder: 'What do you want to know? (optional)', 'aria-label': 'Question' });
    const startBtn = button('START', () => void start(), 'on');
    // What START did, kept on screen under it (a toast is gone before it is read); the brain's words, as a sentence.
    const say = h('div.note.revsay', { role: 'status', 'aria-live': 'polite', hidden: true });
    const tell = (msg: string) => {
      say.textContent = sentence(msg);
      say.hidden = !msg;
    };
    // Reverse runs on GitHub: without it nothing can start, so that is said before he types, with the way to fix it.
    const connect = asWritten(button('CONNECT GITHUB', () => go('system'), 'on'), 'Connect GitHub');
    const gh = h('div.revgh', { hidden: true }, h('p', 'GitHub is not connected yet, so a report cannot start. Reverse runs on GitHub’s free computers: add a free GitHub token once in System → Keys.'), connect);
    const start = async () => {
      const t = target.value.trim();
      if (!t) return void tell('Paste a link first, like bbc.co.uk');
      tell('');
      startBtn.disabled = true;
      try {
        const r = await brain.reverseStart({ target: t, kind: kind.value, question: question.value.trim() });
        target.value = '';
        question.value = '';
        await refresh();
        // the new report, waiting, in place: when to expect it and that he can go
        void show(r.job.id, true);
      } catch (e) {
        const msg = String((e as Error).message ?? e);
        tell(msg);
        if (/GitHub token/i.test(msg)) gh.hidden = false;
      } finally {
        startBtn.disabled = false;
      }
    };
    target.addEventListener('keydown', (e) => e.key === 'Enter' && void start());
    np.body.append(
      gh,
      target,
      h('div.row', kind, startBtn),
      say,
      question,
      h('div.note', 'A website: what it is built with, the other companies it talks to, and how well it is locked down. An app or a code package: what is inside and what it connects to.'),
      h('div.note', h('b', 'Only analyse software you own or are allowed to test.'), ' Free: it runs on GitHub’s computers, not this phone. Uses REA by morluto (MIT licence).'),
    );

    // ---- jobs
    const jp = panel('YOUR REPORTS', { status: '', footer: true });
    const list = h('div.stackf');
    jp.body.append(list);
    let jobs: ReverseJobInfo[] = [];
    let open: string | null = null;
    const viewer = panel('REPORT', { status: '', cls: 'revview' });
    viewer.el.hidden = true;
    const paint = () => {
      clear(list);
      if (!jobs.length) {
        list.append(h('div.empty', h('b', 'No reports yet'), h('span', 'Paste a link above to begin.')));
        jp.setStatus('None yet', 'off');
        return;
      }
      const busy = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;
      jp.setStatus(`${jobs.length} ${jobs.length === 1 ? 'report' : 'reports'}${busy ? ` · ${busy} running` : ''}`, 'ok');
      for (const j of jobs) {
        const tone = j.status === 'done' ? 'up' : j.status === 'failed' ? 'bad' : '';
        const r = h('div.rw.link', { onclick: () => void show(j.id, true), tabIndex: 0, role: 'button', onkeydown: (e: KeyboardEvent) => e.key === 'Enter' && void show(j.id, true) },
          h('span.sev', { style: `color:${j.status === 'done' ? 'var(--ok)' : j.status === 'failed' ? 'var(--r)' : 'var(--a)'};background:currentColor` }),
          h('span.k', { dataset: { case: 'keep' } }, KIND_WORD[j.kind] ?? 'Link'),
          h('span.v', j.target.replace(/^https?:\/\//, '').replace(/\/$/, '')),
          h('span.n', { class: `n${tone ? ` ${tone}` : ''}` }, STATE_WORD[j.status](j)),
        );
        if (j.id === open) r.classList.add('on');
        list.append(r);
      }
    };
    // SAVE TO LIBRARY: the report filed there and then (the brain's /library/text, no AI), said in place.
    const saveToLibrary = async (job: ReverseJobInfo & { report?: string }, name: string, b: HTMLButtonElement, savedLine: HTMLElement) => {
      const title = `Reverse report: ${name}`;
      b.disabled = true;
      savedLine.hidden = false;
      savedLine.textContent = 'Saving…';
      // the words, not REA's raw data (thousands of characters of JSON that would only clutter a search)
      const text = plainTimes(job.report ?? '').replace(/```[\s\S]*?```/g, '(raw data left out; it is in the report in Reverse)');
      try {
        const r = await fetch('/api/library/text', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ title, text, kind: 'note', source: `Reverse · ${job.target}` }), credentials: 'same-origin' });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? `the brain answered ${r.status}`);
        clear(savedLine, `Saved in the Library as “${title}”. `, button('OPEN LIBRARY', () => go('library')));
      } catch (e) {
        savedLine.textContent = navigator.onLine === false ? 'You’re offline, so it could not be saved. Try again when you’re back.' : `Could not save it: ${String((e as Error).message ?? e)}`;
        b.disabled = false;
      }
    };
    const show = async (id: string, bring = false) => {
      open = id;
      paint();
      viewer.el.hidden = false;
      clear(viewer.body);
      viewer.body.append(h('div.note', 'Loading…'));
      // On the phone the report sits under the form and the list: a tap brings it on screen (it opened out of sight).
      // After it is drawn: "Loading…" alone is too short for the page to scroll that far.
      const bringIn = () => bring && viewer.el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      try {
        const { job } = await brain.reverseJob(id);
        clear(viewer.body);
        viewer.setStatus(STATE_WORD[job.status](job).replace(/ ·.*/, ''), job.status === 'done' ? 'ok' : job.status === 'failed' ? 'off' : 'mid');
        // the name as written (example.com, not "Example.com"), what it is and when
        const name = job.target.replace(/^https?:\/\//, '').replace(/\/$/, '');
        viewer.body.append(h('div.revhead', h('b', name), h('span', `${KIND_WORD[job.kind] ?? 'Link'} · ${job.status === 'done' && job.finishedAt ? `made ${day(job.finishedAt)}` : `asked for ${day(job.at)}`}${job.question ? ` · “${job.question}”` : ''}`)));
        if (job.status === 'done' && job.report) {
          const savedLine = h('div.note.revsaved', { role: 'status', hidden: true });
          viewer.body.append(
            h('div.row.wrap',
              button('ASK GHOSTY', () => {
                go('core');
                void send(`Read the reverse-engineering report for ${job.target} (job ${job.id}) with reverse_status and tell me the most useful findings${job.question ? `, especially: ${job.question}` : ''}.`);
              }, 'on'),
              button('SAVE TO LIBRARY', (b) => void saveToLibrary(job, name, b, savedLine)),
              job.runUrl ? asWritten(button('SEE IT ON GITHUB ↗', () => window.open(job.runUrl, '_blank', 'noopener')), 'See it on GitHub ↗') : null,
            ),
            savedLine,
            renderMd(job.report),
          );
        } else if (job.status === 'failed') {
          // what happened, in words, and the same thing asked again with one tap
          const why = h('div.note.revsay', { role: 'status', hidden: true });
          const again = button('TRY AGAIN', async (b) => {
            b.disabled = true;
            try {
              const r = await brain.reverseStart({ target: job.target, kind: job.kind, question: job.question });
              await refresh();
              void show(r.job.id, true);
            } catch (e) {
              why.textContent = sentence(String((e as Error).message ?? e));
              why.hidden = false;
              b.disabled = false;
            }
          }, 'on');
          viewer.body.append(
            h('div.empty.revwait', h('b', 'This one didn’t finish'), h('span', sentence(job.error ?? 'GitHub did not say why'))),
            h('div.row.wrap', again, job.runUrl ? asWritten(button('SEE WHAT HAPPENED ↗', () => window.open(job.runUrl, '_blank', 'noopener')), 'See what happened on GitHub ↗') : null),
            why,
          );
        } else {
          // A run takes 3–8 minutes; the brain looks again after six and sends what it found (tools/reverse.ts).
          const late = Date.now() - job.at > 8 * 60_000;
          viewer.body.append(
            h('div.empty.revwait',
              h('b', { dataset: { case: 'keep' } }, job.status === 'queued' ? 'Starting on GitHub…' : 'Taking it apart…'),
              h('span', late ? `Started at ${clock(job.at)}. It is taking longer than usual; it keeps going for up to 15 minutes.` : `Started at ${clock(job.at)}, ready by about ${clock(job.at + 8 * 60_000)}.`),
              h('span', 'You can leave this screen: Ghosty tells you when it is ready, and it will be here.'),
            ),
            job.runUrl ? asWritten(button('WATCH ON GITHUB ↗', () => window.open(job.runUrl, '_blank', 'noopener')), 'Watch on GitHub ↗') : '',
          );
        }
        const k = jobs.findIndex((x) => x.id === id);
        if (k >= 0) jobs[k] = { ...jobs[k]!, status: job.status, error: job.error, runUrl: job.runUrl };
        paint();
        bringIn();
      } catch (e) {
        clear(viewer.body);
        viewer.body.append(h('div.note', String((e as Error).message ?? e)));
        bringIn();
      }
    };
    const refresh = async () => {
      try {
        jobs = (await brain.reverseJobs()).jobs;
        paint();
        // nudge running jobs so they update from GitHub
        const running = jobs.filter((j) => j.status === 'running' || j.status === 'queued').slice(0, 3);
        for (const j of running) {
          const { job } = await brain.reverseJob(j.id);
          const k = jobs.findIndex((x) => x.id === j.id);
          if (k >= 0) jobs[k] = { ...jobs[k]!, status: job.status, error: job.error, runUrl: job.runUrl };
          if (job.status === 'done' && open === j.id) void show(j.id);
        }
        paint();
      } catch {
        jp.setStatus('OFFLINE', 'off');
      }
    };
    jp.foot!.append(button('REFRESH', () => void refresh()));

    P.left.append(np.el, jp.el);
    P.right.append(viewer.el);
    P.big.textContent = 'See how any app works';
    let timer = 0;
    return {
      enter() {
        void refresh();
        void brain.status().then((st) => (gh.hidden = st.repoReady)).catch(() => undefined);
        timer = window.setInterval(() => jobs.some((j) => j.status === 'running' || j.status === 'queued') && void refresh(), 30000);
      },
      leave() {
        clearInterval(timer);
      },
      describe: () => `Reverse tab: ${jobs.length} jobs (${jobs.filter((j) => j.status === 'done').length} reports)${open ? `, viewing ${open}` : ''}.`,
    };
  },
};
