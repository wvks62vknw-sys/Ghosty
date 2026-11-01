/** The MOT history's defects as the fault table reads them (newest test first, the latest two tests). Pure. */
import type { VehicleAnswer } from '../../../../packages/shared/src/plates';
import type { MotLine } from './parts';

export function motLinesOf(a: VehicleAnswer | null | undefined): MotLine[] {
  if (!a?.ok) return [];
  return a.report.tests.slice(0, 2).flatMap((t) => t.defects.map((d) => ({ type: d.type, text: d.text, dangerous: d.dangerous, date: t.date })));
}
