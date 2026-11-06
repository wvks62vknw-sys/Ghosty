"""The picture on the Stage for the journey: Birmingham's centre as a flat map with the way drawn on it. Home, a walk
of fourteen minutes to Birmingham New Street, platform 3, the 07:42 to Coventry. A mock (flat SVG, STARS 164 allows it);
the app draws the same thing from the journey planner's legs. 360 x 440 viewBox, `slice` so any frame crops it
the same way. Every colour is a token, so each direction inks it its own way:
  --map-street  minor streets    --map-main  the main roads and the ring road    --map-water  the canal
  --map-rail    other railway    --map-park  parks and the Bullring's block       --map-halo   what text sits on
  --accent / --accent-rgb  the live route (walk dotted, train solid)             --ink-1 / --ink-2  labels
Standard library only."""
import math
import random


def smooth(pts, closed=False, t=0.5):
    """Catmull-Rom through the points as a cubic Bezier path."""
    n = len(pts)
    if n < 3:
        return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    P = (lambda i: pts[i % n]) if closed else (lambda i: pts[max(0, min(n - 1, i))])
    d = f'M{pts[0][0]:.1f} {pts[0][1]:.1f}'
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0, p1, p2, p3 = P(i - 1), P(i), P(i + 1), P(i + 2)
        c1 = (p1[0] + (p2[0] - p0[0]) * t / 3 * 2 / 2, p1[1] + (p2[1] - p0[1]) * t / 3 * 2 / 2)
        c2 = (p2[0] - (p3[0] - p1[0]) * t / 3 * 2 / 2, p2[1] - (p3[1] - p1[1]) * t / 3 * 2 / 2)
        d += f'C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}'
    return d + ('Z' if closed else '')


def _grid(angle, step, rect, jitter, rnd):
    """Parallel lines across the rectangle at `angle`; each a little crooked so it is a town, not graph paper."""
    x0, y0, x1, y1 = rect
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    reach = math.hypot(x1 - x0, y1 - y0) / 2 + 20
    ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    out = []
    s = -reach
    while s <= reach:
        if rnd.random() > 0.12:
            a = (cx - sa * s - ca * reach, cy + ca * s - sa * reach)
            b = (cx - sa * s + ca * reach, cy + ca * s + sa * reach)
            mid = ((a[0] + b[0]) / 2 + rnd.uniform(-jitter, jitter), (a[1] + b[1]) / 2 + rnd.uniform(-jitter, jitter))
            out.append(f'M{a[0]:.1f} {a[1]:.1f}Q{mid[0]:.1f} {mid[1]:.1f} {b[0]:.1f} {b[1]:.1f}')
        s += step * rnd.choice((0.8, 1.0, 1.0, 1.25))
    return ''.join(out)


SHIFT = 34  # the picture is drawn round New Street at (190, 232); the Stage's frame is taller, so it sits 34 lower
HOME = (92, 334)
NEW_STREET = (190, 232)
WALK = [HOME, (92, 298), (142, 298), (142, 262), (190, 262), (190, 240)]
TRAIN = [NEW_STREET, (232, 248), (272, 264), (310, 284), (344, 308)]


