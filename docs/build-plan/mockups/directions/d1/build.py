"""D1 · ORBIT: Mind is the navigation. No bar, no tabs. On Home the orb is at the centre, the areas stand on its orbit, recents and
favourites hang under it, a press on it opens the typed word; on every other screen the orb sits bottom left as the open end of a
line (press to type, hold and the areas open round it); a layer rises out of it, the Stage grows out of it into a sphere.
Writes five screens (home, show, hub, lens, reader), the Shelf as a sixth small frame, home-ember and the contact sheet, as static
HTML beside this file.
Run from the repo root:  python3 -I -B docs/build-plan/mockups/directions/d1/build.py
then:                    node docs/build-plan/mockups/tools/render.mjs directions/d1
Every word is real (lib/content.py: hubcards.ts's own names and readouts, a real book, a real station)."""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'lib'))
import content as C  # noqa: E402
from content import is_figure  # noqa: E402
from cover import cover  # noqa: E402
from glyphs import glyph  # noqa: E402
from map import route_map  # noqa: E402
from orb import orb, ring_ticks  # noqa: E402
from phone import HOME_INDICATOR, page, status_bar, write  # noqa: E402
from scene import TAGS, lens_scene  # noqa: E402
from sky import sky  # noqa: E402

g = glyph
# the six areas on the orbit, clockwise from the upper right; Learn is lit tonight (the evening read lives there)
STATIONS = [('see', 30), ('make', 90), ('learn', 150), ('plan', 210), ('life', 270), ('me', 330)]


def ghost(placeholder='Ask or find anything', live=False, transport=None):
    """Mind on every screen but Home: the orb is the open end of a line. Press it to type, hold it and the areas open round it."""
    mid = transport or f'<button class="field">{placeholder}</button><button class="mic" aria-label="Talk to me">{g("mic")}</button>'
    ring = '<span class="pulse"></span>' if live else ''
    return (f'<div class="ghostfade"></div><div class="ghost{" transport" if transport else ""}">'
            f'<button class="orbbtn" aria-label="Mind: press to ask, hold for the areas">{ring}{orb(52, "glass", "gh", detail="full", halo=.9, label="Mind")}</button>{mid}</div>')


def figure_val(label, value, unit=''):
    cls = 'val num' if is_figure(value) else 'val'
    extra = f'<small>{unit}</small>' if unit.startswith('↑') else (f' {unit}' if unit else '')
    return f'<div><span class="rl">{label}</span><div class="{cls}">{value}{extra}</div></div>'


# ============================================================================================ HOME, idle (the evening)
def home(theme='reactor'):
    b = C.BOOK
    stations = ''
    for aid, t in STATIONS:
        a = next(x for x in C.AREAS if x['id'] == aid)
        stations += (f'<button class="st{" hot" if aid == "learn" else ""}" style="--sx:{math.sin(math.radians(t)):.4f};--sy:{-math.cos(math.radians(t)):.4f}" aria-label="{a["name"]}">'
                     f'<span class="disc">{g(a["glyph"], "i sm")}</span><span class="nm">{a["name"]}</span></button>')
    orbit = ('<svg class="orbit" aria-hidden="true" data-bleed><g fill="none">'
             '<ellipse cx="50%" cy="50%" rx="50%" ry="50%" style="stroke:var(--orbit)" stroke-width="1"/>'
             '<ellipse cx="50%" cy="50%" rx="50%" ry="50%" style="stroke:rgba(var(--accent-pale-rgb),.20)" stroke-width="5" stroke-dasharray="1 8"/>'
             '<ellipse cx="50%" cy="50%" rx="50%" ry="50%" style="stroke:rgba(var(--accent-pale-rgb),.5)" stroke-width="9" stroke-dasharray="1.2 55"/></g></svg>')
    tray = (f'<div class="tray" role="group" aria-label="Recent and starred">'
            f'<button>{g("clock")}<span>Library</span></button>'
            f'<button class="star">{g("star")}<span>Lens</span></button>'
            f'<button class="star">{g("star")}<span>Agenda</span></button>'
            f'<button class="more" aria-label="All recent and starred">{g("dots")}</button></div>')
    body = f'''<div class="screen home">
  {sky()}
  {status_bar(C.EVENING)}
  <div class="col homecol" style="padding-bottom:calc(var(--safe-bottom) + var(--s-2))">
    <header class="hd"><span class="kicker">{C.DAY_LONG} · {C.HOME['weather'].replace(' in Birmingham', '')}</span><h1>{C.HOME['greeting']}</h1></header>
    <section class="system" aria-label="Mind and the areas"><div class="sys-in">
      {orbit}
      <button class="core" aria-label="Mind: press to ask, or to find anything"><span class="press"></span>{orb(148, 'glass', 'home', halo=1.0, label='Mind')}</button>
      {stations}
    </div></section>
    <p class="hint cap">{C.HOME['hint']}</p>
    {tray}
    <article class="hour" aria-label="Carry on reading">
      {cover(b['id'], 44, 'hc')}
      <div><span class="kicker acc">Carry on reading</span><h2>{b['title']}</h2><p class="cap">Page <b class="num">{b['page']}</b> of <b class="num">{b['of']}</b> · {b['when']}</p></div>
      <button class="round" aria-label="Read it to me">{g('listen2')}</button>
    </article>
  </div>
  {HOME_INDICATOR}
</div>'''
    return page('D1 · Home', body, theme=theme)


