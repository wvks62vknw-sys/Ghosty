"""Round 2 of the Every screen deck (BRIEF-DECK-MOCKUPS-2.md): instruments, but better.
C2 the bridge (and its lower half), D the console, E the system map, and contact2 (C2, D, E and the old C).
Run from the worktree root:  python3 -I docs/build-plan/mockups/deck/build2.py
then:                        node docs/build-plan/mockups/tools/render.mjs deck c2 c2-scrolled d e contact2
Numbers are the app's on Saturday 24 Oct, 00:06, in Birmingham (design-build-2 screenshots): Dentist at 01:00 is
54 minutes away, so it is the one thing due within the hour and the only cyan besides the pulse and Core."""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
from common import FRAME_CSS, HOME_INDICATOR, icon, page, status_bar, write  # noqa: E402
from build import DECK_CSS, G, g  # noqa: E402

TIME = '00:06'
CYAN = '#64d2ff'
INK = '#f4f6f8'
AMBER = '#ffb340'
RED = '#ff6961'
HAIR = 'rgba(255,255,255,.10)'


# ------------------------------------------------------------------ instrument graphics (thin lines, route C tokens)
def P(cx, cy, r, a):
    t = math.radians(a)
    return cx + r * math.cos(t), cy + r * math.sin(t)


def arc(frac, d=52, sw=3.0, col=INK, ticks=11, glow=False):
    """A 270-degree gauge: hairline ticks outside, a faint track, the reading as a light line."""
    c = d / 2
    r = c - sw / 2 - (4 if ticks else 0.5)
    C = 2 * math.pi * r
    t = ''.join(
        f'<line x1="{P(c, c, c - 0.5, 135 + 270 / (ticks - 1) * k)[0]:.2f}" y1="{P(c, c, c - 0.5, 135 + 270 / (ticks - 1) * k)[1]:.2f}" '
        f'x2="{P(c, c, c - 2.8, 135 + 270 / (ticks - 1) * k)[0]:.2f}" y2="{P(c, c, c - 2.8, 135 + 270 / (ticks - 1) * k)[1]:.2f}" stroke="#fff" stroke-opacity=".28" stroke-width=".8"/>'
        for k in range(ticks)) if ticks else ''
    fr = max(frac, 0.012) if frac > 0 else 0
    val = (f'<circle cx="{c}" cy="{c}" r="{r:.2f}" fill="none" stroke="{col}" stroke-width="{sw}" stroke-linecap="round" '
           f'stroke-dasharray="{C * 0.75 * fr:.2f} {C:.2f}" transform="rotate(135 {c} {c})"{" style=&quot;filter:drop-shadow(0 0 3px " + col + ")&quot;" if glow else ""}/>') if fr else ''
    val = val.replace('&quot;', '"')
    return (f'<svg class="gx" width="{d}" height="{d}" viewBox="0 0 {d} {d}">{t}'
            f'<circle cx="{c}" cy="{c}" r="{r:.2f}" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="{sw}" stroke-linecap="round" '
            f'stroke-dasharray="{C * 0.75:.2f} {C:.2f}" transform="rotate(135 {c} {c})"/>{val}</svg>')


def countdown(frac, d=84, sw=3.0, inner=''):
    """A countdown ring: the hour as 60 hairline minutes, what is left of it in cyan (due within the hour)."""
    c = d / 2
    r = c - sw / 2 - 5
    C = 2 * math.pi * r
    t = ''.join(
        f'<line x1="{P(c, c, c - 0.5, -90 + 6 * k)[0]:.2f}" y1="{P(c, c, c - 0.5, -90 + 6 * k)[1]:.2f}" '
        f'x2="{P(c, c, c - (3.6 if k % 5 == 0 else 2.2), -90 + 6 * k)[0]:.2f}" y2="{P(c, c, c - (3.6 if k % 5 == 0 else 2.2), -90 + 6 * k)[1]:.2f}" '
        f'stroke="#fff" stroke-opacity="{.34 if k % 5 == 0 else .16}" stroke-width=".8"/>' for k in range(60))
    return (f'<svg class="gx" width="{d}" height="{d}" viewBox="0 0 {d} {d}">{t}'
            f'<circle cx="{c}" cy="{c}" r="{r:.2f}" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="{sw}"/>'
            f'<circle cx="{c}" cy="{c}" r="{r:.2f}" fill="none" stroke="{CYAN}" stroke-width="{sw}" stroke-linecap="round" '
            f'stroke-dasharray="{C * frac:.2f} {C:.2f}" transform="rotate(-90 {c} {c})" style="filter:drop-shadow(0 0 4px rgba(100,210,255,.7))"/>'
            f'{inner}</svg>')


