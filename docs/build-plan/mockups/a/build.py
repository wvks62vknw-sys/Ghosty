"""Route A (the iPhone look, made miles better): the five screens, a light Home, the design-language card and the
contact sheet as static HTML. Run from the worktree root:  python3 -I -B docs/build-plan/mockups/a/build.py"""
import importlib.util, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
from common import FRAME_CSS, GAMES, HOME_INDICATOR, contact, icon, game_icon, page, status_bar, write  # noqa: E402
from globe import geometry_persp, world  # noqa: E402

_spec = importlib.util.spec_from_file_location('route_c', os.path.join(HERE, '..', 'c', 'build.py'))
C = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(C)


def tabbar(on):
    tabs = [('ask', 'Ask'), ('see', 'See'), ('make', 'Make'), ('learn', 'Learn'), ('plan', 'Plan')]
    return '<nav class="tabs">' + ''.join(f'<div class="tab{" on" if k == on else ""}">{icon(k)}<span>{t}</span></div>' for k, t in tabs) + '</nav>'


def frame(body, cls='', tab=None):
    return (f'<style>{FRAME_CSS}</style><div class="screen {cls}">' + status_bar() + body
            + ('<div class="fadebot"></div>' + tabbar(tab) if tab else '') + HOME_INDICATOR + '</div>')


def row(ic, tint, title, sub=None, val=None, chev=True, extra=''):
    i = f'<span class="ic" style="background:{tint}">{icon(ic)}</span>' if ic else ''
    s = f'<span>{sub}</span>' if sub else ''
    v = f'<span class="val">{val}</span>' if val else ''
    return f'<div class="row">{i}<span class="tx"><b>{title}</b>{s}</span>{v}{extra}{icon("chev", "i chv") if chev else ""}</div>'


def reactor_widget(size=116):
    k = size / 204
    return (f'<div class="rw"><div style="position:absolute;left:0;top:0;width:204px;height:204px;transform:scale({k:.4f});transform-origin:0 0">'
            f'<div style="position:absolute;border-radius:50%;{C.disc_css(14, 14, 88)}"></div>'
            f'<svg viewBox="0 0 204 204" width="204" height="204" style="position:absolute;inset:0;overflow:visible">{C.reactor_svg(102, 102, False, "w")}</svg></div></div>')


def roads_map():
    return '''<svg class="map" viewBox="0 0 194 86" preserveAspectRatio="xMidYMid slice">
  <rect width="194" height="86" fill="var(--cell2)"/>
  <path d="M-5 70 C40 62 70 40 110 34 S170 18 200 8" fill="none" stroke="var(--fill)" stroke-width="2"/>
  <path d="M20 -5 C30 30 60 60 70 95" fill="none" stroke="var(--fill)" stroke-width="2"/>
  <path d="M120 -5 C118 30 140 60 150 95" fill="none" stroke="var(--fill)" stroke-width="1.5"/>
  <path d="M-5 30 C50 36 100 52 200 60" fill="none" stroke="var(--fill)" stroke-width="1.5"/>
  <path d="M-5 84 C40 70 80 54 120 40 S170 20 200 12" fill="none" stroke="#f5c242" stroke-opacity=".75" stroke-width="5" stroke-linecap="round"/>
  <path d="M84 52 C100 46 112 41 128 36" fill="none" stroke="#ff453a" stroke-width="5" stroke-linecap="round"/>
  <path d="M60 -5 C70 30 100 60 110 95" fill="none" stroke="#f5c242" stroke-opacity=".55" stroke-width="4"/>
  <rect x="140" y="50" width="28" height="17" rx="4" fill="#0a5bd8" stroke="#fff" stroke-width="1.2"/>
  <text x="154" y="62.5" text-anchor="middle" font-family="Inter Mock" font-size="10.5" font-weight="700" fill="#fff">M6</text>
  <circle cx="106" cy="44" r="9.5" fill="#ff9f0a" stroke="#fff" stroke-width="1.6"/>
  <path d="M106 39.5v5.2M106 47.6v.4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
</svg>'''


