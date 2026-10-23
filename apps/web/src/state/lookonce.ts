/**
 * Route C becomes what the calm looks render, Graphite the default (chunk A4): a phone still on one of the
 * classic looks switches to Graphite once, remembering the look it had; Settings → Look offers the way back
 * (`lookBefore`, `backToLook`). A phone already on Graphite or Reactor, or one that went back on purpose,
 * is never switched again. Kept on this device (`ghosty.lookC`).
 */
import { THEMES, applyTheme } from './theme';
import { settings } from './app';

const KEY = 'ghosty.lookC';

const read = (): { done: boolean; before: string } => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { done?: boolean; before?: string } | null;
    return { done: !!v?.done, before: typeof v?.before === 'string' ? v.before : '' };
  } catch {
    return { done: false, before: '' };
  }
};
const write = (v: { done: boolean; before: string }) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable: the switch is asked about again next visit, which is harmless */
  }
};

/** At boot: switch a classic look to Graphite once. Returns the look it replaced (for the toast), or ''. */
export function lookOnce(): string {
  const was = read();
  if (was.done) return '';
  const cur = settings.get().theme;
  if (THEMES[cur]?.look === 'pro') {
    write({ done: true, before: '' });
    return '';
  }
  write({ done: true, before: cur });
  applyTheme('graphite');
  return THEMES[cur]?.label ?? cur;
}

/** The classic look this phone had before the switch, while it is still on a calm one ('' when none). */
export function lookBefore(): string {
  const b = read().before;
  return b && THEMES[b] && THEMES[settings.get().theme]?.look === 'pro' ? b : '';
}

/** Back to the look it had: the switch never happens again. */
export function backToLook(): void {
  const b = read().before;
  if (!b || !THEMES[b]) return;
  write({ done: true, before: '' });
  applyTheme(b);
}
