"""Mind, the orb: a sphere of light with a rim, a faint graticule, an equator scale and, inside, a constellation (one
cluster per library field, one node per twenty passages, a node lit where that part has been studied) round a bright core.
This is what the owner means by "the orb kinda thing in the middle" (his words, 5 Nov); the app draws it live in 3-D
(features/core/mind.ts), the mock-ups draw one frame of it as flat SVG.

Colours are never written here: every stroke and gradient reads the direction's tokens (--accent-rgb, --ink-rgb) through
style="...", so a theme swap (data-theme on <html>) recolours the orb too. Standard library only.

orb(size, style, ...) returns an <svg> whose layout box is the sphere's own diameter `size`; its rim glow, halo and equator
ring bleed outside that box (overflow: visible), so it can sit in a flex row and be centred like any square.
  style 'glass'  route C's Mind: rim light, glass body, lit constellation, bright equator sweep (D3, and D1 with more light)
  style 'ink'    D2: the same sphere engraved in one ink, no fills; the core is the only colour
"""
import math
import random


def _stop(offset, rgb, alpha):
    return f'<stop offset="{offset}" style="stop-color:rgba(var({rgb}),{alpha})"/>'


def _rot(p, yaw, pitch):
    x, y, z = p
    c, s = math.cos(yaw), math.sin(yaw)
    x, z = x * c + z * s, -x * s + z * c
    c, s = math.cos(pitch), math.sin(pitch)
    y, z = y * c - z * s, y * s + z * c
    return x, y, z


def constellation(seed, n, clusters=8, spread=0.27, limit=0.88):
    """n points in the unit ball in `clusters` clumps (the library's fields), seeded so every frame is the same picture."""
    rnd = random.Random(seed)
    centres = []
    for _ in range(clusters):
        while True:
            c = (rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))
            if 0.18 < math.dist(c, (0, 0, 0)) < 0.7:
                centres.append(c)
                break
    pts = []
    while len(pts) < n:
        c = centres[len(pts) % clusters] if rnd.random() < 0.94 else (0.0, 0.0, 0.0)
        p = (c[0] + rnd.gauss(0, spread), c[1] + rnd.gauss(0, spread), c[2] + rnd.gauss(0, spread))
        if math.dist(p, (0, 0, 0)) < limit:
            pts.append(p)
    return pts


def _links(pts3, per=2, reach=0.46, core_links=5):
    """Each node to its nearest few; a handful run to the core, as the pulses do while Ghosty thinks."""
    seen = set()
    out = []
    for i, p in enumerate(pts3):
        near = sorted(((math.dist(p, q), j) for j, q in enumerate(pts3) if j != i))[:per]
        for d, j in near:
            if d < reach and (min(i, j), max(i, j)) not in seen:
                seen.add((min(i, j), max(i, j)))
                out.append((i, j))
    by_core = sorted(range(len(pts3)), key=lambda i: math.dist(pts3[i], (0, 0, 0)))[:core_links]
    out += [(i, -1) for i in by_core]
    return out


def _ellipse_arc(cx, cy, rx, ry, half):
    """Half of an ellipse as a path: 'back' is the upper half (behind the sphere), 'front' the lower (in front)."""
    sweep = 1 if half == 'back' else 0
    return f'M{cx - rx:.2f} {cy:.2f}A{rx:.2f} {ry:.2f} 0 0 {sweep} {cx + rx:.2f} {cy:.2f}'


def ring_ticks(cx, cy, rx, ry, half, minor, major, step=2.4, every=5, lo=0.0, hi=180.0):
    """Scale marks along half of the equator ring: short every `step` degrees, long every `every` marks."""
    out = []
    k = 0
    a = lo
    while a <= hi + 1e-6:
        t = math.radians(a if half == 'front' else 180 + a)
        # front: the lower arc runs 0..180 degrees in screen angle; back: the upper arc
        px, py = cx + rx * math.cos(t), cy + ry * math.sin(t)
        nx, ny = math.cos(t) / rx, math.sin(t) / ry
        n = math.hypot(nx, ny)
        nx, ny = nx / n, ny / n
        ln = major if k % every == 0 else minor
        out.append(f'M{px:.2f} {py:.2f}L{px + nx * ln:.2f} {py + ny * ln:.2f}')
        k += 1
        a += step
    return ''.join(out)


