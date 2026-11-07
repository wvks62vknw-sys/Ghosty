"""W3 · THE EYE — the pictures under the attention: each thing Ghosty watches drawn as its own feed, in greys (the canvas turns
them to bone and grain), in the 390 x 844 design space of the screen. Real words only: Alice's own text, the bins letter, the
hub cards' readings. Standard library only."""
import math
import random

SERIF = "'DejaVu Serif', serif"
MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace"
SANS = "'DejaVu Sans', sans-serif"
BG = '#0c0c0c'


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;')


def frame(x, y, w, h, body, fill=BG):
    return f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}"/><svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg></g>'


def page(x, y, w, h, words, size=9.5, top=30):
    """A page of a book: the paper, its words set in the serif, a folio."""
    lines, cur = [], ''
    per = int((w - 24) / (size * 0.52))
    for word in words.split():
        if len(cur) + len(word) + 1 > per:
            lines.append(cur)
            cur = word
        else:
            cur = (cur + ' ' + word).strip()
    lines.append(cur)
    lh = size * 1.45
    txt = ''.join(f'<text x="12" y="{top + i * lh:.1f}" font-family="{SERIF}" font-size="{size}" fill="#1a1a1a">{esc(t)}</text>' for i, t in enumerate(lines) if top + i * lh < h - 18)
    body = (f'<rect x="4" y="4" width="{w - 8}" height="{h - 8}" fill="#d9d5cb"/><rect x="4" y="4" width="10" height="{h - 8}" fill="#bdb8ad"/>'
            f'<text x="12" y="18" font-family="{SANS}" font-size="7" letter-spacing="1" fill="#555">CHAPTER V · ADVICE FROM A CATERPILLAR</text>{txt}'
            f'<text x="{w / 2}" y="{h - 9}" text-anchor="middle" font-family="{SERIF}" font-size="8" fill="#555">42</text>')
    return frame(x, y, w, h, body)


def globe(x, y, w, h):
    cx, cy, r = w / 2, h / 2 + 4, min(w, h) * 0.36
    mer = ''.join(f'<ellipse cx="{cx}" cy="{cy}" rx="{r * abs(math.cos(a)):.1f}" ry="{r}" fill="none" stroke="#666" stroke-width=".8"/>' for a in (0.3, 0.9, 1.3))
    lat = ''.join(f'<ellipse cx="{cx}" cy="{cy + r * math.sin(b):.1f}" rx="{r * math.cos(b):.1f}" ry="{r * math.cos(b) * .22:.1f}" fill="none" stroke="#555" stroke-width=".7"/>' for b in (-0.6, 0, 0.6))
    rnd = random.Random(4)
    pts = ''.join(f'<rect x="{cx + rnd.uniform(-r, r) * .8:.1f}" y="{cy + rnd.uniform(-r, r) * .8:.1f}" width="2.4" height="2.4" fill="#eee"/>' for _ in range(14))
    body = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#1b1b1b" stroke="#aaa" stroke-width="1.2"/>{mer}{lat}{pts}'
    return frame(x, y, w, h, body)


