/**
 * The database meter. Cloudflare's free plan lets the brain's database read 5,000,000 rows and
 * write 100,000 rows a day; past that every read and write throws until midnight UTC and
 * Ghosty's memory is paused. This counts what each part of Ghosty reads and writes — the
 * key-value storage and the library's SQL alike — so the System tab can show where the day's
 * allowance went, and background work (self-study, re-reading the code, the device mirror)
 * steps aside while the allowance runs low instead of pausing the whole brain.
 *
 * The counts live in memory and, every few minutes, in KV (which has its own allowance) —
 * never in the database they measure. Labels name the work ('chat', 'library.search',
 * 'study', …): the label in force when a read or write starts is the one it counts under.
 * Requests can interleave while one of them waits on the network, so a few counts may land
 * under a neighbour's label; the totals are exact.
 */

export const DAILY_READS = 5_000_000;
export const DAILY_WRITES = 100_000;
/** Above this fraction of either allowance, optional background work waits for the reset. */
export const SPARE_LEVEL = 0.7;

import type { DatabaseMeter as MeterSnapshot } from '../../../packages/shared/src/protocol';

export interface MeterCount {
  r: number;
  w: number;
}

interface KvLike {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

const todayUtc = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const resetAt = (now = Date.now()) => Math.floor(now / 86_400_000) * 86_400_000 + 86_400_000;
/** KV allows 1,000 writes a day on the free plan: the day's counts go there at most this often. */
const FLUSH_EVERY = 10 * 60_000;

/** A cursor of the SQL API: what the meter needs of it. */
interface CursorLike {
  rowsRead?: number;
  rowsWritten?: number;
  toArray(): unknown[];
  one(): unknown;
  raw?(): unknown;
  next?(): unknown;
  [Symbol.iterator]?(): Iterator<unknown>;
}

export class Meter {
  private day = todayUtc();
  private reads = 0;
  private writes = 0;
  private by = new Map<string, MeterCount>();
  /** The work being done right now (see the file comment). */
  label = 'other';
  private dirty = false;
  private lastFlush = 0;
  private loaded: Promise<void> | null = null;

  constructor(private kv?: KvLike | null) {}

  /** Count rows under `label` (or the label in force). */
  read(n: number, label = this.label): void {
    if (!(n > 0)) return;
    this.roll();
    this.reads += n;
    this.bump(label).r += n;
    this.dirty = true;
  }
  write(n: number, label = this.label): void {
    if (!(n > 0)) return;
    this.roll();
    this.writes += n;
    this.bump(label).w += n;
    this.dirty = true;
  }

  /** Run `fn` with the meter's label set, restoring it afterwards (also after a returned promise settles). */
  as<T>(label: string, fn: () => T): T {
    const prev = this.label;
    this.label = label;
    let out: T;
    try {
      out = fn();
    } catch (e) {
      this.label = prev;
      throw e;
    }
    if (out && typeof (out as { then?: unknown }).then === 'function') {
      return (out as unknown as Promise<unknown>).finally(() => (this.label = prev)) as unknown as T;
    }
    this.label = prev;
    return out;
  }

  /** How much of the day's allowance is gone: the larger of the two fractions. */
  level(): number {
    this.roll();
    return Math.max(this.reads / DAILY_READS, this.writes / DAILY_WRITES);
  }

  /** Is there room for optional work (self-study, mirrors) without risking the pause? */
  spare(): boolean {
    return this.level() < SPARE_LEVEL;
  }

  snapshot(): MeterSnapshot {
    this.roll();
    const by = [...this.by].map(([label, c]) => ({ label, r: c.r, w: c.w })).sort((a, b) => b.r + b.w * 50 - (a.r + a.w * 50));
    return { day: this.day, reads: this.reads, writes: this.writes, by: by.slice(0, 12), limits: { reads: DAILY_READS, writes: DAILY_WRITES }, level: this.level(), resetAt: resetAt() };
  }

  /** Take the day's counts kept in KV (once per lifetime), so a restart does not forget the morning. */
  load(): Promise<void> {
    if (this.loaded) return this.loaded;
    this.loaded = (async () => {
      if (!this.kv) return;
      try {
        const s = (await this.kv.get(`meter:${this.day}`, 'json')) as { reads?: number; writes?: number; by?: Record<string, MeterCount> } | null;
        if (!s || typeof s !== 'object') return;
        // Memory counts what happened since the restart; the copy has what happened before it.
        this.reads += Number(s.reads) || 0;
        this.writes += Number(s.writes) || 0;
        for (const [label, c] of Object.entries(s.by ?? {})) {
          const b = this.bump(label);
          b.r += Number(c?.r) || 0;
          b.w += Number(c?.w) || 0;
        }
        this.dirty = true;
        this.lastFlush = Date.now();
      } catch {
        /* KV unavailable: count from here */
      }
    })();
    return this.loaded;
  }

  /** Write the counts to KV when they changed and the last write is ten minutes old (or `force`). */
  async flush(force = false): Promise<void> {
    if (!this.kv || !this.dirty) return;
    if (!force && Date.now() - this.lastFlush < FLUSH_EVERY) return;
    this.roll();
    const by: Record<string, MeterCount> = {};
    for (const [k, v] of this.by) by[k] = v;
    this.dirty = false;
    this.lastFlush = Date.now();
    try {
      await this.kv.put(`meter:${this.day}`, JSON.stringify({ reads: this.reads, writes: this.writes, by, at: Date.now() }));
    } catch {
      this.dirty = true;
    }
  }

