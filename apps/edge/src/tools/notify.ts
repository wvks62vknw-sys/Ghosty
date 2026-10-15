/**
 * Notifications on demand: Ghosty sends a push notification to the owner's phone and
 * other devices right now (the same Web Push channel reminders use). Only ever to the
 * owner's own registered devices, so it needs no approval.
 */
import { pushAll, loadSubs } from '../push';
import { addInbox } from '../schedule';
import { arg, type Tool } from './types';

export const notifyTools: Tool[] = [
  {
    name: 'push_to_phone',
    description:
      "Send a push notification to the owner's phone and devices right now (e.g. \"ping my phone with the shopping list\", \"notify me when you're done\", a result to keep). Also kept in the Agenda inbox. For later or repeating notifications use set_reminder or schedule_task instead.",
    parameters: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string', description: 'the message, up to ~900 characters' } }, required: ['text'] },
    risk: 'auto',
    async run(a, ctx) {
      const text = arg.str(a, 'text').slice(0, 900);
      const title = (arg.str(a, 'title', false) || 'Ghosty').slice(0, 80);
      const devices = await loadSubs(ctx.storage);
      const item = await addInbox(ctx.storage, { kind: 'task', title, text });
      if (!devices.length) return 'Saved to the Agenda inbox, but no phone or device has notifications turned on yet: the owner can turn them on in System → Phone app & notifications (on iPhone, add Ghosty to the Home Screen first).';
      const sent = await pushAll(ctx.storage, { title: `✦ ${title}`, body: text, tag: item.id }, ctx.env.OWNER_EMAIL ? `mailto:${ctx.env.OWNER_EMAIL}` : undefined);
      return sent ? `Sent to ${sent} device${sent === 1 ? '' : 's'}.` : 'Saved to the inbox, but the push service did not accept it (the device may need notifications turned on again in System).';
    },
  },
];
