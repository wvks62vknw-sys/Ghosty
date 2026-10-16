/**
 * Fast checks on a self-edit BEFORE it becomes a change, so Ghosty gets precise feedback in
 * seconds instead of a failed build minutes later. Not a compiler — it catches the mistakes
 * free models actually make:
 *  - unbalanced brackets / unterminated strings
 *  - imports of files that don't exist, or of names those files don't export
 *  - blocks of code pasted in twice, or the same name declared twice
 *  - placeholder comments ("// ... existing code") that silently delete the rest of a file
 *  - a whole file accidentally replaced by a fraction of itself
 *  - npm package imports (none are installed), innerHTML with dynamic text, eval
 *  - a new tab that isn't registered, a feed host the proxy will refuse
 *  - invalid JSON
 * The full typecheck, build and browser run still happen in CI.
 */

export interface Staged {
  path: string;
  /** New content, or null when the file is deleted. */
  content: string | null;
  /** Content before the change (null for a new file). */
  before: string | null;
}

type Reader = (path: string) => Promise<string | null>;

/** Bracket balance, skipping strings, template literals, comments and regex-ish literals. */
export function bracketProblem(src: string): string | null {
  const stack: { ch: string; line: number }[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  let line = 1;
  let i = 0;
  const tmpl: number[] = []; // stack depth where each open template literal's ${ began
  let prevSig = '';
  while (i < src.length) {
    const c = src[i]!;
    const n = src[i + 1];
    if (c === '\n') line++;
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) return `unterminated /* comment starting on line ${line}`;
      line += src.slice(i, end).split('\n').length - 1;
      i = end + 2;
      continue;
    }
    if (c === '/' && /[(,=:[!&|?{};>+\-*%~<^]$|^$|(return|typeof|case|in|of)$/.test(prevSig)) {
      // a regex literal: skip to its end
      let j = i + 1;
      let cls = false;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') cls = true;
        else if (src[j] === ']') cls = false;
        else if (src[j] === '/' && !cls) break;
        j++;
      }
      if (src[j] === '/') {
        i = j + 1;
        prevSig = 'x';
        continue;
      }
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') j++;
        else if (src[j] === '\n') return `unterminated string on line ${line}`;
        j++;
      }
      i = j + 1;
      prevSig = 'x';
      continue;
    }
    if (c === '`' || (c === '}' && tmpl.length && tmpl[tmpl.length - 1] === stack.length)) {
      // inside a template literal (fresh, or resuming after a ${ … })
      if (c === '}') tmpl.pop();
      let j = i + 1;
      let opened = false;
      while (j < src.length) {
        if (src[j] === '\\') {
          j += 2;
          continue;
        }
        if (src[j] === '\n') line++;
        if (src[j] === '`') break;
        if (src[j] === '$' && src[j + 1] === '{') {
          tmpl.push(stack.length);
          opened = true;
          j += 2;
          break;
        }
        j++;
      }
      if (j >= src.length) return `unterminated template string starting on line ${line}`;
      i = opened ? j : j + 1;
      prevSig = opened ? '{' : 'x';
      continue;
    }
    if (c === '(' || c === '[' || c === '{') stack.push({ ch: c, line });
    else if (c === ')' || c === ']' || c === '}') {
      const top = stack.pop();
      if (!top) return `unexpected "${c}" on line ${line} (nothing open)`;
      if (top.ch !== pairs[c]) return `"${c}" on line ${line} closes "${top.ch}" from line ${top.line}`;
    }
    if (!/\s/.test(c)) prevSig = /[\w$]/.test(c) ? (prevSig.endsWith('return') ? 'return' : /[\w$]$/.test(prevSig) ? prevSig + c : c) : c;
    i++;
  }
  if (stack.length) return `"${stack[stack.length - 1]!.ch}" opened on line ${stack[stack.length - 1]!.line} is never closed`;
  return null;
}