# ============================================================================================ HOME, showing (the Stage grows out of the orb)
def stage_fx():
    """The sphere's own marks, over the map: a graticule, and the equator scale as a ring in front (its tips stand outside)."""
    R, cx, cy = 100 / 1.2, 100.0, 100.0
    rx, ry = R * 1.12, R * 0.27
    grat = ''.join(f'<ellipse cx="{cx}" cy="{cy}" rx="{abs(R * math.cos(math.radians(l))):.2f}" ry="{R:.2f}"/>' for l in (20, 50, 80, 110, 140, 170))
    for lat in (-60, -30, 30, 60):
        rr = R * math.cos(math.radians(lat))
        grat += f'<ellipse cx="{cx}" cy="{cy + R * math.sin(math.radians(lat)) * .9:.2f}" rx="{rr:.2f}" ry="{rr * .30:.2f}"/>'
    front = f'M{cx - rx:.2f} {cy}A{rx:.2f} {ry:.2f} 0 0 0 {cx + rx:.2f} {cy}'
    ticks = ring_ticks(cx, cy, rx, ry, 'front', 1.6, 3.4, step=2.0, every=5)
    sweep = ring_ticks(cx, cy, rx, ry, 'front', 1.9, 4.2, step=1.2, every=4, lo=24, hi=78)
    return (f'<svg class="stage-fx" viewBox="0 0 200 200" aria-hidden="true" data-bleed><defs><clipPath id="sfc"><circle cx="{cx}" cy="{cy}" r="{R:.2f}"/></clipPath></defs>'
            f'<g clip-path="url(#sfc)" fill="none" style="stroke:rgba(var(--accent-pale-rgb),.10)" stroke-width=".4">{grat}</g>'
            f'<path d="{front}" fill="none" style="stroke:rgba(var(--accent-pale-rgb),.85)" stroke-width=".7"/>'
            f'<path d="{ticks}" fill="none" style="stroke:rgba(var(--accent-pale-rgb),.7)" stroke-width=".45"/>'
            f'<path d="{sweep}" fill="none" style="stroke:rgb(var(--accent-rgb))" stroke-width=".6"/></svg>')


def show():
    s = C.STAGE
    reads = ''.join(f'<div class="{"lead" if i == 0 else ""}"><span class="kicker">{k}</span><b class="num">{v}</b></div>' for i, (k, v) in enumerate(s['readings']))
    body = f'''<div class="screen show">
  {sky(seed=9)}
  {status_bar(s['time'])}
  <div class="col stagecol">
    <header class="top"><button class="chipb">{g('back', 'i sm')}<span>Home</span></button><button class="roundb" aria-label="More">{g('dots')}</button></header>
    <div class="stagegroup">
    <section class="stagewrap" aria-label="{s['title']}">
      <div class="stage-clip">{route_map('sm', labels={'SNOW HILL': (92, 172, '')})}</div>
      <div class="stage-rim"></div>
      {stage_fx()}
    </section>
    <div class="readcap">{reads}</div>
    <p class="say">That’s the 7:42 from New Street.<span>Platform 3 — I’ll say when to leave.</span></p></div>
  </div>
  {ghost(s['ask_placeholder'])}
  {HOME_INDICATOR}
</div>'''
    return page('D1 · Home, showing', body)


# ============================================================================================ ONE HUB: Learn
def _kicker(c):
    live = c.get('live')
    return f'<div class="ck">{g(c["glyph"], "i")}<b>{c["name"]}</b><em class="st2{" live" if live else ""}">{c["status"].title()}</em></div>'


def big_card(c):
    r1, r2 = c['reads']
    panels = ''.join(f'<button class="chip">{p}</button>' for p in c['panels'])
    return f'''<article class="card live big">{_kicker(c)}<div class="ct">{c['title']}</div>
  <div class="reads">{figure_val(*r1)}{figure_val(*r2)}</div><div class="panels">{panels}</div></article>'''


