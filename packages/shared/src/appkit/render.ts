/**
 * One mini-app as a page: the HTML (route C: graphite canvas, one accent, glass cards, 44 px targets,
 * system type), its script (the kit's core + the shape's logic and view, the same text for every app of
 * that shape), the Content Security Policy that pins that script by hash, the web app manifest, and the
 * tiny service worker that keeps the page for offline use. The page is drawn from the app's config each
 * time it is served, so the script and its hash always come from the kit that is running.
 */
import { esc } from '../sitekit/html';
import { BG, colours, glyphSvg } from './look';
import { cspHash } from './sha256';
import { CORE_BOOT, CORE_HEAD } from './runtime/core';
import * as tracker from './runtime/tracker';
import * as list from './runtime/list';
import * as timer from './runtime/timer';
import * as calc from './runtime/calc';
import * as counter from './runtime/counter';
import * as habits from './runtime/habits';
import * as notes from './runtime/notes';
import * as cards from './runtime/cards';
import * as game from './runtime/game';
import type { AppConfig, AppShape } from './types';

/** Each shape's pure logic (LOGIC, defines L) and its view (VIEW, defines SHAPE). */
export const SHAPE_CODE: Record<AppShape, { LOGIC: string; VIEW: string }> = { tracker, list, timer, calc, counter, habits, notes, cards, game };

const scripts = new Map<AppShape, { script: string; hash: string }>();
/** The page's one script for a shape, and its CSP hash (worked out once per running Worker). */
export function appScript(shape: AppShape): { script: string; hash: string } {
  let s = scripts.get(shape);
  if (!s) {
    const code = Object.prototype.hasOwnProperty.call(SHAPE_CODE, shape) ? SHAPE_CODE[shape] : SHAPE_CODE.list;
    const script = `\n(function () {\n${CORE_HEAD}\n${code.LOGIC}\n${code.VIEW}\n${CORE_BOOT}\n})();\n`;
    s = { script, hash: cspHash(script) };
    scripts.set(shape, s);
  }
  return s;
}

/** Where an app lives: /s/<id>/ (its start page and the scope of its service worker). */
export const appBase = (id: string) => `/s/${id}/`;

/**
 * What the page may do: run only the kit's script (by hash: nothing injected, no eval), its own styles,
 * pictures that are part of the page, its own manifest and service worker — and nothing on the network
 * (connect-src 'none'), no forms, no frames, never framed.
 */