/** Runs of 6+ meaningful lines that appear more often than they did before the change. */
export function duplicatedBlocks(after: string, before: string | null): string | null {
  if (before === null) return null; // only judge edits to existing files
  const sig = (s: string) =>
    s
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 3 && !/^[{}()[\];,]*$/.test(l) && !l.startsWith('//') && !l.startsWith('*') && !/^import /.test(l));
  const count = (lines: string[]) => {
    const m = new Map<string, number>();
    for (let i = 0; i + 6 <= lines.length; i++) {
      const k = lines.slice(i, i + 6).join('\n');
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const a = count(sig(after));
  const b = before ? count(sig(before)) : new Map<string, number>();
  for (const [k, n] of a) {
    if (n > 1 && n > (b.get(k) ?? 0)) return `the same lines appear ${n} times (starting with "${k.split('\n')[0]!.slice(0, 80)}"). It looks like code was pasted in twice — keep one copy.`;
  }
  return null;
}

/** Placeholder comments (an ellipsis, "rest of the file", "existing code"): written into a file, they replace the real code. */
const PLACEHOLDER = /^\s*(?:\/\/|\/\*|\{\/\*|<!--)\s*(?:\.\.\.|…|.{0,24}\b(?:rest of (?:the )?(?:file|code|component|function|class|module|tabs|items|list|styles)|(?:existing|remaining|previous|other) code|code (?:remains |stays |is )?unchanged|same as before|keep (?:the )?existing)\b)/i;

export function placeholderProblem(after: string, before: string | null): string | null {
  const count = (t: string) => t.split('\n').filter((l) => PLACEHOLDER.test(l)).length;
  const hit = after.split('\n').find((l) => PLACEHOLDER.test(l));
  if (hit && count(after) > (before === null ? 0 : count(before))) {
    return `contains a placeholder comment ("${hit.trim().slice(0, 60)}"). The file would literally contain that instead of the code it stands for. Write the real code, or use "replace" edits so the rest of the file stays as it is.`;
  }
  return null;
}

/**
 * Where template-literal text and comments are (start, end offsets), so code examples
 * inside strings or comments are not mistaken for real imports or declarations.
 * Same lexing rules as bracketProblem.
 */
export function literalRanges(src: string): [number, number][] {
  const out: [number, number][] = [];
  const depth: number[] = []; // brace depth at which each open template's ${ began
  let braces = 0;
  let prevSig = '';
  let i = 0;
  const template = (from: number) => {
    // scan template text from `from` until the closing backtick or a ${
    let j = from;
    while (j < src.length) {
      if (src[j] === '\\') {
        j += 2;
        continue;
      }
      if (src[j] === '`') {
        out.push([from, j]);
        return j + 1;
      }
      if (src[j] === '$' && src[j + 1] === '{') {
        out.push([from, j]);
        depth.push(braces);
        braces++;
        return j + 2;
      }
      j++;
    }
    out.push([from, src.length]);
    return src.length;
  };
  while (i < src.length) {
    const c = src[i]!;
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      const e = src.indexOf('\n', i);
      const end = e < 0 ? src.length : e;
      out.push([i, end]);
      i = end;
      continue;
    }
    if (c === '/' && n === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e < 0 ? src.length : e + 2;
      out.push([i, end]);
      i = end;
      continue;
    }
    if (c === '/' && /[(,=:[!&|?{};>+\-*%~<^]$|^$|(return|typeof|case|in|of)$/.test(prevSig)) {
      let j = i + 1;
      let cls = false;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') cls = true;
        else if (src[j] === ']') cls = false;
        else if (src[j] === '/' && !cls) break;
        j++;
      }
      if (src[j] === '/') {
        i = j + 1;
        prevSig = 'x';
        continue;
      }
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') j++;
        j++;
      }
      i = j + 1;
      prevSig = 'x';
      continue;
    }
    if (c === '`') {
      i = template(i + 1);
      prevSig = 'x';
      continue;
    }
    if (c === '{') braces++;
    if (c === '}') {
      braces--;
      if (depth.length && depth[depth.length - 1] === braces) {
        depth.pop();
        i = template(i + 1);
        prevSig = 'x';
        continue;
      }
    }
    if (!/\s/.test(c)) prevSig = /[\w$]/.test(c) ? (prevSig.endsWith('return') ? 'return' : /[\w$]$/.test(prevSig) ? prevSig + c : c) : c;
    i++;
  }
  return out;
}

/** The source with template-literal text and comments blanked out (offsets and line numbers kept). */
export function codeOnly(src: string): string {
  let out = '';
  let at = 0;
  for (const [a, b] of literalRanges(src)) {
    out += src.slice(at, a) + src.slice(a, b).replace(/[^\n]/g, ' ');
    at = b;
  }
  return out + src.slice(at);
}

/** An existing file that lost most of its lines: almost always a "write" that meant to change one part. */
export function shrinkProblem(after: string, before: string | null): string | null {
  if (before === null) return null;
  const a = after.split('\n').length;
  const b = before.split('\n').length;
  if (b >= 60 && a < b * 0.3) {
    return `would shrink from ${b} to ${a} lines. If you meant to change only part of it, use "replace" edits instead of "write" (a "write" replaces the WHOLE file). To really remove most of it, do it with "replace" edits so each removal is deliberate.`;
  }
  return null;
}

/** Top-level declarations (column 0) that appear more often than before: TS2451 "Cannot redeclare". */
export function duplicateDeclarations(after: string, before: string | null): string | null {
  const names = (t: string) => {
    const m = new Map<string, number>();
    for (const x of t.matchAll(/^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:const|let|var|class|enum|function\*?)\s+([A-Za-z_$][\w$]*)[^\n]*$/gm)) {
      // function overload signatures end with ";" and are legal repeats
      if (/^(?:export\s+)?(?:declare\s+)?(?:async\s+)?function/.test(x[0]) && /\)\s*(?::[^{]*)?;\s*$/.test(x[0])) continue;
      m.set(x[1]!, (m.get(x[1]!) ?? 0) + 1);
    }
    return m;
  };
  const a = names(codeOnly(after));
  const b = before === null ? new Map<string, number>() : names(codeOnly(before));
  for (const [n, c] of a) if (c > 1 && c > (b.get(n) ?? 0)) return `declares "${n}" ${c} times at the top level (TypeScript error "Cannot redeclare"). An edit probably added code that already exists — keep one.`;
  return null;
}

