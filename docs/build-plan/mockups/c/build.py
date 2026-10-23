"""Route C (the blend): writes the five screens, the design-language card and the contact sheet as static HTML.
Run from the worktree root:  python3 -I docs/build-plan/mockups/c/build.py
Every number and word is something Ghosty has (sample values for a Friday evening in Birmingham, 23 Oct)."""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
from common import FRAME_CSS, GAMES, HOME_INDICATOR, contact, icon, game_icon, page, sparkline, status_bar, write  # noqa: E402
from globe import geometry, geometry_persp  # noqa: E402

CYAN = '#64d2ff'
AMBER = '#ffb340'


def P(cx, cy, r, a):
    t = math.radians(a)
    return cx + r * math.cos(t), cy + r * math.sin(t)


def arc(cx, cy, r, a0, a1):
    x0, y0 = P(cx, cy, r, a0)
    x1, y1 = P(cx, cy, r, a1)
    large = 1 if (a1 - a0) % 360 > 180 else 0
    return f'M{x0:.2f} {y0:.2f}A{r} {r} 0 {large} 1 {x1:.2f} {y1:.2f}'


def tabbar(on):
    tabs = [('ask', 'Ask'), ('see', 'See'), ('make', 'Make'), ('learn', 'Learn'), ('plan', 'Plan')]
    return '<nav class="tabs">' + ''.join(
        f'<div class="tab{" on" if k == on else ""}">{icon(k)}<span>{t}</span></div>' for k, t in tabs) + '</nav>'


def frame(body, cls='', tab=None, fade=True):
    return (f'<div class="screen {cls}">' + status_bar() + body + ('<div class="fadebot"></div>' if fade and tab else '')
            + (tabbar(tab) if tab else '') + HOME_INDICATOR + '</div>')


def style_tag():
    return f'<style>{FRAME_CSS}</style>'


