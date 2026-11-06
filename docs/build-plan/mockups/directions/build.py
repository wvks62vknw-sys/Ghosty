"""The one sheet across the three directions, for the owner's pick: the five screens of each in a row (390 wide), labelled D1 / D2 /
D3 with one line each. Reads the PNGs the three builds render (home, show, hub, lens, reader at -390).
Run from the repo root:  python3 -I -B docs/build-plan/mockups/directions/build.py
then:                    node docs/build-plan/mockups/tools/render.mjs directions contact"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

SCREENS = [('home', 'Home'), ('show', 'Home, showing'), ('hub', 'A hub: Learn'), ('lens', 'The Lens'), ('reader', 'The Reader')]
ROWS = [
    ('D1', 'd1', 'Orbit', 'Mind is the navigation',
     'No bar. The orb is the way in: the areas stand on its orbit, recents hang under it, a press opens the typed word, the Stage grows out of it. Light, not glass.',
     '#04060b', '#e8f1fa'),
    ('D2', 'd2', 'One ink', 'A new visual language',
     'Nothing of today’s look: bone ink on warm black, a serif for my voice, rules instead of boxes, numbered layers. Mind is the one round, lit thing.',
     '#0b0a09', '#ece6d8'),
    ('D3', 'd3', 'Grown up', 'The current look, grown up',
     'Route C’s glass and Mind kept. Less on each screen and more layers: one bar in place of two, hubs as layers, the Stage in the centre with Mind as its frame.',
     '#050607', '#f4f6f8'),
]


def page():
    head = ''.join(f'<span>{lab}</span>' for _, lab in SCREENS)
    rows = ''
    for tag, folder, name, kind, line, bg, ink in ROWS:
        phones = ''.join(f'<figure><div class="ph" style="--bg:{bg}"><img src="{folder}/{n}-390.png" alt="{tag} {lab}"></div></figure>' for n, lab in SCREENS)
        rows += (f'<section class="row"><div class="who"><b>{tag}</b><h2>{name}</h2><h3>{kind}</h3><p>{line}</p></div><div class="phs">{phones}</div></section>')
    css = '''
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #08090b; color: #f1f3f5; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; width: 1760px; padding: 48px 56px 64px; }
header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 28px; }
h1 { font-size: 34px; line-height: 40px; font-weight: 700; letter-spacing: -.6px; }
h1 span { color: rgba(241,243,245,.5); font-weight: 400; }
header p { font-size: 16px; color: rgba(241,243,245,.55); }
.cols { display: grid; grid-template-columns: 300px repeat(5, 244px); gap: 24px; margin-bottom: 18px; }
.cols span { font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: rgba(241,243,245,.5); text-align: center; }
.cols span:first-child { text-align: left; }
.row { display: grid; grid-template-columns: 300px 1fr; gap: 24px; padding: 28px 0; border-top: 1px solid rgba(241,243,245,.14); }
.who b { display: inline-grid; place-items: center; width: 56px; height: 56px; border-radius: 28px; background: #f1f3f5; color: #08090b; font-size: 22px; font-weight: 800; letter-spacing: -.5px; }
.who h2 { margin-top: 18px; font-size: 30px; line-height: 34px; font-weight: 700; letter-spacing: -.6px; }
.who h3 { margin-top: 6px; font-size: 17px; line-height: 24px; font-weight: 500; color: rgba(241,243,245,.7); }
.who p { margin-top: 14px; font-size: 15px; line-height: 22px; color: rgba(241,243,245,.55); }
.phs { display: grid; grid-template-columns: repeat(5, 244px); gap: 24px; }
.ph { width: 244px; height: 528px; border-radius: 38px; overflow: hidden; background: var(--bg); box-shadow: 0 0 0 1.5px rgba(255,255,255,.12), 0 0 0 6px #14161a, 0 0 0 7px rgba(255,255,255,.14), 0 24px 48px rgba(0,0,0,.5); }
.ph img { width: 244px; height: 528px; display: block; }
'''
    cols = f'<div class="cols"><span>Direction</span>{head}</div>'
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>Ghosty · three directions</title><link rel="stylesheet" href="../fonts.css"><meta name="mock-scale" content="1"><style>{css}</style></head>
<body><header><h1>Three directions <span>· one for the pick</span></h1><p>The same five moments in each: Home, the Stage, a hub, the Lens, the Reader · 390 × 844</p></header>{cols}{rows}</body></html>
'''


if __name__ == '__main__':
    with open(os.path.join(HERE, 'contact.html'), 'w', encoding='utf-8') as f:
        f.write(page())
    print('directions/contact.html')