def small_card(c):
    rows = ''.join(f'<div class="rd"><span class="rl">{k}</span><span class="{"val num" if is_figure(v) else "val"}">{v}{("<small>" + u + "</small>") if u.startswith("↑") else (" " + u if u else "")}</span></div>' for k, v, u in c['reads'])
    return f'<article class="card small{" live" if c.get("live") else ""}">{_kicker(c)}<div class="ct">{c["title"]}</div>{rows}</article>'


def fold_row(c):
    (k1, v1, u1), (k2, v2, u2) = c['reads']
    return (f'<div class="frow{" works" if c.get("works") else ""}">{g(c["glyph"], "i sm")}<div><div class="nm">{c["name"]}</div><div class="tt">{c["title"]}</div></div>'
            f'<div class="rr"><span>{k1}</span><b class="num">{v1}{(" " + u1) if u1 else ""}</b><span>{k2}</span><b class="num">{v2}{(" " + u2) if u2 else ""}</b></div></div>')


def hub():
    H = C.HUB
    cards = H['cards']
    body = f'''<div class="screen hub">
  {sky(seed=5)}
  {status_bar('21:11')}
  <div class="col">
    <div class="titlebar"><button class="roundb" aria-label="Back to Home">{g('back')}</button><h1>{H['title']}</h1></div>
    <p class="cap hubline">{H['line']}</p>
    <div class="stack">
      <section class="tier"><div class="tl"><i></i>Everything else · {len(H['rest'])}<em><b></b>In the works</em></div><div class="fold">{''.join(fold_row(cards[k]) for k in H['rest'])}</div></section>
      <section class="tier"><div class="tl"><i></i>Favourites</div><div class="pair">{''.join(small_card(cards[k]) for k in H['favourites'])}</div></section>
      <section class="tier"><div class="tl rec"><i></i>Recent</div>{big_card(cards['library'])}</section>
    </div>
  </div>
  <span class="thread" aria-hidden="true"></span>
  {ghost('Find anything in Learn')}
  {HOME_INDICATOR}
</div>'''
    return page('D1 · Hub, Learn', body)


# ============================================================================================ THE LENS
def lens(picked='text'):
    L = C.LENS
    tags = ''
    for t in L['tags']:
        x, y, w, h = TAGS[t['id']]
        tags += (f'<div class="tag{" on" if t["id"] == picked else ""}{" rt" if t["id"] == "barcode" else ""}" style="left:{x / 440 * 100:.3f}%;top:{y / 956 * 100:.3f}%;width:{w / 440 * 100:.3f}%;height:{h / 956 * 100:.3f}%">'
                 f'<span class="lab">{t["noun"]}&nbsp;<em>· {t["hint"]}</em></span></div>')
    a = L['act']
    body = f'''<div class="screen lens">
  <div class="cam">{lens_scene()}</div><div class="shade"></div>
  {status_bar(L['time'])}
  <header class="lenstop"><button class="roundb" aria-label="Back">{g('back')}</button><span class="lenstat"><i></i>{L['status']}</span><button class="roundb" aria-label="Turn the camera round">{g('flip')}</button></header>
  {tags}
  <div class="callout" role="status"><span class="leader" style="left:calc(90vw - var(--gutter));height:calc(100vh * .5377 - 262px)"></span>
    <h2>{a['title']}</h2><p>{a['body']}</p>
    <div class="acts"><button class="btn primary">{g('agenda')}<span>{a['actions'][0]}</span></button><button class="btn">{g('listen2')}<span>Read it</span></button></div>
  </div>
  {ghost('Ask me about it')}
  {HOME_INDICATOR}
</div>'''
    return page('D1 · Lens', body)


# ============================================================================================ THE READER
def reader():
    b = C.BOOK
    paras = ''
    for i, (kind, text) in enumerate(C.READER_TEXT):
        paras += f'<div class="mark">{text}</div>' if kind == 'mark' else f'<p class="para{" lit" if i == C.READER_LIT else ""}">{text}</p>'
    pills = ''.join(f'<button class="pill{" on" if i == 0 else ""}">{p}</button>' for i, p in enumerate(C.READER_PILLS))
    bars = ''.join(f'<i style="height:{h}px"></i>' for h in (5, 9, 13, 8, 4))
    transport = (f'<div class="tx"><b><span class="wave">{bars}</span>Reading to you</b><span class="cap">My own voice · passage 3 of 7</span></div>'
                 f'<button class="go" aria-label="Pause">{g("pause")}</button>')
    body = f'''<div class="screen reader">
  {sky(seed=2)}
  {status_bar('21:14')}
  <div class="col">
    <header class="rtop"><button class="roundb" aria-label="Back to the shelf">{g('back')}</button><div class="grp"><button class="roundb" aria-label="Text size">{g('type')}</button><button class="roundb" aria-label="More">{g('dots')}</button></div></header>
    <p class="rline"><b>{b['title']}</b>page {b['page']} of {b['of']} · {b['when']}</p>
    <nav class="pills" aria-label="Book sections">{pills}</nav>
    <article class="page"><div class="flow">{paras}</div></article>
  </div>
  {ghost(transport=transport, live=True)}
  {HOME_INDICATOR}
</div>'''
    return page('D1 · Reader', body)


