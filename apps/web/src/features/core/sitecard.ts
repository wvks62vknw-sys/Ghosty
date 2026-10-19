/**
 * The buttons under a website built on the phone (offline/site.ts): PREVIEW in a locked frame (the same
 * sandbox widgets run in), SAVE as an .html file, and PUBLISH, which hands the request and the answers to
 * the brain's build_website when it is reachable.
 */
import { send, type Entry } from '../../assistant/session';
import { h } from '../../core/dom';
import { publishRequest, savedSite } from '../../offline/site';
import { ui } from '../../state/app';
import { button, modal, sandboxFrame, toast } from '../../ui/components';

type SiteInfo = NonNullable<Extract<Entry, { kind: 'assistant' }>['site']>;

export function siteRow(info: SiteInfo): HTMLElement {
  const preview = () => {
    const s = savedSite(info.key);
    if (!s) return toast('That site is no longer on this phone.', 'bad');
    const f = sandboxFrame(s.html);
    f.classList.add('sitepreview');
    f.title = `Preview of ${s.title}`;
    modal(`PREVIEW · ${s.title}`, h('div.sitepreview-wrap', f));
  };
  const save = () => {
    const s = savedSite(info.key);
    if (!s) return toast('That site is no longer on this phone.', 'bad');
    const url = URL.createObjectURL(new Blob([s.html], { type: 'text/html' }));
    const a = h('a', { href: url, download: `${s.title.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'website'}.html` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const publish = () => {
    const s = savedSite(info.key);
    if (!s) return toast('That site is no longer on this phone.', 'bad');
    if (!ui.get().connected || navigator.onLine === false) return toast('Not connected yet — try PUBLISH again when you are back online.', 'bad');
    void send(publishRequest(s), { cloud: true });
  };
  return h('div.row.siterow', button('PREVIEW', preview, 'on'), button('SAVE FILE', save), button('PUBLISH', publish));
}
