// Test only: his own accounts' APIs for the preview brain (tests/social.spec.mjs, BRIEF-SOCIAL) — Bluesky's AT Protocol,
// Mastodon, Discord's REST API and Telegram's channel post — answered here, never by the live services. Every post and
// follow that reaches them is recorded (GET /__test/social), so a spec can see APPROVE send exactly once.
const sent = [];
export const socialSent = () => sent;
export const resetSocial = () => void sent.splice(0);

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => `${b64u({ alg: 'ES256K' })}.${b64u(claims)}.sig`;
const ok = (v) => new Response(JSON.stringify(v), { status: 200, headers: { 'content-type': 'application/json' } });
const bad = (status, error, message = error) => new Response(JSON.stringify({ error, message }), { status, headers: { 'content-type': 'application/json' } });
const bodyOf = (init) => {
  try {
    return typeof init?.body === 'string' ? JSON.parse(init.body) : {};
  } catch {
    return {};
  }
};
const at = (mins) => new Date(Date.now() - mins * 60_000).toISOString();

/** Bluesky: the entryway and his PDS on one host; the app password the spec types is the only one that signs in. */
function bluesky(u, init) {
  const nsid = u.pathname.replace('/xrpc/', '');
  const body = bodyOf(init);
  const session = () => ({ did: 'did:plc:previewme', handle: 'ghost.bsky.social', accessJwt: jwt({ scope: 'com.atproto.appPass', exp: Math.floor(Date.now() / 1000) + 7200 }), refreshJwt: jwt({ scope: 'com.atproto.refresh' }), didDoc: { service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://bsky.social' }] } });
  if (nsid === 'com.atproto.server.createSession') return body.password === 'test-appp-pass-word' ? ok(session()) : bad(401, 'AuthenticationRequired', 'Invalid identifier or password');
  if (nsid === 'com.atproto.server.refreshSession') return ok(session());
  if (nsid === 'app.bsky.feed.getTimeline') {
    return ok({
      feed: [
        { post: { uri: 'at://did:plc:a/app.bsky.feed.post/3kaaa', author: { handle: 'nasa.gov', displayName: 'NASA' }, record: { text: 'Artemis crew back from the Moon flyby', createdAt: at(25) } } },
        { post: { uri: 'at://did:plc:b/app.bsky.feed.post/3kbbb', author: { handle: 'brumweather.bsky.social', displayName: 'Brum Weather' }, record: { text: 'Frost tonight across the West Midlands', createdAt: at(70) } } },
      ],
    });
  }
  if (nsid === 'app.bsky.feed.searchPosts') return ok({ posts: [{ uri: 'at://did:plc:c/app.bsky.feed.post/3kccc', author: { handle: 'villa.bsky.social', displayName: 'Villa' }, record: { text: `On ${u.searchParams.get('q')}: a late winner`, createdAt: at(10) } }] });
  if (nsid === 'com.atproto.repo.createRecord') {
    if (body.rkey && sent.some((s) => s.account === 'bluesky' && s.rkey === body.rkey)) return bad(400, 'InvalidRequest', 'Record already exists');
    sent.push({ account: 'bluesky', kind: body.collection === 'app.bsky.graph.follow' ? 'follow' : 'post', text: body.record?.text ?? '', rkey: body.rkey, at: Date.now() });
    return ok({ uri: `at://did:plc:previewme/${body.collection}/${body.rkey ?? '3knew'}`, cid: 'bafy' });
  }
  if (nsid === 'app.bsky.actor.getProfile') return ok({ did: 'did:plc:someone', handle: u.searchParams.get('actor'), viewer: {} });
  if (nsid === 'com.atproto.repo.deleteRecord') return ok({});
  if (nsid === 'com.atproto.repo.uploadBlob') return ok({ blob: { $type: 'blob', ref: { $link: 'bafyimg' }, mimeType: 'image/jpeg', size: 1 } });
  return bad(404, 'MethodNotImplemented');
}

/** The stand-in for every API of his accounts; null for any other address (the real fetch then). */
export function socialApis(u, init) {
  if (u.hostname === 'bsky.social') return bluesky(u, init);
  return null;
}