# ---------------------------------------------------------------- 1. HOME
def home():
    bars = ''.join(f'<i class="{"m" if lv == 10 else ""}" style="height:{6 + 38 * lv / 10:.0f}px"></i>' for lv in C.LEVELS)
    body = f'''
<div class="navl"><span class="cap2" style="letter-spacing:.02em">Friday 23 October</span><span style="display:flex;gap:10px"><span class="circ">{icon('search')}</span><span class="av">B</span></span></div>
<div class="titleblock"><div class="large">Good evening, Boss</div><div class="sub">11° and light rain in Birmingham</div></div>
<div class="widgets">
  <div class="wg reactorw">{reactor_widget()}<div class="rlab"><b>Ghosty</b><span><i></i>Online · 84 ms</span></div></div>
  <div class="wg cal"><div class="day">FRIDAY</div><div class="dn num">23</div>
    <div class="ev"><b>Call Mum</b><span class="num">19:30 – 20:00</span></div>
    <div class="ev b"><b>Bins out</b><span class="num">21:00</span></div></div>
  <div class="wg roadw">{roads_map()}<div class="info"><b>M6 J6–J7 northbound</b><span class="num">Queue · +12 min · clears 19:40</span></div></div>
  <div class="wg gymw"><div class="wt">{icon('gym')}Gym</div><div class="big num">3 <small>of 22 mastered</small></div><div class="bars">{bars}</div><div class="ft">Last: Sudoku · level 6</div></div>
</div>
<div class="sect" style="top:574px"><div class="hdr">SUGGESTIONS</div>
  <div class="group">
    {row('brief', '#5e5ce6', 'Brief me', 'The day in one look')}
    {row('calendar', '#ff453a', 'What’s on today')}
    {row('globe', '#0a84ff', 'God’s eye', 'The world live')}
  </div>
</div>
<div class="askf">{icon('search')}<span class="ph">Ask Ghosty</span><span class="mic">{icon('mic')}</span></div>
'''
    return page('Ghosty A · Home', frame(body, 'home', 'ask'))


# ---------------------------------------------------------------- 2. CHAT
def chat():
    body = f'''
<div class="navc"><span class="circ">{icon('back')}</span><div class="t" style="top:-4px"><span style="display:block;margin:0 auto 3px;width:34px;height:34px;border-radius:17px;background:radial-gradient(circle,#fff 0 14%,#a9e9ff 26%,#2aa3dc 58%,#0e2c3a 100%);box-shadow:0 0 10px rgba(100,210,255,.45)"></span>Ghosty</div><span class="av">B</span></div>
<div class="msgs" style="top:130px">
  <div class="stamp"><b>Today</b> 18:31</div>
  <div class="bme"><span>What’s on tonight?</span></div>
  <div class="bgh"><div>Call Mum at half seven, then the bins go out at nine. Nothing else in the diary.</div></div>
  <div class="gap"></div>
  <div class="bme"><span>Is the M6 bad tonight, and will it rain on the way to Mum’s?</span></div>
  <div class="tools">{icon('check')}Searched the web · Checked the weather · Read 2 pages</div>
  <div class="bgh"><div>Not great. There’s a queue on the M6 northbound between junctions 6 and 7, adding about 12 minutes<span class="sup">1</span>, and it should clear by about 19:40<span class="sup">1</span>. Light rain until around nine, so the roads will be wet<span class="sup">2</span>. Leave after half seven and you’ll miss most of it.</div></div>
  <div class="chk">{icon('check')}3 of 3 claims found in the sources · Gemini 2.5 Flash</div>
  <div class="group srcg">
    <div class="row"><span class="ic" style="background:var(--blue)">1</span><span class="tx"><b>M6 northbound J6 to J7 · queue</b><span>nationalhighways.co.uk</span></span>{icon('chev', 'i chv')}</div>
    <div class="row"><span class="ic" style="background:var(--blue)">2</span><span class="tx"><b>Birmingham forecast, tonight</b><span>metoffice.gov.uk</span></span>{icon('chev', 'i chv')}</div>
  </div>
  <div class="reacts">{icon('up')}{icon('down')}{icon('copy')}{icon('listen')}<span class="th">{icon('think')}Think harder</span></div>
</div>
<div class="fadebot" style="height:130px"></div>
<div class="composer"><span class="plus">{icon('plus')}</span><div class="fld"><span class="ph">Ask Ghosty</span><span class="citedp">{icon('check')}Cited</span><span class="mic">{icon('mic')}</span></div></div>
'''
    return page('Ghosty A · Chat', frame(body, 'chat'))


