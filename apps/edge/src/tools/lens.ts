/**
 * The Lens from chat: reverse image search links for a picture the owner gave the address
 * of. The LENS tab does the same for a crop from the camera (it shares the crop at /i/<id>
 * first, see ../lens.ts); here the picture must already be somewhere public.
 *
 * identify_plant is the Lens's NAME IT for a plant: the phone holds its photo under a picture id
 * for a moment (POST /lens/share), this reads the bytes from KV, forgets them at once, and asks
 * Pl@ntNet (key `plantnet`). Its first line, `PLANTNET {…}`, is what the phone's card is made
 * from (packages/shared/src/living.ts), so the card never depends on how a model retells it.
 */
import { aboutPercent, aName, engineLinks, forgetImage, identifyPlant, imageBytes, plantLine, PlantNetError } from '../lens';
import { asData } from '../kernel/permissions';
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
  {
    name: 'identify_plant',
    description:
      "Name the plant in a photo the Lens holds by picture id (16 letters, given in the Lens's NAME IT question) with Pl@ntNet: best match, how sure, family. Only for an id the Lens gave; never for people.",
    parameters: { type: 'object', properties: { picture: { type: 'string', description: 'the picture id from the Lens (16 characters)' } }, required: ['picture'] },
    risk: 'auto',
    async run(a, ctx) {
      const id = arg.str(a, 'picture').trim().replace(/^.*\/i\//, '').replace(/[^A-Za-z0-9_-].*$/, '');
      const kv = ctx.env.SITES;
      const key = await ctx.vault.get('plantnet').catch(() => null);
      if (!key) {
        if (kv) await forgetImage(kv, id).catch(() => false);
        return `${plantLine({ missing: 'key' })}\nPl@ntNet needs its free key (500 a day): SYSTEM → KEYS → Pl@ntNet, made at my.plantnet.org. Tell the owner that, in one line.`;
      }
      const pic = kv ? await imageBytes(kv, id) : null;
      if (!pic) return `${plantLine({ error: 'the photo had already gone: press PLANT again' })}\nThe Lens's photo was not there (it is held for a moment only). Tell the owner to press PLANT again.`;
      // the photo is held only for this: gone before Pl@ntNet even answers
      await forgetImage(kv!, id).catch(() => false);
      ctx.progress?.('asking Pl@ntNet…');
      try {
        const p = await identifyPlant(pic.bytes, pic.type, key);
        const said = p.level === 'cant' ? "Pl@ntNet can't tell from this photo." : `Pl@ntNet: ${p.level === 'sure' ? '' : `${p.level}, `}${aName(p)} (${p.species}), ${aboutPercent(p.score ?? 0)}${p.tell ? `, ${p.tell}` : ''}.`;
        return `${plantLine(p)}\n${asData('Pl@ntNet', said)}`;
      } catch (e) {
        const msg = e instanceof PlantNetError ? e.message : `Pl@ntNet failed: ${String((e as Error)?.message ?? e).slice(0, 120)}`;
        return `${plantLine({ error: msg })}\n${msg}`;
      }
    },
  },
];
