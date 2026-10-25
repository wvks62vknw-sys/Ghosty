// Navigation that never scrolls for ever (BRIEF-NAV-BOOT.md §1): builds nav/contact.html.
//   node docs/build-plan/mockups/nav/build.mjs && node docs/build-plan/mockups/nav/render.mjs nav
// The look is A with C's restraint (BRIEF-IRON-BUILD.md): ../iron/a/style.css and the restraint layer in style.css.
// Instruments come from ./kit.mjs (ported from ../iron/build.mjs). Data: DATA in kit.mjs and the legend at the bottom.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  D, f, ic, DEFS, DATA, mind, gymRing, schoolRing, gameArt, statusBar, dock, topHub, cmdbar, rd,
  reviseCurve, videoLine, courseRing, examRing, quizRing, dial,
} from './kit.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TIME = '19:58';

/* ---------- the glyphs these screens add (thin line, the repo's 24 x 24 hand) ---------- */
const G = {
  revise: '<rect x="4" y="6.5" width="13" height="10" rx="2"/><path d="M7 4h11a2 2 0 012 2v8"/><path d="M8 11.5h5"/>',
  video: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M10.5 9.5v5l4-2.5z"/>',
  exam: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 3h5"/>',
  quiz: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 114 2c-.9.6-1.6 1.1-1.6 2.2M12 16.8v.2"/>',
};
const gi = (k) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${G[k]}</svg>`;

/* ---------- Learn's tools, each its own screen: six cards and a MORE row (the real tools; see the legend) ---------- */
const coursemap = `<span class="coursemap"><span class="cm">Algebra</span><span class="segs"><i class="on"></i><i class="on"></i><i class="live"></i><i></i><i></i><i></i></span></span>`;
const CARDS = [
  { id: 'gym', name: 'Gym', icon: ic('gym'), st: '<i class="dot pulse"></i>Training', live: true, ins: `${gymRing()}<span class="ctr"><b>${DATA.gym.mastered}<span class="of">/${DATA.gym.games}</span></b></span>`,
    t: 'He teaches himself', reads: [rd('Rating', `${DATA.gym.rating}<i class="up">↑${DATA.gym.up}</i>`, true), rd('Now', 'Lv 6', true)] },
  { id: 'school', name: 'School', icon: ic('school'), st: DATA.school.stage, ins: `${schoolRing()}<span class="ctr"><b>${DATA.school.passed}<span class="of">/${DATA.school.papers}</span></b></span>`,
    t: 'He sits real papers', reads: [rd('Passed', `${DATA.school.passed} of ${DATA.school.papers}`), rd('Next', 'Paper 3')] },
  { id: 'course', name: 'Courses', icon: ic('course'), st: '3 of 6', ins: coursemap,
    t: 'Learn anything', reads: [rd('Mastery', '48%'), rd('Next', 'Lesson 3')] },
  { id: 'library', name: 'Library', icon: ic('library'), st: 'Offline', ins: mind(),
    t: 'All he has read', reads: [rd('Passages', DATA.lib.passages), rd('Studied', DATA.lib.studied)] },
  { id: 'revise', name: 'Revise', icon: gi('revise'), st: '14 due', ins: reviseCurve(),
    t: 'Keep what you learnt', reads: [rd('Due now', '14', true), rd('Cards', '96')] },
  { id: 'video', name: 'Videos', icon: gi('video'), st: 'In chat', ins: videoLine(),
    t: 'Any video, in a minute', reads: [rd('Last', '18:32'), rd('Moments', '7')] },
];
const MORE = [
  { name: 'Exams', icon: examRing(100, 100, 0.999), line: '1 waiting · 45 min' },
  { name: 'Quizzes', icon: quizRing(), line: 'Last: 8 of 10' },
];

const ribbon = `<div class="ribbon"><span>${ic('rain')}<b>${DATA.temp}</b> ${DATA.sky} in ${DATA.city}</span><span>Next <b>Mum’s · 20:30</b></span></div>`;

function card(c, touch = false) {
  return `<button class="ncard inst ${c.id}${touch ? ' touch' : ''}"><span class="nins">${c.ins}</span>
