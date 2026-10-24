"""Route B (instrument and editorial): the five screens, the design-language card and the contact sheet as static
HTML. Run from the worktree root:  python3 -I -B docs/build-plan/mockups/b/build.py"""
import importlib.util, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
from common import FRAME_CSS, HOME_INDICATOR, contact, icon, page, sparkline, status_bar, write  # noqa: E402
from globe import geometry_persp, world  # noqa: E402

_spec = importlib.util.spec_from_file_location('route_c', os.path.join(HERE, '..', 'c', 'build.py'))
C = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(C)
P, arc = C.P, C.arc
BRASS = '#d2ad6d'
PAPER = '#ece5d6'
VERM = '#f0663e'


def tabbar(on):
    tabs = [('ask', 'Ask', 'i'), ('see', 'See', 'ii'), ('make', 'Make', 'iii'), ('learn', 'Learn', 'iv'), ('plan', 'Plan', 'v')]
    return ('<nav class="tabs"><span class="rl"></span><div class="tt">'
            + ''.join(f'<div class="tab{" on" if k == on else ""}"><i>{n}</i>{t}</div>' for k, t, n in tabs) + '</div></nav>')


def frame(body, cls='', tab=None):
    return f'<style>{FRAME_CSS}</style><div class="screen {cls}">' + status_bar() + body + (tabbar(tab) if tab else '') + HOME_INDICATOR + '</div>'


