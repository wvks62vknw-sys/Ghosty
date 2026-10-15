// Runs inside a sandboxed iframe (opaque origin). Receives one widget document from the
// parent and replaces itself with it. It cannot reach Ghosty's page, cookies or storage.
// Before the widget's own code, a small prelude is added:
//  - a dark base style, so widgets match Ghosty even if they set no colours
//  - localStorage/sessionStorage that work (in memory) — the real ones throw in the sandbox
//  - alert/confirm/prompt replacements (the sandbox blocks the real ones)
//  - errors shown on screen instead of a blank page
//  - Ghosty's widget kit (/widget-kit.js) when the widget uses GK but forgot to include it
var BASE = '<style>html,body{background:#02070d;color:#e6f6ff;font-family:system-ui,sans-serif;margin:0}</style>';
var PRELUDE =
  '<script>(function(){' +
  'function mem(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}' +
  '["localStorage","sessionStorage"].forEach(function(n){var ok=false;try{ok=!!window[n]&&(window[n].setItem("__t","1"),window[n].removeItem("__t"),true)}catch(e){}if(!ok){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(e){}}});' +
  'function note(t,bad){var d=document.createElement("div");d.textContent=t;d.style.cssText="position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;padding:10px 12px;border-radius:6px;font:13px system-ui,sans-serif;white-space:pre-wrap;background:"+(bad?"#3a0d16;color:#ffb3c0;border:1px solid #ff4d6a":"#06202c;color:#e6f6ff;border:1px solid #5ce1ff");(document.body||document.documentElement).appendChild(d);if(!bad)setTimeout(function(){d.remove()},3500)}' +
  'window.alert=function(m){note(String(m))};window.confirm=function(m){note(String(m));return true};window.prompt=function(m,v){note(String(m));return v==null?"":String(v)};' +
  'var shown=0;function oops(m){if(shown++<3)note("Widget error: "+m,true)}' +
  'window.addEventListener("error",function(e){oops(e.message||"script failed")});' +
  'window.addEventListener("unhandledrejection",function(e){oops(String(e.reason&&e.reason.message||e.reason))});' +
  '})();<\/script>';
var KIT = '<script src="/widget-kit.js"><\/script>';

addEventListener('message', function onMsg(e) {
  if (e.source !== parent || !e.data || typeof e.data.ghostyWidget !== 'string') return;
  removeEventListener('message', onMsg);
  var html = e.data.ghostyWidget;
  var pre = BASE + PRELUDE + (/\bGK\s*\./.test(html) && !/widget-kit\.js/.test(html) ? KIT : '');
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, function (m) { return m + pre; });
  else if (/^\s*<!doctype[^>]*>/i.test(html)) html = html.replace(/^\s*<!doctype[^>]*>/i, function (m) { return m + pre; });
  else html = pre + html;
  document.open();
  document.write(html);
  document.close();
});
