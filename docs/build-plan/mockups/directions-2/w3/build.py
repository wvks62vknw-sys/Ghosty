"""W3 · THE EYE — the Material, as the Machine's attention (BRIEF-DIRECTIONS-2, his reference OWNER-ISSUES 137).

The orb is an eye. Everything Ghosty watches is on the wall as a feed (his book, God's eye, the Brief, the Lens, the Agenda, the
Gym, Courses, and the six areas round them); what the eye is looking at is the thing itself, sharp, boxed, its line of sight
drawn from the orb; at the edge of its attention (his favourites) a finer grain; everything else is present as grain. A tap
moves the attention; a typed word sends the reticle searching across the wall until it locks; the Stage is the attention
taking the centre: the city, grain everywhere except the way he is going.

Writes the five moments (home, show, hub, lens, reader), the storyboard's four frames (story-1..4), home-ember, the strip and the
contact sheet, as static HTML beside this file. Run from the repo root:
    python3 -I -B docs/build-plan/mockups/directions-2/w3/build.py
    node docs/build-plan/mockups/tools/render.mjs directions-2/w3
Every word is real (round one's lib/content.py: hubcards.ts's names and readouts, Birmingham, Alice at page 42 of 112)."""
import base64
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'lib'))
sys.path.insert(0, HERE)
import kit  # noqa: E402
import feeds as F  # noqa: E402
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
W, H = 390.0, 844.0

# the wall: four columns, five rows of feeds, in the 390 x 844 design space
COLS = [16, 107, 198, 289]
ROWS = [160, 268, 376, 484, 592]
TW, TH = 85, 100


def cellr(c, r, cw=1, rh=1):
    x, y = COLS[c], ROWS[r]
    return (x, y, COLS[c + cw - 1] + TW - x, ROWS[r + rh - 1] + TH - y)


def frac(r):
    x, y, w, h = r
    return [round(x / W, 5), round(y / H, 5), round((x + w) / W, 5), round((y + h) / H, 5)]


def pct(r):
    x, y, w, h = r
    return f'left:{x / W * 100:.3f}%;top:{y / H * 100:.3f}%;width:{w / W * 100:.3f}%;height:{h / H * 100:.3f}%'


def data_url(svg):
    return 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode('utf-8')).decode('ascii')


def gl(img, att, orb=None, sight=None, dim=0.5, trail=None):
    """att: [(rect, strength)]; orb: (x, y, radius px, awake); sight: (x0, y0, x1, y1) in design px."""
    rects = [frac(r) for r, _ in att] + [[0, 0, 0, 0]] * (8 - len(att))
    ks = [[k] for _, k in att] + [[0]] * (8 - len(att))
    o = [orb[0] / W, orb[1] / H, orb[2], orb[3]] if orb else [0, 0, 0, 0]
    s = [sight[0] / W, sight[1] / H, sight[2] / W, sight[3] / H] if sight else [-1, -1, -1, -1]
    tr = [frac(r) for r in (trail or [])] + [[0, 0, 0, 0]] * (3 - len(trail or []))
    u = dict(uAtt=rects, uAttK=ks, uOrbP=o, uSight=s, uDim=dim, uTrail=tr)
    return f'GL.scene({{ frag: EYE_FRAG, uniforms: {json.dumps(u)}, colors: {{ uBoneC: "--bone-rgb" }}, image: {json.dumps(img)} }});'


def tile(r, tag, sub='', cls='', label='', extra=''):
    s = f'<span class="sub">{sub}</span>' if sub else ''
    return f'<button class="tile {cls}" style="{pct(r)}" aria-label="{label or tag}"><span class="tag">{tag}</span>{s}{extra}</button>'


def ask(text='Ask, or say what to look at', typed=False):
    caret = '<span class="caret"></span>' if typed else ''
    return f'<div class="ask"><button class="field{" typed" if typed else ""}">{text}{caret}</button><button class="mic" aria-label="Talk to me">{MIC}</button></div>'


