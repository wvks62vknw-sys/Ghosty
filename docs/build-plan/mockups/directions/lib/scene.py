"""What the camera sees on the Lens screen (STARS 151-152): a tabletop at dusk, drawn as flat SVG and graded to read as a
photograph, not an illustration: depth of field (the room is soft, the table sharp), a warm lamp, a vignette, grain.
Three things on it, the three the brief names: a Dracaena in a terracotta pot, a printed letter (real words, so
"Text · tap to read it" is true) and a box of oats whose barcode is a real EAN-13 (5 012345 678900: its check digit is
right, its bars follow the standard's L / G / R tables). 440 x 956 viewBox, `slice`.
The tags are not drawn here: the screens put them on top, in HTML, so they stay sharp at any width. TAGS gives their boxes
in the same 440 x 956 space (x, y, w, h)."""
import math
import random

TAGS = dict(plant=(26, 104, 214, 332), text=(184, 392, 232, 168), barcode=(112, 732, 118, 92))

_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']


def ean13(digits):
    """The 95 modules of an EAN-13 as a string of 0 / 1; checks the last digit."""
    d = [int(c) for c in digits]
    assert len(d) == 13 and (10 - sum(v * (3 if i % 2 else 1) for i, v in enumerate(d[:12])) % 10) % 10 == d[12], 'bad check digit'
    bits = '101'
    for i, v in enumerate(d[1:7]):
        bits += (_L if _PARITY[d[0]][i] == 'L' else _G)[v]
    bits += '01010'
    for v in d[7:]:
        bits += _R[v]
    return bits + '101'


def barcode(x, y, w, h, digits='5012345678900'):
    """A barcode as SVG: bars (guards run longer), the first digit outside the guard, six under each half."""
    bits = ean13(digits)
    m = w / 95.0
    guard = {*range(0, 3), *range(45, 50), *range(92, 95)}
    runs = []
    i = 0
    while i < 95:
        if bits[i] == '1':
            j = i
            while j < 95 and bits[j] == '1':
                j += 1
            ext = any(k in guard for k in range(i, j))
            runs.append(f'M{x + i * m:.2f} {y}h{(j - i) * m:.2f}v{h + (5 if ext else 0)}h{-(j - i) * m:.2f}Z')
            i = j
        else:
            i += 1
    fs = 8.0
    ty = y + h + 12
    txt = (f'<text x="{x - 7:.1f}" y="{ty}" font-size="{fs}" font-family="var(--font-mono)" text-anchor="end" fill="#15171a">{digits[0]}</text>'
           f'<text x="{x + 3 * m:.1f}" y="{ty}" font-size="{fs}" font-family="var(--font-mono)" textLength="{42 * m:.1f}" fill="#15171a">{digits[1:7]}</text>'
           f'<text x="{x + 50 * m:.1f}" y="{ty}" font-size="{fs}" font-family="var(--font-mono)" textLength="{42 * m:.1f}" fill="#15171a">{digits[7:]}</text>')
    return f'<path d="{"".join(runs)}" fill="#15171a"/>{txt}'