def spark(vals, w=90, h=28, col=INK, area=True, dot=True, sw=1.5):
    lo, hi = min(vals), max(vals)
    n = len(vals)
    pts = [(1.5 + (w - 5) * i / (n - 1), 2.5 + (h - 5) * (1 - (v - lo) / ((hi - lo) or 1))) for i, v in enumerate(vals)]
    line = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    gid = f'sg{abs(hash((tuple(vals), col, w))) % 99999}'
    fill = (f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{col}" stop-opacity=".16"/>'
            f'<stop offset="1" stop-color="{col}" stop-opacity="0"/></linearGradient></defs>'
            f'<polygon points="{pts[0][0]:.1f},{h} {line} {pts[-1][0]:.1f},{h}" fill="url(#{gid})"/>') if area else ''
    end = f'<circle cx="{pts[-1][0]:.1f}" cy="{pts[-1][1]:.1f}" r="2" fill="{col}"/>' if dot else ''
    return (f'<svg class="gx" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{fill}'
            f'<polyline points="{line}" fill="none" stroke="{col}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round" opacity=".92"/>{end}</svg>')


def level(lit=3, n=5, w=34, h=18, col=AMBER):
    """The threat level as five rising bars, `lit` of them on (Elevated = 3)."""
    bw = (w - (n - 1) * 3) / n
    return (f'<svg class="gx" width="{w}" height="{h}" viewBox="0 0 {w} {h}">' + ''.join(
        f'<rect x="{k * (bw + 3):.1f}" y="{h - h * (k + 1) / n:.1f}" width="{bw:.1f}" height="{h * (k + 1) / n:.1f}" rx="1" '
        f'fill="{col if k < lit else "#fff"}" fill-opacity="{.9 if k < lit else .1}"/>' for k in range(n)) + '</svg>')


def flat(w=60, h=18, n=14):
    """Radio's level bars, quiet: every bar at its floor."""
    bw = (w - (n - 1) * 2.4) / n
    return (f'<svg class="gx" width="{w}" height="{h}" viewBox="0 0 {w} {h}">' + ''.join(
        f'<rect x="{k * (bw + 2.4):.1f}" y="{h - 2:.1f}" width="{bw:.1f}" height="2" rx=".8" fill="#fff" fill-opacity=".22"/>' for k in range(n)) + '</svg>')


def ladder(cur=0, n=9, w=86, h=12):
    """The school ladder: nine stops on a hairline, the current one lit (Nursery)."""
    xs = [5 + (w - 10) * k / (n - 1) for k in range(n)]
    c = h / 2
    dots = ''.join(
        (f'<circle cx="{x:.1f}" cy="{c}" r="3.6" fill="{INK}" style="filter:drop-shadow(0 0 3px rgba(255,255,255,.6))"/>' if k == cur else
         f'<circle cx="{x:.1f}" cy="{c}" r="2.4" fill="#0e1012" stroke="#fff" stroke-opacity=".32" stroke-width=".9"/>') for k, x in enumerate(xs))
    return (f'<svg class="gx" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><line x1="{xs[0]}" y1="{c}" x2="{xs[-1]}" y2="{c}" '
            f'stroke="#fff" stroke-opacity=".14" stroke-width="1"/>{dots}</svg>')


def constellation(w=44, h=24, n=7):
    """Memory: seven things, as seven points joined (the Mind's constellation, tiny)."""
    pts = [(4, 15), (11, 6), (19, 18), (25, 8), (32, 16), (38, 5), (41, 19)][:n]
    lines = ' '.join(f'{x},{y}' for x, y in pts)
    return (f'<svg class="gx" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><polyline points="{lines}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width=".9"/>'
            + ''.join(f'<circle cx="{x}" cy="{y}" r="1.9" fill="{INK}" fill-opacity=".85"/>' for x, y in pts) + '</svg>')


def switch_off(w=34, h=18):
    return (f'<svg class="gx" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect x=".5" y=".5" width="{w - 1}" height="{h - 1}" rx="{(h - 1) / 2}" '
            f'fill="none" stroke="#fff" stroke-opacity=".22"/><circle cx="{h / 2}" cy="{h / 2}" r="{h / 2 - 3.5}" fill="#fff" fill-opacity=".5"/></svg>')


def pulse_ring(d=28):
    c = d / 2
    return (f'<svg class="gx" width="{d}" height="{d}" viewBox="0 0 {d} {d}"><circle cx="{c}" cy="{c}" r="{c - 1}" fill="none" stroke="{CYAN}" stroke-opacity=".35" stroke-width="1"/>'
            f'<circle cx="{c}" cy="{c}" r="{c - 6}" fill="none" stroke="{CYAN}" stroke-width="1.4" style="filter:drop-shadow(0 0 3px {CYAN})"/>'
            f'<circle cx="{c}" cy="{c}" r="2.6" fill="{CYAN}" style="filter:drop-shadow(0 0 4px {CYAN})"/></svg>')


