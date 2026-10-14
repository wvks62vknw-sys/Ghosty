// Runs inside a sandboxed iframe (opaque origin). Receives one widget document from the
// parent and replaces itself with it. It cannot reach Ghosty's page, cookies or storage.
// A dark base style is added first so widgets match Ghosty even if they set no colours.
var BASE = '<style>html,body{background:#02070d;color:#e6f6ff;font-family:system-ui,sans-serif;margin:0}</style>';
addEventListener('message', function onMsg(e) {
  if (e.source !== parent || !e.data || typeof e.data.ghostyWidget !== 'string') return;
  removeEventListener('message', onMsg);
  var html = e.data.ghostyWidget;
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, function (m) { return m + BASE; });
  else if (/^\s*<!doctype[^>]*>/i.test(html)) html = html.replace(/^\s*<!doctype[^>]*>/i, function (m) { return m + BASE; });
  else html = BASE + html;
  document.open();
  document.write(html);
  document.close();
});
