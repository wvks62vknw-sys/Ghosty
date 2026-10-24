// The boot cinematic (BRIEF-NAV-BOOT.md §2): builds boot/contact.html, six frames at 440 x 956 with their timings,
// the warm return and the reduced-motion version.
//   node docs/build-plan/mockups/boot/build.mjs && node docs/build-plan/mockups/nav/render.mjs boot
// The look is the nav sheet's (A with C's restraint): ../nav/style.css, then this sheet's own style.css.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { f, ic, DEFS, DATA, mind, statusBar, dock, reactor, rng } from '../nav/kit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TIME = '19:58';
const GREET = `Good evening, ${DATA.name}`;
const DAY = 'Saturday 24 October';

/* ---------- the timing: 3.4 s, 408 frames at 120 Hz ---------- */
const SEG = [
  { n: 1, name: 'Ignition', a: 0, b: 400 },
  { n: 2, name: 'Spin-up', a: 400, b: 1200 },
  { n: 3, name: 'Name', a: 1200, b: 1600 },
  { n: 4, name: 'Status', a: 1600, b: 2600 },
  { n: 5, name: 'Greeting', a: 2600, b: 3000 },
  { n: 6, name: 'HUD', a: 3000, b: 3400 },
];
const END = 3400;
const ms = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)} s` : `${v} ms`);
function timeline(lit = 0, big = false) {
  const segs = SEG.map((s) => `<i class="${s.n === lit ? 'on' : s.n < lit ? 'past' : ''}" style="flex:${s.b - s.a}"><span>${s.n}</span></i>`).join('');
  const ticks = [0, 1000, 2000, 3000].map((t) => `<u style="left:${(t / END) * 100}%">${t / 1000} s</u>`).join('') + `<u class="end" style="left:100%">3.4 s</u>`;
  return `<div class="tl${big ? ' big' : ''}"><div class="segs6">${segs}</div><div class="ticks">${ticks}</div></div>`;
}

/* ---------- the status sweep: one reading a line, 200 ms apart ---------- */
const LINES = [
  ['Brain', 'Llama 4 Scout · ready', 1600],
  ['Memory', `${DATA.memory} things known`, 1800],
  ['Library', `${DATA.lib.passages} passages`, 2000],
  ['School', `${DATA.school.stage} · paper 3 next`, 2200],
  ['Today', `${DAY} · ${DATA.city} · ${DATA.temp}`, 2400],
];
const statusBlock = (typing = -1) => `<div class="status5">${LINES.map(([k, v, t], i) => `<div class="line${i === typing ? ' typing' : ''}"><i class="tick${i === typing ? '' : ' on'}"></i><span class="k">${k}</span><span class="v">${i === typing ? `${v.slice(0, 26)}<span class="caret"></span>` : v}</span><span class="t tnum">${(t / 1000).toFixed(1)}</span></div>`).join('')}</div>`;

/* the voice line's trace: the greeting spoken, a thin waveform */
function voiceTrace() {
  const r = rng(21);
  let d = '';
  const words = [[0, 34], [42, 98], [110, 168], [178, 222]];
  for (let x = 0; x <= 240; x += 2) {
    const inWord = words.some(([a, b]) => x >= a && x <= b);
    const amp = inWord ? 3 + r() * 11 * Math.sin(Math.PI * ((x % 60) / 60) + 0.4) : 0.6;
    d += `M${x} ${f(16 - Math.abs(amp))}V${f(16 + Math.abs(amp))}`;
  }
  return `<svg class="voice" viewBox="0 0 240 32" aria-hidden="true"><path class="vw" d="${d}"/><path class="lit" d="M0 16H240" opacity=".25"/></svg>`;
}

const skip = '<span class="skip">Tap anywhere to skip</span>';
const frame = (cls, inner, sb = true) => `<div class="phone boot ${cls}">${sb ? statusBar(TIME) : ''}<div class="void"></div>${inner}<i class="hi"></i></div>`;

/* 1 · Ignition: black; the core lights at the centre, one ring starts to draw, a thin flare crosses the screen */
const f1 = () => frame('f1', `<div class="stage">${reactor('ignite', 300)}</div><i class="flare"></i>`);
/* 2 · Spin-up: every ring comes up to speed (the arcs smear), one scan line sweeps down the screen once */
const f2 = () => frame('f2', `<div class="stage">${reactor('spin', 300)}</div><div class="scan"><i></i></div>${skip}`);
/* 3 · The name, in the instrument face, then "online" */
const f3 = () => frame('f3', `<div class="stage">${reactor('rest', 300)}</div><div class="name"><b>GHOSTY</b><span class="online"><i class="dot"></i>Online</span></div>${skip}`);
/* 4 · The status sweep, one real reading a line, 200 ms apart; the fifth line typing */
const f4 = () => frame('f4', `<div class="stage up">${reactor('rest', 220)}</div><div class="name small"><b>GHOSTY</b><span class="online"><i class="dot"></i>Online</span></div>${statusBlock(4)}${skip}`);
/* 5 · His name: the same line the Home title shows, spoken in Ghosty's voice when voice is on */
const f5 = () => frame('f5', `<div class="stage top">${reactor('rest', 140)}</div><div class="ghostlines">${statusBlock()}</div>
<div class="greet"><h1>${GREET}.</h1>${voiceTrace()}<span class="said">${ic('listen')}Said aloud · voice is on</span></div>${skip}`);

/* 6 · The HUD assembles into Home: the date ribbon, the title, the hero, the cards and the tab bar slide into place */
function home({ settled = false } = {}) {
  const st = (k, v, s, cls = '') => `<span class="hro ${cls}"><em>${k}</em><b class="tnum">${v}</b><small>${s}</small></span>`;
  return `<div class="phone homep${settled ? ' settled' : ''}">${statusBar(TIME)}<div class="room"></div><div class="view">