# ---------------------------------------------------------------- 3. GOD'S EYE (Maps grammar)
def globe_a(g):
    o = g['o']
    limb = g['limb']
    x1, y1, x2, y2 = g['sun']
    s = ['<svg class="globe" viewBox="0 0 440 956" width="440" height="956">', '<defs>',
         '<linearGradient id="oc" x1="0" y1="140" x2="0" y2="956" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2a4157"/><stop offset="0.2" stop-color="#1b2d3d"/><stop offset="1" stop-color="#0f1a24"/></linearGradient>',
         f'<linearGradient id="tm" x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient>',
         f'<clipPath id="dk"><path d="{limb}"/></clipPath>',
         '<filter id="bl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>',
         '<filter id="sh" x="-20%" y="-50%" width="140%" height="200%"><feDropShadow dx="0" dy="0.5" stdDeviation="1.2" flood-color="#000" flood-opacity="0.9"/></filter>',
         '</defs>', '<rect width="440" height="956" fill="#000"/>',
         f'<path d="{limb}" fill="none" stroke="#7fb8ff" stroke-opacity="0.5" stroke-width="14" filter="url(#bl)"/>',
         f'<path d="{limb}" fill="url(#oc)"/>', '<g clip-path="url(#dk)">',
         f'<path d="{g["land"]}" fill="#3a4047" stroke="#59616a" stroke-width="0.6"/>',
         f'<path d="{g["borders"]}" fill="none" stroke="#9aa3ad" stroke-opacity="0.45" stroke-width="0.7" stroke-dasharray="3 2"/>',
         '<rect width="440" height="956" fill="url(#tm)"/>']
    for lat, lon, rr, op in [(52.9, -3.4, 34, 0.32), (52.3, -2.6, 22, 0.3), (53.4, -4.2, 36, 0.28), (51.8, -3.9, 26, 0.25)]:
        p = o.xy(lon, lat)
        s.append(f'<ellipse cx="{p[0]:.1f}" cy="{p[1]:.1f}" rx="{rr}" ry="{rr * 0.55:.1f}" fill="#4cd964" opacity="{op}" filter="url(#bl)"/>')
    s.append('</g>')
    for k, (lat, lon, hd) in enumerate(C.PLANES):
        p = o.xy(lon, lat)
        if p and p[1] < 530 and k % 2 == 0:
            s.append(f'<g transform="translate({p[0]:.1f} {p[1]:.1f}) rotate({hd}) scale(0.5)" filter="url(#sh)"><path d="M0-9c.9 0 1.4.6 1.4 1.6v4.8l6.4 3.8v1.9l-6.4-1.9v4.2l2.2 1.7v1.4L0 16.5l-3.6 1v-1.4l2.2-1.7v-4.2l-6.4 1.9V8.2l6.4-3.8v-4.8C-1.4-8.4-.9-9 0-9z" fill="#fff" transform="translate(0 -4)"/></g>')
    for lat, lon in C.INCIDENTS:
        p = o.xy(lon, lat)
        if p:
            s.append(f'<g filter="url(#sh)"><circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="6.5" fill="#ff9f0a" stroke="#fff" stroke-width="1.5"/><path d="M{p[0]:.1f} {p[1] - 3:.1f}v3.4M{p[0]:.1f} {p[1] + 2.2:.1f}v.3" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></g>')
    cities = {c[0]: c for c in world()['cities']}
    hx, hy = o.xy(-1.922, 52.477)
    placed = [(hx, hy), (hx + 60, hy)]
    for n in ['London', 'Paris', 'Dublin', 'Edinburgh', 'Glasgow', 'Cardiff', 'Amsterdam', 'Nantes', 'Oslo', 'Brussels']:
        c = cities[n]
        p = o.xy(c[2], c[1])
        if not p or any(abs(p[0] - q[0]) < 76 and abs(p[1] - q[1]) < 20 for q in placed) or not (20 < p[0] < 360 and 200 < p[1] < 530):
            continue
        placed.append(p)
        s.append(f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="2.4" fill="#fff" stroke="#000" stroke-opacity=".4"/><text x="{p[0] + 6:.1f}" y="{p[1] + 4:.1f}" font-family="Inter Mock" font-size="12" font-weight="600" fill="#fff" filter="url(#sh)">{n}</text>')
    s.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="26" fill="#0a84ff" opacity=".18"/><circle cx="{hx:.1f}" cy="{hy:.1f}" r="8" fill="#0a84ff" stroke="#fff" stroke-width="3" filter="url(#sh)"/>'
             f'<text x="{hx + 16:.1f}" y="{hy + 5:.1f}" font-family="Inter Mock" font-size="14" font-weight="700" fill="#fff" filter="url(#sh)">Birmingham</text>')
    s.append('</svg>')
    return ''.join(s)