def _leaf(x0, y0, ang, length, bend, width, rnd, n=14):
    """A strap leaf as three polygons: the blade, its lighter stripe, and the lit edge."""
    th = math.radians(ang)
    cx, cy = math.cos(th), math.sin(th)
    left, right, sl, sr, hl = [], [], [], [], []
    for i in range(n + 1):
        t = i / n
        px = x0 + length * t * cx
        py = y0 + length * t * cy + bend * length * t * t
        dx = cx
        dy = cy + 2 * bend * t
        nn = math.hypot(dx, dy)
        nx, ny = -dy / nn, dx / nn
        w = width * (math.sin(math.pi * min(1, t ** 0.62)) ** 0.85) * (1 - 0.18 * t) + 0.25
        left.append((px + nx * w, py + ny * w))
        right.append((px - nx * w, py - ny * w))
        sl.append((px + nx * w * 0.34, py + ny * w * 0.34))
        sr.append((px - nx * w * 0.34, py - ny * w * 0.34))
        hl.append((px - nx * w * 0.62, py - ny * w * 0.62))
    poly = lambda a, b: 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in a + b[::-1]) + 'Z'
    shade = rnd.choice(('#1d4128', '#21472b', '#1a3a25', '#245030'))
    return (f'<path d="{poly(left, right)}" fill="{shade}"/>'
            f'<path d="{poly(sl, sr)}" fill="#a9c566" opacity=".78"/>'
            f'<path d="{poly(hl, [(x * 0.98 + 0.02 * x0, y * 0.98 + 0.02 * y0) for x, y in right])}" fill="#d9f0a0" opacity=".16"/>')


def _plant(rnd):
    leaves = []
    # the lower shoot first (behind), then the main crown
    for a, L, b, W in [(-176, 74, 0.34, 8.6), (-150, 86, 0.28, 8.6), (-118, 80, 0.12, 8.4), (-80, 70, 0.04, 7.8), (-44, 84, 0.18, 8.4), (-14, 78, 0.34, 8.6), (172, 64, 0.40, 8), (20, 60, 0.44, 8)]:
        leaves.append(_leaf(96, 300, a, L, b, W, rnd))
    for a, L, b, W in [(-172, 108, 0.36, 10.5), (-152, 124, 0.30, 10.8), (-134, 112, 0.18, 10.5), (-116, 124, 0.10, 10.8), (-98, 132, 0.05, 10.8), (-80, 126, 0.06, 10.8),
                       (-62, 118, 0.12, 10.5), (-44, 128, 0.22, 10.8), (-26, 118, 0.30, 10.6), (-8, 104, 0.40, 10.2), (10, 92, 0.48, 9.6), (168, 92, 0.46, 9.6), (-168, 74, 0.5, 9)]:
        leaves.append(_leaf(128, 262, a, L, b, W, rnd))
    cane = ('<path d="M120 396C121 360 126 300 129 258" stroke="#5a4a2e" stroke-width="13" fill="none" stroke-linecap="round"/>'
            '<path d="M124 394C125 360 129 300 132 262" stroke="#8d7c52" stroke-width="3.2" fill="none" stroke-linecap="round" opacity=".8"/>'
            '<path d="M122 346C112 330 102 312 96 300" stroke="#5a4a2e" stroke-width="8" fill="none" stroke-linecap="round"/>'
            + ''.join(f'<path d="M{114 + i * 0.4:.1f} {388 - i * 11}h14" stroke="#3a2f1c" stroke-width="1.2" opacity=".6"/>' for i in range(11)))
    pot = ('<ellipse cx="150" cy="486" rx="78" ry="13" fill="#000" opacity=".5" filter="url(#sceneblur8)"/>'
           '<path d="M66 396L78 474Q120 488 162 474L174 396Z" fill="url(#potg)"/>'
           '<ellipse cx="120" cy="396" rx="54" ry="11" fill="#b9603f"/><ellipse cx="120" cy="397" rx="46" ry="7.5" fill="#241810"/>'
           '<path d="M62 392Q120 404 178 392L176 404Q120 417 64 404Z" fill="url(#potg)"/><path d="M62 392Q120 404 178 392" stroke="#e0916c" stroke-width="1.2" fill="none" opacity=".6"/>')
    return pot + cane + ''.join(leaves)


