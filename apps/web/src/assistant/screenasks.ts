/**
 * The chat's words that open a screen, read on the phone with no model (POLISH 3 · 2f, 2g): the Workshop, the 3D studio, Reverse,
 * Space, COURSES, the Arcade and SCHOOL. Each screen's own words file lists its phrases (PHRASES); this table is what answers them.
 * Pure: no DOM, no brain. A line that says more than the name ("open the arcade and tell me my score") is not here; it goes on as ever.
 */
export interface ScreenAsk {
  /** The tab it opens (shell/tabs.ts). */
  tab: 'workshop' | 'studio' | 'reverse' | 'space' | 'learn' | 'arcade' | 'school';
  /** What he is told it opened, in his voice. */
  name: string;
}

const T = (t: string) => t.trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');

const TABLE: { tab: ScreenAsk['tab']; name: string; re: RegExp }[] = [
  { tab: 'workshop', name: 'the Workshop', re: /^(?:(?:open|show|go to|take me to)(?: me)? )?(?:(?:the|my) )?work ?shop$/i },
  { tab: 'studio', name: 'the 3D studio', re: /^(?:(?:open|show|go to|take me to)(?: me)? )?(?:(?:the|my) )?(?:3-?d|three-?d|3 d) studio$/i },
  { tab: 'reverse', name: 'Reverse', re: /^(?:reverse (?:this|it|a (?:site|link|page|product))|(?:open|show|go to|take me to)(?: the)? reverse)$/i },
  { tab: 'space', name: 'Space', re: /^(?:plan my (?:room|space|flat|house)|(?:open|show|go to|take me to)(?: my| the)? space(?: planner)?)$/i },
  { tab: 'learn', name: 'your courses', re: /^(?:open |show |go to |take me to )?(?:my |the )?courses$/i },
  { tab: 'arcade', name: 'the Arcade', re: /^(?:open |show |go to |take me to )?(?:the |my )?arcade$/i },
  { tab: 'school', name: 'School', re: /^(?:open |show |go to |take me to )(?:the |my )?school$|^school$/i },
];

export function screenAsked(text: string): ScreenAsk | null {
  const t = T(text);
  if (!t || t.length > 40) return null;
  for (const e of TABLE) if (e.re.test(t)) return { tab: e.tab, name: e.name };
  return null;
}
