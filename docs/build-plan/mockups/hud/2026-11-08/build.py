"""THE HUD MOCKS (BRIEF-HUD-MOCKS): W1 THE SCAN as a whole HUD at 440 × 956, pictures before code.

His words, quoted back before drawing: "with the mind i just meant the orb kinda thing in the middle" (131); "something that
hasn't been seen before" (136); "make it actually feel like that ... modern and clean not like AI slop" (137); "i don't like how
dark it looks ... very easily navigated ... nothing clunky or hard to read ... things in places where you'll never find them" (139);
"every theme as like a whole different hud as a whole like even the tabs are different" (155); "a mix of the last two" (the way
round), "longer, richer, the world assembling the scan building up and the feeds answering ... polished", "it should just know"
(156).

Writes the pages beside this file: Home by the hour (three moments), the way round (the house unfolded, the jump bar, the typed
word), the Learn room, Every screen, Settings and the Theme page cut to three choices, the Lens that just knows (four frames),
the boot (twelve frames), and the contact sheet. Every value on screen is a token of apps/web/src/design/tokens.css (loaded
first); the marks are the design system's (hud.css copies THE SYSTEM's rules); the room is W1's scan (scan.js, grown from
directions-2/w1/room.js); the orb is the real hologram (the boot's orb.js). Standard library only. Run from the repo root:
    python3 -I -B docs/build-plan/mockups/hud/2026-11-08/build.py
    node docs/build-plan/mockups/hud/2026-11-08/render.mjs all
    node docs/build-plan/mockups/hud/2026-11-08/render.mjs contact
"""
import base64
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
TOKENS = '../../../../../apps/web/src/design/tokens.css'
FONTS = '../../fonts.css'
GLJS = '../../directions-2/lib/gl.js'

# ------------------------------------------------------------------------------------------------ the facts on every screen
DAY = 'Sun 8 Nov'
PLACE = 'Birmingham'
NAME = 'Boss'
FEEDS = [('Flood', 'Environment Agency', 'Nothing active'), ('Weather', 'Met Office', 'No warnings'), ('Crime', 'police.uk', 'Sep · 14 within a mile')]
BOOK = 'Alice’s Adventures in Wonderland'

# ------------------------------------------------------------------------------------------------ glyphs (the app's own line glyphs)
ICON = lambda d, cls='g-glyph': f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{d}</svg>'  # noqa: E731
CLOCK = ICON('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>')
STAR = ICON('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/>')
MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>'
BACK = ICON('<path d="M15 5l-7 7 7 7"/>')
CHEV = '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>'
SPEAK = ICON('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9.5a3.5 3.5 0 010 5M17.5 7a7 7 0 010 10"/>')

STATUS_BAR = '''<div class="sb" aria-hidden="true"><span class="time">{time}</span><span class="island"></span><span class="right">
<svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
<svg viewBox="0 0 17 12" width="17" height="12"><path d="M8.5 2.2c2.5 0 4.8 1 6.5 2.6l1.2-1.3A11 11 0 008.5.4 11 11 0 00.8 3.5L2 4.8a9.3 9.3 0 016.5-2.6zM8.5 5.8c1.5 0 2.9.6 4 1.6l1.2-1.3a7.4 7.4 0 00-10.4 0l1.2 1.3c1.1-1 2.5-1.6 4-1.6zM8.5 9.2c.6 0 1.1.2 1.5.6L8.5 11.5 7 9.8c.4-.4.9-.6 1.5-.6z"/></svg>
<svg viewBox="0 0 28 13" width="28" height="13"><rect x=".5" y=".5" width="24" height="12" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".38"/><rect x="2" y="2" width="17.5" height="9" rx="2.2"/><path d="M26 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill-opacity=".45"/></svg>
</span></div>'''
HOME_INDICATOR = '<i class="hi" aria-hidden="true"></i>'


# ------------------------------------------------------------------------------------------------ the marks
def segs(parts, cls='g-truth', extra=''):
    """A truth line or a stamp line: whole segments, the dot at each segment's end (ui/machine.ts segments())."""
    out = []
    for i, p in enumerate(parts):
        text, tone = (p, '') if isinstance(p, str) else p
        sep = '<span class="g-sep">&nbsp;·</span>' if i < len(parts) - 1 else ''
        out.append(f'<span class="g-seg{" " + tone if tone else ""}">{text}{sep}</span>')
    return f'<p class="{cls}"{extra}>{" ".join(out)}</p>'


def stamp(time, looking, watching=3):
    """Its point of view (139, the first benchmark): the day · the time · his saved place · what it watches · what it looks at."""
    return segs([DAY, time, PLACE, f'Watching {watching} feeds', (f'Looking at {looking}', 'on')], cls='g-stamp')


def tag(text, on=False, count='', glyph='', warn=False):
    c = ' on' if on else (' warn' if warn else '')
    n = f'<span class="g-count">· {count}</span>' if count else ''
    return f'<span class="g-tag{c}">{glyph}<span>{text}</span>{n}</span>'


def index(n, on=False):
    return f'<span class="g-index{" on" if on else ""}">{n:02d}</span>'


def key(word, kind='', glyph='', label=''):
    return f'<button class="g-key{" " + kind if kind else ""}" aria-label="{label or word}">{glyph}{f"<span>{word}</span>" if word else ""}</button>'


def box(th):
    c, _k, h, _l = th
    return ' '.join(f'{v:.3f}' for v in [c[0] - h[0], c[1] - h[1], c[2] - h[2], c[0] + h[0], c[1] + h[1], c[2] + h[2]])


def ret(rid, th, tg='', truth='', cls='', pad=4, ms=None, label=''):
    """A thing in the room as the Machine marks it: a reticle he can press (placed by data-box), its tag above, one true line below."""
    t = f'<p class="g-truth">{truth}</p>' if truth else ''
    m = f' data-ms="{ms}"' if ms is not None else ''
    return (f'<button class="ret {cls}" id="{rid}" data-box="{box(th)}" data-pad="{pad}" data-min="44" data-name="{label or rid}" aria-label="{label or rid}"{m}>'
            f'<span class="g-ret-frame" aria-hidden="true"></span>{tg}{t}</button>')


def callout(cid, px, align, tg, big, truth, lit=True, label=''):
    """NOW, the thing of the hour: its tag, its name and one true line at the screen's edge; a leader runs to the thing in the room."""
    cls = 'co r' if 'r' in align else 'co'
    return (f'<button class="{cls}" id="{cid}" data-px="{px}" data-align="{align}" aria-label="{label or big}">{tag(tg, on=lit)}'
            f'<span class="big">{big}</span>{segs(truth)}</button>')


def lead(a, b, lit=True):
    return f'<svg class="lead{" on" if lit else ""}" data-lead="#{a}|#{b}" aria-hidden="true"></svg>'


ROOMS = [('home', 'Home', 'w2'), ('see', 'See', ''), ('make', 'Make', ''), ('learn', 'Learn', 'w2'), ('plan', 'Plan', ''), ('life', 'Life', ''), ('me', 'Me', '')]