<div class="hrib a1">${DAY.toUpperCase()}<span class="round av you">${DATA.name[0]}</span></div>
<h1 class="htitle">${GREET}</h1>
<p class="hwx a1">${ic('rain')}${DATA.temp} · ${DATA.sky} in ${DATA.city}</p>
<div class="hero a2"><span class="mindbig">${mind(220, 170, 64, 90)}</span>
${st('Free AI', '72<small>%</small>', 'left today', 'l1')}${st('School', DATA.school.stage, `${DATA.school.passed} of ${DATA.school.papers} passed`, 'r1')}
${st('Library', DATA.lib.passages, `${DATA.lib.studied} studied`, 'l2')}${st('Uplink', '84<small>ms</small>', 'Secure', 'r2')}
<span class="hon"><i class="dot"></i>Online</span></div>
<div class="hcard inst today a3"><span class="kick">${ic('agenda')}Today<em class="off">2 left</em></span>
<div class="ag"><span class="tm tnum">20:30</span><b>Call Mum</b><em>in 32 min</em></div><div class="ag"><span class="tm tnum">21:00</span><b>Bins out</b></div></div>
<div class="hrow a4"><div class="hcard inst"><span class="kick">${ic('road')}Roads near you</span><b class="rd1"><i class="dot amber"></i>M6 J6–J7</b><small>Queue northbound · +12 min</small></div>
<div class="hcard inst"><span class="kick">${ic('gym')}Gym<em><i class="dot pulse"></i>Training</em></span><b class="rd1 tnum">3 <span>of 22 mastered</span></b><small>Chess · level 6 · 52%</small></div></div>
<div class="chips a5"><span>${ic('spark')}Brief me</span><span>${ic('agenda')}What’s on today</span><span>${ic('eye')}God’s eye</span></div>
<div class="askbar a5"><span class="ph">Ask anything</span><span class="mic">${ic('mic')}</span></div>
</div>${dock('ask', { live: 'learn' }).replace('class="dock"', 'class="dock a5"')}<i class="hi"></i></div>`;
}
const f6 = () => home().replace('<div class="phone homep">', '<div class="phone homep f6">');

/* ---------- what he called terrible: today's boot, redrawn from apps/web/index.html, main.ts and styles.css ---------- */
const today = () => `<div class="phone oldboot">${statusBar(TIME)}<div class="ob"><div class="ring"></div><h1>Ghosty</h1>
<div class="log"><div><span>RENDER CORE</span><b>WEBGL2</b></div><div><span>EARTH DATA</span><b>1251 CITIES</b></div><div><span>BRAIN</span><b>LINKED</b></div></div><p>INITIALISING…</p></div><i class="hi"></i></div>`;

/* ---------- the warm return: 400 ms, the reactor's light only ---------- */
function warm() {
  const k = [[0, 'rest', 'You come back', 'The screen you left is already there'], [160, 'pulse', 'Peak · 160 ms', 'One ring of light runs out from the centre'], [400, 'rest', 'Done · 400 ms', 'Back to the room’s usual glow']];
  return `<div class="pane warm"><div class="wrow">${k.map(([t, ph, a, b]) => `<div class="wk"><span class="wd ${ph}">${reactor(ph, 120)}</span><b>${a}</b><small>${b}</small></div>`).join('')}</div>
