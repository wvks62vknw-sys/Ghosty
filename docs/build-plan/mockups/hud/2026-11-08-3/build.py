"""THE HUD MOCKS, ROUND THREE (BRIEF-HUD-MOCKS-3): three worlds for The Scan's Home, for his pick.

His words (OWNER-ISSUES 158): "i'm starting to reconsider the like room thing we got going on but i feel like maybe it's missing
something or we could go with something along those lines or move sideways or even move upwards". Round two (../2026-11-08-2) is
the base: its facts, marks, room, orb, light and render pipeline are imported, not redrawn. Three Homes, evening, AT HOME, the same
facts in each (the stamp, the where-line, Now = tonight's book, the seven rooms, the ask line), so only the WORLD differs:

  ROOM+    room-plus.html   the room with what it was missing found and added: a SHOT (the camera in the room, the lamp lighting it)
  SIDEWAYS wall.html        THE WALL: Home is the wall of what the Machine is watching tonight, nine live views of his world
  UPWARDS  world.html       THE WHOLE OF IT: one frame from the sky to his desk, the orb over the city, its line of sight on the book

Standard library only. From the repo root:
    python3 -I -B docs/build-plan/mockups/hud/2026-11-08-3/build.py
    node docs/build-plan/mockups/hud/2026-11-08-3/render.mjs stills | contact
"""
import importlib.util
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
R2DIR = os.path.normpath(os.path.join(HERE, '..', '2026-11-08-2'))
_spec = importlib.util.spec_from_file_location('r2', os.path.join(R2DIR, 'build.py'))
r2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(r2)
r1 = r2.r1

TOKENS, FONTS = r1.TOKENS, r1.FONTS
DAY, PLACE, NAME, BOOK = r1.DAY, r1.PLACE, r1.NAME, r1.BOOK
segs, tag, ret, callout, lead, plan, ask, box, key = r1.segs, r1.tag, r1.ret, r1.callout, r1.lead, r1.plan, r1.ask, r1.box, r1.key
CLOCK, STAR = r1.CLOCK, r1.STAR
HOME, ROOM, WINDOW, ORB_PX, ORB_SIZE = r1.HOME, r1.ROOM, r1.WINDOW, r1.ORB_PX, r1.ORB_SIZE
stamp, where, thing, LIGHT, ROUTE, CITY_THINGS, CAM_OUT = r2.stamp, r2.where, r2.thing, r2.LIGHT, r2.ROUTE, r2.CITY_THINGS, r2.CAM_OUT

# the facts on every frame this round (the same in each world, so only the world differs)
EVENING = r2.PLACES['evening']
TIME = EVENING['time']
LAMP_AT = [0.36, 0.73, -1.83]            # the desk lamp, at the back of the desk behind the board, the dark wall behind it
BULB = [LAMP_AT[0], LAMP_AT[1] + 0.61, LAMP_AT[2]]