def plan(here='home', kick=None):
    """The tab bar of this HUD: the plan of the house, the room he is in lit (155: the tabs drawn the world's way)."""
    btns = ''.join(f'<button class="{c}{" here" if k == here else ""}" aria-label="{n}">{n}{"<i></i>" if k == here else ""}</button>' for k, n, c in ROOMS)
    where = 'You are home' if here == 'home' else f'You are in {here.title()}'
    k1, k2 = kick or ('The house · 7 rooms', where)
    return f'<nav class="plan" aria-label="The house"><div class="kick"><span class="g-truth">{k1}</span><span class="g-truth">{k2}</span></div><div class="rooms">{btns}</div></nav>'


def ask(text='Ask, or say where to go', typed=False, up=False):
    caret = '<span class="caret"></span>' if typed else ''
    return f'<div class="ask{" up" if up else ""}"><button class="field{" typed" if typed else ""}" aria-label="Ask, or say where to go">{text}{caret}</button><button class="mic" aria-label="Talk to me">{MIC}</button></div>'


# ------------------------------------------------------------------------------------------------ the rooms (W1's, metres)
ROOM = dict(room=[1.02, 2.38, -2.4, 1.5], win=[-0.5, 1.0, 0.5, 2.05])
HOME = {
    'desk': ([0.0, 0.73, -1.58], 0, [0.85, 0.02, 0.28], 0), 'legl': ([-0.8, 0.355, -1.58], 0, [0.02, 0.355, 0.24], 0), 'legr': ([0.8, 0.355, -1.58], 0, [0.02, 0.355, 0.24], 0),
    'brief': ([-0.62, 0.754, -1.62], 2, [0.12, 0.004, 0.085], 0), 'alice': ([-0.18, 0.758, -1.5], 1, [0.2, 0.008, 0.135], 0),
    'gym': ([0.27, 0.76, -1.6], 5, [0.13, 0.012, 0.13], 0), 'courses': ([0.66, 0.757, -1.58], 3, [0.1, 0.007, 0.13], 0),
    'shelf': ([-0.78, 1.0, -2.24], 7, [0.16, 1.0, 0.15], 0), 'lens': ([-0.78, 1.47, -2.12], 0, [0.07, 0.045, 0.04], 0), 'agenda': ([0.8, 1.5, -2.385], 6, [0.17, 0.24, 0.012], 0),
}
WINDOW = ([0, 1.525, -2.4], 0, [0.5, 0.525, 0.0], 0)
LEARN = {
    'shelf': ([-0.74, 1.0, -2.24], 7, [0.24, 1.0, 0.15], 1), 'arcade': ([0.74, 0.85, -2.14], 8, [0.22, 0.85, 0.22], 0),
    'desk': ([0.02, 0.73, -1.72], 0, [0.46, 0.02, 0.3], 0), 'legl': ([-0.4, 0.355, -1.72], 0, [0.02, 0.355, 0.26], 0), 'legr': ([0.44, 0.355, -1.72], 0, [0.02, 0.355, 0.26], 0),
    'courses': ([-0.16, 0.757, -1.62], 3, [0.1, 0.007, 0.13], 1), 'school': ([0.2, 0.78, -1.82], 2, [0.1, 0.03, 0.13], 0), 'learning': ([0.3, 0.755, -1.55], 2, [0.06, 0.012, 0.04], 0),
    'gtop': ([-0.6, 0.55, -0.92], 0, [0.2, 0.02, 0.2], 0), 'gleg': ([-0.6, 0.27, -0.92], 0, [0.03, 0.27, 0.03], 0), 'gym': ([-0.6, 0.582, -0.92], 5, [0.15, 0.012, 0.15], 1),
    'coach': ([0.6, 0.78, -1.0], 9, [0.3, 0.02, 0.09], 0), 'cleg': ([0.6, 0.39, -1.0], 0, [0.02, 0.39, 0.02], 0),
}
CAM_HOME = dict(pos=[0.0, 1.42, 0.95], tgt=[0.0, 1.2, -1.6], fov=72)
CAM_LEARN = dict(pos=[0.0, 1.7, 4.6], tgt=[0.0, -0.15, -1.5], fov=40)
ORB_PX = [220, 400, 2.2, 82]          # the orb in the middle (131): where, how deep, its radius in px
ORB_SIZE = round(2 * ORB_PX[3] / (0.9 * 0.74))   # the hologram's canvas: the sphere fills 0.9 × 0.74 of its half side
AMBIENT = 0.6                          # not so dark (139): light the orb does not cast


def lit(things, *names):
    out = dict(things)
    for n in names:
        c, k, h, _l = out[n]
        out[n] = (c, k, h, 1)
    return out


def scene(mode, cam, things=None, orb_lit=1.0, orb_at=None, image=None, image_y=None, room=ROOM, clip=None, fade=1.0, extra=None):
    things = things or {}
    lst = list(things.values())
    bc = [[*t[0], t[1]] for t in lst] + [[0, -9, 0, 0]] * (20 - len(lst))
    bh = [[*t[2], t[3]] for t in lst] + [[0, 0, 0, 0]] * (20 - len(lst))
    u = dict(uMode=mode, uOrb=[0, -9, 0, 0.01], uOrbLit=orb_lit, uRoom=room['room'], uWin=room['win'], uBoxC=bc, uBoxH=bh, uN=len(lst),
             uRoute=[[0, 0]] * 11, uRouteOn=0.0, uFade=fade, uSweep=0.55, uClip=clip or [0, 0, 0, 0],
             uBuild=1.0, uOrbDraw=0.0, uAmbient=AMBIENT, uEdge=1.0, uWindow=1.0)
    u.update(extra or {})
    s = dict(camera=dict(pos=cam['pos'], tgt=cam['tgt'], fov=cam['fov'] * 3.14159265 / 180), uniforms=u)
    if orb_at:
        s['orbAt'] = orb_at
    if image:
        s['image'] = image
        if image_y is not None:
            s['imageY'] = image_y
    return s


def orb_el(px=ORB_PX, size=ORB_SIZE):
    return f'<div class="orb" data-px="{px[0]} {px[1]}" data-align="c" data-free="1" style="width:{size}px;height:{size}px"><canvas width="{size * 2}" height="{size * 2}"></canvas></div>'


