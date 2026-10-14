/**
 * Public data feeds. Requests go through the brain's caching proxy (/api/proxy) so one
 * upstream fetch serves every device; if the proxy is unavailable (e.g. local preview)
 * we fall back to fetching directly.
 *
 * `Feed` wraps a loader with polling and an honest status: IDLE / SYNC / LIVE / STALE / NO FEED.
 */
import { headers } from './brain';
import { Emitter } from '../core/store';

export async function fetchText(url: string, ttl = 60, timeout = 15000): Promise<string> {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(`/api/proxy?ttl=${ttl}&url=${encodeURIComponent(url)}`, { signal: ctl.signal, headers: headers() });
    if (r.ok) return await r.text();
    if (r.status !== 404 && r.status !== 401 && r.status !== 503 && r.status !== 405) throw new Error(`HTTP ${r.status}`);
    const d = await fetch(url, { signal: ctl.signal });
    if (!d.ok) throw new Error(`HTTP ${d.status}`);
    return await d.text();
  } finally {
    clearTimeout(to);
  }
}

export async function fetchJson<T>(url: string, ttl = 60, timeout = 15000): Promise<T> {
  return JSON.parse(await fetchText(url, ttl, timeout)) as T;
}

export type FeedStatus = 'IDLE' | 'SYNC' | 'LIVE' | 'STALE' | 'NO FEED';

export class Feed<T> {
  data: T | null = null;
  status: FeedStatus = 'IDLE';
  at = 0;
  error = '';
  private timer = 0;
  private busy = false;
  readonly events = new Emitter<{ change: Feed<T> }>();

  constructor(
    readonly name: string,
    private loader: () => Promise<T>,
    private everyMs: number,
  ) {}

  async refresh(force = false): Promise<T | null> {
    if (this.busy) return this.data;
    if (!force && this.data && Date.now() - this.at < this.everyMs * 0.8) return this.data;
    this.busy = true;
    if (!this.data) this.status = 'SYNC';
    this.events.emit('change', this);
    try {
      this.data = await this.loader();
      this.status = 'LIVE';
      this.at = Date.now();
      this.error = '';
    } catch (e) {
      this.status = this.data ? 'STALE' : 'NO FEED';
      this.error = String((e as Error)?.message ?? e);
    } finally {
      this.busy = false;
      this.events.emit('change', this);
    }
    return this.data;
  }

  /** Start polling (idempotent). */
  start(): this {
    if (!this.timer) {
      void this.refresh();
      this.timer = window.setInterval(() => {
        if (!document.hidden) void this.refresh(true);
      }, this.everyMs);
    }
    return this;
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = 0;
  }

  onChange(fn: (f: Feed<T>) => void): () => void {
    return this.events.on('change', fn);
  }
}
