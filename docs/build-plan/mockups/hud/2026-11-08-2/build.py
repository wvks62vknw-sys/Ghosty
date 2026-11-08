"""THE HUD MOCKS, ROUND TWO (BRIEF-HUD-MOCKS-2): motion he can watch, Home that knows where he is, the looks as a gallery.

His words this round is cut to (OWNER-ISSUES 157): "an actual cool cinematic ... designed for a genius playboy billionaire
philanthropist ... straight out of a high production hollywood movie"; "it should know when im home, when im out etc and it changes
its design based off that"; "ENTIRELY different looks for the theme ... prebuilt apart from the colours"; "genuine billions poured
into it and high level of production". Round one (../2026-11-08) is the base: its facts, marks, room and orb are imported, not
redrawn; what is raised is said in the README.

Writes beside this file: boot.html (the film: film.js, a pure render(t)), home-evening / home-town / home-way (the three places:
home.js, ambient), theme.html (the gallery), ink-home.html (ONE INK's Home, a second HUD at the same quality), contact.html
(the sheet, after the frames exist). Standard library only. From the repo root:
    python3 -I -B docs/build-plan/mockups/hud/2026-11-08-2/build.py
    node docs/build-plan/mockups/hud/2026-11-08-2/render.mjs stills | film | home | live | contact
"""
import importlib.util
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
R1DIR = os.path.normpath(os.path.join(HERE, '..', '2026-11-08'))
_spec = importlib.util.spec_from_file_location('r1', os.path.join(R1DIR, 'build.py'))
r1 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(r1)

TOKENS = r1.TOKENS
FONTS = r1.FONTS
DAY, PLACE, NAME, FEEDS, BOOK = r1.DAY, r1.PLACE, r1.NAME, r1.FEEDS, r1.BOOK
segs, tag, index, key, ret, callout, lead, plan, ask, box = r1.segs, r1.tag, r1.index, r1.key, r1.ret, r1.callout, r1.lead, r1.plan, r1.ask, r1.box
CLOCK, STAR, MIC, BACK, SPEAK = r1.CLOCK, r1.STAR, r1.MIC, r1.BACK, r1.SPEAK
HOME, ROOM, WINDOW, CAM_HOME, ORB_PX, ORB_SIZE, COLOURS = r1.HOME, r1.ROOM, r1.WINDOW, r1.CAM_HOME, r1.ORB_PX, r1.ORB_SIZE, r1.COLOURS


def stamp(time, looking, place=PLACE, watching=3):
    return segs([DAY, time, place, f'Watching {watching} feeds', (f'Looking at {looking}', 'on')], cls='g-stamp')


def where(words):
    """How the phone knows where he is, said on the screen (157: decided on the phone, said, off by one switch)."""
    return segs(words, cls='g-truth where')


