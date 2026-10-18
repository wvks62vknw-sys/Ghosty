/**
 * Forms that really reach the owner, for free, from a page that can send nothing itself (published
 * pages are sandboxed: no server, no fetch): the visitor fills it in, and the page's script opens their
 * WhatsApp or email app with the message written out and addressed to the business. The line under the
 * form says so. A phone call is always offered beside it.
 */
import { a, esc, icon, str } from '../html';
import type { BlockDef, RenderCtx } from '../types';
import { HEAD, OT, head, sec } from './common';
import { bookingForm, FORM_CSS, formNote, whatsappOf } from './hero';
import { CLIST_CSS, contactList } from './media';



function contactFields(x: RenderCtx, id: string, kind: string): string {
  const services = (x.brief.services ?? []).map((s) => s.name).slice(0, 14);
  const job = kind === 'quote' && services.length ? `<div class="field"><label for="${id}-job">What do you need?</label><select id="${id}-job" name="Job">${services.map((s) => `<option>${esc(s)}</option>`).join('')}<option>Something else</option></select></div>` : '';
  const where = kind === 'quote' ? `<div class="field"><label for="${id}-pc">Postcode</label><input id="${id}-pc" name="Postcode" autocomplete="postal-code" autocapitalize="characters"></div>` : '';
  return `<div class="two"><div class="field"><label for="${id}-name">Name</label><input id="${id}-name" name="Name" autocomplete="name" required></div><div class="field"><label for="${id}-phone">Phone</label><input id="${id}-phone" name="Phone" type="tel" inputmode="tel" autocomplete="tel" required></div></div><div class="two"><div class="field"><label for="${id}-email">Email <span class="hint">(optional)</span></label><input id="${id}-email" name="Email" type="email" autocomplete="email"></div>${where || '<div></div>'}</div>${job}<div class="field"><label for="${id}-msg">${kind === 'quote' ? 'Tell us about the job' : 'Message'}</label><textarea id="${id}-msg" name="Message" rows="4" required></textarea></div>`;
}

export const formBlocks: BlockDef[] = [
  {
    id: 'contact-form',
    group: 'form',
    about: 'Contact details beside a form (name, phone, email, message; or a quote form with the job and postcode) that opens WhatsApp or email with the message filled in. The contact page.',
    slots: { ...HEAD, kind: OT(12, '"contact" or "quote"'), formTitle: OT(48) },
    js: ['form', 'hours'],
    css: `${FORM_CSS}
${CLIST_CSS}
.b-contact-form .wrap{display:grid;gap:var(--space-xl)}
.b-contact-form .side .head{margin-bottom:var(--space-l)}
.b-contact-form .formcard{padding:var(--space-l);border-radius:var(--r3);background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-2);color:var(--text)}
.b-contact-form .formcard h3{font-size:var(--step-2);margin-bottom:var(--space-m)}
@media (min-width:900px){.b-contact-form .wrap{grid-template-columns:.85fr 1.15fr;gap:var(--space-2xl)}}`,
    render(d, x) {
      const kind = str(d, 'kind') === 'quote' ? 'quote' : 'contact';
      const id = `cf${x.index}`;
      const b = x.brief;
      const wa = whatsappOf(b);
      const send = wa ? `${icon('whatsapp')}Send by WhatsApp` : b.email ? `${icon('send')}Send by email` : `${icon('phone')}Call us`;
      const alt = wa && b.email ? `<button class="btn btn-ghost btn-sm" type="submit" name="via" value="email">${icon('mail')}Or send by email</button>` : '';
      const form = b.email || wa
        ? `<form class="ghost-form" data-kind="${kind}" data-to-wa="${esc(wa)}" data-to-mail="${esc(b.email ?? '')}" data-subject="${esc(`${kind === 'quote' ? 'Quote request' : 'Enquiry'} — ${b.name}`)}" novalidate>${contactFields(x, id, kind)}<div class="alt"><button class="btn btn-primary" type="submit" name="via" value="${wa ? 'whatsapp' : 'email'}">${send}</button>${alt}</div><p class="form-note" role="status" aria-live="polite">${formNote(x)}</p></form>`
        : `<p>${b.phone ? a(`tel:${b.phone.replace(/[^\d+]/g, '')}`, `${icon('phone')}Call ${esc(b.phone)}`, 'btn btn-primary') : ''}</p>`;
      return sec('contact-form', x, `<div class="wrap"><div class="side">${head(d)}${contactList(b)}</div><div class="formcard reveal"><h3>${esc(str(d, 'formTitle') || (kind === 'quote' ? 'Get a free quote' : 'Send us a message'))}</h3>${form}</div></div>`, { anchor: 'contact' });
    },
  },
  {
    id: 'booking-form',
    group: 'form',
    about: 'A booking request: service, day, time of day, name, phone and a note, sent to the business by WhatsApp or email. For businesses without an online booking system.',
    slots: { ...HEAD, formTitle: OT(48) },
    js: ['form'],
    css: `${FORM_CSS}
.b-booking-form .wrap{display:grid;gap:var(--space-xl)}
.b-booking-form .formcard{padding:var(--space-l);border-radius:var(--r3);background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-2);color:var(--text);max-width:640px;width:100%}
.b-booking-form .formcard form{display:grid;gap:var(--space-s)}
.b-booking-form .formcard .two{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-s)}
.b-booking-form .formcard .btn{justify-self:start}
@media (min-width:900px){.b-booking-form .wrap{grid-template-columns:.9fr 1.1fr;align-items:start}}`,
    render(d, x) {
      return sec('booking-form', x, `<div class="wrap">${head(d)}<div class="formcard reveal">${str(d, 'formTitle') ? `<h3 style="font-size:var(--step-2);margin-bottom:var(--space-m)">${esc(str(d, 'formTitle'))}</h3>` : ''}${bookingForm(x, `bf${x.index}`, true)}</div></div>`, { anchor: 'book' });
    },
  },
];