def L(x0, y0, x1, y1, op=0.5, w=0.8, col=PAPER, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    return f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{col}" stroke-opacity="{op}" stroke-width="{w}"{d}/>'


def blueprint(cx=220, cy=146, gauges=True):
    """The arc reactor as an engineering drawing: construction lines, ten cells with their coil hatching, the
    collar and the core in thin paper lines; three gauges in brass, keyed A, B, C to the legend."""
    s = []
    d = s.append
    d(L(cx - 196, cy, cx + 196, cy, 0.16, 0.7, dash='2 4'))
    d(L(cx, cy - 140, cx, cy + 140, 0.16, 0.7, dash='2 4'))
    d(f'<circle cx="{cx}" cy="{cy}" r="132" fill="none" stroke="{PAPER}" stroke-opacity="0.12" stroke-width="0.7" stroke-dasharray="1 3"/>')
    if gauges:
        G = [(122, 0.72, 'A'), (113, 0.313, 'B'), (104, 0.5, 'C')]
        for r, v, k in G:
            d(f'<path d="{arc(cx, cy, r, 135, 405)}" fill="none" stroke="{PAPER}" stroke-opacity="0.13" stroke-width="1"/>')
            for t in range(0, 28):
                a = 135 + t * 10
                if a > 405:
                    break
                x0, y0 = P(cx, cy, r - 2.5, a)
                x1, y1 = P(cx, cy, r + 2.5, a)
                d(L(x0, y0, x1, y1, 0.2, 0.6))
            a1 = 135 + 270 * v
            d(f'<path d="{arc(cx, cy, r, 135, a1)}" fill="none" stroke="{BRASS}" stroke-width="2"/>')
            ex, ey = P(cx, cy, r, a1)
            d(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="3" fill="#0d1014" stroke="{BRASS}" stroke-width="1.4"/>')
            lx, ly = P(cx, cy, r + 13, a1)
            d(f'<text x="{lx:.1f}" y="{ly + 4.5:.1f}" text-anchor="middle" font-family="Source Serif Mock" font-style="italic" font-size="13" fill="{BRASS}">{k}</text>')
    d(f'<circle cx="{cx}" cy="{cy}" r="92" fill="none" stroke="{PAPER}" stroke-opacity="0.75" stroke-width="1"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="88" fill="none" stroke="{PAPER}" stroke-opacity="0.3" stroke-width="0.7"/>')
    for k in range(60):
        a = k * 6
        x0, y0 = P(cx, cy, 88, a)
        x1, y1 = P(cx, cy, 92, a)
        d(L(x0, y0, x1, y1, 0.35, 0.6))
    for k in range(10):
        a0 = -90 + k * 36 + 3.5
        a1 = a0 + 29
        xo0, yo0 = P(cx, cy, 82, a0)
        xo1, yo1 = P(cx, cy, 82, a1)
        xi1, yi1 = P(cx, cy, 60, a1)
        xi0, yi0 = P(cx, cy, 60, a0)
        d(f'<path d="M{xo0:.1f} {yo0:.1f}A82 82 0 0 1 {xo1:.1f} {yo1:.1f}L{xi1:.1f} {yi1:.1f}A60 60 0 0 0 {xi0:.1f} {yi0:.1f}Z" fill="{PAPER}" fill-opacity="0.03" stroke="{PAPER}" stroke-opacity="0.8" stroke-width="0.9"/>')
        for j in range(1, 9):
            a = a0 + (a1 - a0) * j / 9
            x0, y0 = P(cx, cy, 60, a)
            x1, y1 = P(cx, cy, 82, a)
            d(L(x0, y0, x1, y1, 0.28, 0.6))
    d(f'<circle cx="{cx}" cy="{cy}" r="55" fill="none" stroke="{PAPER}" stroke-opacity="0.8" stroke-width="0.9"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="49" fill="none" stroke="{PAPER}" stroke-opacity="0.5" stroke-width="0.7"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="40" fill="none" stroke="{PAPER}" stroke-opacity="0.85" stroke-width="1"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="27" fill="none" stroke="{PAPER}" stroke-opacity="0.45" stroke-width="0.7" stroke-dasharray="2 2"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="12" fill="{BRASS}" fill-opacity="0.2" stroke="{BRASS}" stroke-width="1"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="2" fill="{BRASS}"/>')
    # a dimension line across the housing
    d(L(cx - 92, cy + 112, cx + 92, cy + 112, 0.35, 0.6))
    d(L(cx - 92, cy + 106, cx - 92, cy + 118, 0.35, 0.6))
    d(L(cx + 92, cy + 106, cx + 92, cy + 118, 0.35, 0.6))
    d(f'<text x="{cx}" y="{cy + 128}" text-anchor="middle" font-family="Inter Mock" font-size="9.5" letter-spacing="1.4" fill="{PAPER}" fill-opacity="0.45">TEN CELLS · ONLINE</text>')
    return ''.join(s)


# ---------------------------------------------------------------- 1. HOME
def home():
    body = f'''
<div class="mast"><span class="sc">Friday 23 October · Birmingham · 11° rain</span><span class="r"><span class="oc">{icon('search')}</span><span class="oc">B</span></span></div>
<div class="headline">Good evening, <em>Boss.</em></div>
<svg class="plate" viewBox="0 0 440 290">{blueprint(220, 150)}</svg>
<div class="legend">
  <div class="lg"><span class="k">A</span><span class="n">Free AI left today</span><span class="v num">72%</span></div>
  <div class="lg"><span class="k">B</span><span class="n">Library studied</span><span class="v num">1,312 of 4,186</span></div>
  <div class="lg"><span class="k">C</span><span class="n">School · Nursery</span><span class="v num">2 of 4 passed</span></div>
</div>
<div class="ledger">
  <div class="led"><span class="sc">Today</span><span class="c"><b>Call Mum</b><span class="num">Then the bins at 21:00</span></span><span class="t num">19:30 · in 48 min</span></div>
  <div class="led"><span class="sc">Roads</span><span class="c"><b>M6 J6–J7 northbound</b><span class="num"><span class="w" style="display:inline">Queue, +12 min</span> · clears 19:40</span></span></div>
  <div class="led"><span class="sc">Gym</span><span class="c"><b>3 of 22 games mastered</b><span>Last trained: Sudoku, level 6</span></span></div>
</div>
<div class="links"><span>Brief me</span><span>What’s on today</span><span>God’s eye</span></div>
<div class="askb"><span class="ph">Ask anything…</span><span class="oc">{icon('mic')}</span></div>
'''
    return page('Ghosty B · Home', frame(body, 'home', 'ask'))


# ---------------------------------------------------------------- 2. CHAT
def chat():
    body = f'''
<div class="bar"><span class="back">{icon('back')}Ask</span><span class="oc">B</span></div>
<div class="kick sc">Conversation · Today, 18:31</div>
<div class="tx">
  <div class="turn me"><div class="sc"><span>Boss</span></div><p>What’s on tonight?</p></div>
  <div class="turn gh"><div class="sc"><span>Ghosty</span><span style="letter-spacing:.06em">Llama 4 Scout</span></div><p>Call Mum at half seven, then the bins go out at nine. Nothing else in the diary.</p></div>
  <div class="turn me"><div class="sc"><span>Boss</span></div><p>Is the M6 bad tonight, and will it rain on the way to Mum’s?</p></div>
  <div class="turn gh"><div class="sc"><span>Ghosty · cited</span><span style="letter-spacing:.06em">Gemini 2.5 Flash</span></div>
    <div class="steps sc"><i></i>Web · weather · 2 pages read</div>
    <p>Not great. There’s a queue on the M6 northbound between junctions 6 and 7, adding about 12 minutes<span class="fn">1</span>, and it should clear by about 19:40<span class="fn">1</span>. Light rain until around nine, so the roads will be wet<span class="fn">2</span>. Leave after half seven and you’ll miss most of it.</p>
    <div class="notes2">
      <div class="note"><span class="n">1</span><span class="s">M6 northbound J6 to J7 · queue<em>nationalhighways.co.uk</em></span></div>
      <div class="note"><span class="n">2</span><span class="s">Birmingham forecast, tonight<em>metoffice.gov.uk</em></span></div>
    </div>
    <div class="verdict"><b>3 of 3</b> claims found in the sources</div>
    <div class="racts">{icon('up')}{icon('down')}{icon('copy')}{icon('listen')}<span class="th sc">Think harder</span></div>
  </div>
</div>
<div class="compose"><span class="plus">{icon('plus')}</span><span class="ph">Ask anything…</span><span class="cbox sc"><i><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></i>Cited</span><span class="oc">{icon('mic')}</span></div>
'''
    return page('Ghosty B · Chat', frame(body, 'chat'))


# ---------------------------------------------------------------- 3. GOD'S EYE (a chart, not a HUD)
def globe_b(g):
    o = g['o']
    limb = g['limb']
    s = ['<svg class="globe" viewBox="0 0 440 956" width="440" height="956">', f'<defs><clipPath id="dk"><path d="{limb}"/></clipPath></defs>',
         f'<path d="{limb}" fill="#10141a"/>', '<g clip-path="url(#dk)">',
         f'<path d="{g["grat"]}" fill="none" stroke="{PAPER}" stroke-opacity="0.09" stroke-width="0.6"/>',
         f'<path d="{g["land"]}" fill="{PAPER}" fill-opacity="0.035" stroke="{PAPER}" stroke-opacity="0.62" stroke-width="0.75" stroke-linejoin="round"/>',
         f'<path d="{g["borders"]}" fill="none" stroke="{PAPER}" stroke-opacity="0.28" stroke-width="0.6" stroke-dasharray="2 2"/>', '</g>',
         f'<path d="{limb}" fill="none" stroke="{PAPER}" stroke-opacity="0.55" stroke-width="1"/>']
    for k, (lat, lon, hd) in enumerate(C.PLANES):
        p = o.xy(lon, lat)
        if p and 200 < p[1] < 540:
            s.append(f'<g transform="translate({p[0]:.1f} {p[1]:.1f}) rotate({hd})"><path d="M0 -4L0 4M-2.6 1.2L0 -1.2 2.6 1.2" stroke="{BRASS}" stroke-width="1.1" fill="none"/></g>')
    for lat, lon in C.INCIDENTS:
        p = o.xy(lon, lat)
        if p:
            s.append(f'<rect x="{p[0] - 3:.1f}" y="{p[1] - 3:.1f}" width="6" height="6" fill="{VERM}" transform="rotate(45 {p[0]:.1f} {p[1]:.1f})"/>')
    for lat, lon, rr in [(52.9, -3.4, 30), (52.3, -2.6, 20), (53.4, -4.2, 34)]:
        p = o.xy(lon, lat)
        s.append(f'<ellipse cx="{p[0]:.1f}" cy="{p[1]:.1f}" rx="{rr}" ry="{rr * 0.5:.1f}" fill="none" stroke="{PAPER}" stroke-opacity="0.3" stroke-width="0.7" stroke-dasharray="1.5 2.5"/>')
    cities = {c[0]: c for c in world()['cities']}
    hx, hy = o.xy(-1.922, 52.477)
    placed = [(hx, hy), (hx + 60, hy)]
    for n in ['London', 'Paris', 'Dublin', 'Edinburgh', 'Cardiff', 'Amsterdam', 'Nantes', 'Brussels']:
        c = cities[n]
        p = o.xy(c[2], c[1])
        if not p or any(abs(p[0] - q[0]) < 76 and abs(p[1] - q[1]) < 20 for q in placed) or not (20 < p[0] < 360 and 220 < p[1] < 530):
            continue
        placed.append(p)
        s.append(f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="2" fill="none" stroke="{PAPER}" stroke-width="1"/><text x="{p[0] + 6:.1f}" y="{p[1] + 4:.1f}" font-family="Source Serif Mock" font-style="italic" font-size="13" fill="{PAPER}" fill-opacity="0.8">{n}</text>')
    s.append(L(hx - 40, hy, hx - 9, hy, 0.9, 1) + L(hx + 9, hy, hx + 40, hy, 0.9, 1) + L(hx, hy - 40, hx, hy - 9, 0.9, 1) + L(hx, hy + 9, hx, hy + 40, 0.9, 1))
    s.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="9" fill="none" stroke="{BRASS}" stroke-width="1.4"/><circle cx="{hx:.1f}" cy="{hy:.1f}" r="2" fill="{BRASS}"/>')
    s.append(f'<text x="{hx + 14:.1f}" y="{hy - 12:.1f}" font-family="Source Serif Mock" font-size="17" font-weight="600" fill="{PAPER}">Birmingham</text>')
    s.append('</svg>')
    return ''.join(s)


def eye():
    g = geometry_persp(52.477, -1.922, 3800, 46, 1025, 220, 450)
    body = f'''
{globe_b(g)}
<div class="bar" style="z-index:10"><span class="back">{icon('back')}See</span><span class="sc" style="color:var(--brass)">God’s eye</span><span class="oc">B</span></div>
<div class="esearch">{icon('search')}Search place, flight, ship, satellite…</div>
<div class="toggles sc"><span class="tg on"><i></i>Aircraft <em>1,204</em></span><span class="tg on w"><i></i>Incidents <em>7</em></span><span class="tg on"><i></i>Radar</span><span class="tg"><i></i>More</span></div>
<div class="readb">52.477° −1.922° · <b>BIRMINGHAM</b><br>ALT 3,050 KM · TILT 46° · HDG 0°<br>1,204 AC · 318 SHIP · 86 CAM · 894 SAT</div>
<div class="panel">
  <div class="prow"><span class="sc">This spot</span><span class="bt"><span>Map</span><span>3D</span><span>Street View</span><span>Traffic</span><span>Go</span></span></div>
  <div class="prow"><span class="sc">View</span><span class="bt"><span class="dim">Look</span><span class="dim">Home</span><span class="dim">North</span><span class="dim">Tilt</span><span class="dim">Road ahead</span></span></div>
</div>
'''
    return page('Ghosty B · God’s Eye', frame(body, 'eye', 'see'))


# ---------------------------------------------------------------- 4. GYM
def dial_b(frac, w=150, h=104):
    cx, cy, r = w / 2, h - 20, 70
    s = [f'<svg class="dial" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
         f'<path d="{arc(cx, cy, r, 180, 360)}" fill="none" stroke="{PAPER}" stroke-opacity="0.18" stroke-width="1"/>']
    for k in range(23):
        a = 180 + k * 180 / 22
        long = k % 11 == 0
        x0, y0 = P(cx, cy, r - (9 if long else 5), a)
        x1, y1 = P(cx, cy, r, a)
        s.append(L(x0, y0, x1, y1, 0.6 if long else 0.3, 0.8))
    s.append(f'<path d="{arc(cx, cy, r, 180, 180 + 180 * frac)}" fill="none" stroke="{BRASS}" stroke-width="2.4"/>')
    a = 180 + 180 * frac
    x1, y1 = P(cx, cy, r - 16, a)
    s.append(L(cx, cy, x1, y1, 1, 1.4, BRASS))
    s.append(f'<circle cx="{cx}" cy="{cy}" r="3.5" fill="#0d1014" stroke="{BRASS}" stroke-width="1.4"/>')
    s.append(f'<text x="{cx - r}" y="{cy + 14}" font-family="Inter Mock" font-size="9" fill="{PAPER}" fill-opacity="0.45" text-anchor="middle">0</text>'
             f'<text x="{cx + r}" y="{cy + 14}" font-family="Inter Mock" font-size="9" fill="{PAPER}" fill-opacity="0.45" text-anchor="middle">22</text>')
    s.append('</svg>')
    return ''.join(s)


def ring_b(frac, goal, col=PAPER):
    r = 14
    Cc = 2 * math.pi * r
    g = ''
    if goal:
        x0, y0 = P(20, 20, r + 2, -90 + goal * 360)
        x1, y1 = P(20, 20, r + 5.5, -90 + goal * 360)
        g = L(x0, y0, x1, y1, 1, 1.2, BRASS)
    return (f'<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="{r}" fill="none" stroke="{PAPER}" stroke-opacity=".16" stroke-width="1"/>'
            f'<circle cx="20" cy="20" r="{r}" fill="none" stroke="{col}" stroke-width="1.6" stroke-dasharray="{frac * Cc:.1f} {Cc:.1f}" transform="rotate(-90 20 20)"/>{g}</svg>')


def gym():
    rows = [('Sudoku', 'Level 6 · 66% · paused', 6, 0.66, 0.70, [0.1, 0.18, 0.22, 0.31, 0.36, 0.41, 0.47, 0.52, 0.55, 0.6, 0.62, 0.64, 0.66]),
            ('Tic-tac-toe', 'Mastered · all 10 levels', 10, 1.0, None, [0.2, 0.42, 0.55, 0.68, 0.77, 0.85, 0.9, 0.94, 0.97, 1.0, 1.0]),
            ('Connect 4', 'Level 8 · 83% · paused', 8, 0.83, 0.85, [0.15, 0.3, 0.41, 0.5, 0.58, 0.66, 0.7, 0.75, 0.79, 0.81, 0.83]),
            ('Chess', 'Level 3 · 44% · paused', 3, 0.44, 0.55, [0.08, 0.14, 0.2, 0.24, 0.29, 0.31, 0.36, 0.38, 0.41, 0.44]),
            ('Maze', 'Mastered · all 10 levels', 10, 1.0, None, [0.3, 0.5, 0.66, 0.8, 0.9, 0.96, 1.0, 1.0]),
            ('Debate Arena', 'Not started · level 1', 1, 0.0, 0.5, [0.0, 0.0])]
    tr = ''
    for n, sub, lv, m, goal, hist in rows:
        done = m >= 1
        col = BRASS if done else PAPER
        spk = f'<svg class="spk" viewBox="0 0 92 24" preserveAspectRatio="none"><polyline points="{sparkline(hist, 92, 24)}" fill="none" stroke="{col}" stroke-opacity="{1 if done else 0.7}" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>' if m > 0 else '<svg class="spk" viewBox="0 0 92 24"><line x1="2" y1="22" x2="90" y2="22" stroke="#ece5d6" stroke-opacity=".2" stroke-dasharray="2 3"/></svg>'
        tr += f'<div class="tr"><span class="gn"><b>{n}</b><span class="num{" m" if done else ""}">{sub}</span></span>{spk}<span class="lv">{ring_b(m, goal, col)}<b>{lv}</b></span></div>'
    body = f'''
<div class="bar"><span class="back">{icon('back')}Learn</span><span class="oc">B</span></div>
<div class="gtitle"><h1>Gym</h1><div class="dek">Ghosty teaches himself by playing, on this phone.</div></div>
<div class="inst"><div class="big num">3<small> / 22</small></div><div class="cap">games mastered, each measured against ground truth</div>{dial_b(3 / 22)}</div>
<div class="trainb"><span class="go">{icon('play')}Train all</span><span class="aw">Keep awake<span class="tick"></span></span></div>
<div class="gstat"><b>Not running.</b> Least mastered first, starting with Debate Arena, until all 22 are mastered or you tap Stop.</div>
<div class="table"><div class="th2 sc"><span style="flex:1">Game</span><span style="width:108px">Mastery</span><span style="width:40px;text-align:center">Lv</span></div>{tr}</div>
'''
    return page('Ghosty B · Gym', frame(body, 'gym', 'learn'))


# ---------------------------------------------------------------- 5. SETTINGS (the Me sheet)
def semi(frac, col=BRASS):
    cx, cy, r = 48, 52, 40
    t = ''.join(L(*P(cx, cy, r - 4, 180 + k * 18), *P(cx, cy, r, 180 + k * 18), 0.35, 0.7) for k in range(11))
    return (f'<svg width="96" height="62" viewBox="0 0 96 62"><path d="{arc(cx, cy, r, 180, 360)}" fill="none" stroke="{PAPER}" stroke-opacity=".16" stroke-width="1"/>{t}'
            f'<path d="{arc(cx, cy, r, 180, 180 + 180 * max(frac, 0.001))}" fill="none" stroke="{col}" stroke-width="2.2"/></svg>')


def settings():
    body = f'''
<div class="behind"><img src="home.png" alt=""></div>
<div class="sheet">
  <span class="grab"></span>
  <div class="mehd"><span class="oc">B</span><div><h2>Boss</h2><p>Graphite · °C, km</p></div><span class="x">Done</span></div>
  <div class="stat">
    <div class="hd"><span class="sc">Status</span><span class="sc">All well</span></div>
    <div class="dials">
      <div class="dl"><div class="d">{semi(0.72)}<b>72%</b></div><div class="lb">Free AI left today</div></div>
      <div class="dl"><div class="d">{semi(0.18)}<b>18%</b></div><div class="lb">Database used</div></div>
      <div class="dl"><div class="d">{semi(1.0)}<b style="font-size:15px">Ready</b></div><div class="lb">Offline brain</div></div>
    </div>
    <div class="kv"><span>Ghosty</span><span>Connected</span></div>
    <div class="kv"><span>Self-edit</span><span>On</span></div>
    <div class="kv"><span>This phone</span><span>Paired with your owner key</span></div>
    <div class="kv"><span>Version</span><span>Up to date</span></div>
  </div>
  <div class="sect2" style="top:440px"><div class="sc">Yours</div>
    <div class="li"><span class="ix">i</span><span class="t"><b>Memory</b><span>What I know about you</span></span><span class="ar">→</span></div>
    <div class="li"><span class="ix">ii</span><span class="t"><b>Settings</b><span>Look, voice, home and about</span></span><span class="ar">→</span></div>
    <div class="li"><span class="ix">iii</span><span class="t"><b>System</b><span>Keys, models, storage and backups</span></span><span class="ar">→</span></div>
    <div class="li"><span class="ix">iv</span><span class="t"><b>Links</b><span>Email, Spotify and your phone</span></span><span class="ar">→</span></div>
    <div class="li"><span class="ix">v</span><span class="t"><b>Every screen</b><span>All of Ghosty at once</span></span><span class="ar">→</span></div>
  </div>
  <div class="sect2 sc" style="top:766px;color:var(--paper3);letter-spacing:.1em">Ghosty 29e6c95 · built 2 hours ago</div>
</div>
'''
    return page('Ghosty B · Me', frame(body, 'mescreen'))


# ---------------------------------------------------------------- the design-language card
def language():
    sw = [('#0d1014', 'Ink', 'The canvas'), ('#ece5d6', 'Paper', 'Text and lines'), ('rgba(236,229,214,.4)', 'Paper 40', 'Labels'),
          ('#d2ad6d', 'Brass', 'Instruments, active'), ('#f0663e', 'Vermilion', 'Warnings only'), ('#f3eee4', 'Warm paper', 'The light canvas')]
    sws = ''.join(f'<div class="swb"><span style="background:{c}"></span><b>{n}</b><em>{d}</em></div>' for c, n, d in sw)
    body = f'''
<div class="lang">
  <header><div><div class="sc" style="color:var(--brass)">Route B · instrument and editorial</div><h1>A field notebook for a very clever machine.</h1>
  <p>Neither Jarvis nor iOS. Deep ink, warm paper, a serif for titles and a clean sans for the rest; thin, precise instruments; lots of quiet space; the reactor drawn as a blueprint. It reads like a beautifully set magazine about a machine that is really working.</p></div></header>
  <section class="cols">
    <div><h2 class="sc">Palette</h2><div class="swg">{sws}</div>
      <h2 class="sc" style="margin-top:30px">Rules</h2>
      <ul class="notes"><li>Hairline rules instead of cards; space does the grouping.</li><li>Serif only for titles and names; everything else is the sans.</li><li>Brass marks what is measured or active; vermilion only warns.</li><li>Tabs are words with Roman numerals, not icons.</li><li>Motion: slow, linear needle sweeps; reduce motion shows final values.</li></ul></div>
    <div><h2 class="sc">Type</h2>
      <div class="tyr"><div><b>Display</b><em>Source Serif 4 · 40/44 Semibold</em></div><div class="serif" style="font-size:40px;line-height:44px;font-weight:600;letter-spacing:-.6px">Good evening, <i style="font-weight:400;color:var(--paper2)">Boss.</i></div></div>
      <div class="tyr"><div><b>Title</b><em>Source Serif 4 · 19/23</em></div><div class="serif" style="font-size:19px;font-weight:600">Connect 4</div></div>
      <div class="tyr"><div><b>Body</b><em>Inter (SF) · 17/26</em></div><div style="font-size:17px;line-height:26px">Light rain until around nine, so the roads will be wet.</div></div>
      <div class="tyr"><div><b>Label</b><em>11/14 · +14 % caps</em></div><div class="sc" style="color:var(--paper2)">Today · Roads · Gym</div></div>
      <div class="tyr"><div><b>Prompt</b><em>Serif italic · 19</em></div><div class="serif" style="font-style:italic;font-size:19px;color:var(--paper3)">Ask anything…</div></div>
      <h2 class="sc" style="margin-top:30px">Instruments</h2>
      <div style="display:flex;gap:30px;align-items:flex-end">{dial_b(3 / 22)}<span style="position:relative;width:40px;height:40px">{ring_b(0.66, 0.7)}</span>{semi(0.72)}</div>
      <div style="margin-top:22px;position:relative;height:92px;border:1px solid var(--rule);">{tabbar('ask').replace('class="tabs"', 'class="tabs" style="position:absolute"')}</div></div>
    <div><h2 class="sc">The reactor, as a drawing</h2><svg viewBox="0 0 440 300" width="440" height="300">{blueprint(220, 150)}</svg>
      <div class="legend" style="position:static;margin-top:6px">
        <div class="lg"><span class="k">A</span><span class="n">Free AI left today</span><span class="v num">72%</span></div>
        <div class="lg"><span class="k">B</span><span class="n">Library studied</span><span class="v num">1,312 of 4,186</span></div>
        <div class="lg"><span class="k">C</span><span class="n">School · Nursery</span><span class="v num">2 of 4 passed</span></div></div></div>
  </section>
</div>'''
    css = f'''<style>{FRAME_CSS}
body {{ width: 1560px; background: #0d1014; }}
.lang {{ width: 1560px; padding: 56px 64px 64px; background: radial-gradient(900px 600px at 80% 20%, #141a22, #0d1014 70%); }}
.lang header {{ padding-bottom: 30px; border-bottom: 1px solid var(--rule2); }}
.lang h1 {{ margin-top: 12px; font-family: var(--serif); font-size: 48px; line-height: 54px; font-weight: 600; letter-spacing: -.8px; }}
.lang header p {{ margin-top: 12px; max-width: 920px; font-size: 18px; line-height: 27px; color: var(--paper2); }}
.cols {{ display: grid; grid-template-columns: 330px 520px 1fr; gap: 56px; padding-top: 32px; }}
.lang h2 {{ color: var(--paper3); margin-bottom: 14px; }}
.swg {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }}
.swb span {{ display: block; height: 56px; border-radius: 2px; box-shadow: inset 0 0 0 1px rgba(236,229,214,.18); }}
.swb b {{ display: block; margin-top: 6px; font-size: 13px; font-weight: 600; }}
.swb em {{ display: block; font-style: normal; font-size: 12px; color: var(--paper3); }}
.notes {{ list-style: none; }}
.notes li {{ font-size: 14px; line-height: 20px; color: var(--paper2); padding: 8px 0; border-top: 1px solid var(--rule); }}
.tyr {{ display: flex; gap: 18px; align-items: baseline; padding: 10px 0; border-top: 1px solid var(--rule); }}
.tyr > div:first-child {{ width: 150px; flex: none; }}
.tyr b {{ display: block; font-size: 13px; font-weight: 600; }}
.tyr em {{ display: block; font-style: normal; font-size: 11.5px; color: var(--paper3); }}
</style>'''
    return page('Ghosty B · design language', css + body)


def contact_sheet():
    return contact('b', 'Route B <span>· instrument and editorial</span>', 'Deep ink, warm paper, a serif for titles, thin instruments, the reactor as a blueprint',
                   '#0d1014', '#ece5d6', 'rgba(236,229,214,.6)', 'rgba(236,229,214,.16)', title_font="'Source Serif Mock'")


if __name__ == '__main__':
    for name, fn in [('home', home), ('chat', chat), ('eye', eye), ('gym', gym), ('settings', settings), ('language', language), ('contact', contact_sheet)]:
        write(HERE, f'{name}.html', fn())
    print('route B pages written')
