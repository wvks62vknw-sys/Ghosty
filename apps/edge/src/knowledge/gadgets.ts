/**
 * Know-how for the physical world's gadgets: how to get from a photo of a speaker, a TV or a
 * broken part to the right settings or a part to buy, with the tools in tools/gadgets.ts and the
 * phone's SOUND CHECK (Lens → SOUND).
 */
import type { Playbook } from './types';

export const GADGETS: Playbook[] = [
  {
    id: 'gadgets-and-parts',
    title: 'Gadgets and parts: best settings, sound checks and replacement parts from a photo',
    tags: ['gadget', 'gadgets', 'speaker', 'amp', 'amplifier', 'soundbar', 'tv', 'settings', 'best settings', 'eq', 'distortion', 'sound check', 'part', 'parts', 'spare part', 'replacement', 'part number', 'find part'],
    body: `Chain it, one step at a time, and never guess at any step.

1. IDENTIFY. From the photo (or the Lens READ text sent as scan, or the NAME guesses sent as seen): the make and model for a gadget — on the front, the back plate, the rating label underneath, the remote; for a part the number printed on it (often moulded in the plastic or on a sticker: letters + digits like BN59-01315B, GSK615, 32021234) and what it is (door seal, belt, remote, fuse 20 mm 3 A, capacitor 470 µF 25 V…). If you cannot read the model or the number, say what you can see and ask for a closer photo of the label — do not invent one.
2. LOOK IT UP.
   - Settings: gadget_settings { device: "<make> <model>", use: music | films | gaming | speech, room? }. It returns only settings published by the manual, the maker or reviewers (RTINGS, What Hi-Fi?…), each with its source.
   - Part: find_part { description, part_number?, device? }. It returns UK listings with prices read from the shops' pages, best match first; listings that do not mention the part number are flagged.
3. ANSWER. Settings: a short list (setting → value), each with its source ("RTINGS: Picture Mode Expert (Dark Space)…"), adapted to the use and room; nothing that is not in the tool's result. Part: the best two or three listings — title, price, shop, stock, link — say which one matches the part number, that prices are as of now, and AliExpress's slow shipping when it is listed. Nothing found → say so and what to photograph next.

Sound: "is my speaker distorting?", "does this sound right?" → the owner can run Lens → SOUND (LISTEN records 5–10 s of what is playing: levels, clipping, hum, boom, harshness; TEST TONE plays a 1 kHz tone in steps and a sweep: distortion at each level, where it starts, the frequency response). Its report arrives as data marked SOUND CHECK; explain it plainly and turn it into actions ("turn the bass down two notches", "keep the volume under 60%"). With a make and model, gadget_settings can add the maker's recommended EQ.`,
  },
];
