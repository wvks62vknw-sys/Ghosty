"""W2 · THE MAP — the Field, as the Machine sees it (BRIEF-DIRECTIONS-2, his reference OWNER-ISSUES 137).

Everything Ghosty can see and do is plotted on one map round the orb. What is at hand (tonight's book, the recents, the
favourites) sits in the square of nine round the origin; the six areas are territories beyond it, nearer the more he uses
them, every ability a point inside. There are no screens and no bar: pinch is altitude (the scale along the bottom says which
and is itself the zoom), a typed word is a flight, and the Stage is simply the deepest zoom of the thing — the Journey's point
opens into the streets of Birmingham.

Writes the five moments (home, show, hub, lens, reader), the storyboard's four frames (story-1..4), home-ember, the strip and the
contact sheet, as static HTML beside this file. Run from the repo root:
    python3 -I -B docs/build-plan/mockups/directions-2/w2/build.py
    node docs/build-plan/mockups/tools/render.mjs directions-2/w2
Every word is real (round one's lib/content.py: hubcards.ts's names and readouts, areadefs.ts's screens, Birmingham, Alice)."""
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
PAUSE = ICON('<path d="M8 5v14M16 5v14"/>')
NEXT = ICON(GLYPHS['forward'])

# the six territories (map units; one unit is one square of the grid), nearer the origin the more he uses them
SEEDS = [('see', 'See', -2.6, -7.4, 2), ('make', 'Make', 2.6, -7.4, 8), ('learn', 'Learn', -2.6, -3.9, 7), ('plan', 'Plan', 2.6, -3.9, 4),
         ('life', 'Life', -2.6, -10.9, 8), ('me', 'Me', 2.6, -10.9, 6)]
JOURNEY = [1.6, -3.0]          # where the Journey's point is plotted: in Plan, by the Agenda's tomorrow
CAM_HOME = dict(pos=[0.0, 7.4, 5.0], tgt=[0.0, 0.0, -2.05], fov=58)
ORB = [0.0, 0.5, 0.0, 0.34]


def mu(p):
    return [round((p[0] - 190) / 60, 3), round((p[1] - 232) / 60, 3)]


WALK = [(92, 334), (92, 298), (142, 298), (142, 262), (190, 262), (190, 240)]
TRAIN = [(190, 232), (228, 247), (262, 261), (294, 279), (322, 300)]
ROUTE = [mu(p) for p in WALK + TRAIN]


def gl(cam, orb=ORB, orb_lit=1.0, here=-1, city=0.0, city_at=(999, 999), city_r=0.0, scale=1.0, dots=1.0, field=1.0, image=None,
       clip=None, orb_at=None, lens=0.0, grid_k=1.0):
    u = dict(uFoot=0.0 if orb_at else 1.0, uOrb=orb, uOrbLit=orb_lit, uSeed=[[s[2], s[3]] for s in SEEDS], uHere=here, uCity=city, uCityAt=list(city_at), uCityR=city_r,
             uCityScale=scale, uRoute=ROUTE, uRouteOn=1.0, uDots=dots, uField=field, uClip=clip or [0, 0, 0, 0], uLens=lens, uGridK=grid_k)
    cam_js = json.dumps(dict(pos=cam['pos'], tgt=cam['tgt'], fov=cam['fov'] * 3.14159265 / 180))
    more = f', image: {json.dumps(image)}' if image else ''
    if orb_at:
        more += f', orbAt: {json.dumps(orb_at)}'
    return f'GL.scene({{ frag: FIELD_FRAG, camera: {cam_js}, uniforms: {json.dumps(u)}, colors: {{ uBoneC: "--bone-rgb" }}{more} }});'


def at(x, z, y=0.0):
    return f'{x} {y} {z}'


def region(key, name, x, z, n, far=False, here=False, align='c'):
    cls = 'region' + (' far' if far else '') + (' here' if here else '')
    return f'<button class="{cls}" data-at="{at(x, z)}" data-align="{align}" aria-label="{name}, {n} screens">{name}<small>{n} screens</small></button>'