def route_map(uid='m', seed=3, labels=True, halo_w=4.5):
    rnd = random.Random(seed)
    rect = (-20, -60, 380, 520)
    fine = _grid(-18, 21, rect, 3.5, rnd) + _grid(72, 24, rect, 3.5, rnd)
    coarse = _grid(-18, 52, rect, 6, rnd) + _grid(72, 58, rect, 6, rnd)
    ring = smooth([(205, 128), (278, 150), (322, 232), (296, 318), (212, 352), (126, 322), (92, 238), (128, 156)], closed=True)
    roads = [
        # Corporation Street to the north-east, Colmore Row to Snow Hill, and the radials a city has
        [(190, 232), (232, 190), (280, 148), (330, 104), (372, 70), (404, 40)],
        [(190, 232), (150, 196), (112, 162), (70, 120), (30, 84), (-10, 50)],
        [(190, 232), (186, 170), (178, 100), (170, 20), (166, -20), (160, -60)],
        [(190, 232), (130, 238), (70, 252), (20, 270), (-20, 282)],
        [(190, 232), (176, 286), (198, 340), (222, 410), (232, 460), (240, 520)],
        [(190, 232), (250, 236), (312, 226), (380, 210)],
        [(190, 232), (150, 280), (118, 340), (84, 410), (66, 460), (52, 520)],
    ]
    main = ''.join(smooth(r) for r in roads)
    canal = smooth([(-20, 318), (36, 300), (88, 286), (132, 262), (150, 214), (158, 168), (196, 124), (252, 100), (316, 98), (380, 82)])
    rails = ''.join(smooth(r) for r in [
        [(190, 232), (150, 246), (96, 262), (30, 270), (-20, 276)],
        [(190, 232), (158, 204), (126, 160), (100, 100), (88, 40), (82, -20), (78, -60)],
        [(190, 232), (196, 280), (206, 340), (214, 400), (216, 460), (218, 520)],
    ])
    parks = (f'<path d="{smooth([(40, 360), (88, 372), (120, 404), (92, 436), (44, 426), (22, 394)], closed=True)}"/>'
             f'<path d="{smooth([(262, 36), (318, 30), (344, 62), (310, 92), (268, 84)], closed=True)}"/>'
             f'<path d="{smooth([(262, 430), (318, 420), (348, 454), (316, 492), (270, 484)], closed=True)}"/>'
             f'<rect x="212" y="256" width="34" height="22" rx="7"/><rect x="40" y="168" width="30" height="26" rx="6"/>')
    walk = 'M' + 'L'.join(f'{x} {y}' for x, y in WALK)
    train = smooth(TRAIN)
    # an arrowhead at the end of the train line, along its last direction
    (ax, ay), (bx, by) = TRAIN[-2], TRAIN[-1]
    ang = math.atan2(by - ay, bx - ax)
    tip = (bx - 12 * math.cos(ang), by - 12 * math.sin(ang))
    head = (f'M{tip[0] + 9 * math.cos(ang):.1f} {tip[1] + 9 * math.sin(ang):.1f}'
            f'L{tip[0] - 6 * math.sin(ang):.1f} {tip[1] + 6 * math.cos(ang):.1f}L{tip[0] + 6 * math.sin(ang):.1f} {tip[1] - 6 * math.cos(ang):.1f}Z')
    lab = lambda x, y, t, s=10.5, w=600, anchor='start', fill='var(--map-label)', extra='': (
        f'<text x="{x}" y="{y}" font-size="{s}" font-weight="{w}" text-anchor="{anchor}" letter-spacing=".06em" '
        f'style="fill:{fill};stroke:var(--map-halo);stroke-width:{halo_w};paint-order:stroke;stroke-linejoin:round" font-family="var(--font-text)" {extra}>{t}</text>')
    text = ''
    if labels:
        text = lab(60, 146, 'SNOW HILL') + lab(204, 306, 'BULLRING') + lab(262, 152, 'CORPORATION ST', extra='transform="rotate(-42 262 152)"')
    me = (f'<circle cx="{HOME[0]}" cy="{HOME[1]}" r="17" style="fill:rgba(var(--accent-rgb),.16)"/>'
          f'<circle cx="{HOME[0]}" cy="{HOME[1]}" r="6.2" style="fill:rgb(var(--accent-pale-rgb));stroke:rgb(var(--accent-rgb));stroke-width:2.4"/>')
    ns = (f'<circle cx="{NEW_STREET[0]}" cy="{NEW_STREET[1]}" r="13" style="fill:rgba(var(--accent-rgb),.18)"/>'
          f'<circle cx="{NEW_STREET[0]}" cy="{NEW_STREET[1]}" r="8" style="fill:var(--map-halo);stroke:rgb(var(--accent-rgb));stroke-width:2.6"/>'
          f'<circle cx="{NEW_STREET[0]}" cy="{NEW_STREET[1]}" r="3" style="fill:rgb(var(--accent-rgb))"/>')
    names = (lab(HOME[0] + 14, HOME[1] + 20, 'Home', 12.5, 700, fill='var(--ink-1)') +
             lab(NEW_STREET[0] + 16, NEW_STREET[1] - 22, 'New Street', 12.5, 700, fill='var(--ink-1)') +
             lab(NEW_STREET[0] + 16, NEW_STREET[1] - 7, 'Platform 3 · 07:42', 11.5, 600, fill='var(--accent-text)') +
             lab(346, 338, 'Coventry · 08:03', 12.5, 700, anchor='end', fill='var(--ink-1)'))
    return (f'<svg class="routemap" width="100%" height="100%" viewBox="0 0 360 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
            f'<defs><filter id="{uid}b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter></defs>'
            f'<g transform="translate(0 {SHIFT})"><g fill="none" stroke-linecap="round" stroke-linejoin="round">'
            f'<g style="fill:var(--map-park);stroke:none">{parks}</g>'
            f'<path d="{coarse}" style="stroke:var(--map-street)" stroke-width=".7" opacity=".7"/>'
            f'<path d="{fine}" style="stroke:var(--map-street)" stroke-width=".8"/>'
            f'<path d="{canal}" style="stroke:var(--map-water)" stroke-width="4" opacity=".55"/><path d="{canal}" style="stroke:var(--map-water)" stroke-width="1.2"/>'
            f'<path d="{rails}" style="stroke:var(--map-rail)" stroke-width="1.5"/><path d="{rails}" style="stroke:var(--map-rail)" stroke-width="5" stroke-dasharray="1 7" opacity=".7"/>'
            f'<path d="{main}" style="stroke:var(--map-main)" stroke-width="1.7"/>'
            f'<path d="{ring}" style="stroke:var(--map-main)" stroke-width="2.6"/>'
            f'<path d="{walk}" style="stroke:rgba(var(--accent-rgb),.5)" stroke-width="9" filter="url(#{uid}b)"/>'
            f'<path d="{walk}" style="stroke:rgb(var(--accent-rgb))" stroke-width="3" stroke-dasharray="0.1 7" />'
            f'<path d="{train}" style="stroke:rgba(var(--accent-rgb),.6)" stroke-width="11" filter="url(#{uid}b)"/>'
            f'<path d="{train}" style="stroke:rgb(var(--accent-rgb))" stroke-width="4.2"/>'
            f'<path d="{head}" style="fill:rgb(var(--accent-rgb));stroke:rgb(var(--accent-rgb))" stroke-width="1.4"/>'
            f'</g>{me}{ns}{text}{names}</g></svg>')
