"""D2 · ONE INK: a new visual language that drops the current look entirely. Bone ink on warm black, a serif for Ghosty's voice,
a sans for the work, a mono for readings; rules instead of boxes, square corners, layers as numbered sections; the orb is the one
round, lit thing. Writes five screens (home, show, hub, lens, reader), the Shelf as a sixth small frame, home-ember (the same Home
under Ember) and the contact sheet, as static HTML beside this file.
Run from the repo root:  python3 -I -B docs/build-plan/mockups/directions/d2/build.py
then:                    node docs/build-plan/mockups/tools/render.mjs directions/d2
Every word is real (lib/content.py: hubcards.ts's own names and readouts, a real book, a real station)."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'lib'))
import content as C  # noqa: E402
from content import is_figure  # noqa: E402
from cover import cover  # noqa: E402
from glyphs import glyph  # noqa: E402
from map import route_map  # noqa: E402
from orb import orb  # noqa: E402
from phone import HOME_INDICATOR, page, status_bar, write  # noqa: E402
from scene import TAGS, lens_scene  # noqa: E402

g = glyph


def dock(placeholder='Ask or find anything', on=None, ask=True, over=False, caret=False):
    """The bottom of every screen: the typed word on a ruled line, and the areas as an index of words. The dot is Mind."""
    words = ''.join(f'<button class="{"on" if a == on else ""}">{n}</button>' for a, n in [('see', 'See'), ('make', 'Make'), ('learn', 'Learn'), ('plan', 'Plan'), ('life', 'Life')])
    cur = '<i class="caret"></i>' if caret else ''
    asked = f'<div class="ask"><button class="askf">{cur}{placeholder}</button><button class="speak kicker">Speak</button></div>' if ask else ''
    return (f'<div class="dock{" over" if over else ""}">{asked}<nav class="index" aria-label="Areas">'
            f'<button class="dotbtn" aria-label="Mind: home">{orb(24, "ink", "dk", detail="mini")}</button>{words}</nav></div>')


def figure(value, unit=''):
    if unit.startswith('↑'):
        return f'<span class="val num">{value}<small>{unit}</small></span>'
    return f'<span class="{"val num" if is_figure(value) else "val"}">{value}{(" " + unit) if unit else ""}</span>'


# ============================================================================================ HOME, idle (the evening)
def home(theme='reactor'):
    b = C.BOOK
    recents = ''.join(f'<button>{r["name"]}</button>' for r in C.RECENTS)
    favs = ''.join(f'<button>{f["name"]}</button>' for f in C.FAVOURITES)
    body = f'''<div class="screen home">
  {status_bar(C.EVENING)}
  <div class="col">
    <header class="mast"><span class="kicker">{C.DAY_LONG} · {C.HOME['weather'].replace(' in Birmingham', '')}</span><button class="word kicker" aria-label="Me">{C.NAME}</button></header>
    <section class="greet"><h1>{C.HOME['greeting']}</h1><p class="voice">{C.HOME['line']}</p></section>
    <section class="mind">{orb(216, 'ink', 'home', label='Mind')}</section>
    <section class="tonight sec first">
      <div class="slabel"><span class="kicker"><i class="n">01</i>Tonight</span><span class="kicker">Reading</span></div>
      <div class="book">{cover(b['id'], 48, 'hc')}<div><h2>{b['title']}</h2>
        <p class="num">page {b['page']} of {b['of']}</p><p class="when">{b['when']}</p></div></div>
      <div class="acts"><button class="btn primary">Carry on reading</button><button class="btn">Listen</button></div>
    </section>
    <section class="finds" aria-label="Recent and favourites">
      <div class="frow"><span class="kicker">Recent</span><div class="words">{recents}</div></div>
      <div class="frow"><span class="kicker">Favourites</span><div class="words">{favs}</div></div>
    </section>
  </div>
  {dock()}
  {HOME_INDICATOR}
</div>'''
    return page('D2 · Home', body, theme=theme)


# ============================================================================================ HOME, showing (the Stage as a plate)
def show():
    s = C.STAGE
    reads = ''.join(f'<div class="{"lead" if i == 0 else ""}"><span class="kicker">{k}</span><b class="num">{v}</b></div>' for i, (k, v) in enumerate(s['readings']))
    ticks = ('<svg class="plate-ticks" aria-hidden="true" data-bleed><defs><radialGradient id="pg" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".4"/></radialGradient>'
             '<mask id="pm"><rect width="100%" height="100%" fill="url(#pg)"/></mask></defs><g mask="url(#pm)">'
             '<rect width="100%" height="100%" fill="none" style="stroke:rgba(var(--ink-rgb),.45)" stroke-width="4" stroke-dasharray="1 7"/>'
             '<rect width="100%" height="100%" fill="none" style="stroke:rgba(var(--ink-rgb),.85)" stroke-width="8" stroke-dasharray="1 39"/></g></svg>')
    body = f'''<div class="screen show">
  {status_bar(s['time'])}
  <div class="col">
    <header class="mast"><button class="word l kicker">{g('back')}Home</button><button class="word kicker">Keep</button></header>
    <section class="plate" aria-label="{s['title']}">
      <div class="plate-in">{route_map('sm')}</div>
      {ticks}
      <div class="seal">{orb(56, 'ink', 'sl', detail='full', label='Mind')}</div>
      <div class="reads">{reads}</div>
    </section>
    <p class="cite"><span>Fig. 1 · {s['title']}</span><span><i class="dot live"></i> live</span></p>
    <p class="say">That’s the 7:42 from New Street.</p>
    <p class="say-2 voice">Platform 3 — I’ll say when to leave.</p>
  </div>
  {dock(s['ask_placeholder'])}
  {HOME_INDICATOR}
</div>'''
    return page('D2 · Home, showing', body)


# ============================================================================================ ONE HUB: Learn
def readouts(c):
    r1, r2 = c['reads']
    return (f'<div class="r2"><div><span class="kicker">{r1[0]}</span>{figure(r1[1], r1[2])}</div>'
            f'<div><span class="kicker">{r2[0]}</span>{figure(r2[1], r2[2])}</div></div>')


def block(c, n):
    panels = ''.join(f'<button>{p}</button>' for p in c['panels'])
    return f'''<section class="sec first"><div class="slabel"><span class="kicker"><i class="n">{n}</i>Recent</span><span class="kicker num">1</span></div>
  <article class="block"><div class="bh"><span class="bn"><b>{c['name']}</b><i class="ttl">{c['title']}</i></span><em class="st">{c['status'].title()}</em></div>{readouts(c)}<div class="words">{panels}</div></article></section>'''


def pair(cs, n):
    cols = ''
    for c in cs:
        live = c.get('live')
        rows = ''.join(f'<div class="rd"><span class="kicker">{k}</span>{figure(v, u)}</div>' for k, v, u in c['reads'])
        mark = '<i class="dot live"></i>' if live else ''
        st = f'<em class="st{" live" if live else ""}">{mark}{c["status"].title()}</em>'
        cols += f'<article class="col2"><div class="bh"><b>{c["name"]}</b>{st}</div><p class="ttl">{c["title"]}</p>{rows}</article>'
    return f'<section class="sec"><div class="slabel"><span class="kicker"><i class="n">{n}</i>Favourites</span><span class="kicker num">{len(cs)}</span></div><div class="cols">{cols}</div></section>'


def trow(c):
    (k1, v1, u1), (k2, v2, u2) = c['reads']
    mark = '<i class="dot works" title="In the works"></i>' if c.get('works') else ''
    return (f'<div class="trow"><div><div class="nm">{c["name"]}{mark}</div><div class="tt">{c["title"]}</div></div>'
            f'<div class="rr"><span class="kicker">{k1}</span><b>{v1}{(" " + u1) if u1 else ""}</b><span class="kicker">{k2}</span><b>{v2}{(" " + u2) if u2 else ""}</b></div></div>')


def hub_col():
    H = C.HUB
    cards = H['cards']
    rest = ''.join(trow(cards[k]) for k in H['rest'])
    return f'''<div class="col">
    <header class="mast"><button class="word l kicker">{g('back')}Home</button><button class="word kicker" aria-label="Me">{C.NAME}</button></header>
    <div class="hubhead"><h1>{H['title']}</h1><p class="voice">{H['line']}</p></div>
    <div class="secs">
      {block(cards['library'], '01')}
      {pair([cards[k] for k in H['favourites']], '02')}
      <section class="sec"><div class="slabel"><span class="kicker"><i class="n">03</i>Everything else</span><span class="kicker"><i class="dot works"></i> in the works · {len(H['rest'])}</span></div>{rest}</section>
    </div>
  </div>'''


def hub():
    body = f'''<div class="screen hub">
  {status_bar('21:11')}
  {hub_col()}
  {dock('Find anything in Learn', on='learn')}
  {HOME_INDICATOR}
</div>'''
    return page('D2 · Hub, Learn', body)


# ============================================================================================ the first press, from a hub: the ask line opens a layer of Recent and Favourites
def find():
    rows = ''
    for n, (label, items) in enumerate(C.FIND_ROWS, start=1):
        rows += f'<div class="lhd"><span class="kicker"><i class="n">0{n}</i>{label}</span><span class="kicker num">{len(items)}</span></div>'
        rows += ''.join(f'<button class="fr"><b>{name}</b><span>{line}</span></button>' for name, line in items)
    body = f'''<div class="screen hub findscr">
  {status_bar('21:11')}
  {hub_col()}
  <section class="layer" aria-label="Find">{rows}<p class="try voice">Or type a word: “chess”, “bins”, “convert”, “where is the car”.</p></section>
  {dock('Find anything', on='learn', caret=True)}
  {HOME_INDICATOR}
</div>'''
    return page('D2 · The ask line opened', body)


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
  <header class="lenstop"><button class="word kicker">{g('back')}Back</button><span class="mid"><i class="dot live"></i>{L['status']}</span><button class="word kicker">Flip</button></header>
  {tags}
  <div class="note" role="status"><span class="leader" style="left:calc(90vw - var(--gutter));height:calc(100vh * .5377 - 270px)"></span>
    <span class="kicker">{a['kicker']}</span><h2>{a['title']}</h2><p>{a['body']}</p>
    <div class="acts"><button class="btn primary">{a['actions'][0]}</button><button class="btn">Read it</button></div>
  </div>
  {dock(ask=False, over=True)}
  {HOME_INDICATOR}
</div>'''
    return page('D2 · Lens', body)


# ============================================================================================ THE READER
def reader():
    b = C.BOOK
    paras = ''
    for i, (kind, text) in enumerate(C.READER_TEXT):
        paras += f'<div class="mark">{text}</div>' if kind == 'mark' else f'<p class="para{" lit" if i == C.READER_LIT else ""}">{text}</p>'
    tabs = ''.join(f'<button class="{"on" if i == 0 else ""}">{p}</button>' for i, p in enumerate(C.READER_PILLS))
    bars = ''.join(f'<i style="height:{h}px"></i>' for h in (5, 9, 12, 8, 4))
    body = f'''<div class="screen reader">
  {status_bar('21:14')}
  <div class="col" style="padding-bottom:calc(var(--safe-bottom) + 72px)">
    <header class="running"><button class="word kicker">{g('back')}Library</button><button class="word r kicker" aria-label="Text size">Aa</button></header>
    <p class="rline"><b>{b['title']}</b><span>page {b['page']} of {b['of']} · {b['when']}</span></p>
    <nav class="tabs" aria-label="Book sections">{tabs}</nav>
    <article class="page" data-bleed><div class="flow">{paras}</div></article>
  </div>
  <div class="listen" role="group" aria-label="Listen"><div class="row">
    <button class="go" aria-label="Pause">{g('pause')}</button>
    <div class="tx"><b><span class="wave">{bars}</span>Reading to you</b><span>my own voice · passage 3 of 7</span></div>
    <button class="skip">Next</button></div></div>
  {HOME_INDICATOR}
</div>'''
    return page('D2 · Reader', body)


# ============================================================================================ THE SHELF (a sixth, small frame)
def shelf():
    rows = ''
    for k in C.SHELF:
        done = k['progress'] == 'Finished'
        fresh = k['progress'] == 'Not started'
        pg = k['progress'].split()
        status = (f'<span class="done">Finished</span> · {k["when"]}' if done else
                  (f'Not started · {k["when"]}' if fresh else f'page <b>{pg[1]}</b> of <b>{pg[3]}</b> · {k["when"]}'))
        rows += f'''<article class="bk">{cover(k['id'], 48, 'b' + k['id'])}<div><h2>{k['title']}</h2><p class="by">{k['author']}</p>
          <div class="rprog"><i style="width:{k['pct'] * 100:.1f}%"></i></div><p class="num">{status}</p></div></article>'''
    sorts = ''.join(f'<button class="{"on" if i == 0 else ""}">{s}</button>' for i, s in enumerate(['Recent', 'Progress', 'Title']))
    body = f'''<div class="screen shelfscr">
  {status_bar('21:03')}
  <div class="col">
    <header class="mast"><button class="word l kicker">{g('back')}Learn</button><button class="word kicker" aria-label="Me">{C.NAME}</button></header>
    <div class="hubhead"><h1>Library</h1><p class="voice">{C.SHELF_LINE}</p></div>
    <nav class="sorts" aria-label="Sort the shelf">{sorts}</nav>
    <div class="shelf">{rows}</div>
  </div>
  {dock('Search the library', on='learn')}
  {HOME_INDICATOR}
</div>'''
    return page('D2 · Shelf', body)


# ============================================================================================ the contact sheet (five, at 390)
SHEET = [('home', 'Home', 'Mind at the centre; tonight’s read; two lines of words'), ('show', 'Home, showing', 'The Stage is a plate; Mind its seal and its scale'),
         ('hub', 'A hub, Learn', 'Numbered layers: recent, favourites, the rest as a table'), ('lens', 'The Lens', 'Machine boxes; an annotation, not a card'), ('reader', 'The Reader', 'Alice, page 42, set as a book is set')]


def contact():
    cells = ''.join(f'<figure><div class="ph"><img src="{n}-390.png" alt="{lab}"></div><figcaption><b>{i + 1}</b>{lab}<span>{why}</span></figcaption></figure>' for i, (n, lab, why) in enumerate(SHEET))
    css = '''
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0b0a09; color: #ece6d8; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; width: 1732px; padding: 48px 56px 56px; }
header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 36px; }
h1 { font-family: 'Source Serif Mock', serif; font-size: 36px; line-height: 40px; font-weight: 400; letter-spacing: -.5px; } h1 span { color: rgba(236,230,216,.5); font-style: italic; }
header p { font-size: 17px; color: rgba(236,230,216,.6); }
.row { display: flex; gap: 40px; }
figure { width: 292px; }
.ph { width: 292px; height: 632px; border-radius: 44px; overflow: hidden; box-shadow: 0 0 0 1.5px rgba(236,230,216,.14), 0 0 0 7px #14120f, 0 0 0 8px rgba(236,230,216,.16), 0 30px 60px rgba(0,0,0,.5); }
.ph img { width: 292px; height: 632px; display: block; }
figcaption { margin-top: 26px; text-align: center; font-size: 17px; font-weight: 600; letter-spacing: -.2px; }
figcaption b { display: inline-grid; place-items: center; width: 24px; height: 24px; margin-right: 8px; font-size: 12px; background: rgba(236,230,216,.14); vertical-align: 1px; }
figcaption span { display: block; margin-top: 6px; font-size: 13px; font-weight: 400; color: rgba(236,230,216,.55); letter-spacing: 0; }
'''
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>D2 · contact sheet</title><link rel="stylesheet" href="../../fonts.css"><meta name="mock-scale" content="1.5"><style>{css}</style></head>
<body><header><h1>D2 <span>· one ink</span></h1><p>A new visual language · bone on warm black · rules, not boxes · the serif is his voice</p></header><div class="row">{cells}</div></body></html>
'''


if __name__ == '__main__':
    write(HERE, 'home.html', home())
    write(HERE, 'show.html', show())
    write(HERE, 'hub.html', hub())
    write(HERE, 'nav.html', find())
    write(HERE, 'lens.html', lens())
    write(HERE, 'reader.html', reader())
    write(HERE, 'shelf.html', shelf())
    write(HERE, 'home-ember.html', home('ember'))
    write(HERE, 'contact.html', contact())
    print('D2: home, show, hub, lens, reader, shelf, home-ember, contact')
