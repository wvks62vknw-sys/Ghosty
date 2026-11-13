// A spec that leaves numbers or state in the preview's brain puts it back at its end, and proves the next spec opens clean (POLISH 3, 2e and 2f e):
// the MAKE pass's Workbench numbers made thescan red once, homepass hung until the server was restarted, and the TRAINING landing's learn.spec
// and voice.spec raced on what an earlier spec left. The preview server (tests/preview-server.mjs) keeps the brain's storage; this takes a copy
// when a spec opens and gives it back when the spec ends.
//   const clean = await brainBefore(base);        // the brain as the spec found it
//   (the spec's own checks run here)
//   problems.push(...(await brainAfter(base, clean)));  // put back; a line for anything it could not
export async function brainBefore(base) {
  const r = await fetch(`${base}/__test/snapshot`).then((x) => x.json()).catch(() => null);
  return r ?? { keys: -1, hash: '' };
}
export async function brainAfter(base, before) {
  const out = [];
  const put = await fetch(`${base}/__test/restore`).then((x) => x.json()).catch(() => null);
  if (!put) return ['the preview brain could not be put back (no /__test/restore): the next spec may open on this one\'s leftovers'];
  const now = await fetch(`${base}/__test/state`).then((x) => x.json()).catch(() => null);
  if (before.hash && now?.hash !== before.hash) out.push(`the next spec would not open clean: the brain's storage is not as this spec found it (${JSON.stringify({ was: before.keys, now: now?.keys, added: put.added?.slice(0, 6), changed: put.changed?.slice(0, 6) })})`);
  return out;
}
