"""The one sheet across the three worlds of round two (BRIEF-DIRECTIONS-2), for the owner's pick: per row, the five moments
(Home, Home showing the 7:42, the Learn hub, the Lens, the reader) and the storyboard's four frames, at 390, each world in one
line. Reads the PNGs the three builds render.
Run from the repo root:  python3 -I -B docs/build-plan/mockups/directions-2/build.py
then:                    node docs/build-plan/mockups/tools/render.mjs directions-2 contact"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

MOMENTS = [('home', 'Home'), ('show', 'Home, showing'), ('hub', 'Learn'), ('lens', 'The Lens'), ('reader', 'The reader')]
STORY = ['He asks', 'Turn', 'Arrive', 'The Stage']
ROWS = [
    ('W1', 'w1', 'The Scan', 'The phone is a window into a 3-D scan of a room where everything Ghosty does has its place; what you ask for is brought to the front.'),
    ('W2', 'w2', 'The Map', 'Everything Ghosty can see and do is plotted on one map round the orb; pinch is altitude, a typed word is a flight, the Stage is the deepest zoom.'),
    ('W3', 'w3', 'The Eye', 'The orb is an eye: what it is looking at is sharp, in a box, its line of sight drawn; everything else is there as grain.'),
]


def page():
    head = ''.join(f'<span>{lab}</span>' for _, lab in MOMENTS) + '<span class="gap"></span>' + ''.join(f'<span>{i}. {s}</span>' for i, s in enumerate(STORY, 1))
    rows = ''
    for tag, folder, name, line in ROWS:
        five = ''.join(f'<div class="ph"><img src="{folder}/{n}-390.png" alt="{tag} {lab}"></div>' for n, lab in MOMENTS)
        four = ''.join(f'<div class="ph"><img src="{folder}/story-{i}-390.png" alt="{tag} storyboard {i}"></div>' for i in range(1, 5))
        rows += f'<section class="row"><div class="who"><b>{tag}</b><h2>{name}</h2><p>{line}</p></div><div class="phs">{five}<span class="gap"></span>{four}</div></section>'
    css = '''
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #050505; color: #ece8df; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; width: 2348px; padding: 48px 56px 56px; }
header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 24px; }
h1 { font-size: 34px; line-height: 40px; font-weight: 700; letter-spacing: -.02em; }
h1 span { color: rgba(236,232,223,.5); font-weight: 400; }
header p { font-size: 16px; color: rgba(236,232,223,.55); max-width: 1100px; text-align: right; }
.cols { display: grid; grid-template-columns: 252px repeat(5, 200px) 28px repeat(4, 200px); column-gap: 16px; margin-bottom: 14px; }
.cols span { font: 600 12px/16px 'JetBrains Mono', monospace; letter-spacing: .12em; text-transform: uppercase; color: rgba(236,232,223,.55); text-align: center; }
.cols span:first-child { grid-column: 2; }
.row { display: grid; grid-template-columns: 252px 1fr; column-gap: 16px; padding: 24px 0; border-top: 1px solid rgba(236,232,223,.14); }
.who b { display: inline-block; font: 600 13px/16px 'JetBrains Mono', monospace; letter-spacing: .14em; color: #64d2ff; border: 1.5px solid #64d2ff; padding: 6px 8px; }
.who h2 { margin-top: 16px; font-size: 30px; line-height: 34px; font-weight: 700; letter-spacing: -.02em; }
.who p { margin-top: 10px; font-size: 15px; line-height: 22px; color: rgba(236,232,223,.62); }
.phs { display: grid; grid-template-columns: repeat(5, 200px) 28px repeat(4, 200px); column-gap: 16px; }
.gap { width: 28px; }
.phs .gap { border-left: 1px dashed rgba(236,232,223,.22); margin-left: 13px; }
.ph { width: 200px; height: 433px; border-radius: 30px; overflow: hidden; background: #000; box-shadow: 0 0 0 1.5px rgba(255,255,255,.12), 0 0 0 5px #111, 0 0 0 6px rgba(255,255,255,.12); }
.ph img { width: 200px; height: 433px; display: block; }
'''
    cols = f'<div class="cols">{head}</div>'
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>Ghosty · three worlds</title><link rel="stylesheet" href="../fonts.css"><meta name="mock-scale" content="0.9"><style>{css}</style></head>
<body><header><h1>Three worlds <span>· one for the pick</span></h1><p>The same five moments in each, then four frames of one transition: Home becomes the 7:42 from New Street · 390 × 844 · the Machine’s eye in all three, a different physics in each</p></header>{cols}{rows}</body></html>
'''


if __name__ == '__main__':
    with open(os.path.join(HERE, 'contact.html'), 'w', encoding='utf-8') as f:
        f.write(page())
    print('directions-2/contact.html')