def eye():
    g = geometry_persp(52.477, -1.922, 3800, 46, 1025, 220, 400)
    body = f'''
{globe_a(g)}
<div class="msearch">{icon('search')}Search place, flight, ship…</div>
<div class="mbtns"><div>{icon('layers')}</div><div>{icon('nav')}</div></div>
<div class="filters"><span class="fchip on">{icon('plane')}Aircraft</span><span class="fchip on o">{icon('warn')}Incidents</span><span class="fchip on">{icon('rain')}Radar</span></div>
<div class="card" style="bottom:104px;height:290px;border-radius:34px;left:10px;right:10px">
  <div class="grab"></div>
  <div class="ttl"><div><div class="t2">Birmingham</div><div class="s2 num">52.477° N, 1.922° W · 3,050 km up</div></div><span class="x">{icon('close')}</span></div>
  <div class="acts5"><div class="p">{icon('route')}Go</div><div>{icon('map')}Map</div><div>{icon('cube')}3D</div><div>{icon('street')}Street</div><div>{icon('traffic')}Traffic</div></div>
  <div class="group"><div class="row"><span class="ic" style="background:var(--blue)">{icon('nav')}</span><span class="tx"><b>Road ahead</b><span>Reports and cameras in front of you</span></span><span class="sw"></span></div></div>
  <div class="seg"><span>Look</span><span>Home</span><span>North</span><span>Tilt</span></div>
</div>
'''
    return page('Ghosty A · God’s Eye', frame(body, 'eye', 'see'))


# ---------------------------------------------------------------- 4. GYM
def ring_a(frac, col, size=40):
    r = 16.5
    Cc = 2 * math.pi * r
    return (f'<svg viewBox="0 0 40 40" width="{size}" height="{size}"><circle cx="20" cy="20" r="{r}" fill="none" stroke="{col}" stroke-opacity=".22" stroke-width="5"/>'
            f'<circle cx="20" cy="20" r="{r}" fill="none" stroke="{col}" stroke-width="5" stroke-linecap="round" stroke-dasharray="{frac * Cc:.1f} {Cc:.1f}" transform="rotate(-90 20 20)"/></svg>')