# ------------------------------------------------------------------ the reactor (the hero)
def reactor_svg(cx=220, cy=146, gauges=True, size_id='h'):
    """The arc reactor as an instrument: live gauges outside, a tick ring, ten glowing cells under copper-dark
    coils, a polished collar and a glass dome over a white-hot core. The housing's brushed metal is a CSS
    conic gradient under this SVG (see .disc)."""
    s = []
    d = s.append
    d('<defs>'
      f'<radialGradient id="cell{size_id}" cx="{cx}" cy="{cy}" r="82" gradientUnits="userSpaceOnUse">'
      '<stop offset="0.6" stop-color="#f4fdff"/><stop offset="0.76" stop-color="#a9e9ff"/><stop offset="0.9" stop-color="#46b8e6"/><stop offset="1" stop-color="#16506b"/></radialGradient>'
      f'<radialGradient id="core{size_id}" cx="{cx - 6}" cy="{cy - 8}" r="44" gradientUnits="userSpaceOnUse">'
      '<stop offset="0" stop-color="#ffffff"/><stop offset="0.28" stop-color="#f2fcff"/><stop offset="0.55" stop-color="#9fe6ff"/><stop offset="0.82" stop-color="#3bb4e8"/><stop offset="1" stop-color="#0d3d55"/></radialGradient>'
      f'<linearGradient id="collar{size_id}" x1="0" y1="{cy - 54}" x2="0" y2="{cy + 54}" gradientUnits="userSpaceOnUse">'
      '<stop offset="0" stop-color="#d9e2ea"/><stop offset="0.35" stop-color="#6d7780"/><stop offset="0.7" stop-color="#2a3035"/><stop offset="1" stop-color="#5b646c"/></linearGradient>'
      f'<linearGradient id="bevel{size_id}" x1="0" y1="{cy - 90}" x2="0" y2="{cy + 90}" gradientUnits="userSpaceOnUse">'
      '<stop offset="0" stop-color="#ffffff" stop-opacity="0.34"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.04"/><stop offset="1" stop-color="#000000" stop-opacity="0.5"/></linearGradient>'
      f'<filter id="glow{size_id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>'
      f'<filter id="soft{size_id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>'
      f'<filter id="dot{size_id}" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.5"/></filter>'
      '</defs>')
    if gauges:
        # three live gauges, open at the bottom: 135 deg -> 405 deg
        G = [(120, 0.72, CYAN, 3.0, 1.0), (112, 0.313, '#e8eef3', 2.4, 0.85), (104, 0.5, '#e8eef3', 2.4, 0.5)]
        for r, v, col, w, op in G:
            d(f'<path d="{arc(cx, cy, r, 135, 405)}" fill="none" stroke="#fff" stroke-opacity="0.075" stroke-width="{w}" stroke-linecap="round"/>')
            a1 = 135 + 270 * v
            d(f'<path d="{arc(cx, cy, r, 135, a1)}" fill="none" stroke="{col}" stroke-opacity="{op}" stroke-width="{w}" stroke-linecap="round"/>')
            ex, ey = P(cx, cy, r, a1)
            if col == CYAN:
                d(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="5" fill="{CYAN}" opacity="0.7" filter="url(#dot{size_id})"/>')
                d(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="2.6" fill="#eafaff"/>')
        # scale ticks outside the outer gauge: every 10 %
        for k in range(11):
            a = 135 + 27 * k
            x0, y0 = P(cx, cy, 126, a)
            x1, y1 = P(cx, cy, 130 if k % 5 else 133, a)
            d(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#fff" stroke-opacity="{0.42 if k % 5 == 0 else 0.22}" stroke-width="1"/>')
    # tick ring
    for k in range(120):
        a = k * 3
        long = k % 10 == 0
        x0, y0 = P(cx, cy, 93 if long else 95, a)
        x1, y1 = P(cx, cy, 99, a)
        d(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#fff" stroke-opacity="{0.34 if long else 0.13}" stroke-width="{1 if long else 0.7}"/>')
    # bloom behind the cells
    d(f'<circle cx="{cx}" cy="{cy}" r="70" fill="{CYAN}" opacity="0.38" filter="url(#glow{size_id})"/>')
    # housing bevel ring
    d(f'<circle cx="{cx}" cy="{cy}" r="87.5" fill="none" stroke="url(#bevel{size_id})" stroke-width="1.4"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="83" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.2"/>')
    # ten cells under coils
    for k in range(10):
        a0 = -90 + k * 36 + 3.5
        a1 = a0 + 29
        xo0, yo0 = P(cx, cy, 79, a0)
        xo1, yo1 = P(cx, cy, 79, a1)
        xi1, yi1 = P(cx, cy, 59, a1)
        xi0, yi0 = P(cx, cy, 59, a0)
        cell = f'M{xo0:.2f} {yo0:.2f}A79 79 0 0 1 {xo1:.2f} {yo1:.2f}L{xi1:.2f} {yi1:.2f}A59 59 0 0 0 {xi0:.2f} {yi0:.2f}Z'
        d(f'<path d="{cell}" fill="url(#cell{size_id})"/>')
        # coil windings
        n = 10
        for j in range(n):
            a = a0 + 1.6 + (a1 - a0 - 3.2) * j / (n - 1)
            x0, y0 = P(cx, cy, 59.6, a)
            x1, y1 = P(cx, cy, 78.4, a)
            d(f'<line x1="{x0:.2f}" y1="{y0:.2f}" x2="{x1:.2f}" y2="{y1:.2f}" stroke="#1a120c" stroke-opacity="0.42" stroke-width="1.1"/>')
        d(f'<path d="{cell}" fill="none" stroke="#04080a" stroke-opacity="0.7" stroke-width="1"/>')
        # a highlight along each cell's outer edge
        d(f'<path d="{arc(cx, cy, 77.6, a0 + 2, a1 - 2)}" fill="none" stroke="#fff" stroke-opacity="0.28" stroke-width="0.8"/>')
    # collar
    d(f'<circle cx="{cx}" cy="{cy}" r="51.5" fill="none" stroke="url(#collar{size_id})" stroke-width="7"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="55.2" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="0.8"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="47.8" fill="none" stroke="#000" stroke-opacity="0.7" stroke-width="0.8"/>')
    # core: a glass dome over a white-hot centre
    d(f'<circle cx="{cx}" cy="{cy}" r="47" fill="#06141b"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="44" fill="url(#core{size_id})"/>')
    # inside the dome: a fine index ring and a lens ring, then the white-hot heart
    for k in range(48):
        a = k * 7.5
        x0, y0 = P(cx, cy, 33.5 if k % 4 else 32, a)
        x1, y1 = P(cx, cy, 36, a)
        d(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#06374d" stroke-opacity="{0.5 if k % 4 == 0 else 0.28}" stroke-width="0.8"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="27" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="0.7"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="22" fill="none" stroke="#0a4a66" stroke-opacity="0.18" stroke-width="3"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="16" fill="#fff" filter="url(#soft{size_id})"/>')
    d(f'<ellipse cx="{cx - 13}" cy="{cy - 19}" rx="17" ry="8" transform="rotate(-28 {cx - 13} {cy - 19})" fill="#fff" opacity="0.32" filter="url(#soft{size_id})"/>')
    d(f'<path d="{arc(cx, cy, 42, 200, 300)}" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="1.2" stroke-linecap="round"/>')
    return ''.join(s)


def disc_css(left, top, r):
    return (f'left:{left}px;top:{top}px;width:{2 * r}px;height:{2 * r}px;'
            'background:radial-gradient(circle, rgba(0,0,0,0) 56%, rgba(0,0,0,.35) 80%, rgba(0,0,0,.6) 100%),'
            'conic-gradient(from 210deg, #16191c, #3a4249 40deg, #1b1f22 95deg, #2c3339 160deg, #121518 215deg, #343c42 270deg, #1a1e21 320deg, #16191c);'
            'box-shadow: 0 18px 30px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.05);')


# ------------------------------------------------------------------ 1. HOME
def home():
    hero = f'''
<div class="hero">
  <div class="disc" style="{disc_css(132, 58, 88)}"></div>
  <svg class="rx" viewBox="0 0 440 292">
    {reactor_svg()}
    <defs><linearGradient id="gl" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.32"/></linearGradient>
    <linearGradient id="gr" x1="1" x2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.32"/></linearGradient></defs>
    <rect x="20" y="145.5" width="74" height="1" fill="url(#gl)"/>
    <rect x="346" y="145.5" width="74" height="1" fill="url(#gr)"/>
    {''.join(f'<rect x="{x}" y="142.5" width="1" height="7" fill="#fff" opacity="{0.06 + 0.3 * (x - 20) / 74:.2f}"/>' for x in range(20, 95, 12))}
    {''.join(f'<rect x="{x}" y="142.5" width="1" height="7" fill="#fff" opacity="{0.06 + 0.3 * (420 - x) / 74:.2f}"/>' for x in range(420, 345, -12))}
  </svg>
  <div class="co" style="left:20px;top:38px"><div class="k t-kick"><i style="background:{CYAN};box-shadow:0 0 6px {CYAN}"></i>Free AI</div><div class="v num">72<small>%</small></div><div class="s">left today</div></div>
  <div class="co r" style="right:20px;top:38px"><div class="k t-kick">School<i style="background:rgba(232,238,243,.5)"></i></div><div class="v">Nursery</div><div class="s">2 of 4 passed</div></div>
  <div class="co" style="left:20px;top:176px"><div class="k t-kick"><i style="background:rgba(232,238,243,.85)"></i>Library</div><div class="v num">4,186</div><div class="s num">1,312 studied</div></div>
  <div class="co r" style="right:20px;top:176px"><div class="k t-kick">Uplink<i style="border:1px solid rgba(232,238,243,.6)"></i></div><div class="v num">84<small>ms</small></div><div class="s">Secure</div></div>
</div>'''
    body = f'''
<div class="glow" data-bleed></div>
<div class="topline"><span class="date">Friday 23 October</span><span class="gbtn">{icon('search')}</span><span class="avatar">B</span></div>
<div class="hello"><div class="t-large">Good evening, Boss</div><div class="sub t-sub">{icon('rain')}11° · Light rain in Birmingham</div></div>
{hero}
<div class="state" style="top:430px"><span><i></i>ONLINE</span></div>
<div class="agenda glass">
  <div class="thead">{icon('calendar')}<b>Today</b><em class="num">2 left</em></div>
  <div class="evs">
    <div class="ev"><span class="tm num">19:30</span><span class="bar"></span><span class="nm">Call Mum</span><span class="in num">in 48 min</span></div>
    <div class="ev"><span class="tm num">21:00</span><span class="bar dim"></span><span class="nm r">Bins out</span></div>
  </div>
</div>
<div class="pair">
  <div class="tile glass road">
    <div class="thead">{icon('car')}<b>Roads near you</b></div>
    <div class="rd"><i></i><b>M6 J6–J7</b></div>
    <div class="why">Queue northbound<br><span class="num">+12 min</span></div>
    <div class="clr mono">CLEARS BY <b>19:40</b></div>
  </div>
  <div class="tile glass gymt">
    <div class="thead">{icon('gym')}<b>Gym</b></div>
    <div class="row">
      <span class="segr">{seg_ring(LEVELS, 58)}<b class="num">3</b></span>
      <div><div class="of1 num">of 22 games</div><div class="of">mastered</div></div>
    </div>
    <div class="clr mono">LAST: SUDOKU · LV 6</div>
  </div>
</div>
<div class="chips"><span class="chip">{icon('brief')}Brief me</span><span class="chip">{icon('calendar')}What’s on today</span><span class="chip">{icon('globe')}God’s eye</span></div>
<div class="ask"><span class="ph">Ask anything</span><span class="micb">{icon('mic')}</span></div>
'''
    return page('Ghosty C · Home', style_tag() + frame(body, 'home', 'ask'))


def seg_ring(levels, size):
    """One segment per game round a ring: mastered games lit cyan, the rest brighter the higher their level."""
    n = len(levels)
    out = [f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" style="display:block">']
    for i, lv in enumerate(levels):
        a0 = -90 + i * 360 / n + 2.2
        a1 = a0 + 360 / n - 4.4
        out.append(f'<path d="{arc(50, 50, 44, a0, a1)}" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="7"/>')
        if lv == 10:
            out.append(f'<path d="{arc(50, 50, 44, a0, a1)}" fill="none" stroke="{CYAN}" stroke-width="7" style="filter:drop-shadow(0 0 2px {CYAN})"/>')
        elif lv > 1:
            out.append(f'<path d="{arc(50, 50, 44, a0, a1)}" fill="none" stroke="#fff" stroke-opacity="{0.05 * lv:.2f}" stroke-width="7"/>')
    out.append('</svg>')
    return ''.join(out)


def ring_svg(frac, size, w, goal, track=0.1, col=CYAN, glow=True):
    r = 50 - w * 50 / size - 1
    C = 2 * math.pi * r
    sw = w * 100 / size
    g = ''
    if goal:
        a = -90 + goal * 360
        x0, y0 = P(50, 50, r - sw * 0.9, a)
        x1, y1 = P(50, 50, r + sw * 0.9, a)
        gx, gy = P(50, 50, r, a)
        g = f'<circle cx="{gx:.1f}" cy="{gy:.1f}" r="{sw * 0.62:.1f}" fill="#0b0d0f" stroke="#fff" stroke-width="2"/>'
    fl = f'drop-shadow(0 0 3px rgba(100,210,255,.55))' if glow and frac > 0 else 'none'
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" style="flex:none;filter:{fl}">'
            f'<circle cx="50" cy="50" r="{r:.1f}" fill="none" stroke="#fff" stroke-opacity="{track}" stroke-width="{sw:.1f}"/>'
            + (f'<circle cx="50" cy="50" r="{r:.1f}" fill="none" stroke="{col}" stroke-width="{sw:.1f}" stroke-linecap="round" stroke-dasharray="{frac * C:.1f} {C:.1f}" transform="rotate(-90 50 50)"/>' if frac > 0 else '')
            + g + '</svg>')


# ------------------------------------------------------------------ 2. CHAT
def chat():
    body = f'''
<div class="navfade"></div>
<div class="nav"><span class="gbtn">{icon('back')}</span><div class="ttl">Chat</div><span class="avatar">B</span></div>
<div class="log">
  <div class="daysep">Today 18:31</div>
  <div class="me"><span>What’s on tonight?</span></div>
  <div class="gh"><div class="who"><span class="dot"></span>Ghosty <em>· Llama 4 Scout</em></div><p>Call Mum at half seven, then the bins go out at nine. Nothing else in the diary.</p></div>
  <div class="me"><span>Is the M6 bad tonight, and will it rain on the way to Mum’s?</span></div>
  <div class="steps"><span class="ck">{icon('check')}</span><span class="n3 num">3 steps</span><span class="sep"></span>Web search, weather, 2 pages read{icon('chevdown', 'i chv')}</div>
  <div class="reply glass">
    <div class="who"><span class="dot"></span>Ghosty <em>· Gemini 2.5 Flash</em><span class="cited">{icon('check')}CITED</span></div>
    <p>Not great. There’s a queue on the M6 northbound between junctions 6 and 7, adding about 12 minutes<span class="cite">1</span>, and it should clear by about 19:40<span class="cite">1</span>. Light rain until around nine, so the roads will be wet<span class="cite">2</span>. Leave after half seven and you’ll miss most of it.</p>
    <div class="check"><span class="ck">{icon('check')}</span><span>3 of 3 claims found in the sources</span></div>
    <div class="srcs">
      <div class="src"><span class="n">1</span><span class="tx"><b>M6 northbound J6 to J7 · queue</b><span>nationalhighways.co.uk</span></span>{icon('chev')}</div>
      <div class="src"><span class="n">2</span><span class="tx"><b>Birmingham forecast, tonight</b><span>metoffice.gov.uk</span></span>{icon('chev')}</div>
    </div>
    <div class="acts"><span class="act">{icon('up')}</span><span class="act">{icon('down')}</span><span class="act">{icon('copy')}</span><span class="act">{icon('listen')}</span><span class="think">{icon('think')}Think harder</span></div>
  </div>
</div>
<div class="fadebot" style="height:150px"></div>
<div class="composer"><span class="plus">{icon('plus')}</span><span class="ph">Ask anything</span><span class="citedtog">{icon('check')}CITED</span><span class="micb">{icon('mic')}</span></div>
'''
    return page('Ghosty C · Chat', style_tag() + frame(body, 'chat'))


# ------------------------------------------------------------------ 3. GOD'S EYE
PLANES = [  # (lat, lon, heading) along the real North Atlantic and European flows
    (52.0, -0.3, 110), (53.2, -2.6, 320), (51.6, -3.4, 265), (54.4, -3.0, 335), (52.9, -4.4, 290), (51.9, 1.4, 80), (50.8, -1.0, 200),
    (53.9, 0.6, 20), (55.2, -6.1, 300), (51.3, -6.5, 260), (49.9, -1.9, 185), (56.5, -2.2, 10), (52.4, 2.9, 70), (50.4, 0.6, 150),
    (53.6, -12.5, 285), (54.9, -18.0, 290), (52.8, -22.5, 280), (56.1, -25.0, 292), (51.4, -15.2, 268), (49.8, -9.8, 250),
    (51.1, -1.2, 120), (52.9, 0.8, 95), (50.3, 2.1, 160), (48.6, 2.6, 200), (47.2, 6.8, 140), (45.8, 4.6, 190),
    (53.4, -6.3, 300), (55.6, -4.1, 330), (50.9, 4.4, 75), (52.3, 4.9, 60), (49.1, -3.9, 225), (46.5, -1.8, 210),
    (44.2, 1.2, 175), (51.9, 8.5, 85), (48.1, 11.3, 110), (53.5, 10.0, 70), (57.5, -2.0, 15), (60.1, 1.5, 30),
    (54.3, -1.5, 340), (52.0, -4.5, 270), (50.2, -5.6, 255), (43.4, -3.6, 200), (41.9, -8.1, 205), (40.4, -3.7, 230),
    (47.9, -14.6, 255), (45.5, -18.9, 245), (58.6, -10.1, 300), (55.0, 6.2, 50), (49.6, 13.4, 120), (45.4, 9.2, 150),
]
QUAKES = [(64.0, -21.3, 3.1), (38.4, 22.1, 4.2), (37.9, 27.4, 3.6), (36.7, -9.9, 3.4), (42.6, 13.2, 2.9)]
INCIDENTS = [(52.62, -2.02), (52.36, -1.70), (52.84, -2.18), (51.48, -0.45), (53.45, -2.30), (51.20, -2.70), (53.80, -1.50)]
LABELS = ['London', 'Paris', 'Dublin', 'Edinburgh', 'Glasgow', 'Cardiff', 'Amsterdam', 'Nantes', 'Oslo']


def globe_svg(g, style='c'):
    """The globe through the app's tilted camera: haze at the horizon, land in graphite with cyan coastlines,
    the night side darker, city lights where it is dark now, and a thin atmosphere along the limb."""
    o = g['o']
    x1, y1, x2, y2 = g['sun']
    limb = g['limb']
    s = [f'<svg class="globe" data-bleed viewBox="0 0 440 956" width="440" height="956">',
         '<defs>',
         '<linearGradient id="ocean" x1="0" y1="110" x2="0" y2="956" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1b2c38"/><stop offset="0.12" stop-color="#101b23"/><stop offset="0.5" stop-color="#0a1117"/><stop offset="1" stop-color="#070b0f"/></linearGradient>',
         f'<linearGradient id="term" x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.3" stop-color="#000" stop-opacity="0.12"/><stop offset="0.6" stop-color="#000" stop-opacity="0.38"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient>',
         '<linearGradient id="haze" x1="0" y1="110" x2="0" y2="330" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#64d2ff" stop-opacity="0.28"/><stop offset="0.25" stop-color="#64d2ff" stop-opacity="0.08"/><stop offset="1" stop-color="#64d2ff" stop-opacity="0"/></linearGradient>',
         f'<clipPath id="disc"><path d="{limb}"/></clipPath>',
         '<filter id="lights" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>',
         '<filter id="atmo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>',
         '<filter id="rain" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>',
         '</defs>',
         '<rect width="440" height="956" fill="#010203"/>',
         f'<path d="{limb}" fill="none" stroke="{CYAN}" stroke-opacity="0.55" stroke-width="16" filter="url(#atmo)"/>',
         f'<path d="{limb}" fill="url(#ocean)"/>',
         '<g clip-path="url(#disc)">',
         f'<path d="{g["grat"]}" fill="none" stroke="#fff" stroke-opacity="0.045" stroke-width="0.6"/>',
         f'<path d="{g["land"]}" fill="#1c242b" stroke="{CYAN}" stroke-opacity="0.34" stroke-width="0.8" stroke-linejoin="round"/>',
         f'<path d="{g["borders"]}" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="0.6"/>',
         '<rect width="440" height="956" fill="url(#term)"/>',
         '<rect width="440" height="956" fill="url(#haze)"/>',
         '<g filter="url(#lights)">' + ''.join(f'<circle cx="{x}" cy="{y}" r="{r * 2.2:.2f}" fill="#ffcf8a" opacity="{a * 0.45:.2f}"/>' for x, y, r, a, n in g['lights'] if not (x < 330 and 588 < y < 660)) + '</g>',
         ''.join(f'<circle cx="{x}" cy="{y}" r="{r * 0.6:.2f}" fill="#fff1d6" opacity="{a * 0.9:.2f}"/>' for x, y, r, a, n in g['lights'] if not (x < 330 and 588 < y < 660)),
         '</g>',
         f'<path d="{limb}" fill="none" stroke="#bfefff" stroke-opacity="0.5" stroke-width="1"/>']
    # aircraft
    for lat, lon, hd in PLANES:
        p = o.xy(lon, lat)
        if not p:
            continue
        x, y = p
        if y > 560:
            continue
        s.append(f'<g transform="translate({x:.1f} {y:.1f}) rotate({hd})"><path d="M0 -4.2L2.6 3.2 0 1.8 -2.6 3.2Z" fill="{CYAN}" opacity="0.95"/></g>')
    for lat, lon in INCIDENTS:
        p = o.xy(lon, lat)
        if p:
            s.append(f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="2.6" fill="{AMBER}" stroke="#1a1206" stroke-width="0.8"/>')
    # rain radar over the Midlands and Wales: soft cyan cells
    for lat, lon, rr, op in [(52.9, -3.4, 30, 0.2), (52.3, -2.6, 20, 0.17), (53.4, -4.2, 34, 0.16), (51.8, -3.9, 24, 0.15), (52.6, -1.9, 14, 0.12), (53.9, -2.9, 18, 0.1)]:
        p = o.xy(lon, lat)
        if p:
            s.append(f'<ellipse cx="{p[0]:.1f}" cy="{p[1]:.1f}" rx="{rr}" ry="{rr * 0.55:.1f}" fill="{CYAN}" opacity="{op}" filter="url(#rain)"/>')
    # city labels
    from globe import world
    cities = {c[0]: c for c in world()['cities']}
    hx0, hy0 = o.xy(-1.922, 52.477)
    placed = [(hx0, hy0), (hx0 + 50, hy0 - 16), (hx0 + 90, hy0 - 16)]
    for n in LABELS:
        c = cities.get(n)
        if not c:
            continue
        p = o.xy(c[2], c[1])
        if p and any(abs(p[0] - q[0]) < 70 and abs(p[1] - q[1]) < 18 for q in placed):
            continue
        if p and 24 < p[0] < 330 and 200 < p[1] < 560:
            placed.append(p)
            s.append(f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="1.6" fill="#fff" opacity="0.8"/><text x="{p[0] + 5:.1f}" y="{p[1] + 3.5:.1f}" font-family="Inter Mock" font-size="10.5" font-weight="500" fill="#fff" fill-opacity="0.66" letter-spacing="0.2">{n}</text>')
    # the crosshair over home (Birmingham)
    hx, hy = o.xy(-1.922, 52.477)
    s.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="15" fill="none" stroke="{CYAN}" stroke-opacity="0.3" stroke-width="1"/>'
             f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="4.2" fill="{CYAN}"/><circle cx="{hx:.1f}" cy="{hy:.1f}" r="4.2" fill="none" stroke="#fff" stroke-width="1.4"/>')
    for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
        s.append(f'<line x1="{hx + dx * 22:.1f}" y1="{hy + dy * 22:.1f}" x2="{hx + dx * 34:.1f}" y2="{hy + dy * 34:.1f}" stroke="#fff" stroke-opacity="0.8" stroke-width="1.2" stroke-linecap="round"/>')
    s.append(f'<text x="{hx + 20:.1f}" y="{hy - 14:.1f}" font-family="Inter Mock" font-size="11" font-weight="600" fill="#fff" letter-spacing="0.6">BIRMINGHAM</text>')
    s.append('</svg>')
    return ''.join(s)


def eye():
    g = geometry_persp(52.477, -1.922, 3800, 46, 1025, 220, 420)
    body = f'''
{globe_svg(g)}
<div class="navfade" style="height:180px;background:linear-gradient(180deg,rgba(2,3,4,.85) 30%,rgba(2,3,4,0))"></div>
<div class="top"><span class="gbtn">{icon('back')}</span><span class="search">{icon('search')}Search place, flight, ship, satellite…</span></div>
<div class="layers">
  <span class="lchip ico">{icon('layers')}</span>
  <span class="lchip on">{icon('plane')}Aircraft <span class="c num">1,204</span></span>
  <span class="lchip on warn">{icon('warn')}Incidents <span class="c num">7</span></span>
  <span class="lchip on">{icon('rain')}Radar</span>
</div>
<div class="rail"><div>{icon('plus')}</div><div class="zl num">3,050<br>km</div><div>{icon('minus')}</div></div>
<div class="readout mono">
  <div class="hl">52.477° −1.922°&nbsp; <b>BIRMINGHAM</b></div>
  <div>ALT 3,050 KM · TILT 46° · HDG 0°</div>
  <div>1,204 AC · 318 SHIP · 86 CAM · 894 SAT · 12 EQ</div>
</div>
<div class="spot">
  <div class="cap"><span>THIS SPOT</span><em>Birmingham</em></div>
  <div class="sbtns">
    <span class="sb6"><span class="ic">{icon('map')}</span>Map</span>
    <span class="sb6"><span class="ic">{icon('cube')}</span>3D</span>
    <span class="sb6"><span class="ic">{icon('street')}</span>Street View</span>
    <span class="sb6"><span class="ic">{icon('traffic')}</span>Traffic</span>
    <span class="sb6"><span class="ic">{icon('route')}</span>Go</span>
    <span class="sb6"><span class="ic">{icon('nav')}</span>Road ahead</span>
  </div>
  <div class="vrow"><span class="cap">VIEW</span><span class="vbtn">{icon('sun')}Look</span><span class="vbtn">{icon('home')}Home</span><span class="vbtn">{icon('north')}North</span><span class="vbtn">{icon('tilt')}Tilt</span></div>
</div>
'''
    html = style_tag() + frame(body, 'eye', 'see', fade=False)
    return page('Ghosty C · God’s Eye', html)


# ------------------------------------------------------------------ 4. GYM
# 22 games: (level, mastery, mastered) - least-mastered first is what TRAIN ALL trains next.
LEVELS = [10, 10, 10, 8, 7, 6, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1]
STARTED = 18


def gym():
    bars = []
    for i, lv in enumerate(LEVELS):
        h = 6 + 56 * lv / 10
        cls = 'm' if lv == 10 else ('z' if i >= STARTED else '')
        bars.append(f'<i class="{cls}" style="height:{h:.0f}px"></i>')
    grid_lines = ''.join(f'<span class="g" style="bottom:{6 + 56 * k / 10:.0f}px"></span>' for k in (5, 10))
    cards = [
        ('sudoku', 'Sudoku', 6, 0.66, 0.70, 'Paused', [0.1, 0.18, 0.22, 0.31, 0.36, 0.41, 0.47, 0.52, 0.55, 0.6, 0.62, 0.64, 0.66]),
        ('tictactoe', 'Tic-tac-toe', 10, 1.0, None, 'Mastered', [0.2, 0.42, 0.55, 0.68, 0.77, 0.85, 0.9, 0.94, 0.97, 1.0, 1.0]),
        ('connect4', 'Connect 4', 8, 0.83, 0.85, 'Paused', [0.15, 0.3, 0.41, 0.5, 0.58, 0.66, 0.7, 0.75, 0.79, 0.81, 0.83]),
        ('chess', 'Chess', 3, 0.44, 0.55, 'Paused', [0.08, 0.14, 0.2, 0.24, 0.29, 0.31, 0.36, 0.38, 0.41, 0.44]),
        ('maze', 'Maze', 10, 1.0, None, 'Mastered', [0.3, 0.5, 0.66, 0.8, 0.9, 0.96, 1.0, 1.0]),
        ('words', 'Word Guess', 5, 0.58, 0.65, 'Paused', [0.12, 0.2, 0.3, 0.37, 0.44, 0.49, 0.53, 0.58]),
    ]
    cc = []
    for gid, name, lv, m, goal, st, hist in cards:
        done = st == 'Mastered'
        pts = sparkline(hist, 166, 26)
        last = pts.split(' ')[-1].split(',')
        col = CYAN if done else 'rgba(235,240,245,.75)'
        cc.append(f'''<div class="gcard glass">
  <div class="top"><span class="sq">{game_icon(gid)}</span><span class="ring">{ring_svg(m, 46, 4.2, goal, glow=done, col=CYAN if done else '#e8eef3')}<b class="num">{lv}</b></span></div>
  <div class="nm">{name}</div>
  <div class="lv num">{'All 10 levels' if done else f'Level {lv} · {round(m * 100)}%'}</div>
  <svg class="spk" viewBox="0 0 166 26" preserveAspectRatio="none"><polyline points="{pts}" fill="none" stroke="{col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/><circle cx="{last[0]}" cy="{last[1]}" r="2.4" fill="{col}"/></svg>
  <div class="st{' done' if done else ''}"><i></i>{st}</div>
</div>''')
    body = f'''
<div class="navfade"></div>
<div class="nav"><span class="gbtn">{icon('back')}</span><span class="avatar">B</span></div>
<div class="ltitle"><div class="t-large">Gym</div><div class="sub t-sub">Ghosty teaches himself by playing, on this phone.</div></div>
<div class="trainall glass">
  <div class="hd"><span class="t-kick">Levels by game · <b class="num">3 of 22</b> mastered</span><span class="t-kick num">LV 1–10</span></div>
  <div class="lvls">{grid_lines}{''.join(bars)}</div>
  <div class="trow"><span class="primary">{icon('play')}Train all</span><span class="awake">{icon('moon')}Keep awake<span class="sw"></span></span></div>
  <div class="stline"><i></i><span>Not running · least mastered first, starting with Debate Arena · runs until all 22 are mastered or you tap Stop</span></div>
</div>
<div class="sechd"><span class="t-title">Games</span><span class="num">22 games · 4 not started</span></div>
<div class="ggrid">{''.join(cc)}</div>
'''
    return page('Ghosty C · Gym', style_tag() + frame(body, 'gym', 'learn'))


# ------------------------------------------------------------------ 5. SETTINGS (the Me sheet)
def dial(frac, label_val, unit, word, warn=False):
    r = 31
    C = 2 * math.pi * r
    sweep = 0.75
    col = AMBER if warn else CYAN
    ticks = ''.join(
        f'<line x1="{P(37, 37, 35.5, 135 + 27 * k)[0]:.1f}" y1="{P(37, 37, 35.5, 135 + 27 * k)[1]:.1f}" x2="{P(37, 37, 37, 135 + 27 * k)[0]:.1f}" y2="{P(37, 37, 37, 135 + 27 * k)[1]:.1f}" stroke="#fff" stroke-opacity=".3" stroke-width="1"/>'
        for k in range(11))
    return (f'<svg width="74" height="74" viewBox="0 0 74 74">{ticks}'
            f'<circle cx="37" cy="37" r="{r}" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="4" stroke-linecap="round" stroke-dasharray="{C * sweep:.1f} {C:.1f}" transform="rotate(135 37 37)"/>'
            f'<circle cx="37" cy="37" r="{r}" fill="none" stroke="{col}" stroke-width="4" stroke-linecap="round" stroke-dasharray="{C * sweep * frac:.1f} {C:.1f}" transform="rotate(135 37 37)" style="filter:drop-shadow(0 0 3px {col}88)"/>'
            '</svg>')


def settings():
    body = f'''
<div class="behind"><img src="home.png" alt=""></div>
<div class="sheet">
  <span class="grab"></span>
  <div class="mehead"><span class="meav">B</span><div class="who2"><div class="t-title">Boss</div><span>Graphite · °C, km</span></div><span class="gbtn">{icon('close')}</span></div>
  <div class="status glass">
    <div class="hd"><span class="t-head">Status</span><span class="ok"><i></i>All good</span></div>
    <div class="gauges">
      <div class="gauge"><div class="dial">{dial(0.72, '72', '%', 'LEFT')}<b class="num">72<small>%</small></b><em>LEFT</em></div><div class="gl">Free AI today</div><div class="gs">Groq, Gemini ready</div></div>
      <div class="gauge"><div class="dial">{dial(0.18, '18', '%', 'USED')}<b class="num">18<small>%</small></b><em>USED</em></div><div class="gl">Database today</div><div class="gs num">Resets 01:00</div></div>
      <div class="gauge"><div class="dial">{dial(1.0, '', '', '')}<b style="top:26px;font-size:15px">Ready</b></div><div class="gl">Offline brain</div><div class="gs">Qwen3 0.6B, on phone</div></div>
    </div>
    <div class="srow"><span class="k">Ghosty</span><span class="v"><i></i>Connected</span></div>
    <div class="srow"><span class="k">Self-edit</span><span class="v">On</span></div>
    <div class="srow"><span class="k">This phone</span><span class="v">Paired with your owner key</span></div>
    <div class="srow"><span class="k">Version</span><span class="v">Up to date</span></div>
  </div>
  <div class="grp" style="top:470px">
    <div class="lrow"><span class="sq">{icon('brain')}</span><span class="tx"><b>Memory</b><span>What I know about you</span></span>{icon('chev', 'i chv')}</div>
    <div class="lrow"><span class="sq">{icon('sliders')}</span><span class="tx"><b>Settings</b><span>Look, voice, home and about</span></span>{icon('chev', 'i chv')}</div>
    <div class="lrow"><span class="sq">{icon('chip')}</span><span class="tx"><b>System</b><span>Keys, models, storage and backups</span></span>{icon('chev', 'i chv')}</div>
  </div>
  <div class="grp" style="top:666px">
    <div class="lrow"><span class="sq">{icon('link')}</span><span class="tx"><b>Links</b><span>Email, Spotify and your phone</span></span>{icon('chev', 'i chv')}</div>
    <div class="lrow"><span class="sq">{icon('grid')}</span><span class="tx"><b>Every screen</b><span>All of Ghosty at once</span></span>{icon('chev', 'i chv')}</div>
  </div>
  <div class="foot num" style="top:808px">Ghosty 29e6c95 · built 2 hours ago</div>
</div>
'''
    return page('Ghosty C · Me', style_tag() + frame(body, 'mescreen'))



# ------------------------------------------------------------------ the design-language card
def language():
    sw = [
        ('#050607', 'Canvas', 'Graphite black · #050607', ''),
        ('#0d0f11', 'Raised', 'Sheets · #0D0F11', ''),
        ('linear-gradient(180deg, rgba(255,255,255,.072), rgba(255,255,255,.034)), #050607', 'Glass', 'White 7 → 3.5 % · blur 28', 'box-shadow: inset 0 0 0 1px rgba(255,255,255,.08)'),
        ('#f4f6f8', 'Ink', 'Text · #F4F6F8', ''),
        ('rgba(235,240,245,.64)', 'Ink 2', 'Secondary · 64 %', ''),
        ('rgba(235,240,245,.40)', 'Ink 3', 'Labels · 40 %', ''),
        ('#64d2ff', 'Reactor cyan', 'Live and active only', 'box-shadow: 0 0 18px rgba(100,210,255,.45)'),
        ('#ffb340', 'Amber', 'Warnings only', ''),
    ]
    swatches = ''.join(f'<div class="swt"><span style="background:{c};{x}"></span><b>{n}</b><em>{d}</em></div>' for c, n, d, x in sw)
    types = [
        ('Large title', '34/41 · Bold · −0.4', 't-large', 'Good evening'),
        ('Title', '22/28 · Bold', 't-title', 'Games'),
        ('Headline', '17/22 · Semibold', 't-head', 'Call Mum'),
        ('Body', '17/24 · Regular', 't-body', 'Light rain until around nine.'),
        ('Subhead', '15/20 · Regular', 't-sub', 'Ghosty teaches himself by playing.'),
        ('Caption', '13/18 · Regular', 't-cap', '3 of 3 claims found in the sources'),
        ('Kicker', '11/13 · Semibold · +9 % caps', 't-kick', 'Free AI · School · Library'),
    ]
    trows = ''.join(f'<div class="ty"><div class="tm"><b>{n}</b><em>{d}</em></div><div class="{c}">{t}</div></div>' for n, d, c, t in types)
    trows += '<div class="ty"><div class="tm"><b>Readout</b><em>11/16 · tabular, tracked +4 %</em></div><div class="mono" style="font-size:12px;line-height:16px;color:rgba(235,240,245,.78)">52.477° −1.922° · ALT 3,050 KM</div></div>'
    body = f'''
<div class="lang">
  <header><div><div class="eyebrow">Route C · the blend</div><h1>Calm like an iPhone. Alive like Jarvis.</h1>
  <p>Apple-quality calm is the base: graphite black, glass, SF-style type, one accent. The Iron Man character comes only from instruments that show something true: the reactor’s live gauges, thin tick marks, a tabular readout, hairline guides that fade.</p></div>
  <div class="hero2"><div class="disc" style="{disc_css(46, 20, 88)}"></div><svg viewBox="0 0 268 268" width="268" height="268" style="position:absolute;inset:0;overflow:visible">{reactor_svg(134, 108, True, 'L')}</svg></div></header>
  <section class="cols">
    <div class="col"><h2>Palette</h2><div class="sws">{swatches}</div>
      <h2 style="margin-top:34px">Grid and shape</h2>
      <ul class="notes"><li><b>8 pt grid</b>, 20 pt side margins, 12 pt gutters</li><li><b>Cards</b> 20 pt radius, 1 px white-8 % hairline, soft 40 pt shadow</li><li><b>Controls</b> 44 pt minimum; pills are fully round</li><li><b>Tab bar</b> five areas in a floating glass pill, 64 pt high</li><li><b>Dark first</b>: true black is free on OLED</li></ul>
    </div>
    <div class="col"><h2>Type <small>SF Pro on the iPhone · Inter stands in here</small></h2>{trows}
      <h2 style="margin-top:30px">Motion</h2>
      <ul class="notes"><li><b>Breathing reactor</b>: a 4 s cycle, glow ±6 %, drawn at 120 Hz</li><li><b>Springs</b> for taps and sheets: response 0.35 s, damping 0.85</li><li><b>Live gauges</b> ease to each new value over 600 ms</li><li><b>Reduce motion</b>: no breathing, gauges step, cross-fades instead of slides</li></ul>
    </div>
    <div class="col comp"><h2>Components</h2>
      <div class="cgrid">
        <div class="cbox"><span class="primary" style="width:100%">{icon('play')}Train all</span><div class="lbl">Primary · one per screen</div></div>
        <div class="cbox"><div style="display:flex;gap:8px;flex-wrap:wrap"><span class="think" style="margin-left:0">{icon('think')}Think harder</span><span class="chip">{icon('brief')}Brief me</span></div><div class="lbl">Secondary and chips</div></div>
        <div class="cbox"><div style="display:flex;gap:8px;align-items:center"><span class="lchip on">{icon('plane')}Aircraft <span class="c num">1,204</span></span><span class="lchip on warn">{icon('warn')}Incidents <span class="c num">7</span></span></div><div class="lbl">Layer chips: live (cyan), warning (amber)</div></div>
        <div class="cbox"><div style="display:flex;gap:10px;align-items:center"><span class="citedtog">{icon('check')}CITED</span><span class="cite" style="margin:0">1</span><span class="cite" style="margin:0">2</span><span class="sw on"></span><span class="sw"></span></div><div class="lbl">Toggles, source chips, switches</div></div>
        <div class="cbox"><div style="display:flex;gap:16px;align-items:center"><span class="ring" style="width:46px;height:46px">{ring_svg(0.66, 46, 4.2, 0.70, glow=False, col='#e8eef3')}<b class="num">6</b></span><span class="ring" style="width:46px;height:46px">{ring_svg(1.0, 46, 4.2, None)}<b class="num">10</b></span><span class="segr">{seg_ring(LEVELS, 58)}<b class="num">3</b></span><span class="dialw" style="position:relative;width:74px;height:74px">{dial(0.72, '', '', '')}<b class="num" style="position:absolute;left:0;right:0;top:25px;text-align:center;font-size:18px;font-weight:600">72<small style="font-size:11px;color:rgba(235,240,245,.64)">%</small></b></span></div><div class="lbl">Rings with the pass mark, one segment per game, a gauge</div></div>
        <div class="cbox"><svg viewBox="0 0 166 26" width="250" height="34" preserveAspectRatio="none"><polyline points="{sparkline([0.1, 0.18, 0.22, 0.31, 0.36, 0.41, 0.47, 0.52, 0.55, 0.6, 0.62, 0.64, 0.66], 166, 26)}" fill="none" stroke="#64d2ff" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><div class="state" style="position:static;justify-content:flex-start;margin-top:10px"><span><i></i>ONLINE</span></div><div class="lbl">Sparkline, live state</div></div>
        <div class="cbox wide"><div class="grp" style="position:static"><div class="lrow"><span class="sq">{icon('brain')}</span><span class="tx"><b>Memory</b><span>What I know about you</span></span>{icon('chev', 'i chv')}</div><div class="lrow"><span class="sq">{icon('sliders')}</span><span class="tx"><b>Settings</b><span>Look, voice, home and about</span></span>{icon('chev', 'i chv')}</div></div><div class="lbl">Grouped list: neutral glass icons, one accent kept for what is live</div></div>
        <div class="cbox wide" style="height:112px;position:relative">{tabbar('ask').replace('class="tabs"', 'class="tabs" style="position:absolute;left:0;right:0;bottom:30px"')}<div class="lbl" style="position:absolute;bottom:0">Tab bar: Ask, See, Make, Learn, Plan; Me sits top right</div></div>
      </div>
    </div>
  </section>
</div>'''
    css = f'''<style>{FRAME_CSS}
body {{ background: #050607; width: 1600px; }}
.lang {{ width: 1600px; padding: 56px 64px 64px; color: var(--ink); background: radial-gradient(800px 500px at 1240px 120px, rgba(100,210,255,.10), rgba(100,210,255,0)), #050607; }}
.lang header {{ display: flex; justify-content: space-between; align-items: center; gap: 40px; padding-bottom: 36px; border-bottom: 1px solid var(--hair); }}
.eyebrow {{ font-size: 13px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--cyan); }}
.lang h1 {{ margin-top: 10px; font-size: 44px; line-height: 50px; font-weight: 700; letter-spacing: -0.8px; }}
.lang header p {{ margin-top: 14px; max-width: 760px; font-size: 18px; line-height: 27px; color: var(--ink2); }}
.hero2 {{ position: relative; width: 268px; height: 236px; flex: none; margin-right: 40px; }}
.hero2 .disc {{ position: absolute; border-radius: 50%; }}
.cols {{ display: grid; grid-template-columns: 290px 390px minmax(0, 1fr); gap: 48px; padding-top: 36px; }}
.lang h2 {{ font-size: 13px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--ink3); margin-bottom: 16px; }}
.lang h2 small {{ text-transform: none; letter-spacing: 0; font-weight: 500; margin-left: 6px; }}
.sws {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }}
.swt span {{ display: block; height: 64px; border-radius: 14px; border: 1px solid var(--hair); }}
.swt b {{ display: block; margin-top: 8px; font-size: 14px; font-weight: 600; }}
.swt em {{ display: block; font-style: normal; font-size: 12px; color: var(--ink3); margin-top: 1px; }}
.notes {{ list-style: none; }}
.notes li {{ font-size: 14px; line-height: 20px; color: var(--ink2); padding: 7px 0; border-top: 1px solid var(--hair); }}
.notes li b {{ color: var(--ink); font-weight: 600; }}
.ty {{ display: flex; gap: 18px; align-items: baseline; padding: 10px 0; border-top: 1px solid var(--hair); }}
.ty .tm {{ width: 130px; flex: none; }}
.ty .tm b {{ display: block; font-size: 13px; font-weight: 600; }}
.ty .tm em {{ display: block; font-style: normal; font-size: 11.5px; color: var(--ink3); margin-top: 2px; }}
.ty .t-large {{ white-space: nowrap; }}
.cgrid {{ display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }}
.cbox {{ padding: 18px; border-radius: 20px; background: rgba(255,255,255,.03); border: 1px solid var(--hair); }}
.cbox.wide {{ grid-column: span 2; }}
.lbl {{ margin-top: 12px; font-size: 12px; line-height: 16px; color: var(--ink3); }}
</style>'''
    return page('Ghosty C · design language', css + body)


def contact_sheet():
    return contact('c', 'Route C <span>· the blend</span>', 'Apple-quality calm; the Jarvis character only from instruments', '#0a0b0c', '#f4f6f8', 'rgba(235,240,245,.6)', 'rgba(255,255,255,.12)')


if __name__ == '__main__':
    for name, fn in [('home', home), ('chat', chat), ('eye', eye), ('gym', gym), ('settings', settings), ('language', language), ('contact', contact_sheet)]:
        write(HERE, f'{name}.html', fn())
    print('route C pages written')
