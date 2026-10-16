// Loaded before every test file (see the test script in package.json): a test never reaches
// the real network. Any fetch a test did not fake fails at once, the way a lost connection
// would, so the code under test takes its no-network path instead of asking a real endpoint.
// (The brain has keyless model providers now: without this, a test with no keys at all would
// quietly ask Pollinations for a real answer.)
globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : (input && typeof input === 'object' && 'url' in input ? input.url : String(input));
  throw new TypeError(`fetch failed: tests have no network (${String(url).slice(0, 140)})`);
};