def screen(time, inner):
    return f'<div class="screen"><canvas class="gl"></canvas>{status_bar(time)}{inner}{HOME_INDICATOR}</div>'


def w3page(title, time, inner, js, theme='reactor'):
    return page(title, screen(time, inner), theme=theme, scripts=('eye.js',), gl=js, css=CSS)


ALICE_WORDS = C.READER_TEXT[2][1] + ' ' + C.READER_TEXT[3][1]


# ------------------------------------------------------------------------------------------------ HOME: the wall, the eye on tonight's book
def wall_svg(alice=True, city_in=None):
    T = cellr
    parts = [
        F.mosaic(*T(0, 0), seed=1), F.cube(*T(1, 0)), F.chart(*T(2, 0)), F.ledger(*T(3, 0)),
        F.globe(*T(0, 1)), F.radar(*T(3, 1)),
        F.camview(*T(0, 2)), F.calendar(*T(3, 2)),
        F.sudoku(*T(0, 3)), F.card(*T(3, 3), 'COURSES', 'x² − 5x', 'LESSON 3'),
        F.mosaic(*T(0, 4), seed=7), F.sliders(*T(1, 4)), F.mosaic(*T(2, 4), seed=12), F.dots(*T(3, 4)),
    ]
    big = T(1, 1, 2, 2)
    if city_in:
        parts.append(F.city(*big, city_in))
    elif alice:
        parts.append(F.page(*big, ALICE_WORDS, size=9.2))
    return F.svg(''.join(parts))


def home_tiles(att='alice', hide=()):
    T = cellr
    t = [
        ('see', T(0, 0), 'See', '2 screens', ''), ('make', T(1, 0), 'Make', '8 screens', ''), ('plan', T(2, 0), 'Plan', '4 screens', ''), ('life', T(3, 0), 'Life', '8 screens', ''),
        ('eye', T(0, 1), f'{CLOCK}God’s eye', '41 aircraft', ''), ('brief', T(3, 1), f'{CLOCK}Brief', '9° clear', ''),
        ('lens', T(0, 2), f'Lens{STAR}', 'Ready', 'edge'), ('agenda', T(3, 2), f'Agenda{STAR}', '09:15', 'edge'),
        ('gym', T(0, 3), f'Gym{STAR}', 'Lv 6', 'edge'), ('courses', T(3, 3), f'Courses{STAR}', 'Lesson 3', 'edge'),
        ('learn', T(0, 4), 'Learn', '7 screens', ''), ('me', T(1, 4), 'Me', '6 screens', ''), ('deck', T(2, 4), 'Every screen', '44', ''), ('all', T(3, 4), 'All I do', '', ''),
    ]
    return ''.join(tile(r, tag, sub, cls, label=key) for key, r, tag, sub, cls in t if key not in hide)


EYE_HOME = (195, 534, 30, 1.0)


def home(theme='reactor'):
    big = cellr(1, 1, 2, 2)
    top = (f'<div class="top"><div class="truth">Fri 6 Nov · 21:08 · watching 15 · <i>looking at 1</i></div>'
           f'<div class="say">Good evening, Boss.</div><div class="say2">Nothing needs you tonight. Shall we read?</div></div>')
    alice = tile(big, f'{CLOCK}Library · tonight', cls='att', label='Carry on reading Alice',
                 extra='<span class="sub" style="color:var(--ink-1)">Alice, page 42 of 112 · carry on</span>')
    edge_r = [cellr(0, 2), cellr(3, 2), cellr(0, 3), cellr(3, 3)]
    att = [(big, 1.0)] + [(r, 0.5) for r in edge_r]
    js = gl(data_url(wall_svg()), att, orb=EYE_HOME, sight=(195, 503, 195, 477))
    note = '<div class="truth ov" data-px="16 708" data-align="tl">In focus: tonight · at the edge: starred</div>'
    return w3page('W3 · Home', '21:08', top + home_tiles() + alice + note + ask(), js, theme)


# ------------------------------------------------------------------------------------------------ SHOW: the attention takes the centre
STAGE = (16, 112, 358, 440)