<span class="kick">${c.icon}${c.name}<em class="${c.live ? '' : 'off'}">${c.st}</em></span>
<span class="t">${c.t}</span><span class="reads">${c.reads.join('')}</span></button>`;
}
const moreRow = `<div class="more inst"><span class="mk">More<small>2</small></span>${MORE.map((m) => `<button class="mi">${m.icon}<span><b>${m.name}</b><small>${m.line}</small></span>${ic('chev')}</button>`).join('')}</div>`;

function learnHub({ touch = '' } = {}) {
  return `<div class="phone hubp">${statusBar(TIME)}<div class="room"></div><div class="view">
${ribbon}
${topHub('Learn')}
<p class="hubsub">Courses for you, games and a library for him.</p>
${cmdbar}
<div class="ngrid">${CARDS.map((c) => card(c, c.id === touch)).join('')}</div>
${moreRow}
</div>${dock('learn')}<i class="hi"></i></div>`;
}

/* ---------- the GYM, its own screen: page one of four (Boards), six cards, no scrolling ---------- */
const BOARDS = [
  { id: 'chess', name: 'Chess', lv: 6, m: 0.52, bar: 0.7, rating: '1,240', d: '+35', live: true },
  { id: 'go', name: 'Go 9×9', lv: 3, m: 0.44, bar: 0.65, rating: '1,060', d: '±0' },
  { id: 'connect4', name: 'Connect 4', lv: 8, m: 0.38, bar: 0.42, rating: '1,105', d: '+12' },
  { id: 'checkers', name: 'Checkers', lv: 5, m: 0.47, bar: 0.52, rating: '1,180', d: '+8' },
  { id: 'tictactoe', name: 'Tic-tac-toe', lv: 10, m: 1, bar: 1, done: true },
  { id: 'sokoban', name: 'Sokoban', lv: 7, m: 0.54, bar: 0.6, edge: true },
];
const PAGES = [['Boards', 6], ['Puzzles', 6], ['Words', 6], ['Minds', 4]];

function gymCard(g) {
  const rl = g.done ? '<span>Mastered</span><b>100%</b>'
    : g.rating ? `<span>Rating <b class="tnum">${g.rating}</b> <span class="${g.d.startsWith('+') ? 'up' : ''}">${g.d}</span></span><span class="tnum">${Math.round(g.m * 100)}% · ${Math.round(g.bar * 100)}</span>`
      : `<span>${g.edge ? 'Level 7½: his edge' : ''}</span><b class="tnum">${Math.round(g.m * 100)}%</b>`;
  return `<button class="gymcard inst${g.live ? ' live' : ''}${g.done ? ' done' : ''}">${gameArt(g.id)}
<span class="nm"><b>${g.name}</b><span>${g.done ? 'ALL 10' : `LV ${g.lv}`}</span></span>
<span class="meter"><i style="width:${Math.round(g.m * 100)}%"></i><u style="left:${Math.min(99, Math.round(g.bar * 100))}%"></u></span>
<span class="rl">${rl}</span></button>`;
}

function gymScreen({ dim = false } = {}) {
  const bars = [100, 100, 100, 62, 74, 55, 48, 66, 40, 38, 52, 30, 44, 28, 36, 22, 30, 18, 14, 10, 8, 6];
  return `<div class="phone gymp${dim ? ' dimmed' : ''}">${statusBar(TIME)}<div class="room"></div><div class="view">
<div class="top"><span class="backpill">${ic('back')}<span>Learn</span></span><span class="sp"></span><span class="round av you">${DATA.name[0]}</span></div>
<h1 class="bigtitle">Gym</h1>
<p class="hubsub">He teaches himself by playing, on this phone.</p>
<div class="gymsum inst"><div class="row1"><span class="big"><b class="tnum">${DATA.gym.mastered} <span class="of">of ${DATA.gym.games}</span></b><small>games mastered</small></span>
<span class="bars">${bars.map((h, i) => `<i class="${h === 100 ? 'on' : i === 3 ? 'live' : ''}" style="height:${Math.max(8, h)}%"></i>`).join('')}</span>
<button class="go">${ic('play')}Train all</button></div>
<div class="now"><i class="dot pulse"></i><span>Training <b>Chess</b> · level 6 · <span class="tnum">52%</span>, needs <span class="tnum">70%</span></span></div></div>
<div class="pages">${PAGES.map(([p, n], i) => `<span class="${i ? '' : 'on'}">${p}<small>${n}</small></span>`).join('')}</div>
<div class="gymcards">${BOARDS.map(gymCard).join('')}</div>
<div class="pdots"><span class="dots"><i class="on"></i><i></i><i></i><i></i></span><span>Swipe for <b>Puzzles</b> ${ic('chev')}</span></div>
</div>${dock('learn')}<i class="hi"></i></div>`;
}

/* ---------- the way between them ---------- */
function wayFrame() {
  return `<div class="panel way">