def radar(x, y, w, h):
    cx, cy = w / 2, h / 2 + 6
    rings = ''.join(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#555" stroke-width=".8"/>' for r in (12, 24, 36))
    blobs = '<path d="M20 40c10-8 26-6 30 4s-8 16-18 14-18-10-12-18z" fill="#777"/><path d="M58 60c8-4 16 0 14 8s-12 8-16 4-4-8 2-12z" fill="#999"/>'
    body = f'{rings}{blobs}<path d="M{cx} {cy}L{cx + 34} {cy - 14}" stroke="#ddd" stroke-width="1.2"/><text x="{w - 10}" y="{h - 10}" text-anchor="end" font-family="{MONO}" font-size="16" fill="#eee">9°</text>'
    return frame(x, y, w, h, body)


def camview(x, y, w, h):
    body = (f'<rect width="{w}" height="{h}" fill="#222"/><rect y="{h * .55}" width="{w}" height="{h * .45}" fill="#3a3632"/>'
            f'<path d="M{w * .18} {h * .62}h{w * .2}l-{w * .03} {h * .3}h-{w * .14}z" fill="#8a6a55"/>'
            + ''.join(f'<path d="M{w * .28} {h * .62}q{a} -{h * .3} {a * 1.6} -{h * .42}" stroke="#7a9a7a" stroke-width="2.4" fill="none"/>' for a in (-14, -6, 0, 6, 14))
            + f'<rect x="{w * .5}" y="{h * .5}" width="{w * .36}" height="{h * .26}" fill="#ddd" transform="rotate(-6 {w * .68} {h * .63})"/>'
            f'<rect x="{w * .58}" y="{h * .7}" width="{w * .22}" height="{h * .26}" fill="#bbb"/>')
    return frame(x, y, w, h, body)


def calendar(x, y, w, h):
    gx, gy, cw, ch = 8, 26, (w - 16) / 7, (h - 34) / 5
    cells = ''
    for r in range(5):
        for c in range(7):
            cells += f'<rect x="{gx + c * cw:.1f}" y="{gy + r * ch:.1f}" width="{cw - 2:.1f}" height="{ch - 2:.1f}" fill="#262626"/>'
    ring = f'<rect x="{gx + 5 * cw - 1:.1f}" y="{gy + 1 * ch - 1:.1f}" width="{cw:.1f}" height="{ch:.1f}" fill="none" stroke="#fff" stroke-width="1.6"/>'
    body = f'<text x="8" y="17" font-family="{MONO}" font-size="9" fill="#ccc">NOVEMBER</text>{cells}{ring}'
    return frame(x, y, w, h, body)


def sudoku(x, y, w, h, n=9):
    s = min(w, h) - 16
    ox, oy = (w - s) / 2, (h - s) / 2 + 2
    lines = ''.join(f'<path d="M{ox + i * s / n:.1f} {oy}v{s}M{ox} {oy + i * s / n:.1f}h{s}" stroke="{"#bbb" if i % 3 == 0 else "#444"}" stroke-width="{1.2 if i % 3 == 0 else .6}"/>' for i in range(n + 1))
    rnd = random.Random(9)
    digits = ''.join(f'<text x="{ox + (c + .5) * s / n:.1f}" y="{oy + (r + .72) * s / n:.1f}" text-anchor="middle" font-family="{MONO}" font-size="{s / n * .62:.1f}" fill="#ddd">{rnd.randint(1, 9)}</text>'
                     for r in range(n) for c in range(n) if rnd.random() < .38)
    return frame(x, y, w, h, lines + digits)


def card(x, y, w, h, top, big, small=''):
    body = (f'<rect x="6" y="6" width="{w - 12}" height="{h - 12}" fill="#1e1e1e" stroke="#777" stroke-width=".8"/>'
            f'<text x="14" y="22" font-family="{MONO}" font-size="8" fill="#999">{esc(top)}</text>'
            f'<text x="{w / 2}" y="{h / 2 + 8}" text-anchor="middle" font-family="{SERIF}" font-size="{min(17, w / 7):.1f}" fill="#eee">{esc(big)}</text>'
            f'<text x="{w / 2}" y="{h - 16}" text-anchor="middle" font-family="{MONO}" font-size="8" fill="#aaa">{esc(small)}</text>')
    return frame(x, y, w, h, body)


def paper(x, y, w, h):
    rows = ''.join(f'<rect x="16" y="{30 + i * 9}" width="{(w - 40) * (0.5 + 0.5 * ((i * 37) % 7) / 7):.1f}" height="3" fill="#555"/>' for i in range(int((h - 46) / 9)))
    body = (f'<rect x="8" y="6" width="{w - 16}" height="{h - 10}" fill="#cfcac0"/><text x="16" y="22" font-family="{MONO}" font-size="8" fill="#333">PAPER 7 · NURSERY</text>'
            f'{rows}<rect x="{w - 34}" y="12" width="20" height="14" fill="none" stroke="#222" stroke-width="1.2"/>')
    return frame(x, y, w, h, body)


def pinball(x, y, w, h):
    body = (f'<path d="M{w * .15} 8h{w * .7}l{w * .1} {h - 16}h-{w * .9}z" fill="#1d1d1d" stroke="#777" stroke-width="1"/>'
            + ''.join(f'<circle cx="{w * a}" cy="{h * b}" r="{r}" fill="#aaa"/>' for a, b, r in ((.35, .3, 7), (.6, .26, 6), (.5, .45, 8)))
            + f'<path d="M{w * .3} {h * .82}l{w * .16} {h * .06}M{w * .7} {h * .82}l-{w * .16} {h * .06}" stroke="#eee" stroke-width="3" stroke-linecap="round"/>'
            f'<circle cx="{w * .56}" cy="{h * .62}" r="3.5" fill="#fff"/>')
    return frame(x, y, w, h, body)


def keyboard(x, y, w, h):
    n = 10
    kw = (w - 16) / n
    whites = ''.join(f'<rect x="{8 + i * kw:.1f}" y="{h * .3}" width="{kw - 1.2:.1f}" height="{h * .5}" fill="#ddd"/>' for i in range(n))
    blacks = ''.join(f'<rect x="{8 + (i + .65) * kw:.1f}" y="{h * .3}" width="{kw * .6:.1f}" height="{h * .3}" fill="#111"/>' for i in range(n - 1) if i % 7 not in (2, 6))
    return frame(x, y, w, h, whites + blacks)


def words(x, y, w, h):
    body = (f'<rect x="8" y="8" width="{w - 16}" height="{h - 16}" fill="#1e1e1e" stroke="#888" stroke-width=".8"/>'
            f'<text x="{w / 2}" y="{h / 2 + 2}" text-anchor="middle" font-family="{SERIF}" font-size="15" fill="#eee">water</text>'
            f'<text x="{w / 2}" y="{h / 2 + 18}" text-anchor="middle" font-family="{MONO}" font-size="8" fill="#aaa">1 OF 10 TODAY</text>')
    return frame(x, y, w, h, body)


def chart(x, y, w, h):
    rnd = random.Random(3)
    pts, v = [], h * .6
    for i in range(24):
        v = max(12, min(h - 12, v + rnd.uniform(-9, 8)))
        pts.append(f'{8 + i * (w - 16) / 23:.1f},{v:.1f}')
    return frame(x, y, w, h, f'<polyline points="{" ".join(pts)}" fill="none" stroke="#ddd" stroke-width="1.4"/><path d="M8 {h - 10}H{w - 8}" stroke="#555"/>')


def cube(x, y, w, h):
    cx, cy, s = w / 2, h / 2 + 4, min(w, h) * .26
    body = (f'<path d="M{cx - s} {cy - s * .4}l{s} -{s * .5}l{s} {s * .5}v{s * 1.1}l-{s} {s * .5}l-{s} -{s * .5}z" fill="#2a2a2a" stroke="#ccc" stroke-width="1"/>'
            f'<path d="M{cx - s} {cy - s * .4}l{s} {s * .5}l{s} -{s * .5}M{cx} {cy + s * .1}v{s * 1.1}" stroke="#ccc" stroke-width="1" fill="none"/>')
    return frame(x, y, w, h, body)


def ledger(x, y, w, h):
    rows = ''.join(f'<rect x="12" y="{18 + i * 12}" width="{w * .45:.1f}" height="3" fill="#777"/><rect x="{w - 30}" y="{18 + i * 12}" width="18" height="3" fill="#bbb"/>' for i in range(int((h - 26) / 12)))
    return frame(x, y, w, h, rows)


def sliders(x, y, w, h):
    rows = ''.join(f'<path d="M12 {24 + i * 18}H{w - 12}" stroke="#555" stroke-width="2"/><circle cx="{20 + ((i * 53) % (w - 40))}" cy="{24 + i * 18}" r="5" fill="#ddd"/>' for i in range(int((h - 20) / 18)))
    return frame(x, y, w, h, rows)


def mosaic(x, y, w, h, seed=5):
    rnd = random.Random(seed)
    cells = ''.join(f'<rect x="{6 + c * (w - 12) / 6:.1f}" y="{6 + r * (h - 12) / 5:.1f}" width="{(w - 12) / 6 - 2:.1f}" height="{(h - 12) / 5 - 2:.1f}" fill="#{rnd.choice(["222", "333", "444", "555", "777", "999"])}"/>' for r in range(5) for c in range(6))
    return frame(x, y, w, h, cells)


def dots(x, y, w, h, seed=8):
    rnd = random.Random(seed)
    return frame(x, y, w, h, ''.join(f'<circle cx="{rnd.uniform(6, w - 6):.1f}" cy="{rnd.uniform(6, h - 6):.1f}" r="1.3" fill="#ccc"/>' for _ in range(90)))


def svg(body, w=390, h=844):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="#000"/>{body}</svg>'


# ------------------------------------------------------------------------------------------------ Birmingham from above (the Stage)
def city(x, y, w, h, route, seed=11):
    """Blocks between streets, the canal, the railway into New Street, in the frame (x, y, w, h); route = [(px, py), ...] in the
    same design space, for the station and the rails to sit on."""
    rnd = random.Random(seed)
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#0d0d0d"/>']
    step = 26
    for gy in range(int(y), int(y + h), step):
        for gx in range(int(x), int(x + w), step):
            if rnd.random() < .12:
                continue
            bw, bh = rnd.uniform(14, 22), rnd.uniform(14, 22)
            g = rnd.choice(['2a2a2a', '333', '3d3d3d', '474747', '555', '606060'])
            out.append(f'<rect x="{gx + 3:.1f}" y="{gy + 3:.1f}" width="{min(bw, x + w - gx - 3):.1f}" height="{min(bh, y + h - gy - 3):.1f}" fill="#{g}"/>')
    out.append(f'<path d="M{x} {y + h * .78}C{x + w * .3} {y + h * .7} {x + w * .55} {y + h * .9} {x + w} {y + h * .82}" stroke="#777" stroke-width="5" fill="none"/>')
    ns = route[5]
    out.append(f'<path d="M{ns[0] - 60} {ns[1] - 10}L{ns[0] + 70} {ns[1] + 22}M{ns[0] - 60} {ns[1] - 4}L{ns[0] + 70} {ns[1] + 28}" stroke="#9a9a9a" stroke-width="1.6"/>')
    out.append(f'<rect x="{ns[0] - 34}" y="{ns[1] - 14}" width="68" height="24" fill="#8a8a8a" transform="rotate(14 {ns[0]} {ns[1]})"/>')
    return ''.join(out)
