/**
 * RECON card on the Threats tab: passive infrastructure recon of a domain, host, IP address or
 * web address through the brain (GET /api/recon: dns.google, rdap.org, crt.sh, archive.org,
 * ipwho.is, Shodan's InternetDB, hackertarget and one ordinary page request). The report opens
 * with WHAT STANDS OUT (a few plain lines, worst first), then the sections with the source named;
 * SAVE TO LIBRARY files its Markdown, ASK GHOSTY opens the chat with a prepared question.
 * Infrastructure only — the brain refuses a person's name or an email address and says why.
 */
import type { ReconReport } from '../../../../../packages/shared/src/recon';
import { headers } from '../../api/brain';
import { send } from '../../assistant/session';
import { clear, h } from '../../core/dom';
import { go } from '../../shell/tabs';
import { button, panel, row, toast } from '../../ui/components';
import { askPrompt, failedCount, reconError, reconTitle, reportRows, runningText, standout, summaryLine, type ViewRow } from './reconview';

/** An error already in plain words (the brain's answer, said by reconError). */
class Said extends Error {}
const RECORD = /^(A|AAAA|CNAME|MX|NS|TXT|CAA|PTR|HTTP|DNS)$/;
const IDLE = 'Passive lookups of public records: DNS, registration, certificates, subdomains, the Wayback Machine, hosting and one page request. Infrastructure only — Ghosty refuses names and email addresses.';

export function reconPanel(): HTMLElement {
  const p = panel('RECON', { grow: false, footer: true, cls: 'recon' });
  const input = h('input', { placeholder: 'domain, host, IP or URL', 'aria-label': 'Recon target', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', inputmode: 'url', enterkeyhint: 'go' });
  const runBtn = button('RUN', () => void run(), 'on');
  const status = h('div.reconstatus', IDLE);
  const out = h('div.reconout');
  const save = button('SAVE TO LIBRARY', () => void saveReport());
  const ask = button('ASK GHOSTY ABOUT THIS', () => askGhosty(), 'warn');
  save.disabled = ask.disabled = true;
  p.foot!.append(save, ask);
  p.body.append(h('div.row', input, runBtn), status, out);

  let current: { report: ReconReport; markdown: string } | null = null;
  let running = false;

  const rowOf = (x: ViewRow): HTMLElement => {
    const r = row(x.k, x.v, x.n ?? null, { wrap: true, ...(x.tone ? { tone: x.tone } : {}) });
    // DNS record types (AAAA, MX) and source names (crt.sh) keep their own case; plain words are cased as usual
    const k = r.querySelector<HTMLElement>('.k');
    if (k && (RECORD.test(x.k) || /[a-z]/.test(x.k))) k.dataset.case = 'keep';
    return r;
  };
  const paint = (r: ReconReport) => {
    clear(out);
    // first, the report in plain words; then every section with its source
    const plain = standout(r);
    if (plain.length) {
      out.append(h('div.lab', 'What stands out', h('small', 'in plain words')));
      for (const x of plain) {
        const r = row(x.tone === 'bad' ? '!' : x.tone === 'up' ? '✓' : '·', x.v, null, { wrap: true });
        r.classList.add('plain', ...(x.tone ? [x.tone] : []));
        out.append(r);
      }
    }
    for (const s of reportRows(r)) {
      out.append(h('div.lab', s.title, h('small', s.source)));
      if (!s.ok) {
        out.append(h(`div.note${s.skipped ? '' : '.bad'}` as 'div', s.error));
        continue;
      }
      for (const x of s.rows) out.append(rowOf(x));
    }
  };

  const run = async () => {
    const target = input.value.trim();
    if (!target) return void toast('Type a domain, host, IP address or web address first', 'warn');
    if (running) return;
    running = true;
    runBtn.disabled = true;
    save.disabled = ask.disabled = true;
    const t0 = Date.now();
    p.setStatus('RUNNING', 'mid');
    status.className = 'reconstatus live';
    const tick = () => (status.textContent = runningText(target, Date.now() - t0));
    tick();
    const timer = window.setInterval(tick, 250);
    // RUN again on a target whose last run had silent sources asks the sources again instead of showing the kept report.
    const same = (a: string, b: string) => a.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '') === b.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const fresh = !!current && same(current.report.target, target) && failedCount(current.report) > 0;
    // (a run takes 5–15 s; after a minute with no answer it stops and says so instead of ticking for ever)
    const ctl = new AbortController();
    const limit = window.setTimeout(() => ctl.abort(), 60_000);
    try {
      const r = await fetch(`/api/recon?target=${encodeURIComponent(target)}${fresh ? '&fresh=1' : ''}`, { headers: headers(), credentials: 'same-origin', signal: ctl.signal });
      const j = (await r.json().catch(() => null)) as { report?: ReconReport; markdown?: string; error?: string } | null;
      if (!r.ok || !j?.report || typeof j.markdown !== 'string') throw new Said(reconError(null, r.status, j?.error ?? ''));
      current = { report: j.report, markdown: j.markdown };
      paint(j.report);
      const failed = failedCount(j.report);
      status.textContent = summaryLine(j.report);
      status.className = failed ? 'reconstatus bad' : 'reconstatus';
      p.setStatus(failed ? `${failed} SOURCE${failed === 1 ? '' : 'S'} SILENT` : 'DONE', failed ? 'mid' : 'ok');
      p.el.classList.remove('fx');
      p.el.classList.add('open');
      save.disabled = ask.disabled = false;
    } catch (e) {
      clear(out);
      current = null;
      status.textContent = e instanceof Said ? e.message : reconError(e);
      status.className = 'reconstatus bad';
      p.setStatus('FAILED', 'off');
    } finally {
      clearTimeout(limit);
      clearInterval(timer);
      running = false;
      runBtn.disabled = false;
    }
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && void run());

  const saveReport = async () => {
    if (!current) return;
    save.disabled = true;
    try {
      const title = reconTitle(current.report);
      const r = await fetch('/api/library/text', {
        method: 'POST',
        headers: headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ title, text: current.markdown, kind: 'recon', source: `recon of ${current.report.target}` }),
      });
      const j = (await r.json().catch(() => null)) as { error?: string; title?: string } | null;
      if (!r.ok) throw new Said(reconError(null, r.status, j?.error ?? ''));
      toast(`Saved to the library: ${j?.title ?? title}`, 'ok');
    } catch (e) {
      toast(e instanceof Said ? e.message : reconError(e), 'bad');
    } finally {
      save.disabled = false;
    }
  };

  const askGhosty = () => {
    if (!current) return;
    go('core');
    void send(askPrompt(current.report));
  };

  return p.el;
}