def point(name, x, z, align='l'):
    return f'<button class="pt" data-at="{at(x, z)}" data-align="{align}" data-dx="-3" aria-label="{name}"><i></i>{name}</button>'


def cell(x, z, tag, sub='', cls='', label=''):
    s = f'<span class="sub">{sub}</span>' if sub else ''
    return f'<button class="cell {cls}" data-at="{at(x, z)}" aria-label="{label or tag}"><span class="tag">{tag}</span>{s}</button>'


def scale(here='hand'):
    stops = [('all', 'All'), ('areas', 'Areas'), ('hand', 'At hand'), ('inside', 'Inside')]
    return '<nav class="scale" aria-label="Altitude">' + ''.join(f'<button class="{"here" if k == here else ""}" aria-label="Zoom to {n}">{n}</button>' for k, n in stops) + '</nav>'


def ask(text='Type a word, and I’ll fly there', typed=False):
    caret = '<span class="caret"></span>' if typed else ''
    return f'<div class="ask"><button class="field{" typed" if typed else ""}">{text}{caret}</button><button class="mic" aria-label="Talk to me">{MIC}</button></div>'


def callout(cid, at_px, align, tag, sub='', big='', lit=False, label=''):
    cls = 'co r' if 'r' in align else 'co'
    t = f'<span class="tag{" on" if lit else ""}">{tag}</span>'
    b = f'<span class="big">{big}</span>' if big else ''
    s = f'<span class="sub">{sub}</span>' if sub else ''
    return f'<button class="{cls}" id="{cid}" data-px="{at_px}" data-align="{align}" aria-label="{label or tag}">{t}{b}{s}</button>'


def lead(a, b, lit=False):
    return f'<svg class="lead{" on" if lit else ""}" data-lead="#{a}|#{b}" aria-hidden="true"></svg>'


def screen(time, inner):
    return f'<div class="screen"><canvas class="gl"></canvas>{status_bar(time)}{inner}{HOME_INDICATOR}</div>'


def w2page(title, time, inner, js, theme='reactor'):
    return page(title, screen(time, inner), theme=theme, scripts=('field.js',), gl=js, css=CSS)


def field_labels(here=None, near_points=True):
    out = []
    for key, name, x, z, n in SEEDS:
        far = key in ('see', 'make', 'life', 'me')
        if here is None and key in ('life', 'me'):
            continue
        out.append(region(key, name, x, z + 0.2, n, far=far, here=(key == here)))
    if here is None:
        out.append('<div class="truth ov" data-px="374 330" data-align="tr" style="text-align:right">Life · Me ↑ farther</div>')
    if near_points:
        out += [point('Arcade', -4.2, -3.0), point('School', -2.0, -3.0), point('Markets', 1.0, -3.0), point('Radio', 3.0, -4.6)]
    return ''.join(out)


# ------------------------------------------------------------------------------------------------ HOME
def home(theme='reactor', story=False):
    top = (f'<div class="top"><div class="truth">Fri 6 Nov · 21:08 · Birmingham · <b>9° clear</b></div>'
           f'<div class="say">Good evening, Boss.</div><div class="say2">Nothing needs you tonight. Shall we read? <span style="color:var(--accent-text)">{C.BOOK["title"]}</span>, page 42.</div></div>')
    cells = ''.join([
        f'<div class="ret on full" id="r-lib" data-box="-0.46 0 -1.46 0.46 0 -0.54" data-pad="0"></div>',
        cell(-1, -1, f'{CLOCK}God’s eye', '41 air', label='God’s eye, recent'),
        cell(0, -1, f'{CLOCK}Library', 'p. 42/112', cls='lit', label='Library, recent: carry on'),
        cell(1, -1, f'{CLOCK}Brief', '9° clear', label='Brief, recent'),
        cell(-1, 0, f'Lens{STAR}', 'Ready', label='Lens, favourite'),
        cell(1, 0, f'Agenda{STAR}', 'Dentist 09:15', label='Agenda, favourite'),
        cell(-1, 1, f'Gym{STAR}', 'Sudoku Lv 6', label='Gym, favourite'),
        cell(0, 1, f'Courses{STAR}', 'Lesson 3', label='Courses, favourite'),
        cell(1, 1, 'Free', 'nothing yet', cls='free', label='A free square'),
    ])
    inner = top + field_labels() + cells + scale('hand') + ask()
    return w2page('W2 · Home', '21:08', inner, gl(CAM_HOME), theme)