  /** Durable Object storage that counts: every key read or written is a row. */
  wrapStorage(storage: DurableObjectStorage): DurableObjectStorage {
    const m = this;
    const count = (what: 'r' | 'w', arg: unknown) => {
      const n = Array.isArray(arg) ? arg.length : arg && typeof arg === 'object' ? Object.keys(arg as object).length : 1;
      if (what === 'r') m.read(n);
      else m.write(n);
    };
    return new Proxy(storage, {
      get(target, prop, receiver) {
        if (prop === 'get') {
          return (keys: unknown, opts?: unknown) => {
            count('r', keys);
            return (target.get as (k: unknown, o?: unknown) => unknown)(keys, opts);
          };
        }
        if (prop === 'put') {
          return (keyOrEntries: unknown, value?: unknown, opts?: unknown) => {
            count('w', typeof keyOrEntries === 'string' ? 1 : keyOrEntries);
            return (target.put as (k: unknown, v?: unknown, o?: unknown) => unknown)(keyOrEntries, value, opts);
          };
        }
        if (prop === 'delete') {
          return (keys: unknown, opts?: unknown) => {
            count('w', keys);
            return (target.delete as (k: unknown, o?: unknown) => unknown)(keys, opts);
          };
        }
        if (prop === 'setAlarm') {
          // Cloudflare bills each setAlarm() as one row written.
          return (...a: unknown[]) => {
            m.write(1);
            return (target.setAlarm as (...x: unknown[]) => unknown)(...a);
          };
        }
        if (prop === 'list') {
          return async (opts?: unknown) => {
            const out = (await (target.list as (o?: unknown) => Promise<Map<string, unknown>>)(opts)) as Map<string, unknown>;
            m.read(out.size);
            return out;
          };
        }
        if (prop === 'sql') {
          const sql = target.sql as unknown;
          return sql ? m.wrapSql(sql as SqlStorage) : sql;
        }
        const v = Reflect.get(target, prop, receiver) as unknown;
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    });
  }

  /** The library's SQL, counted from each cursor's rowsRead / rowsWritten (statements count 1 where a cursor has no counters). */
  wrapSql(sql: SqlStorage): SqlStorage {
    const m = this;
    const wrapped: Partial<SqlStorage> & { exec: SqlStorage['exec'] } = {
      exec: <T = Record<string, SqlStorageValue>>(query: string, ...bindings: unknown[]) => {
        const c = (sql.exec as (q: string, ...b: unknown[]) => unknown)(query, ...bindings) as CursorLike;
        let seenR = 0;
        let seenW = 0;
        const settle = () => {
          const r = c.rowsRead;
          const w = c.rowsWritten;
          if (typeof r === 'number') {
            m.read(r - seenR);
            seenR = r;
          }
          if (typeof w === 'number') {
            m.write(w - seenW);
            seenW = w;
          }
        };
        if (typeof c.rowsRead !== 'number') {
          // No read counter here (the test shim): one row per statement is the honest minimum.
          if (/^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(query)) m.write(typeof c.rowsWritten === 'number' && c.rowsWritten > 0 ? c.rowsWritten : 1);
          else m.read(1);
          return c as unknown as SqlStorageCursor<T>;
        }
        settle(); // writes are done by now; reads count as the rows are consumed
        const out: CursorLike = {
          get rowsRead() {
            return c.rowsRead;
          },
          get rowsWritten() {
            return c.rowsWritten;
          },
          toArray() {
            const a = c.toArray();
            settle();
            return a;
          },
          one() {
            const o = c.one();
            settle();
            return o;
          },
          raw() {
            const it = (c.raw as () => Iterator<unknown>)();
            return {
              next() {
                const r = it.next();
                if (r.done) settle();
                return r;
              },
              [Symbol.iterator]() {
                return this;
              },
            };
          },
          next() {
            const r = (c.next as () => IteratorResult<unknown>)();
            if (r.done) settle();
            return r;
          },
          [Symbol.iterator]() {
            const it = (c[Symbol.iterator] as () => Iterator<unknown>)();
            return {
              next() {
                const r = it.next();
                if (r.done) settle();
                return r;
              },
              [Symbol.iterator]() {
                return this;
              },
            };
          },
        };
        Object.defineProperty(out, 'columnNames', { get: () => (c as { columnNames?: unknown }).columnNames });
        return out as unknown as SqlStorageCursor<T>;
      },
    };
    Object.defineProperty(wrapped, 'databaseSize', { get: () => (sql as { databaseSize?: number }).databaseSize });
    return wrapped as SqlStorage;
  }

  private bump(label: string): MeterCount {
    let c = this.by.get(label);
    if (!c) {
      c = { r: 0, w: 0 };
      this.by.set(label, c);
    }
    return c;
  }

  /** A new UTC day starts the counts again (the allowance resets at midnight UTC). */
  private roll(): void {
    const d = todayUtc();
    if (d === this.day) return;
    this.day = d;
    this.reads = 0;
    this.writes = 0;
    this.by.clear();
    this.dirty = true;
    this.loaded = Promise.resolve(); // nothing kept for the new day yet
  }
}