# ============================================================================================ THE SHELF (a sixth, small frame)
def shelf():
    rows = ''
    for i, k in enumerate(C.SHELF):
        done = k['progress'] == 'Finished'
        fresh = k['progress'] == 'Not started'
        pg = k['progress'].split()
        status = (f'<span class="done">{g("check")}Finished</span> · {k["when"]}' if done else
                  (f'Not started · {k["when"]}' if fresh else f'Page <b class="num">{pg[1]}</b> of <b class="num">{pg[3]}</b> · {k["when"]}'))
        rows += f'''<article class="brow{" now" if i == 0 else ""}">{cover(k['id'], 56, 'b' + k['id'])}<div><h2>{k['title']}</h2><p class="by">{k['author']}</p>
          <div class="prog"><i style="width:{k['pct'] * 100:.1f}%"></i></div><p class="cap">{status}</p></div></article>'''
    sorts = ''.join(f'<button class="pill{" on" if i == 0 else ""}">{s}</button>' for i, s in enumerate(['Recent', 'Progress', 'Title']))
    body = f'''<div class="screen shelfscr">
  {sky(seed=6)}
  {status_bar('21:03')}
  <div class="col">
    <div class="titlebar"><button class="roundb" aria-label="Back to Learn">{g('back')}</button><h1>Library</h1></div>
    <p class="cap hubline">{C.SHELF_LINE}</p>
    <nav class="sortrow" aria-label="Sort the shelf">{sorts}</nav>
    <div class="shelf fold">{rows}</div>
  </div>
  {ghost('Search the library')}
  {HOME_INDICATOR}
</div>'''
    return page('D1 · Shelf', body)


# ============================================================================================ the contact sheet (five, at 390)
SHEET = [('home', 'Home', 'Mind at the centre; the areas on its orbit; recents hang under it'), ('show', 'Home, showing', 'The Stage grows out of the orb into a sphere'),
         ('hub', 'A hub, Learn', 'Layers by distance from the orb: recent nearest'), ('lens', 'The Lens', 'Machine boxes; the orb is the open end of a line'), ('reader', 'The Reader', 'Alice, page 42; the orb breathes as I read')]


def contact():
    cells = ''.join(f'<figure><div class="ph"><img src="{n}-390.png" alt="{lab}"></div><figcaption><b>{i + 1}</b>{lab}<span>{why}</span></figcaption></figure>' for i, (n, lab, why) in enumerate(SHEET))
    css = '''
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #04060b; color: #e8f1fa; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; width: 1732px; padding: 48px 56px 56px; }
header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 36px; }
h1 { font-size: 34px; line-height: 40px; font-weight: 600; letter-spacing: -.7px; } h1 span { color: rgba(232,241,250,.5); font-weight: 400; }
header p { font-size: 17px; color: rgba(232,241,250,.6); }
.row { display: flex; gap: 40px; }
figure { width: 292px; }
.ph { width: 292px; height: 632px; border-radius: 44px; overflow: hidden; box-shadow: 0 0 0 1.5px rgba(232,241,250,.12), 0 0 0 7px #0a0e16, 0 0 0 8px rgba(232,241,250,.14), 0 30px 60px rgba(0,0,0,.5); }
.ph img { width: 292px; height: 632px; display: block; }
figcaption { margin-top: 26px; text-align: center; font-size: 17px; font-weight: 600; letter-spacing: -.2px; }
figcaption b { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 12px; margin-right: 8px; font-size: 12px; background: rgba(232,241,250,.12); vertical-align: 1px; }
figcaption span { display: block; margin-top: 6px; font-size: 13px; font-weight: 400; color: rgba(232,241,250,.55); letter-spacing: 0; }
'''
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>D1 · contact sheet</title><link rel="stylesheet" href="../../fonts.css"><meta name="mock-scale" content="1.5"><style>{css}</style></head>
<body><header><h1>D1 <span>· orbit: Mind is the navigation</span></h1><p>No bar · the areas on the orb’s orbit · the Stage grows out of the orb</p></header><div class="row">{cells}</div></body></html>
'''


if __name__ == '__main__':
    write(HERE, 'home.html', home())
    write(HERE, 'show.html', show())
    write(HERE, 'hub.html', hub())
    write(HERE, 'lens.html', lens())
    write(HERE, 'reader.html', reader())
    write(HERE, 'shelf.html', shelf())
    write(HERE, 'home-ember.html', home('ember'))
    write(HERE, 'contact.html', contact())
    print('D1: home, show, hub, lens, reader, shelf, home-ember, contact')