<div class="pair"><div class="mini">${learnHub({ touch: 'gym' })}<span class="tap" style="left:33px;top:92px"></span></div>
<div class="arrow"><span>tap</span><svg viewBox="0 0 40 16" aria-hidden="true"><path d="M2 8h33M29 3l6 5-6 5"/></svg><span class="tnum">350 ms</span></div>
<div class="mini">${gymScreen()}</div></div>
<p class="pcap">The card’s ring grows into the GYM’s summary as the screen slides in from the right (the iPhone’s push, 350 ms on the spring, 42 frames at 120 Hz).</p>
<ol class="ways">
<li><span class="n">1</span><div><b>The back</b><span class="demo"><span class="backpill">${ic('back')}<span>Learn</span></span><span class="or">or swipe from the left edge</span></span><small>Always one back, and it names where it goes. The hub is where you left it.</small></div></li>
<li><span class="n">2</span><div><b>The title</b><span class="demo titles"><span class="tt">Learn</span>${ic('chev', 'ic sm')}<span class="tt">Gym</span></span><small>The large title says where you are; the back says where you came from. Two levels, never three.</small></div></li>
<li><span class="n">3</span><div><b>The tab</b><span class="demo bar">${dock('learn', { press: 'learn' })}</span><small>Tap <b>Learn</b> again: back to the hub from anywhere in it. Tap another tab: that area opens where you left it, and Learn keeps the GYM for when you come back. Hold a tab: its tools fan out (next).</small></div></li>
</ol></div>`;
}

/* ---------- the quick switcher: hold LEARN, its tools fan out as a radial of instruments ---------- */
function switcher() {
  const cx = 220, cy = 802, R = 182;
  const N = [
    { k: 'Gym', ins: gymRing(), crop: '30 -4 100 100', ctr: '3', line: '1,240 ↑35' },
    { k: 'School', ins: schoolRing(), crop: '35 1 90 90', ctr: '2/4', line: 'Nursery' },
    { k: 'Library', ins: mind(), crop: '11 -3 98 98', line: '1,685' },
    { k: 'Courses', ins: courseRing(), ctr: '3/6', line: 'Algebra' },
    { k: 'Revise', ins: dial(), ctr: '14', line: '14 due', pick: true },
    { k: 'Videos', ins: dial(), glyph: '<path class="fl" d="M44 38v24l20-12z"/>', line: '18:32' },
    { k: 'Exams', ins: examRing(100, 100, 0.999), ctr: '45m', line: '1 waiting' },
    { k: 'Quizzes', ins: quizRing(), ctr: '8', line: '8 of 10' },
  ];
  const pos = (i) => i < 6 ? { t: (180 + i * 36) * D, r: R } : { t: Math.atan2(-42, i === 6 ? -55 : 55), r: Math.hypot(55, 42) };
  const nodes = N.map((n, i) => {
    const { t, r } = pos(i);
    const x = cx + r * Math.cos(t), y = cy + r * Math.sin(t);
    let svg = n.ins;
    if (n.crop) svg = svg.replace(/viewBox="[^"]+"/, `viewBox="${n.crop}"`);
    if (n.glyph) svg = svg.replace('</svg>', `${n.glyph}</svg>`);
    return `<span class="node${n.pick ? ' pick' : ''}${i >= 6 ? ' inner' : ''}" style="left:${f(x)}px;top:${f(y)}px"><span class="disc">${svg}${n.ctr ? `<b class="tnum">${n.ctr}</b>` : ''}</span><span class="nk">${n.k}</span><span class="nl tnum">${n.line}</span></span>`;
  }).join('');
  const pk = pos(N.findIndex((n) => n.pick));
  const px = cx + pk.r * Math.cos(pk.t), py = cy + pk.r * Math.sin(pk.t);
  // the finger: down on LEARN (x 300), slid up to Revise
  const fx = 300, fy = 898;
  return `<div class="phone switch">${gymScreen().replace('<div class="phone gymp">', '<div class="under">').replace(/<i class="hi"><\/i><\/div>$/, '</div>')}
