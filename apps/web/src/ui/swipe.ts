/**
 * Swipe to delete (the calm looks): a list row with a delete button (.n.del) slides left under the
 * finger and shows a red "Delete"; a tap on it deletes, a tap anywhere else closes it. Vertical
 * swipes still scroll. The classic looks keep their ✕.
 */
import { proLook } from '../state/theme';

export function swipeToDelete(root: HTMLElement): void {
  let row: HTMLElement | null = null;
  let x0 = 0;
  let y0 = 0;
  let dx = 0;
  let sideways = false;
  const close = (except?: Element | null) => {
    for (const r of root.querySelectorAll<HTMLElement>('.rw.swiped')) if (r !== except) r.classList.remove('swiped');
  };
  root.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (!t.closest('.rw.swiped .del')) close(t.closest('.rw'));
    if (!proLook() || e.pointerType === 'mouse') return;
    const r = t.closest<HTMLElement>('.rw');
    if (!r?.querySelector(':scope > .del')) return;
    row = r;
    x0 = e.clientX;
    y0 = e.clientY;
    dx = 0;
    sideways = false;
  });
  root.addEventListener('pointermove', (e) => {
    if (!row) return;
    const ddx = e.clientX - x0;
    const ddy = e.clientY - y0;
    if (!sideways && Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) return void (row = null);
    if (Math.abs(ddx) > 12) sideways = true;
    if (!sideways) return;
    dx = Math.min(0, ddx + (row.classList.contains('swiped') ? -84 : 0));
    row.style.transform = `translateX(${Math.max(-120, dx)}px)`;
  });
  const end = () => {
    if (!row) return;
    row.style.transform = '';
    if (sideways) row.classList.toggle('swiped', dx < -48);
    row = null;
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
}
