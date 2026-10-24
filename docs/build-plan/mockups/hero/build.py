"""The hero round: writes, for each option, route C's Home with the new 3D centrepiece in the reactor's place
(home.html), the hero alone (closeup.html) and its states (states.html), plus the contact sheet.
Run from the worktree root:  python3 -I -B docs/build-plan/mockups/hero/build.py
Then render:                 node docs/build-plan/mockups/hero/render.mjs"""
import importlib.util, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
from common import write  # noqa: E402

_spec = importlib.util.spec_from_file_location('route_c', os.path.join(HERE, '..', 'c', 'build.py'))
C = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(C)
P, arc, CYAN = C.P, C.arc, C.CYAN

OPTIONS = [
    ('core', 'Core', 'The arc reactor, rebuilt in true 3D: brushed housing, copper windings, a plasma heart under real glass.'),
    ('mind', 'Mind', 'A hologram of Ghosty’s mind: his library as a living constellation that lights up as he studies.'),
    ('gyro', 'Gyro', 'A machined instrument: nested rings turning on three axes round a small bright core.'),
]
SCRIPT = '<script type="module">import { mountAll } from \'../kit.js\'; mountAll();</script>'


def gauges(cx=220, cy=146):
    """Route C's four-gauge ring, without the old reactor inside it."""
    s = []
    for r, v, col, w, op in [(120, 0.72, CYAN, 3.0, 1.0), (112, 0.313, '#e8eef3', 2.4, 0.85), (104, 0.5, '#e8eef3', 2.4, 0.5)]:
        s.append(f'<path d="{arc(cx, cy, r, 135, 405)}" fill="none" stroke="#fff" stroke-opacity="0.075" stroke-width="{w}" stroke-linecap="round"/>')
        a1 = 135 + 270 * v
        s.append(f'<path d="{arc(cx, cy, r, 135, a1)}" fill="none" stroke="{col}" stroke-opacity="{op}" stroke-width="{w}" stroke-linecap="round"/>')
        ex, ey = P(cx, cy, r, a1)
        if col == CYAN:
            s.append(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="5" fill="{CYAN}" opacity="0.6" style="filter:blur(2px)"/><circle cx="{ex:.1f}" cy="{ey:.1f}" r="2.6" fill="#eafaff"/>')
    for k in range(11):
        a = 135 + 27 * k
        x0, y0 = P(cx, cy, 126, a)
        x1, y1 = P(cx, cy, 130 if k % 5 else 133, a)
        s.append(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="#fff" stroke-opacity="{0.42 if k % 5 == 0 else 0.22}" stroke-width="1"/>')
    return ''.join(s)


def home(opt):
    html = C.home()
    old_disc = f'<div class="disc" style="{C.disc_css(132, 58, 88)}"></div>'
    assert old_disc in html
    html = html.replace(old_disc, f'<canvas data-hero="{opt}" data-state="idle" data-fill="0.653" style="position:absolute;left:70px;top:-4px;width:300px;height:300px"></canvas>')
    old = C.reactor_svg()
    assert old in html
    html = html.replace(old, gauges())
    html = html.replace('href="../fonts.css"', 'href="../../fonts.css"').replace('href="style.css"', 'href="../../c/style.css"')
    html = html.replace('<title>Ghosty C · Home</title>', f'<title>Ghosty C · Home · {opt}</title>')
    return html.replace('</body>', SCRIPT + '</body>')


def closeup(opt, name):
    return f'''<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="mock-scale" content="3"><title>Hero · {name} · close-up</title>
<link rel="stylesheet" href="../../fonts.css"><style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ width: 400px; height: 400px; background: radial-gradient(closest-side, rgba(100,210,255,.12), rgba(100,210,255,0) 80%), #000; }}
canvas {{ display: block; width: 400px; height: 400px; }}
</style></head><body><canvas data-hero="{opt}" data-state="idle" data-fill="0.6"></canvas>{SCRIPT}</body></html>
'''


def states(opt, name):
    cells = ''.join(f'<figure><canvas data-hero="{opt}" data-state="{st}" data-t="{t}" data-fill="0.6"></canvas><figcaption><b>{lab}</b><span>{sub}</span></figcaption></figure>'
                    for st, lab, sub, t in [('idle', 'Idle', 'slow breathing', 12.5), ('listen', 'Listening', 'opens and brightens', 12.5), ('think', 'Thinking', 'ripples and pulses', 12.9)])
    return f'''<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Hero · {name} · states</title>
<link rel="stylesheet" href="../../fonts.css"><style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ width: 1000px; background: #000; color: #f4f6f8; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; padding: 30px 30px 34px; }}
h1 {{ font-size: 22px; font-weight: 700; letter-spacing: -0.3px; margin: 0 4px 20px; }}
h1 span {{ color: rgba(235,240,245,.55); font-weight: 500; }}
.row {{ display: flex; gap: 20px; }}
figure {{ width: 300px; }}
canvas {{ display: block; width: 300px; height: 300px; border-radius: 24px; background: radial-gradient(closest-side, rgba(100,210,255,.1), rgba(100,210,255,0) 80%), #000; box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); }}
figcaption {{ margin-top: 12px; text-align: center; }}
figcaption b {{ display: block; font-size: 16px; font-weight: 600; }}
figcaption span {{ font-size: 13px; color: rgba(235,240,245,.55); }}
</style></head><body><h1>{name} <span>· idle, listening, thinking</span></h1><div class="row">{cells}</div>{SCRIPT}</body></html>
'''


def contact():
    cells = ''.join(f'<figure><div class="ph"><img src="{o}/home.png" alt="{n}"></div><figcaption><b>{i + 1}</b>{n}</figcaption><p>{d}</p></figure>' for i, (o, n, d) in enumerate(OPTIONS))
    return f'''<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="mock-scale" content="1.6"><title>Hero · contact sheet</title>
<link rel="stylesheet" href="../fonts.css"><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #050607; color: #f4f6f8; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; width: 1340px; padding: 48px 56px 48px; }}
header {{ margin-bottom: 32px; }}
header p {{ margin-top: 6px; }}
h1 {{ font-size: 32px; line-height: 38px; font-weight: 700; letter-spacing: -0.6px; }}
h1 span {{ color: rgba(235,240,245,.6); font-weight: 500; }}
header p {{ font-size: 15px; color: rgba(235,240,245,.6); }}
.row {{ display: flex; gap: 52px; }}
figure {{ width: 372px; }}
.ph {{ width: 372px; height: 808px; border-radius: 54px; overflow: hidden; box-shadow: 0 0 0 1.5px rgba(255,255,255,.12), 0 0 0 8px #16181b, 0 0 0 9px rgba(255,255,255,.14), 0 30px 60px rgba(0,0,0,.45); }}
.ph img {{ width: 372px; height: 808px; display: block; }}
figcaption {{ margin-top: 24px; font-size: 18px; font-weight: 700; letter-spacing: -0.2px; text-align: center; }}
figcaption b {{ display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 12px; margin-right: 8px; font-size: 12px; background: rgba(100,210,255,.16); color: #9fe4ff; vertical-align: 2px; }}
figure p {{ margin-top: 6px; font-size: 14px; line-height: 20px; color: rgba(235,240,245,.62); text-align: center; padding: 0 8px; }}
</style></head><body><header><h1>The hero <span>· three real-3D centrepieces for route C’s Home</span></h1><p>Rendered live with three.js; the four gauges stay round each one</p></header><div class="row">{cells}</div></body></html>
'''


if __name__ == '__main__':
    for opt, name, _ in OPTIONS:
        os.makedirs(os.path.join(HERE, opt), exist_ok=True)
        write(os.path.join(HERE, opt), 'home.html', home(opt))
        write(os.path.join(HERE, opt), 'closeup.html', closeup(opt, name))
        write(os.path.join(HERE, opt), 'states.html', states(opt, name))
    write(HERE, 'contact.html', contact())
    print('hero pages written')