export function appCsp(shape: AppShape): string {
  return `default-src 'none'; script-src ${appScript(shape).hash}; style-src 'unsafe-inline'; img-src 'self' data:; manifest-src 'self'; worker-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'`;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

export function appCss(cfg: AppConfig): string {
  const c = colours(cfg.accent);
  return `:root{color-scheme:dark;--bg:${BG};--ink:#f4f6f8;--ink2:rgba(235,240,245,.64);--ink3:rgba(235,240,245,.42);--hair:rgba(255,255,255,.08);--hair2:rgba(255,255,255,.14);--glass:linear-gradient(180deg,rgba(255,255,255,.072),rgba(255,255,255,.034));--shadow:inset 0 1px 0 rgba(255,255,255,.055),0 18px 40px rgba(0,0,0,.42);--acc:${c.acc};--acc-ink:${c.ink};--on-acc:${c.on};--acc-rgb:${rgb(c.acc)};--acc-soft:rgb(${rgb(c.acc)} / .14);--acc-glow:rgb(${rgb(c.acc)} / .16);--warn:#ffb340;--f:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,"Helvetica Neue",system-ui,sans-serif}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;background:var(--bg)}
html,body{margin:0;overflow-x:clip}
body{min-height:100dvh;font:400 17px/1.4 var(--f);letter-spacing:-.2px;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;overflow-wrap:anywhere}
.glow{position:fixed;left:50%;top:-200px;width:780px;height:560px;transform:translateX(-50%);background:radial-gradient(closest-side,var(--acc-glow),rgb(var(--acc-rgb) / .05) 50%,transparent);pointer-events:none;z-index:0}
.wrap{position:relative;z-index:1;width:min(100% - 32px,560px);margin-inline:auto;padding:calc(env(safe-area-inset-top) + 8px) 0 calc(env(safe-area-inset-bottom) + 96px)}
.top{display:flex;align-items:center;gap:14px;padding:16px 0 20px}
.mark{flex:none;width:52px;height:52px;border-radius:16px;display:grid;place-items:center;color:var(--acc);background:var(--glass);border:1px solid var(--hair);box-shadow:var(--shadow)}
.mark svg{width:30px;height:30px}
.hd{min-width:0;flex:1}
h1{margin:0;font-size:clamp(26px,7.4vw,34px);line-height:1.15;font-weight:700;letter-spacing:-.4px;text-wrap:balance}
.sub{margin:3px 0 0;color:var(--ink2);font-size:15px;line-height:20px}
h2{margin:0;font-size:22px;line-height:28px;font-weight:700;letter-spacing:-.3px}
.gbtn{flex:none;width:44px;height:44px;border-radius:22px;display:inline-grid;place-items:center;padding:0;color:var(--ink);background:rgba(255,255,255,.075);border:1px solid var(--hair);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);cursor:pointer;font:inherit;touch-action:manipulation}
.gbtn:disabled{opacity:.3;cursor:default}
.i{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.card{position:relative;background:var(--glass);border:1px solid var(--hair);border-radius:20px;box-shadow:var(--shadow);padding:18px;margin:0 0 14px}
.kick{margin:0;font-size:11px;line-height:13px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--ink2)}
.kickrow{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px;min-height:28px}
.num{font-variant-numeric:tabular-nums}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 22px;border-radius:25px;border:0;background:var(--acc);color:var(--on-acc);font:600 15px/1 var(--f);letter-spacing:.06em;cursor:pointer;touch-action:manipulation;transition:transform .12s,opacity .12s}
.btn:active{transform:scale(.97)}
.btn.ghost{background:rgba(255,255,255,.075);color:var(--ink);border:1px solid var(--hair2)}
.btn.sm{min-height:44px;padding:0 16px;font-size:13px}
.btn.big{min-height:56px;min-width:148px;font-size:17px}
.btn.wide{flex:1 1 100%}
.btn.danger{color:#ff8a82}
.btn:disabled{opacity:.3;cursor:default}
.btn.round{width:68px;height:68px;min-height:68px;padding:0;border-radius:34px}
.btn.round .i{width:30px;height:30px;stroke-width:2.2}
:focus-visible{outline:2px solid var(--acc-ink);outline-offset:2px}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
input,select,textarea{font:400 17px/1.3 var(--f);color:var(--ink);background:rgba(255,255,255,.06);border:1px solid var(--hair2);border-radius:14px;min-height:50px;padding:0 14px;width:100%;min-width:0;letter-spacing:-.2px}
textarea{padding:12px 14px;resize:vertical;min-height:150px;line-height:1.45}
select{-webkit-appearance:none;appearance:none}
.row input{flex:1 1 140px;width:auto}
input::placeholder,textarea::placeholder{color:var(--ink3)}
.field{display:grid;gap:6px;margin:0 0 14px;flex:1;min-width:0}
.flabel{font-size:13px;line-height:18px;color:var(--ink2)}
.empty{margin:0;padding:18px 8px;text-align:center;color:var(--ink2);font-size:15px;line-height:21px}
.hero{display:grid;grid-template-columns:minmax(0,1fr);justify-items:center;gap:14px;padding:24px 18px;text-align:center}
.ring{position:relative;display:grid;place-items:center;max-width:70vw;max-height:70vw}
.ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.rtrack{fill:none;stroke:rgba(255,255,255,.08);stroke-width:6}
.rfill{fill:none;stroke:var(--acc);stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset .5s cubic-bezier(.2,.8,.2,1)}
.rin{position:relative;display:grid;justify-items:center;gap:4px;max-width:80%}
.big{margin:0;font-size:clamp(44px,13vw,56px);line-height:1;font-weight:700;letter-spacing:-1px}
.unit{margin:0;color:var(--ink2);font-size:15px;line-height:20px}
.status{margin:0;color:var(--ink2);font-size:15px;line-height:21px;text-align:center}
.hero.over .rfill{stroke:var(--warn)}
.hero.over .status{color:var(--warn)}
.quick{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;width:100%}
.quick .btn{flex:1 1 120px}
.quick .chip{flex:0 0 56px;min-width:56px;padding:0}
.addrow{width:100%;flex-wrap:nowrap}
.rows,.items,.steps,.notes,.habits{list-style:none;margin:0;padding:0}
.rowi{display:flex;align-items:center;gap:12px;min-height:52px;border-top:1px solid var(--hair)}
.rowi:first-child{border-top:0}
.rowi .when{color:var(--ink2);font-size:15px;min-width:52px}
.rowi .what{flex:1;min-width:0}
.rowi input{flex:1}
.del{margin-left:auto;background:none;border-color:transparent;box-shadow:none;color:var(--ink2)}
.count{margin:0;color:var(--ink2);font-size:13px;line-height:18px}
.pill{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:12px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink2);border:1px solid var(--hair2);white-space:nowrap}
.pill.on{color:var(--acc-ink);background:var(--acc-soft);border-color:transparent}
.bars{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;height:156px}
.bar{display:grid;grid-template-rows:16px 1fr 18px;justify-items:center;gap:6px;min-width:0}
.bv{font-size:11px;line-height:16px;color:var(--ink2);white-space:nowrap}
.bt{position:relative;width:100%;max-width:30px;border-radius:9px;background:rgba(255,255,255,.05)}
.bt i{position:absolute;left:0;right:0;bottom:0;border-radius:9px;background:rgba(255,255,255,.24)}
.bar.ok .bt i{background:var(--acc)}
.bt .gl{position:absolute;left:-3px;right:-3px;height:0;border-top:1.5px dashed rgba(235,240,245,.45)}
.bl{font-size:12px;line-height:18px;color:var(--ink2)}
.bar.now .bl{color:var(--acc-ink);font-weight:600}
.addbox{padding:12px}
.addbox .row{flex-wrap:nowrap}
.tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 2px 12px;min-height:44px}
.tools .count{flex:1 1 120px}
.item{display:flex;align-items:center;gap:8px;min-height:56px;border-top:1px solid var(--hair)}
.item:first-child{border-top:0}
.tick{flex:none;width:44px;height:44px;display:grid;place-items:center;padding:0;border:0;background:none;color:transparent;cursor:pointer}
.tick .i{width:28px;height:28px;padding:4px;border-radius:14px;border:1.5px solid rgba(235,240,245,.45);stroke-width:2.6;transition:background .15s}
.tick.on .i{background:var(--acc);border-color:var(--acc);color:var(--on-acc)}
.itext{flex:1;min-width:0;padding:12px 0;cursor:pointer}
.item.done .itext{color:var(--ink2);text-decoration:line-through;text-decoration-color:rgba(235,240,245,.35)}
.ord{display:flex;gap:6px}
.clock{font-size:clamp(52px,16vw,68px)}
.ctrls{justify-content:center;flex-wrap:nowrap;width:100%}
#app-main>.status,#app-main>.ctrls,#app-main>.note{margin:0 0 16px}
.ctrls .btn{flex:1 1 auto;min-width:0;padding:0 14px}
.ctrls .btn.big{flex:1.4 1 auto}
.steps li{display:flex;justify-content:space-between;gap:12px;padding:12px;border-radius:12px;color:var(--ink2)}
.steps li.cur{background:var(--acc-soft);color:var(--ink)}
.steps li.cur span:first-child{color:var(--acc-ink);font-weight:600}
.note{margin:12px 0 0;color:var(--ink2);font-size:13px;line-height:18px}
.seg{display:flex;gap:4px;padding:4px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid var(--hair);flex-wrap:wrap}
.seg button{flex:1 1 auto;min-height:44px;min-width:44px;padding:0 10px;border:0;border-radius:12px;background:none;color:var(--ink2);font:600 15px var(--f);cursor:pointer}
.seg button.on{background:rgba(255,255,255,.13);color:var(--ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.people{justify-content:space-between;margin:0 0 14px;flex-wrap:nowrap}
.people .flabel{flex:1}
.pcount{font-size:28px;min-width:48px;text-align:center}
.two{align-items:flex-end;flex-wrap:nowrap}
.swap{margin-bottom:17px}
.results{display:grid;gap:6px;margin:4px 0 14px;padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid var(--hair)}
.res{display:flex;justify-content:space-between;align-items:baseline;gap:12px;color:var(--ink2);font-size:15px}
.res b{color:var(--ink);font-weight:600}
.res.main{flex-direction:column;align-items:flex-start;gap:2px}
.res.main b{font-size:clamp(26px,8vw,34px);line-height:1.2;font-weight:700;letter-spacing:-.4px;color:var(--acc-ink)}
.players{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr));margin:0 0 6px}
.players .card{margin:0}
.player{display:grid;gap:10px;justify-items:center;text-align:center}
.player.lead{border-color:rgb(var(--acc-rgb) / .4)}
.prow{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;flex-wrap:wrap}
.player .prow{justify-content:center}
.pname{margin:0;font-weight:600;font-size:17px}
.score{margin:0;font-size:56px;line-height:1.05;font-weight:700;letter-spacing:-1px}
.solo{display:grid;justify-items:center;gap:14px;text-align:center;padding:28px 18px}
.giant{margin:0;font-size:min(32vw,132px);line-height:1;font-weight:700;letter-spacing:-3px}
.bump{justify-content:center;gap:12px;flex-wrap:nowrap}
.player .btn.round{width:56px;height:56px;min-height:56px;border-radius:28px}
.hgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;justify-items:center}
.hhead{padding:0 0 4px}
.hhead span{display:grid;justify-items:center;font-size:11px;line-height:14px;color:var(--ink2);gap:1px}
.hhead b{font-weight:600}
.hhead i{font-style:normal}
.hhead span.today{color:var(--acc-ink)}
.habit{padding:12px 0;border-top:1px solid var(--hair)}
.habit:first-of-type{border-top:0}
.habit .prow{margin:0 0 10px}
.dot{width:44px;height:44px;border-radius:22px;padding:0;display:grid;place-items:center;border:1.5px solid var(--hair2);background:rgba(255,255,255,.03);color:var(--on-acc);cursor:pointer;transition:background .15s}
.dot.today{border-color:rgb(var(--acc-rgb) / .7)}
.dot.on{background:var(--acc);border-color:var(--acc)}
.dot .i{width:20px;height:20px;stroke-width:2.6}
.tally{gap:8px}
.notebar{margin:0 0 14px;flex-wrap:nowrap}
.notes li{border-top:1px solid var(--hair)}
.notes li:first-child{border-top:0}
.nbtn{display:grid;gap:3px;width:100%;min-height:56px;padding:12px 4px;text-align:left;background:none;border:0;color:var(--ink);font:inherit;cursor:pointer}
.ntitle{font-weight:600;display:flex;gap:6px;align-items:center}
.nsnip{color:var(--ink2);font-size:15px;line-height:20px}
.nbtn .when{color:var(--ink2);font-size:13px}
.pin .i{width:16px;height:16px;color:var(--acc-ink)}
.notearea{min-height:42dvh;margin:0 0 12px}
.scene{perspective:1200px;margin:0 0 16px}
.flash{position:relative;display:block;width:100%;min-height:280px;padding:0;border:0;background:none;color:var(--ink);font:inherit;cursor:pointer;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.flash.flipped{transform:rotateY(180deg)}
.fside{position:absolute;inset:0;display:grid;align-content:center;justify-items:center;gap:14px;padding:24px;border-radius:24px;background:linear-gradient(180deg,#1b1d21,#121417);border:1px solid var(--hair2);box-shadow:var(--shadow);backface-visibility:hidden;-webkit-backface-visibility:hidden;text-align:center}
.fside.back{transform:rotateY(180deg);border-color:rgb(var(--acc-rgb) / .4)}
.ftext{font-size:clamp(22px,6.5vw,28px);line-height:1.25;font-weight:600;letter-spacing:-.3px}
.fside.back .ftext{color:var(--acc-ink)}
.cardrow .what{display:grid;gap:2px}
.cardrow .what span{color:var(--ink2);font-size:15px}
.stack{display:grid;gap:8px}
.scores{justify-content:center;margin:0 0 14px}
.chipbox{display:grid;justify-items:center;gap:4px;min-width:112px;padding:10px 16px;border-radius:16px;background:var(--glass);border:1px solid var(--hair)}
.chipbox b{font-size:24px;line-height:1.1}
.boardwrap{position:relative;width:min(100%,420px);margin:0 auto 14px}
.board{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:8px;padding:8px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid var(--hair);touch-action:none;-webkit-user-select:none;user-select:none;aspect-ratio:1/1}
.cell{border-radius:12px;background:rgba(255,255,255,.05);display:grid;min-width:0}
.tile{display:grid;place-items:center;border-radius:12px;font-weight:700;font-size:clamp(20px,7vw,32px);font-variant-numeric:tabular-nums;color:var(--ink);background:rgba(255,255,255,.1)}
.t4{background:rgba(255,255,255,.17)}
.t8{background:rgb(var(--acc-rgb) / .22)}
.t16{background:rgb(var(--acc-rgb) / .3)}
.t32{background:rgb(var(--acc-rgb) / .4)}
.t64{background:rgb(var(--acc-rgb) / .5)}
.t128,.t256,.t512,.t1024,.t2048,.t4096{background:var(--acc);color:var(--on-acc);box-shadow:0 0 18px rgb(var(--acc-rgb) / .35)}
.t1024,.t2048,.t4096{font-size:clamp(16px,5vw,24px)}
.pop{animation:pop .18s ease-out}
@keyframes pop{from{transform:scale(.6);opacity:.4}}
.overlay{position:absolute;inset:0;display:grid;place-items:center;margin:0;border-radius:20px;background:rgba(5,6,7,.74);font-size:22px;font-weight:700}
.dpad{display:grid;grid-template-columns:repeat(3,52px);grid-template-areas:". u ." "l d r";gap:8px;justify-content:center;margin:4px 0 6px}
.dpad .gbtn{width:52px;height:52px;border-radius:16px}
.dup{grid-area:u}.dleft{grid-area:l}.ddown{grid-area:d}.dright{grid-area:r}
.dleft .i{transform:rotate(-90deg)}.dright .i{transform:rotate(90deg)}
.hint{display:grid;gap:10px;justify-items:start}
.hintp{margin:0;color:var(--ink2);font-size:15px;line-height:21px}
.hintp b{color:var(--ink);font-weight:600}
.sharei .i{width:18px;height:18px;vertical-align:-3px;color:var(--acc-ink)}
.foot{padding:16px 4px 0;text-align:center}
.foot p{margin:0 0 4px;color:var(--ink2);font-size:13px;line-height:18px}
.toast{position:fixed;z-index:20;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:10px;max-width:calc(100% - 32px);min-height:52px;padding:4px 4px 4px 18px;border-radius:26px;background:rgba(34,37,41,.96);border:1px solid var(--hair2);box-shadow:0 18px 40px rgba(0,0,0,.5);transform:translate(-50%,24px);opacity:0;pointer-events:none;transition:transform .25s cubic-bezier(.2,.8,.2,1),opacity .2s}
.toast.on{transform:translate(-50%,0);opacity:1;pointer-events:auto}
.tmsg{font-size:15px;line-height:20px;padding:10px 14px 10px 0}
.tundo{flex:none;min-height:44px;padding:0 16px;border:0;border-radius:22px;background:var(--acc-soft);color:var(--acc-ink);font:600 13px var(--f);letter-spacing:.08em;cursor:pointer}
.sheet{width:min(100%,560px);max-width:100%;max-height:88dvh;margin:auto auto 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));border:1px solid var(--hair2);border-bottom:0;border-radius:24px 24px 0 0;background:#111316;color:var(--ink);overflow:auto}
.sheet::backdrop{background:rgba(0,0,0,.6)}
.shead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px}
.sbody{display:grid;gap:4px}
.sbody>.btn{margin:0 0 12px}
.sets{display:grid;gap:2px;margin:0 0 16px}
.about{display:grid;gap:6px;padding:16px 0 0;border-top:1px solid var(--hair)}
.about .btn{justify-self:start;margin-top:6px}
.aboutp{margin:0 0 6px;font-size:15px;line-height:21px}
.mute{color:var(--ink2)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
@media (min-width:700px){.wrap{padding-top:40px}}`;
}

/** JSON that is safe inside a <script type="application/json"> (no "<", no line separators). */
export const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const GEAR = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.4 7.4 0 0 1-1.8 1l-.3 2h-4l-.3-2a7.4 7.4 0 0 1-1.8-1l-1.9.7-2-3.4 1.6-1.2a7.6 7.6 0 0 1 0-3L3 9.3l2-3.4 1.9.7a7.4 7.4 0 0 1 1.8-1l.3-2h4l.3 2a7.4 7.4 0 0 1 1.8 1l1.9-.7 2 3.4-1.6 1.2a7.6 7.6 0 0 1 0 3z"/></svg>';

/** The tab icon: the glyph in the accent on a graphite tile, as a data: URL (nothing to fetch). */
export function faviconUrl(cfg: AppConfig): string {
  const c = colours(cfg.accent);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#15181c"/><g transform="translate(5 5) scale(.9167)">${glyphSvg(cfg.glyph, { fill: c.acc, mask: 'f' }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The whole page for one app. */
export function renderApp(cfg: AppConfig): string {
  const base = appBase(cfg.id);
  const { script } = appScript(cfg.shape);
  const data = safeJson({ ...cfg, base });
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(cfg.title)}</title>
<meta name="description" content="${esc(cfg.does)}">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="${BG}">
<meta name="color-scheme" content="dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${esc(cfg.short)}">
<meta name="format-detection" content="telephone=no">
<link rel="manifest" href="${base}page">
<link rel="apple-touch-icon" href="${base}page">
<link rel="icon" href="${esc(faviconUrl(cfg))}">
<style>
${appCss(cfg)}
</style>
</head>
<body>
<div class="glow" aria-hidden="true"></div>
<div class="wrap">
<header class="top">
<div class="mark">${glyphSvg(cfg.glyph, { label: cfg.title })}</div>
<div class="hd"><h1>${esc(cfg.title)}</h1>${cfg.tagline ? `<p class="sub">${esc(cfg.tagline)}</p>` : ''}</div>
<button class="gbtn" id="app-set" type="button" aria-label="Settings">${GEAR}</button>
</header>
<main id="app-main"><noscript><p class="empty">This app needs JavaScript switched on.</p></noscript></main>
<section class="card hint" id="app-hint" hidden></section>
<footer class="foot"><p id="app-status">Saved on this phone</p><p>A mini-app made by Ghosty</p></footer>
</div>
<div class="toast" id="app-toast" role="status" aria-live="polite"></div>
<dialog class="sheet" id="app-sheet" aria-label="${esc(cfg.title)} settings"></dialog>
<script type="application/json" id="app-cfg">${data}</script>
<script>${script}</script>
</body>
</html>
`;
}

/** The web app manifest: installs to the Home Screen as its own app, opening full screen at /s/<id>/. */
export function appManifest(cfg: AppConfig): Record<string, unknown> {
  const base = appBase(cfg.id);
  return {
    id: base,
    name: cfg.title,
    short_name: cfg.short,
    description: cfg.does,
    start_url: base,
    scope: base,
    display: 'standalone',
    background_color: BG,
    theme_color: BG,
    lang: 'en-GB',
    dir: 'ltr',
    icons: [
      { src: `${base}page`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}page`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/**
 * The service worker every app gets (the same text for all): it keeps this app's page, and only it, so
 * the app opens with no connection. Network first (a republished app shows at the next open online),
 * the kept copy when offline or after 4 seconds of nothing; a taken-down app (404) forgets itself.
 */
export const APP_SW = `'use strict';
var SCOPE = self.registration.scope;
var CACHE = 'ghosty-app:' + SCOPE;
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.add(new Request(SCOPE, { cache: 'reload' })); }).catch(function () {}));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
function fresh(req) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var t = setTimeout(function () { if (!done) { done = true; reject(new Error('slow')); } }, 4000);
    fetch(req).then(function (r) { if (!done) { done = true; clearTimeout(t); resolve(r); } }, function (e) { if (!done) { done = true; clearTimeout(t); reject(e); } });
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  e.respondWith(fresh(req).then(function (r) {
    if (r.status === 404 || r.status === 410) {
      caches.delete(CACHE);
      self.registration.unregister();
      return r;
    }
    if (r.ok && (r.headers.get('content-type') || '').indexOf('text/html') === 0) {
      var copy = r.clone();
      caches.open(CACHE).then(function (c) { return c.put(SCOPE, copy); }).catch(function () {});
    }
    return r;
  }).catch(function () {
    return caches.match(SCOPE).then(function (hit) { return hit || Response.error(); });
  }));
});
`;
