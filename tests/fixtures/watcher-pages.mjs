// The public pages the WATCHERS spec and the brain's watcher test watch (BRIEF-OCT-IDEAS-2 7): made for these tests, served by the
// preview's stand-in web (tests/preview-server.mjs) on a made-up host, never fetched from anywhere. What they say is switched by
// GET /__test/watcher?price=24.99&strike=1&notice=2 (and ?reset=1 back to the start).
const start = () => ({ price: 29.99, strike: false, notice: 1, hits: 0 });
export const watcherState = start();

const page = (title, body) => new Response(`<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1>${body}</body></html>`, { headers: { 'content-type': 'text/html' } });

/** The stand-in answer for a watcher fixture address, or null when the address is not one of ours. */
export function watcherPages(u) {
  if (u.hostname !== 'watch.example.test') return null;
  watcherState.hits++;
  switch (u.pathname) {
    case '/kettle':
      return page('Hartley Kettle 1.7 L', `<meta property="product:price:amount" content="${watcherState.price.toFixed(2)}"><p>The Hartley kettle. Now £${watcherState.price.toFixed(2)}.</p>`);
    case '/status':
      return page('Line 74 service status', `<p>${watcherState.strike ? 'Industrial action: services on Line 74 will not run on Friday because of a strike.' : 'Good service on all routes.'}</p>`);
    case '/notice':
      return page('Parish notice board', `<p>Notice number ${watcherState.notice}: the hall is open on Tuesday.</p>`);
    case '/login':
      return new Response('please sign in', { status: 403 });
    case '/signin':
      return page('Sign in', '<form><input type="password" name="p"></form>');
    default:
      return new Response('not found', { status: 404 });
  }
}

/** ?price=, ?strike=1|0, ?notice=, ?reset=1 */
export function setWatcher(q) {
  if (q.get('reset') === '1') Object.assign(watcherState, start());
  if (q.has('price')) watcherState.price = Number(q.get('price'));
  if (q.has('strike')) watcherState.strike = q.get('strike') === '1';
  if (q.has('notice')) watcherState.notice = Number(q.get('notice'));
  return { ...watcherState };
}
