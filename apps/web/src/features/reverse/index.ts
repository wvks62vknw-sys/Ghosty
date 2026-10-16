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
import { button, panel, toast } from '../../ui/components';
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

const KINDS: [string, string][] = [['auto', 'Work it out'], ['web', 'Website'], ['npm', 'npm package'], ['repo', 'GitHub project'], ['artifact', 'App file (.apk .dll .exe .zip …)']];

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
  blurb: 'reverse-engineer apps, sites & packages',
  mount(root) {
    if (!document.getElementById('reverse-css')) document.head.append(h('style#reverse-css', CSS));
    const P = page(root, { tag: 'REVERSE // ENGINEERING', sub: 'REA runs on GitHub’s computers; the findings come back here', leftLabel: 'NEW JOB', rightLabel: 'REPORTS', stack: true });

    // ---- new job
    const np = panel('REVERSE-ENGINEER SOMETHING', { grow: false });
    const target = h('input', { placeholder: 'https://example.com  ·  lodash  ·  owner/repo  ·  https://…/app.apk', 'aria-label': 'Target', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
    const kind = h('select', { 'aria-label': 'What is it' }, ...KINDS.map(([v, l]) => h('option', { value: v }, l)));
    const question = h('input', { placeholder: 'What do you want to know? (optional)', 'aria-label': 'Question' });
    const startBtn = button('START', () => void start(), 'on');
    const start = async () => {
      const t = target.value.trim();
      if (!t) return void toast('Paste a link, a package name or owner/repo first', 'warn');
      startBtn.disabled = true;
      try {
        const r = await brain.reverseStart({ target: t, kind: kind.value, question: question.value.trim() });
        toast(`Started · ${r.job.kind} · takes 3–8 min`, 'ok');
        target.value = '';
        question.value = '';
        await refresh();
      } catch (e) {
        toast(String((e as Error).message ?? e), 'bad');
      } finally {
        startBtn.disabled = false;
      }
    };
    target.addEventListener('keydown', (e) => e.key === 'Enter' && void start());
    np.body.append(
      target,
      h('div.row', kind, startBtn),
      question,
      h('div.note', 'Websites: structure, scripts, frameworks, API endpoints, security headers and the web bundle. Packages and projects: files, dependencies, entry points and REA’s full JavaScript analysis. App files: format, strings, URLs inside, Android packages and .NET assemblies. Native code decompiling needs Ghidra — ask Ghosty if you want it.'),
      h('div.note', h('b', 'Only analyse software you own or are allowed to test.'), ' REA by morluto, MIT licence.'),
    );

    // ---- jobs
    const jp = panel('JOBS', { status: '', footer: true });
    const list = h('div.stackf');
    jp.body.append(list);
    let jobs: ReverseJobInfo[] = [];
    let open: string | null = null;
    const viewer = panel('REPORT', { status: '' });
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
        const r = h('div.rw.link', { onclick: () => void show(j.id) },
          h('span.sev', { style: `color:${j.status === 'done' ? 'var(--ok)' : j.status === 'failed' ? 'var(--r)' : 'var(--a)'};background:currentColor` }),
          h('span.k', j.kind),
          h('span.v', j.target.replace(/^https?:\/\//, '')),
          h('span.n', { class: `n${tone ? ` ${tone}` : ''}` }, j.status === 'done' ? 'REPORT' : j.status === 'failed' ? 'FAILED' : `${j.status.toUpperCase()} · ${fmt.ago(j.at)}`),
        );
        if (j.id === open) r.classList.add('on');
        list.append(r);
      }
    };
    const show = async (id: string) => {
      open = id;
      paint();
      viewer.el.hidden = false;
      clear(viewer.body);
      viewer.body.append(h('div.note', 'Loading…'));
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
          viewer.body.append(h('div.empty', h('b', job.status === 'queued' ? 'WAITING FOR GITHUB' : 'RUNNING ON GITHUB'), h('span', `started ${fmt.ago(job.at)} · usually 3–8 minutes`)), job.runUrl ? button('WATCH ON GITHUB ↗', () => window.open(job.runUrl, '_blank', 'noopener')) : '');
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
    P.big.textContent = 'REA';
    let timer = 0;
    return {
      enter() {
        void refresh();
        timer = window.setInterval(() => jobs.some((j) => j.status === 'running' || j.status === 'queued') && void refresh(), 30000);
      },
      leave() {
        clearInterval(timer);
      },
      describe: () => `Reverse tab: ${jobs.length} jobs (${jobs.filter((j) => j.status === 'done').length} reports)${open ? `, viewing ${open}` : ''}.`,
    };
  },
};