# ------------------------------------------------------------------------------------------------ the page
def page(name, title, time, inner, cfg, script, theme='reactor', ground='graphite', world='scan', body_cls='', screen_cls='', extra_css=''):
    head = ''.join(f'<link rel="stylesheet" href="{c}">' for c in (FONTS, TOKENS, '../2026-11-08/hud.css', 'hud2.css'))
    html = f'''<!doctype html>
<html lang="en-GB" data-theme="{theme}" data-ground="{ground}" data-world="{world}" data-night="graphite">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=440, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
{head}{extra_css}
</head>
<body class="{body_cls}">
<div class="screen {screen_cls}" id="screen"><canvas class="gl"></canvas><div class="winlight"></div><div class="roomlight"></div>{r1.STATUS_BAR.format(time=time)}{inner}{r1.HOME_INDICATOR}</div>
<script type="application/json" id="cfg">{json.dumps(cfg)}</script>
<script type="module" src="{script}"></script>
</body>
</html>
'''
    with open(os.path.join(HERE, name + '.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    return name


def thing(c, h, kind=0, lit=0, **kw):
    return dict(type='thing', c=c, h=h, kind=kind, lit=lit, **kw)


def room_parts(things, lit_names=(), skyline=True):
    parts = [dict(type='room', hw=ROOM['room'][0], hgt=ROOM['room'][1], zb=ROOM['room'][2], zf=ROOM['room'][3], win=ROOM['win'])]
    for n, (c, k, h, _l) in things.items():
        parts.append(thing(c, h, k, 1 if n in lit_names else 0))
    if skyline:
        parts.append(dict(type='skyline', lit=0.3, accentLit=0.1, night=True))
    return parts


# the hour's light: how the window lights the points (strength and colour), the daylight from above, the far tint, the light the orb does not cast
LIGHT = {
    'evening': dict(tint=[1.0, 0.985, 0.96], tintFar=[0.82, 0.9, 1.0], ambient=0.62, sky=0.0, window=dict(at=[0, 1.5, -2.4], strength=0.22)),
    'town': dict(tint=[0.95, 0.975, 1.0], tintFar=[0.95, 0.975, 1.0], ambient=0.55, sky=0.95, window=None),
    'way': dict(tint=[0.9, 0.94, 1.0], tintFar=[0.72, 0.8, 0.95], ambient=0.6, sky=0.55, window=None),
}


def world(parts, cam, light, orb_at=ORB_PX, bounds=None, build_from='orb', build_r=4.6, scroll=0, orb_lit=1.0):
    return dict(parts=parts, camera=dict(pos=cam['pos'], tgt=cam['tgt'], fov=cam['fov']), light=light, orbAt=orb_at,
                bounds=bounds or ROOM['room'], buildFrom=build_from, buildR=build_r, scroll=scroll, orbLit=orb_lit)


# ------------------------------------------------------------------------------------------------ 1 · THE BOOT AS A FILM
# the cut, in ms from the first frame: one source for film.js, the shot list, the cue sheet and the strip on the contact sheet
CUT = dict(ground=0, scan=500, scanEnd=2500, edges=900, orb=2000, camLand=3900, stamp=3100, feeds=4000, recognise=4900, greeting=5400, now=5800, land=6500, home=7000, end=8200)
FEED_GAP = 220
# the shot list: (n, starts at, name, what happens, the sound: A the tone only · B the short score)
SHOTS = [
    (1, 0, 'The eye opens', 'The lit graphite, nothing else. One point of light in the middle of the dark, breathing; the room’s light breathes in round it. The camera is far and a little high, looking down into a room it cannot see yet.',
     'A · silence. B · a low pad fades in under the point of light, one note, felt more than heard.'),
    (2, 500, 'The scan', 'A sphere of light grows out of the eye and samples the room as it passes: the desk first, then the shelf and the calendar, the back wall, the ceiling last. The front is a step brighter than what it leaves settled behind it. The camera begins a slow dolly in.',
     'A · silence. B · the pad rises a fifth as the front crosses the desk; a fine granular tick under it, the sound of points landing, thinning as the room fills.'),
    (3, 1100, 'The edges, the things', 'The hairline edges draw themselves a step behind the front. Each thing locks into its reticle the moment the front reaches it, with its tag: the Brief, the book, the Gym, Courses, the Library, the Lens, the Agenda, God’s eye. The city outside the window is still dark.',
     'A · silence. B · one soft tick per thing found, each a semitone lower than the last.'),
    (4, 2000, 'The orb forms', 'His library’s points drift out of the eye and gather into the constellation, each leaving a short trail; the sweep passes down through them; the sphere resolves from the inside out, the meridians catch the light one after another, the rim closes last. The camera lands on Home’s own view at 3.9 s.',
     'A · silence. B · the pad opens to a chord as the sphere resolves; the chord holds.'),
    (5, 3100, 'The stamp', 'The Machine’s point of view types itself at the top with the block cursor: SUN 8 NOV · 07:12 · BIRMINGHAM · CHECKING FEEDS. Ten milliseconds a character.',
     'A · silence. B · a faint typing tick under the cursor, dry, no echo.'),
    (6, 4000, 'The feeds answer', 'One truth line each, a beat apart: FLOOD · ENVIRONMENT AGENCY · NOTHING ACTIVE; WEATHER · MET OFFICE · NO WARNINGS; CRIME · POLICE.UK · SEP · 14 WITHIN A MILE. Birmingham lights up outside the window as they answer; the stamp becomes WATCHING 3 FEEDS.',
     'A · silence. B · three soft ticks, rising, one per feed; under the third the chord warms a shade.'),
    (7, 4900, 'The recognition', 'The box snaps onto the orb from 14 px wider, closing over 160 ms in his colour. A wave of his colour passes once through every point of the room from the eye outward and is gone in 700 ms; the screen lifts 7 % for one frame. G H O S T Y arrives under the box letter by letter. The feeds’ lines leave; the stamp holds their truth.',
     'A · one short tone, the app’s own, on the lock. B · the tone; the chord stops dead with it; the wave is a soft noise sweep that follows it out, 700 ms.'),
    (8, 5400, 'The greeting, then Now', 'Good morning, Boss. rises under the stamp where Home’s first line lives; the orb opens half way and keeps time with the words. Then the search: the box checks the shelf, the desk, and locks on this morning’s Brief; the leader draws itself to the callout; the callout rises.',
     'A · the greeting spoken in his voice, now if the phone allows sound, else on the first tap. B · the same; nothing under the voice; a tick on the lock.'),
    (9, 6500, 'The landing', 'The box and the name go; the stamp gains LOOKING AT HOME; the house and the ask line slide up a beat later; the second line arrives. Home is usable at 7.0 s and breathes: the camera drifts six millimetres, the points breathe, one is re-read now and then, the city flickers.',
     'A · silence. B · silence: the room is quiet; the voice has the floor.'),
]


def boot():
    m = r1.MOMENTS['morning']
    top = (f'<div class="top"><p class="g-stamp"></p><p class="say" style="opacity:0">{m["say"]}</p><p class="say2" style="opacity:0">{m["say2"]}</p><div class="feeds"></div></div>')
    marks = ''.join(r1.home_marks('none', boot=True))
    now_ret = ret('r-now', HOME['brief'], tag('Brief', glyph=CLOCK, on=True), cls='on full', pad=4, label='The Brief')
    co = callout('c-now', '24 648', 'tl', *m['co'][:3]) + lead('c-now', 'r-brief')
    locks = ('<span class="g-lock" id="orblock" hidden data-state="attend"><span class="g-ret-frame"></span></span>'
             '<span class="g-lock" id="search" hidden data-state="watch"><span class="g-ret-frame"></span></span>'
             '<p class="g-truth" id="searchline" style="position:absolute;z-index:5;left:24px;top:168px;opacity:0"></p>'
             '<p class="name" style="opacity:0"></p><p class="skip" style="opacity:0">Tap to skip</p><div class="flash"></div>')
    hud = f'<div class="hud" style="opacity:0">{plan("home")}{ask()}</div>'
    inner = top + marks + now_ret + co + r1.orb_el() + locks + hud
    cam_from = dict(pos=[0.7, 2.0, 2.6], tgt=[0.08, 1.25, -1.6], fov=56)
    cfg = dict(cut=CUT, feedGap=FEED_GAP, camFrom=cam_from,
               world=world(room_parts(HOME), CAM_HOME, LIGHT['evening'] | dict(tint=[1, 1, 1])), orb=dict(size=ORB_SIZE), feeds=[list(f) for f in FEEDS],
               now=dict(day=DAY, time='07:12', place=PLACE),
               search=[['#r-shelf', CUT['now'], 'watch'], ['#r-gym', CUT['now'] + 160, 'watch'], ['#r-brief', CUT['now'] + 320, 'attend']])
    return page('boot', 'The boot · the film', '07:12', inner, cfg, 'film.js', screen_cls='film morning')


# ------------------------------------------------------------------------------------------------ 2 · HOME, RAISED: THREE PLACES
# the city (the Stage of round two, W1's): the walk from home to New Street, then the train towards Coventry, in model units
def mu(p):
    return [round((p[0] - 190) / 60, 3), round((p[1] - 232) / 60, 3)]


WALK = [(92, 334), (92, 298), (142, 298), (142, 262), (190, 262), (190, 240)]
TRAIN = [(190, 232), (228, 247), (262, 261), (294, 279), (322, 300)]
ROUTE = [mu(p) for p in WALK + TRAIN]
ME_OUT = [-0.8, 1.1]                   # on the walk, a corner before the station
TRAIN_AT = [1.47, 0.633, 0.87, 0.49]   # past the second bend of the line, and the line's direction there


def fract(x):
    return x - math.floor(x)


def hash12(x, y):
    px, py, pz = fract(x * 0.1031), fract(y * 0.1030), fract(x * 0.0973)
    d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33)
    px, py, pz = px + d, py + d, pz + d
    return fract((px + py) * pz)


def bH(i, j):
    """A block's height, as scene.js builds it (W1's bH), so a reticle can sit on a building."""
    cx, cz = (i + 0.5) * 0.2, (j + 0.5) * 0.2
    nr = math.hypot(cx, cz)
    h = 0.03 + 0.1 * hash12(i, j) ** 3 + 0.62 * math.exp(-nr * nr * 0.35) * hash12(i + 7, j + 7) ** 4 + (0.05 if hash12(i + 2, j + 2) > 0.8 else 0)
    if abs(cx) < 0.5 and abs(cz) < 0.14:
        h = 0.07
    return h


def block(i, j):
    h = bH(i, j)
    return ([(i + 0.5) * 0.2, h / 2, (j + 0.5) * 0.2], 0, [0.078, h / 2, 0.078], 0)


CITY_THINGS = {
    'station': ([ROUTE[5][0], 0.07, ROUTE[5][1]], 0, [0.3, 0.07, 0.14], 0),
    'me': ([ME_OUT[0], 0.05, ME_OUT[1]], 0, [0.12, 0.05, 0.12], 0),
    'dentist': block(-6, 0),
    'shop': block(-7, 4),
    'home': ([ROUTE[0][0], 0.05, ROUTE[0][1]], 0, [0.12, 0.05, 0.12], 0),
    'coventry': ([ROUTE[10][0], 0.05, ROUTE[10][1]], 0, [0.12, 0.05, 0.12], 0),
    'train': ([TRAIN_AT[0], 0.05, TRAIN_AT[1]], 0, [0.08, 0.05, 0.08], 0),
}
CAM_OUT = dict(pos=[1.0, 4.4, 4.2], tgt=[-0.7, 0.0, -0.3], fov=50)
CAM_WAY = dict(pos=[3.0, 5.5, 3.5], tgt=[1.2, 0.0, 1.1], fov=46)

PLACES = {
    'evening': dict(time='21:08', looking='Home', place=PLACE, say=f'Good evening, {NAME}.', say2='Nothing needs you tonight. Shall we read?', kick=('The house · 7 rooms', 'You are home'),
                    where=['At home', 'from your saved place', 'never sent'],
                    co=('Now · tonight’s book', BOOK, ['Page 42 of 112', 'yesterday', 'Tap to carry on'], 'r-alice')),
    'town': dict(time='12:40', looking='town', place='New Street', say=f'You’re in town, {NAME}.', say2='Dry until two. Shall I plan the way back?', kick=('The house · 7 rooms', 'You are out'),
                 where=['Out', 'from the phone’s own sense', 'never sent'],
                 co=('Now · the way home', 'The 13:42 from New Street', ['Platform 9', '11 min walk', 'Leave by 13:30', 'Rain at two'], 'r-station')),
    'way': dict(time='07:52', looking='the way', place='the 7:42', say=f'On time, {NAME}.', say2='Coventry at 08:21. Shall we read till then?', kick=('The house · 7 rooms', 'You are on the way'),
                where=['On the way', '64 mph', 'this phone', 'never sent'],
                co=('Now · the 7:42', 'Coventry 08:21 · on time', ['29 min', 'The dentist at 09:15', 'Alice, page 42: tap to read'], 'r-coventry')),
}


def home_marks(place):
    H = HOME
    if place == 'evening':
        return [
            ret('r-win', WINDOW, tag('God’s eye', glyph=CLOCK), '41 aircraft · 188 buses', cls='r', pad=0, label='God’s eye'),
            ret('r-shelf', H['shelf'], tag('Library', glyph=CLOCK, count='4'), pad=0, label='Library'),
            ret('r-lens', H['lens'], tag('Lens', glyph=STAR), pad=3, label='Lens'),
            ret('r-agenda', H['agenda'], tag('Agenda', glyph=STAR), 'Dentist 09:15', cls='r', pad=2, label='Agenda'),
            ret('r-brief', H['brief'], tag('Brief', glyph=CLOCK), pad=4, label='Brief'),
            ret('r-alice', H['alice'], '', cls='on full', pad=5, label='Tonight’s book'),
            ret('r-gym', H['gym'], tag('Gym', glyph=STAR), pad=3, label='Gym'),
            ret('r-courses', H['courses'], tag('Courses', glyph=STAR), cls='r', pad=4, label='Courses'),
        ]
    if place == 'town':
        S = CITY_THINGS
        return [
            ret('r-station', S['station'], tag('New Street', glyph=CLOCK), '13:42 · on time', cls='on full r', pad=4, label='New Street'),
            ret('r-me', S['me'], tag('You'), '', pad=4, label='You'),
            ret('r-shop', S['shop'], tag('Kitchen', glyph=STAR, count='4 things'), '', pad=4, label='Kitchen'),
            ret('r-dentist', S['dentist'], tag('Agenda', glyph=STAR), 'Dentist · done', pad=4, label='Agenda'),
        ]
    S = CITY_THINGS
    return [
        ret('r-coventry', S['coventry'], tag('Coventry', glyph=CLOCK), '08:21 · on time', cls='on full r', pad=6, label='Coventry'),
        ret('r-station', S['station'], tag('New Street'), 'Left 07:42', pad=4, label='New Street'),
        ret('r-train', S['train'], tag('You', count='64 mph'), '', cls='below r', pad=6, label='You'),
    ]


def home(place):
    m = PLACES[place]
    top = f'<div class="top">{stamp(m["time"], m["looking"], place=m["place"])}{where(m["where"])}<p class="say">{m["say"]}</p><p class="say2">{m["say2"]}</p></div>'
    right = place == 'town'
    co = callout('c-now', '416 648' if right else '24 648', 'tr' if right else 'tl', *m['co'][:3]) + lead('c-now', m['co'][3])
    inner = top + ''.join(home_marks(place)) + co + r1.orb_el() + plan('home', kick=m['kick']) + ask()
    if place == 'evening':
        w = world(room_parts(HOME, ('alice',)), CAM_HOME, LIGHT['evening'])
    elif place == 'town':
        parts = [dict(type='map', route=ROUTE, me=ME_OUT)]
        w = world(parts, CAM_OUT, LIGHT['town'] | dict(fog=0.06), bounds=[3.8, 1, -3.8, 3.8], build_r=8)
    else:
        parts = [dict(type='map', route=ROUTE, train=TRAIN_AT)]
        w = world(parts, CAM_WAY, LIGHT['way'] | dict(fog=0.06), bounds=[3.8, 1, -3.8, 3.8], build_r=10)
    cfg = dict(world=w, orb=dict(size=ORB_SIZE, state='idle'))
    return page(f'home-{place}', f'Home · {place}', m['time'], inner, cfg, 'home.js', screen_cls=f'home {place}')


# ------------------------------------------------------------------------------------------------ 3 · THE THEME GALLERY
LOOKS = [
    ('scan', 'The Scan', 'The room, as I keep it', 'home-evening.png', 96, True),
    ('map', 'The Map', 'The field, from above', '../../directions-2/w2/home-440.png', 96, False),
    ('eye', 'The Eye', 'Attention is the material', '../../directions-2/w3/home-440.png', 96, False),
    ('orbit', 'Orbit', 'Mind is the way in', '../../directions/d1/home-440.png', 96, False),
    ('ink', 'One Ink', 'A printed page', 'ink-home.png', 96, False),
    ('grown', 'Grown Up', 'Today, with less on it', '../../directions/d3/home-440.png', 96, False),
    ('glass', 'Glass', 'Today’s look', '../../hero/mind/home.png', 96, False),
]


def theme():
    """The Theme page as a gallery (157): the seven looks, each a live-looking thumbnail of its Home; the colour row under the chosen one; nothing else."""
    top = f'<div class="top">{stamp("21:12", "the Theme")}<p class="title">Theme</p>{key("Settings", kind="ghost back", glyph=BACK, label="Back to Settings")}</div>'

    def tile(k, n, idea, png, crop, on):
        return (f'<button class="look{" on" if on else ""}" data-look="{k}" aria-label="{n}"><span class="thumb" style="background-image:url({png});background-position:0 -{crop * 0.2818:.1f}px"></span>'
                f'<span class="g-ret-frame" aria-hidden="true"></span><span class="cap">{tag(n, on=on)}<small>{"You’re in it" if on else idea}</small></span></button>')
    chosen, rest = [l for l in LOOKS if l[5]], [l for l in LOOKS if not l[5]]
    row1 = ''.join(tile(*l) for l in chosen + rest[:2])
    rows = ''.join(tile(*l) for l in rest[2:])
    sw = ''.join(f'<button class="sw{" on" if k == "reactor" else ""}" data-accent="{k}" aria-label="{n}"><i></i></button>' for k, n in COLOURS)
    colour = f'<div class="colour"><div class="kick">{tag("The colour", count="Reactor")}<span class="g-truth">12 · yours to change</span></div><div class="row">{sw}</div></div>'
    body = (f'<div class="sec">{tag("The look", count="The Scan")}<small>7 · each a whole HUD</small></div>'
            f'<div class="looks">{row1}</div>{colour}<div class="looks">{rows}</div>')
    inner = top + f'<div class="scrim"></div><div class="page gallery">{body}</div>' + plan('me') + ask('Say a look, or a colour')
    cfg = dict(world=world(room_parts(HOME, ('alice',)), CAM_HOME, LIGHT['evening'], orb_lit=0.6), orb=None)
    return page('theme', 'Theme', '21:12', inner, cfg, 'home.js', screen_cls='home evening')


# ------------------------------------------------------------------------------------------------ 3b · ONE INK'S HOME, A SECOND HUD
def ink_home():
    """ONE INK's Home at round-one quality (157: every theme a whole HUD, even the tabs): bone ink on warm black, a serif for my voice,
    rules instead of boxes, the orb drawn in ink, the rooms as a printed running foot."""
    m = PLACES['evening']
    masthead = f'<header class="mast">{segs([DAY, "21:08", PLACE, "Watching 3 feeds", ("Looking at Home", "on")], cls="g-stamp")}</header>'
    greet = f'<p class="say">{m["say"]}</p><p class="say2">{m["say2"]}</p>'
    orb = f'<div class="orbwrap"><div class="equator"></div><div class="orb" style="width:{ORB_SIZE}px;height:{ORB_SIZE}px"><canvas width="{ORB_SIZE * 2}" height="{ORB_SIZE * 2}"></canvas></div></div>'
    entry = (f'<section class="entry"><div class="kick"><span class="g-index on">01</span>{tag("Tonight", on=True)}<span class="g-truth">Reading</span></div>'
             f'<h2>{BOOK}</h2><p class="g-truth">Page 42 of 112 · yesterday</p>'
             f'<div class="keys">{key("Carry on reading", kind="fill")}{key("Listen", kind="ghost", glyph=SPEAK)}</div></section>')
    lists = (f'<section class="lists"><div class="l"><span class="g-truth">Recent</span>' + ''.join(f'<button>{n}</button>' for n in ['Library', 'God’s eye', 'Brief']) + '</div>'
             f'<div class="l"><span class="g-truth">Favourites</span>' + ''.join(f'<button>{n}</button>' for n in ['Lens', 'Agenda', 'Gym', 'Courses']) + '</div></section>')
    askline = f'<div class="inkask"><button class="field" aria-label="Ask or find anything">Ask or find anything</button><button class="speak" aria-label="Talk to me">Speak</button></div>'
    foot = ('<nav class="foot" aria-label="The house">' + ''.join(f'<button class="{"here" if n == "Home" else ""}" aria-label="{n}">{"<i class=\'eye\'></i>" if n == "Home" else n}</button>' for n in ['Home', 'See', 'Make', 'Learn', 'Plan', 'Life', 'Me']) + '</nav>')
    inner = f'<div class="ink">{masthead}{greet}{orb}{entry}{lists}{askline}{foot}</div>'
    cfg = dict(orb=dict(size=ORB_SIZE, state='idle'))
    extra = '<style>:root { --g-glow: 0; }</style>'
    return page('ink-home', 'Home · One Ink', '21:08', inner, cfg, 'ink.js', ground='warm', world='ink', screen_cls='inkscreen', extra_css=extra)


# ------------------------------------------------------------------------------------------------ 4 · THE CONTACT SHEET
def ms(v):
    return f'{v / 1000:.2f} s'.replace('.00 s', ' s') if v >= 1000 else f'{v} ms'


def contact():
    rows = ''
    # 1 · the boot as a film: the strip of the nine shots, with the cut as a bar and its ticks
    keys = [s[1] for s in SHOTS] + [CUT['end']]
    bar = '<div class="bar">' + ''.join(f'<i style="flex:{max(1, keys[i + 1] - keys[i])}"></i>' for i in range(len(SHOTS))) + '</div>'
    ticks = '<div class="ticks">' + ''.join(f'<u style="left:{t / CUT["end"] * 100:.1f}%">{ms(t)}</u>' for t in [0, 1000, 2000, 3000, 4000, 5000, 6000, 8000]) + f'<u style="left:{CUT["home"] / CUT["end"] * 100:.1f}%" class="on">HOME {ms(CUT["home"])}</u></div>'
    strip = ''.join(f'<figure class="shot"><img src="film/shot-{n:02d}.png" alt="{name}"><figcaption>{tag(f"Shot {n}", count=ms(at))}<p class="g-truth">{name}</p><p class="what">{what}</p></figcaption></figure>' for n, at, name, what, _s in SHOTS)
    rows += (f'<h2>1 · The boot as a film</h2><p class="lede">boot.mp4: {ms(CUT["home"])} to a usable Home, {ms(CUT["end"])} in all, 440 × 956 at 30 fps, skippable at any tap. Nine shots, each a still from the film a beat (180 ms) into the shot; the cue sheet is in the README.</p>{bar}{ticks}<div class="row strip">{strip}</div>')
    # 2 · home raised: the three places, and round one beside the new evening
    figs = [('../2026-11-08/home-evening', 'Round one · evening', 'The base: the raymarched room, one moment, the orb in the middle.'),
            ('home-evening', 'AT HOME · 21:08', 'The same room as points in real 3-D: the lamp’s warm light low on the left, the city cool through the window, the desk deeper, the book lit. At home from his saved place.'),
            ('home-town', 'OUT · 12:40 in town', 'Not a room: the city as the Machine keeps it (W1’s own Birmingham, now as points), from above in daylight; where he stands ringed, the walk to New Street dotted in his colour, the station locked; Now is the 13:42. Out, from the phone’s own sense of place.'),
            ('home-way', 'ON THE WAY · 07:52', 'The same city at dawn, the camera higher and turned to the line: New Street left behind, the train a lit point on the line with its trail, Coventry locked; Now is the journey. On the way, at 64 mph, from the phone alone.')]
    f = ''.join(f'<figure><img src="{png}.png" alt="{cap}"><figcaption>{tag(cap)}<p class="what">{what}</p></figcaption></figure>' for png, cap, what in figs)
    rows += f'<h2>2 · Home, raised, and three places</h2><p class="lede">home.mp4 is the evening Home alive for four seconds. Each place is decided on the phone (his saved places and its own sense of place), said on the screen in one line, never sent to the brain, and off by one switch.</p><div class="row">{f}</div>'
    # 3 · the gallery and the second HUD
    figs = [('theme', 'The Theme page as a gallery', 'Seven looks, each a live thumbnail of its own Home; the colour row under the chosen one; nothing else.'),
            ('home-evening', 'THE SCAN · Home', 'The room.'), ('ink-home', 'ONE INK · Home', 'A printed page: bone ink on warm black, a serif for my voice, rules instead of boxes, the orb in ink, the rooms as a running foot. The same facts, an entirely different HUD.')]
    f = ''.join(f'<figure><img src="{png}.png" alt="{cap}"><figcaption>{tag(cap)}<p class="what">{what}</p></figcaption></figure>' for png, cap, what in figs)
    rows += f'<h2>3 · The looks as a gallery, and two HUDs side by side</h2><p class="lede">A theme is a whole HUD, prebuilt (157); the only thing he changes is the colour.</p><div class="row">{f}</div>'
    html = f'''<!doctype html>
<html lang="en-GB" data-theme="reactor" data-ground="graphite" data-world="scan" data-night="graphite">
<head><meta charset="utf-8"><title>Ghosty · the HUD mocks, round two · contact</title>
<link rel="stylesheet" href="{FONTS}"><link rel="stylesheet" href="{TOKENS}"><link rel="stylesheet" href="../2026-11-08/hud.css"><link rel="stylesheet" href="hud2.css">
<style>body {{ width: 1230px; height: auto; }}</style></head>
<body class="sheet"><h1>The HUD mocks, round two: the boot as a film, Home that knows where he is, the looks as a gallery</h1>
<p class="lede">BRIEF-HUD-MOCKS-2, 8 Nov. The film and the clip are boot.mp4 and home.mp4 beside this sheet; every frame is 440 × 956 at 2× on the system’s tokens and marks; the room is the scan as points in real 3-D; the orb is the real hologram. The questions and the production rubric are in the README.</p>
{rows}
</body></html>'''
    with open(os.path.join(HERE, 'contact.html'), 'w', encoding='utf-8') as f:
        f.write(html)


if __name__ == '__main__':
    made = [boot(), home('evening'), home('town'), home('way'), theme(), ink_home()]
    contact()
    with open(os.path.join(HERE, 'cut.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(cut=CUT, shots=[dict(n=n, at=at, still=at + (0 if n in (1, 9) else 180), name=name) for n, at, name, *_r in SHOTS]), f)
    print('hud/2026-11-08-2: ' + ' '.join(made) + ' contact')