<div class="wmini"><div class="mini">${home({ settled: true })}<i class="pulsering"></i></div>
<div class="wtext"><b>Coming back within the day</b><p>No cinematic: Home (or wherever you were) is on screen at once, and the reactor’s light breathes out once behind it. 48 frames at 120 Hz; nothing to wait for and nothing to skip.</p>
<p>The full boot plays again tomorrow’s first time, or when you say <b>“reboot”</b>.</p></div></div></div>`;
}

function page() {
  const shot = (n, small, body) => { const s = SEG[n - 1]; return `<figure class="shot"><figcaption class="cap"><b>${n}</b><span>${s.name}</span><small class="tnum">${ms(s.a)} – ${ms(s.b)} · ${small}</small></figcaption>${timeline(n)}${body}</figure>`; };
  return `<!doctype html>
<html lang="en-GB" data-theme="reactor">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ghosty · the boot cinematic</title>
<link rel="stylesheet" href="../fonts.css">
<link rel="stylesheet" href="../iron/tokens.css">
<link rel="stylesheet" href="../iron/sheet.css">
<link rel="stylesheet" href="../iron/a/style.css">
<link rel="stylesheet" href="../nav/style.css">
<link rel="stylesheet" href="style.css">
</head>
<body class="dir-a">
${DEFS}
<main class="sheet">
<header class="shead"><span class="k">The boot · for your yes · 24 Oct</span><h1>He wakes up</h1>
<p>The first time you open him each day, and when you say “reboot”: 3.4 seconds, and a tap anywhere skips it. Every line on it is a reading Ghosty really has as he starts.</p></header>
<section class="extra"><div class="cap"><b>0</b><span>What it replaces</span><small>today’s boot, redrawn</small></div>
<div class="pane before"><div class="mini">${today()}</div><div class="btext"><p>A spinner, “Ghosty”, three log lines about the engine (<b>RENDER CORE · WEBGL2</b>, <b>EARTH DATA · 1251 CITIES</b>, <b>BRAIN · LINKED</b>) and “Initialising…”. A loading screen: it tells you nothing about him or your day, and it lasts as long as the loading does.</p>
<p>The new one has a fixed length, says who he is and what he knows, and lands you on Home with every instrument already live.</p></div></div>
<div class="pane"><div class="tlk">The whole boot · 3.4 s · 408 frames at 120 Hz</div>${timeline(0, true)}
<ol class="beats">${SEG.map((s) => `<li><span class="n">${s.n}</span><b>${s.name}</b><span class="tnum">${ms(s.a)} – ${ms(s.b)}</span></li>`).join('')}</ol></div></section>
<div class="shots">
${shot(1, 'black; the core ignites', f1())}
${shot(2, 'rings spin up; one scan', f2())}
${shot(3, 'the name, then online', f3())}
${shot(4, 'five readings, 200 ms apart', f4())}
${shot(5, 'his name, in his voice', f5())}
${shot(6, 'the HUD slides into place', f6())}
</div>
<section class="extra"><div class="cap"><b>7</b><span>The warm return</span><small>400 ms · the reactor’s pulse only</small></div>${warm()}</section>
<section class="extra"><div class="cap"><b>8</b><span>Reduce Motion, sound, honesty</span><small>the rules it keeps</small></div>
<div class="rulebox">
<div class="rule"><span class="rk">Reduce Motion on</span><p>The frames appear without motion: the reactor is simply lit, “GHOSTY · Online” and the five readings appear together, then the greeting, then Home fades in. No spin, no sweep, no slide; 1.2 s in all, and a tap still skips it. The warm return becomes a 150 ms brightening, no ring.</p></div>
<div class="rule"><span class="rk">Sound</span><p>No sound file and nothing downloaded. The only sound is Ghosty saying the greeting, in his own voice, when voice is on in Settings.</p></div>
<div class="rule"><span class="rk">Honest</span><p>Each line uses the last reading this phone holds (the same one each screen’s live line uses), so the boot never waits on the network. A reading it cannot get says so: <b>Brain · can’t be reached right now</b>, and the boot still ends at 3.4 s.</p></div>
<div class="rule"><span class="rk">When it plays</span><p>The first open each day, and “reboot”. Never twice in a day otherwise; never over a notification you tapped (that opens straight to its screen).</p></div>
</div></section>
<aside class="legend"><p><b>What is real.</b> The greeting (the same words Home’s title uses, from the time of day and the name in Settings), the reactor and MIND drawn from the mock-ups you said yes to, School starting at Nursery, today’s date, your city, the Home layout (date, title, weather, the hero’s four readings, Today, Roads near you, Gym) and the tab bar.</p>
<p><b>What is a sample.</b> Llama 4 Scout as the brain, the 212 things known, the 1,685 passages and 642 studied, “paper 3 next”, the 14° and light rain, 72% of free AI left, 84 ms, the agenda, the M6 queue and the GYM’s figures. On your phone each comes from Ghosty’s own records and feeds. “Boss” stands in for the name in Settings.</p></aside>
</main>
</body>
</html>
`;
}

writeFileSync(join(here, 'contact.html'), page());
console.log('built boot/contact.html');
