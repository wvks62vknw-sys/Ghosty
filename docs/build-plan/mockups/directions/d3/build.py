"""D3 · THE CURRENT LOOK, GROWN UP: route C's glass and Mind kept; less on each screen, more layers; one bar in place of two; the
Stage given the centre. Writes five screens (home, show, hub, lens, reader), the Shelf as a sixth small frame, home-ember (the
same Home under Ember: a theme is a swap of the accent block) and the contact sheet, as static HTML beside this file.
Run from the repo root:  python3 -I -B docs/build-plan/mockups/directions/d3/build.py
then:                    node docs/build-plan/mockups/tools/render.mjs directions/d3
Every word is real (lib/content.py: hubcards.ts's own names and readouts, a real book, a real station)."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'lib'))
import content as C  # noqa: E402
from cover import cover  # noqa: E402
from glyphs import glyph  # noqa: E402
from map import route_map  # noqa: E402
from orb import orb  # noqa: E402
from phone import HOME_INDICATOR, page, status_bar, write  # noqa: E402
from scene import TAGS, lens_scene  # noqa: E402

g = glyph


def bar(placeholder='Ask or jump anywhere'):
    """The one bar, on every screen: the areas, the typed word (the jump bar and the chat bar are one field), and Mind."""
    return (f'<div class="bar" role="toolbar" aria-label="Ghosty">'
            f'<button class="bar-areas" aria-label="Areas">{g("grid")}</button>'
            f'<button class="bar-field"><span>{placeholder}</span></button>'
            f'<button class="bar-mind" aria-label="Talk to me">{orb(40, "glass", "bm", detail="mini", halo=.7)}{g("mic")}</button></div>')


# ============================================================================================ HOME, idle (the evening)
def home(theme='reactor'):
    b = C.BOOK
    jump = (f'<button class="chip">{g("clock", "i")}<span>Library</span></button>'
            f'<button class="chip star">{g("star", "i")}<span>Lens</span></button>'
            f'<button class="chip star">{g("star", "i")}<span>Agenda</span></button>'
            f'<button class="chip more" aria-label="All recent and starred">{g("dots")}</button>')
    body = f'''<div class="screen home">
  {status_bar(C.EVENING)}
  <div class="col">
    <header class="top"><span class="kicker">{C.DAY_LONG} · {C.HOME['weather'].replace(' in Birmingham', '')}</span><button class="avatar" aria-label="Me">B</button></header>
    <section class="greet"><h1>{C.HOME['greeting']}</h1><p>{C.HOME['line']}</p></section>
    <section class="mind">{orb(232, 'glass', 'home', progress=C.HOME['free_left'], label='Mind')}<p class="cap orbcap">I have {round(C.HOME['free_left'] * 100)}% of today’s free answers left.</p></section>
    <article class="card raised hour" aria-label="Tonight: carry on reading">
      {cover(b['id'], 72, 'hc')}
      <div><span class="kicker acc">Carry on reading</span><h2>{b['title']}</h2>
        <div class="prog"><i style="width:{b['pct'] * 100:.1f}%"></i></div>
        <p class="cap">Page <b class="num">{b['page']}</b> of <b class="num">{b['of']}</b> · {b['when']}</p></div>
      <button class="roundb" aria-label="Read it to me">{g('listen2')}</button>
    </article>
    <nav class="jump" aria-label="Recent and starred">{jump}</nav>
  </div>
  {bar()}
  {HOME_INDICATOR}
</div>'''
    return page('D3 · Home', body, theme=theme)


# ============================================================================================ HOME, showing (the Stage)
def show():
    s = C.STAGE
    reads = ''.join(f'<div class="{"lead" if i == 0 else ""}"><span class="kicker">{k}</span><b class="num">{v}</b></div>' for i, (k, v) in enumerate(s['readings']))
    frame = ('<svg class="stage-frame" aria-hidden="true" data-bleed><defs><mask id="fm"><rect width="100%" height="100%" fill="url(#fg)"/></mask>'
             '<radialGradient id="fg" cx="50%" cy="0%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".32"/></radialGradient></defs>'
             '<g mask="url(#fm)"><rect width="100%" height="100%" rx="36" ry="36" fill="none" style="stroke:rgba(var(--accent-pale-rgb),.5)" stroke-width="3" stroke-dasharray="1 7"/>'
             '<rect width="100%" height="100%" rx="36" ry="36" fill="none" style="stroke:rgba(var(--accent-pale-rgb),.85)" stroke-width="7" stroke-dasharray="1.2 38.8"/></g></svg>')
    body = f'''<div class="screen show">
  {status_bar(s['time'])}
  <div class="col stagecol">
    <header class="top"><button class="chipb">{g('back', 'i sm')}<span>Home</span></button><button class="roundb" aria-label="More">{g('dots')}</button></header>
    <section class="stage" aria-label="{s['title']}">
      <div class="stage-clip">{route_map('sm')}</div>
      {frame}
      <div class="stage-mind">{orb(64, 'glass', 'sm', detail='full', halo=.5, label='Mind')}</div>
      <div class="readings">{reads}</div>
    </section>
    <p class="say">That’s the 7:42 from New Street. <span>Platform 3 — I’ll say when to leave.</span></p>
  </div>
  {bar(s['ask_placeholder'])}
  {HOME_INDICATOR}
</div>'''
    return page('D3 · Home, showing', body)


# ============================================================================================ ONE HUB: Learn
def _kicker(c):
    live = c.get('live')
    return f'<div class="ck">{g(c["glyph"], "i")}<b>{c["name"]}</b><em class="st{" live" if live else ""}">{c["status"].title()}</em></div>'


def _val(label, value, unit=''):
    from content import is_figure
    cls = 'val num' if is_figure(value) else 'val'
    extra = f'<small>{unit}</small>' if unit.startswith('↑') else (f' {unit}' if unit else '')
    return f'<div><span class="rl">{label}</span><div class="{cls}">{value}{extra}</div></div>'


def big_card(c):
    r1, r2 = c['reads']
    panels = ''.join(f'<button class="chip">{p}</button>' for p in c['panels'])
    return f'''<article class="card raised big live">
  {_kicker(c)}
  <div class="inst">{orb(32, 'glass', 'bi', detail='mini', halo=.5, lit=.31)}</div>
  <div class="ct">{c['title']}</div>
  <div class="reads">{_val(*r1)}{_val(*r2)}</div>
  <div class="panels">{panels}</div>
</article>'''


def small_card(c):
    rows = ''.join(f'<div class="rd"><span class="rl">{k}</span><span class="{"val num" if __import__("content").is_figure(v) else "val"}">{v}{("<small>" + u + "</small>") if u.startswith("↑") else (" " + u if u else "")}</span></div>' for k, v, u in c['reads'])
    return f'<article class="card small{" live" if c.get("live") else ""}">{_kicker(c)}<div class="ct">{c["title"]}</div>{rows}</article>'


def fold_row(c):
    (k1, v1, u1), (k2, v2, u2) = c['reads']
    mark = '<i title="In the works"></i>' if c.get('works') else ''  # a state is shown only when it is not the usual one
    return (f'<div class="frow">{g(c["glyph"], "i sm")}<div><div class="nm">{c["name"]}{mark}</div><div class="tt">{c["title"]}</div></div>'
            f'<div class="rr"><span>{k1}</span><b class="num">{v1}{(" " + u1) if u1 else ""}</b><span>{k2}</span><b class="num">{v2}{(" " + u2) if u2 else ""}</b></div></div>')


def hub():
    H = C.HUB
    cards = H['cards']
    body = f'''<div class="screen hub">
  {status_bar('21:11')}
  <div class="col">
    <div class="titlebar"><button class="roundb" aria-label="Back">{g('back')}</button><h1>{H['title']}</h1><button class="avatar" aria-label="Me">B</button></div>
    <p class="hubline">{H['line']}</p>
    <div class="layers">
      <section class="tier"><div class="kicker">Recent</div>{big_card(cards['library'])}</section>
      <section class="tier"><div class="kicker">Favourites</div><div class="pair">{''.join(small_card(cards[k]) for k in H['favourites'])}</div></section>
      <section class="tier"><div class="kicker">Everything else · {len(H['rest'])}<em><i></i>In the works</em></div><div class="fold">{''.join(fold_row(cards[k]) for k in H['rest'])}</div></section>
    </div>
  </div>
  {bar('Find anything in Learn')}
  {HOME_INDICATOR}
</div>'''
    return page('D3 · Hub, Learn', body)


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
  <header class="lenstop"><button class="glassb" aria-label="Back">{g('back')}</button><span class="lenstat"><i></i>{L['status']}</span><button class="glassb" aria-label="Turn the camera round">{g('flip')}</button></header>
  {tags}
  <div class="callout" role="status"><span class="leader" style="left:calc(90vw - var(--gutter));height:calc(100vh * .5377 - 262px)"></span>
    <h2>{a['title']}</h2><p>{a['body']}</p>
    <div class="acts"><button class="btn primary">{g('agenda')}<span>{a['actions'][0]}</span></button><button class="btn">{g('listen2')}<span>Read it</span></button></div>
  </div>
  {bar('Ask me about it')}
  {HOME_INDICATOR}
</div>'''
    return page('D3 · Lens', body)


# ============================================================================================ THE READER
def reader():
    b = C.BOOK
    paras = ''
    for i, (kind, text) in enumerate(C.READER_TEXT):
        if kind == 'mark':
            paras += f'<div class="mark">{text}</div>'
        else:
            paras += f'<p class="para{" lit" if i == C.READER_LIT else ""}">{text}</p>'
    pills = ''.join(f'<button class="pill{" on" if i == 0 else ""}">{p}</button>' for i, p in enumerate(C.READER_PILLS))
    bars = ''.join(f'<i style="height:{h}px"></i>' for h in (5, 9, 13, 8, 4))
    body = f'''<div class="screen reader">
  {status_bar('21:14')}
  <div class="col">
    <header class="rtop"><button class="roundb" aria-label="Back to the shelf">{g('back')}</button><div class="grp"><button class="roundb" aria-label="Text size">{g('type')}</button><button class="roundb" aria-label="More">{g('dots')}</button></div></header>
    <p class="rline"><b>{b['title']}</b>page {b['page']} of {b['of']} · {b['when']}</p>
    <nav class="pills" aria-label="Book sections">{pills}</nav>
    <article class="page"><div class="flow">{paras}</div></article>
  </div>
  <div class="listen" role="group" aria-label="Listen">
    <button class="go" aria-label="Pause">{g('pause')}</button>
    <div class="tx"><b><span class="wave">{bars}</span>Reading to you</b><span class="cap">My own voice · passage 3 of 7</span></div>
    <button class="skip" aria-label="Next passage">{g('forward')}</button>
  </div>
  {HOME_INDICATOR}
</div>'''
    return page('D3 · Reader', body)


# ============================================================================================ THE SHELF (a sixth, small frame)
def shelf():
    rows = ''
    for k in C.SHELF:
        done = k['progress'] == 'Finished'
        fresh = k['progress'] == 'Not started'
        pg = k['progress'].split()
        status = (f'<span class="done">{g("check")}Finished</span> · {k["when"]}' if done else
                  (f'Not started · {k["when"]}' if fresh else f'Page <b class="num">{pg[1]}</b> of <b class="num">{pg[3]}</b> · {k["when"]}'))
        rows += f'''<article class="card book">{cover(k['id'], 56, 'b' + k['id'])}<div><h2>{k['title']}</h2><p class="by">{k['author']}</p>
          <div class="prog"><i style="width:{k['pct'] * 100:.1f}%"></i></div><p class="cap">{status}</p></div></article>'''
    sorts = ''.join(f'<button class="pill{" on" if i == 0 else ""}">{s}</button>' for i, s in enumerate(['Recent', 'Progress', 'Title']))
    body = f'''<div class="screen shelfscr">
  {status_bar('21:03')}
  <div class="col">
    <div class="titlebar"><button class="roundb" aria-label="Back">{g('back')}</button><h1>Library</h1><button class="avatar" aria-label="Me">B</button></div>
    <p class="hubline">Four books on the shelf. I’ve read {C.HOME['stats']['passages']} passages myself.</p>
    <nav class="sortrow" aria-label="Sort the shelf">{sorts}</nav>
    <div class="shelf">{rows}</div>
  </div>
  {bar('Search the library')}
  {HOME_INDICATOR}
</div>'''
    return page('D3 · Shelf', body)


# ============================================================================================ the contact sheet (five, at 390)
SHEET = [('home', 'Home', 'Mind at the centre; the evening read; one bar'), ('show', 'Home, showing', 'The Stage in the centre; Mind its frame'),
         ('hub', 'A hub, Learn', 'Recent in front, favourites behind, the rest folded'), ('lens', 'The Lens', 'Machine boxes, the act on a tap'), ('reader', 'The Reader', 'Alice, page 42, being read to him')]


def contact():
    cells = ''.join(f'<figure><div class="ph"><img src="{n}-390.png" alt="{lab}"></div><figcaption><b>{i + 1}</b>{lab}<span>{why}</span></figcaption></figure>' for i, (n, lab, why) in enumerate(SHEET))
    css = '''
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #050607; color: #f4f6f8; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; width: 1732px; padding: 48px 56px 56px; }
header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 36px; }
h1 { font-size: 34px; line-height: 40px; font-weight: 700; letter-spacing: -.6px; } h1 span { color: rgba(244,246,248,.5); font-weight: 500; }
header p { font-size: 17px; color: rgba(244,246,248,.6); }
.row { display: flex; gap: 40px; }
figure { width: 292px; }
.ph { width: 292px; height: 632px; border-radius: 44px; overflow: hidden; box-shadow: 0 0 0 1.5px rgba(255,255,255,.1), 0 0 0 7px #14161a, 0 0 0 8px rgba(255,255,255,.14), 0 30px 60px rgba(0,0,0,.5); }
.ph img { width: 292px; height: 632px; display: block; }
figcaption { margin-top: 26px; text-align: center; font-size: 17px; font-weight: 600; letter-spacing: -.2px; }
figcaption b { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 12px; margin-right: 8px; font-size: 12px; background: rgba(255,255,255,.12); vertical-align: 1px; }
figcaption span { display: block; margin-top: 6px; font-size: 13px; font-weight: 400; color: rgba(244,246,248,.55); letter-spacing: 0; }
'''
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>D3 · contact sheet</title><link rel="stylesheet" href="../../fonts.css"><meta name="mock-scale" content="1.5"><style>{css}</style></head>
<body><header><h1>D3 <span>· the current look, grown up</span></h1><p>Route C’s glass and Mind kept · one bar · layers · the Stage in the centre</p></header><div class="row">{cells}</div></body></html>
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
    print('D3: home, show, hub, lens, reader, shelf, home-ember, contact')
