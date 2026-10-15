/**
 * Splitting long text into passages for Ghosty's library. Shared by the interface (which
 * reads uploaded files) and the brain (which imports web pages), so both cut text the
 * same way. A passage is ~1,200 characters, cut at paragraph or sentence ends, and keeps
 * the nearest heading and page so search results say where they came from.
 */
export interface Passage {
  text: string;
  /** Nearest heading above the passage (section title, file name for code). */
  heading?: string;
  /** Page number (PDFs) or chapter number (books), if known. */
  page?: number;
}

export const PASSAGE_CHARS = 1200;
const OVERLAP = 150;

/** Pages (or one whole text) → passages. Markdown headings (#) and SHOUTED lines count as headings. */
export function chunkText(pages: string[] | string, opts: { code?: boolean; heading?: string } = {}): Passage[] {
  const list = typeof pages === 'string' ? [pages] : pages;
  const out: Passage[] = [];
  let heading = opts.heading;
  list.forEach((pageText, pi) => {
    const page = list.length > 1 ? pi + 1 : undefined;
    const text = normalise(pageText);
    if (!text) return;
    if (opts.code) {
      // code: ~60 lines per passage, on blank lines where possible
      const lines = text.split('\n');
      let buf: string[] = [];
      const flush = () => {
        const t = buf.join('\n').trim();
        if (t) out.push({ text: t, heading, page });
        buf = [];
      };
      for (const line of lines) {
        buf.push(line);
        if ((buf.length >= 60 && !line.trim()) || buf.length >= 90) flush();
      }
      flush();
      return;
    }
    let buf = '';
    let carried = 0; // characters at the start of buf repeated from the previous passage
    const flush = () => {
      const t = buf.trim();
      if (t.length - carried > 20) out.push({ text: t, heading, page });
      buf = t.length > OVERLAP * 2 ? tail(t) : '';
      carried = buf.length;
    };
    for (const para of text.split(/\n{2,}/)) {
      const p = para.trim();
      if (!p) continue;
      const h = p.match(/^#{1,6}\s+(.{2,120})$/) ?? (p.length < 90 && !/[.!?:,;]$/.test(p) && /^[A-Z0-9][A-Z0-9 \-–:'&/().]{3,}$/.test(p) ? [p, p] : null);
      if (h && !p.includes('\n')) {
        if (buf.trim().length > 200) flush();
        heading = h[1]!.trim();
        buf += `${p}\n\n`;
        continue;
      }
      if (buf.length + p.length > PASSAGE_CHARS && buf.trim()) flush();
      if (p.length > PASSAGE_CHARS) {
        for (const piece of sentences(p)) {
          if (buf.length + piece.length > PASSAGE_CHARS && buf.trim()) flush();
          buf += `${piece} `;
        }
        buf += '\n\n';
      } else buf += `${p}\n\n`;
    }
    if (buf.trim().length - carried > 20) out.push({ text: buf.trim(), heading, page });
  });
  return out;
}

function normalise(t: string): string {
  return t
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(\w)-\n(\w)/g, '$1$2') // words hyphenated across lines (PDFs)
    .trim();
}

/** The last ~OVERLAP characters, starting at a word boundary — carried into the next passage. */
function tail(t: string): string {
  const s = t.slice(-OVERLAP);
  const i = s.indexOf(' ');
  return i >= 0 ? `${s.slice(i + 1)} ` : '';
}

function sentences(p: string): string[] {
  const parts = p.match(/[^.!?]+(?:[.!?]+["')\]]*\s*|$)/g) ?? [p];
  const out: string[] = [];
  for (const s of parts) {
    if (s.length <= PASSAGE_CHARS) out.push(s.trim());
    else for (let i = 0; i < s.length; i += PASSAGE_CHARS - 100) out.push(s.slice(i, i + PASSAGE_CHARS - 100));
  }
  return out.filter(Boolean);
}
