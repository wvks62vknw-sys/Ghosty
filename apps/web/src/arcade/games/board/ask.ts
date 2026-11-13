/**
 * Asking the board Worker for a decision, the way poker and the word game do (the four board games' shell has its own copy of this
 * for its search): one message out, one answer back; the Worker is started on the first ask, and if it will not start (or dies)
 * the same decision is worked out on the page by `fallback`, so a table is never left waiting on a Worker.
 */
export class Asker {
  private worker: Worker | null = null;
  bad = false;
  private waiting = new Map<number, { ok: (d: any) => void; msg: Record<string, unknown> }>();
  private n = 0;
  private lex: ArrayBuffer | null = null;
  constructor(private fallback: (m: any) => any, private url = '/board.worker.js') {}
  private start(): Worker | null {
    if (this.worker || this.bad) return this.worker;
    try {
      const w = new Worker(this.url);
      w.onmessage = (e: MessageEvent<{ id: number }>) => {
        const f = this.waiting.get(e.data.id);
        this.waiting.delete(e.data.id);
        f?.ok(e.data);
      };
      w.onerror = () => {
        this.bad = true;
        this.worker = null;
        for (const [k, f] of this.waiting) {
          f.ok(this.fallback(f.msg));
          this.waiting.delete(k);
        }
      };
      this.worker = w;
      if (this.lex) w.postMessage({ id: ++this.n, kind: 'lex', bytes: this.lex.slice(0) });
    } catch {
      this.bad = true;
      this.worker = null;
    }
    return this.worker;
  }
  /** The word list, handed to the Worker once (it keeps it). */
  setLex(bytes: ArrayBuffer): void {
    this.lex = bytes;
    this.worker?.postMessage({ id: ++this.n, kind: 'lex', bytes: bytes.slice(0) });
  }
  ask<T>(msg: Record<string, unknown>): Promise<T> {
    const w = this.start();
    if (!w) return new Promise((ok) => setTimeout(() => ok(this.fallback(msg) as T), 0));
    return new Promise((ok) => {
      const id = ++this.n;
      this.waiting.set(id, { ok, msg });
      w.postMessage({ id, ...msg });
    });
  }
  /** Whether the Worker is the one answering (false until the first ask, or if it would not start). */
  get working(): boolean {
    return !!this.worker && !this.bad;
  }
  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.waiting.clear();
  }
}