# ------------------------------------------------------------------------------------------------ the page
def page(name, title, inner, cfg, screen_cls='', extra_css=''):
    head = ''.join(f'<link rel="stylesheet" href="{c}">' for c in (FONTS, TOKENS, '../2026-11-08/hud.css', '../2026-11-08-2/hud2.css', 'hud3.css'))
    html = f'''<!doctype html>
<html lang="en-GB" data-theme="reactor" data-ground="graphite" data-world="scan" data-night="graphite">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=440, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
{head}{extra_css}
</head>
<body>
<div class="screen {screen_cls}" id="screen"><canvas class="gl"></canvas><div class="winlight"></div><div class="lamplight"></div><div class="roomlight"></div>{r1.STATUS_BAR.format(time=TIME)}{inner}{r1.HOME_INDICATOR}</div>
<script type="application/json" id="cfg">{json.dumps(cfg)}</script>
<script type="module" src="home3.js"></script>
</body>
</html>
'''
    with open(os.path.join(HERE, name + '.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    return name


def top(looking='Home'):
    return f'<div class="top">{stamp(TIME, looking)}{where(EVENING["where"])}<p class="say">{EVENING["say"]}</p><p class="say2">{EVENING["say2"]}</p></div>'


def now_callout(px='24 648', align='tl', to='r-alice', leader=True):
    co = callout('c-now', px, align, *EVENING['co'][:3])
    return co + (lead('c-now', to) if leader else '')


def orb_el(px=ORB_PX, size=ORB_SIZE, fixed=False):
    f = ' data-fixed="1"' if fixed else ''
    return f'<div class="orb" id="orb" data-px="{px[0]} {px[1]}" data-align="c" data-r="{px[3]}"{f} style="width:{size}px;height:{size}px"><canvas width="{size * 2}" height="{size * 2}"></canvas></div>'


def world(parts, cam, light, orb_at=ORB_PX, orb_world=None, orb_world_r=0, bounds=None, build_from='orb', build_r=4.6, tiles=None, breath=1.0, orb_lit=1.0):
    w = dict(parts=parts, camera=dict(pos=cam['pos'], tgt=cam['tgt'], fov=cam['fov']), light=light, orbAt=orb_at,
             bounds=bounds or ROOM['room'], buildFrom=build_from, buildR=build_r, breath=breath, orbLit=orb_lit)
    if orb_world:
        w['orbWorld'] = orb_world
        w['orbWorldR'] = orb_world_r
    if tiles:
        w['tiles'] = tiles
    return w


def room_things(lit_names=('alice',), chair=True, mug=True):
    parts = []
    for n, (c, k, h, _l) in HOME.items():
        parts.append(thing(c, h, k, 1 if n in lit_names else 0))
    parts.append(dict(type='lamp', at=LAMP_AT, h=0.64, shade=0.17, shadeH=0.18))
    if mug:
        parts.append(dict(type='cyl', c=[0.08, 0.746, -1.40], r=0.04, h=0.095, handle=True))
    if chair:
        # his chair, pulled out from the desk and left: the seat, its back (a frame), four legs
        parts += [thing([-0.6, 0.455, -0.96], [0.22, 0.015, 0.22], 10), thing([-0.6, 0.80, -0.745], [0.2, 0.2, 0.012], 12)]
        for dx in (-0.19, 0.19):
            for dz in (-0.19, 0.19):
                parts.append(dict(type='thing', c=[-0.6 + dx, 0.22, -0.96 + dz], h=[0.012, 0.22, 0.012], kind=0, lit=0, edges=False, occlude=False))
    return parts


ROOM_PART = dict(type='room', hw=ROOM['room'][0], hgt=ROOM['room'][1], zb=ROOM['room'][2], zf=ROOM['room'][3], win=ROOM['win'])
SKY = dict(type='skyline', lit=0.42, accentLit=0.1, night=True)
LAMPS = [dict(at=BULB, strength=2.6, warm=1.0, cone=0.15, fall=1.6)]


def evening_light(cool=0.55, ambient=0.66):
    return dict(tint=[1.0, 0.985, 0.965], tintFar=[0.82, 0.9, 1.0], ambient=ambient, sky=0.0,
                window=dict(at=[0, 1.5, -2.4], strength=0.26, cool=cool), lamps=LAMPS)


# ------------------------------------------------------------------------------------------------ 1 · ROOM+
# The diagnosis, in one line: the room has no SHOT: it is drawn head-on from the doorway like a floor plan and lit from nowhere, so
# it reads as a diagram of a room, not a place he is sitting in at nine at night. What is added, and only that: a shot. The camera
# comes into the room (low, three-quarter, from his side of the desk); the lamp becomes a thing in the room that lights it (a warm
# pool on the desk and the brief, the shelf falling away, the city cool through the window at a slant); the orb hangs over the desk
# and lights it from above; his chair and his mug are where he left them. The same eight things, the same marks.
CAM_PLUS = dict(pos=[0.5, 1.45, 1.15], tgt=[-0.08, 0.95, -2.0], fov=66)


def room_marks():
    H = HOME
    return [
        ret('r-win', WINDOW, tag('God’s eye', glyph=CLOCK), '41 aircraft', cls='rt', pad=0, label='God’s eye'),
        ret('r-shelf', H['shelf'], tag('Library', glyph=CLOCK, count='4'), pad=0, label='Library'),
        ret('r-lens', H['lens'], tag('Lens', glyph=STAR), pad=3, label='Lens'),
        ret('r-agenda', H['agenda'], tag('Agenda', glyph=STAR), 'Dentist 09:15', cls='r', pad=2, label='Agenda'),
        ret('r-brief', H['brief'], tag('Brief', glyph=CLOCK), cls='below', pad=4, label='Brief'),
        ret('r-alice', H['alice'], '', cls='on full', pad=5, label='Tonight’s book'),
        ret('r-gym', H['gym'], tag('Gym', glyph=STAR), cls='below r', pad=3, label='Gym'),
        ret('r-courses', H['courses'], tag('Courses', glyph=STAR), cls='r', pad=4, label='Courses'),
    ]


def room_plus():
    inner = top() + ''.join(room_marks()) + now_callout('416 640', 'tr') + orb_el() + plan('home', kick=EVENING['kick']) + ask()
    parts = [ROOM_PART] + room_things() + [SKY]
    cfg = dict(world=world(parts, CAM_PLUS, evening_light()), orb=dict(size=ORB_SIZE, state='idle'))
    return page('room-plus', 'Home · ROOM+ · the room with its shot', inner, cfg, screen_cls='home evening roomplus')


# ------------------------------------------------------------------------------------------------ 2 · SIDEWAYS: THE WALL
# Home is the wall of what the Machine is watching tonight: nine live views of his world, each a camera in the same scan (the desk
# and the book, the shelf, the calendar, the brief, the board, the notebook, the lens; the city from above; the station), the one it
# is looking at in focus, the orb the eye in the middle with its line of sight on it. Not a room: the Machine's own view, which is
# every view at once. Every tile is one tap; the house along the bottom is the seven rooms; the ask line is the typed word.
MAP_AT = [60.0, 0.0, 0.0]
COLS = [24, 158, 292]
ROWS = [208, 326, 444, 562]
TW, TH, TWIDE = 124, 110, 258


def cam(pos, tgt, fov):
    return dict(pos=pos, tgt=tgt, fov=fov)


def off(p):
    return [p[0] + MAP_AT[0], p[1] + MAP_AT[1], p[2] + MAP_AT[2]]


TILES = [
    # id, col, row, wide?, the camera, the tag, the glyph, the count, the truth line, in focus?, lit
    ('t-city', 0, 0, False, cam(off([1.1, 3.6, 3.4]), off([-0.3, 0.0, 0.0]), 48), 'God’s eye', CLOCK, '', '41 aircraft', False, 0.5),
    ('t-shelf', 1, 0, False, cam([-0.62, 1.3, -1.3], [-0.78, 1.02, -2.2], 40), 'Library', CLOCK, '4', 'Alice · p. 42', False, 1.5),
    ('t-agenda', 2, 0, False, cam([0.56, 1.52, -1.6], [0.8, 1.5, -2.385], 36), 'Agenda', STAR, '', 'Dentist 09:15', False, 1.5),
    ('t-brief', 0, 1, False, cam([-0.62, 1.06, -1.3], [-0.62, 0.754, -1.62], 44), 'Brief', CLOCK, '', 'Tomorrow 9°', False, 1.5),
    ('t-lens', 2, 1, False, cam([-0.46, 1.52, -1.72], [-0.78, 1.47, -2.12], 34), 'Lens', STAR, '', 'Ready', False, 1.5),
    ('t-book', 0, 2, True, cam([-0.18, 1.14, -1.06], [-0.18, 0.76, -1.52], 44), 'Now · tonight’s book', '', '', 'Page 42 of 112', True, 1.6),
    ('t-gym', 2, 2, False, cam([0.27, 1.1, -1.28], [0.27, 0.76, -1.6], 44), 'Gym', STAR, '', 'Sudoku Lv 6', False, 1.5),
    ('t-courses', 0, 3, False, cam([0.66, 1.06, -1.28], [0.66, 0.757, -1.58], 44), 'Courses', STAR, '', 'Lesson 3', False, 1.5),
    ('t-station', 1, 3, False, cam(off([0.55, 1.25, 1.35]), off([0.0, 0.07, 0.1]), 46), 'New Street', CLOCK, '', 'The 7:42', False, 1.5),
    ('t-way', 2, 3, False, cam(off([1.0, 2.4, 2.3]), off([1.3, 0.0, 0.8]), 44), 'The way', '', '', 'Coventry 08:21', False, 0.5),
]
ORB_WALL = [COLS[1] + TW // 2, ROWS[1] + TH // 2 - 2, 2.2, 64]


def wall():
    tiles, marks = [], ''
    for tid, c, r, wide, cm, name, glyph, count, truth, on, lit in TILES:
        x, y, w, h = COLS[c], ROWS[r], TWIDE if wide else TW, TH
        tiles.append(dict(id=tid, x=x, y=y, w=w, h=h, cam=cm, lit=lit))
        t = f'<p class="g-truth">{truth}</p>' if truth else ''
        marks += (f'<button class="tile{" on" if on else ""}" id="{tid}" data-tile="{x} {y} {w} {h}" aria-label="{name}">'
                  f'<span class="g-ret-frame" aria-hidden="true"></span>{tag(name, glyph=glyph, count=count, on=on)}{t}</button>')
    sight = lead('orb', 't-book')
    co = now_callout('24 688', 'tl', leader=False)
    size = round(2 * ORB_WALL[3] / (0.9 * 0.74))
    inner = top() + marks + sight + co + orb_el(ORB_WALL, size, fixed=True) + plan('home', kick=EVENING['kick']) + ask()
    parts = [ROOM_PART] + room_things(chair=False) + [SKY, dict(type='map', route=ROUTE, me=None, offset=MAP_AT, sky=0.9, noLamp=True)]
    light = evening_light(ambient=0.7) | dict(fog=0.05)
    cfg = dict(world=world(parts, r1.CAM_HOME, light, orb_world=[0.0, 1.25, -1.35], orb_world_r=0.3, build_r=400, tiles=tiles, breath=0.5), orb=dict(size=size, state='idle'))
    return page('wall', 'Home · SIDEWAYS · the wall', inner, cfg, screen_cls='home wall')


# ------------------------------------------------------------------------------------------------ 3 · UPWARDS: THE WHOLE OF IT
# One frame from the sky to his desk: aircraft over the city, the city as hairline blocks lit with windows, the station among the
# towers, the street with its lamps and the houses across the way, his house with the roof lifted and the room lit inside it, the
# book lit on the desk; the orb over the city, its line of sight dropping to the book. The room is still there, at the bottom,
# as the deepest zoom of a world that goes all the way up; a pinch goes up it, a tap on a place goes there.
CAM_WORLD = dict(pos=[0.8, 5.0, 6.0], tgt=[0.9, 1.85, -5.0], fov=62)
K = 1 / 6                                   # the city behind the street at 1:6: the Machine draws what matters at the size it matters
AIRCRAFT = [[11, 3.4, -124, 0.85, 0.3], [-20, 3.1, -136, -0.9, 0.25], [-4, 2.2, -108, 0.5, -0.6]]
STATION = [16.5, 0, -62]                   # the tallest towers are round the station
DENTIST = [-7.5, 0, -38]


def world_marks():
    H = HOME
    a = AIRCRAFT[0]
    air = ([a[0], a[1], a[2]], 0, [2.5, 1.2, 2.5], 0)
    station = ([STATION[0], 4.5, STATION[2]], 0, [1.6, 4.5, 1.6], 0)
    dentist = ([DENTIST[0], 1.2, DENTIST[2]], 0, [1.2, 1.2, 1.2], 0)
    return [
        ret('r-air', air, tag('God’s eye', glyph=CLOCK), '41 aircraft', pad=4, label='God’s eye'),
        ret('r-station', station, tag('New Street', glyph=CLOCK), 'The 7:42 · tomorrow', cls='r below', pad=4, label='New Street'),
        ret('r-dentist', dentist, tag('Agenda', glyph=STAR), 'Dentist 09:15', pad=4, label='Agenda'),
        ret('r-shelf', H['shelf'], tag('Library', glyph=CLOCK, count='4'), pad=0, label='Library'),
        ret('r-alice', H['alice'], '', cls='on full', pad=4, label='Tonight’s book'),
    ]


def whole():
    inner = top() + ''.join(world_marks()) + now_callout('416 500', 'tr') + lead('orb', 'r-alice') + orb_el() + plan('home', kick=EVENING['kick']) + ask()
    room = dict(ROOM_PART, ceiling=False, solid=False, back=False, wallS=0.085, floorS=0.07)
    parts = ([room] + room_things(chair=True) +
             [dict(type='house', hw=2.6, depth=[-2.5, 3.0], hgt=3.2, ridge=4.4),
              dict(type='street', z0=-5.0, z1=-9.5, x0=-40, x1=40, lamps=9, lampH=4.2, hx=24, hstep=5.5, hw=2.2, hz=2.0, hgt=3.2, roof=1.0, win=[[-1.1, 1.0], [1.1, 1.0], [-1.1, 2.3], [1.1, 2.3]], winS=[0.3, 0.35], winSp=0.12),
              dict(type='town', z0=-22, z1=-130, x0=-90, x1=90, pitch=6, centre=STATION, lit=0.4, k=K, tower=34, edgeFade=36, camZ=6),
              dict(type='skyline', lit=0.3, accentLit=0.08, night=True, zOff=-130, rise=-25),
              dict(type='aircraft', list=AIRCRAFT, step=0.5)])
    light = dict(tint=[1.0, 0.985, 0.965], tintFar=[0.82, 0.9, 1.0], ambient=0.7, sky=0.0, window=None, lamps=LAMPS, fog=0.012)
    cfg = dict(world=world(parts, CAM_WORLD, light, bounds=[100, 100, -200, 10], build_r=400, breath=1.0), orb=dict(size=ORB_SIZE, state='idle'))
    return page('world', 'Home · UPWARDS · the whole of it', inner, cfg, screen_cls='home world')


# ------------------------------------------------------------------------------------------------ the contact sheet
DIAGNOSIS = 'The room has no shot: it is drawn head-on from the doorway like a floor plan and lit from nowhere, so it reads as a diagram of a room, not a place he is sitting in at nine at night.'
THREE = [
    ('room-plus', 'ROOM+ · the room with its shot', 'The same room, with what it was missing found and added: a shot. The camera comes into the room, low and three-quarter from his side of the desk; the lamp becomes a thing that lights it (a warm pool on the desk and the brief, the shelf falling away, the city cool through the window at a slant); the orb hangs over the desk and lights it; his chair and his mug are where he left them.'),
    ('wall', 'SIDEWAYS · the wall', 'Not a room: the Machine’s own view, which is every view at once. Home is the wall of what it is watching tonight: ten live cameras in the same scan (the desk and the book in focus, the shelf, the calendar, the brief, the board, the notebook, the lens, the city from above, the station, the way), the orb the eye in the middle with its line of sight on the one it is looking at. Every tile is one tap.'),
    ('world', 'UPWARDS · the whole of it', 'A bigger idea than a room: one frame from the sky to his desk. Aircraft over the city, the city as hairline blocks lit with windows, the station among the towers, his street with its lamps, his house with the roof lifted and the room lit inside it, the book lit on the desk; the orb over the city, its line of sight dropping to the book. The room is the deepest zoom of a world that goes all the way up.'),
]


def contact():
    figs = ''.join(f'<figure><img src="{png}.png" alt="{cap}"><figcaption>{tag(cap)}<p class="what">{what}</p></figcaption></figure>' for png, cap, what in THREE)
    html = f'''<!doctype html>
<html lang="en-GB" data-theme="reactor" data-ground="graphite" data-world="scan" data-night="graphite">
<head><meta charset="utf-8"><title>Ghosty · the HUD mocks, round three · contact</title>
<link rel="stylesheet" href="{FONTS}"><link rel="stylesheet" href="{TOKENS}"><link rel="stylesheet" href="../2026-11-08/hud.css"><link rel="stylesheet" href="../2026-11-08-2/hud2.css"><link rel="stylesheet" href="hud3.css">
<style>body {{ width: 1230px; height: auto; }}</style></head>
<body class="sheet"><h1>The HUD mocks, round three: three worlds for The Scan’s Home</h1>
<p class="lede">BRIEF-HUD-MOCKS-3, 8 Nov. His words: “i’m starting to reconsider the like room thing … maybe it’s missing something or we could go with something along those lines or move sideways or even move upwards.” Three Homes, evening, at home, the same facts in each (the stamp, the where-line, Now = tonight’s book, the seven rooms, the ask line), so only the world differs. 440 × 956 at 2×, the system’s tokens and marks, the scan as points, the real orb. The README has the finding rule for each, my pick, and the three questions.</p>
<div class="diag">{DIAGNOSIS}<small>The diagnosis of round two’s room · what ROOM+ adds is exactly that, and nothing else</small></div>
<div class="three">{figs}</div>
</body></html>'''
    with open(os.path.join(HERE, 'contact.html'), 'w', encoding='utf-8') as f:
        f.write(html)


if __name__ == '__main__':
    made = [room_plus(), wall(), whole()]
    contact()
    print('hud/2026-11-08-3: ' + ' '.join(made) + ' contact')
