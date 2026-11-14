/**
 * "open wine cellar", said or typed: THE APP LIBRARY's app by its exact name, opened at #apps/<id> on the phone, with no brain and
 * no model. The Library list never goes into the brain's prompt; only a name he said is matched here. A sentence that names no app
 * (or names one of Ghosty's own screens) is left to the next table.
 */
import { answer } from '../../assistant/local';
import { appForSentence, openApp } from './index';

export async function appTurn(text: string, opts: { voice?: boolean; private?: boolean }): Promise<boolean> {
  const d = appForSentence(text);
  if (!d) return false;
  openApp(d.id);
  return answer(text, `Opening ${d.name}.`, { kind: 'can' }, opts);
}