def gym():
    bars = ''.join(f'<i class="{"m" if lv == 10 else ""}" style="height:{6 + 62 * lv / 10:.0f}px"></i>' for lv in C.LEVELS)
    games = [('sudoku', 'Sudoku', 'Level 6 · 66% · Paused', 0.66), ('tictactoe', 'Tic-tac-toe', 'Mastered · all 10 levels', 1.0),
             ('connect4', 'Connect 4', 'Level 8 · 83% · Paused', 0.83), ('chess', 'Chess', 'Level 3 · 44% · Paused', 0.44),
             ('maze', 'Maze', 'Mastered · all 10 levels', 1.0)]
    rows = ''.join(f'<div class="row" style="min-height:60px"><span class="ic" style="background:{GAMES[g][0]}">{game_icon(g)}</span><span class="tx"><b>{n}</b><span class="num">{t}</span></span><span class="ringa">{ring_a(f, "var(--green)")}</span>{icon("chev", "i chv")}</div>' for g, n, t, f in games)
    body = f'''
<div class="navl"><span class="circ">{icon('back')}</span><span class="av">B</span></div>
<div class="titleblock"><div class="large">Gym</div><div class="sub">Ghosty teaches himself by playing, on this phone.</div></div>
<div class="sumcard"><div class="k">{icon('gym')}Mastery</div><div class="big num">3 <small>of 22 games mastered</small></div><div class="bars">{bars}</div><div class="axis"><span>Each bar is one game’s level, 1 to 10</span><span>Least mastered →</span></div></div>
<div class="trainb">{icon('play')}Train All</div>
<div class="sect" style="top:460px"><div class="group plain"><div class="row noic"><span class="tx"><b>Keep Awake</b></span><span class="sw"></span></div></div>
<div class="ftr">Not running. Train All starts with the least mastered game, Debate Arena, and carries on until every game is mastered or you tap Stop.</div></div>
<div class="sect" style="top:594px"><div class="hdr big">Games</div><div class="group">{rows}</div></div>
'''
    return page('Ghosty A · Gym', frame(body, 'gym', 'learn'))


# ---------------------------------------------------------------- 5. SETTINGS (the Me sheet)
def settings():
    body = f'''
<div class="behind"><img src="home.png" alt=""></div>
<div class="sheet">
  <span class="grabber"></span>
  <div class="shead"><span class="circ" style="visibility:hidden"></span><span class="t">Me</span><span class="done">Done</span></div>
  <div class="sect" style="top:76px;left:16px;right:16px"><div class="group"><div class="prof"><span class="pav">B</span><span class="tx" style="flex:1"><b>Boss</b><span>Graphite · °C, km</span></span>{icon('chev', 'i chv')}</div></div></div>
  <div class="sect" style="top:172px;left:16px;right:16px"><div class="hdr">STATUS</div><div class="group">
    <div class="row" style="min-height:46px"><span class="ic" style="background:var(--green)">{icon('check')}</span><span class="tx"><b>Ghosty</b></span><span class="val g">Connected</span></div>
    <div class="row" style="min-height:46px"><span class="ic" style="background:var(--blue)">{icon('sparkle')}</span><span class="tx"><b>Free AI today</b></span><span class="val num">72% left</span></div>
    <div class="row" style="min-height:46px"><span class="ic" style="background:var(--orange)">{icon('cloud')}</span><span class="tx"><b>Database today</b></span><span class="val num">18% used</span></div>
    <div class="row" style="min-height:46px"><span class="ic" style="background:var(--indigo)">{icon('brain')}</span><span class="tx"><b>Offline brain</b></span><span class="val">Ready</span></div>
    <div class="row" style="min-height:46px"><span class="ic" style="background:var(--gray)">{icon('shield')}</span><span class="tx"><b>Version</b></span><span class="val">Up to date</span></div>
  </div></div>
  <div class="sect" style="top:452px;left:16px;right:16px"><div class="group">
    {row('brain', '#ff375f', 'Memory', 'What I know about you')}
    {row('sliders', '#8e8e93', 'Settings', 'Look, voice, home and about')}
    {row('chip', '#5e5ce6', 'System', 'Keys, models, storage and backups')}
  </div></div>
  <div class="sect" style="top:640px;left:16px;right:16px"><div class="group">
    {row('link', '#0a84ff', 'Links', 'Email, Spotify and your phone')}
    {row('grid', '#30d158', 'Every screen', 'All of Ghosty at once')}
  </div><div class="ftr num">Ghosty 29e6c95 · built 2 hours ago</div></div>
</div>
'''
    return page('Ghosty A · Me', frame(body, 'mescreen'))


