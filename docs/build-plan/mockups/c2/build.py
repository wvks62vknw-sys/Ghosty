"""Route C2: route C pushed to "Tony Stark navigating Ghosty" (BRIEF-DESIGN-C2.md). Builds on route C: its helpers
come from ../c/build.py, its stylesheet is copied here as style.css and extended by c2.css.
Writes eight screens, the design-language card and the contact sheet as static HTML.
Run from the worktree root:  python3 -I -B docs/build-plan/mockups/c2/build.py
Every value is something Ghosty has (sample values for Friday 23 Oct, 18:42, Birmingham)."""
import importlib.util, math, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
from common import FRAME_CSS, GAMES, HOME_INDICATOR, ICONS, icon, game_icon, page, sparkline, status_bar, write  # noqa: E402
from globe import geometry_persp, world  # noqa: E402

_spec = importlib.util.spec_from_file_location('route_c', os.path.join(HERE, '..', 'c', 'build.py'))
C = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(C)
P, arc, disc_css, seg_ring, LEVELS = C.P, C.arc, C.disc_css, C.seg_ring, C.LEVELS
CYAN, AMBER = C.CYAN, C.AMBER
CSS = ('style.css', 'c2.css')


def tabbar(on):
    return C.tabbar(on)


def frame(body, cls='', tab=None, hexes=True):
    return (f'<style>{FRAME_CSS}</style><div class="screen {cls}">' + (hexgrid() if hexes else '') + status_bar() + body
            + ('<div class="fadebot"></div>' + tabbar(tab) if tab else '') + HOME_INDICATOR + '</div>')


def hexgrid(cx=220, cy=330, op=0.06):
    """The far layer: a hexagonal grid, brightest around the reactor and gone by the edges."""
    s = 13
    w, h = math.sqrt(3) * s, 1.5 * s
    path = f'M{w / 2:.2f} 0L{w:.2f} {s / 2:.2f}L{w:.2f} {s * 1.5:.2f}L{w / 2:.2f} {s * 2:.2f}L0 {s * 1.5:.2f}L0 {s / 2:.2f}Z'
    return (f'<svg class="hexgrid" data-bleed width="440" height="956" viewBox="0 0 440 956"><defs>'
            f'<pattern id="hx" width="{w:.3f}" height="{2 * h:.3f}" patternUnits="userSpaceOnUse">'
            f'<path d="{path}" fill="none" stroke="{CYAN}" stroke-width="0.6"/>'
            f'<path d="{path}" transform="translate({w / 2:.3f} {h:.3f})" fill="none" stroke="{CYAN}" stroke-width="0.6"/></pattern>'
            f'<radialGradient id="hxm" cx="{cx}" cy="{cy}" r="460" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
            f'<mask id="hxk"><rect width="440" height="956" fill="url(#hxm)"/></mask></defs>'
            f'<rect width="440" height="956" fill="url(#hx)" opacity="{op}" mask="url(#hxk)"/></svg>')