# ------------------------------------------------------------------------------------------------ SHOW (the Stage: the deepest zoom of the Journey)
CAM_CITY = dict(pos=[2.1, 10.4, 0.92], tgt=[0.55, 0.0, 0.9], fov=50)
FRAME = [16, 156, 374, 556]


def crumb(parts, lit_last=True):
    seg = '<button aria-label="Back to the orb"><span class="orbslot" style="display:inline-block;width:28px;height:28px;vertical-align:middle"></span></button>'
    for i, p in enumerate(parts):
        last = i == len(parts) - 1
        seg += '<span>›</span>' + (f'<b>{p}</b>' if last and lit_last else f'<button>{p}</button>')
    return seg


def show(story=False):
    S = C.STAGE
    w0, ns, cov = ROUTE[0], ROUTE[5], ROUTE[10]
    inner = (
        f'<nav class="crumb" style="top:96px" aria-label="Where on the map">{crumb(["Plan", "Tomorrow", "The 7:42"])}</nav>'
        f'<div class="truth ov" data-px="374 74" data-align="r" style="text-align:right">07:12 · zoom · <i>inside</i></div>'
        f'<div class="frame" style="top:156px;height:400px"></div>'
        f'<div class="ret" id="r-home" data-box="{w0[0]-.12} 0 {w0[1]-.12} {w0[0]+.12} 0 {w0[1]+.12}" data-min="24"></div>'
        + callout('c-home', '28 170', 'tl', 'Home', sub='Leave by 07:24', label='Home') + lead('c-home', 'r-home') +
        f'<div class="ret on full" id="r-ns" data-box="{ns[0]-.32} 0 {ns[1]-.2} {ns[0]+.32} 0 {ns[1]+.2}" data-pad="4"></div>'
        + callout('c-ns', '362 300', 'tr', 'New Street · platform 3', sub='07:42 to Coventry · on time', lit=True, label='The 7:42 from New Street') + lead('c-ns', 'r-ns', lit=True) +
        f'<div class="ret" id="r-cov" data-box="{cov[0]-.12} 0 {cov[1]-.12} {cov[0]+.12} 0 {cov[1]+.12}" data-min="24"></div>'
        + callout('c-cov', '362 540', 'br', 'Coventry', sub='Arrives 08:03', label='Coventry') + lead('c-cov', 'r-cov') +
        f'<div class="say-stage" style="top:572px"><div class="say">{S["sentence"]}</div></div>'
        '<div class="readings" style="top:648px">' + ''.join(f'<div class="rd"><span class="l">{l}</span><span class="v">{v}</span></div>' for l, v in S['readings']) + '</div>'
        + ask(S['ask_placeholder'])
    )
    js = gl(CAM_CITY, city=1.0, city_at=(0, 0), clip=FRAME, orb_at=[30, 118, 2.0, 11], orb_lit=1.2)
    return w2page('W2 · Home, showing' if not story else 'W2 · story 4', S['time'], inner, js)


