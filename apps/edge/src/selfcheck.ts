/**
 * Fast checks on a self-edit BEFORE it becomes a change, so Ghosty gets precise feedback in
 * seconds instead of a failed build minutes later. Not a compiler — it catches the mistakes
 * free models actually make:
 *  - unbalanced brackets / unterminated strings
 *  - imports of files that don't exist, or of names those files don't export
 *  - blocks of code pasted in twice
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
    if (!CODE.test(s.path)) continue;
    for (const m of s.content.matchAll(/(?:import|export)\s+(type\s+)?(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}\s*)?(?:\*\s+as\s+[\w$]+\s*)?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
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