def stage_route():
    """The way, placed in the Stage's frame (design px): home low left, New Street in the middle, the line out to the right."""
    x0, y0 = STAGE[0], STAGE[1]
    pts = [(60, 380), (60, 320), (130, 320), (130, 250), (196, 250), (196, 214), (196, 206), (246, 226), (290, 246), (330, 270), (372, 296)]
    return [(x0 + x - 16, y0 + y - 112 + 40) for x, y in pts]


def show(story=False):
    S = C.STAGE
    R = stage_route()
    svg = F.svg(F.city(*STAGE, R))
    # the attention runs along the way: the walk's legs, New Street, the line out
    legs = []
    for a, b in zip(R[:6], R[1:6]):
        x0, x1 = min(a[0], b[0]) - 9, max(a[0], b[0]) + 9
        y0, y1 = min(a[1], b[1]) - 9, max(a[1], b[1]) + 9
        legs.append(((x0, y0, x1 - x0, y1 - y0), 1.0))
    for a, b in ((R[6], R[8]), (R[8], R[10])):
        x0, x1 = min(a[0], b[0]) - 8, max(a[0], b[0]) + 8
        y0, y1 = min(a[1], b[1]) - 12, max(a[1], b[1]) + 12
        legs.append(((x0, y0, x1 - x0, y1 - y0), 1.0))
    ns = R[5]
    ns_box = (ns[0] - 44, ns[1] - 26, 88, 48)
    att = [(ns_box, 1.0)] + legs[:7]
    walk_d = 'M' + 'L'.join(f'{x / W * 100:.3f} {y / H * 100:.3f}' for x, y in R[:6])
    train_d = 'M' + 'L'.join(f'{x / W * 100:.3f} {y / H * 100:.3f}' for x, y in R[6:])
    way = (f'<svg class="way" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'
           f'<path d="{walk_d}" vector-effect="non-scaling-stroke" stroke-dasharray="4 4"/><path d="{train_d}" vector-effect="non-scaling-stroke"/></svg>')
    hb = (R[0][0] - 14, R[0][1] - 14, 28, 28)
    cb = (R[-1][0] - 26, R[-1][1] - 14, 28, 28)
    inner = (
        f'<button class="key back" aria-label="Back to the wall">{BACK}The wall</button>'
        f'<div class="truth ov" data-px="374 74" data-align="r" style="text-align:right">07:12 · <i>looking at the way</i></div>'
        + way + f'<div class="box on" style="{pct(ns_box)}"></div><div class="box br" style="{pct(hb)}"></div><div class="box br" style="{pct(cb)}"></div>'
        f'<button class="lab" style="left:{(ns_box[0]) / W * 100:.2f}%;top:{(ns_box[1] - 46) / H * 100:.2f}%" aria-label="New Street"><span class="tag on">New Street · platform 3</span><span class="sub">07:42 to Coventry · on time</span></button>'
        f'<button class="lab" style="left:{(hb[0]) / W * 100:.2f}%;top:{(hb[1] + 32) / H * 100:.2f}%" aria-label="Home"><span class="tag">Home</span><span class="sub">Leave by 07:24</span></button>'
        f'<button class="lab r" style="right:{(W - cb[0] - cb[2]) / W * 100:.2f}%;top:{(cb[1] + 32) / H * 100:.2f}%" aria-label="Coventry"><span class="tag">Coventry</span><span class="sub">Arrives 08:03</span></button>'
        f'<div class="say-stage" style="top:568px"><div class="say">{S["sentence"]}</div></div>'
        '<div class="readings" style="top:644px">' + ''.join(f'<div class="rd"><span class="l">{l}</span><span class="v">{v}</span></div>' for l, v in S['readings']) + '</div>'
        + ask(S['ask_placeholder'])
    )
    js = gl(data_url(svg), att, orb=(195, 120, 18, 1.25), sight=(195, 140, ns[0], ns[1] - 26), dim=0.42)
    return w3page('W3 · Home, showing' if not story else 'W3 · story 4', S['time'], inner, js)