# ------------------------------------------------------------------------------------------------ HUB (the Learn territory, from lower)
def hub():
    cards = C.HUB['cards']
    lx, lz = -2.6, -3.9
    cam = dict(pos=[lx, 5.4, lz + 3.9], tgt=[lx, 0.0, lz - 0.6], fov=56)
    top = (f'<nav class="crumb" style="top:56px" aria-label="Where on the map">{crumb(["Learn"])}</nav>'
           f'<div class="top" style="top:104px"><div class="title" style="margin-top:0">Learn</div><div class="say2">{C.HUB["line"]}</div></div>')

    def plot(pid, px_, align, mx, mz, name, flag, title='', reads=None, sub='', works=False, cls='', w=172):
        r = ''
        if reads:
            r = '<span class="reads">' + ''.join(f'<span class="rd"><span class="l">{l}</span><span class="v">{v}{f"<small>{u}</small>" if u else ""}</span></span>' for l, v, u in reads) + '</span>'
        t = f'<span class="ttl">{title}</span>' if title else ''
        sb = f'<span class="sub">{sub}</span>' if sub else ''
        wk = '<span class="works">In the works</span>' if works else ''
        lit = ' on' if 'lit' in cls else ''
        return (f'<button class="plot {cls}" id="{pid}" data-px="{px_}" data-align="{align}" style="width:{w}px" aria-label="{name}"><span class="tag{lit}">{name}{flag}</span>{t}{r}{sb}{wk}</button>'
                f'<div class="ret{" on full" if lit else ""}" id="{pid}-m" data-box="{mx-.16} 0 {mz-.16} {mx+.16} 0 {mz+.16}" data-min="12"></div>' + lead(pid, f'{pid}-m', lit=bool(lit)))
    plots = ''.join([
        plot('p-sch', '16 214', 'tl', lx - 1.4, lz - 1.0, 'School', '', sub='Nursery · 7 papers'),
        plot('p-arc', '374 214', 'tr', lx + 1.4, lz - 1.0, 'Arcade', '', sub='16 free · Epic Pinball'),
        plot('p-lrn', '16 286', 'tl', lx - 1.4, lz - 0.3, 'Learning', '', sub='12 days · 9 skills', works=True),
        plot('p-coa', '374 286', 'tr', lx + 1.4, lz - 0.3, 'Coach', '', sub='3 days · 5 passed', works=True),
        plot('p-gym', '16 452', 'tl', lx - 1.2, lz + 0.5, 'Gym', f' {STAR} · training', title=cards['gym']['title'], reads=cards['gym']['reads'], cls='open'),
        plot('p-cou', '374 452', 'tr', lx + 1.2, lz + 0.5, 'Courses', f' {STAR}', title=cards['learn']['title'], reads=cards['learn']['reads'], cls='open'),
        plot('p-lib', '16 578', 'tl', lx, lz + 1.1, 'Library', f' · {CLOCK} recent', title=cards['library']['title'], reads=[('Reading', 'Alice’s Adventures in Wonderland', ''), ('Page', '42 of 112', '')], cls='open lit', w=358),
    ])
    folded = '<div class="kick ov" data-px="16 196" data-align="tl">Far · folded to a line</div><div class="kick ov" data-px="16 434" data-align="tl">Near · open</div>'
    inner = top + folded + plots + scale('areas') + ask('Find anything in Learn')
    js = gl(cam, orb=[0, -9, 0, 0.01], here=2, dots=1.0, orb_at=[30, 78, 2.0, 11], orb_lit=1.0)
    return w2page('W2 · Learn', '21:11', inner, js)


