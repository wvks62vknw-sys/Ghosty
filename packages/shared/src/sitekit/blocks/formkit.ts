/**
 * Where a page's forms send (shared by every form block): the owner's free Formspree form when there is one —
 * a plain HTML POST to that one address, which the published page's policy allows and nothing else
 * (tools/sites.ts pagePolicy) — else the page's script opens WhatsApp or email with the message filled in.
 */
import { esc } from '../html';
import type { RenderCtx } from '../types';

/** The one form service a page may send to: Formspree's own address (free tier: 50 messages a month). */
export const FORM_ORIGIN = 'https://formspree.io';
/**
 * The owner's form address, checked: exactly a Formspree form (https://formspree.io/f/<id>) or nothing. Anything
 * else — another site, http, a path or query added, a look-alike host — is refused (null), and the forms stay
 * WhatsApp and email. (Web3Forms is not taken: after a send it moves the visitor to a second address, which the
 * page's one-address policy would block.)
 */
export function formTarget(endpoint: unknown): { action: string; origin: string; service: string } | null {
  if (typeof endpoint !== 'string') return null;
  const m = endpoint.trim().match(/^https:\/\/formspree\.io\/f\/([A-Za-z0-9]{4,20})$/);
  return m ? { action: `${FORM_ORIGIN}/f/${m[1]}`, origin: FORM_ORIGIN, service: 'Formspree' } : null;
}

/** The form tag: a real POST to the owner's form address when there is one, else a form the script sends by WhatsApp or email. */
export function formOpen(x: RenderCtx, kind: string, subject: string, wa: string): string {
  const t = formTarget(x.brief.formEndpoint);
  const to = `data-to-wa="${esc(wa)}" data-to-mail="${esc(x.brief.email ?? '')}"${x.brief.phone ? ` data-to-tel="${esc(x.brief.phone)}"` : ''} data-subject="${esc(subject)}"`;
  // target _blank: the service's thank-you page opens in its own tab (the page itself sits in a locked frame).
  return t
    ? `<form class="ghost-form" data-kind="${kind}" data-post method="post" action="${esc(t.action)}" target="_blank" ${to} novalidate><input type="hidden" name="_subject" value="${esc(subject)}">`
    : `<form class="ghost-form" data-kind="${kind}" ${to} novalidate>`;
}