def orb(size, style='glass', uid='o', seed=11, lit=0.31, nodes=96, yaw=0.62, pitch=0.34, detail='full',
        ring=True, sweep=(24, 78), progress=None, halo=1.0, glow=1.0, label=None):
    """The orb. size: the sphere's diameter in px. lit: the studied share of the nodes (1,312 of 4,186 passages is 0.31).
    progress: 0..1 draws a thin flat ring round it (free answers left today); None draws none. detail 'mini' drops the
    graticule and the scale for an orb under about 72 px. label: the accessible name."""
    S = float(size)
    r = S / 2
    cx = cy = r
    mini = detail == 'mini' or S < 72
    ink = style == 'ink'
    # stroke weights scale with the sphere so a 48 px orb and a 240 px orb are the same drawing
    k = S / 232.0
    hair = max(0.5, 0.55 * k) if not mini else 0.5
    rim_w = max(1.0, 1.5 * k)
    ring_rx, ring_ry = r * 1.14, r * 0.30
    ids = {n: f'{uid}-{n}' for n in ('halo', 'body', 'fres', 'core', 'glow', 'soft', 'spec', 'clip', 'sw')}
    d = []
    add = d.append
    add('<defs>')
    # soft light behind and a tinted body, both from the accent
    add(f'<radialGradient id="{ids["halo"]}" cx="50%" cy="50%" r="50%">{_stop(0, "--accent-rgb", 0.0 if ink else round(0.30 * glow, 3))}{_stop(0.42, "--accent-rgb", 0.0 if ink else round(0.12 * glow, 3))}{_stop(1, "--accent-rgb", 0)}</radialGradient>')
    add(f'<radialGradient id="{ids["body"]}" cx="40%" cy="34%" r="76%">{_stop(0, "--accent-rgb", 0.24)}{_stop(0.5, "--accent-rgb", 0.085)}{_stop(1, "--accent-rgb", 0.02)}</radialGradient>')
    add(f'<radialGradient id="{ids["fres"]}" cx="50%" cy="50%" r="50%"><stop offset="0.74" style="stop-color:rgba(var(--accent-rgb),0)"/>{_stop(0.92, "--accent-rgb", 0.2)}{_stop(1, "--accent-rgb", 0.62)}</radialGradient>')
    add(f'<radialGradient id="{ids["core"]}" cx="50%" cy="50%" r="50%"><stop offset="0" style="stop-color:#fff"/><stop offset="0.18" style="stop-color:#fff;stop-opacity:.95"/>{_stop(0.3, "--accent-pale-rgb", 0.42)}{_stop(0.6, "--accent-rgb", 0.12)}{_stop(1, "--accent-rgb", 0)}</radialGradient>')
    add(f'<radialGradient id="{ids["spec"]}" cx="50%" cy="50%" r="50%"><stop offset="0" style="stop-color:#fff;stop-opacity:.22"/><stop offset="1" style="stop-color:#fff;stop-opacity:0"/></radialGradient>')
    add(f'<filter id="{ids["glow"]}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="{max(0.8, 3.2 * k):.2f}"/></filter>')
    add(f'<filter id="{ids["soft"]}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="{max(0.5, 1.2 * k):.2f}"/></filter>')
    add(f'<clipPath id="{ids["clip"]}"><circle cx="{cx}" cy="{cy}" r="{r:.2f}"/></clipPath>')
    add('</defs>')

    # 1 halo
    if not ink and halo > 0:
        add(f'<circle cx="{cx}" cy="{cy}" r="{r * 2.15:.1f}" fill="url(#{ids["halo"]})" opacity="{halo}"/>')
    # 2 progress ring (a flat gauge round the orb)
    if progress is not None and not mini:
        pr = r * 1.34
        a0, span = -218.0, 256.0
        def pt(a):
            t = math.radians(a)
            return cx + pr * math.cos(t), cy + pr * math.sin(t)
        x0, y0 = pt(a0)
        x1, y1 = pt(a0 + span)
        xe, ye = pt(a0 + span * progress)
        large = 1 if span * progress > 180 else 0
        add(f'<path d="M{x0:.2f} {y0:.2f}A{pr:.2f} {pr:.2f} 0 1 1 {x1:.2f} {y1:.2f}" fill="none" style="stroke:rgba(var(--ink-rgb),.14)" stroke-width="{1.5 * k:.2f}" stroke-linecap="round"/>')
        add(f'<path d="M{x0:.2f} {y0:.2f}A{pr:.2f} {pr:.2f} 0 {large} 1 {xe:.2f} {ye:.2f}" fill="none" style="stroke:rgb(var(--accent-rgb))" stroke-width="{2.2 * k:.2f}" stroke-linecap="round"/>')
        add(f'<circle cx="{xe:.2f}" cy="{ye:.2f}" r="{2.6 * k:.2f}" style="fill:rgb(var(--accent-pale-rgb))"/>')
    # 3 the back half of the equator ring, seen through the glass
    if ring and not mini:
        add(f'<path d="{_ellipse_arc(cx, cy, ring_rx, ring_ry, "back")}" fill="none" style="stroke:rgba(var(--accent-pale-rgb),.30)" stroke-width="{max(0.5, 0.9 * k):.2f}"/>')
        if not ink or True:
            add(f'<path d="{ring_ticks(cx, cy, ring_rx, ring_ry, "back", 2.2 * k, 4.6 * k)}" fill="none" style="stroke:rgba(var(--accent-pale-rgb),.28)" stroke-width="{max(0.4, 0.55 * k):.2f}"/>')
    # 4 the body
    if ink:
        add(f'<circle cx="{cx}" cy="{cy}" r="{r:.2f}" style="fill:rgba(var(--canvas-rgb),.86)"/>')
    else:
        add(f'<circle cx="{cx}" cy="{cy}" r="{r:.2f}" style="fill:rgba(2,9,16,.78)"/>')
        add(f'<circle cx="{cx}" cy="{cy}" r="{r:.2f}" fill="url(#{ids["body"]})"/>')
        add(f'<circle cx="{cx}" cy="{cy}" r="{r:.2f}" fill="url(#{ids["fres"]})"/>')
    # 5 graticule: meridians and parallels, a hairline each
    if not mini:
        g = []
        for lam in (20, 50, 80, 110, 140, 170):
            rx = abs(r * math.cos(math.radians(lam + yaw * 40)))
            g.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx:.2f}" ry="{r:.2f}"/>')
        for lat in (-60, -30, 30, 60):
            rr = r * math.cos(math.radians(lat))
            ry = rr * math.sin(pitch + 0.15)
            yy = cy + r * math.sin(math.radians(lat)) * math.cos(pitch + 0.15)
            g.append(f'<ellipse cx="{cx}" cy="{yy:.2f}" rx="{rr:.2f}" ry="{ry:.2f}"/>')
        op = 0.20 if ink else 0.075
        add(f'<g clip-path="url(#{ids["clip"]})" fill="none" style="stroke:rgba(var(--{"ink" if ink else "accent-pale"}-rgb),{op})" stroke-width="{hair:.2f}">{"".join(g)}</g>')
    # 6 the constellation
    n = max(10, int(nodes * (0.34 if mini else 1.0)))
    p3 = constellation(seed, n)
    rp = [_rot(p, yaw, pitch) for p in p3]
    links = _links(p3, per=2 if not mini else 1, reach=0.46, core_links=3 if mini else 6)
    lines_far, lines_near = [], []
    for i, j in links:
        a = rp[i]
        b = rp[j] if j >= 0 else (0.0, 0.0, 0.0)
        seg = f'M{cx + a[0] * r:.2f} {cy + a[1] * r:.2f}L{cx + b[0] * r:.2f} {cy + b[1] * r:.2f}'
        (lines_near if (a[2] + b[2]) / 2 > 0 else lines_far).append(seg)
    lc = 'ink' if ink else 'accent-pale'
    add(f'<g clip-path="url(#{ids["clip"]})" fill="none">')
    add(f'<path d="{"".join(lines_far)}" style="stroke:rgba(var(--{lc}-rgb),{0.16 if ink else 0.13})" stroke-width="{max(0.4, 0.55 * k):.2f}"/>')
    add(f'<path d="{"".join(lines_near)}" style="stroke:rgba(var(--{lc}-rgb),{0.42 if ink else 0.34})" stroke-width="{max(0.45, 0.7 * k):.2f}"/>')
    add('</g>')
    rnd = random.Random(seed + 5)
    order = sorted(range(n), key=lambda i: rp[i][2])
    lit_set = set(rnd.sample(range(n), int(round(n * lit))))
    nodes_unlit, nodes_lit, glints = [], [], []
    for i in order:
        x, y, z = rp[i]
        px, py = cx + x * r, cy + y * r
        depth = (z + 1) / 2
        if i in lit_set:
            rr = max(0.9, (1.15 + 0.9 * depth) * k * (0.85 if mini else 1))
            nodes_lit.append(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="{rr:.2f}" style="fill:rgb(var(--{lc}-rgb))" opacity="{0.55 + 0.45 * depth:.2f}"/>')
            if not ink:
                glints.append(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="{rr * 2.9:.2f}" style="fill:rgba(var(--accent-rgb),.7)" opacity="{0.4 + 0.55 * depth:.2f}"/>')
            else:
                nodes_lit.append(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="{rr * 2.5:.2f}" fill="none" style="stroke:rgba(var(--ink-rgb),.45)" stroke-width="{max(0.4, 0.55 * k):.2f}"/>')
        else:
            rr = max(0.6, (0.6 + 0.55 * depth) * k)
            nodes_unlit.append(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="{rr:.2f}" style="fill:rgba(var(--{lc}-rgb),{0.30 + 0.34 * depth:.2f})"/>')
    add(f'<g clip-path="url(#{ids["clip"]})">')
    if glints:
        add(f'<g filter="url(#{ids["glow"]})">{"".join(glints)}</g>')
    add(''.join(nodes_unlit) + ''.join(nodes_lit))
    add('</g>')
    # 7 the core
    cr = r * (0.40 if not ink else 0.34)
    if ink:
        add(f'<circle cx="{cx}" cy="{cy}" r="{r * 0.34:.2f}" fill="url(#{ids["core"]})"/>')
        add(f'<circle cx="{cx}" cy="{cy}" r="{max(1.6, 3.4 * k):.2f}" style="fill:rgb(var(--accent-rgb))"/>')
        add(f'<circle cx="{cx}" cy="{cy}" r="{max(2.6, 6.4 * k):.2f}" fill="none" style="stroke:rgba(var(--accent-rgb),.6)" stroke-width="{max(0.5, 0.8 * k):.2f}"/>')
    else:
        add(f'<circle cx="{cx}" cy="{cy}" r="{cr:.2f}" fill="url(#{ids["core"]})"/>')
        add(f'<circle cx="{cx}" cy="{cy}" r="{max(1.6, 3.0 * k):.2f}" style="fill:#fff"/>')
    # 8 the glass: a specular, then the rim (a soft copy under a crisp one)
    if not ink:
        add(f'<ellipse cx="{cx - r * 0.34:.2f}" cy="{cy - r * 0.46:.2f}" rx="{r * 0.34:.2f}" ry="{r * 0.2:.2f}" transform="rotate(-28 {cx - r * 0.34:.2f} {cy - r * 0.46:.2f})" fill="url(#{ids["spec"]})"/>')
        add(f'<circle cx="{cx}" cy="{cy}" r="{r - rim_w * 0.4:.2f}" fill="none" style="stroke:rgba(var(--accent-rgb),.9)" stroke-width="{rim_w * 1.6:.2f}" filter="url(#{ids["glow"]})" opacity="{0.8 * glow:.2f}"/>')
        add(f'<circle cx="{cx}" cy="{cy}" r="{r - rim_w / 2:.2f}" fill="none" style="stroke:rgba(var(--accent-rgb),.92)" stroke-width="{rim_w:.2f}"/>')
    else:
        add(f'<circle cx="{cx}" cy="{cy}" r="{r - 0.5:.2f}" fill="none" style="stroke:rgba(var(--ink-rgb),.92)" stroke-width="{max(0.8, 1.0 * k):.2f}"/>')
    # 9 the front half of the equator ring, bright, with its sweep
    if ring and not mini:
        front = _ellipse_arc(cx, cy, ring_rx, ring_ry, 'front')
        add(f'<path d="{front}" fill="none" style="stroke:rgba(var({"--ink-rgb" if ink else "--accent-pale-rgb"}),{0.7 if ink else 0.78})" stroke-width="{max(0.6, 1.0 * k):.2f}"/>')
        add(f'<path d="{ring_ticks(cx, cy, ring_rx, ring_ry, "front", 2.4 * k, 5.2 * k)}" fill="none" style="stroke:rgba(var({"--ink-rgb" if ink else "--accent-pale-rgb"}),{0.55 if ink else 0.62})" stroke-width="{max(0.45, 0.6 * k):.2f}"/>')
        a0, a1 = sweep
        sw_path = ring_ticks(cx, cy, ring_rx, ring_ry, 'front', 2.8 * k, 6.4 * k, step=1.2, every=4, lo=a0, hi=a1)
        add(f'<path d="{sw_path}" fill="none" style="stroke:rgb(var(--accent-rgb))" stroke-width="{max(0.7, 1.1 * k):.2f}"/>')
        if not ink:
            add(f'<path d="{sw_path}" fill="none" style="stroke:rgba(var(--accent-rgb),.85)" stroke-width="{max(1.2, 2.2 * k):.2f}" filter="url(#{ids["glow"]})"/>')
    aria = f' role="img" aria-label="{label}"' if label else ' aria-hidden="true"'
    return f'<svg class="orb orb-{style}" width="{S:g}" height="{S:g}" viewBox="0 0 {S:g} {S:g}" style="overflow:visible"{aria}>{"".join(d)}</svg>'