# ------------------------------------------------------------------------------------------------ LENS (what the camera sees, plotted)
def lens():
    L = C.LENS
    img = svg_data(kit.lens_scene('ls'))
    out = []
    coords = {'plant': '−0.31 · 0.88 m', 'text': '0.18 · 0.62 m', 'barcode': '0.22 · 0.71 m'}
    for k, (x, y, w, h) in kit.TAGS.items():
        t = next(t for t in L['tags'] if t['id'] == k)
        lit = k == 'text'
        cls = ' on full' if lit else (' below' if k == 'plant' else ' r')
        out.append(f'<button class="ret{cls}" data-px="{(x + w / 2) / 4.4:.2f}% {(y + h / 2) / 9.56:.2f}%" '
                   f'style="width:{w / 4.4:.2f}vw;height:{h / 9.56:.2f}vh" aria-label="{t["noun"]}"><span class="tag{" on" if lit else ""}">{t["noun"]} · {t["hint"]}</span>'
                   f'<span class="sub">{coords[k]}</span></button>')
    # the view's own map: the table from above, the camera's cone, the three things plotted where they stand
    inset = ('<div class="inset" style="top:96px"><svg width="117" height="117" viewBox="0 0 120 120" aria-hidden="true">'
             '<g stroke="rgba(236,232,223,.14)" stroke-width="1">' + ''.join(f'<path d="M{i} 0V120M0 {i}H120"/>' for i in range(10, 120, 12)) + '</g>'
             '<path d="M60 112L14 30M60 112L106 30" stroke="rgba(236,232,223,.55)" stroke-width="1" stroke-dasharray="3 3" fill="none"/>'
             '<rect x="56" y="108" width="8" height="8" fill="rgb(236,232,223)"/>'
             '<g fill="none" stroke-width="1.5"><rect x="33" y="34" width="10" height="10" stroke="rgb(236,232,223)"/>'
             '<rect x="67" y="56" width="10" height="10" stroke="rgb(var(--accent-rgb))"/><rect x="71" y="45" width="10" height="10" stroke="rgb(236,232,223)"/></g>'
             '</svg></div><div class="kick ov" data-px="374 220" data-align="tr" style="text-align:right">What I see, from above</div>')
    a = L['act']
    top = '<div class="top"><div class="truth">18:26 · the Lens · <b>3 things plotted</b></div></div>'
    act = (f'<div class="act" style="bottom:calc(var(--safe-bottom) + 8px + 48px + 16px)"><div class="kick">{a["kicker"]} · 0.62 m away</div><h2>{a["title"]}</h2><p>{a["body"]}</p>'
           f'<div class="keys"><button class="key fill">{a["actions"][0]}</button><button class="key">{a["actions"][1]}</button></div></div>')
    cam = dict(pos=[0, 1.05, 0.95], tgt=[0, 0, -0.9], fov=70)
    js = gl(cam, orb=[0, -9, 0, 0.01], orb_lit=0, field=0.0, dots=0.0, image=img, lens=1.0, grid_k=10.0)
    return w2page('W2 · Lens', L['time'], top + ''.join(out) + inset + act + ask('Ask me about it'), js)


# ------------------------------------------------------------------------------------------------ READER (inside Library: the page)
def reader():
    B = C.BOOK
    paras = ''
    for i, (kind, txt) in enumerate(C.READER_TEXT[:5]):
        if kind == 'mark':
            paras += f'<div class="mark">Page {txt}</div>'
        else:
            paras += f'<p class="{"lit" if i == C.READER_LIT else ""}">{txt}</p>'
    pills = ''.join(f'<button class="{"here" if i == 0 else ""}">{p}</button>' for i, p in enumerate(C.READER_PILLS))
    nav = f'<nav class="crumb" style="top:56px" aria-label="Where on the map">{crumb(["Learn", "Library", "Alice, p. 42"])}</nav>'
    head = f'<div class="truth ov" data-px="16 106" data-align="tl">{B["title"]} · page 42 of 112 · {B["when"]}</div>'
    pg = (f'<article class="page" style="top:128px;height:440px;overflow:hidden"><div class="pills">{pills}</div><div class="text">{paras}</div></article>')
    listen = (f'<div class="listen" style="top:580px"><span class="orbslot"></span><div class="what"><b>Reading to you</b><span>My own voice · passage 3 of 7</span></div>'
              f'<button class="key" aria-label="Pause">{PAUSE}</button><button class="key" aria-label="Next passage">{NEXT}</button></div>')
    near = '<div class="kick" style="position:absolute;z-index:4;left:var(--gutter);top:648px">Nearest on the map · the shelf</div><div class="near" style="top:668px">'
    for b in C.SHELF:
        pct = int(b['pct'] * 100)
        near += (f'<button aria-label="{b["title"]}">{cover(b["id"], 32, "n" + b["id"])}<span class="t"><b>{b["title"]}</b>'
                 f'<span class="au">{b["author"]}</span><span class="bar"><i style="width:{pct}%"></i></span><span class="pr">{b["progress"]}</span></span></button>')
    near += '</div>'
    cam = dict(pos=[-2.5, 3.2, -1.2], tgt=[-2.5, 0.0, -3.0], fov=60)
    js = gl(cam, orb=[0, -9, 0, 0.01], here=2, dots=0.6, orb_at=[44, 608, 1.2, 15], orb_lit=1.1)
    return w2page('W2 · Reader', '21:14', nav + head + pg + listen + near, js)


