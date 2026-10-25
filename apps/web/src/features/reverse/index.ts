/**
 * REVERSE tab: reverse-engineer software with REA (Reverse Engineer Anything), run for you
 * on GitHub's free computers. Paste a link — a website, an npm package, a public GitHub
 * project or a direct file link (.apk, .dll, .exe, .zip, .asar, .jar) — and the report
 * arrives here (and as a notification) a few minutes later. Lawful research only.
 */
import { brain, type ReverseJobInfo } from '../../api/brain';
import { send } from '../../assistant/session';
import { clear, fmt, h } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { button, panel } from '../../ui/components';
import { page } from '../../ui/page';

const CSS = `
.mdreport { font-size: 12.5px; line-height: 1.5; }
.mdreport h2 { font: 500 11px var(--m); letter-spacing: .3em; color: var(--c); text-transform: uppercase; margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(var(--cr), .2); }
.mdreport h3 { font: 500 9px var(--m); letter-spacing: .24em; color: var(--a); text-transform: uppercase; margin: 12px 0 4px; }
.mdreport p { margin: 4px 0; } .mdreport ul { margin: 4px 0; padding-left: 16px; } .mdreport li { margin: 2px 0; word-break: break-word; }
.mdreport code { font: 400 11px var(--m); color: var(--a); background: rgba(var(--ar), .08); padding: 0 3px; }
.mdreport pre { font: 400 10.5px/1.4 var(--m); color: #cfe9f7; background: rgba(0,0,0,.45); padding: 8px 10px; overflow: auto; max-height: 50vh; white-space: pre; border-left: 2px solid rgba(var(--cr), .4); }
.mdreport .warnnote { border-left: 2px solid var(--a); padding-left: 8px; }
.mdreport hr { border: 0; border-top: 1px solid rgba(var(--cr), .15); margin: 10px 0; }
#pg-reverse .rw.link.on { box-shadow: inset 2px 0 0 var(--a); background: linear-gradient(90deg, rgba(var(--ar), .14), transparent); }
`;

/** 14:08, on this phone's clock. */
const clock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
/** A button shown with its words as written ("GitHub", not the sentence case that would make it "Github"). */
const asWritten = (b: HTMLButtonElement, words: string) => ((b.dataset.label = words), b);

const KINDS: [string, string][] = [['auto', 'Ghosty can tell what it is'], ['web', 'A website'], ['npm', 'A code package (npm)'], ['repo', 'A GitHub project'], ['artifact', 'An app file (.apk, .exe, .zip…)']];

