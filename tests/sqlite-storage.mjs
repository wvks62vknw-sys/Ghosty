// Ghosty's Durable Object has SQLite storage (ctx.storage.sql). Tests and the local preview
// emulate it with Node's built-in SQLite, which has the same FTS5 full-text search.
const warn = process.emitWarning;
process.emitWarning = (w, ...a) => (String(w?.message ?? w).includes('SQLite') ? undefined : warn.call(process, w, ...a));
const { DatabaseSync } = await import('node:sqlite');

export function sqlStorage() {
  const db = new DatabaseSync(':memory:');
  /** Query plans of everything run (see Library tests: nothing may scan the whole library). */
  const plans = [];
  return {
    plans,
    exec(query, ...bindings) {
      if (/^\s*(SELECT|UPDATE|DELETE|INSERT)/i.test(query)) {
        try {
          const detail = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...bindings.map((b) => (b === undefined ? null : b))).map((r) => r.detail);
          plans.push({ query, detail });
        } catch {
          /* plan unavailable */
        }
      }
      const st = db.prepare(query);
      const rows = st.all(...bindings.map((b) => (b === undefined ? null : b)));
      return {
        toArray: () => rows,
        one: () => {
          if (rows.length !== 1) throw new Error(`expected exactly one row, got ${rows.length}`);
          return rows[0];
        },
        rowsWritten: 0,
      };
    },
    get databaseSize() {
      const p = db.prepare('PRAGMA page_count').get();
      const s = db.prepare('PRAGMA page_size').get();
      return Number(p.page_count) * Number(s.page_size);
    },
  };
}
