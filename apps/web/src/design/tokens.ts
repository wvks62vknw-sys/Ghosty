/**
 * The design system's tokens as data, read from tokens.css's own text (BRIEF-DESIGN-SYSTEM): each token with its name, its
 * value as written, its one-line job (the comment beside it) and the group it sits in; and each theme's accent block. Pure, no
 * DOM: Settings → THE LOOK lists every token from it (so the screen can never disagree with the file), and
 * apps/edge/test/look.test.mjs holds the file to its rules with it.
 */
export interface Token {
  /** "--g-canvas" */
  name: string;
  /** As written in the file ("#101317", "600 34px/40px var(--g-font-display)"). */
  value: string;
  /** The comment beside it: what it is for. */
  job: string;
  /** The heading it sits under ("colour: the surfaces (graphite, lit)"). */
  group: string;
}

export interface ThemeBlock {
  /** "ember" */
  key: string;
  /** The selector as written (":root[data-theme="ember"], [data-accent="ember"]"). */
  selector: string;
  values: Record<string, string>;
}

/** The tokens a theme swaps, and nothing else (the accent block). */
export const ACCENT_BLOCK = ['--g-accent', '--g-accent-rgb', '--g-accent-pale', '--g-accent-pale-rgb', '--g-accent-text', '--g-accent-glow'] as const;

/** The first `:root { … }` block of the file: every token, its job and its group, in the file's order. */
export function parseTokens(css: string): Token[] {
  const start = css.search(/^:root\s*\{/m);
  if (start < 0) return [];
  const end = css.indexOf('\n}', start);
  const body = css.slice(css.indexOf('{', start) + 1, end < 0 ? undefined : end);
  const out: Token[] = [];
  let group = '';
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const head = /^\/\*\s*-{3,}\s*(.+?)\s*\*\/$/.exec(line);
    if (head) {
      group = head[1]!;
      continue;
    }
    const m = /^(--g-[a-z0-9-]+)\s*:\s*(.+?);\s*(?:\/\*\s*(.*?)\s*\*\/)?$/.exec(line);
    if (m) out.push({ name: m[1]!, value: m[2]!, job: m[3] ?? '', group });
  }
  return out;
}

/** Every theme's accent block: `:root[data-theme="<key>"], [data-accent="<key>"] { … }`. */
export function parseThemes(css: string): ThemeBlock[] {
  const out: ThemeBlock[] = [];
  for (const m of css.matchAll(/^(:root\[data-theme="([a-z]+)"\][^{]*)\{([^}]*)\}/gm)) {
    const values: Record<string, string> = {};
    for (const d of m[3]!.split(';')) {
      const kv = /^\s*(--g-[a-z0-9-]+)\s*:\s*(.+?)\s*$/.exec(d.replace(/\/\*[\s\S]*?\*\//g, ''));
      if (kv) values[kv[1]!] = kv[2]!;
    }
    out.push({ key: m[2]!, selector: m[1]!.trim(), values });
  }
  return out;
}

/** A type token's parts: "600 34px/40px var(--g-font-display)" → weight 600, size 34, line 40, family. */
export function typeParts(value: string): { weight: number; size: number; line: number; family: string } | null {
  const m = /^(\d{3})\s+(\d+(?:\.\d+)?)px\/(\d+(?:\.\d+)?)px\s+(.+)$/.exec(value.trim());
  return m ? { weight: Number(m[1]), size: Number(m[2]), line: Number(m[3]), family: m[4]! } : null;
}