/** Interface-only rules: no innerHTML/outerHTML/insertAdjacentHTML with dynamic text, no eval. */
export function unsafeDomProblem(after: string, before: string | null): string | null {
  const risky = (t: string) =>
    t.split('\n').filter((l) => (/\.(innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML\s*\(/.test(l) && /(\$\{|\+\s*[A-Za-z_$(]|=\s*[A-Za-z_$][\w$]*\.[\w$.]+\s*;?\s*$)/.test(l)) || /(^|[^\w$.])(eval|new\s+Function)\s*\(/.test(l)).length;
  if (risky(codeOnly(after)) > (before === null ? 0 : risky(codeOnly(before)))) {
    return 'puts dynamic text into innerHTML/outerHTML/insertAdjacentHTML, or uses eval/new Function. Build elements with h() and set text with textContent (fetched text in innerHTML is a security hole, and the security policy blocks eval).';
  }
  return null;
}

const CODE = /\.(ts|tsx|mts|js|mjs)$/;

function resolveImport(from: string, spec: string, exists: (p: string) => boolean): string | null {
  const dir = from.split('/').slice(0, -1);
  const parts = [...dir];
  for (const seg of spec.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  const base = parts.join('/');
  const tries = /\.(js|mjs|ts|json|css)$/.test(base) ? [base, base.replace(/\.js$/, '.ts')] : [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}.js`, `${base}.mjs`, base];
  return tries.find(exists) ?? null;
}

function exportedNames(src: string): Set<string> | 'any' {
  if (/export\s*\*\s*from/.test(src)) return 'any';
  const out = new Set<string>();
  for (const m of src.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]!);
  for (const m of src.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)) {
    for (const part of m[1]!.split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) out.add(name.replace(/^type\s+/, ''));
    }
  }
  if (/export\s+default/.test(src)) out.add('default');
  return out;
}

/**
 * All problems found in a staged change. `tree` is every path in the base version;
 * `read` reads a file from the base version.
 */
export async function selfCheck(staged: Staged[], tree: string[], read: Reader): Promise<string[]> {
  const problems: string[] = [];
  const changed = new Map(staged.map((s) => [s.path, s]));
  const exists = (p: string) => (changed.has(p) ? changed.get(p)!.content !== null : tree.includes(p));
  const contentOf = async (p: string) => (changed.has(p) ? changed.get(p)!.content : await read(p));
  let lookups = 0;
  for (const s of staged) {
    if (s.content === null) {
      // deleting a file other files still import?
      continue;
    }
    // Third-party libraries served as-is (Leaflet, MapLibre) are not Ghosty's code to judge — only that one folder.
    if (s.path.startsWith('apps/web/public/vendor/')) continue;
    if (/\.json$/.test(s.path)) {
      try {
        JSON.parse(s.content);
      } catch (e) {
        problems.push(`${s.path}: invalid JSON (${String((e as Error).message).slice(0, 100)})`);
      }
      continue;
    }
    if (CODE.test(s.path) || /\.css$/.test(s.path)) {
      const prep = (t: string) => (/\.css$/.test(s.path) ? t.replace(/"[^"\n]*"|'[^'\n]*'/g, '""') : t);
      const b = bracketProblem(prep(s.content));
      // If this checker can't parse the original either, trust CI instead of guessing.
      if (b && !(s.before !== null && bracketProblem(prep(s.before)))) problems.push(`${s.path}: ${b}`);
      const d = duplicatedBlocks(s.content, s.before);
      if (d) problems.push(`${s.path}: ${d}`);
    }
    if (CODE.test(s.path) || /\.(css|html|md)$/.test(s.path)) {
      for (const check of [placeholderProblem, shrinkProblem]) {
        const p = check(s.content, s.before);
        if (p) problems.push(`${s.path}: ${p}`);
      }
    }
    if (!CODE.test(s.path)) continue;
    const dup = duplicateDeclarations(s.content, s.before);
    if (dup) problems.push(`${s.path}: ${dup}`);
    if (s.path.startsWith('apps/web/src/')) {
      const u = unsafeDomProblem(s.content, s.before);
      if (u) problems.push(`${s.path}: ${u}`);
    }
    const bare = (t: string | null) => new Set([...codeOnly(t ?? '').matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"\n]*?from\s*['"]([^'".][^'"]*)['"]|(?:^|\n)\s*import\s*['"]([^'".][^'"]*)['"]/g)].map((m) => m[1] ?? m[2] ?? ''));
    const before = bare(s.before);
    for (const spec of /^(apps\/(web|edge)\/src|packages)\//.test(s.path) ? bare(s.content) : []) {
      if (spec && !before.has(spec) && !/^(cloudflare|node):/.test(spec)) problems.push(`${s.path}: imports the package "${spec}", but no npm packages are installed (and adding them is not possible). Write the code yourself, or import from a file in this repository with a relative path ("./" or "../").`);
    }
    const code = codeOnly(s.content);
    for (const m of code.matchAll(/(?:^|[\n;])\s*(?:import|export)\s+(type\s+)?(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}\s*)?(?:\*\s+as\s+[\w$]+\s*)?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const [, typeOnly, , names, spec] = m;
      const target = resolveImport(s.path, spec!, exists);
      if (!target) {
        problems.push(`${s.path}: imports "${spec}", but no such file exists. Create it in the same change (action "write"), or fix the path.`);
        continue;
      }
      if (!names || typeOnly || !CODE.test(target) || lookups > 25) continue;
      lookups++;
      const src = await contentOf(target);
      if (src === null) continue;
      const exp = exportedNames(src);
      if (exp === 'any') continue;
      for (const raw of names.split(',')) {
        const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim();
        if (!name || raw.trim().startsWith('type ')) continue;
        if (!exp.has(name)) problems.push(`${s.path}: imports { ${name} } from "${spec}", but ${target} does not export "${name}".`);
      }
    }
  }
  // A new tab file that nothing registers: it would never appear.
  for (const s of staged) {
    const m = s.path.match(/^apps\/web\/src\/features\/([\w-]+)\/index\.ts$/);
    if (!m || s.before !== null || s.content === null) continue;
    const tabsFile = await contentOf('apps/web/src/features/index.ts');
    if (tabsFile !== null && !tabsFile.includes(`./${m[1]}'`) && !tabsFile.includes(`./${m[1]}"`)) {
      problems.push(`${s.path} is a new tab, but apps/web/src/features/index.ts does not import it or list it in TABS. Add both in the same change.`);
    }
  }
  // Interface feeds go through /api/proxy, which only allows hosts in FEED_HOSTS.
  const webFetches = staged.filter((s) => s.content && s.path.startsWith('apps/web/src/') && CODE.test(s.path));
  if (webFetches.length) {
    const index = await contentOf('apps/edge/src/index.ts');
    // every host listed in FEED_HOSTS or in a *_HOSTS / FEED_PREFIXES list it is built from
    const lists = [...(index ?? '').matchAll(/(?:FEED_HOSTS\s*=\s*new Set\(\[|[A-Z_]*HOSTS\s*=\s*\[|FEED_PREFIXES\s*=\s*\[)([\s\S]*?)\]/g)].map((m) => m[1]!.replace(/\/\/[^\n]*/g, '')).join(' ');
    const allowed = new Set([...lists.matchAll(/['"]([^'"/]+)[^'"]*['"]/g)].map((m) => m[1]!));
    if (allowed.size) {
      for (const s of webFetches) {
        const hosts = (t: string | null) => new Set([...(t ?? '').matchAll(/fetch(?:Json|Text)\s*(?:<[^>]*>)?\s*\(\s*['"`]https:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]!.toLowerCase()));
        const old = hosts(s.before);
        for (const host of hosts(s.content)) {
          if (!allowed.has(host) && !old.has(host)) {
            problems.push(`${s.path} fetches from ${host}, but the feed proxy only allows hosts listed in FEED_HOSTS (apps/edge/src/index.ts), so it would always fail with "host not allowed". That file is part of the protected kernel: ask the owner to unlock the kernel and add "${host}" to FEED_HOSTS in this same change, or use a host that is already allowed.`);
          }
        }
      }
    }
  }
  // A deleted file that something else still imports.
  for (const s of staged.filter((x) => x.content === null)) {
    const stem = s.path.replace(/\.(ts|tsx|js|mjs)$/, '').replace(/\/index$/, '');
    for (const o of staged) {
      if (o.content && o.content.includes(stem.split('/').pop()!) && resolveImport(o.path, `./${stem.split('/').pop()}`, (p) => p === s.path)) {
        problems.push(`${o.path} may still import ${s.path}, which this change deletes.`);
      }
    }
  }
  return problems;
}