def daystrip(w=86, h=14):
    """Agenda: the next 24 hours as a hairline with hour ticks, the Dentist at 01:00 in cyan."""
    ticks = ''.join(f'<line x1="{2 + (w - 4) * k / 24:.1f}" y1="{h - (6 if k % 6 == 0 else 3.5)}" x2="{2 + (w - 4) * k / 24:.1f}" y2="{h}" stroke="#fff" stroke-opacity="{.3 if k % 6 == 0 else .14}" stroke-width=".8"/>' for k in range(25))
    x = 2 + (w - 4) * (54 / 60) / 24
    return (f'<svg class="gx" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{ticks}<line x1="2" y1="{h - .5}" x2="{w - 2}" y2="{h - .5}" stroke="#fff" stroke-opacity=".18"/>'
            f'<circle cx="2" cy="{h - 6}" r="1.6" fill="#fff" fill-opacity=".6"/>'
            f'<circle cx="{x + 1.5:.1f}" cy="{h - 7}" r="2.6" fill="{CYAN}" style="filter:drop-shadow(0 0 3px {CYAN})"/></svg>')


# real series
TEMP = [9.0, 8.8, 8.9, 9.3, 9.5, 8.6, 8.8, 8.8, 8.7, 8.7, 9.0, 9.5, 10.0, 10.4, 10.6, 10.7, 11.0, 10.8, 10.6, 10.2, 9.8, 9.6, 9.1, 8.9]
BTC = [81240, 81180, 81020, 80950, 81010, 80890, 80930, 81060, 80980, 81120, 81050, 81190, 81310, 81150, 81000, 80870, 80920, 80860, 80823]
AIR = [1131, 1142, 1150, 1163, 1158, 1170, 1181, 1176, 1188, 1195, 1191, 1199, 1204]

ROUND2_CSS = '''
svg.g { color: var(--ink2); }
.gx { display: block; flex: none; overflow: visible; }
.vitals { position: absolute; left: 20px; right: 20px; top: 127px; font-size: 12px; line-height: 16px; color: var(--ink3); white-space: nowrap; font-feature-settings: 'tnum', 'cv05'; letter-spacing: -0.05px; }
.vitals b { font-weight: 500; color: var(--ink2); }
.vitals .dot { width: 6px; height: 6px; margin-right: 5px; }
.gopill { position: absolute; z-index: 45; left: 20px; right: 20px; bottom: 28px; height: 52px; border-radius: 26px; display: flex; align-items: center; gap: 10px; padding: 0 6px 0 17px; background: rgba(24, 27, 31, 0.9); border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 18px 40px rgba(0, 0, 0, 0.55); backdrop-filter: blur(30px) saturate(180%); }
.gopill svg.g { width: 20px; height: 20px; stroke-width: 1.9; color: var(--ink2); }
.gopill .ph { flex: 1; font-size: 17px; letter-spacing: -0.25px; color: var(--ink3); }
.gopill .mic { width: 40px; height: 40px; border-radius: 20px; display: grid; place-items: center; border: 1px solid var(--hair2); background: rgba(255, 255, 255, 0.05); }
.gopill .mic svg.g { color: var(--ink); }
.fadebot2 { height: 150px; }
.big { font-weight: 300; letter-spacing: -0.8px; font-feature-settings: 'tnum', 'cv05'; white-space: nowrap; }
.unit { font-size: 12px; line-height: 15px; color: var(--ink2); white-space: nowrap; }
.red { color: ''' + RED + '''; }
'''


def vitals():
    return ('<div class="vitals"><i class="dot"></i><b>Online</b> · 93 ms · free AI open · database 7% · brain on this phone: no</div>')


def gopill():
    return f'<div class="gopill">{g("search")}<span class="ph">Go to, or ask…</span><span class="mic">{g("mic")}</span></div>'


def screen(body, cls='', fade=True, status=True):
    return (f'<div class="screen deck {cls}"><div class="glow" data-bleed></div>' + (status_bar(TIME) if status else '') + body
            + ('<div class="fadebot2"></div>' if fade else '') + gopill() + HOME_INDICATOR + '</div>')


def head(extra=''):
    return (f'<div class="dhd"><div class="t-kick">Every screen</div><div class="t-large">At your service, Boss</div></div>'
            f'{extra}<span class="gbtn dclose">{icon("close")}</span>' + vitals())


def css(extra):
    return f'<style>{FRAME_CSS}{DECK_CSS}{ROUND2_CSS}{extra}</style>'


TOOLS = [  # id, name, what it does
    ('lens', 'Lens', 'Camera: read, name, scan and measure'),
    ('studio', '3D studio', 'Take models apart, rooms in 3-D'),
    ('reverse', 'Reverse', 'Take apart apps, sites and packages'),
    ('space', 'Space', 'Plan a room, fit and make space'),
    ('learn', 'Learn', 'Courses, quizzes and flashcards'),
    ('links', 'Links', 'Email, Spotify and your phone'),
    ('settings', 'Settings', 'Graphite · °C · km'),
]