# ------------------------------------------------------------------------------------------------ HUB: Learn's seven feeds, the eye on the recent one
def hub():
    cards = C.HUB['cards']
    T = lambda c, r, cw=1, rh=1: (COLS[c], 200 + r * 108, COLS[c + cw - 1] + TW - COLS[c], (rh - 1) * 108 + TH)  # noqa: E731
    lib, gym, cou = T(0, 0, 2, 2), T(2, 0), T(3, 0)
    eye_cell = T(2, 1, 2, 1)
    sch, arc, lrn, coa = T(0, 2), T(1, 2), T(2, 2), T(3, 2)
    svg = F.svg(F.page(*lib, C.READER_TEXT[0][1] + ' ' + C.READER_TEXT[1][1], size=9) + F.sudoku(*gym) + F.card(*cou, 'ALGEBRA', 'x² − 5x', 'PART 3 OF 8')
                + F.paper(*sch) + F.pinball(*arc) + F.words(*lrn) + F.keyboard(*coa))
    att = [(lib, 1.0), (gym, 0.5), (cou, 0.5)]
    top = (f'<button class="key back" style="top:56px" aria-label="Back to the wall">{BACK}The wall</button>'
           f'<div class="top" style="top:112px"><div class="title" style="margin-top:0">Learn</div><div class="say2">{C.HUB["line"]}</div></div>')
    tiles = (tile(lib, f'{CLOCK}Library · recent', cls='att', label='Library')
             + tile(gym, f'Gym{STAR}', '1,240 ↑35', cls='edge', label='Gym') + tile(cou, f'Courses{STAR}', 'Lesson 3', cls='edge', label='Courses')
             + tile(sch, 'School', 'Nursery', label='School') + tile(arc, 'Arcade', '16 free', label='Arcade')
             + tile(lrn, 'Learning', '12 days', label='Learning', extra='<span class="works">◼</span>') + tile(coa, 'Coach', '5 passed', label='Coach', extra='<span class="works">◼</span>'))
    lc = cards['library']
    focus = (f'<section class="focus" style="top:532px"><span class="tag">In focus · Library · ready</span><div class="ttl">{lc["title"]}</div>'
             f'<div class="reads"><span class="rd"><span class="l">Reading</span><span class="v" style="font-size:15px">{C.BOOK["title"]}</span></span></div>'
             f'<div class="reads" style="margin-top:4px"><span class="rd"><span class="l">Page</span><span class="v">42 of 112</span></span><span class="rd"><span class="l" style="color:var(--amber)">◼ In the works</span><span class="v" style="font-size:13px;color:var(--ink-2)">Learning · Coach</span></span></div>'
             f'<div class="keys">' + ''.join(f'<button class="key{" fill" if i == 0 else ""}">{p}</button>' for i, p in enumerate(lc['panels'])) + '</div></section>')
    js = gl(data_url(svg), att, orb=(eye_cell[0] + eye_cell[2] / 2, eye_cell[1] + eye_cell[3] / 2, 26, 1.0),
            sight=(eye_cell[0] + 10, eye_cell[1] + eye_cell[3] / 2, lib[0] + lib[2], eye_cell[1] + eye_cell[3] / 2))
    return w3page('W3 · Learn', '21:11', top + tiles + focus + ask('Find anything in Learn'), js)


