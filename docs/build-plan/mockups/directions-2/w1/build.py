"""W1 · THE SCAN — the Room, as the Machine keeps it (BRIEF-DIRECTIONS-2, his reference OWNER-ISSUES 137).

The phone is a window into a 3-D scan of a room where everything Ghosty does has its place: the window onto Birmingham is God's
eye, the shelf is the Library, tonight's book lies open on the desk, the calendar is the Agenda, the chessboard is the Gym. The
orb floats in the room as the eye and its only light; tilt the phone and you look round (parallax from the gyroscope); what you
ask for is brought to the front (the window comes forward and the city outside is the Stage). The six areas are the other rooms
of the house, drawn as the Machine draws a building: a plan along the bottom, the room he is in lit.

Writes the five moments (home, show, hub, lens, reader), the storyboard's four frames (story-1..4), home-ember, the strip and the
contact sheet, as static HTML beside this file. Run from the repo root:
    python3 -I -B docs/build-plan/mockups/directions-2/w1/build.py
    node docs/build-plan/mockups/tools/render.mjs directions-2/w1
Every word is real (round one's lib/content.py: hubcards.ts's names and readouts, Birmingham, Alice at page 42 of 112)."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'lib'))
import kit  # noqa: E402
from kit import C, HOME_INDICATOR, cover, page, status_bar, svg_data, write  # noqa: E402
from glyphs import GLYPHS  # noqa: E402

CSS = ('tokens.css', '../lib/machine.css', 'style.css')
ICON = lambda d: f'<svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>'  # noqa: E731
CLOCK = ICON('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>')
STAR = ICON(GLYPHS['star'])
MIC = ICON(GLYPHS['mic'])
BACK = ICON('<path d="M15 5l-7 7 7 7"/>')
PAUSE = ICON('<path d="M8 5v14M16 5v14"/>')
NEXT = ICON(GLYPHS['forward'])

# ------------------------------------------------------------------------------------------------ the rooms (metres)
ROOM = dict(room=[1.02, 2.38, -2.4, 1.5], win=[-0.5, 1.0, 0.5, 2.05])
# name: (centre, kind, half size, lit). kinds: 0 a plain thing, 1 an open book, 2 paper, 3 a notebook, 5 a chessboard,
# 6 a calendar, 7 a bookshelf, 8 an arcade cabinet, 9 a keyboard
HOME = {
    'desk': ([0.0, 0.73, -1.58], 0, [0.85, 0.02, 0.28], 0),
    'legl': ([-0.8, 0.355, -1.58], 0, [0.02, 0.355, 0.24], 0),
    'legr': ([0.8, 0.355, -1.58], 0, [0.02, 0.355, 0.24], 0),
    'brief': ([-0.62, 0.754, -1.62], 2, [0.12, 0.004, 0.085], 0),
    'alice': ([-0.18, 0.758, -1.5], 1, [0.2, 0.008, 0.135], 1),
    'gym': ([0.27, 0.76, -1.6], 5, [0.13, 0.012, 0.13], 0),
    'courses': ([0.66, 0.757, -1.58], 3, [0.1, 0.007, 0.13], 0),
    'shelf': ([-0.78, 1.0, -2.24], 7, [0.16, 1.0, 0.15], 0),
    'lens': ([-0.78, 1.47, -2.12], 0, [0.07, 0.045, 0.04], 0),
    'agenda': ([0.8, 1.5, -2.385], 6, [0.17, 0.24, 0.012], 0),
}
LEARN = {
    'shelf': ([-0.74, 1.0, -2.24], 7, [0.24, 1.0, 0.15], 1),
    'arcade': ([0.74, 0.85, -2.14], 8, [0.22, 0.85, 0.22], 0),
    'desk': ([0.02, 0.73, -1.72], 0, [0.46, 0.02, 0.3], 0),
    'legl': ([-0.4, 0.355, -1.72], 0, [0.02, 0.355, 0.26], 0),
    'legr': ([0.44, 0.355, -1.72], 0, [0.02, 0.355, 0.26], 0),
    'courses': ([-0.16, 0.757, -1.62], 3, [0.1, 0.007, 0.13], 1),
    'school': ([0.2, 0.78, -1.82], 2, [0.1, 0.03, 0.13], 0),
    'learning': ([0.3, 0.755, -1.55], 2, [0.06, 0.012, 0.04], 0),
    'gtop': ([-0.6, 0.55, -0.92], 0, [0.2, 0.02, 0.2], 0),
    'gleg': ([-0.6, 0.27, -0.92], 0, [0.03, 0.27, 0.03], 0),
    'gym': ([-0.6, 0.582, -0.92], 5, [0.15, 0.012, 0.15], 1),
    'coach': ([0.6, 0.78, -1.0], 9, [0.3, 0.02, 0.09], 0),
    'cleg': ([0.6, 0.39, -1.0], 0, [0.02, 0.39, 0.02], 0),
}
ORB_HOME = [0.0, 1.52, -1.6, 0.17]
CAM_HOME = dict(pos=[0.0, 1.42, 0.95], tgt=[0.0, 1.2, -1.6], fov=72)
CAM_LEARN = dict(pos=[0.0, 1.7, 4.6], tgt=[0.0, -0.15, -1.5], fov=40)


# the city (the Stage): the walk from home to New Street, then the train towards Coventry (round one's map, in model units)
def mu(p):
    return [round((p[0] - 190) / 60, 3), round((p[1] - 232) / 60, 3)]


WALK = [(92, 334), (92, 298), (142, 298), (142, 262), (190, 262), (190, 240)]
TRAIN = [(190, 232), (228, 247), (262, 261), (294, 279), (322, 300)]
ROUTE = [mu(p) for p in WALK + TRAIN]


def box(th):
    (c, _k, h, _l) = th
    return ' '.join(f'{v:.3f}' for v in [c[0] - h[0], c[1] - h[1], c[2] - h[2], c[0] + h[0], c[1] + h[1], c[2] + h[2]])


def gl(mode, cam, things=None, orb=ORB_HOME, orb_lit=1.0, extra=None, image=None, room=ROOM, orb_at=None, clip=None):
    things = things or {}
    lst = list(things.values())
    bc = [[*t[0], t[1]] for t in lst] + [[0, -9, 0, 0]] * (20 - len(lst))
    bh = [[*t[2], t[3]] for t in lst] + [[0, 0, 0, 0]] * (20 - len(lst))
    u = dict(uMode=mode, uOrb=orb, uOrbLit=orb_lit, uRoom=room['room'], uWin=room['win'], uBoxC=bc, uBoxH=bh, uN=len(lst),
             uRoute=ROUTE, uRouteOn=1.0, uFade=1.0, uSweep=0.55, uClip=clip or [0, 0, 0, 0])
    u.update(extra or {})
    cam_js = json.dumps(dict(pos=cam['pos'], tgt=cam['tgt'], fov=cam['fov'] * 3.14159265 / 180))
    more = f', image: {json.dumps(image)}' if image else ''
    if orb_at:
        more += f', orbAt: {json.dumps(orb_at)}'
    return f'GL.scene({{ frag: SCAN_FRAG, camera: {cam_js}, uniforms: {json.dumps(u)}, colors: {{ uBoneC: "--bone-rgb" }}{more} }});'


def callout(cid, at, align, tag, sub='', big='', lit=False, label=''):
    """A thing's tag at the screen's edge, then what it reads; a leader runs from it to the reticle in the room."""
    cls = 'co r' if 'r' in align else 'co'
    t = f'<span class="tag{" on" if lit else ""}">{tag}</span>'
    b = f'<span class="big">{big}</span>' if big else ''
    s = f'<span class="sub">{sub}</span>' if sub else ''
    return f'<button class="{cls}" id="{cid}" data-px="{at}" data-align="{align}" aria-label="{label or tag}">{t}{b}{s}</button>'


def reticle(rid, th, lit=False, full=False, pad=6, num=''):
    n = f'<span class="tag n{" on" if lit else ""}">{num}</span>' if num else ''
    return f'<div class="ret{" on" if lit else ""}{" full" if full else ""}" id="{rid}" data-box="{box(th)}" data-pad="{pad}" data-min="28">{n}</div>'


def mark(rid, th, tag, sub='', cls='', pad=4, label=''):
    """A thing in the room as the Machine marks it: a reticle he can press, its tag above, one true line below."""
    lit = ' on' if 'on' in cls.split() else ''
    s = f'<span class="sub">{sub}</span>' if sub else ''
    return (f'<button class="ret {cls}" id="{rid}" data-box="{box(th)}" data-pad="{pad}" data-min="44" aria-label="{label or rid}">'
            f'<span class="tag{lit}">{tag}</span>{s}</button>')


def lead(a, b, lit=False):
    return f'<svg class="lead{" on" if lit else ""}" data-lead="#{a}|#{b}" aria-hidden="true"></svg>'


def plan(here='home'):
    rooms = [('home', 'Home', 'w2'), ('see', 'See', ''), ('make', 'Make', ''), ('learn', 'Learn', 'w2'), ('plan', 'Plan', ''), ('life', 'Life', ''), ('me', 'Me', '')]
    btns = ''.join(f'<button class="{c}{" here" if k == here else ""}" aria-label="{n}">{n}{"<i></i>" if k == here else ""}</button>' for k, n, c in rooms)
    where = 'You are home' if here == 'home' else f'You are in {here.title()}'
    return f'<nav class="plan" aria-label="The house"><div class="kick"><span>The house · 7 rooms</span><span>{where}</span></div><div class="rooms">{btns}</div></nav>'


def ask(text='Ask, or say where to go', typed=False):
    caret = '<span class="caret"></span>' if typed else ''
    return f'<div class="ask"><button class="field{" typed" if typed else ""}">{text}{caret}</button><button class="mic" aria-label="Talk to me">{MIC}</button></div>'


def screen(time, inner):
    return f'<div class="screen"><canvas class="gl"></canvas>{status_bar(time)}{inner}{HOME_INDICATOR}</div>'


def w1page(title, time, inner, js, theme='reactor'):
    return page(title, screen(time, inner), theme=theme, scripts=('room.js',), gl=js, css=CSS)


# ------------------------------------------------------------------------------------------------ HOME
def home(theme='reactor'):
    H = HOME
    top = (f'<div class="top"><div class="truth">Fri 6 Nov · 21:08 · Birmingham · <b>9° clear</b></div>'
           f'<div class="say">Good evening, Boss.</div><div class="say2">Nothing needs you tonight. Shall we read?</div></div>')
    marks = [
        mark('r-win', ([0, 1.525, -2.4], 0, [0.5, 0.525, 0.0], 0), f'{CLOCK}God’s eye', '41 aircraft · 188 buses', cls='r', pad=0, label='God’s eye, recent'),
        mark('r-shelf', H['shelf'], f'{CLOCK}Library', '4 books', cls='below', pad=0, label='Library, recent'),
        mark('r-lens', H['lens'], f'Lens{STAR}', pad=3, label='Lens, favourite'),
        mark('r-agenda', H['agenda'], f'Agenda{STAR}', 'Dentist 09:15', cls='r', pad=2, label='Agenda, favourite'),
        mark('r-brief', H['brief'], f'{CLOCK}Brief', pad=4, label='Brief, recent'),
        mark('r-gym', H['gym'], f'Gym{STAR}', pad=3, label='Gym, favourite'),
        mark('r-courses', H['courses'], f'Courses{STAR}', cls='r', pad=4, label='Courses, favourite'),
        reticle('r-alice', H['alice'], lit=True, full=True, pad=5),
        callout('c-alice', '16 552', 'tl', 'Tonight · Library', big=C.BOOK['title'], sub='Page 42 of 112 · yesterday · carry on', lit=True, label='Carry on reading Alice'),
        lead('c-alice', 'r-alice', lit=True),
    ]
    return w1page('W1 · Home', '21:08', top + ''.join(marks) + plan('home') + ask(), gl(0, CAM_HOME, HOME), theme)


# ------------------------------------------------------------------------------------------------ SHOW (the Stage)
CAM_CITY = dict(pos=[7.4, 6.2, 1.25], tgt=[0.95, 0.0, 0.9], fov=44)
FRAME = [16, 112, 374, 548]   # the window brought to the front: the Stage's frame, in CSS px


def show(story=False):
    S = C.STAGE
    w0, ns, cov = ROUTE[0], ROUTE[5], ROUTE[10]
    inner = (
        f'<button class="key back" aria-label="Back to the room">{BACK}The room</button>'
        f'<div class="truth ov" data-px="374 80" data-align="r" style="text-align:right">07:12 · New Street · <i>live</i></div>'
        f'<div class="frame" style="top:112px;height:436px"></div>'
        f'<div class="ret" id="r-home" data-box="{w0[0]-.12} 0 {w0[1]-.12} {w0[0]+.12} .1 {w0[1]+.12}" data-min="24"></div>'
        + callout('c-home', '28 196', 'tl', 'Home', sub='Leave by 07:24', label='Home') + lead('c-home', 'r-home') +
        f'<div class="ret on full" id="r-ns" data-box="{ns[0]-.55} 0 {ns[1]-.2} {ns[0]+.55} .14 {ns[1]+.2}" data-pad="4"></div>'
        + callout('c-ns', '362 420', 'tr', 'New Street · platform 3', sub='07:42 to Coventry · on time', lit=True, label='The 7:42 from New Street') + lead('c-ns', 'r-ns', lit=True) +
        f'<div class="ret" id="r-cov" data-box="{cov[0]-.12} 0 {cov[1]-.12} {cov[0]+.12} .1 {cov[1]+.12}" data-min="24"></div>'
        + callout('c-cov', '362 540', 'br', 'Coventry', sub='Arrives 08:03', label='Coventry') + lead('c-cov', 'r-cov') +
        f'<div class="say-stage" style="top:564px"><div class="say">{S["sentence"]}</div></div>'
        '<div class="readings" style="top:640px">' + ''.join(f'<div class="rd"><span class="l">{l}</span><span class="v">{v}</span></div>' for l, v in S['readings']) + '</div>'
        + ask(S['ask_placeholder'])
    )
    js = gl(1, CAM_CITY, {}, orb_lit=1.25, orb_at=[195, 112, 2.2, 22], clip=FRAME)
    return w1page('W1 · Home, showing' if not story else 'W1 · story 4', S['time'], inner, js)


# ------------------------------------------------------------------------------------------------ HUB (the Learn room)
def hub():
    L = LEARN
    cards = C.HUB['cards']
    top = (f'<div class="top"><div class="truth">The Learn room · 7 things · 21:11</div>'
           f'<div class="title">Learn</div><div class="say2">{C.HUB["line"]}</div></div>')
    # the room, a band across the top: each thing reticled and numbered as the inventory below numbers it
    nums = [('shelf', '01', True), ('gym', '02', True), ('courses', '03', True), ('school', '04', False), ('arcade', '05', False), ('learning', '06', False), ('coach', '07', False)]
    vis = dict(L, shelf=([-0.74, 1.0, -2.24], 7, [0.24, 0.42, 0.15], 1), arcade=([0.74, 1.0, -2.14], 8, [0.22, 0.42, 0.22], 0))
    marks = ''.join(reticle(f'r-{k}', vis[k], lit=lit, pad=3, num=n) for k, n, lit in nums)

    def row(n, name, flag, title, reads):
        r = ''.join(f'<span class="rd"><span class="l">{l}</span><span class="v">{v}{f"<small>{u}</small>" if u else ""}</span></span>' for l, v, u in reads)
        return (f'<button class="inv-row" aria-label="{name}"><span class="n on">{n}</span><span class="body"><span class="tag on">{name}{flag}</span>'
                f'<span class="ttl">{title}</span></span><span class="reads">{r}</span></button>')

    def mini(n, name, line, works=False):
        w = '<span class="works">In the works</span>' if works else ''
        return f'<button class="inv-mini" aria-label="{name}"><span class="n">{n}</span><span class="body"><span class="tag">{name}</span><span class="sub">{line}</span>{w}</span></button>'
    inv = ('<section class="inv" style="top:350px"><div class="kick inv-k"><span>At hand · 3</span><span>Recent and starred</span></div>'
           + row('01', 'Library', f' · {CLOCK}', cards['library']['title'], [('Reading', 'Alice', ''), ('Page', '42/112', '')])
           + row('02', 'Gym', f' {STAR} · training', cards['gym']['title'], cards['gym']['reads'])
           + row('03', 'Courses', f' {STAR}', cards['learn']['title'], cards['learn']['reads'])
           + '<div class="kick inv-k"><span>Folded · 4 more</span><span>Tap to open</span></div><div class="inv-grid">'
           + mini('04', 'School', 'Nursery · 7 papers') + mini('05', 'Arcade', '16 free · last: Epic Pinball')
           + mini('06', 'Learning', '12 days · 9 skills', works=True) + mini('07', 'Coach', '3 days · 5 passed', works=True)
           + '</div></section>')
    js = gl(2, CAM_LEARN, L, orb_lit=1.0, orb_at=[318, 222, 2.4, 16], room=dict(room=[1.02, 2.38, -2.4, 1.5], win=[0, 0, 0, 0]), clip=[0, 184, 390, 340])
    return w1page('W1 · Learn', '21:11', top + marks + inv + plan('learn') + ask('Find anything in Learn'), js)


# ------------------------------------------------------------------------------------------------ LENS
def lens():
    L = C.LENS
    img = svg_data(kit.lens_scene('ls'))
    out = []
    for k, (x, y, w, h) in kit.TAGS.items():
        t = next(t for t in L['tags'] if t['id'] == k)
        lit = k == 'text'
        depth = {'plant': '0.9 m', 'text': '0.6 m', 'barcode': '0.7 m'}[k]
        cls = ' on full' if lit else (' below' if k == 'plant' else ' r')
        out.append(f'<button class="ret{cls}" data-px="{(x + w / 2) / 4.4:.2f}% {(y + h / 2) / 9.56:.2f}%" '
                   f'style="width:{w / 4.4:.2f}vw;height:{h / 9.56:.2f}vh" aria-label="{t["noun"]}"><span class="tag{" on" if lit else ""}">{t["noun"]} · {t["hint"]}</span>'
                   f'<span class="sub">{depth} away</span></button>')
    a = L['act']
    top = '<div class="top"><div class="truth">18:26 · the Lens · <b>3 things in view</b> · <i>scanning</i></div></div>'
    act = (f'<div class="act" style="bottom:calc(var(--safe-bottom) + 8px + 48px + 16px)"><div class="kick">{a["kicker"]} · brought to the front</div><h2>{a["title"]}</h2><p>{a["body"]}</p>'
           f'<div class="keys"><button class="key fill">{a["actions"][0]}</button><button class="key">{a["actions"][1]}</button></div></div>')
    cam = dict(pos=[0, 1.05, 0.95], tgt=[0, 0, -0.9], fov=70)
    js = gl(3, cam, {}, orb=[0, -9, 0, 0.01], orb_lit=0, image=img)
    return w1page('W1 · Lens', L['time'], top + ''.join(out) + act + ask('Ask me about it'), js)


# ------------------------------------------------------------------------------------------------ READER
def reader():
    B = C.BOOK
    paras = ''
    for i, (kind, txt) in enumerate(C.READER_TEXT[:5]):
        if kind == 'mark':
            paras += f'<div class="mark">Page {txt}</div>'
        else:
            paras += f'<p class="{"lit" if i == C.READER_LIT else ""}">{txt}</p>'
    pills = ''.join(f'<button class="{"here" if i == 0 else ""}">{p}</button>' for i, p in enumerate(C.READER_PILLS))
    pg = (f'<article class="page" style="top:108px;height:460px;overflow:hidden">'
          f'<div class="head"><span class="tag" style="background:none;padding:0">{B["chapter"]} · {B["chapter_title"]}</span></div>'
          f'<div class="pills">{pills}</div><div class="text">{paras}</div></article>')
    top = (f'<div class="top" style="top:60px"><div class="truth"><b>{B["title"]}</b></div>'
           f'<div class="truth">Page 42 of 112 · {B["when"]} · <i>brought to the front</i></div></div>')
    listen = (f'<div class="listen" style="top:580px"><span class="orbslot"></span><div class="what"><b>Reading to you</b><span>My own voice · passage 3 of 7</span></div>'
              f'<button class="key" aria-label="Pause">{PAUSE}</button><button class="key" aria-label="Next passage">{NEXT}</button></div>')
    shelf = '<div class="kick" style="position:absolute;z-index:4;left:var(--gutter);top:648px">The shelf · 4 books · by recent</div><div class="shelf2" style="top:668px">'
    for b in C.SHELF:
        pct = int(b['pct'] * 100)
        shelf += (f'<button aria-label="{b["title"]}">{cover(b["id"], 32, "s" + b["id"])}<span class="t"><b>{b["title"]}</b>'
                  f'<span class="au">{b["author"]}</span><span class="bar"><i style="width:{pct}%"></i></span><span class="pr">{b["progress"]}</span></span></button>')
    shelf += '</div>'
    js = gl(0, dict(pos=[-0.15, 1.25, -0.7], tgt=[-0.18, 0.76, -1.5], fov=70), HOME, orb_at=[44, 608, 0.6, 15], extra=dict(uFade=0.45))
    return w1page('W1 · Reader', '21:14', top + pg + listen + shelf, js)


# ------------------------------------------------------------------------------------------------ the STORYBOARD: Home → the 7:42
STORY = [
    ('He asks', '07:12. He types “When’s my train?”. The other tags let go; the eye turns to the window, where the answer is.'),
    ('The eye locks', 'One reticle locks on the window: Birmingham New Street. The camera starts across the room towards it.'),
    ('Through the window', 'The room falls away behind; the city outside resolves from points into a model and the way draws itself.'),
    ('The Stage', 'The window is at the front. The 7:42, platform 3, the walk and the train; the sentence comes after the picture.'),
]


def story(i):
    if i == 4:
        return show(story=True)
    if i == 1:
        ov = (f'<div class="top"><div class="truth">Fri 6 Nov · 07:12 · Birmingham · <b>6° clear</b></div><div class="say">Good morning, Boss.</div></div>'
              '<div class="ret on full" data-box="-0.5 1.0 -2.4 0.5 2.05 -2.4" data-pad="0"></div>'
              '<div class="tag on ov" data-at="-0.5 2.05 -2.4" data-align="bl" data-dy="-6">Looking · New Street, 2.1 km</div>' + plan('home') + ask('When’s my train?', typed=True))
        return w1page('W1 · story 1', '07:12', ov, gl(0, CAM_HOME, HOME, orb_lit=1.2))
    if i == 2:
        cam = dict(pos=[0.0, 1.5, -0.45], tgt=[0.0, 1.45, -2.4], fov=74)
        ov = ('<div class="ret on full" data-box="-0.5 1.0 -2.4 0.5 2.05 -2.4" data-pad="0"></div>'
              '<div class="tag on ov" data-at="-0.5 2.05 -2.4" data-align="bl" data-dy="-6">Locked · Birmingham New Street</div>'
              '<div class="top"><div class="truth">Finding the 7:42 · 3 feeds · 0.4 s</div></div>' + ask('When’s my train?', typed=True))
        return w1page('W1 · story 2', '07:12', ov, gl(0, cam, HOME, orb=[0.0, 1.62, -1.55, 0.13], orb_lit=1.4))
    cam = dict(pos=[10.4, 8.6, 1.25], tgt=[0.95, 0.0, 0.9], fov=44)
    ov = ('<div class="frame" style="top:112px;height:436px"></div>'
          '<div class="top"><div class="truth">Drawing the way · walk 14 min · train 21 min</div></div>' + ask('When’s my train?', typed=True))
    return w1page('W1 · story 3', '07:12', ov, gl(1, cam, {}, orb_lit=1.3, orb_at=[195, 112, 2.6, 26], extra=dict(uRouteOn=0.6), clip=FRAME))


if __name__ == '__main__':
    write(HERE, 'home.html', home())
    write(HERE, 'home-ember.html', home('ember'))
    write(HERE, 'show.html', show())
    write(HERE, 'hub.html', hub())
    write(HERE, 'lens.html', lens())
    write(HERE, 'reader.html', reader())
    for i in range(1, 5):
        write(HERE, f'story-{i}.html', story(i))
    write(HERE, 'story.html', kit.story_sheet('W1 · The Scan', 'Home becomes the 7:42',
                                             'The phone is a window into a 3-D scan of a room where everything Ghosty does has its place. Asked for his train, the eye turns to the window and the city outside is brought to the front.', STORY))
    write(HERE, 'contact.html', kit.contact_sheet('W1 · The Scan', 'the Room, as the Machine keeps it',
                                                 'The phone is a window into a 3-D scan of a room where everything Ghosty does has its place; tilt to look round, and what you ask for is brought to the front.',
                                                 story_caps=[s[0] for s in STORY]))
    print('directions-2/w1: home, home-ember, show, hub, lens, reader, story-1..4, story, contact')