/** Tiny markdown → DOM for the report (headings, code blocks, lists, bold, inline code). */
function renderMd(md: string): HTMLElement {
  const out = h('div.mdreport');
  const lines = md.split('\n');
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
      const pre = h('pre', buf.join('\n').slice(0, 40000));
      out.append(pre);
      continue;
    }
    if (/^#{1,3} /.test(l)) {
      const lvl = l.match(/^#+/)![0].length;
      out.append(h(lvl === 1 ? 'h2' : 'h3', ...inline(l.replace(/^#+ /, ''))));
    } else if (/^[-*] /.test(l)) {
      const ul = h('ul');
      while (i < lines.length && /^[-*] /.test(lines[i]!)) ul.append(h('li', ...inline(lines[i++]!.slice(2))));
      out.append(ul);
      continue;
    } else if (/^> /.test(l)) out.append(h('div.note.warnnote', ...inline(l.slice(2))));
    else if (l.trim() === '---') out.append(h('hr'));
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
      say.textContent = msg ? `${msg.charAt(0).toUpperCase()}${msg.slice(1)}${/[.!?)]$/.test(msg) ? '' : '.'}` : '';
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
    const jp = panel('JOBS', { status: '', footer: true });
    const list = h('div.stackf');
    jp.body.append(list);
    let jobs: ReverseJobInfo[] = [];
    let open: string | null = null;
    const viewer = panel('REPORT', { status: '', cls: 'revview' });
    viewer.el.hidden = true;
    const paint = () => {
      clear(list);
      if (!jobs.length) {
        list.append(h('div.empty', h('b', 'NO JOBS YET'), h('span', 'Paste something above to begin.')));
        jp.setStatus('IDLE', 'off');
        return;
      }
      jp.setStatus(`${jobs.filter((j) => j.status === 'running' || j.status === 'queued').length} RUNNING · ${jobs.length} TOTAL`, 'ok');
      for (const j of jobs) {
        const tone = j.status === 'done' ? 'up' : j.status === 'failed' ? 'bad' : '';
        const r = h('div.rw.link', { onclick: () => void show(j.id, true), tabIndex: 0, role: 'button', onkeydown: (e: KeyboardEvent) => e.key === 'Enter' && void show(j.id, true) },
          h('span.sev', { style: `color:${j.status === 'done' ? 'var(--ok)' : j.status === 'failed' ? 'var(--r)' : 'var(--a)'};background:currentColor` }),
          h('span.k', j.kind),
          h('span.v', j.target.replace(/^https?:\/\//, '')),
          h('span.n', { class: `n${tone ? ` ${tone}` : ''}` }, j.status === 'done' ? 'REPORT' : j.status === 'failed' ? 'FAILED' : `${j.status.toUpperCase()} · ${fmt.ago(j.at)}`),
        );
        if (j.id === open) r.classList.add('on');
        list.append(r);
      }
    };
    const show = async (id: string, bring = false) => {
      open = id;
      paint();
      viewer.el.hidden = false;
      clear(viewer.body);
      viewer.body.append(h('div.note', 'Loading…'));
      // On the phone the report sits under the form and the list: a tap brings it on screen (it opened out of sight).
      if (bring) viewer.el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      try {
        const { job } = await brain.reverseJob(id);
        clear(viewer.body);
        viewer.title.textContent = job.target.replace(/^https?:\/\//, '').slice(0, 40).toUpperCase();
        viewer.setStatus(job.status.toUpperCase(), job.status === 'done' ? 'ok' : job.status === 'failed' ? 'off' : 'mid');
        if (job.status === 'done' && job.report) {
          viewer.body.append(
            h('div.row.wrap',
              button('ASK GHOSTY', () => {
                go('core');
                void send(`Read the reverse-engineering report for ${job.target} (job ${job.id}) with reverse_status and tell me the most useful findings${job.question ? `, especially: ${job.question}` : ''}.`);
              }, 'warn'),
              button('SAVE TO LIBRARY', () => {
                go('core');
                void send(`Save the reverse-engineering report for ${job.target} (job ${job.id}) into the library so I can search it later: read it with reverse_status and library_import the text.`);
              }),
              job.runUrl ? button('GITHUB ↗', () => window.open(job.runUrl, '_blank', 'noopener')) : null,
            ),
            renderMd(job.report),
          );
        } else if (job.status === 'failed') {
          viewer.body.append(h('div.note', job.error ?? 'failed'), job.runUrl ? button('SEE THE RUN ↗', () => window.open(job.runUrl, '_blank', 'noopener')) : '');
        } else {
          // A run takes 3–8 minutes; the brain looks again after six and sends what it found (tools/reverse.ts).
          const late = Date.now() - job.at > 8 * 60_000;
          viewer.body.append(
            h('div.empty.revwait',
              h('b', job.status === 'queued' ? 'Starting on GitHub…' : 'Taking it apart…'),
              h('span', late ? `Started at ${clock(job.at)}. It is taking longer than usual; it keeps going for up to 15 minutes.` : `Started at ${clock(job.at)}, ready by about ${clock(job.at + 8 * 60_000)}.`),
              h('span', 'You can leave this screen: Ghosty tells you when it is ready, and it will be here.'),
            ),
            job.runUrl ? asWritten(button('WATCH ON GITHUB ↗', () => window.open(job.runUrl, '_blank', 'noopener')), 'Watch on GitHub ↗') : '',
          );
        }
        const k = jobs.findIndex((x) => x.id === id);
        if (k >= 0) jobs[k] = { ...jobs[k]!, status: job.status, error: job.error, runUrl: job.runUrl };
        paint();
      } catch (e) {
        clear(viewer.body);
        viewer.body.append(h('div.note', String((e as Error).message ?? e)));
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