# ------------------------------------------------------------------ C2. the bridge
C2_CSS = '''
.page { position: absolute; left: 0; right: 0; top: 0; }
.now { position: absolute; left: 16px; right: 16px; top: 160px; height: 148px; padding: 16px 16px 14px 18px; display: flex; gap: 16px; align-items: center; }
.now .cring { position: relative; width: 96px; height: 96px; flex: none; }
.now .cring .in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.now .cring .in b { font-size: 30px; line-height: 30px; font-weight: 300; letter-spacing: -0.8px; font-feature-settings: 'tnum'; }
.now .cring .in small { margin-top: 2px; font-size: 10px; line-height: 12px; font-weight: 600; letter-spacing: 0.09em; color: var(--cyan-ink); }
.now .tx { flex: 1; min-width: 0; }
.now .tx .t-kick { color: var(--ink3); }
.now .tx .t-kick b { color: var(--cyan-ink); font-weight: 600; }
.now .tx .ev { margin-top: 5px; font-size: 24px; line-height: 28px; font-weight: 600; letter-spacing: -0.4px; }
.now .tx .sub { margin-top: 3px; font-size: 14px; line-height: 19px; color: var(--ink2); font-feature-settings: 'tnum'; }
.now .wx { position: absolute; right: 16px; top: 16px; text-align: right; }
.now .wx b { display: block; font-size: 22px; line-height: 24px; font-weight: 300; letter-spacing: -0.5px; }
.now .wx span { display: block; font-size: 11px; line-height: 14px; color: var(--ink3); }
.kk { position: absolute; left: 36px; color: var(--ink3); }
.icard2 { position: absolute; width: 194px; height: 136px; padding: 13px 14px 12px; border-radius: 20px; background: var(--glass); border: 1px solid var(--hair); box-shadow: var(--glass-shadow); overflow: hidden; }
.icard2.wide { width: 400px; height: 76px; display: flex; align-items: center; gap: 14px; padding: 0 16px; }
.icard2 .hd { display: flex; align-items: center; gap: 8px; }
.icard2 .hd svg.g { width: 18px; height: 18px; stroke-width: 1.7; }
.icard2 .hd b { font-size: 15px; line-height: 19px; font-weight: 600; letter-spacing: -0.15px; }
.icard2 .gtr { position: absolute; right: 12px; top: 12px; }
.icard2 .gbr { position: absolute; right: 13px; bottom: 16px; }
.icard2 .rd { position: absolute; left: 14px; bottom: 12px; }
.icard2 .rd .big { font-size: 30px; line-height: 33px; }
.icard2.wide .hd { width: 118px; flex: none; }
.icard2.wide .mid { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.icard2.wide .rdw { text-align: right; }
.icard2.wide .rdw .big { font-size: 26px; line-height: 28px; }
.icard2.lit { border-color: rgba(100, 210, 255, 0.26); }
.icard2.lit .hd svg.g { color: var(--cyan); }
.tcard { position: absolute; left: 16px; right: 16px; border-radius: 20px; background: var(--glass); border: 1px solid var(--hair); box-shadow: var(--glass-shadow); overflow: hidden; }
.toolrow { position: relative; height: 52px; display: flex; align-items: center; gap: 15px; padding: 0 14px 0 18px; }
.toolrow + .toolrow::before { content: ''; position: absolute; left: 55px; right: 0; top: 0; height: 1px; background: var(--hair); }
.toolrow .tx { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 10px; }
.toolrow .tx b { font-size: 16px; line-height: 21px; font-weight: 600; letter-spacing: -0.2px; white-space: nowrap; }
.toolrow .tx span { font-size: 13px; line-height: 17px; color: var(--ink3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.toolrow svg.chv { width: 14px; height: 14px; color: var(--ink4); stroke-width: 2.4; }
.navbar { position: absolute; z-index: 46; left: 0; right: 0; top: 0; height: 106px; background: linear-gradient(180deg, rgba(5,6,7,.97) 55%, rgba(5,6,7,0)); }
.navbar .ttl { position: absolute; left: 0; right: 0; top: 66px; text-align: center; font-size: 17px; line-height: 22px; font-weight: 600; letter-spacing: -0.25px; }
.navbar .gbtn { position: absolute; right: 16px; top: 57px; }
'''


def card(i, name, x, y, value, unit, gfx='', pos='gtr', lit=False):
    return (f'<div class="icard2{" lit" if lit else ""}" style="left:{x}px;top:{y}px"><div class="hd">{g(i)}<b>{name}</b></div>'
            f'<div class="{pos}">{gfx}</div><div class="rd"><div class="big">{value}</div><div class="unit">{unit}</div></div></div>')


def wide(i, name, sub, y, gfx, value, unit):
    return (f'<div class="icard2 wide" style="left:20px;top:{y}px"><div class="hd">{g(i)}<b>{name}</b></div>'
            f'<div class="mid">{gfx}<span class="unit" style="color:var(--ink3)">{sub}</span></div>'
            f'<div class="rdw"><div class="big">{value}</div><div class="unit">{unit}</div></div></div>')


