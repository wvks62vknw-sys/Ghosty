/**
 * Runs on a GitHub runner (see .github/workflows/reverse.yml). Takes JOB, TARGET, KIND and
 * QUESTION from the environment, works out what the target is, runs the REA commands that
 * fit it plus Ghosty's own baseline analysis (so there is always a useful report even when
 * REA cannot handle the target), and writes reverse-out/report.md + report.json.
 *
 * Kinds: web (a website), npm (a package on npm), repo (a public GitHub repository),
 * artifact (a downloadable file: .apk .dll .exe .zip .asar .tgz .jar ...).
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const JOB = process.env.JOB || 'job';
const TARGET = (process.env.TARGET || '').trim();
const QUESTION = (process.env.QUESTION || '').trim();
let KIND = (process.env.KIND || 'auto').trim();
const OUT = path.resolve('reverse-out');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'rea-'));
fs.mkdirSync(OUT, { recursive: true });

const report = { job: JOB, target: TARGET, kind: KIND, question: QUESTION, startedAt: new Date().toISOString(), sections: [], errors: [] };
const md = [];
const section = (title, body, data) => {
  report.sections.push({ title, body: String(body).slice(0, 120000), data });
  md.push(`\n## ${title}\n\n${body}\n`);
};
const fail = (what, e) => {
  const msg = String(e?.stderr || e?.message || e).slice(0, 2000);
  report.errors.push({ what, error: msg });
  md.push(`\n> ${what}: ${msg.trim().split('\n').filter(Boolean).slice(0, 3).join(' · ')}\n`);
};
const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: opts.timeout ?? 10 * 60_000, cwd: opts.cwd });
  if (r.error) throw r.error;
  if (r.status !== 0) throw Object.assign(new Error(`${cmd} ${args.join(' ')} exited ${r.status}`), { stderr: (r.stderr || '').slice(-4000) });
  return r.stdout;
};
/** Run one REA command; add its (pretty) JSON to the report. Returns parsed JSON or null. */
const rea = (title, args, opts) => {
  try {
    const out = sh('rea', [...args, '--format', 'json'], opts);
    let data;
    try {
      data = JSON.parse(out);
    } catch {
      data = out;
    }
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    section(`REA · ${title}`, '```json\n' + text.slice(0, 60000) + (text.length > 60000 ? '\n… (truncated)' : '') + '\n```', typeof data === 'string' ? undefined : data);
    return data;
  } catch (e) {
    fail(`REA ${title} (rea ${args.join(' ')})`, e);
    // Record the command's own help so a wrong invocation is easy to correct next time.
    try {
      const help = spawnSync('rea', [args[0], '--help'], { encoding: 'utf8', timeout: 60_000 });
      report.errors.push({ what: `help: rea ${args[0]}`, error: `${help.stdout || ''}\n${help.stderr || ''}`.slice(0, 4000) });
    } catch {
      /* no help available */
    }
    return null;
  }
};

// ---------------------------------------------------------------------------
// What is the target?
// ---------------------------------------------------------------------------
const isUrl = /^https?:\/\//i.test(TARGET);
const url = isUrl ? new URL(TARGET) : null;
const ext = url ? path.extname(url.pathname).toLowerCase() : '';
const FILE_EXT = ['.apk', '.aab', '.dll', '.exe', '.zip', '.asar', '.tgz', '.tar.gz', '.jar', '.ipa', '.dmg', '.wasm', '.so', '.dylib', '.elf', '.bin', '.img', '.nupkg', '.xpi', '.crx'];
if (KIND === 'auto') {
  if (url && /^(www\.)?github\.com$/i.test(url.hostname) && url.pathname.split('/').filter(Boolean).length >= 2 && !FILE_EXT.includes(ext)) KIND = 'repo';
  else if (url && (FILE_EXT.includes(ext) || url.pathname.endsWith('.tar.gz'))) KIND = 'artifact';
  else if (url) KIND = 'web';
  else if (/^[\w.-]+\/[\w.-]+$/.test(TARGET)) KIND = 'repo';
  else if (/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(TARGET)) KIND = 'npm';
  else KIND = 'web';
}
report.kind = KIND;
md.push(`# Reverse engineering report\n\n**Target:** ${TARGET}  \n**Kind:** ${KIND}  \n**Started:** ${report.startedAt}${QUESTION ? `  \n**Question:** ${QUESTION}` : ''}\n`);