# ---------------------------------------------------------------- the design-language card
def language():
    dark = [('#000000', 'Background'), ('#1c1c1e', 'Grouped cell'), ('#0a84ff', 'Blue · tint'), ('#30d158', 'Green'), ('#ff9f0a', 'Orange'), ('#ff453a', 'Red')]
    light = [('#f2f2f7', 'Background'), ('#ffffff', 'Grouped cell'), ('#007aff', 'Blue · tint'), ('#34c759', 'Green'), ('#ff9500', 'Orange'), ('#ff3b30', 'Red')]
    sw = lambda L: ''.join(f'<div class="swa"><span style="background:{c}"></span><b>{n}</b><em>{c.upper()}</em></div>' for c, n in L)
    types = [('Large Title', '34/41 Bold', 'font-size:34px;line-height:41px;font-weight:700;letter-spacing:-.4px', 'Gym'),
             ('Title 3', '20/25 Semibold', 'font-size:20px;line-height:25px;font-weight:600', 'Games'),
             ('Headline', '17/22 Semibold', 'font-size:17px;font-weight:600', 'Brief me'),
             ('Body', '17/22 Regular', 'font-size:17px', 'Call Mum at half seven.'),
             ('Footnote', '13/18 Regular', 'font-size:13px;color:rgba(235,235,245,.62)', '3 of 3 claims found in the sources'),
             ('Caption', '12/16 Regular', 'font-size:12px;color:rgba(235,235,245,.62)', 'Today 18:31')]
    ty = ''.join(f'<div class="tyr"><div><b>{n}</b><em>{d}</em></div><div style="{st}">{t}</div></div>' for n, d, st, t in types)
    body = f'''
<div class="lang">
  <header><div><div class="eyebrow">Route A · the iPhone look</div><h1>Ghosty, as if Apple made him.</h1>
  <p>Apple’s own grammar, done carefully: large titles, grouped inset lists, widgets on Home, the Liquid Glass tab bar, system colours and hairlines. No HUD at all. The arc reactor survives as one live widget.</p></div></header>
  <section class="cols">
    <div><h2>Dark</h2><div class="swg">{sw(dark)}</div><h2 style="margin-top:28px">Light</h2><div class="swg">{sw(light)}</div>
      <h2 style="margin-top:28px">Rules</h2><ul class="notes"><li>Colour means the system’s meaning: blue acts, green is on or done, orange warns, red is urgent.</li><li>Grouped inset lists with 24 pt corners and 0.5 pt hairlines.</li><li>Widgets keep Apple’s sizes and 24 pt corners.</li><li>Motion: system springs, reduce motion honoured.</li></ul></div>
    <div><h2>Type <small>SF Pro (Inter stands in)</small></h2>{ty}
      <h2 style="margin-top:28px">Components</h2>
      <div class="comp">
        <div class="trainb" style="position:static;width:100%">{icon('play')}Train All</div>
        <div style="display:flex;gap:8px;margin-top:12px"><span class="fchip on">{icon('plane')}Aircraft</span><span class="fchip on o">{icon('warn')}Incidents</span><span class="citedp">{icon('check')}Cited</span><span class="sw on"></span><span class="sw"></span></div>
        <div class="group" style="margin-top:12px">{row('brain', '#ff375f', 'Memory', 'What I know about you')}{row('sparkle', '#0a84ff', 'Free AI today', None, '72% left', False)}</div>
        <div class="seg" style="margin-top:12px"><span class="on">Look</span><span>Home</span><span>North</span><span>Tilt</span></div>
        <div style="position:relative;height:84px;margin-top:12px">{tabbar('ask').replace('class="tabs"', 'class="tabs" style="left:0;right:0;bottom:10px"')}</div>
      </div></div>
    <div><h2>The reactor widget</h2><div class="wg reactorw" style="width:194px;height:176px">{reactor_widget()}<div class="rlab"><b>Ghosty</b><span><i></i>Online · 84 ms</span></div></div>
      <h2 style="margin-top:28px">Light mode</h2><div class="lite"><img src="home-light.png" alt="Home in light mode"></div></div>
  </section>
</div>'''
    css = f'''<style>{FRAME_CSS}
body {{ width: 1500px; background: #000; }}
.lang {{ width: 1500px; padding: 56px 64px 64px; color: #fff; }}
.lang header {{ padding-bottom: 30px; border-bottom: 0.5px solid rgba(84,84,88,.65); }}
.eyebrow {{ font-size: 13px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: #0a84ff; }}
.lang h1 {{ margin-top: 10px; font-size: 44px; line-height: 50px; font-weight: 700; letter-spacing: -.8px; }}
.lang header p {{ margin-top: 12px; max-width: 900px; font-size: 18px; line-height: 27px; color: rgba(235,235,245,.62); }}
.cols {{ display: grid; grid-template-columns: 330px 560px 1fr; gap: 56px; padding-top: 32px; }}
.lang h2 {{ font-size: 13px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: rgba(235,235,245,.5); margin-bottom: 14px; }}
.lang h2 small {{ text-transform: none; letter-spacing: 0; font-weight: 500; margin-left: 6px; }}
.swg {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }}
.swa span {{ display: block; height: 52px; border-radius: 12px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }}
.swa b {{ display: block; margin-top: 6px; font-size: 13px; font-weight: 600; }}
.swa em {{ display: block; font-style: normal; font-size: 11px; color: rgba(235,235,245,.5); }}
.notes {{ list-style: none; }}
.notes li {{ font-size: 14px; line-height: 20px; color: rgba(235,235,245,.7); padding: 8px 0; border-top: 0.5px solid rgba(84,84,88,.65); }}
.tyr {{ display: flex; gap: 18px; align-items: baseline; padding: 9px 0; border-top: 0.5px solid rgba(84,84,88,.65); }}
.tyr > div:first-child {{ width: 130px; flex: none; }}
.tyr b {{ display: block; font-size: 13px; font-weight: 600; }}
.tyr em {{ display: block; font-style: normal; font-size: 11.5px; color: rgba(235,235,245,.5); }}
.lite {{ width: 300px; height: 652px; border-radius: 44px; overflow: hidden; box-shadow: 0 0 0 7px #1c1c1e, 0 0 0 8px rgba(255,255,255,.14); }}
.lite img {{ width: 300px; height: 652px; display: block; }}
</style>'''
    return page('Ghosty A · design language', css + body)


def contact_sheet():
    return contact('a', 'Route A <span>· the iPhone look</span>', 'Apple’s own grammar, made miles better; the reactor as one live widget', '#0b0b0c', '#ffffff', 'rgba(235,235,245,.6)', 'rgba(255,255,255,.12)')


if __name__ == '__main__':
    for name, fn in [('home', home), ('chat', chat), ('eye', eye), ('gym', gym), ('settings', settings), ('language', language), ('contact', contact_sheet)]:
        write(HERE, f'{name}.html', fn())
    write(HERE, 'home-light.html', home().replace('Ghosty A · Home', 'Ghosty A · Home (light)'))
    print('route A pages written')