# ------------------------------------------------------------------------------------------------ the page
def page(name, title, time, inner, cfg, theme='reactor', ground='graphite', body_cls='', script='hud.js', screen_cls=''):
    head = ''.join(f'<link rel="stylesheet" href="{c}">' for c in (FONTS, TOKENS, 'hud.css'))
    html = f'''<!doctype html>
<html lang="en-GB" data-theme="{theme}" data-ground="{ground}" data-world="scan" data-night="graphite">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=440, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
{head}
</head>
<body class="{body_cls}">
<div class="screen {screen_cls}" id="screen"><canvas class="gl"></canvas><div class="roomlight"></div>{STATUS_BAR.format(time=time)}{inner}{HOME_INDICATOR}</div>
<script type="application/json" id="cfg">{json.dumps(cfg)}</script>
<script src="{GLJS}"></script>
<script src="scan.js"></script>
<script type="module" src="{script}"></script>
</body>
</html>
'''
    with open(os.path.join(HERE, name + '.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    return name


# ------------------------------------------------------------------------------------------------ 1 · HOME BY THE HOUR
def home_marks(now, boot=False):
    """The things in the room as the Machine marks them: recents with the clock, favourites with the star; the thing of the hour lit."""
    H = HOME
    ms = (lambda i: 1200 + i * 140) if boot else (lambda i: None)
    return [
        ret('r-win', WINDOW, tag('God’s eye', glyph=CLOCK, on=now == 'journey'), '41 aircraft · 188 buses', cls='r' + (' on full' if now == 'journey' else ''), pad=0, ms=ms(1), label='God’s eye'),
        ret('r-shelf', H['shelf'], tag('Library', glyph=CLOCK, count='4'), pad=0, ms=ms(0), label='Library'),
        ret('r-lens', H['lens'], tag('Lens', glyph=STAR), pad=3, ms=ms(3), label='Lens'),
        ret('r-agenda', H['agenda'], tag('Agenda', glyph=STAR), 'Dentist 09:15', cls='r', pad=2, ms=ms(2), label='Agenda'),
        ret('r-brief', H['brief'], tag('Brief', glyph=CLOCK, on=now == 'brief'), cls=('on full' if now == 'brief' and not boot else ''), pad=4, ms=ms(4), label='Brief'),
        ret('r-alice', H['alice'], '', cls=('on full' if now == 'book' else 'faint'), pad=5, ms=ms(7) if now != 'book' else None, label='Tonight’s book'),
        ret('r-gym', H['gym'], tag('Gym', glyph=STAR), pad=3, ms=ms(5), label='Gym'),
        ret('r-courses', H['courses'], tag('Courses', glyph=STAR), cls='r', pad=4, ms=ms(6), label='Courses'),
    ]


MOMENTS = {
    'morning': dict(time='07:12', now='brief', say=f'Good morning, {NAME}.', say2='Two things today. Shall I read you the brief?',
                    co=('Now · the Brief', '9° and clear. The dentist at 09:15.', ['Leave by 08:40', '2 things today', 'Tap to hear it'], 'r-brief')),
    'commute': dict(time='07:16', now='journey', say=f'You’re on time, {NAME}.', say2='Leave in ten minutes; I’ll say when.',
                    co=('Now · the 7:42 from New Street', 'Platform 3 · on time', ['Leave by 07:26', 'Walk 14 min', 'Coventry 08:21'], 'r-win')),
    'evening': dict(time='21:08', now='book', say=f'Good evening, {NAME}.', say2='Nothing needs you tonight. Shall we read?',
                    co=('Now · tonight’s book', BOOK, ['Page 42 of 112', 'yesterday', 'Tap to carry on'], 'r-alice')),
}


def home(moment, ground='graphite', suffix=''):
    m = MOMENTS[moment]
    top = f'<div class="top">{stamp(m["time"], "Home")}<p class="say">{m["say"]}</p><p class="say2">{m["say2"]}</p></div>'
    co = callout('c-now', '24 648', 'tl', *m['co'][:3]) + lead('c-now', m['co'][3])
    inner = top + ''.join(home_marks(m['now'])) + co + orb_el() + plan('home') + ask()
    things = lit(HOME, 'alice') if moment == 'evening' else (lit(HOME, 'brief') if moment == 'morning' else HOME)
    cfg = dict(scene=scene(0, CAM_HOME, things, orb_at=ORB_PX), orb=dict(size=ORB_SIZE, state='idle'))
    return page(f'home-{moment}{suffix}', f'Home · {moment}', m['time'], inner, cfg, ground=ground, screen_cls='paper' if ground == 'paper' else '')


# ------------------------------------------------------------------------------------------------ 2 · THE WAY ROUND
# every screen in the house, by room, in its fixed order (shell/areadefs.ts AREAS and ME_ROWS; the names from shell/deckcopy.ts):
# (id, the name in the HUD, recent?, starred?, in the works?)
HOUSE = [
    ('home', 'Home', [('brief', 'The Brief', True, False, False)]),
    ('see', 'See', [('eye', 'God’s eye', True, False, False), ('lens', 'Lens', False, True, False)]),
    ('make', 'Make', [('studio', '3D studio', False, False, False), ('workshop', 'Workshop', False, False, False), ('reverse', 'Reverse', False, False, False), ('space', 'Space', False, False, False),
                      ('workbench', 'Workbench', False, False, False), ('convert', 'Convert', False, False, False), ('docs', 'Documents', False, False, False), ('house', 'House', False, False, False)]),
    ('learn', 'Learn', [('learn', 'Courses', False, True, False), ('arcade', 'Arcade', False, False, False), ('gym', 'Gym', False, True, False), ('school', 'School', False, False, False),
                        ('library', 'Library', True, False, False), ('learning', 'Learning', False, False, True), ('coach', 'Coach', False, False, True)]),
    ('plan', 'Plan', [('agenda', 'Agenda', False, True, False), ('markets', 'Markets', False, False, False), ('threats', 'Threats', False, False, False), ('radio', 'Radio', False, False, False)]),
    ('life', 'Life', [('money', 'Money', False, False, False), ('body', 'Body', False, False, False), ('kitchen', 'Kitchen', False, False, False), ('people', 'People', False, False, False),
                      ('work', 'Work', False, False, False), ('creative', 'Creative', False, False, False), ('outside', 'Outside', False, False, False), ('homeadmin', 'Household', False, False, False)]),
    ('me', 'Me', [('memory', 'Memory', False, False, False), ('settings', 'Settings', False, False, False), ('system', 'System', False, False, False), ('links', 'Links', False, False, False),
                  ('social', 'Social', False, False, False), ('origin', 'The origin', False, False, False), ('deck', 'Every screen', False, False, False)]),
]
# one true line for each thing, as its card reads tonight (shell/hubcards.ts CARDS; deckcopy's promise where a card has no reading)
LINES = {
    'brief': '9° and clear · the dentist at 09:15', 'eye': 'Watching Birmingham · 41 aircraft', 'lens': 'Ready', 'studio': 'Make 3-D models, then take them apart',
    'workshop': 'I change my own code when you ask', 'reverse': 'Paste a link: see how any app works', 'space': 'Plan a room to scale', 'workbench': 'First estimates, never certified',
    'convert': 'Files into other formats, on this phone', 'docs': 'Read, write, edit and translate', 'house': 'Your smart home, room by room', 'learn': 'Next: Lesson 3 · 14 cards due',
    'arcade': '16 free · last: Epic Pinball', 'gym': 'Rating 1,240 ↑35 · Sudoku Lv 6', 'school': 'Nursery · 7 papers', 'library': 'Reading Alice · page 42 of 112',
    'learning': '12 days · 9 skills', 'coach': '3 days · 5 passed', 'agenda': 'Dentist, tomorrow at 09:15', 'markets': 'Crypto, indices and currencies, live',
    'threats': 'Quakes, storms, space weather: worst first', 'radio': 'Stations from everywhere: “play some jazz”', 'money': 'Your spending, read from your statements',
    'body': 'Reps, runs, breathing and water', 'kitchen': 'Timers, the shopping list and meals', 'people': 'The people you told me about', 'work': 'Your to-do list and interview practice',
    'creative': 'Songs, posters, cards, comics and beats', 'outside': 'A safer walk, toilets, parking, the way', 'homeadmin': 'Bins, bills, meters and what is due',
    'memory': 'What I know about you, and where from', 'settings': 'The Scan · Reactor · the lit grey', 'system': 'Keys, models, storage and backups', 'links': 'Email, Spotify and your phone',
    'social': 'Your accounts; every post waits for you', 'origin': 'Who made me, and when', 'deck': 'All of Ghosty, by room',
}


def house(here='home'):
    """The house unfolded (one tap on THE HOUSE): every room with its things numbered, the room he is in lit: the one visible list."""
    def thing(n, t, hall=False):
        tid, name, rec, star, works = t
        g = (CLOCK if rec else '') + (STAR if star else '')
        w = '<i class="w" title="In the works"></i>' if works else ''
        return f'<button class="thing" aria-label="{name}">{index(n)}<span>{name}</span>{g}{w}</button>'
    rooms = ''
    for rid, rname, things in HOUSE:
        cls = 'room hall' if rid == 'home' else 'room'
        if rid == here:
            cls += ' here'
        body = ''.join(thing(i + 1, t) for i, t in enumerate(things))
        head = f'<div class="rn">{tag(rname)}<small>{len(things)}</small></div>'
        rooms += f'<section class="{cls}">{head}{body}</section>'
    return f'<div class="house" role="dialog" aria-label="The house">{rooms}</div>'


def keyboard(go=True):
    rows = [list('QWERTYUIOP'), list('ASDFGHJKL'), list('ZXCVBNM')]
    r = ''
    for i, row in enumerate(rows):
        ks = ''.join(f'<span class="k">{c}</span>' for c in row)
        if i == 2:
            ks = '<span class="k w">⇧</span>' + ks + '<span class="k w">⌫</span>'
        r += f'<div class="r">{ks}</div>'
    r += f'<div class="r"><span class="k w">123</span><span class="k sp">space</span><span class="k go{"" if go else " off"}">go</span></div>'
    return f'<div class="kb" aria-hidden="true">{r}</div>'


def nav(kind):
    m = MOMENTS['evening']
    top = f'<div class="top">{stamp(m["time"], "Home")}<p class="say">{m["say"]}</p><p class="say2">{m["say2"]}</p></div>'
    marks = ''.join(home_marks('book'))
    base = top + marks + orb_el()
    cfg = dict(scene=scene(0, CAM_HOME, lit(HOME, 'alice'), orb_at=ORB_PX), orb=dict(size=ORB_SIZE, state='idle'))
    if kind == 'house':
        inner = base + '<div class="scrim"></div>' + house('home') + ask('Ask, or say where to go')
        return page('nav-house', 'The way round · the house', m['time'], inner, cfg)
    if kind == 'jump':
        fav = ''.join(key(n, glyph=index(i + 1)) for i, n in enumerate(['Lens', 'Agenda', 'Gym', 'Courses']))
        rec = ''.join(key(n, glyph=index(i + 1)) for i, n in enumerate(['Library', 'God’s eye', 'Brief']))
        jump = (f'<div class="jump"><div class="kick">{tag("Favourites", count="4")}<span class="g-truth">Hold a thing to pin it</span></div><div class="row">{fav}</div>'
                f'<div class="kick">{tag("Recent", count="3")}<span class="g-truth">Newest first</span></div><div class="row">{rec}</div></div>')
        inner = base + '<div class="scrim"></div>' + jump + ask('Ask, or say where to go', typed=True, up=True) + keyboard(go=False)
        return page('nav-jump', 'The way round · the jump bar', m['time'], inner, cfg)
    # the typed word: the search checks each room in turn and says which, then locks on the one it found (ui/machine.ts search, recognise)
    found = ('<div class="found" id="found"><span class="g-index on">04</span><span class="n"><b>Radio</b><span>In Plan · stations from everywhere: “play some jazz”</span></span>'
             + key('Open', kind='fill') + '<span class="g-lock" data-state="attend" style="left:-6px;top:-6px;right:-6px;bottom:-6px"><span class="g-ret-frame"></span></span></div>')
    jump = (f'<div class="jump">{segs(["Checked Home", "See", "Make", "Learn", ("Found in Plan", "on")])}<div style="height:8px"></div>{found}'
            f'<div class="dim"><b>rad</b>Or ask me: “rad…” goes to me as a question</div></div>')
    inner = base + '<div class="scrim"></div>' + jump + ask('rad', typed=True, up=True) + keyboard(go=True)
    return page('nav-typed', 'The way round · the typed word', m['time'], inner, cfg)


# ------------------------------------------------------------------------------------------------ 3 · THE LEARN ROOM AND EVERY SCREEN
def learn():
    L = LEARN
    top = f'<div class="top">{stamp("21:11", "Learn")}<p class="title">Learn</p><p class="say2">I’m in Nursery at school, and rated 1,240 at Chess.</p></div>'
    vis = dict(L, shelf=([-0.74, 0.72, -2.24], 7, [0.24, 0.26, 0.15], 1), arcade=([0.74, 0.74, -2.14], 8, [0.22, 0.28, 0.22], 0))
    nums = [('shelf', 5, True), ('gym', 3, True), ('courses', 1, True), ('school', 4, False), ('arcade', 2, False), ('learning', 6, False), ('coach', 7, False)]
    marks = ''.join(f'<div class="ret{" on" if on else ""}" id="r-{k}" data-box="{box(vis[k])}" data-pad="3" data-min="28"><span class="g-ret-frame"></span>'
                    f'<span class="g-tag{" on" if on else ""}" style="left:auto;right:-2px;bottom:auto;top:-2px;padding:1px 4px">{n:02d}</span></div>' for k, n, on in nums)

    def row(n, name, flag, title, reads):
        r = ''.join(f'<span class="rd"><span class="l">{l}</span><span class="v">{v}{f"<small>{u}</small>" if u else ""}</span></span>' for l, v, u in reads)
        return f'<button class="inv-row" aria-label="{name}">{index(n, on=True)}<span class="body">{tag(name, on=True, glyph=flag)}<span class="ttl">{title}</span></span><span class="reads">{r}</span></button>'

    def mini(n, name, line, works=False):
        w = '<span class="works">In the works</span>' if works else ''
        return f'<button class="inv-mini" aria-label="{name}">{index(n)}<span class="body">{tag(name)}<span class="g-truth">{line}</span>{w}</span></button>'
    inv = (f'<section class="inv" style="top:356px"><div class="kick">{tag("At hand", count="3")}<span class="g-truth">Recent and starred</span></div>'
           + row(5, 'Library', CLOCK, 'All I have read', [('Reading', 'Alice', ''), ('Page', '42/112', '')])
           + row(3, 'Gym', STAR, 'I teach myself', [('Rating', '1,240', '↑35'), ('Now', 'Sudoku Lv 6', '')])
           + row(1, 'Courses', STAR, 'Learn anything', [('Next', 'Lesson 3', ''), ('Cards due', '14', '')])
           + f'<div class="kick" style="margin-top:8px">{tag("The rest", count="4")}<span class="g-truth">Say a number: “open two”</span></div><div class="inv-grid">'
           + mini(2, 'Arcade', '16 free · last: Epic Pinball') + mini(4, 'School', 'Nursery · 7 papers')
           + mini(6, 'Learning', '12 days · 9 skills', works=True) + mini(7, 'Coach', '3 days · 5 passed', works=True)
           + '</div></section>')
    cfg = dict(scene=scene(2, CAM_LEARN, L, orb_at=[352, 236, 2.4, 14], room=dict(room=[1.02, 2.38, -2.4, 1.5], win=[0, 0, 0, 0]), clip=[0, 184, 440, 346]), orb=dict(size=round(28 / (0.9 * 0.74)), state='idle'))
    inner = top + marks + orb_el([352, 236], round(28 / (0.9 * 0.74))) + inv + plan('learn') + ask('Find anything in Learn')
    return page('learn', 'The Learn room', '21:11', inner, cfg)


def deck():
    """Every screen (the deck) in the world: the Machine's inventory of the whole house, favourites and recents first, then by room."""
    m = MOMENTS['evening']
    top = f'<div class="top">{stamp(m["time"], "Every screen")}<p class="title">Every screen</p>{key("Me", kind="ghost back", glyph=BACK, label="Back to Me")}</div>'
    rows = ''

    def row(n, name, line, on=False, g='', works=False, st=''):
        s = f'<span class="st{" on" if on else ""}">{st}</span>' if st else '<span></span>'
        w = ' <span class="w" style="color:var(--g-amber);font:var(--g-t-fine);letter-spacing:var(--g-tr-tag);text-transform:uppercase">In the works</span>' if works else ''
        return f'<button class="row{" now" if on else ""}" aria-label="{name}">{index(n, on)}<span class="n"><b>{name}{w}</b><span>{line}</span></span>{s}{CHEV}</button>'
    rows += f'<div class="sec">{tag("Favourites", count="4")}<small>Hold a thing to pin it</small></div>'
    for i, tid in enumerate(['lens', 'agenda', 'gym', 'learn']):
        nm = next(n for _, _, th in HOUSE for (t, n, *_r) in th if t == tid)
        rows += row(i + 1, nm, LINES[tid], g=STAR)
    rows += f'<div class="sec">{tag("Recent", count="3")}<small>Newest first</small></div>'
    for i, tid in enumerate(['library', 'eye', 'brief']):
        nm = next(n for _, _, th in HOUSE for (t, n, *_r) in th if t == tid)
        rows += row(i + 1, nm, LINES[tid], g=CLOCK)
    for rid, rname, things in HOUSE:
        rows += f'<div class="sec">{tag(rname, count=str(len(things)))}<small>{"The hall" if rid == "home" else "A room"}</small></div>'
        for i, (tid, nm, rec, star, works) in enumerate(things):
            rows += row(i + 1, nm, LINES[tid], works=works)
    inner = top + f'<div class="scrim"></div><div class="page">{rows}</div>' + plan('me') + ask('A number, a word, or a question')
    cfg = dict(scene=scene(0, CAM_HOME, HOME, orb_lit=0.6), orb=None)
    return page('deck', 'Every screen', m['time'], inner, cfg)


# ------------------------------------------------------------------------------------------------ 4 · SETTINGS AND THE THEME PAGE
def settings():
    top = f'<div class="top">{stamp("21:12", "Settings")}<p class="title">Settings</p>{key("Me", kind="ghost back", glyph=BACK, label="Back to Me")}</div>'
    S = [
        ('The look', [('Theme', 'The HUD, the colour, the ground', 'The Scan · Reactor', True), ('Reading', 'How a book is shown and who reads it', 'My own voice', False)]),
        ('You', [('Name & units', 'What I call you, how I measure', NAME, False), ('Voice & home', 'My voice, my manner, your saved place', PLACE, False), ('My voice', 'The voice I know as yours', 'Known', False), ('People I’ve introduced', 'Faces you told me by name', '2', False)]),
        ('The brain', [('Offline brain', 'Answers on this phone with no signal', 'Ready', False)]),
        ('Ghosty', [('System', 'Keys, models, storage and backups', '', False), ('Links', 'Email, Spotify and your phone', '3 linked', False)]),
        ('About', [('About', 'This build', 'c01fcc0', False), ('Privacy', 'What leaves this phone, and what never does', 'Yours only', False), ('Help', 'Tips', '', False)]),
    ]
    rows = ''
    n = 0
    for sec, items in S:
        rows += f'<div class="sec">{tag(sec)}<small>{len(items)}</small></div>'
        for name, line, st, on in items:
            n += 1
            rows += f'<button class="row" aria-label="{name}">{index(n)}<span class="n"><b>{name}</b><span>{line}</span></span><span class="st{" on" if on else ""}">{st}</span>{CHEV}</button>'
    inner = top + f'<div class="scrim"></div><div class="page">{rows}</div>' + plan('me') + ask('Find a setting')
    cfg = dict(scene=scene(0, CAM_HOME, HOME, orb_lit=0.6), orb=None)
    return page('settings', 'Settings', '21:12', inner, cfg)


COLOURS = [('reactor', 'Reactor'), ('graphite', 'Graphite'), ('ember', 'Ember'), ('gold', 'Gold'), ('crimson', 'Crimson'), ('violet', 'Violet'),
           ('emerald', 'Emerald'), ('ice', 'Ice'), ('rose', 'Rose'), ('lime', 'Lime'), ('sunset', 'Sunset'), ('mono', 'Mono')]


def theme():
    """The Theme page cut to three choices (155): the HUD, the colour, the ground. Nothing else on it."""
    top = f'<div class="top">{stamp("21:12", "the Theme")}<p class="title">Theme</p>{key("Settings", kind="ghost back", glyph=BACK, label="Back to Settings")}</div>'
    huds = [('scan', 'The Scan', 'You’re in it', True), ('map', 'The Map', 'Coming', False), ('eye', 'The Eye', 'Coming', False), ('ink', 'One Ink', 'Coming', False), ('glass', 'Glass', 'Today’s look', False)]
    tiles = ''.join(f'<button class="tile{" on" if on else ""}" aria-label="{n}"><span class="pv {k}"></span><b>{n}</b><small>{s}</small></button>' for k, n, s, on in huds)
    sw = ''.join(f'<button class="sw{" on" if k == "reactor" else ""}" data-accent="{k}" aria-label="{n}"><i></i><b>{n}</b></button>' for k, n in COLOURS)
    grounds = [('black', 'Black', 'Nothing lit but what I’m looking at', False), ('graphite', 'The lit grey', 'Graphite, with the scan’s light in it', True), ('paper', 'Paper', 'For reading in daylight', False)]
    gr = ''.join(f'<button class="gr{" on" if on else ""}" data-ground="{k}" data-accent="reactor" aria-label="{n}"><i></i><b>{n}</b><small>{s}</small></button>' for k, n, s, on in grounds)
    body = (f'<div class="sec">{tag("The HUD", count="The Scan")}<small>1 of 5</small></div><div class="tiles">{tiles}</div>'
            f'<div class="sec">{tag("The colour", count="Reactor")}<small>12</small></div><div class="swatches">{sw}</div>'
            f'<div class="sec">{tag("The ground", count="the lit grey")}<small>3</small></div><div class="grounds">{gr}</div>')
    inner = top + f'<div class="scrim"></div><div class="page theme">{body}</div>' + plan('me') + ask('Say a colour, or a world')
    cfg = dict(scene=scene(0, CAM_HOME, HOME, orb_lit=0.6), orb=None)
    return page('theme', 'Theme', '21:12', inner, cfg)


# ------------------------------------------------------------------------------------------------ 5 · THE LENS THAT JUST KNOWS
def svg_data(svg):
    s = re.sub(r'^<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', svg, count=1)
    return 'data:image/svg+xml;base64,' + base64.b64encode(s.encode('utf-8')).decode('ascii')


LETTER_LINES = ['Your bins are changing', 'From Monday 9 November your general waste', 'bin moves to Thursdays. Recycling stays on', 'Mondays. Garden waste pauses for the winter',
                'and starts again in March.', '', 'Put your bins out by 7am on collection day.', 'Nothing else changes for your street.']


def lens_scene(kind):
    """What the camera sees, drawn as a picture the shader quietens to the Machine's grey. No real person: figures are shapes."""
    W, H = 440, 956
    if kind == 'letter':
        lines = ''.join(f'<text x="0" y="{i * 24}" font-family="DejaVu Serif, serif" font-size="{15 if i == 0 else 12.5}" font-weight="{700 if i == 0 else 400}" fill="#222">{t}</text>' for i, t in enumerate(LETTER_LINES))
        return f'''<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs><linearGradient id="wd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4a2e"/><stop offset="1" stop-color="#3b2816"/></linearGradient></defs>
<rect width="{W}" height="{H}" fill="url(#wd)"/>
<g transform="translate(62 230) rotate(-4)"><rect x="-6" y="-6" width="332" height="470" fill="#000" opacity=".25"/><rect width="320" height="458" fill="#f4f1ea"/>
<g transform="translate(26 70)">{lines}</g><rect x="26" y="300" width="120" height="2" fill="#555"/><text x="26" y="330" font-family="DejaVu Serif, serif" font-size="12.5" fill="#222">Waste services</text></g>
</svg>'''
    if kind == 'sign':
        return f'''<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<rect width="{W}" height="{H}" fill="#2a2c30"/><rect y="700" width="{W}" height="256" fill="#1c1d20"/>
<rect x="140" y="470" width="160" height="300" fill="#3a3d43" stroke="#15161a" stroke-width="6"/><circle cx="280" cy="630" r="6" fill="#8d8f94"/>
<g transform="translate(70 300)"><rect x="4" y="4" width="300" height="108" fill="#000" opacity=".35"/><rect width="300" height="108" fill="#1f8f4e"/><rect x="6" y="6" width="288" height="96" fill="none" stroke="#e9f5ee" stroke-width="2"/>
<text x="150" y="48" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="25" font-weight="700" fill="#ffffff">SORTIE DE</text>
<text x="150" y="84" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="25" font-weight="700" fill="#ffffff">SECOURS  →</text></g>
</svg>'''
    if kind == 'people':
        def fig(x, y, s, c):
            return (f'<g transform="translate({x} {y}) scale({s})"><ellipse cx="0" cy="-70" rx="34" ry="42" fill="{c}"/>'
                    f'<path d="M-78 90 C-78 10 -30 -14 0 -14 C30 -14 78 10 78 90Z" fill="{c}"/></g>')
        qr = ''
        import random
        rnd = random.Random(7)
        for yy in range(21):
            for xx in range(21):
                fp = (xx < 7 and yy < 7) or (xx > 13 and yy < 7) or (xx < 7 and yy > 13)
                on = rnd.random() < .45 if not fp else ((xx in (0, 6) or yy in (0, 6) or (2 <= xx <= 4 and 2 <= yy <= 4)) if xx < 7 and yy < 7 else
                                                      ((xx in (14, 20) or yy in (0, 6) or (16 <= xx <= 18 and 2 <= yy <= 4)) if xx > 13 and yy < 7 else
                                                       (xx in (0, 6) or yy in (14, 20) or (2 <= xx <= 4 and 16 <= yy <= 18))))
                if on:
                    qr += f'<rect x="{xx * 4}" y="{yy * 4}" width="4" height="4"/>'
        return f'''<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs><linearGradient id="rm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9d4ca"/><stop offset="1" stop-color="#8e887c"/></linearGradient></defs>
<rect width="{W}" height="{H}" fill="url(#rm)"/><rect y="640" width="{W}" height="316" fill="#5d5248"/><rect y="640" width="{W}" height="18" fill="#7a6d60"/>
{fig(140, 470, 1.15, '#4a4f58')}{fig(318, 500, 1.0, '#6b6058')}
<g transform="translate(318 690)"><rect x="-8" y="-8" width="112" height="112" fill="#fff"/><g fill="#111">{qr}</g></g>
</svg>'''
    # the mug
    return f'''<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs><linearGradient id="tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d7b66"/><stop offset="1" stop-color="#4e4036"/></linearGradient>
<linearGradient id="mg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e6e2da"/><stop offset="1" stop-color="#b8b3aa"/></linearGradient></defs>
<rect width="{W}" height="{H}" fill="#3b3a38"/><rect y="420" width="{W}" height="536" fill="url(#tb)"/>
<ellipse cx="230" cy="700" rx="150" ry="26" fill="#000" opacity=".3"/>
<path d="M300 520 C352 520 352 620 300 620" fill="none" stroke="url(#mg)" stroke-width="22" stroke-linecap="round"/>
<rect x="150" y="470" width="160" height="210" rx="12" fill="url(#mg)"/><ellipse cx="230" cy="470" rx="80" ry="18" fill="#cfcac1"/><ellipse cx="230" cy="470" rx="68" ry="12" fill="#3a2a1e"/>
</svg>'''


LENS = {
    1: dict(time='18:26', looking='a letter', kind='letter', line=['A letter', 'English', ('Tap a word to hear it', 'on')]),
    2: dict(time='18:31', looking='a sign', kind='sign', line=['A sign', 'French', 'Translated', ('Tap to hear it', 'on')]),
    3: dict(time='18:40', looking='two people', kind='people', line=['Mum', 'Someone I don’t know', ('A link: tap it', 'on')]),
    4: dict(time='18:44', looking='a mug', kind='mug', line=['A mug', '9 cm', ('Tap to ask about it', 'on')]),
}


def lens(n):
    L = LENS[n]
    top = f'<div class="top">{stamp(L["time"], L["looking"])}</div>'
    k = L['kind']
    marks = ''
    if k == 'letter':
        marks = (f'<button class="ret on full" data-px="222 448" data-align="c" data-free="1" style="width:332px;height:470px" aria-label="A letter"><span class="g-ret-frame"></span>{tag("A letter", on=True, count="61 words")}</button>'
                 f'<div class="read" style="left:24px;right:24px;top:540px">{tag("What it says", on=True)}<p><span class="on">Your bins are changing.</span> From Monday 9 November your general waste bin moves to Thursdays. Recycling stays on Mondays. Garden waste pauses for the winter and starts again in March.</p></div>')
    elif k == 'sign':
        marks = (f'<button class="ret on full" data-px="220 354" data-align="c" data-free="1" style="width:312px;height:120px" aria-label="A sign"><span class="g-ret-frame"></span>{tag("A sign", on=True, count="French")}</button>'
                 f'<div class="inplace" style="left:70px;top:300px;width:300px;height:108px;box-sizing:border-box">Emergency exit<small>Sortie de secours · French</small></div>')
    elif k == 'people':
        marks = (f'<button class="ret" data-px="140 390" data-align="c" data-free="1" style="width:92px;height:104px" aria-label="Mum"><span class="g-ret-frame"></span>{tag("Mum")}</button>'
                 f'<button class="ret r" data-px="318 430" data-align="c" data-free="1" style="width:80px;height:92px" aria-label="Someone I don’t know"><span class="g-ret-frame"></span>{tag("Someone I don’t know")}</button>'
                 f'<button class="ret on full below r" data-px="366 738" data-align="c" data-free="1" style="width:124px;height:124px" aria-label="A link"><span class="g-ret-frame"></span>{tag("A link", on=True, count="the menu")}</button>')
    else:
        marks = (f'<button class="ret on full" data-px="234 578" data-align="c" data-free="1" style="width:220px;height:240px" aria-label="A mug"><span class="g-ret-frame"></span>{tag("A mug", on=True)}<p class="g-truth">9 cm · white ceramic</p></button>')
    line = f'<div class="lens-line">{segs(L["line"])}</div>'
    cam = dict(pos=[0, 1.05, 0.95], tgt=[0, 0, -0.9], fov=70)
    cfg = dict(scene=scene(3, cam, {}, orb_lit=0, image=svg_data(lens_scene(k)), extra=dict(uSweep=0.55)), orb=None)
    inner = top + marks + line + ask('Ask me about it')
    return page(f'lens-{n}', f'The Lens · {L["looking"]}', L['time'], inner, cfg, body_cls='lens')


# ------------------------------------------------------------------------------------------------ 6 · THE BOOT, LONGER AND RICHER
# the cut: when each beat starts, in ms from the first frame (one source: boot.js reads it from the page, the sheet from here)
BOOT_CUT = dict(ground=0, scan=300, edges=900, things=1200, orb=1400, stamp=1900, feeds=2500, recognise=3000, greeting=3300, now=3450, land=3950, end=4300)
BOOT_FRAMES = [
    (1, 150, 'The ground', 'The lit graphite, nothing else, one breath: the room’s light breathing in where the orb will be.', 'ground'),
    (2, 450, 'The scan begins', 'The room is sampled in from the back-left corner: a brighter front where the scan is now, the points settling behind it.', 'scan'),
    (3, 900, 'The scan builds', 'The back wall, the floor and the shelf are points; the front crosses the desk; the first hairline edges draw behind it.', 'scan'),
    (4, 1300, 'The room is found', 'The edges are drawn; the things snap into their reticles one after another, each with its tag: the Library, God’s eye, the Agenda.', 'things'),
    (5, 1700, 'The orb forms', 'His library’s points drift out of the point of light in the middle and gather into the constellation; the sweep passes through them.', 'orb'),
    (6, 2100, 'The stamp types', 'The sphere resolves from the inside out; at the top the stamp line types itself with a block cursor: the day, the time, his place, CHECKING FEEDS.', 'stamp'),
    (7, 2450, 'The stamp lands', 'The line is whole; the meridians catch the light one after another and the rim closes last. TAP TO SKIP sits small by the thumb.', 'stamp'),
    (8, 2750, 'The feeds answer', 'One truth line each, a lock apart: flood, weather, crime; the city outside the window lights as they answer; the stamp says WATCHING 3 FEEDS.', 'feeds'),
    (9, 3080, 'The recognition', 'The reticle snaps onto the orb from 14 px wider, closing over the lock’s 160 ms in his colour, with one short tone; G H O S T Y under it. The feeds’ lines go: the stamp holds their truth.', 'recognise'),
    (10, 3350, 'The greeting', 'His line under the stamp, where Home’s first line lives; the orb opens half way and keeps time with the words.', 'greeting'),
    (11, 3850, 'Now', 'The search: the box checks the shelf, then the desk, and locks on this morning’s Brief; its callout follows. The name and the box on the orb are still there.', 'now'),
    (12, 4300, 'Home', 'The box and the name have gone; the stamp says LOOKING AT HOME; the plan of the house and the ask line slide up. Home is usable at 4.3 s.', 'land'),
]
BOOT_FEEDS = [list(f) for f in FEEDS]


def boot(n, t):
    m = MOMENTS['morning']
    top = (f'<div class="top"><p class="g-stamp"></p><p class="say" style="opacity:0">{m["say"]}</p><p class="say2" style="opacity:0">{m["say2"]}</p><div class="feeds"></div></div>')
    marks = ''.join(home_marks('none', boot=True))
    now_ret = ret('r-now', HOME['brief'], tag('Brief', glyph=CLOCK, on=True), cls='on full', pad=4, label='The Brief')
    co = callout('c-now', '24 648', 'tl', *m['co'][:3]) + lead('c-now', 'r-brief')
    locks = ('<span class="g-lock" id="orblock" hidden data-state="attend"><span class="g-ret-frame"></span></span>'
             '<span class="g-lock" id="search" hidden data-state="watch"><span class="g-ret-frame"></span></span>'
             '<p class="g-truth" id="searchline" style="position:absolute;z-index:5;left:24px;top:168px;opacity:0"></p>'
             '<p class="name">GHOSTY</p><p class="skip" hidden>Tap to skip</p>')
    hud = f'<div class="hud" style="opacity:0">{plan("home")}{ask()}</div>'
    inner = top + marks + now_ret + co + orb_el() + locks + hud
    cfg = dict(t=t, cut=BOOT_CUT, scene=scene(0, CAM_HOME, HOME, orb_at=ORB_PX), orb=dict(size=ORB_SIZE), feeds=BOOT_FEEDS,
               now=dict(day=DAY, time='07:12', place=PLACE),
               search=[['#r-shelf', BOOT_CUT['now'], 'watch'], ['#r-gym', BOOT_CUT['now'] + 130, 'watch'], ['#r-brief', BOOT_CUT['now'] + 260, 'attend']])
    return page(f'boot-{n:02d}', f'The boot · {t} ms', '07:12', inner, cfg, script='boot.js')


# ------------------------------------------------------------------------------------------------ the contact sheet
def ms(v):
    return f'{v / 1000:.2f} s'.replace('.00 s', ' s') if v >= 1000 else f'{v} ms'


SHEET = [
    ('1 · Home by the hour', 'The orb in the middle (131), the stamp line (its point of view), what is Now, the ask; the house along the bottom is the tab bar of this HUD.',
     [('home-morning', 'Morning', 'The Brief is Now: the folded paper on the desk, lit; 9° and clear, the dentist, leave by 08:40.'),
      ('home-commute', 'Commute', 'The journey is Now: the window onto Birmingham, lit; the 7:42, platform 3, leave by 07:42.'),
      ('home-evening', 'Evening', 'The reading is Now: tonight’s book open on the desk; page 42 of 112.'),
      ('home-evening-paper', 'Evening · Paper (beyond the brief)', 'The same Home on the Paper ground, to answer “how light” with a picture: the scan in ink, nothing glows.')]),
    ('2 · The way round', 'A navigation that belongs to the world and holds the finding rule (156): the house is the tab bar; one tap unfolds it to every screen; the ask line is the jump bar and the typed word.',
     [('home-evening', 'At rest', 'Recents (the clock) and favourites (the star) are things in the room: one tap. The house along the bottom: seven rooms, the one he is in lit.'),
      ('nav-house', 'One tap in: the house', 'A tap on THE HOUSE unfolds the plan: every room with its things numbered, 45 screens on one visible list; a tap on a thing goes there (2 taps to anything).'),
      ('nav-jump', 'The jump bar', 'A tap on the ask line: FAVOURITES and RECENT above the keyboard, two taps to any of them; or type.'),
      ('nav-typed', 'The typed word', '“rad”: the search checks each room in turn and says which, then the box locks on RADIO in Plan; OPEN, or the words go to me as a question.')]),
    ('3 · The Learn room and Every screen', 'One hub and the deck in the world.',
     [('learn', 'The Learn room', 'The room as a band, every thing in it numbered; AT HAND (recent and starred) open with their readings, THE REST folded; IN THE WORKS in amber.'),
      ('deck', 'Every screen', 'The Machine’s inventory of the whole house: favourites and recents first, then every room’s things with their numbers and one true line each; it scrolls.')]),
    ('4 · Settings and the Theme page', 'Settings as a page brought to the front of the room; the Theme page cut to three choices (155).',
     [('settings', 'Settings', 'Twelve rows in five groups, numbered; THEME reads what is set; it scrolls.'),
      ('theme', 'Theme', 'THE HUD (The Scan, you’re in it; The Map, The Eye, One Ink coming; Glass, today’s look), THE COLOUR (the twelve), THE GROUND (black, the lit grey, paper). Nothing else.')]),
    ('5 · The Lens that just knows', 'No key rows (156): it recognises what is in front of it and does the right thing by itself; one line under the viewfinder at most.',
     [('lens-1', 'A page of print', 'English: the words shown as I read them, the first sentence lit; a tap on a word and I read from there.'),
      ('lens-2', 'A sign in another language', 'French: translated there and then, in the sign’s own place; a tap and I say it.'),
      ('lens-3', 'A known person, a stranger, a code', 'MUM (you introduced her), SOMEONE I DON’T KNOW (nothing else: the boundary), and the code opened as what it is: a link to a menu.'),
      ('lens-4', 'A thing named', 'A mug, named and measured; a tap asks about it; the words do the rest.')]),
]


def contact():
    rows = ''
    for title, lede, figs in SHEET:
        f = ''.join(f'<figure><img src="{png}.png" alt="{cap}"><figcaption>{tag(cap)}<p class="what">{what}</p></figcaption></figure>' for png, cap, what in figs)
        rows += f'<h2>{title}</h2><p class="lede">{lede}</p><div class="row">{f}</div>'
    # the boot with its cut as a bar
    keys = ['ground', 'scan', 'edges', 'things', 'orb', 'stamp', 'feeds', 'recognise', 'greeting', 'now', 'land']
    ends = [BOOT_CUT[keys[i + 1]] if i < len(keys) - 1 else BOOT_CUT['end'] for i in range(len(keys))]
    bar = '<div class="bar">' + ''.join(f'<i style="flex:{max(1, ends[i] - BOOT_CUT[k])}"></i>' for i, k in enumerate(keys)) + '</div>'
    ticks = '<div class="ticks">' + ''.join(f'<u style="left:{t / BOOT_CUT["end"] * 100:.1f}%">{"HOME " if t == BOOT_CUT["end"] else ""}{ms(t)}</u>' for t in [0, 1000, 2000, 3000, 4000, BOOT_CUT['end']]) + '</div>'
    bf = ''.join(f'<figure><img src="boot-{n:02d}.png" alt="{name}"><figcaption>{tag(f"Shot {n}", count=ms(at))}<p class="g-truth">{name}</p><p class="what">{what}</p></figcaption></figure>' for n, at, name, what, _b in BOOT_FRAMES)
    rows += (f'<h2>6 · The boot, longer and richer</h2><p class="lede">Twelve frames, {ms(BOOT_CUT["end"])} to a usable Home, skippable at any tap: the ground, the scan building up, the room found, '
             f'the orb forming from his library in the middle, the stamp typing, the feeds answering (and the window lighting), the recognition, the greeting, Now, the landing. The pace of each beat and the sound are in the README.</p>{bar}{ticks}<div class="row">{bf}</div>')
    html = f'''<!doctype html>
<html lang="en-GB" data-theme="reactor" data-ground="graphite" data-world="scan" data-night="graphite">
<head><meta charset="utf-8"><title>Ghosty · the HUD mocks · contact</title>
<link rel="stylesheet" href="{FONTS}"><link rel="stylesheet" href="{TOKENS}"><link rel="stylesheet" href="hud.css">
<style>body {{ width: 1230px; height: auto; }}</style></head>
<body class="sheet"><h1>W1 THE SCAN as a whole HUD</h1>
<p class="lede">Pictures before code (BRIEF-HUD-MOCKS, 8 Nov). 440 × 956 at 2×, every value a token of the design system, the marks the system’s own, the room W1’s scan, the orb the real hologram. The questions and the gaps are in the README.</p>
{rows}
</body></html>'''
    with open(os.path.join(HERE, 'contact.html'), 'w', encoding='utf-8') as f:
        f.write(html)


if __name__ == '__main__':
    made = [home('morning'), home('commute'), home('evening'), home('evening', ground='paper', suffix='-paper'),
            nav('house'), nav('jump'), nav('typed'), learn(), deck(), settings(), theme()]
    made += [lens(i) for i in range(1, 5)]
    made += [boot(n, t) for n, t, *_r in BOOT_FRAMES]
    contact()
    print('hud/2026-11-08: ' + ' '.join(made) + ' contact')