# ------------------------------------------------------------------------------------------------ the STORYBOARD: Home → the 7:42
STORY = [
    ('He types a word', '07:12. He types “train”. Before he finishes, the Journey is plotted in Plan and a flight path runs to it from the orb.'),
    ('Up', 'The camera rises: the whole field at once, every area and every point; the scale moves to All.'),
    ('Across and down', 'It crosses to Plan and dives at the Journey’s point; inside its square the field is already the city.'),
    ('The Stage', 'At the deepest zoom the point is the thing: the streets, the walk and the train. Pinch out and he is home.'),
]


def story(i):
    if i == 4:
        return show(story=True)
    jx, jz = JOURNEY
    if i == 1:
        top = (f'<div class="top"><div class="truth">Fri 6 Nov · 07:12 · Birmingham · <b>6° clear</b></div>'
               f'<div class="say">Good morning, Boss.</div></div>')
        j = (f'<div class="ret on full" id="r-j" data-box="{jx-.34} 0 {jz-.34} {jx+.34} 0 {jz+.34}"></div>'
             + callout('c-j', '362 214', 'tr', 'The 7:42 · plan', sub='New Street · 07:42', lit=True, label='The 7:42') + lead('c-j', 'r-j', lit=True))
        path = f'<svg class="lead on" data-lead="#r-orbfoot|#r-j" aria-hidden="true"></svg><div id="r-orbfoot" class="ov" data-at="0 0.5 0" style="width:2px;height:2px"></div>'
        inner = top + field_labels(near_points=False) + j + path + scale('hand') + ask('train', typed=True)
        return w2page('W2 · story 1', '07:12', inner, gl(CAM_HOME, orb_lit=1.3, city_at=JOURNEY, city_r=0.0))
    if i == 2:
        cam = dict(pos=[0.4, 19.0, 3.0], tgt=[0.4, 0.0, -5.6], fov=56)
        j = f'<div class="ret on full" data-box="{jx-.34} 0 {jz-.34} {jx+.34} 0 {jz+.34}" data-min="16"></div>'
        inner = (f'<div class="top"><div class="truth">Altitude · <b>all of it</b> · 44 screens · 151 abilities</div></div>'
                 + field_labels(near_points=False) + j + scale('all') + ask('train', typed=True))
        return w2page('W2 · story 2', '07:12', inner, gl(cam, orb_lit=1.3, city_at=JOURNEY, city_r=0.0))
    cam = dict(pos=[jx + 0.2, 2.6, jz + 2.2], tgt=[jx, 0.0, jz - 0.4], fov=56)
    inner = ('<div class="top"><div class="truth">Diving · Plan › the 7:42</div></div>'
             f'<div class="region here ov" data-at="{jx} 0 {jz - 1.6}">Plan<small>4 screens</small></div>'
             + scale('inside') + ask('train', typed=True))
    return w2page('W2 · story 3', '07:12', inner, gl(cam, orb=[0, -9, 0, 0.01], here=3, city_at=JOURNEY, city_r=1.25, scale=1.7))


if __name__ == '__main__':
    write(HERE, 'home.html', home())
    write(HERE, 'home-ember.html', home('ember'))
    write(HERE, 'show.html', show())
    write(HERE, 'hub.html', hub())
    write(HERE, 'lens.html', lens())
    write(HERE, 'reader.html', reader())
    for i in range(1, 5):
        write(HERE, f'story-{i}.html', story(i))
    write(HERE, 'story.html', kit.story_sheet('W2 · The Map', 'Home becomes the 7:42',
                                             'Everything Ghosty can see and do is plotted on one map round the orb. He types a word; the camera rises, crosses and dives, and at the deepest zoom the point is the thing.', STORY))
    write(HERE, 'contact.html', kit.contact_sheet('W2 · The Map', 'the Field, as the Machine sees it',
                                                 'Everything Ghosty can see and do is plotted on one map round the orb; pinch is altitude, a typed word is a flight, and the Stage is the deepest zoom of the thing.',
                                                 story_caps=[s[0] for s in STORY]))
    print('directions-2/w2: home, home-ember, show, hub, lens, reader, story-1..4, story, contact')
