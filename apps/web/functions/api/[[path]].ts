/**
 * KERNEL — protected. The gateway from the interface to the brain.
 *
 * Every /api/* request on the Pages site is passed, unchanged, to the brain Worker through
 * a service binding named BRAIN (set in the Pages dashboard: Settings > Bindings).
 * The brain has no public URL, so this is the only way in, and the brain still checks
 * that the request comes from the owner (Cloudflare Access JWT or owner key).
 */
interface Env {
  BRAIN?: { fetch(req: Request): Promise<Response> };
}

export const onRequest = async (context: { request: Request; env: Env }): Promise<Response> => {
  if (!context.env.BRAIN) {
    return new Response(JSON.stringify({ error: 'The BRAIN service binding is missing on this Pages project (see SETUP.md step 5).' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }
  return context.env.BRAIN.fetch(context.request);
};