# ------------------------------------------------------------------ the reactor, with presence
def reactor(cx, cy, state='idle', sid='h', gauges=True, values=(0.72, 0.313, 0.5)):
    """The arc reactor, Ghosty's heart. idle: live gauges and a slowly turning tick ring; listen: core open and
    bright, a waveform ring where the gauges were; boot: rings still drawing in, cells charging in turn."""
    listen, boot = state == 'listen', state == 'boot'
    s = []
    d = s.append
    cell_stops = ('<stop offset="0.5" stop-color="#ffffff"/><stop offset="0.72" stop-color="#d4f5ff"/><stop offset="0.9" stop-color="#6fd0fa"/><stop offset="1" stop-color="#1d6d91"/>' if listen else
                  '<stop offset="0.6" stop-color="#f4fdff"/><stop offset="0.76" stop-color="#a9e9ff"/><stop offset="0.9" stop-color="#46b8e6"/><stop offset="1" stop-color="#16506b"/>')
    d('<defs>'
      f'<radialGradient id="cell{sid}" cx="{cx}" cy="{cy}" r="82" gradientUnits="userSpaceOnUse">{cell_stops}</radialGradient>'
      f'<radialGradient id="core{sid}" cx="{cx - 6}" cy="{cy - 8}" r="44" gradientUnits="userSpaceOnUse">'
      + ('<stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#ffffff"/><stop offset="0.75" stop-color="#bff0ff"/><stop offset="1" stop-color="#3cb6ea"/>' if listen else
         '<stop offset="0" stop-color="#ffffff"/><stop offset="0.28" stop-color="#f2fcff"/><stop offset="0.55" stop-color="#9fe6ff"/><stop offset="0.82" stop-color="#3bb4e8"/><stop offset="1" stop-color="#0d3d55"/>')
      + '</radialGradient>'
      f'<linearGradient id="collar{sid}" x1="0" y1="{cy - 54}" x2="0" y2="{cy + 54}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#d9e2ea"/><stop offset="0.35" stop-color="#6d7780"/><stop offset="0.7" stop-color="#2a3035"/><stop offset="1" stop-color="#5b646c"/></linearGradient>'
      f'<linearGradient id="bevel{sid}" x1="0" y1="{cy - 90}" x2="0" y2="{cy + 90}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff" stop-opacity="0.34"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.04"/><stop offset="1" stop-color="#000000" stop-opacity="0.5"/></linearGradient>'
      f'<linearGradient id="sweep{sid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{CYAN}" stop-opacity="0"/><stop offset="1" stop-color="{CYAN}" stop-opacity="1"/></linearGradient>'
      f'<filter id="glow{sid}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="{10 if listen else 7}"/></filter>'
      f'<filter id="soft{sid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>'
      f'<filter id="dot{sid}" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.5"/></filter>'
      '</defs>')
    # the slowly turning outer tick ring, with a bright sweep (its position is one frame of the turn)
    ring_r = 134
    span = 250 if boot else 360
    for k in range(0, 180):
        a = -90 + k * 2
        if a + 90 > span:
            break
        long = k % 15 == 0
        x0, y0 = P(cx, cy, ring_r - (4 if long else 2), a)
        x1, y1 = P(cx, cy, ring_r + (2 if long else 0.5), a)
        d(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#fff" stroke-opacity="{0.36 if long else 0.12}" stroke-width="{1 if long else 0.6}"/>')
    sw0 = 120 if not boot else 100
    for j in (range(24) if not listen else []):
        a = sw0 + j * 1.6
        x0, y0 = P(cx, cy, ring_r - 1.2, a)
        x1, y1 = P(cx, cy, ring_r - 1.2, a + 1.7)
        d(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{CYAN}" stroke-opacity="{(j + 1) / 24 * 0.95:.2f}" stroke-width="1.8" stroke-linecap="round"/>')
    hx, hy = P(cx, cy, ring_r - 1.2, sw0 + 24 * 1.6)
    if not listen: d(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="3.5" fill="{CYAN}" opacity="0.8" filter="url(#dot{sid})"/><circle cx="{hx:.1f}" cy="{hy:.1f}" r="1.6" fill="#eafaff"/>')
    if listen:
        # a live waveform ring where the gauges were: the shape of what he is hearing
        rnd = random.Random(7)
        n = 80
        for k in range(n + 1):
            a = 135 + k * 270 / n
            env = 0.35 + 0.65 * abs(math.sin(k / n * math.pi * 3.0 + 0.6)) * (0.6 + 0.4 * math.sin(k * 0.9))
            ln = 4 + 20 * max(0.08, env) * (0.55 + 0.45 * rnd.random())
            x0, y0 = P(cx, cy, 104, a)
            x1, y1 = P(cx, cy, 104 + ln, a)
            d(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{CYAN}" stroke-opacity="{0.45 + 0.5 * env:.2f}" stroke-width="1.6" stroke-linecap="round"/>')
        d(f'<path d="{arc(cx, cy, 103, 135, 405)}" fill="none" stroke="{CYAN}" stroke-opacity="0.35" stroke-width="0.8"/>')
    elif gauges:
        G = [(120, values[0], CYAN, 3.0, 1.0), (112, values[1], '#e8eef3', 2.4, 0.85), (104, values[2], '#e8eef3', 2.4, 0.5)]
        for gi, (r, v, col, w, op) in enumerate(G):
            end = 405 if not boot else 135 + 270 * (0.8, 0.55, 0.3)[gi]
            d(f'<path d="{arc(cx, cy, r, 135, end)}" fill="none" stroke="#fff" stroke-opacity="0.075" stroke-width="{w}" stroke-linecap="round"/>')
            if boot:
                continue
            a1 = 135 + 270 * v
            d(f'<path d="{arc(cx, cy, r, 135, a1)}" fill="none" stroke="{col}" stroke-opacity="{op}" stroke-width="{w}" stroke-linecap="round"/>')
            # segment breaks: the gauges read as instruments, ten steps each
            for t in range(1, 10):
                a = 135 + 27 * t
                if a < a1:
                    x0, y0 = P(cx, cy, r - w, a)
                    x1, y1 = P(cx, cy, r + w, a)
                    d(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#000" stroke-width="1.6"/>')
            ex, ey = P(cx, cy, r, a1)
            if col == CYAN:
                d(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="5" fill="{CYAN}" opacity="0.7" filter="url(#dot{sid})"/><circle cx="{ex:.1f}" cy="{ey:.1f}" r="2.6" fill="#eafaff"/>')
        for k in range(11):
            a = 135 + 27 * k
            x0, y0 = P(cx, cy, 125, a)
            x1, y1 = P(cx, cy, 128 if k % 5 else 130, a)
            d(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#fff" stroke-opacity="{0.42 if k % 5 == 0 else 0.22}" stroke-width="1"/>')
    # inner tick ring
    for k in range(120):
        a = k * 3
        if boot and k > 100:
            break
        long = k % 10 == 0
        x0, y0 = P(cx, cy, 93 if long else 95, a)
        x1, y1 = P(cx, cy, 99, a)
        d(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#fff" stroke-opacity="{0.34 if long else 0.13}" stroke-width="{1 if long else 0.7}"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="{86 if listen else 70}" fill="{CYAN}" opacity="{0.55 if listen else (0.22 if boot else 0.38)}" filter="url(#glow{sid})"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="87.5" fill="none" stroke="url(#bevel{sid})" stroke-width="1.4"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="83" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.2"/>')
    for k in range(10):
        a0 = -90 + k * 36 + 3.5
        a1 = a0 + 29
        xo0, yo0 = P(cx, cy, 79, a0)
        xo1, yo1 = P(cx, cy, 79, a1)
        xi1, yi1 = P(cx, cy, 59, a1)
        xi0, yi0 = P(cx, cy, 59, a0)
        cell = f'M{xo0:.2f} {yo0:.2f}A79 79 0 0 1 {xo1:.2f} {yo1:.2f}L{xi1:.2f} {yi1:.2f}A59 59 0 0 0 {xi0:.2f} {yi0:.2f}Z'
        charged = not boot or k < 7
        d(f'<path d="{cell}" fill="{f"url(#cell{sid})" if charged else "#0c2633"}" opacity="{1 if charged else 0.9}"/>')
        for j in range(10):
            a = a0 + 1.6 + (a1 - a0 - 3.2) * j / 9
            x0, y0 = P(cx, cy, 59.6, a)
            x1, y1 = P(cx, cy, 78.4, a)
            d(f'<line x1="{x0:.2f}" y1="{y0:.2f}" x2="{x1:.2f}" y2="{y1:.2f}" stroke="#1a120c" stroke-opacity="{0.3 if listen else 0.42}" stroke-width="1.1"/>')
        d(f'<path d="{cell}" fill="none" stroke="#04080a" stroke-opacity="0.7" stroke-width="1"/>')
        d(f'<path d="{arc(cx, cy, 77.6, a0 + 2, a1 - 2)}" fill="none" stroke="#fff" stroke-opacity="{0.28 if charged else 0.08}" stroke-width="0.8"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="51.5" fill="none" stroke="url(#collar{sid})" stroke-width="7"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="55.2" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="0.8"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="47.8" fill="none" stroke="#000" stroke-opacity="0.7" stroke-width="0.8"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="47" fill="#06141b"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="44" fill="url(#core{sid})" opacity="{0.75 if boot else 1}"/>')
    if not listen:
        for k in range(48):
            a = k * 7.5
            x0, y0 = P(cx, cy, 33.5 if k % 4 else 32, a)
            x1, y1 = P(cx, cy, 36, a)
            d(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#06374d" stroke-opacity="{0.5 if k % 4 == 0 else 0.28}" stroke-width="0.8"/>')
        d(f'<circle cx="{cx}" cy="{cy}" r="27" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="0.7"/>')
        d(f'<circle cx="{cx}" cy="{cy}" r="22" fill="none" stroke="#0a4a66" stroke-opacity="0.18" stroke-width="3"/>')
    else:
        # the core opens: its iris drawn back to a thin ring, all light
        d(f'<circle cx="{cx}" cy="{cy}" r="38" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="0.8"/>')
    d(f'<circle cx="{cx}" cy="{cy}" r="{30 if listen else 16}" fill="#fff" filter="url(#soft{sid})"/>')
    d(f'<ellipse cx="{cx - 13}" cy="{cy - 19}" rx="17" ry="8" transform="rotate(-28 {cx - 13} {cy - 19})" fill="#fff" opacity="0.32" filter="url(#soft{sid})"/>')
    d(f'<path d="{arc(cx, cy, 42, 200, 300)}" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="1.2" stroke-linecap="round"/>')
    return ''.join(s)


def hero(state='idle', dim_callouts=False):
    """The reactor and its four instruments. In the stills the hero is 440 x 270 pt, reactor centre (220, 136)."""
    cx, cy = 220, 136
    dim = ' dim' if dim_callouts else ''
    guides = (f'<defs><linearGradient id="gl" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.32"/></linearGradient>'
              f'<linearGradient id="gr" x1="1" x2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.32"/></linearGradient></defs>'
              f'<rect x="20" y="{cy - 0.5}" width="62" height="1" fill="url(#gl)"/><rect x="358" y="{cy - 0.5}" width="62" height="1" fill="url(#gr)"/>'
              + ''.join(f'<rect x="{x}" y="{cy - 3.5}" width="1" height="7" fill="#fff" opacity="{0.06 + 0.3 * (x - 20) / 62:.2f}"/>' for x in range(20, 83, 10))
              + ''.join(f'<rect x="{x}" y="{cy - 3.5}" width="1" height="7" fill="#fff" opacity="{0.06 + 0.3 * (420 - x) / 62:.2f}"/>' for x in range(420, 357, -10)))
    return f'''
<div class="hero" style="top:{{top}}px;height:270px">
  <div class="disc" style="{disc_css(cx - 88, cy - 88, 88)}"></div>
  <svg class="rx" viewBox="0 0 440 270" style="height:270px">{reactor(cx, cy, state)}{guides}</svg>
  <div class="co{dim}" style="left:20px;top:22px"><div class="k"><i style="background:{CYAN};box-shadow:0 0 6px {CYAN}"></i>FREE AI</div><div class="v">72<small>%</small></div><div class="s">left today</div></div>
  <div class="co r{dim}" style="right:20px;top:22px"><div class="k">SCHOOL<i style="background:rgba(232,238,243,.5)"></i></div><div class="v w">Nursery</div><div class="s">2 of 4 passed</div></div>
  <div class="co{dim}" style="left:20px;top:168px"><div class="k"><i style="background:rgba(232,238,243,.85)"></i>LIBRARY</div><div class="v">4,18<span class="tick-new">6</span></div><div class="s num">1,312 studied</div></div>
  <div class="co r{dim}" style="right:20px;top:168px"><div class="k">UPLINK<i style="border:1px solid rgba(232,238,243,.6)"></i></div><div class="v">84<small>ms</small></div><div class="s">Secure</div></div>
</div>'''


def vbars(hs=(5, 9, 12, 7, 4)):
    return '<span class="vb">' + ''.join(f'<i style="height:{h}px"></i>' for h in hs) + '</span>'


def glow(top, op=0.17):
    return (f'<div class="glow" data-bleed style="top:{top - 290}px;background:radial-gradient(closest-side, rgba(100,210,255,{op}), rgba(100,210,255,{op * 0.35:.3f}) 45%, rgba(100,210,255,0) 100%)"></div>')


# ------------------------------------------------------------------ 1. HOME and 8. HOME LISTENING
def home(listening=False):
    H = 206
    state = 'listen' if listening else 'idle'
    dim = ' dim' if listening else ''
    if listening:
        voice = f'''<div class="heard" style="top:146px"><div class="mk"><i></i>Listening…</div><p>Is the M6 still bad <span>if I leave at</span></p></div>'''
        pill = '<div class="state" style="top:436px"><span><i></i>LISTENING</span></div>'
        ask = f'<div class="ask holo lit" style="border-radius:26px"><span class="ph" style="color:var(--cyan-ink)">Listening… tap to stop</span><span class="micb live"><span class="sq2"></span></span></div>'
    else:
        voice = f'<div class="jline" style="top:148px">{vbars()}<p>The M6 is queuing northbound until about <b>19:40</b>, and Mum’s call is at half seven.</p></div>'
        pill = '<div class="state" style="top:436px"><span><i></i>ONLINE</span></div>'
        ask = f'<div class="ask holo" style="border-radius:26px"><span class="ph">Ask anything</span><span class="micb">{icon("mic")}</span></div>'
    body = f'''
{glow(H + 136, 0.24 if listening else 0.17)}
<div class="topline"><span class="date">FRI 23 OCT · 11° · LIGHT RAIN</span><span class="gbtn">{icon('search')}</span><span class="avatar">B</span></div>
<div class="hello" style="top:100px"><div class="t-large">Good evening, Boss</div></div>
{voice}
{hero(state, listening).replace('{top}', str(H))}
{pill}
<div class="agenda holo{dim}" style="top:470px;height:108px;padding-top:12px">
  <div class="thead">{icon('calendar')}<b>Today</b><em class="mono" style="font-size:11px">2 LEFT</em></div>
  <div class="evs" style="margin-top:3px">
    <div class="ev" style="height:36px"><span class="tm">19:30</span><span class="bar"></span><span class="nm">Call Mum</span><span class="in num">in 48 min</span></div>
    <div class="ev" style="height:36px"><span class="tm">21:00</span><span class="bar dim"></span><span class="nm r">Bins out</span></div>
  </div>
</div>
<div class="pair{dim}" style="top:602px;height:120px">
  <div class="tile holo lit road">
    <div class="thead">{icon('car')}<b>Roads near you</b></div>
    <div class="rd" style="margin-top:10px"><i></i><b>M6 J6–J7</b></div>
    <div class="why">Northbound queue</div>
    <div class="clr"><b>+12 MIN</b> · CLEARS 19:40</div>
  </div>
  <div class="tile holo gymt">
    <div class="thead">{icon('gym')}<b>Gym</b></div>
    <div class="row" style="margin-top:8px"><span class="segr">{seg_ring(LEVELS, 58)}<b class="num">3</b></span><div><div class="of1 num">of 22 games</div><div class="of">mastered</div></div></div>
    <div class="clr">LAST: SUDOKU · LV 6</div>
  </div>
</div>
{'' if listening else '<div class="target" style="left:13px;top:595px;width:208px;height:134px"><span class="tag">TRACKING · M6</span></div>'}
<div class="chips{dim}" style="top:736px"><span class="chip c2">{icon('brief')}Brief me</span><span class="chip c2">{icon('calendar')}What’s on today</span><span class="chip c2">{icon('globe')}God’s eye</span></div>
{ask.replace('class="ask', 'style="top:778px" class="ask') if False else ask}
'''
    body = body.replace('<div class="ask holo', '<div style="top:784px" class="ask holo')
    return page('Ghosty C2 · Home' + (' listening' if listening else ''), frame(body, 'home c2home' + (' listen' if listening else ''), 'ask'), css=CSS)


# ------------------------------------------------------------------ 2. CHAT: Jarvis working in the open
def chat():
    body = f'''
<div class="navfade"></div>
<div class="nav"><span class="gbtn">{icon('back')}</span><div class="ttl">Chat<small class="mk" style="color:var(--cyan-ink);font-size:9.5px">● ONLINE</small></div><span class="avatar">B</span></div>
<div class="log">
  <div class="daysep mk" style="font-size:10px">TODAY · 18:31</div>
  <div class="me"><span>Is the M6 bad tonight?</span></div>
  <div class="steps" style="margin-bottom:10px"><span class="ck">{icon('check')}</span><span class="n3 num">3 steps</span><span class="sep"></span>Web search, motorways, 2 pages read{icon('chevdown', 'i chv')}</div>
  <div class="reply holo" style="padding-bottom:14px">
    <div class="who"><span class="dot"></span>Ghosty <em>· Gemini 2.5 Flash</em><span class="cited">{icon('check')}CITED</span></div>
    <p>It is. There’s a queue northbound between junctions 6 and 7, adding about 12 minutes<span class="cite">1</span>, and it should clear by about 19:40<span class="cite">1</span>. Light rain until around nine<span class="cite">2</span>.</p>
    <div class="check"><span class="ck">{icon('check')}</span><span>3 of 3 claims found in the sources</span></div>
    <div class="srcrow"><span class="srcchip"><span class="cite">1</span>nationalhighways.co.uk</span><span class="srcchip"><span class="cite">2</span>metoffice.gov.uk</span></div>
  </div>
  <div class="me" style="margin-top:14px"><span>Email Mum I’ll call at eight instead.</span></div>
  <div class="work">
    <div class="scan"></div>
    <div class="wstep"><span class="ok">{icon('check')}</span>Found Mum’s address in your email</div>
    <div class="wstep"><span class="ok">{icon('check')}</span>Wrote the email</div>
    <div class="wstep live"><span class="spin"></span>Waiting for your OK<span class="cur"></span></div>
  </div>
  <div class="approve holo lit">
    <div class="kq"><i></i><span class="mk">Needs your approval</span></div>
    <div class="q">Send this email to Mum?</div>
    <div class="mail"><div class="h mk" style="font-size:9.5px"><span>TO MUM</span><span>SUBJECT · TONIGHT</span></div><p>Hi Mum, I’ll ring at eight instead of half seven tonight. Speak soon x</p></div>
    <div class="abtns"><span class="hbtn yes">{icon('check')}APPROVE</span><span class="hbtn no">NOT NOW</span></div>
  </div>
</div>
<div class="fadebot" style="height:120px"></div>
<div class="composer holo" style="border-radius:30px"><span class="plus">{icon('plus')}</span><span class="ph">Ask anything</span><span class="citedtog">{icon('check')}CITED</span><span class="micb">{icon('mic')}</span></div>
'''
    return page('Ghosty C2 · Chat', frame(body, 'chat', hexes=True), css=CSS)


# ------------------------------------------------------------------ 3. GOD'S EYE
def compass_svg(hd=0, w=320):
    """A compass ribbon: 60 degrees across, ticks every 5, labels every 15, the heading under the caret."""
    s = [f'<svg width="{w}" height="40" viewBox="0 0 {w} 40" style="overflow:visible">',
         f'<defs><linearGradient id="cf" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.2" stop-color="#fff"/><stop offset="0.8" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="cm"><rect width="{w}" height="40" fill="url(#cf)"/></mask></defs><g mask="url(#cm)">']
    ppd = w / 60
    names = {0: 'N', 45: 'NE', 90: 'E', 270: 'W', 315: 'NW'}
    for deg in range(-30, 31):
        x = w / 2 + deg * ppd
        hd2 = (hd + deg) % 360
        if hd2 % 5:
            continue
        big = hd2 % 15 == 0
        s.append(f'<line x1="{x:.1f}" y1="{14 if big else 18}" x2="{x:.1f}" y2="24" stroke="#fff" stroke-opacity="{0.6 if big else 0.28}" stroke-width="1"/>')
        if big and deg != 0:
            lab = names.get(hd2, f'{hd2:03d}')
            s.append(f'<text x="{x:.1f}" y="10" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="9" letter-spacing="0.5" fill="#fff" fill-opacity="0.55">{lab}</text>')
    s.append(f'<line x1="0" y1="24.5" x2="{w}" y2="24.5" stroke="#fff" stroke-opacity="0.18"/></g>')
    s.append(f'<path d="M{w / 2 - 5} 30L{w / 2} 25L{w / 2 + 5} 30" fill="none" stroke="{CYAN}" stroke-width="1.6"/>')
    s.append(f'<text x="{w / 2}" y="10" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="10" font-weight="bold" fill="{CYAN}">N</text>')
    s.append(f'<text x="{w / 2}" y="40" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="9.5" letter-spacing="1" fill="#9fe4ff">HDG 000°</text>')
    s.append('</svg>')
    return ''.join(s)


def eye():
    g = geometry_persp(52.477, -1.922, 3800, 46, 1025, 220, 440)
    svg = C.globe_svg(g)
    svg = svg[:svg.rindex('<text')] + '</svg>'
    # targeting brackets round the spot under the crosshair, drawn in the globe's own layer
    hx, hy = g['o'].xy(-1.922, 52.477)
    body = f'''
{svg}
<div class="navfade" style="height:200px;background:linear-gradient(180deg,rgba(0,0,0,.9) 35%,rgba(0,0,0,0))"></div>
<div class="top"><span class="gbtn">{icon('back')}</span><span class="search holo" style="border-radius:22px">{icon('search')}Search place, flight, ship, satellite…</span></div>
<div class="layers">
  <span class="lchip ico">{icon('layers')}</span>
  <span class="lchip on">{icon('plane')}Aircraft <span class="c mono">1,204</span></span>
  <span class="lchip on warn">{icon('warn')}Incidents <span class="c mono">7</span></span>
  <span class="lchip on">{icon('rain')}Radar</span>
</div>
<div class="compass">{compass_svg()}</div>
<div class="target" style="left:{hx - 46:.0f}px;top:{hy - 46:.0f}px;width:92px;height:92px"><span class="tag" style="right:auto;left:100px;top:6px">TARGET · HOME</span></div>
<div class="rail holo" style="top:400px;border-radius:22px"><div>{icon('plus')}</div><div class="zl mono" style="font-size:9.5px">3,050<br>KM</div><div>{icon('minus')}</div></div>
<div class="readout mono" style="top:598px;font-size:10.5px;letter-spacing:.06em">
  <div class="hl">52.477° −1.922° &nbsp;<b>BIRMINGHAM</b></div>
  <div>ALT 3,050 KM · TILT 46° · HDG 000°</div>
  <div>1,204 AC · 318 SHIP · 86 CAM · 894 SAT · 12 EQ</div>
</div>
<div class="spot holo" style="top:664px;border-radius:26px">
  <div class="cap"><span class="mk">This spot</span><em>Birmingham</em></div>
  <div class="sbtns">
    <span class="sb6"><span class="ic">{icon('map')}</span>Map</span>
    <span class="sb6"><span class="ic">{icon('cube')}</span>3D</span>
    <span class="sb6"><span class="ic">{icon('street')}</span>Street View</span>
    <span class="sb6"><span class="ic">{icon('traffic')}</span>Traffic</span>
    <span class="sb6"><span class="ic">{icon('route')}</span>Go</span>
    <span class="sb6"><span class="ic">{icon('nav')}</span>Road ahead</span>
  </div>
  <div class="vrow"><span class="cap mk">View</span><span class="vbtn">{icon('sun')}Look</span><span class="vbtn">{icon('home')}Home</span><span class="vbtn">{icon('north')}North</span><span class="vbtn">{icon('tilt')}Tilt</span></div>
</div>
'''
    return page('Ghosty C2 · God’s Eye', frame(body, 'eye', 'see', hexes=False), css=CSS)


# ------------------------------------------------------------------ 4. GYM
def seg_gauge(level, mastery, goal, done):
    """Ten segments, one per level: passed levels full, the current one filled to his mastery against its pass mark."""
    cx = cy = 26
    r = 21
    out = ['<svg width="52" height="52" viewBox="0 0 52 52">']
    for k in range(10):
        a0 = -90 + k * 36 + 3
        a1 = a0 + 30
        out.append(f'<path d="{arc(cx, cy, r, a0, a1)}" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="4"/>')
        if done or k < level - 1:
            col = CYAN if done else '#e8eef3'
            out.append(f'<path d="{arc(cx, cy, r, a0, a1)}" fill="none" stroke="{col}" stroke-opacity="{1 if done else 0.75}" stroke-width="4"/>')
        elif k == level - 1:
            f = min(1.0, mastery / goal) if goal else 0
            out.append(f'<path d="{arc(cx, cy, r, a0, a0 + 30 * f)}" fill="none" stroke="{CYAN}" stroke-width="4"/>')
    out.append('</svg>')
    return ''.join(out)


def gym():
    bars = []
    for i, lv in enumerate(LEVELS):
        h = 6 + 56 * lv / 10
        cls = 'm' if lv == 10 else ('z' if i >= C.STARTED else '')
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
    for i, (gid, name, lv, m, goal, st, hist) in enumerate(cards):
        done = st == 'Mastered'
        pts = sparkline(hist, 166, 26)
        last = pts.split(' ')[-1].split(',')
        col = CYAN if done else 'rgba(235,240,245,.75)'
        cc.append(f'''<div class="gcard holo{' lit' if i == 0 else ''}">
  <div class="top"><span class="sq">{game_icon(gid)}</span><span class="segg">{seg_gauge(lv, m, goal, done)}<b>{'10' if done else lv}</b><em>LV</em></span></div>
  <div class="nm">{name}</div>
  <div class="lv">{'ALL 10 LEVELS' if done else f'LV {lv} · {round(m * 100)}% / {round(goal * 100)}%'}</div>
  <svg class="spk" viewBox="0 0 166 26" preserveAspectRatio="none"><polyline points="{pts}" fill="none" stroke="{col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/><circle cx="{last[0]}" cy="{last[1]}" r="2.4" fill="{col}"/></svg>
  <div class="st{' done' if done else ''}"><i></i>{st}</div>
</div>''')
    body = f'''
<div class="navfade"></div>
<div class="nav"><span class="gbtn">{icon('back')}</span><span class="avatar">B</span></div>
<div class="ltitle"><div class="t-large">Gym</div><div class="sub t-sub">Ghosty teaches himself by playing, on this phone.</div></div>
<div class="trainall holo lit">
  <div class="hd" style="align-items:center;justify-content:flex-start;gap:12px"><span class="segr" style="width:46px;height:46px">{seg_ring(LEVELS, 46)}<b class="mono" style="font-size:15px">3</b></span><span style="flex:1"><span class="mono" style="display:block;font-size:18px;line-height:22px">3 / 22 <span style="font-size:11px;color:var(--ink3)">MASTERED</span></span><span class="mk" style="display:block;color:var(--ink3);margin-top:2px">Levels by game · LV 1–10</span></span></div>
  <div class="lvls">{grid_lines}{''.join(bars)}</div>
  <div class="trow"><span class="primary">{icon('play')}Train all</span><span class="awake">{icon('moon')}Keep awake<span class="sw"></span></span></div>
  <div class="stline"><i></i><span>Not running · least mastered first, starting with Debate Arena · runs until all 22 are mastered or you tap Stop</span></div>
</div>
<div class="sechd" style="top:474px"><span class="t-title">Games</span><span class="mono" style="font-size:11px">22 GAMES · 4 NOT STARTED</span></div>
<div class="ggrid" style="top:514px">{''.join(cc)}</div>
<div class="target" style="left:13px;top:507px;width:208px;height:190px"><span class="tag b">LAST TRAINED</span></div>
'''
    return page('Ghosty C2 · Gym', frame(body, 'gym c2gym', 'learn'), css=CSS)


# ------------------------------------------------------------------ 5. ME (Settings) with rotating tick dials
def tick_dial(frac, sweep_at, col=CYAN):
    """A live dial: an outer tick ring that turns (one frame of it, with its bright sweep) round the value arc."""
    cx = cy = 37
    out = ['<svg width="74" height="74" viewBox="0 0 74 74">']
    for k in range(60):
        a = k * 6
        x0, y0 = P(cx, cy, 34 if k % 5 else 32.5, a)
        x1, y1 = P(cx, cy, 36.5, a)
        out.append(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#fff" stroke-opacity="{0.34 if k % 5 == 0 else 0.13}" stroke-width="0.8"/>')
    for j in range(10):
        a = sweep_at + j * 3
        x0, y0 = P(cx, cy, 35.2, a)
        x1, y1 = P(cx, cy, 35.2, a + 3.2)
        out.append(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{col}" stroke-opacity="{(j + 1) / 10:.2f}" stroke-width="1.6"/>')
    r = 28
    Cc = 2 * math.pi * r
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="3.5" stroke-dasharray="{Cc * 0.75:.1f} {Cc:.1f}" transform="rotate(135 {cx} {cy})"/>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{col}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="{Cc * 0.75 * frac:.1f} {Cc:.1f}" transform="rotate(135 {cx} {cy})" style="filter:drop-shadow(0 0 3px {col}88)"/>')
    out.append('</svg>')
    return ''.join(out)


def settings():
    body = f'''
<div class="behind"><img src="home.png" alt=""></div>
<div class="sheet" style="background:#05080a">
  {hexgrid(220, 200, 0.05)}
  <span class="grab"></span>
  <div class="mehead"><span class="meav">B</span><div class="who2"><div class="t-title">Boss</div><span>Graphite · °C, km</span></div><span class="gbtn">{icon('close')}</span></div>
  <div class="status holo lit">
    <div class="hd"><span class="t-head">Status</span><span class="ok"><i></i>All good</span></div>
    <div class="gauges">
      <div class="gauge"><div class="dial">{tick_dial(0.72, 200)}<b class="mono" style="font-size:16px;top:23px">72<small>%</small></b><em class="mono" style="top:43px">LEFT</em></div><div class="gl">Free AI today</div><div class="gs">Groq, Gemini ready</div></div>
      <div class="gauge"><div class="dial">{tick_dial(0.18, 40)}<b class="mono" style="font-size:16px;top:23px">18<small>%</small></b><em class="mono" style="top:43px">USED</em></div><div class="gl">Database today</div><div class="gs mono" style="font-size:10.5px">RESETS 01:00</div></div>
      <div class="gauge"><div class="dial">{tick_dial(0.084, 300)}<b class="mono" style="font-size:16px;top:23px">84</b><em class="mono" style="top:43px">MS</em></div><div class="gl">Uplink</div><div class="gs">Secure</div></div>
    </div>
    <div class="srow"><span class="k">Ghosty</span><span class="v"><i></i>Connected</span></div>
    <div class="srow"><span class="k">Offline brain</span><span class="v">Ready · Qwen3 0.6B</span></div>
    <div class="srow"><span class="k">Self-edit</span><span class="v">On</span></div>
    <div class="srow"><span class="k">Version</span><span class="v">Up to date</span></div>
  </div>
  <div class="grp holo" style="top:470px">
    <div class="lrow"><span class="sq">{icon('brain')}</span><span class="tx"><b>Memory</b><span>What I know about you</span></span>{icon('chev', 'i chv')}</div>
    <div class="lrow"><span class="sq">{icon('sliders')}</span><span class="tx"><b>Settings</b><span>Look, voice, home and about</span></span>{icon('chev', 'i chv')}</div>
    <div class="lrow"><span class="sq">{icon('chip')}</span><span class="tx"><b>System</b><span>Keys, models, storage and backups</span></span>{icon('chev', 'i chv')}</div>
  </div>
  <div class="grp holo" style="top:666px">
    <div class="lrow"><span class="sq">{icon('link')}</span><span class="tx"><b>Links</b><span>Email, Spotify and your phone</span></span>{icon('chev', 'i chv')}</div>
    <div class="lrow"><span class="sq">{icon('core')}</span><span class="tx"><b>Every screen</b><span>The systems ring · or tap the reactor</span></span>{icon('chev', 'i chv')}</div>
  </div>
  <div class="foot mono" style="top:808px;font-size:10.5px;letter-spacing:.06em">GHOSTY 29E6C95 · BUILT 2 HOURS AGO</div>
</div>
'''
    return page('Ghosty C2 · Me', frame(body, 'mescreen', hexes=False), css=CSS)


# ------------------------------------------------------------------ 6. THE SYSTEMS RING
APP_ICONS = {
    'brief': '<rect x="3" y="4" width="18" height="14" rx="1"/><path d="M7 9h10M7 13h6M8 21h8"/>',
    'eye': ICONS['globe'],
    'lens': '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    'studio': '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
    'workshop': '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    'reverse': '<path d="M4 7h11a4 4 0 010 8H9"/><path d="M7 11l-3 4 3 4"/><circle cx="18" cy="7" r="2"/>',
    'space': '<path d="M3 4h18v16H3z"/><path d="M3 12h7v8M14 4v5h7"/><path d="M6 15h2M16 6h2"/>',
    'learn': '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5"/><path d="M22 8v6"/>',
    'gym': ICONS['gym'],
    'library': '<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z"/><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z"/>',
    'agenda': '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h3M13.5 13h3M7.5 16.5h3"/>',
    'markets': '<path d="M3 20h18M6 16v-5M11 16V7M16 16v-8M21 16V4"/>',
    'threats': '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    'radio': '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8l10-5"/><circle cx="15.5" cy="14" r="3"/><path d="M6 12h4M6 15h4"/>',
    'memory': '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="M8 7l8 1M7 8l2 8M17 10l-6 7"/>',
    'settings': ICONS['sliders'],
    'system': '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
    'links': '<path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>',
}
# Every screen, in its area's order, so each area sits next to its own tools (shell/areas.ts AREAS and ME_ROWS).
TOOLS = [('brief', 'Brief'), ('eye', 'God’s eye'), ('lens', 'Lens'), ('studio', '3D Studio'), ('workshop', 'Workshop'), ('reverse', 'Reverse'),
         ('space', 'Space'), ('learn', 'Courses'), ('gym', 'Gym'), ('library', 'Library'), ('agenda', 'Agenda'), ('markets', 'Markets'),
         ('threats', 'Threats'), ('radio', 'Radio'), ('memory', 'Memory'), ('settings', 'Settings'), ('system', 'System'), ('links', 'Links')]
AREAS = [('ask', 'Ask', [0]), ('see', 'See', [1, 2]), ('make', 'Make', [3, 4, 5, 6]), ('learn', 'Learn', [7, 8, 9]), ('plan', 'Plan', [10, 11, 12, 13]), ('me', 'Me', [14, 15, 16, 17])]


def systems():
    cx, cy = 220, 478
    R_OUT, R_LAB, R_IN, R_INLAB = 186, 156, 112, 74
    ang = [-90 + 20 * i for i in range(18)]
    s = [f'<svg data-bleed viewBox="0 0 440 956" width="440" height="956" style="position:absolute;inset:0;overflow:visible">',
         '<defs><filter id="ng" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6"/></filter></defs>']
    # orbit tracks
    for r, op, dash in [(R_OUT, 0.16, '1 5'), (R_IN, 0.22, None), (134, 0.08, '2 6')]:
        s.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{CYAN}" stroke-opacity="{op}" stroke-width="1"' + (f' stroke-dasharray="{dash}"' if dash else '') + '/>')
    # each area's sector on the outer orbit: a thin arc spanning its tools
    for k, (aid, name, idx) in enumerate(AREAS):
        a0, a1 = ang[idx[0]] - 8, ang[idx[-1]] + 8
        lit = aid == 'ask'
        mid = sum(ang[i] for i in idx) / len(idx)
        # spoke from the area node to its sector
        x0, y0 = P(cx, cy, R_IN + 24, mid)
        x1, y1 = P(cx, cy, R_OUT - 20, mid)
        s.append(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{CYAN}" stroke-opacity="{0.5 if lit else 0.14}" stroke-width="1" stroke-dasharray="2 3"/>')
    # outer ring: every tool
    for i, (tid, name) in enumerate(TOOLS):
        x, y = P(cx, cy, R_OUT, ang[i])
        lx, ly = P(cx, cy, R_LAB, ang[i])
        area_lit = i in AREAS[0][2]
        s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="17" fill="#071016" fill-opacity="0.92" stroke="{CYAN}" stroke-opacity="{0.75 if area_lit else 0.3}" stroke-width="1"/>')
        s.append(f'<g transform="translate({x - 9:.1f} {y - 9:.1f}) scale(0.75)" fill="none" stroke="#e8f6fc" stroke-opacity="0.9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{APP_ICONS[tid]}</g>')
        c = math.cos(math.radians(ang[i]))
        anchor = 'end' if c > 0.2 else ('start' if c < -0.2 else 'middle')
        sn = math.sin(math.radians(ang[i]))
        lx2 = x - 24 if anchor == 'end' else (x + 24 if anchor == 'start' else lx)
        ly2 = y + 4 if anchor != 'middle' else ly + 3.5
        if abs(sn) > 0.75:
            anchor, lx2, ly2 = 'middle', x, (y + 31 if sn > 0 else y - 24)
        s.append(f'<text x="{lx2:.1f}" y="{ly2:.1f}" text-anchor="{anchor}" font-family="Inter Mock" font-size="10" font-weight="500" fill="#fff" fill-opacity="0.72">{name}</text>')
    # inner ring: the six areas, Ask lit (you are on Home)
    for aid, name, idx in AREAS:
        mid = sum(ang[i] for i in idx) / len(idx)
        x, y = P(cx, cy, R_IN, mid)
        lx, ly = P(cx, cy, R_INLAB, mid)
        lit = aid == 'ask'
        if lit:
            s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="26" fill="{CYAN}" opacity="0.45" filter="url(#ng)"/>')
        s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="23" fill="{"#0e3242" if lit else "#081218"}" stroke="{CYAN}" stroke-opacity="{1 if lit else 0.45}" stroke-width="{1.6 if lit else 1}"/>')
        glyph = ICONS[aid]
        s.append(f'<g transform="translate({x - 11:.1f} {y - 11:.1f}) scale(0.92)" fill="none" stroke="{CYAN if lit else "#f4f6f8"}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{glyph}</g>')
        s.append(f'<text x="{lx:.1f}" y="{ly + 4:.1f}" text-anchor="middle" font-family="Inter Mock" font-size="11.5" font-weight="700" letter-spacing="0.4" fill="{CYAN if lit else "#fff"}">{name}</text>')
    s.append('</svg>')
    k = 0.5
    reactor_small = (f'<div style="position:absolute;left:{cx - 160 * k:.0f}px;top:{cy - 160 * k:.0f}px;width:320px;height:320px;transform:scale({k});transform-origin:0 0">'
                     f'<div style="position:absolute;border-radius:50%;{disc_css(72, 72, 88)}"></div>'
                     f'<svg viewBox="0 0 320 320" width="320" height="320" style="position:absolute;inset:0;overflow:visible">{reactor(160, 160, "idle", "s", gauges=False)}</svg></div>')
    body = f'''
<div class="sysbg" data-bleed><img src="home.png" alt=""></div>
{hexgrid(cx, cy, 0.07)}
<div class="glow" data-bleed style="top:{cy - 320}px;background:radial-gradient(closest-side, rgba(100,210,255,.16), rgba(100,210,255,0) 100%)"></div>
<div class="syshead"><div class="mk">Systems · 18 screens</div><div class="t-large">Where to, Boss?</div><p>Tap a system, or turn the ring.</p></div>
{''.join(s)}
{reactor_small}
<div class="sysfoot"><span class="closeb holo" style="border-radius:25px">{icon('close')}</span></div>
'''
    return page('Ghosty C2 · Systems ring', frame(body, 'systems', hexes=False), css=CSS)


# ------------------------------------------------------------------ 7. BOOT-UP (one frame)
def boot():
    cx, cy = 220, 380
    body = f'''
<div class="glow" data-bleed style="top:{cy - 320}px;background:radial-gradient(closest-side, rgba(100,210,255,.14), rgba(100,210,255,0) 100%)"></div>
<div class="wordmark mk">Ghosty · systems check</div>
<div class="disc" style="position:absolute;border-radius:50%;{disc_css(cx - 88, cy - 88, 88)}"></div>
<svg viewBox="0 0 440 956" width="440" height="956" data-bleed style="position:absolute;inset:0;overflow:visible">{reactor(cx, cy, 'boot', 'b')}</svg>
<div class="online"><div class="t-title"><i></i>Systems online · all good</div><div class="sub">Good evening, Boss.</div></div>
<div class="bootlist">
  <div class="bl"><span>BRAIN</span><b>CONNECTED</b></div>
  <div class="bl"><span>FREE AI TODAY</span><b>72% LEFT</b></div>
  <div class="bl"><span>OFFLINE BRAIN</span><b>READY · QWEN3 0.6B</b></div>
  <div class="bl"><span>LIBRARY</span><b>4,186 PASSAGES</b></div>
  <div class="bl"><span>SCHOOL</span><b>NURSERY · 2 OF 4</b></div>
  <div class="bl pend"><span>UPLINK</span><span>84 MS<span class="cur"></span></span></div>
</div>
'''
    return page('Ghosty C2 · Boot', frame(body, 'boot'), css=CSS)


# ------------------------------------------------------------------ the design-language card
def reactor_block(state, k, sid, gauges=True):
    size = 320
    return (f'<div style="position:relative;width:{size * k:.0f}px;height:{size * k:.0f}px"><div style="position:absolute;left:0;top:0;width:{size}px;height:{size}px;transform:scale({k});transform-origin:0 0">'
            f'<div style="position:absolute;border-radius:50%;{disc_css(72, 72, 88)}"></div>'
            f'<svg viewBox="0 0 320 320" width="320" height="320" style="position:absolute;inset:0;overflow:visible">{reactor(160, 160, state, sid, gauges=gauges)}</svg></div></div>')


def language():
    sw = [('#000000', 'Canvas', 'True black · OLED', ''), ('rgba(100,210,255,.07)', 'Holo glass', 'Cyan 7 → 2 % · blur 28', 'box-shadow: inset 0 0 0 1px rgba(100,210,255,.14)'),
          ('#f4f6f8', 'Ink', 'Text', ''), ('rgba(235,240,245,.40)', 'Ink 3', 'Labels', ''),
          ('#64d2ff', 'Reactor cyan', 'Live, active, hairlines', 'box-shadow: 0 0 18px rgba(100,210,255,.45)'), ('#ffb340', 'Amber', 'Warnings only', '')]
    sws = ''.join(f'<div class="swt"><span style="background:{c};{x}"></span><b>{n}</b><em>{d}</em></div>' for c, n, d, x in sw)
    motion = [('Breathing reactor', 'idle: a 4 s breath, glow ±6 %; the tick ring turns once a minute'),
              ('Listening', 'the core opens and brightens in 180 ms; the waveform ring follows the microphone at 120 Hz'),
              ('Working', 'the core pulses with each tool step; a thin scan line runs while tools work'),
              ('Springs', 'taps, sheets and the systems ring: response 0.35 s, damping 0.85'),
              ('Data ticks in', 'a changed digit glows for 600 ms; gauges ease to new values'),
              ('Boot-up', 'rings draw in, cells charge in turn, “Systems online” holds for 1 s'),
              ('Sound', 'a soft confirmation tone when an action is done (the app’s own sounds, switchable)'),
              ('Reduce motion', 'no breathing, turning or parallax; boot is a plain fade; values simply change')]
    mrows = ''.join(f'<li><b>{a}</b> {b}</li>' for a, b in motion)
    vb = ''.join(f'<i style="width:2px;height:{h}px;border-radius:1px;background:#64d2ff;display:block"></i>' for h in (5, 9, 12, 7, 4))
    body = f'''
<div class="lang">
  <header>
    <div><div class="eyebrow">Route C2 · Tony Stark navigating Ghosty</div><h1>Calm like an iPhone. Alive like Jarvis.</h1>
    <p>Route C’s premium calm stays: true black, SF type, one accent, honest numbers. The Iron Man feeling now comes from presence and depth: the reactor is Ghosty’s heart and reacts to him, Jarvis speaks in one calm line, panels are holographic glass in layers over a far grid, every instrument is live, and the reactor opens a ring of every system.</p></div>
    <div class="trio">
      <figure>{reactor_block('idle', 0.5, 'L1')}<figcaption>Idle · breathing</figcaption></figure>
      <figure>{reactor_block('listen', 0.5, 'L2')}<figcaption>Listening · core open</figcaption></figure>
      <figure>{reactor_block('boot', 0.5, 'L3')}<figcaption>Boot-up · drawing in</figcaption></figure>
    </div>
  </header>
  <section class="cols">
    <div><h2>Palette</h2><div class="sws">{sws}</div>
      <h2 style="margin-top:30px">Depth and parallax</h2>
      <ul class="notes"><li><b>Far:</b> a hexagonal grid at 6 %, fading out from the reactor</li><li><b>Near:</b> holographic glass panels and their corner hairlines</li><li><b>Nearest:</b> the reactor and its light</li><li><b>On the phone</b> the layers move with tilt (DeviceMotion): grid 2 pt, panels 5 pt, reactor 9 pt. The grid drifts with scroll. Reduce motion turns all of it off.</li></ul></div>
    <div><h2>Type <small>SF Pro and SF Mono on the iPhone</small></h2>
      <div class="ty"><div class="tm"><b>Large title</b><em>34/41 Bold</em></div><div class="t-large">Good evening</div></div>
      <div class="ty"><div class="tm"><b>Jarvis line</b><em>16/23, from real state</em></div><div class="t-sub" style="color:rgba(235,240,245,.8)">The M6 is queuing northbound until about <b style="color:#fff">19:40</b>.</div></div>
      <div class="ty"><div class="tm"><b>Body</b><em>17/24 Regular</em></div><div class="t-body">Send this email to Mum?</div></div>
      <div class="ty"><div class="tm"><b>Readout</b><em>SF Mono 10.5, tabular</em></div><div class="mk" style="color:rgba(235,240,245,.8)">ALT 3,050 KM · HDG 000°</div></div>
      <h2 style="margin-top:28px">Motion and sound</h2><ul class="notes">{mrows}</ul></div>
    <div class="comp"><h2>Components</h2>
      <div class="cg">
        <div class="cell holo lit" style="height:104px;padding:16px"><div class="mk" style="color:var(--cyan-ink)">Holographic glass</div><div style="margin-top:6px;font-size:13px;line-height:18px;color:var(--ink2)">Cyan hairline; corners brighten along the radius; a soft inner glow.</div></div>
        <div class="cell" style="position:relative;height:104px;display:grid;place-items:center"><div class="target" style="left:34px;top:24px;right:34px;bottom:18px"><span class="tag" style="top:-15px">TRACKING · M6</span></div><span style="font-size:13px;color:var(--ink2)">Targeting brackets</span></div>
        <div class="cell" style="height:116px"><div class="work" style="margin:0"><div class="scan"></div><div class="wstep"><span class="ok">{icon('check')}</span>Searched the web</div><div class="wstep"><span class="ok">{icon('check')}</span>Read 2 pages</div><div class="wstep live"><span class="spin"></span>Checking the weather<span class="cur"></span></div></div></div>
        <div class="cell" style="height:116px"><div class="mk" style="color:var(--cyan-ink)">Needs your approval</div><div class="abtns" style="margin-top:16px"><span class="hbtn yes">{icon('check')}APPROVE</span><span class="hbtn no">NOT NOW</span></div></div>
        <div class="cell" style="height:110px;display:flex;gap:18px;align-items:center;justify-content:center"><span class="segg">{seg_gauge(6, 0.66, 0.7, False)}<b>6</b><em>LV</em></span><span class="segg">{seg_gauge(10, 1, None, True)}<b>10</b><em>LV</em></span><span style="position:relative;width:74px;height:74px">{tick_dial(0.72, 200)}<b class="mono" style="position:absolute;left:0;right:0;top:28px;text-align:center;font-size:15px">72%</b></span></div>
        <div class="cell" style="height:110px;display:grid;place-items:center">{compass_svg(w=240)}</div>
        <div class="cell wide" style="height:64px;display:flex;align-items:center;gap:12px"><span style="display:flex;gap:2px;align-items:center;height:12px">{vb}</span><span style="font-size:15px;color:rgba(235,240,245,.82)">The Jarvis line: one calm sentence, written as speech, from real state.</span></div>
      </div></div>
  </section>
</div>'''
    css = f'''<style>{FRAME_CSS}
body {{ background: #000; width: 1640px; }}
.lang {{ width: 1640px; padding: 56px 64px 64px; color: var(--ink); background: radial-gradient(900px 600px at 1300px 160px, rgba(100,210,255,.09), rgba(100,210,255,0)), #000; }}
.lang header {{ display: flex; justify-content: space-between; align-items: center; gap: 40px; padding-bottom: 32px; border-bottom: 1px solid rgba(100,210,255,.14); }}
.eyebrow {{ font-family: var(--mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--cyan); }}
.lang h1 {{ margin-top: 10px; font-size: 44px; line-height: 50px; font-weight: 700; letter-spacing: -.8px; }}
.lang header p {{ margin-top: 14px; max-width: 700px; font-size: 17px; line-height: 26px; color: var(--ink2); }}
.trio {{ display: flex; gap: 22px; flex: none; }}
.trio figure {{ text-align: center; }}
.trio figcaption {{ margin-top: 8px; font-family: var(--mono); font-size: 10.5px; letter-spacing: .04em; color: var(--ink3); text-transform: uppercase; }}
.cols {{ display: grid; grid-template-columns: 300px 430px minmax(0, 1fr); gap: 48px; padding-top: 32px; }}
.lang h2 {{ font-family: var(--mono); font-size: 11px; font-weight: 400; letter-spacing: .06em; text-transform: uppercase; color: var(--ink3); margin-bottom: 14px; }}
.lang h2 small {{ text-transform: none; letter-spacing: 0; margin-left: 6px; font-family: var(--f); }}
.sws {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }}
.swt span {{ display: block; height: 56px; border-radius: 14px; border: 1px solid rgba(255,255,255,.08); }}
.swt b {{ display: block; margin-top: 8px; font-size: 14px; font-weight: 600; }}
.swt em {{ display: block; font-style: normal; font-size: 12px; color: var(--ink3); margin-top: 1px; }}
.notes {{ list-style: none; }}
.notes li {{ font-size: 13.5px; line-height: 19px; color: var(--ink2); padding: 7px 0; border-top: 1px solid rgba(255,255,255,.07); }}
.notes li b {{ color: var(--ink); font-weight: 600; }}
.ty {{ display: flex; gap: 18px; align-items: baseline; padding: 10px 0; border-top: 1px solid rgba(255,255,255,.07); }}
.ty .tm {{ width: 130px; flex: none; }}
.ty .tm b {{ display: block; font-size: 13px; font-weight: 600; }}
.ty .tm em {{ display: block; font-style: normal; font-size: 11.5px; color: var(--ink3); margin-top: 2px; }}
.cg {{ display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }}
.cell {{ padding: 16px; border-radius: 20px; background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.07); }}
.cell.wide {{ grid-column: span 2; }}
</style>'''
    return page('Ghosty C2 · design language', css + body, css=CSS, extra_head='<meta name="mock-scale" content="1.8">')


def contact_sheet():
    shots = [('home', 'Home'), ('chat', 'Chat · Jarvis at work'), ('eye', 'God’s Eye'), ('gym', 'Gym'),
             ('settings', 'Me · Settings'), ('systems', 'Systems ring'), ('boot', 'Boot-up'), ('listening', 'Listening')]
    cells = ''.join(f'<figure><div class="ph"><img src="{n}.png" alt="{lab}"></div><figcaption><b>{i + 1}</b>{lab}</figcaption></figure>' for i, (n, lab) in enumerate(shots))
    css = '''
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #050607; color: #f4f6f8; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; width: 1376px; padding: 44px 56px 40px; }
header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 30px; }
h1 { font-size: 32px; line-height: 38px; font-weight: 700; letter-spacing: -0.6px; }
h1 span { color: rgba(235,240,245,.6); font-weight: 500; }
header p { font-size: 15px; color: rgba(235,240,245,.6); }
.grid { display: grid; grid-template-columns: repeat(4, 284px); gap: 30px 40px; }
.ph { width: 284px; height: 617px; border-radius: 42px; overflow: hidden; box-shadow: 0 0 0 1.5px rgba(255,255,255,.12), 0 0 0 7px #16181b, 0 0 0 8px rgba(255,255,255,.14), 0 24px 50px rgba(0,0,0,.45); }
.ph img { width: 284px; height: 617px; display: block; }
figcaption { margin-top: 18px; font-size: 15px; font-weight: 600; letter-spacing: -0.2px; text-align: center; }
figcaption b { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 11px; margin-right: 8px; font-size: 11.5px; background: rgba(100,210,255,.16); color: #9fe4ff; vertical-align: 1px; }
'''
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="mock-scale" content="1.36"><title>Ghosty C2 · contact sheet</title><link rel="stylesheet" href="../fonts.css"><style>{css}</style></head>
<body><header><h1>Route C2 <span>· Tony Stark navigating Ghosty</span></h1><p>Route C’s calm, with presence, holographic depth and live instruments</p></header><div class="grid">{cells}</div></body></html>
'''


if __name__ == '__main__':
    pages = [('home', lambda: home(False)), ('chat', chat), ('eye', eye), ('gym', gym), ('settings', settings),
             ('systems', systems), ('boot', boot), ('listening', lambda: home(True)), ('language', language), ('contact', contact_sheet)]
    for name, fn in pages:
        write(HERE, f'{name}.html', fn())
    print('route C2 pages written')