def _oats():
    box = ('<ellipse cx="146" cy="842" rx="104" ry="14" fill="#000" opacity=".55" filter="url(#sceneblur8)"/>'
           '<path d="M50 602L226 606L224 836L52 832Z" fill="url(#boxf)"/>'
           '<path d="M50 602L226 606L240 582L66 578Z" fill="#f6ecd0"/>'
           '<path d="M226 606L240 582L238 814L224 836Z" fill="#a8956a"/>'
           '<path d="M50 602L226 606L227 646L51 642Z" fill="#2b6a4a"/>'
           '<path d="M51 642L227 646" stroke="#e9d9a8" stroke-width="1.6" opacity=".8"/>'
           '<text x="138" y="632" font-size="19" font-weight="800" text-anchor="middle" letter-spacing="2.4" font-family="var(--font-text)" fill="#f3e7c4">MILL LANE</text>'
           '<text x="138" y="678" font-size="20" font-weight="700" font-style="italic" text-anchor="middle" font-family="var(--font-serif)" fill="#2a2a24">Porridge Oats</text>'
           '<path d="M92 716a46 30 0 0092 0z" fill="#d9c9a0" stroke="#7a6a44" stroke-width="1.4"/><path d="M92 716h92" stroke="#7a6a44" stroke-width="1.4"/>'
           '<path d="M112 702c-6-10 6-14 0-24M138 700c-6-10 6-14 0-26M164 702c-6-10 6-14 0-24" stroke="#8a7a52" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>'
           '<text x="62" y="822" font-size="12.5" font-weight="700" font-family="var(--font-text)" fill="#3a3a30">1 kg</text>'
           '<rect x="116" y="728" width="106" height="98" rx="3" fill="#f7f4ea"/>')
    return box + barcode(128, 738, 84, 44)


def _paper():
    lines = ['From Monday 9 November your general', 'waste bin moves to Thursdays instead', 'of Wednesdays. Recycling stays on', 'alternate Fridays, as before.', 'Please put your bins out by 7 am.']
    body = ''.join(f'<text x="214" y="{458 + i * 11.5}" font-size="7.8" font-family="var(--font-text)" fill="#2c3138">{t}</text>' for i, t in enumerate(lines))
    return ('<g transform="rotate(-6 300 476)">'
            '<rect x="206" y="410" width="204" height="150" rx="2" fill="#000" opacity=".5" transform="translate(5 9)" filter="url(#sceneblur6)"/>'
            '<rect x="200" y="402" width="204" height="150" rx="2" fill="url(#paperg)"/>'
            '<rect x="200" y="466" width="204" height="1.4" fill="#000" opacity=".07"/>'
            '<rect x="214" y="414" width="22" height="7" fill="#2c5f86"/><text x="242" y="421" font-size="8" font-weight="800" letter-spacing=".9" font-family="var(--font-text)" fill="#2c3a48">WASTE SERVICES</text>'
            '<text x="214" y="442" font-size="12.5" font-weight="800" letter-spacing="-.1" font-family="var(--font-text)" fill="#1b2430">Your bin days are changing</text>'
            + body +
            '<rect x="214" y="520" width="176" height=".8" fill="#2c3138" opacity=".35"/>'
            '<text x="214" y="534" font-size="7" font-family="var(--font-text)" fill="#4a5058">Questions? Ask at your local library.</text></g>')


def _mug():
    return ('<g transform="translate(-34 0)"><ellipse cx="376" cy="800" rx="46" ry="10" fill="#000" opacity=".5" filter="url(#sceneblur6)"/>'
            '<path d="M338 716h74l-6 78q-31 12-62 0z" fill="url(#mugg)"/><ellipse cx="375" cy="716" rx="37" ry="10" fill="#e8e2d4"/><ellipse cx="375" cy="717" rx="31" ry="7.2" fill="#5a3a22"/>'
            '<path d="M410 730q26 2 22 26-3 18-24 18" fill="none" stroke="#d6cfbf" stroke-width="8" stroke-linecap="round"/></g>')


