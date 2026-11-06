"""Scale marks round a rounded rectangle: the orb's equator scale, grown into the frame of a Stage (STARS 164: Mind
becomes the Stage's frame). Returns SVG path data, outward ticks, a long one every `every` marks. Standard library only."""
import math


def _perimeter(w, h, r):
    """Segments of a rounded rectangle from the top-left corner's end, clockwise: ('line' | 'arc', geometry)."""
    segs = [('line', (r, 0), (w - r, 0), (0, -1)),
            ('arc', (w - r, r), -90, 0),
            ('line', (w, r), (w, h - r), (1, 0)),
            ('arc', (w - r, h - r), 0, 90),
            ('line', (w - r, h), (r, h), (0, 1)),
            ('arc', (r, h - r), 90, 180),
            ('line', (0, h - r), (0, r), (-1, 0)),
            ('arc', (r, r), 180, 270)]
    return segs


def rrect_ticks(w, h, r, step=8.0, minor=3.0, major=6.0, every=5, skip=None, offset=0.0):
    """Path data of ticks standing outside a w x h rounded rectangle (corner radius r). `skip(x, y)` returns True where a
    mark should be left out (under the orb that sits on the frame). `offset` shifts the first mark along the edge."""
    out = []
    k = 0
    travelled = 0.0
    carry = offset
    for seg in _perimeter(w, h, r):
        if seg[0] == 'line':
            (x0, y0), (x1, y1), (nx, ny) = seg[1], seg[2], seg[3]
            length = math.hypot(x1 - x0, y1 - y0)
            ux, uy = (x1 - x0) / length, (y1 - y0) / length
            s = carry
            while s <= length + 1e-6:
                x, y = x0 + ux * s, y0 + uy * s
                ln = major if k % every == 0 else minor
                if not (skip and skip(x, y)):
                    out.append(f'M{x:.2f} {y:.2f}L{x + nx * ln:.2f} {y + ny * ln:.2f}')
                k += 1
                s += step
            carry = s - length
        elif r > 0:
            (cx, cy), a0, a1 = seg[1], seg[2], seg[3]
            length = math.radians(a1 - a0) * r
            s = carry
            while s <= length + 1e-6:
                a = math.radians(a0) + s / r
                nx, ny = math.cos(a), math.sin(a)
                x, y = cx + nx * r, cy + ny * r
                ln = major if k % every == 0 else minor
                if not (skip and skip(x, y)):
                    out.append(f'M{x:.2f} {y:.2f}L{x + nx * ln:.2f} {y + ny * ln:.2f}')
                k += 1
                s += step
            carry = s - length
    return ''.join(out)


def rrect_path(w, h, r):
    """The rounded rectangle itself, as path data, for the hairline the ticks stand on."""
    if r <= 0:
        return f'M0 0H{w}V{h}H0Z'
    return (f'M{r} 0H{w - r}A{r} {r} 0 0 1 {w} {r}V{h - r}A{r} {r} 0 0 1 {w - r} {h}H{r}A{r} {r} 0 0 1 0 {h - r}V{r}A{r} {r} 0 0 1 {r} 0Z')