const fetchText = async (u, max = 3 * 1024 * 1024) => {
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Ghosty-reverse/1.0)' }, redirect: 'follow' });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, headers: Object.fromEntries(r.headers), text: buf.subarray(0, max).toString('utf8'), bytes: buf.length, finalUrl: r.url };
};
const download = async (u, to) => {
  const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Ghosty-reverse/1.0)' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`download failed: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 400 * 1024 * 1024) throw new Error('file larger than 400 MB');
  fs.writeFileSync(to, buf);
  return buf.length;
};
const listFiles = (dir, max = 400) => {
  const out = [];
  const walk = (d, depth) => {
    if (out.length >= max || depth > 6) return;
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      if (n.name === 'node_modules' || n.name === '.git') continue;
      const p = path.join(d, n.name);
      if (n.isDirectory()) walk(p, depth + 1);
      else {
        out.push({ path: path.relative(dir, p), bytes: fs.statSync(p).size });
        if (out.length >= max) return;
      }
    }
  };
  walk(dir, 0);
  return out;
};

// ---------------------------------------------------------------------------
// Baseline analyses (always run; no engines needed)
// ---------------------------------------------------------------------------
async function baselineWeb(u) {
  const page = await fetchText(u);
  const html = page.text;
  const pick = (re) => [...html.matchAll(re)].map((m) => m[1]).filter(Boolean);
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  const scripts = pick(/<script[^>]+src=["']([^"']+)["']/gi).slice(0, 80);
  const styles = pick(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi).slice(0, 40);
  const metas = pick(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/gi);
  const forms = [...html.matchAll(/<form[^>]*>/gi)].map((m) => m[0]).slice(0, 20);
  const abs = (s) => {
    try {
      return new URL(s, page.finalUrl).href;
    } catch {
      return s;
    }
  };
  const hosts = new Set();
  for (const s of [...scripts, ...styles]) {
    try {
      hosts.add(new URL(abs(s)).hostname);
    } catch {
      /* relative */
    }
  }
  // peek into the first-party scripts for API routes and services
  const endpoints = new Set();
  const services = new Set();
  const SIGS = [
    ['React', /react(?:-dom)?(?:\.production)?\.min\.js|__REACT_DEVTOOLS|react\.createElement|_jsxRuntime/i],
    ['Next.js', /__NEXT_DATA__|_next\/static/i],
    ['Vue', /vue(?:\.runtime)?\.min\.js|__vue__|createApp\(/i],
    ['Nuxt', /__NUXT__/i],
    ['Angular', /ng-version|angular/i],
    ['Svelte', /svelte/i],
    ['jQuery', /jquery/i],
    ['Google Analytics / GTM', /googletagmanager|google-analytics|gtag\(/i],
    ['Segment', /segment\.(io|com)/i],
    ['Sentry', /sentry\.io|@sentry/i],
    ['Stripe', /js\.stripe\.com/i],
    ['Cloudflare', /cdn-cgi|cloudflare/i],
    ['Firebase', /firebaseio|firebase/i],
    ['Supabase', /supabase/i],
    ['WordPress', /wp-content|wp-includes/i],
    ['Shopify', /cdn\.shopify\.com/i],
    ['Webflow', /webflow/i],
    ['Vite', /\/@vite\/|vite/i],
    ['webpack', /webpackJsonp|__webpack_require__/i],
  ];
  for (const [name, re] of SIGS) if (re.test(html)) services.add(name);
  let scanned = 0;
  for (const s of scripts.slice(0, 12)) {
    const su = abs(s);
    try {
      if (new URL(su).hostname !== new URL(page.finalUrl).hostname && !new URL(su).hostname.endsWith(new URL(page.finalUrl).hostname.split('.').slice(-2).join('.'))) continue;
      const js = (await fetchText(su, 2 * 1024 * 1024)).text;
      scanned++;
      for (const [name, re] of SIGS) if (re.test(js)) services.add(name);
      for (const m of js.matchAll(/["'`](\/(?:api|v\d|graphql|rest|rpc)[\w\-./?=&{}:]*)["'`]/g)) endpoints.add(m[1]);
      for (const m of js.matchAll(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:\/[\w\-./?=&%]*)?/gi)) {
        try {
          hosts.add(new URL(m[0]).hostname);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* skip */
    }
  }
  const sec = ['content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy'].map((h) => `- ${h}: ${page.headers[h] ? '✓ ' + String(page.headers[h]).slice(0, 120) : '✗ missing'}`);
  const body = [
    `- **Title:** ${title || '(none)'}`,
    `- **Final URL:** ${page.finalUrl} (HTTP ${page.status}, ${Math.round(page.bytes / 1024)} KB)`,
    `- **Server:** ${page.headers.server ?? '?'}  ·  **Powered by:** ${page.headers['x-powered-by'] ?? '?'}`,
    metas.length ? `- **Generator:** ${metas.join(', ')}` : null,
    `- **Technologies spotted:** ${[...services].join(', ') || 'none recognised'}`,
    `- **Scripts:** ${scripts.length} (${scanned} first-party scripts scanned)`,
    `- **Stylesheets:** ${styles.length}  ·  **Forms:** ${forms.length}`,
    `- **Third-party hosts:** ${[...hosts].filter((h) => h !== new URL(page.finalUrl).hostname).slice(0, 40).join(', ') || 'none'}`,
    `\n**API endpoints found in code (${endpoints.size}):**\n${[...endpoints].slice(0, 80).map((e) => `- \`${e}\``).join('\n') || '- none found'}`,
    `\n**Security headers:**\n${sec.join('\n')}`,
    scripts.length ? `\n**Script files:**\n${scripts.slice(0, 40).map((s) => `- ${abs(s)}`).join('\n')}` : null,
  ].filter(Boolean).join('\n');
  section('Site overview (Ghosty baseline)', body, { title, finalUrl: page.finalUrl, status: page.status, services: [...services], endpoints: [...endpoints], hosts: [...hosts], scripts: scripts.map(abs), headers: page.headers });
}

function baselineJs(dir) {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : null;
  const files = listFiles(dir, 600);
  const byExt = {};
  for (const f of files) {
    const e = path.extname(f.path) || '(none)';
    byExt[e] = (byExt[e] || 0) + 1;
  }
  const big = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 15);
  const deps = pkg ? Object.keys(pkg.dependencies || {}) : [];
  const devDeps = pkg ? Object.keys(pkg.devDependencies || {}) : [];
  const body = [
    pkg ? `- **Package:** ${pkg.name ?? '?'} ${pkg.version ?? ''} — ${pkg.description ?? ''}` : '- No package.json at the root',
    pkg ? `- **Licence:** ${pkg.license ?? '?'}  ·  **Entry:** ${pkg.main ?? pkg.module ?? pkg.exports ? JSON.stringify(pkg.main ?? pkg.module ?? pkg.exports).slice(0, 120) : '?'}  ·  **Bin:** ${pkg.bin ? JSON.stringify(pkg.bin).slice(0, 120) : 'none'}` : null,
    pkg ? `- **Scripts:** ${Object.keys(pkg.scripts || {}).join(', ') || 'none'}` : null,
    `- **Files:** ${files.length}${files.length >= 600 ? '+' : ''}  ·  by type: ${Object.entries(byExt).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([e, n]) => `${e} ${n}`).join(', ')}`,
    deps.length ? `\n**Dependencies (${deps.length}):** ${deps.slice(0, 60).join(', ')}` : null,
    devDeps.length ? `**Dev dependencies (${devDeps.length}):** ${devDeps.slice(0, 40).join(', ')}` : null,
    `\n**Largest files:**\n${big.map((f) => `- ${f.path} (${Math.round(f.bytes / 1024)} KB)`).join('\n')}`,
  ].filter(Boolean).join('\n');
  section('Package overview (Ghosty baseline)', body, { pkg: pkg ? { name: pkg.name, version: pkg.version, license: pkg.license, main: pkg.main, bin: pkg.bin, scripts: pkg.scripts, dependencies: pkg.dependencies } : null, files: files.length, byExt, largest: big });
}

function baselineArtifact(file) {
  const bytes = fs.statSync(file).size;
  const buf = fs.readFileSync(file);
  const magic = buf.subarray(0, 8).toString('hex');
  const kind = magic.startsWith('504b0304') ? 'ZIP container (apk/jar/ipa/docx/nupkg…)' : magic.startsWith('7f454c46') ? 'ELF executable' : magic.startsWith('4d5a') ? 'Windows PE (exe/dll)' : /^(feedface|cefaedfe|feedfacf|cffaedfe|cafebabe)/.test(magic) ? 'Mach-O / universal binary' : magic.startsWith('1f8b') ? 'gzip' : magic.startsWith('0061736d') ? 'WebAssembly' : 'unknown';
  // readable strings (a cheap but telling look inside)
  const strings = [];
  let cur = '';
  for (let i = 0; i < Math.min(buf.length, 40 * 1024 * 1024) && strings.length < 4000; i++) {
    const c = buf[i];
    if (c >= 32 && c < 127) cur += String.fromCharCode(c);
    else {
      if (cur.length >= 8) strings.push(cur);
      cur = '';
    }
  }
  const urls = [...new Set(strings.flatMap((s) => s.match(/https?:\/\/[^\s"'<>]{6,}/g) || []))].slice(0, 60);
  const interesting = strings.filter((s) => /(api[_-]?key|secret|token|password|bearer|authorization)/i.test(s)).slice(0, 30);
  const body = [
    `- **File:** ${path.basename(file)} (${Math.round(bytes / 1024)} KB)  ·  **SHA-256:** ${createHash('sha256').update(buf).digest('hex')}`,
    `- **Format:** ${kind} (magic ${magic})`,
    `- **Readable strings:** ${strings.length}${strings.length >= 4000 ? '+' : ''}`,
    urls.length ? `\n**URLs inside (${urls.length}):**\n${urls.map((u) => `- ${u}`).join('\n')}` : null,
    interesting.length ? `\n**Strings mentioning keys/tokens (${interesting.length}) — check these are not real secrets:**\n${interesting.map((s) => `- \`${s.slice(0, 160)}\``).join('\n')}` : null,
  ].filter(Boolean).join('\n');
  section('File overview (Ghosty baseline)', body, { bytes, magic, kind, urls, strings: strings.slice(0, 400) });
}

// ---------------------------------------------------------------------------
// A real browser for REA's web commands (they speak to Chrome over its debugging port)
// ---------------------------------------------------------------------------
const CDP = 'http://127.0.0.1:9222';
let chrome = null;
async function startChrome() {
  const bin = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'].find((b) => spawnSync('which', [b]).status === 0);
  if (!bin) throw new Error('no Chrome on this runner');
  chrome = spawn(bin, ['--headless=new', '--remote-debugging-port=9222', '--remote-allow-origins=*', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--user-data-dir=${path.join(WORK, 'chrome')}`, '--window-size=1366,900', 'about:blank'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${CDP}/json/version`);
      if (r.ok) return bin;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Chrome did not start');
}
async function openTab(u) {
  let r = await fetch(`${CDP}/json/new?${encodeURIComponent(u)}`, { method: 'PUT' });
  if (!r.ok) r = await fetch(`${CDP}/json/new?${encodeURIComponent(u)}`);
  const tab = await r.json();
  await new Promise((r) => setTimeout(r, 6000)); // let the page load and settle
  return tab.id;
}
function stopChrome() {
  try {
    if (chrome) process.kill(-chrome.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
try {
  if (KIND === 'web') {
    await baselineWeb(TARGET);
    try {
      await startChrome();
      let tid = await openTab(TARGET);
      const targets = rea('browser targets', ['list-browser-targets', CDP], { timeout: 60_000 });
      // Prefer the id REA reports for our page (shapes vary; search any array of objects with an id + url).
      const found = JSON.stringify(targets ?? '').match(/"id":"([^"]+)"[^}]*"url":"https?:\/\/[^"]*"/g) || [];
      const mine = found.map((f) => ({ id: /"id":"([^"]+)"/.exec(f)[1], url: /"url":"([^"]+)"/.exec(f)[1] })).find((t) => t.url.startsWith(TARGET.replace(/\/$/, '')) || TARGET.startsWith(t.url.replace(/\/$/, '')));
      if (mine) tid = mine.id;
      rea('web page', ['inspect-web-page', CDP, tid, '--observation-ms', '4000', '--include-json-body-shapes', '--include-storage-keys', '--include-console-text'], { timeout: 6 * 60_000 });
      rea('web bundle', ['analyze-web-bundle', CDP, tid, '--observation-ms', '4000', '--fetch-source-maps'], { timeout: 10 * 60_000 });
      rea('WebMCP tools', ['discover-webmcp-tools', CDP, tid], { timeout: 2 * 60_000 });
    } catch (e) {
      fail('browser for REA', e);
    } finally {
      stopChrome();
    }
  } else if (KIND === 'npm' || KIND === 'repo') {
    const dir = path.join(WORK, 'app');
    fs.mkdirSync(dir, { recursive: true });
    if (KIND === 'npm') {
      const tgz = sh('npm', ['pack', TARGET, '--pack-destination', WORK], { timeout: 3 * 60_000 }).trim().split('\n').pop();
      sh('tar', ['-xzf', path.join(WORK, tgz), '-C', dir, '--strip-components=1']);
    } else {
      const repoUrl = isUrl ? `https://github.com/${url.pathname.split('/').filter(Boolean).slice(0, 2).join('/')}.git` : `https://github.com/${TARGET}.git`;
      sh('git', ['clone', '--depth', '1', repoUrl, dir], { timeout: 5 * 60_000 });
    }
    baselineJs(dir);
    rea('JavaScript application', ['analyze-javascript-application', dir], { timeout: 10 * 60_000 });
  } else if (KIND === 'artifact') {
    const file = path.join(WORK, path.basename(url ? url.pathname : TARGET) || 'artifact.bin');
    await download(TARGET, file);
    baselineArtifact(file);
    rea('artifact', ['inspect-artifact', file], { timeout: 8 * 60_000 });
    if (/\.(apk|aab)$/i.test(file)) rea('Android package', ['inspect-android-package', file], { timeout: 10 * 60_000 });
    if (/\.(dll|exe)$/i.test(file)) rea('.NET assembly', ['inspect-managed-artifact', file], { timeout: 8 * 60_000 });
    if (/\.(exe|elf|so|dylib|bin)$/i.test(file)) md.push('\n> Native code decompiling needs Ghidra on the runner (not installed: ~1 GB per run). Ask Ghosty if you want it added.\n');
  }
} catch (e) {
  fail('analysis', e);
}

report.finishedAt = new Date().toISOString();
md.push(`\n---\n_Finished ${report.finishedAt} · ${report.errors.length} problem(s) · REA by morluto (MIT) · for lawful research only_\n`);
fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n'));
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`report written: ${report.sections.length} sections, ${report.errors.length} problems`);