def lens_scene(uid='s'):
    rnd = random.Random(8)
    defs = ('<defs>'
            '<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14212a"/><stop offset=".5" stop-color="#1e2b31"/><stop offset="1" stop-color="#2a2622"/></linearGradient>'
            '<linearGradient id="tbl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4730"/><stop offset=".25" stop-color="#46301f"/><stop offset="1" stop-color="#1c120c"/></linearGradient>'
            '<radialGradient id="lamp" cx="86%" cy="42%" r="60%"><stop offset="0" stop-color="#ffb868" stop-opacity=".46"/><stop offset=".5" stop-color="#ff9a4a" stop-opacity=".14"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/></radialGradient>'
            '<radialGradient id="vig" cx="50%" cy="46%" r="72%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>'
            '<linearGradient id="potg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6a301d"/><stop offset=".45" stop-color="#b05a3c"/><stop offset=".8" stop-color="#d27a56"/><stop offset="1" stop-color="#9b4c33"/></linearGradient>'
            '<linearGradient id="paperg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1ebdb"/><stop offset="1" stop-color="#d6cfbc"/></linearGradient>'
            '<linearGradient id="boxf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e2d2a8"/><stop offset=".7" stop-color="#f0e3c0"/><stop offset="1" stop-color="#d9c898"/></linearGradient>'
            '<linearGradient id="mugg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9b2a2"/><stop offset=".6" stop-color="#ece6d8"/><stop offset="1" stop-color="#c5beae"/></linearGradient>'
            '<filter id="sceneblur14" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>'
            '<filter id="sceneblur8" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>'
            '<filter id="sceneblur6" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>'
            '<filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".45"/></filter>'
            '<filter id="wood" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".004 .2" numOctaves="3" seed="6"/>'
            '<feColorMatrix type="matrix" values="0 0 0 0 .78  0 0 0 0 .52  0 0 0 0 .32  1.7 0 0 0 -.62"/></filter>'
            '<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="3"/>'
            '<feColorMatrix type="matrix" values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .9 -.1"/></filter>'
            '</defs>')
    bokeh = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>' for x, y, r, c in [
        (338, 88, 30, 'rgba(255,196,120,.50)'), (396, 152, 44, 'rgba(255,184,100,.34)'), (290, 204, 22, 'rgba(255,214,150,.42)'),
        (412, 52, 24, 'rgba(255,200,130,.4)'), (352, 244, 16, 'rgba(255,214,150,.32)'), (252, 120, 14, 'rgba(255,190,110,.3)'),
        (60, 318, 20, 'rgba(160,200,255,.22)'), (214, 300, 12, 'rgba(255,196,120,.22)')])
    back = (f'<rect width="440" height="956" fill="url(#wall)"/>'
            f'<g filter="url(#sceneblur14)"><rect x="-30" y="-24" width="210" height="270" fill="#5e8196" opacity=".72"/><rect x="-30" y="108" width="210" height="9" fill="#14212a" opacity=".6"/><rect x="62" y="-24" width="9" height="270" fill="#14212a" opacity=".6"/>{bokeh}</g>')
    table = ('<path d="M-12 372L452 348V980H-12Z" fill="url(#tbl)"/>'
             '<path d="M-12 372L452 348V980H-12Z" filter="url(#wood)" opacity=".42"/>'
             '<path d="M-12 372L452 348" stroke="#a37450" stroke-width="1.4" opacity=".55"/>'
             '<rect x="0" y="360" width="440" height="596" fill="url(#lamp)"/>')
    scene = (f'<g filter="url(#soft)">{_plant(rnd)}{_paper()}{_oats()}{_mug()}</g>')
    over = ('<rect width="440" height="956" fill="url(#lamp)" style="mix-blend-mode:screen" opacity=".7"/>'
            '<rect width="440" height="956" fill="url(#vig)"/>'
            '<rect width="440" height="956" filter="url(#grain)" style="mix-blend-mode:overlay" opacity=".26"/>')
    return (f'<svg class="scene" width="100%" height="100%" viewBox="0 0 440 956" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
            f'{defs}{back}{table}{scene}{over}</svg>')
