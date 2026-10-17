/**
 * The Lens from chat: reverse image search links for a picture the owner gave the address
 * of. The LENS tab does the same for a crop from the camera (it shares the crop at /i/<id>
 * first, see ../lens.ts); here the picture must already be somewhere public.
 */
import { engineLinks } from '../lens';
import { arg, type Tool } from './types';

export const lensTools: Tool[] = [
  {
    name: 'reverse_image_links',
    description:
      'Reverse image search links for a picture at a public web address (https://…jpg/png/webp, or one Ghosty shared at /i/…): Google Lens, Bing Visual Search, Yandex Images and TinEye, each named plainly for the owner to tap; nothing is uploaded and no engine is called by you. Use when the owner pastes a picture link and asks where it is from or what it shows. Never for finding who a person is from their face.',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'the full public address of the picture (https://…)' } }, required: ['url'] },
    risk: 'auto',
    async run(a) {
      const raw = arg.str(a, 'url').trim();
      if (/^data:/i.test(raw)) throw new Error('that is the picture itself, not an address — the engines need a public link (the Lens tab shares a picture by link for 24 hours)');
      let u: URL;
      try {
        u = new URL(raw);
      } catch {
        throw new Error('that is not a web address — give the full https:// link to the picture');
      }
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('the picture needs an http(s) address that the engines can fetch');
      if (/^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(u.hostname)) throw new Error('the engines cannot reach an address on a private network — the picture must be on the public web');
      const links = engineLinks(u.toString());
      return [
        `Reverse image search for ${u.toString()} — each link opens that engine in a new tab, which fetches the picture from its address:`,
        ...links.map((l) => `- ${l.name}: ${l.url} (${l.note.replace(/ in a new tab$/, '')})`),
        'A picture shared from the Lens (/i/…) stays reachable for 24 hours, or until the owner presses FORGET NOW.',
      ].join('\n');
    },
  },
];