# ------------------------------------------------------------------------------------------------ LENS: the camera's view, grain but for what it has found
def lens():
    L = C.LENS
    img = svg_data(kit.lens_scene('ls'))
    att = []
    out = []
    sx, sy = W / 440, H / 956
    for k, (x, y, w, h) in kit.TAGS.items():
        t = next(t for t in L['tags'] if t['id'] == k)
        r = (x * sx, y * sy, w * sx, h * sy)
        lit = k == 'text'
        att.append((r, 1.0 if lit else 0.5))
        out.append(f'<div class="box {"on" if lit else "br"}" style="{pct(r)}"></div>')
        if k == 'plant':
            pos = f'left:{r[0] / W * 100:.2f}%;top:{(r[1] + r[3] + 4) / H * 100:.2f}%'
        elif k == 'text':
            pos = f'left:{r[0] / W * 100:.2f}%;top:{(r[1] - 46) / H * 100:.2f}%'
        else:
            pos = f'right:{(W - r[0] - r[2]) / W * 100:.2f}%;top:{(r[1] - 46) / H * 100:.2f}%'
        out.append(f'<button class="lab{" r" if k == "barcode" else ""}" style="{pos}" aria-label="{t["noun"]}"><span class="tag{" on" if lit else ""}">{t["noun"]}</span><span class="sub">{t["hint"]}</span></button>')
    a = L['act']
    text_r = att[1][0]
    top = '<div class="top"><div class="truth" style="background:var(--plate-strong);padding:4px 6px;display:inline-block">18:26 · the Lens · <b>3 things found</b></div></div>'
    act = (f'<div class="act" style="bottom:calc(var(--safe-bottom) + 8px + 48px + 16px)"><div class="kick">{a["kicker"]}</div><h2>{a["title"]}</h2><p>{a["body"]}</p>'
           f'<div class="keys"><button class="key fill">{a["actions"][0]}</button><button class="key">{a["actions"][1]}</button></div></div>')
    js = gl(img, att, orb=(40, 548, 16, 1.2), sight=(52, 538, text_r[0], text_r[1] + text_r[3]), dim=0.34)
    return w3page('W3 · Lens', L['time'], top + ''.join(out) + act + ask('Ask me about it'), js)


# ------------------------------------------------------------------------------------------------ READER: the passage it is reading aloud, in focus
def reader():
    B = C.BOOK
    paras = ''
    for i, (kind, txt) in enumerate(C.READER_TEXT[:5]):
        if kind == 'mark':
            paras += f'<div class="mark">Page {txt}</div>'
        else:
            paras += f'<p class="{"lit" if i == C.READER_LIT else ""}">{txt}</p>'
    pills = ''.join(f'<button class="{"here" if i == 0 else ""}">{p}</button>' for i, p in enumerate(C.READER_PILLS))
    top = (f'<div class="top" style="top:58px"><div class="truth"><b>{B["title"]}</b></div><div class="truth">Page 42 of 112 · {B["when"]} · <i>reading aloud</i></div></div>')
    pg = f'<article class="page" style="top:104px;height:470px;overflow:hidden"><div class="pills">{pills}</div><div class="text">{paras}</div></article>'
    listen = (f'<div class="listen" style="top:580px"><div class="what"><b>Reading to you</b><span>My own voice · passage 3 of 7</span></div>'
              f'<button class="key" aria-label="Pause">{PAUSE}</button><button class="key" aria-label="Next passage">{NEXT}</button></div>')
    # the shelf: four feeds of covers, the eye's attention on the one open
    sh = [(16 + i * 91, 648, 85, 96) for i in range(4)]
    covers_svg = ''
    for (x, y, w, h), b in zip(sh, C.SHELF):
        covers_svg += F.frame(x, y, w, h, f'<rect x="10" y="6" width="{w - 20}" height="{h - 12}" fill="#5a5a5a"/><rect x="10" y="6" width="5" height="{h - 12}" fill="#3a3a3a"/><text x="{w / 2 + 3}" y="{h / 2 - 6}" text-anchor="middle" font-family="DejaVu Serif" font-size="8" fill="#e8e8e8">{F.esc(b["title"].split()[0])}</text>')
    shelf = '<div class="shelf3" style="top:648px">'
    for i, b in enumerate(C.SHELF):
        shelf += f'<button class="{"att" if i == 0 else ""}" aria-label="{b["title"]}"><span class="t"><b>{b["title"].split(" ")[0].rstrip("’s")}</b><span>{b["progress"]}</span></span></button>'
    shelf += '</div>'
    att = [(sh[0], 1.0)]
    js = gl(data_url(F.svg(covers_svg)), att, orb=(36, 608, 16, 1.25), sight=(36, 592, 36, 380), dim=0.5)
    return w3page('W3 · Reader', '21:14', top + pg + listen + shelf, js)


