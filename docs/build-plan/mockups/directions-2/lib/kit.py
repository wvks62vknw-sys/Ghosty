"""The round-two kit (BRIEF-DIRECTIONS-2): what the three worlds share, so only the world differs.

Reused from round one (docs/build-plan/mockups/directions/lib/, the content and the checks, not the looks): the words and numbers
(content.py: hubcards.ts's own names and readouts, Birmingham, Alice at page 42 of 112), the phone's status bar and home indicator
(phone.py), the app's line glyphs (glyphs.py), the drawn covers (cover.py) and what the Lens camera sees (scene.py).

New here: the page writer for a world screen (a WebGL canvas behind the type: lib/gl.js), the storyboard strip and the contact
sheet. Standard library only; imported by each wN/build.py, run from the repo root as python3 -I -B docs/build-plan/mockups/directions-2/wN/build.py."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
R1 = os.path.join(HERE, '..', '..', 'directions', 'lib')
sys.path.insert(0, R1)
import content as C  # noqa: E402,F401
from content import is_figure  # noqa: E402,F401
from cover import cover  # noqa: E402,F401
from glyphs import glyph  # noqa: E402,F401
from phone import FRAME_CSS, HOME_INDICATOR, status_bar  # noqa: E402,F401
from scene import TAGS, lens_scene  # noqa: E402,F401

g = glyph


def page(title, body, theme='reactor', scripts=(), gl=None, css=('tokens.css', 'style.css'), body_cls='', head=''):
    """One screen. `gl` is the JS that starts the world's canvas (GL.scene({...})); the page then says when it is drawn."""
    links = ''.join(f'<link rel="stylesheet" href="{c}">' for c in ('../../fonts.css',) + tuple(css))
    js = ''.join(f'<script src="{s}"></script>' for s in scripts)
    run = ''
    meta = ''
    if gl:
        meta = '<meta name="mock-gl" content="1">'
        run = f'<script>document.fonts.ready.then(() => {{ {gl} }});</script>'
    return f'''<!doctype html>
<html lang="en-GB" data-theme="{theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{meta}
<title>{title}</title>
{links}
<style>{FRAME_CSS}</style>
{head}
</head>
<body class="{body_cls}">
{body}
<script src="../lib/gl.js"></script>
{js}
{run}
</body>
</html>
'''


def svg_data(svg, w=440, h=956):
    """An inline SVG made into a picture the canvas can read (an <img> has no page CSS: the size and the namespace are written
    in, and the fonts named directly: the phone's faces stand in through the mock's own)."""
    import base64
    import re
    s = re.sub(r'^<svg ', f'<svg xmlns="http://www.w3.org/2000/svg" ', svg, count=1)
    s = re.sub(r'width="100%" height="100%"', f'width="{w}" height="{h}"', s, count=1)
    s = (s.replace('var(--font-mono)', "'JetBrains Mono', monospace").replace('var(--font-serif)', "'DejaVu Serif', serif")
          .replace('var(--font-text)', "'DejaVu Sans', sans-serif"))
    return 'data:image/svg+xml;base64,' + base64.b64encode(s.encode('utf-8')).decode('ascii')


def write(folder, name, html):
    with open(os.path.join(folder, name), 'w', encoding='utf-8') as f:
        f.write(html)


SHEET_CSS = '''
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #07080a; color: #eef0f2; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; padding: 48px 56px 56px; }
h1 { font-size: 32px; line-height: 40px; font-weight: 700; letter-spacing: -.02em; }
h1 span { color: rgba(238,240,242,.5); font-weight: 400; }
.lede { margin-top: 8px; font-size: 16px; line-height: 24px; color: rgba(238,240,242,.62); max-width: 1180px; }
.row { display: flex; gap: 24px; margin-top: 32px; }
figure { width: 244px; }
.ph { width: 244px; height: 528px; border-radius: 38px; overflow: hidden; background: #000; box-shadow: 0 0 0 1.5px rgba(255,255,255,.12), 0 0 0 6px #121418, 0 0 0 7px rgba(255,255,255,.14), 0 24px 48px rgba(0,0,0,.5); }
.ph img { width: 244px; height: 528px; display: block; }
figcaption { margin-top: 18px; font-size: 13px; line-height: 18px; color: rgba(238,240,242,.62); }
figcaption b { display: block; font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: rgba(238,240,242,.86); margin-bottom: 4px; }
.arrow { align-self: center; width: 24px; height: 24px; color: rgba(238,240,242,.4); flex: none; margin: 0 -12px; }
'''


def story_sheet(world, name, line, frames):
    """The storyboard strip: four frames of one transition at 390, numbered, each with what is happening in it."""
    cells = []
    for i, (cap, what) in enumerate(frames, 1):
        if i > 1:
            cells.append('<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>')
        cells.append(f'<figure><div class="ph"><img src="story-{i}-390.png" alt="{cap}"></div><figcaption><b>{i} · {cap}</b>{what}</figcaption></figure>')
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>{world} · storyboard</title><link rel="stylesheet" href="../../fonts.css"><meta name="mock-scale" content="1.6"><style>{SHEET_CSS}
body {{ width: 1180px; }}</style></head>
<body><h1>{world} <span>· {name}, in motion</span></h1><p class="lede">{line}</p><div class="row">{''.join(cells)}</div></body></html>
'''


SCREENS = [('home', 'Home'), ('show', 'Home, showing'), ('hub', 'The Learn hub'), ('lens', 'The Lens'), ('reader', 'The reader')]


def contact_sheet(world, name, idea, screens=SCREENS, story_caps=None):
    """One world at 390: the five moments, then the four storyboard frames, with the idea in one sentence."""
    five = ''.join(f'<figure><div class="ph"><img src="{n}-390.png" alt="{lab}"></div><figcaption><b>{lab}</b></figcaption></figure>' for n, lab in screens)
    story = ''
    if story_caps:
        story = ''.join(f'<figure><div class="ph"><img src="story-{i}-390.png" alt="{c}"></div><figcaption><b>{i} · {c}</b></figcaption></figure>' for i, c in enumerate(story_caps, 1))
        story = f'<h2 style="margin-top:40px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:rgba(238,240,242,.6);font-weight:600">The storyboard: Home becomes the thing he asked for</h2><div class="row" style="margin-top:16px">{story}</div>'
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>{world} · contact</title><link rel="stylesheet" href="../../fonts.css"><meta name="mock-scale" content="1.2"><style>{SHEET_CSS}
body {{ width: 1444px; }}</style></head>
<body><h1>{world} <span>· {name}</span></h1><p class="lede">{idea}</p><div class="row">{five}</div>{story}</body></html>
'''
