// [speed] The first screen's two asks that need the owner key (the brain's status and the conversation), sent while the page's own code is
// still being read: main.ts boot() asks for them first thing, and api/brain.ts send() takes these answers instead of asking again
// (window.__ghostyEarly, each taken once, and only with the key it was asked with). A phone with no key asks nothing here.
(function () {
  try {
    var key = localStorage.getItem('ghosty.ownerKey');
    if (!key) return;
    var sealed = '';
    try {
      sealed = (JSON.parse(localStorage.getItem('ghosty.vault.copy') || 'null') || {}).sealed || '';
    } catch (e) {
      sealed = '';
    }
    var h = { 'x-ghosty': '1', 'x-ghosty-key': key };
    if (sealed) h['x-ghosty-vault'] = sealed;
    var ask = function (p) {
      var r = fetch('/api' + p, { headers: h, credentials: 'same-origin' });
      r.catch(function () {});
      return r;
    };
    window.__ghostyEarly = { key: key, sealed: sealed, asks: { '/history': ask('/history'), '/status': ask('/status') } };
  } catch (e) {
    /* no storage here: the page asks for itself */
  }
})();
