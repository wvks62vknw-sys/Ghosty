/**
 * The catalogue's words for the ARCADE's shelf, one entry a game, keyed as the arcade's registry items (`arcade:<shelf
 * id>`, apps/web/src/abilities/sources.ts): DOOM, Freedoom's two phases and Quake on their own engines, and the twelve
 * DOS classics. The two games made by us have theirs in games2.ts. Rules: catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

const game = (name: string, line: string, more: string, say: string[]): CatValue => ({ name, line, more, say, scene: ['playing'], cat: 'play', go: { open: 'arcade' }, since: '2026-11-01' });

export const ARCADE_WORDS: Record<string, CatValue> = {
  'arcade:freedoom': game(
    'Freedoom, the free DOOM',
    'You can play Freedoom: thirty-six levels of its own on the real DOOM engine, free for anyone to share.',
    'Four episodes made by fans, with their own monsters and weapons, on DOOM’s own engine built for the web. FIRE from the title starts a new game, and MENU opens its menu to save and load. One download also brings Phase 2.',
    ['Play Freedoom', 'Play free DOOM'],
  ),
  'arcade:freedoom2': game(
    'Freedoom Phase 2, free DOOM II',
    'You can play Freedoom Phase 2: thirty-two levels in the style of DOOM II, with the double-barrelled shotgun.',
    'It comes in the same download as Freedoom, so once one is on your phone both are. The free level packs fans made play over it. Your saves stay on this phone.',
    ['Play Freedoom Phase 2', 'Play free DOOM II'],
  ),
  'arcade:doom-shareware': game(
    'DOOM: Knee-Deep in the Dead',
    'You can play the original DOOM’s first episode, nine levels as id Software gave them away in 1993, on DOOM’s own engine.',
    'It runs at DOOM’s own 35 frames a second, with its sound effects (no music). The stick walks, a drag turns, and FIRE, USE and WEAPON sit under your thumbs. MENU opens its own menu to save and load.',
    ['Play DOOM', 'Play the original DOOM'],
  ),
  'arcade:quake-shareware': game(
    'Quake: Dimension of the Doomed',
    'You can play Quake’s first episode in real 3-D, as id Software gave it away in 1996, on Quake’s own engine.',
    'Your phone’s graphics chip draws it, so your phone decides how smooth it is: tell me if it stutters. JUMP, FIRE and WEAPON sit under your thumbs and a drag looks around. Its music was on the CD, so it plays the sound effects only.',
    ['Play Quake'],
  ),
  'arcade:duke3d-sw': game(
    'Duke Nukem 3D shareware',
    'You can play Duke Nukem 3D’s first episode, L.A. Meltdown, the 1996 shareware release, in a DOS machine inside me.',
    'It runs as it shipped, with sound. The stick walks, a drag turns, and FIRE, JUMP, OPEN and WEAPON sit under your thumbs, with CROUCH along the top. Your saves stay on this phone.',
    ['Play Duke Nukem 3D'],
  ),
  'arcade:heretic-sw': game(
    'Heretic: City of the Damned',
    'You can play Heretic’s shareware episode from 1994: DOOM’s engine with an elven wand, spells and gargoyles.',
    'It runs as it shipped in a DOS machine inside the page, with sound and music. ITEM uses what you carry, like the Tome of Power. Your saves stay on this phone.',
    ['Play Heretic'],
  ),
  'arcade:rott-sw': game(
    'Rise of the Triad shareware',
    'You can play Rise of the Triad: The Hunt Begins, the 1995 shareware episode with rocket jumps and heat-seekers.',
    'It runs as it shipped in a DOS machine inside the page, with its music and sound. Pick a character, then the stick walks and FIRE, OPEN and WEAPON sit under your thumbs. Your saves stay on this phone.',
    ['Play Rise of the Triad'],
  ),
  'arcade:bstone-sw': game(
    'Blake Stone: Aliens of Gold',
    'You can play Blake Stone’s first episode: a secret agent, a mad scientist and the informants who help you.',
    'The 1993 shareware episode runs as it shipped in a DOS machine inside the page, with sound. Shoot the guards, not the scientists: they tell you things. Your saves stay on this phone.',
    ['Play Blake Stone'],
  ),
  'arcade:raptor-sw': game(
    'Raptor: Call of the Shadows',
    'You can fly Raptor, the 1994 vertical shooter where every kill buys better guns, its first episode free.',
    'It runs as it shipped in a DOS machine inside the page, with sound. Spend your money in the hangar between waves and keep the mega bomb for a full screen. Your pilot is saved on this phone.',
    ['Play Raptor'],
  ),
  'arcade:tyrian-sw': game(
    'Tyrian, the shareware shooter',
    'You can play Tyrian’s shareware episode, Escape: the 1995 shooter people still call the best on the PC.',
    'It runs as it shipped in a DOS machine inside the page, with sound. Upgrade the front gun first; MODE flips how the rear gun fires. Your ship and its credits are saved on this phone.',
    ['Play Tyrian'],
  ),
  'arcade:omf-sw': game(
    'One Must Fall 2097',
    'You can fight giant robots one on one in One Must Fall 2097, the shareware release from 1994.',
    'It runs as it shipped in a DOS machine inside the page, with sound. PUNCH and KICK sit under your thumbs; push toward the other robot while you punch for a throw. Your pilot is saved on this phone.',
    ['Play One Must Fall'],
  ),
  'arcade:keen4-sw': game(
    'Commander Keen 4',
    'You can play Commander Keen 4, Secret of the Oracle: a pogo stick, a raygun and eight Council members to find.',
    'The 1991 shareware episode runs as it shipped in a DOS machine inside the page, with sound. JUMP, POGO and FIRE sit under your thumbs. Your saves stay on this phone.',
    ['Play Commander Keen'],
  ),
  'arcade:keen1-sw': game(
    'Commander Keen: Marooned on Mars',
    'You can play Commander Keen: Marooned on Mars, the 1990 platformer that started id Software.',
    'It runs as it shipped in a DOS machine inside the page. Find the parts of the Bean-with-Bacon Megarocket; the raygun has a button of its own. Your saves stay on this phone.',
    ['Play Keen on Mars'],
  ),
  'arcade:jill-sw': game(
    'Jill of the Jungle',
    'You can play Jill of the Jungle, a 1992 platformer that turns you into a frog, a bird and a fish.',
    'The first episode runs as it shipped in a DOS machine inside the page, with sound. Walk Jill into a door on the map to go in, and grab the knife first. Your saves stay on this phone.',
    ['Play Jill of the Jungle'],
  ),
  'arcade:wacky-sw': game(
    'Wacky Wheels kart racing',
    'You can race karts with animals in Wacky Wheels and throw hedgehogs at whoever is ahead.',
    'The shareware cup runs as it shipped in a DOS machine inside the page, with sound. GAS and BRAKE sit under your thumbs, with THROW beside them. Hold the gas through the corners.',
    ['Play Wacky Wheels', 'Race karts'],
  ),
  'arcade:pinball-sw': game(
    'Epic Pinball: the Android table',
    'You can play Epic Pinball’s Android table: real flippers, a plunger and a high-score table to beat.',
    'The table that came free runs as it shipped in a DOS machine inside the page, with sound. LEFT and RIGHT are the flippers; hold PLUNGER and let go to launch. The high-score table keeps your best.',
    ['Play pinball'],
  ),
};
