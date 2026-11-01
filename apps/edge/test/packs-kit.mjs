// What the packs' tests share (BRIEF-PACKS-1: money.test.mjs, body.test.mjs, kitchen.test.mjs): their bundles built here with
// esbuild's API (as catalogue.test.mjs does), a storage like the Durable Object's, a fixed clock on his time zone, and a
// fetch that answers from fixtures only (no network: test/no-network.mjs).
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url).pathname;

/** Bundles the given sources (paths from apps/edge/) into test/.build/packs/, and imports them. */
export async function bundles(entries) {
  await build({
    entryPoints: entries.map((e) => at(`../${e}`)),
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    external: ['cloudflare:sockets'],
    outdir: at('./.build/packs'),
    outbase: at('../../..'),
    outExtension: { '.js': '.mjs' },
    logLevel: 'warning',
  });
  const out = {};
  for (const e of entries) {
    const rel = new URL(`../${e}`, import.meta.url).pathname.replace(at('../../../'), '').replace(/\.ts$/, '.mjs');
    out[e] = await import(at(`./.build/packs/${rel}`));
  }
  return out;
}

export const fixture = (name) => readFileSync(at(`./packs/${name}`), 'utf8');

/** Sun 1 Nov 2026, 12:00 in London (GMT). */
export const NOW = Date.UTC(2026, 10, 1, 12, 0);

/** A storage like the Durable Object's (structured clones in and out), with his time zone kept. */
export class Mem {
  m = new Map([['owner:ctx', { tz: 'Europe/London' }]]);
  async get(k) {
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)));
  }
  async setAlarm() {}
  async getAlarm() {
    return null;
  }
}

/** A fetch that answers from a table of URL → body (a string, an object as JSON, or a function of the URL); anything else is a 404. */
export function fakeFetch(table, seen = []) {
  return async (url) => {
    const u = String(url);
    seen.push(u);
    const hit = Object.entries(table).find(([k]) => u === k || u.startsWith(k));
    if (!hit) return new Response('not here', { status: 404 });
    const v = typeof hit[1] === 'function' ? hit[1](u) : hit[1];
    return new Response(typeof v === 'string' ? v : JSON.stringify(v), { status: 200, headers: { 'content-type': typeof v === 'string' ? 'text/html' : 'application/json' } });
  };
}

/** The deps a pack action runs with. */
export const deps = (storage, fetch = fakeFetch({}), now = NOW) => ({ storage, fetch, now: () => now, tz: 'Europe/London' });

/** A tool context that keeps what the tool sent to the screen. */
export function ctxOf(storage) {
  const events = [];
  return { events, ctx: { storage, emit: (e) => events.push(e), progress: () => undefined, env: {}, vault: { get: async () => null } } };
}
