/**
 * SETTINGS → OFFLINE BRAIN → Search by meaning: the small model that lets the library on this phone be searched by
 * what passages mean (offline/embed.ts, library/meaning.ts). One plain line with its size, ADD (asked for once, on
 * Wi-Fi) and REMOVE, the download's progress, how far the index has got ("4,120 of 8,556 passages indexed"), and
 * the honest limits: worked out and kept on this phone only, built again after a reinstall, English-first.
 */
import { clear, fmt, h } from '../../core/dom';
import { meaningIndex } from '../../library/meaning';
import { deleteEmbedder, downloadEmbedder, embedReady, embedState, embedSupport } from '../../offline/embed';
import { EMBED_MODEL } from '../../offline/models';
import { progressLabel } from '../../offline/prompt';
import { bar, button, toast } from '../../ui/components';

export function meaningBlock(): HTMLElement {
  const line = h('div.note.mnline', 'Checking this phone…');
  const count = h('div.note.mncount');
  const prog = h('div.mnprog');
  let ok = false;
  let ready = false;

  const add = button(`ADD · ${EMBED_MODEL.mb} MB`, () => {
    if (embedState.get().busy) return;
    void downloadEmbedder((frac) => paintProgress(frac))
      .then(() => toast('Search by meaning is on this phone: the library is being indexed', 'ok'))
      .catch((e) => toast(String((e as Error)?.message ?? e).slice(0, 180), 'bad'))
      .finally(refresh);
    paint();
  }, 'on');
  add.setAttribute('aria-label', `Add search by meaning (about ${EMBED_MODEL.mb} MB, on Wi-Fi)`);
  const remove = button('REMOVE', () => {
    if (!confirm('Remove search by meaning from this phone? Searches go back to keywords; the index is kept, and catches up if you add it again.')) return;
    void deleteEmbedder().then(() => toast('Search by meaning removed: searches use keywords', 'ok')).finally(refresh);
  }, 'warn');
  remove.setAttribute('aria-label', 'Remove search by meaning');

  const paintProgress = (frac: number) => clear(prog, bar('MEANING', frac, `${Math.round(frac * 100)}%`), h('div.note', progressLabel(frac, EMBED_MODEL.mb)));

  function paint(): void {
    const s = embedState.get();
    const ix = meaningIndex.get();
    if (!ok) {
      /* the reason is already in the line */
    } else if (s.busy === 'download') line.textContent = `Downloading search by meaning (about ${EMBED_MODEL.mb} MB)… keep Ghosty open, on Wi-Fi.`;
    else if (ready) line.textContent = `Search by meaning: ${EMBED_MODEL.mb} MB, on this phone. The library and the offline brain find passages by what they mean, not only by their words.`;
    else line.textContent = `Search by meaning: about ${EMBED_MODEL.mb} MB, once, on Wi-Fi. Until then the library on this phone is searched by keywords.`;
    const whole = ix.total > 0 && ix.indexed >= ix.total;
    count.textContent = ready && ix.total
      ? `${fmt.n(Math.min(ix.indexed, ix.total))} of ${fmt.n(ix.total)} passages indexed${whole ? ' · searches go by meaning' : ix.waiting ? ' · waiting while Ghosty is in the background or the offline brain is busy' : ix.running ? ' · indexing now' : ''}${ix.error ? ` · stopped: ${ix.error}` : ''}`
      : '';
    count.hidden = !count.textContent;
    add.disabled = !ok || ready || !!s.busy;
    remove.disabled = !ok || (!ready && !s.downloaded) || !!s.busy;
    add.hidden = ready;
    remove.hidden = !ready && !s.downloaded;
    if (s.busy === 'download' || s.busy === 'load') paintProgress(s.progress);
    else clear(prog);
  }

  function refresh(): void {
    void (async () => {
      const sup = await embedSupport();
      ok = sup.ok;
      if (!ok) line.textContent = sup.reason;
      ready = ok && (await embedReady());
      paint();
    })();
  }

  embedState.subscribe((s, prev) => (s.downloaded !== prev.downloaded ? refresh() : paint()));
  meaningIndex.subscribe(paint);
  refresh();
  return h(
    'div.mnblock',
    h('div.lab', 'SEARCH BY MEANING'),
    line,
    count,
    prog,
    h('div.keyrow', add, remove),
    h('div.note', 'Worked out and kept on this phone only: nothing is sent anywhere. Each phone builds its own index (and builds it again after Ghosty is reinstalled). The small model reads English best.'),
  );
}