<div class="veil"></div>
<svg class="fan" viewBox="0 0 440 956" aria-hidden="true">
<path class="guide" d="M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}"/>
<path class="drag" d="M${fx} ${fy - 6}C${fx - 4} ${fy - 80} ${f(px - 40)} ${f(py + 110)} ${f(px - 6)} ${f(py + 44)}"/>
</svg>
${nodes}
<div class="hold"><span class="hk">Revise</span><b>14 cards due today</b><small>Let go to open · slide off to cancel</small></div>
${dock('learn', { press: 'learn' }).replace('class="dock"', 'class="dock up"')}
<span class="finger" style="left:${fx}px;top:${fy}px"></span>
<i class="hi"></i></div>`;
}

function page() {
  return `<!doctype html>
<html lang="en-GB" data-theme="reactor">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ghosty · navigation that never scrolls for ever</title>
<link rel="stylesheet" href="../fonts.css">
<link rel="stylesheet" href="../iron/tokens.css">
<link rel="stylesheet" href="../iron/sheet.css">
<link rel="stylesheet" href="../iron/a/style.css">
<link rel="stylesheet" href="style.css">
</head>
<body class="dir-a">
${DEFS}
<main class="sheet">
<header class="shead"><span class="k">Navigation · for your yes · 24 Oct</span><h1>Every tool its own screen</h1>
<p>Each tab opens on a grid of instruments that fits the screen, with nothing to scroll. A tap opens a tool full height; the back, the tab or a long press on the tab takes you anywhere in two moves.</p></header>
<div class="shots">
<figure class="shot"><figcaption class="cap"><b>1</b><span>The Learn hub, on one screen</span><small>six instruments · a more row</small></figcaption>${learnHub()}</figure>
<figure class="shot"><figcaption class="cap"><b>2</b><span>The GYM, its own screen</span><small>22 games as four pages of six</small></figcaption>${gymScreen()}</figure>
<figure class="shot"><figcaption class="cap"><b>3</b><span>The way between them</span><small>the back · the title · the tab</small></figcaption>${wayFrame()}</figure>
<figure class="shot"><figcaption class="cap"><b>4</b><span>The quick switcher</span><small>hold a tab · slide · let go</small></figcaption>${switcher()}</figure>
</div>
<section class="rules"><div class="cap"><b>5</b><span>When there are more than six</span><small>the rule, everywhere</small></div>
<div class="rulebox">
<div class="rule"><span class="rk">A hub</span><p>Six cards at most, two across. The seventh and eighth go on a <b>More</b> row of small instruments under them (Learn today: Exams and Quizzes). A ninth means the area is split, not that the hub grows.</p></div>
<div class="rule"><span class="rk">Inside a tool</span><p>A long list becomes pages of six with a named strip and dots (the GYM: Boards, Puzzles, Words, Minds). You swipe sideways; the page never grows downwards.</p></div>
<div class="rule"><span class="rk">What still scrolls</span><p>Only reading: the chat, a lesson, a paper. Nothing you navigate.</p></div>
</div></section>
<aside class="legend"><p><b>What is real.</b> The five tabs; Learn’s tools and their words (Courses, GYM, School, Library from shell/areas.ts; Revise, Quizzes and Exams are the course tool’s own views; Videos is the chat’s YouTube summary with its moments); the 22 games, each level’s pass mark (Chess level 6 needs 70%, Connect 4 level 8 needs 42%), which games you can play him; School starting at Nursery; your city from Settings; the 11 on Plan.</p>
<p><b>What is a sample.</b> The rating, levels and mastery, School’s 2 of 4, the course and its 48%, the library’s 1,685 / 642, the 14 cards due and 96 cards, the 18:32 video, the waiting exam, the 8 of 10, the weather and “Mum’s · 20:30”. On your phone each comes from Ghosty’s own records, the weather feed and your agenda. “Boss” stands in for the name in Settings.</p>
<p><b>What is new.</b> Revise, Videos, Exams and Quizzes as their own screens (today they sit inside one long Learn page or the chat), the More row, the GYM’s four pages and their names, the ribbon, the switcher.</p></aside>
</main>
</body>
</html>
`;
}

writeFileSync(join(here, 'contact.html'), page());
console.log('built nav/contact.html');