def c2_page():
    L, R = 20, 226
    p = []
    p.append(f'''<div class="now glass">
  <div class="cring">{countdown(54 / 60, 96)}<div class="in"><b>54</b><small>MIN</small></div></div>
  <div class="tx"><div class="t-kick">Now · next at <b>01:00</b></div><div class="ev">Dentist</div>
  <div class="sub">In 54 minutes · Agenda</div><div class="sub" style="color:var(--ink3);font-size:13px">4 reminders · 0 events today</div></div>
  <div class="wx"><b>8°C</b><span>Partly cloudy</span></div>
</div>''')
    y = 330
    p.append(f'<div class="t-kick kk" style="top:{y}px">Ask and see</div>')
    y += 22
    p.append(card('core', 'Core', L, y, 'Online', '93 ms · free AI open', pulse_ring(30), lit=True))
    p.append(card('brief', 'Brief', R, y, '8°C', 'Partly cloudy · 24 h', spark(TEMP, 166, 30), 'gtr" style="top:42px;left:14px'))
    y += 148
    p.append(wide('eye', 'God’s eye', 'Aircraft, the last hour', y, spark(AIR, 112, 24), '1,204', 'aircraft live'))
    y += 76 + 22
    p.append(f'<div class="t-kick kk" style="top:{y}px">Make</div>')
    y += 22
    p.append(wide('workshop', 'Workshop', 'Self-edit · widgets, training', y, switch_off(), 'Off', 'self-edit'))
    y += 76 + 22
    p.append(f'<div class="t-kick kk" style="top:{y}px">Learn and plan</div>')
    y += 22
    p.append(card('agenda', 'Agenda', L, y, '4', 'reminders · next 01:00', daystrip(166, 16), 'gtr" style="top:50px;left:14px'))
    p.append(card('markets', 'Markets', R, y, '<span class="red">−0.52%</span>', 'BTC $80,823 · <span class="amb">risk off</span>', spark(BTC, 166, 30, RED), 'gtr" style="top:42px;left:14px'))
    y += 148
    p.append(card('threats', 'Threats', L, y, '170', 'live signals · 5 major', level(3, 5, 34, 20) + '<div class="unit amb" style="margin-top:4px;text-align:right;font-size:10px;letter-spacing:.08em;font-weight:600">ELEVATED</div>'))
    p.append(card('library', 'Library', R, y, '8,556', '801 on this phone', arc(801 / 8556, 46, 2.6)))
    y += 148
    p.append(card('school', 'School', L, y, 'Nursery', '2 papers sat · stage 1 of 9', ladder(0, 9, 80), 'gtr" style="top:48px;left:14px;right:auto'))
    p.append(card('gym', 'Gym', R, y, '0/22', 'games mastered', arc(0, 46, 2.6, ticks=23)))
    y += 148
    p.append(wide('radio', 'Radio', 'Quiet · 18 stations', y, flat(112, 16, 18), 'Off air', 'nothing playing'))
    y += 76 + 22
    p.append(f'<div class="t-kick kk" style="top:{y}px">Me</div>')
    y += 22
    p.append(card('memory', 'Memory', L, y, '7', 'things I know · 5 patterns', constellation(48, 26)))
    p.append(card('system', 'System', R, y, '7%', 'database today', arc(0.07, 46, 2.6)))
    y += 136 + 22
    p.append(f'<div class="t-kick kk" style="top:{y}px">Tools</div>')
    y += 22
    rows = ''.join(f'<div class="toolrow">{g(i)}<span class="tx"><b>{n}</b><span>{s}</span></span>{icon("chev", "i chv")}</div>' for i, n, s in TOOLS)
    p.append(f'<div class="tcard" style="top:{y}px">{rows}</div>')
    end = y + 52 * len(TOOLS) + 110
    return ''.join(p), end


def c2(scrolled=False):
    body, end = c2_page()
    if not scrolled:
        inner = head() + body
        return page('Every screen · C2 · the bridge', css(C2_CSS) + screen(inner))
    off = end - 956
    inner = (f'<div class="page" style="transform:translateY(-{off}px)">{body}</div>'
             f'<div class="navbar"><div class="ttl">Every screen</div><span class="gbtn">{icon("close")}</span></div>')
    return page('Every screen · C2 · the bridge, lower half', css(C2_CSS) + screen(inner))


# ------------------------------------------------------------------ D. the console
D_CSS = '''
.flow { position: absolute; left: 16px; right: 16px; top: 162px; }
.flow .kick { margin: 20px 18px 8px; color: var(--ink3); }
.flow .kick:first-child { margin-top: 0; }
.ccard { border-radius: 20px; background: var(--glass); border: 1px solid var(--hair); box-shadow: var(--glass-shadow); overflow: hidden; }
.crow { position: relative; height: 62px; display: flex; align-items: center; gap: 14px; padding: 0 16px 0 18px; }
.crow.tool { height: 54px; }
.crow + .crow::before { content: ''; position: absolute; left: 54px; right: 0; top: 0; height: 1px; background: var(--hair); }
.crow .tx { flex: 1; min-width: 0; }
.crow .tx b { display: block; font-size: 17px; line-height: 21px; font-weight: 600; letter-spacing: -0.25px; }
.crow .tx span { display: block; font-size: 13px; line-height: 17px; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-feature-settings: 'tnum', 'cv05'; }
.crow.tool .tx span { color: var(--ink3); }
.crow .gfx { width: 46px; display: flex; justify-content: center; align-items: center; flex: none; }
.crow .rd { min-width: 54px; text-align: right; flex: none; }
.crow .rd .big { font-size: 24px; line-height: 28px; }
.crow .rd .big small { font-size: 13px; font-weight: 400; letter-spacing: 0; color: var(--ink2); margin-left: 1px; }
.crow svg.chv { width: 14px; height: 14px; color: var(--ink4); stroke-width: 2.4; }
.crow.lit svg.g { color: var(--cyan); }
'''

