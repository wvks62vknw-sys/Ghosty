/**
 * Ghosty's links, for Siri Shortcuts and anything else that opens an address (BRIEF-REST-A 2; the SHORTCUTS panel is
 * shortcuts.ts). Pure, so the tests run it. What an address can ask:
 *  - `/#<screen>` and `/#<screen>?<mode>` (what the app always understood: "#agenda", "#eye?machine", "#workbench?tunnel");
 *  - `?open=<screen>&panel=<panel>`: the screen, scrolled to the panel whose title starts so (what the deck's lines do);
 *  - `?say=<words>`: the words in the chat box, sent when they ask something (a question, a look-up), left in the box when
 *    they would start something (a reminder, a message, a purchase, a standing rule, praise: the catalogue's TRY IT rule);
 *  - `?do=<command>`: one of the app's own commands: `timer:10m`, `lens:scan`, `open:<screen>`, `arcade`, `sit`, `walkhome`,
 *    `remind:<words>`, `morse`, `wiki:<title>`.
 * Only on the owner's own signed-in phone: anyone else's opening of such a link shows the sign-in and runs nothing.
 */

export type DoCmd =
  | { cmd: 'timer'; secs: number }
  | { cmd: 'open'; tab: string }
  | { cmd: 'lens'; mode: string }
  | { cmd: 'arcade' }
  | { cmd: 'sit' }
  | { cmd: 'walkhome' }
  | { cmd: 'remind'; text: string }
  | { cmd: 'morse'; text?: string }
  | { cmd: 'wiki'; title?: string };

export type Link =
  | { kind: 'open'; tab: string; panel?: string }
  | { kind: 'say'; text: string; send: boolean }
  | { kind: 'do'; what: DoCmd }
  /** A link for the owner, opened by someone who is not him (not signed in): the sign-in, and nothing run. */
  | { kind: 'signin' }
  /** A link this app does not know (said once, nothing run). */
  | { kind: 'unknown'; text: string };

/** The Lens's modes (features/lens/tiles.ts). */
export const LENS_MODES = ['see', 'read', 'hands', 'ask', 'name', 'people', 'scan', 'aim', 'measure', 'sound'];

/** Words that start something (a reminder, a message, a change, a purchase, a standing rule) or praise: those wait in the box. */
const STARTS =
  /^(?:please\s+)?(?:remind|set|start|begin|build|make|create|publish|send|text|email|e-mail|message|msg|call|ring|phone|delete|remove|forget|erase|clear|wipe|buy|order|book|pay|transfer|schedule|add|put|post|share|turn|switch|play|train|sit|track|watch|stop|cancel|record|save|remember|learn|write|draft|reply|invite|install|deploy|upload|download|launch|walk|navigate|drive|take|move|rename|change|update|edit|reset|lock|unlock|from now on|always|never|don'?t)\b/i;
const PRAISE = /^(?:good (?:job|boy|work|one)|well done|nice(?: one| work)?|great(?: job| work)?|spot on|proud of you|thanks?|thank you|cheers|love you)\b/i;

/** `?say=`: sent when it asks something; in the box when it would start something. */
export function sayAction(text: string): 'send' | 'box' {
  const t = text.trim().replace(/^(?:hey\s+)?ghosty[,!]?\s+/i, '');
  if (!t) return 'box';
  if (STARTS.test(t) || PRAISE.test(t)) return 'box';
  return 'send';
}

/** "10m", "90s", "1h30m", "1h 30", "10" (minutes), "1:30" (minutes and seconds) in seconds; 0 when it is none of those. */
export function durationSecs(s: string): number {
  const t = s.trim().toLowerCase().replace(/\s+/g, '');
  if (/^\d+$/.test(t)) return Number(t) * 60;
  let m = /^(\d+):(\d{1,2})$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(?:(\d+)h(?:ours?|rs?)?)?(?:(\d+)m(?:in(?:ute)?s?)?)?(?:(\d+)s(?:ec(?:ond)?s?)?)?$/.exec(t);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  m = /^(\d+)h(\d+)$/.exec(t);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60;
  return 0;
}

/** `?do=<command>` as the app's command, or null when it is not one. */
export function parseDo(raw: string, tabs: string[]): DoCmd | null {
  const s = raw.trim();
  const [head = '', ...rest] = s.split(':');
  const arg = rest.join(':').trim();
  switch (head.toLowerCase()) {
    case 'timer': {
      const secs = durationSecs(arg || '10m');
      return secs > 0 && secs <= 86_400 ? { cmd: 'timer', secs } : null;
    }
    case 'open':
      return tabs.includes(arg.toLowerCase()) ? { cmd: 'open', tab: arg.toLowerCase() } : null;
    case 'lens':
      return !arg || LENS_MODES.includes(arg.toLowerCase()) ? { cmd: 'lens', mode: arg.toLowerCase() || 'see' } : null;
    case 'arcade':
      return { cmd: 'arcade' };
    case 'sit':
      return { cmd: 'sit' };
    case 'walkhome':
    case 'walk':
      return { cmd: 'walkhome' };
    case 'remind':
      return arg ? { cmd: 'remind', text: arg.slice(0, 300) } : null;
    case 'morse':
      return arg ? { cmd: 'morse', text: arg.slice(0, 200) } : { cmd: 'morse' };
    case 'wiki':
      return arg ? { cmd: 'wiki', title: arg.slice(0, 200) } : { cmd: 'wiki' };
    default:
      return null;
  }
}

/**
 * What an address asks, from its query (`location.search`): `owner` is whether this is his own signed-in phone; `tabs` the
 * screens this build has. null when it asks nothing of ours (no say, do or open).
 */
export function parseLink(search: string, o: { owner: boolean; tabs: string[] }): Link | null {
  const q = new URLSearchParams(search);
  const say = q.get('say');
  const doIt = q.get('do');
  const open = q.get('open');
  if (say == null && doIt == null && open == null) return null;
  if (!o.owner) return { kind: 'signin' };
  if (doIt != null) {
    const what = parseDo(doIt, o.tabs);
    return what ? { kind: 'do', what } : { kind: 'unknown', text: doIt.slice(0, 80) };
  }
  if (say != null) {
    const text = say.replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!text) return { kind: 'unknown', text: 'say' };
    return { kind: 'say', text, send: sayAction(text) === 'send' };
  }
  const tab = (open ?? '').trim().toLowerCase();
  if (!o.tabs.includes(tab)) return { kind: 'unknown', text: tab.slice(0, 80) };
  const panel = (q.get('panel') ?? '').trim().toUpperCase().slice(0, 80);
  return { kind: 'open', tab, ...(panel ? { panel } : {}) };
}

