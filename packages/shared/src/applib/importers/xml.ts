/**
 * A small streaming XML reader (SAX style) for his own data exports. It is fed text in chunks and calls back for each
 * element as it goes, so a health export of several gigabytes is read without ever holding the whole file: only the
 * unread tail of the last chunk is kept. It skips the prolog, comments and an inline DOCTYPE with its internal subset.
 */
export interface SaxHandler {
  /** Asked before an element's attributes are read: say false to skip the work for elements you never use. */
  wants?(name: string): boolean;
  open?(name: string, attrs: Record<string, string>, selfClosing: boolean): void;
  close?(name: string): void;
  /** Text between tags, entities decoded (whitespace-only runs are not reported). */
  text?(text: string): void;
}

const ENT: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
/** XML entities decoded: the five named ones and numeric references. */
export function decodeEntities(s: string): string {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENT[e] ?? m;
  });
}

const ATTR = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
/** The attributes of a start tag's body (after its name). */
export function readAttrs(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTR.lastIndex = 0;
  for (let m = ATTR.exec(body); m; m = ATTR.exec(body)) out[m[1]!] = decodeEntities(m[2] ?? m[3] ?? '');
  return out;
}

/** The end of a start tag from `from` (the index of its '>'), skipping '>' inside quoted values; -1 if not in buf yet. */
function tagEnd(buf: string, from: number): number {
  let q = '';
  for (let i = from; i < buf.length; i++) {
    const c = buf[i];
    if (q) { if (c === q) q = ''; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '>') return i;
  }
  return -1;
}

export class Sax {
  private buf = '';
  private done = false;
  constructor(private h: SaxHandler) {}

  /** Feeds the next chunk of text. */
  push(chunk: string): void {
    this.buf = this.buf ? this.buf + chunk : chunk;
    this.run();
  }

  /** The end of the text: whatever is left is read as it stands. */
  end(): void {
    this.run();
    const rest = this.buf.trim();
    if (rest && this.h.text && rest[0] !== '<') this.h.text(decodeEntities(rest));
    this.buf = '';
    this.done = true;
  }

  private run(): void {
    if (this.done) return;
    const b = this.buf;
    const h = this.h;
    let pos = 0;
    for (;;) {
      const lt = b.indexOf('<', pos);
      if (lt < 0) break;
      if (lt > pos && h.text) {
        const t = b.slice(pos, lt);
        if (t.trim()) h.text(decodeEntities(t));
      }
      pos = lt;
      const c1 = b.charCodeAt(lt + 1);
      if (Number.isNaN(c1)) break;
      if (c1 === 33 /* ! */) {
        if (b.startsWith('<!--', lt)) {
          const e = b.indexOf('-->', lt + 4);
          if (e < 0) break;
          pos = e + 3;
        } else if (b.startsWith('<![CDATA[', lt)) {
          const e = b.indexOf(']]>', lt + 9);
          if (e < 0) break;
          if (h.text) h.text(b.slice(lt + 9, e));
          pos = e + 3;
        } else {
          // <!DOCTYPE …> with an optional [internal subset]
          const gt = b.indexOf('>', lt);
          const br = b.indexOf('[', lt);
          if (gt < 0) break;
          if (br >= 0 && br < gt) {
            const close = b.indexOf(']', br);
            if (close < 0) break;
            const e = b.indexOf('>', close);
            if (e < 0) break;
            pos = e + 1;
          } else pos = gt + 1;
        }
        continue;
      }
      if (c1 === 63 /* ? */) {
        const e = b.indexOf('?>', lt + 2);
        if (e < 0) break;
        pos = e + 2;
        continue;
      }
      if (c1 === 47 /* / */) {
        const e = b.indexOf('>', lt + 2);
        if (e < 0) break;
        if (h.close) h.close(b.slice(lt + 2, e).trim());
        pos = e + 1;
        continue;
      }
      const e = tagEnd(b, lt + 1);
      if (e < 0) break;
      let body = b.slice(lt + 1, e);
      const self = body.endsWith('/');
      if (self) body = body.slice(0, -1);
      let n = 0;
      while (n < body.length && !/\s/.test(body[n]!)) n++;
      const name = body.slice(0, n);
      if (!h.wants || h.wants(name)) {
        if (h.open) h.open(name, n < body.length ? readAttrs(body.slice(n)) : {}, self);
        if (self && h.close) h.close(name);
      }
      pos = e + 1;
    }
    this.buf = pos ? b.slice(pos) : b;
  }
}