D_ROWS = {
    'core': ('Online · free AI open', '93<small>ms</small>', pulse_ring(26)),
    'brief': ('Partly cloudy · next 24 h', '8°', spark(TEMP, 44, 18, area=False)),
    'eye': ('Aircraft over the last hour', '1,204', spark(AIR, 44, 18, area=False)),
    'lens': ('Camera: read, name, scan and measure', None, None),
    'studio': ('Take models apart, rooms in 3-D', None, None),
    'workshop': ('Self-edit · widgets, training', 'Off', switch_off(30, 16)),
    'reverse': ('Take apart apps, sites and packages', None, None),
    'space': ('Plan a room, fit and make space', None, None),
    'learn': ('Courses, quizzes and flashcards', None, None),
    'gym': ('Games mastered', '0<small>/22</small>', arc(0, 28, 2.2, ticks=0)),
    'school': ('Nursery · 2 papers sat', '1<small>/9</small>', ladder(0, 9, 44, 10)),
    'library': ('801 of 8,556 on this phone', '8,556', arc(801 / 8556, 28, 2.2, ticks=0)),
    'agenda': ('Dentist · in 54 min', '01:00', countdown(54 / 60, 30, 2.2)),
    'markets': ('BTC $80,823 · <span class="amb" style="display:inline">risk off</span>', '<span class="red">−0.52%</span>', spark(BTC, 44, 18, RED, area=False)),
    'threats': ('<span class="amb" style="display:inline">Elevated</span> · 5 major', '170', level(3, 5, 26, 16)),
    'radio': ('Off air · 18 stations', 'Off', flat(40, 16, 9)),
    'memory': ('Things I know · 5 patterns', '7', constellation(40, 22)),
    'settings': ('Graphite · °C · km', None, None),
    'system': ('Database today · resets 00:00', '7%', arc(0.07, 28, 2.2, ticks=0)),
    'links': ('Email, Spotify and your phone', None, None),
}
NAMES = {'core': 'Core', 'brief': 'Brief', 'eye': 'God’s eye', 'lens': 'Lens', 'studio': '3D studio', 'workshop': 'Workshop',
         'reverse': 'Reverse', 'space': 'Space', 'learn': 'Learn', 'gym': 'Gym', 'school': 'School', 'library': 'Library',
         'agenda': 'Agenda', 'markets': 'Markets', 'threats': 'Threats', 'radio': 'Radio', 'memory': 'Memory',
         'settings': 'Settings', 'system': 'System', 'links': 'Links'}
SECTIONS = [
    ('Ask and see', ['core', 'brief', 'eye', 'lens']),
    ('Make', ['workshop', 'studio', 'reverse', 'space']),
    ('Learn and plan', ['agenda', 'markets', 'threats', 'library', 'school', 'gym', 'radio', 'learn']),
    ('Me', ['memory', 'system', 'settings', 'links']),
]


def d():
    parts = []
    for name, ids in SECTIONS:
        rows = ''
        for i in ids:
            sub, rd, gfx = D_ROWS[i]
            if rd is None:
                rows += f'<div class="crow tool">{g(i)}<span class="tx"><b>{NAMES[i]}</b><span>{sub}</span></span>{icon("chev", "i chv")}</div>'
            else:
                rows += (f'<div class="crow{" lit" if i == "core" else ""}">{g(i)}<span class="tx"><b>{NAMES[i]}</b><span>{sub}</span></span>'
                         f'<span class="gfx">{gfx}</span><span class="rd"><span class="big">{rd}</span></span></div>')
        parts.append(f'<div class="t-kick kick">{name}</div><div class="ccard">{rows}</div>')
    body = head() + f'<div class="flow">{"".join(parts)}</div>'
    return page('Every screen · D · the console', css(D_CSS) + screen(body))