# ------------------------------------------------------------------------------------------------ the STORYBOARD: Home → the 7:42
STORY = [
    ('He asks', '07:12. He types “When’s my train?”. The eye lets go of tonight’s book; the wall falls back to grain.'),
    ('Searching', 'The reticle hops feed to feed (the Agenda, God’s eye, the Brief), 90 ms a hop, the line of sight following.'),
    ('Locked', 'It locks on New Street. That feed opens in the centre, sharp; the line of sight holds on the station.'),
    ('The Stage', 'The attention takes the screen: the city in grain except the way he is going, the station boxed, the sentence after.'),
]


def story(i):
    if i == 4:
        return show(story=True)
    top = (f'<div class="top"><div class="truth">Fri 6 Nov · 07:12 · {"searching · 3 feeds · 0.3 s" if i == 2 else ("locked · New Street" if i == 3 else "watching 15")}</div>'
           f'<div class="say">Good morning, Boss.</div></div>')
    big = cellr(1, 1, 2, 2)
    if i == 1:
        js = gl(data_url(wall_svg(alice=True)), [], orb=(195, 534, 30, 1.3), sight=None, dim=0.42)
        return w3page('W3 · story 1', '07:12', top + home_tiles() + ask('When’s my train?', typed=True), js)
    if i == 2:
        trail = [cellr(3, 1), cellr(0, 1), cellr(3, 2)]
        js = gl(data_url(wall_svg(alice=False)), [(cellr(3, 2), 0.5)], orb=(195, 534, 30, 1.4), sight=(220, 520, COLS[3], ROWS[2] + 50), dim=0.4, trail=trail)
        lab = f'<div class="tag on ov" style="right:{16 / W * 100:.2f}%;top:{(ROWS[2] - 22) / H * 100:.2f}%">Agenda · 07:42?</div>'
        return w3page('W3 · story 2', '07:12', top + home_tiles(hide=('agenda',)) + lab + ask('When’s my train?', typed=True), js)
    R = stage_route()
    route_in = [(big[0] + (x - 16) * big[2] / 358, big[1] + (y - 112) * big[3] / 440) for x, y in R]
    js = gl(data_url(wall_svg(alice=False, city_in=route_in)), [(big, 1.0)], orb=(195, 534, 30, 1.4), sight=(195, 503, 195, 477), dim=0.32)
    lock = tile(big, 'Locked · New Street', cls='att', label='New Street', extra='<span class="big"><b>The 7:42 from New Street</b><span>Platform 3 · opening</span></span>')
    return w3page('W3 · story 3', '07:12', top + home_tiles() + lock + ask('When’s my train?', typed=True), js)


if __name__ == '__main__':
    write(HERE, 'home.html', home())
    write(HERE, 'home-ember.html', home('ember'))
    write(HERE, 'show.html', show())
    write(HERE, 'hub.html', hub())
    write(HERE, 'lens.html', lens())
    write(HERE, 'reader.html', reader())
    for i in range(1, 5):
        write(HERE, f'story-{i}.html', story(i))
    write(HERE, 'story.html', kit.story_sheet('W3 · The Eye', 'Home becomes the 7:42',
                                             'The orb is an eye: what it looks at is sharp, everything else is grain. Asked for his train, it lets go of the book, searches the wall, locks on New Street, and the attention takes the screen.', STORY))
    write(HERE, 'contact.html', kit.contact_sheet('W3 · The Eye', 'the Material, as the Machine’s attention',
                                                 'The orb is an eye: whatever it is looking at is sharp, in a box, its line of sight drawn; everything else is there as grain.',
                                                 story_caps=[s[0] for s in STORY]))
    print('directions-2/w3: home, home-ember, show, hub, lens, reader, story-1..4, story, contact')