// ---------------------------------------------------------------- making links

/** A link of his: words to say, a command, or a screen (and a panel on it). */
export type LinkAsk = { say: string } | { do: string } | { open: string; panel?: string };

/** The address for a link of his (`origin`: this Ghosty's own, e.g. https://ghosty.example.workers.dev). */
export function shortcutUrl(origin: string, ask: LinkAsk): string {
  const base = origin.replace(/\/+$/, '');
  if ('say' in ask) return `${base}/?say=${encodeURIComponent(ask.say)}`;
  if ('do' in ask) return `${base}/?do=${encodeURIComponent(ask.do).replace(/%3A/gi, ':')}`;
  return `${base}/?open=${encodeURIComponent(ask.open)}${ask.panel ? `&panel=${encodeURIComponent(ask.panel)}` : ''}`;
}

/** A ready shortcut: its name (what he says to Siri after "Hey Siri"), what it does, and its link. */
export interface Ready {
  name: string;
  does: string;
  ask: LinkAsk;
}

/** The twelve ready shortcuts (the SHORTCUTS panel's gallery). */
export const READY: Ready[] = [
  { name: 'Ghosty timer', does: 'Starts a 10-minute timer on the phone.', ask: { do: 'timer:10m' } },
  { name: 'Ghosty scan', does: 'Opens the Lens on SCAN, for a barcode or a QR code.', ask: { do: 'lens:scan' } },
  { name: 'Ghosty read this', does: 'Opens the Lens on READ, for a sign, a page or a menu.', ask: { do: 'lens:read' } },
  { name: 'Ghosty walk me home', does: 'Starts WALK ME HOME: your person hears if you are not in by the time it says.', ask: { do: 'walkhome' } },
  { name: 'Ghosty remind me', does: 'Opens the chat with “Remind me ” in the box, for you to finish.', ask: { say: 'Remind me ' } },
  { name: 'Ghosty today', does: 'Asks what is on today, and sends it.', ask: { say: 'What’s on today?' } },
  { name: 'Ghosty brief', does: 'Opens your morning brief.', ask: { open: 'brief' } },
  { name: 'Ghosty eye', does: 'Opens God’s eye on your city.', ask: { open: 'eye' } },
  { name: 'Ghosty arcade', does: 'Opens the arcade.', ask: { do: 'arcade' } },
  { name: 'Ghosty sit', does: 'Opens School where SIT THE EXAM is.', ask: { do: 'sit' } },
  { name: 'Ghosty wiki', does: 'Opens Wikipedia on the phone, for when there is no signal.', ask: { open: 'library', panel: 'WIKIPEDIA' } },
  { name: 'Ghosty morse', does: 'Opens the Morse sheet.', ask: { do: 'morse' } },
];

/** The plain steps, said once in the panel. */
export const STEPS = 'Shortcuts → + → Add Action → Open URLs → paste the link → name it (the name is what you say) → Done. Then: “Hey Siri, Ghosty timer”.';
/** And the truth about installing. */
export const NOT_INSTALLED = 'Nothing is installed by Ghosty: iPhone lets no web page add a shortcut, so you make each one in the Shortcuts app in a minute.';