# ------------------------------------------------------------------ E. the system map
E_CSS = '''
.listbtn { position: absolute; right: 66px; top: 64px; height: 32px; padding: 0 12px 0 10px; border-radius: 16px; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink); background: rgba(255, 255, 255, 0.06); border: 1px solid var(--hair); }
.listbtn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; color: var(--ink2); }
.dhd .t-large { font-size: 30px; line-height: 36px; }
.vitals { top: 120px; }
.map { position: absolute; left: 0; top: 0; width: 440px; height: 956px; }
.map svg.links { position: absolute; inset: 0; }
.reg { position: absolute; border-radius: 26px; background: rgba(255, 255, 255, 0.018); border: 1px solid rgba(255, 255, 255, 0.055); }
.reg .t-kick { position: absolute; left: 16px; top: 12px; color: var(--ink3); font-size: 10px; }
.node { position: absolute; width: 96px; margin-left: -48px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.node .rg { position: relative; width: 46px; height: 46px; border-radius: 23px; display: grid; place-items: center; background: rgba(9, 11, 13, 0.92); border: 1px solid rgba(255, 255, 255, 0.16); }
.node .rg svg.g { width: 20px; height: 20px; stroke-width: 1.7; }
.node .rg .gx { position: absolute; left: -6px; top: -6px; }
.node b { margin-top: 6px; font-size: 12.5px; line-height: 15px; font-weight: 600; letter-spacing: -0.1px; white-space: nowrap; }
.node span { margin-top: 1px; font-size: 11px; line-height: 13px; color: var(--ink3); white-space: nowrap; font-feature-settings: 'tnum', 'cv05'; }
.node.tool .rg { border-style: dashed; border-color: rgba(255, 255, 255, 0.14); background: rgba(9, 11, 13, 0.7); }
.node.tool b { font-weight: 500; color: var(--ink2); }
.node.due .rg { border-color: transparent; }
.node.due span { color: var(--cyan-ink); }
.node.core .rg { width: 66px; height: 66px; border-radius: 33px; border-color: rgba(100, 210, 255, 0.55); box-shadow: 0 0 0 6px rgba(100, 210, 255, 0.06), 0 0 28px rgba(100, 210, 255, 0.35), inset 0 0 18px rgba(100, 210, 255, 0.18); }
.node.core .rg svg.g { width: 26px; height: 26px; color: var(--cyan); filter: drop-shadow(0 0 6px rgba(100, 210, 255, 0.8)); }
.node.core b { color: var(--cyan-ink); }
.here { position: absolute; font-size: 9.5px; line-height: 11px; font-weight: 700; letter-spacing: 0.12em; color: var(--cyan-ink); }
.grid { position: absolute; left: 0; right: 0; top: 140px; bottom: 90px; background-image: radial-gradient(rgba(255,255,255,.07) .7px, transparent .8px); background-size: 20px 20px; -webkit-mask-image: radial-gradient(closest-side at 50% 45%, #000, transparent); }
'''

# node centres (x, y)
E_NODES = {
    'brief': (64, 214), 'eye': (180, 214), 'core': (122, 318), 'lens': (64, 400),
    'studio': (276, 214), 'workshop': (378, 214), 'reverse': (276, 340), 'space': (378, 340),
    'gym': (60, 516), 'learn': (160, 516), 'school': (264, 516), 'library': (370, 516),
    'agenda': (60, 632), 'markets': (160, 632), 'threats': (264, 632), 'radio': (370, 632),
    'memory': (60, 776), 'system': (160, 776), 'settings': (264, 776), 'links': (370, 776),
}
E_READ = {
    'brief': '8°C · cloudy', 'eye': '1,204 aircraft', 'core': 'Online · 93 ms', 'lens': '',
    'studio': '', 'workshop': 'Self-edit off', 'reverse': '', 'space': '',
    'gym': '0/22 mastered', 'learn': '', 'school': 'Nursery · 1/9', 'library': '8,556 · 801 here',
    'agenda': '01:00 · in 54 min', 'markets': 'BTC −0.52%', 'threats': '170 · elevated', 'radio': 'Off air',
    'memory': '7 things', 'system': 'Database 7%', 'settings': '', 'links': '',
}
E_TOOLS = {'lens', 'studio', 'reverse', 'space', 'learn', 'settings', 'links'}


def e():
    regs = [('Ask and see', 14, 160, 212, 288), ('Make', 234, 160, 192, 288), ('Learn and plan', 14, 460, 412, 244),
            ('Me', 14, 716, 412, 120)]
    rh = ''.join(f'<div class="reg" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"><span class="t-kick">{n}</span></div>' for n, x, y, w, h in regs)
    N = E_NODES
    r = 23

    def seg(a, b):
        (x1, y1), (x2, y2) = N[a], N[b]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy)
        ra = 33 if a == 'core' else r + 2
        rb = 33 if b == 'core' else r + 2
        return f'M{x1 + dx / L * ra:.1f} {y1 + dy / L * ra:.1f}L{x2 - dx / L * rb:.1f} {y2 - dy / L * rb:.1f}'
    paths = [seg('gym', 'learn'), seg('learn', 'school'), seg('school', 'library'), seg('brief', 'eye'),
             'M60 694L60 748']
    # God's eye down to Threats, between Learn and School; Agenda up to Core, between Gym and Learn
    paths.append('M197 230 C 226 250, 230 290, 230 340 L 230 452 C 230 482, 212 492, 212 522 L 212 580 C 212 600, 236 608, 247 614')
    paths.append('M122 394 C 122 420, 112 430, 112 456 L 112 576 C 112 596, 90 600, 77 614')
    lines = (f'<svg class="links" width="440" height="956" viewBox="0 0 440 956">'
             + ''.join(f'<path d="{p}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1" stroke-dasharray="{"" if k < 5 else "2 3"}"/>' for k, p in enumerate(paths))
             + '</svg>')
    gauges = {'gym': arc(0, 58, 1.6, ticks=23), 'library': arc(801 / 8556, 58, 1.6, ticks=11), 'system': arc(0.07, 58, 1.6, ticks=11),
              'agenda': countdown(54 / 60, 58, 2.0)}
    nodes = ''
    for i, (x, y) in N.items():
        cls = 'node' + (' tool' if i in E_TOOLS else '') + (' core' if i == 'core' else '') + (' due' if i == 'agenda' else '')
        top = y - (33 if i == 'core' else 23)
        gx = gauges.get(i, '')
        rd = f'<span>{E_READ[i]}</span>' if E_READ[i] else ''
        rd = rd.replace('−0.52%', '<i class="red" style="font-style:normal">−0.52%</i>').replace('elevated', '<i class="amb" style="font-style:normal">elevated</i>')
        nodes += f'<div class="{cls}" style="left:{x}px;top:{top}px"><span class="rg">{gx}{g(i)}</span><b>{NAMES[i]}</b>{rd}</div>'
    here = '<span class="here" style="left:164px;top:300px">YOU ARE HERE</span>'
    listb = '<span class="listbtn"><svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>List</span>'
    body = head(listb) + f'<div class="map"><div class="grid"></div>{rh}{lines}{nodes}{here}</div>'
    return page('Every screen · E · the system map', css(E_CSS) + screen(body, fade=False))


# ------------------------------------------------------------------ contact sheet 2
def contact2():
    shots = [('c2', 'C2', 'The bridge', 'NOW first, instruments, then tools'),
             ('d', 'D', 'The console', 'Instrument rows, tools without readings'),
             ('e', 'E', 'The system map', 'One screen, every screen a node'),
             ('c', 'C', 'Round 1: instruments', 'For comparison')]
    cells = ''.join(f'<figure><div class="ph"><img src="{n}.png" alt="{t}"></div><figcaption><b>{k}</b>{t}<span>{s}</span></figcaption></figure>'
                    for n, k, t, s in shots)
    extra = ('<figure class="half"><div class="ph"><img src="c2-scrolled.png" alt="C2 lower half"></div>'
             '<figcaption><b>C2</b>Its lower half<span>Learn and plan, Me, the tools</span></figcaption></figure>')
    css2 = '''
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0a0b0d; color: #f4f6f8; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; width: 2584px; padding: 48px 56px 56px; }
header { margin-bottom: 34px; }
h1 { font-size: 32px; line-height: 38px; font-weight: 700; letter-spacing: -0.6px; }
header p { margin-top: 6px; font-size: 16px; line-height: 22px; color: rgba(235, 240, 245, 0.6); }
.row { display: flex; gap: 56px; }
.ph { width: 440px; height: 956px; border-radius: 56px; overflow: hidden; box-shadow: 0 0 0 1.5px rgba(255,255,255,.10), 0 0 0 8px #16181b, 0 0 0 9px rgba(255,255,255,.14), 0 30px 60px rgba(0,0,0,.5); }
.ph img { width: 440px; height: 956px; display: block; }
figcaption { margin-top: 24px; font-size: 19px; line-height: 24px; font-weight: 600; letter-spacing: -0.2px; text-align: center; }
figcaption b { display: inline-grid; place-items: center; min-width: 28px; height: 28px; padding: 0 7px; border-radius: 14px; margin-right: 10px; font-size: 13px; border: 1px solid rgba(255,255,255,.22); vertical-align: 1px; }
figcaption span { display: block; margin-top: 4px; font-size: 15px; font-weight: 400; color: rgba(235, 240, 245, 0.55); }
'''
    first = cells.split('</figure>')
    ordered = first[0] + '</figure>' + extra + '</figure>'.join(first[1:])
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="mock-scale" content="1"><title>Every screen · round 2</title>
<link rel="stylesheet" href="../fonts.css"><style>{css2}</style></head>
<body><header><h1>Every screen, round 2: instruments, but better</h1><p>Real gauges, a NOW card, tools as rows, grey glyphs with cyan only for the pulse, Core and what is due within the hour · iPhone 18 Pro Max, 440 × 956 · old C on the right for comparison</p></header>
<div class="row">{ordered}</div></body></html>
'''


if __name__ == '__main__':
    for name, html in [('c2', c2()), ('c2-scrolled', c2(True)), ('d', d()), ('e', e()), ('contact2', contact2())]:
        write(HERE, f'{name}.html', html)
    print('round 2 pages written')
