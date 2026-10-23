"""The God's Eye globe for the mock-ups, drawn from Ghosty's own atlas (apps/web/public/data/world.json):
an orthographic view centred near the owner's home, land, borders, a graticule, city lights on the night
side and the real terminator for Friday 23 Oct, 18:42 BST. Imported by each route's build.py.
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
_W = None


def world():
    global _W
    if _W is None:
        _W = json.load(open(os.path.join(ROOT, 'apps/web/public/data/world.json')))
    return _W


def _decode(arr, q):
    x, y = arr[0], arr[1]
    pts = [(x / q, y / q)]
    for i in range(2, len(arr), 2):
        x += arr[i]
        y += arr[i + 1]
        pts.append((x / q, y / q))
    return pts


class Ortho:
    def __init__(s, lat0, lon0, R, cx, cy):
        s.p0, s.l0, s.R, s.cx, s.cy = math.radians(lat0), math.radians(lon0), R, cx, cy

    def proj(s, lon, lat):
        p, l = math.radians(lat), math.radians(lon)
        cosc = math.sin(s.p0) * math.sin(p) + math.cos(s.p0) * math.cos(p) * math.cos(l - s.l0)
        x = math.cos(p) * math.sin(l - s.l0)
        y = math.cos(s.p0) * math.sin(p) - math.sin(s.p0) * math.cos(p) * math.cos(l - s.l0)
        return x, y, cosc

    def xy(s, lon, lat, clamp=False):
        x, y, c = s.proj(lon, lat)
        if c < 0:
            if not clamp:
                return None
            n = math.hypot(x, y) or 1
            x, y = x / n, y / n
        return (s.cx + s.R * x, s.cy - s.R * y)


def _path(pts, closed, tol=0.7):
    out, last = [], None
    for p in pts:
        if last is not None and abs(p[0] - last[0]) < tol and abs(p[1] - last[1]) < tol:
            continue
        out.append(('M' if not out else 'L') + f'{p[0]:.1f} {p[1]:.1f}')
        last = p
    if len(out) < 3 and closed:
        return ''
    if len(out) < 2:
        return ''
    return ''.join(out) + ('Z' if closed else '')


def _lines(o, polylines, tol=0.7):
    d = []
    for pl in polylines:
        seg = []
        for lon, lat in pl:
            p = o.xy(lon, lat)
            if p is None:
                if len(seg) > 1:
                    d.append(_path(seg, False, tol))
                seg = []
            else:
                seg.append(p)
        if len(seg) > 1:
            d.append(_path(seg, False, tol))
    return ''.join(d)


# The sun at 17:42 UTC on 23 Oct 2026: declination about -11.4 deg, subsolar longitude about -85.6 deg.
SUN = (-85.6, -11.4)


def daylight(lon, lat):
    p, l = math.radians(lat), math.radians(lon)
    ps, ls = math.radians(SUN[1]), math.radians(SUN[0])
    return math.sin(p) * math.sin(ps) + math.cos(p) * math.cos(ps) * math.cos(l - ls)


def geometry(lat0, lon0, R, cx, cy):
    """Path data and points for one view."""
    W = world()
    q = W['q']
    o = Ortho(lat0, lon0, R, cx, cy)
    land = []
    for poly in W['land']:
        for ring in poly:
            r = _decode(ring, q)
            if not any(o.proj(lo, la)[2] >= 0 for lo, la in r):
                continue
            land.append(_path([o.xy(lo, la, clamp=True) for lo, la in r], True))
    borders = _lines(o, [_decode(b, q) for b in W['borders']])
    grat = []
    for lon in range(-180, 180, 15):
        grat.append([(lon, la / 2) for la in range(-170, 171, 2)])
    for lat in range(-75, 76, 15):
        grat.append([(lo / 2, lat) for lo in range(-360, 361, 2)])
    lights = []
    for name, lat, lon, pop, country, cap in W['cities'][:2500]:
        if pop < 150000:
            continue
        p = o.xy(lon, lat)
        if p is None:
            continue
        dl = daylight(lon, lat)
        if dl > 0.04:
            continue
        r = 0.45 + max(0.0, min(2.4, math.log10(max(pop, 1e4)) - 4)) * 0.5
        a = max(0.25, min(1.0, 0.3 + (0.04 - dl) * 4))
        lights.append((round(p[0], 1), round(p[1], 1), round(r, 2), round(a, 2), name))
    sx, sy, sz = o.proj(*SUN)
    n = math.hypot(sx, sy) or 1
    ux, uy = sx / n, -sy / n
    return dict(
        o=o,
        land=''.join(land),
        borders=borders,
        grat=_lines(o, grat, 1.2),
        lights=lights,
        sun=(cx + ux * R, cy + uy * R, cx - ux * R, cy - uy * R),
        sunz=sz,
    )


# ---------------------------------------------------------------- a perspective camera (the app's tilted view)
def _v(lon, lat):
    p, l = math.radians(lat), math.radians(lon)
    return (math.cos(p) * math.cos(l), math.cos(p) * math.sin(l), math.sin(p))


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _add(a, b, k=1.0):
    return (a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k)


def _mul(a, k):
    return (a[0] * k, a[1] * k, a[2] * k)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _norm(a):
    n = math.sqrt(_dot(a, a)) or 1
    return _mul(a, 1 / n)


class Persp:
    """A pinhole camera `dist_km` from the target, tilted `tilt` degrees from straight down, looking north."""

    def __init__(s, lat, lon, dist_km, tilt, f, px, py):
        T = _v(lon, lat)
        U = T
        E = _norm(_cross((0, 0, 1), U))
        N = _cross(U, E)
        d = dist_km / 6371.0
        t = math.radians(tilt)
        s.C = _add(T, _add(_mul(U, math.cos(t)), N, -math.sin(t)), d)
        s.F = _norm(_sub(T, s.C))
        s.R = _norm(_cross(s.F, U))
        s.Up = _cross(s.R, s.F)
        s.f, s.px, s.py = f, px, py
        s.c = math.sqrt(_dot(s.C, s.C))
        s.alt_km = (s.c - 1) * 6371

    def _scr(s, P):
        v = _sub(P, s.C)
        z = _dot(v, s.F)
        if z <= 1e-6:
            return None
        return (s.px + s.f * _dot(v, s.R) / z, s.py - s.f * _dot(v, s.Up) / z)

    def _limb(s, P):
        ch = _mul(s.C, 1 / s.c)
        w = _norm(_sub(P, _mul(ch, _dot(P, ch))))
        return _add(_mul(ch, 1 / s.c), w, math.sqrt(1 - 1 / s.c ** 2))

    def proj(s, lon, lat):
        P = _v(lon, lat)
        vis = _dot(P, _sub(s.C, P))
        q = s._scr(P)
        return (q[0] if q else 0, q[1] if q else 0, vis if q else -1)

    def xy(s, lon, lat, clamp=False):
        P = _v(lon, lat)
        if _dot(P, _sub(s.C, P)) < 0:
            if not clamp:
                return None
            P = s._limb(P)
        return s._scr(P)

    def limb_path(s, n=720):
        ch = _mul(s.C, 1 / s.c)
        a = _norm(_cross(ch, (0, 0, 1)))
        b = _cross(ch, a)
        pts = []
        for k in range(n):
            th = 2 * math.pi * k / n
            w = _add(_mul(a, math.cos(th)), b, math.sin(th))
            L = _add(_mul(ch, 1 / s.c), w, math.sqrt(1 - 1 / s.c ** 2))
            q = s._scr(L)
            if q and -2000 < q[0] < 2440 and -2000 < q[1] < 3000:
                pts.append(q)
        return _path(pts, True, 0.3)


def geometry_persp(lat, lon, dist_km, tilt, f, px, py):
    W = world()
    q = W['q']
    o = Persp(lat, lon, dist_km, tilt, f, px, py)
    land = []
    for poly in W['land']:
        for ring in poly:
            r = _decode(ring, q)
            if not any(o.proj(lo, la)[2] >= 0 for lo, la in r):
                continue
            pts = [o.xy(lo, la, clamp=True) for lo, la in r]
            pts = [p for p in pts if p]
            land.append(_path(pts, True))
    borders = _lines(o, [_decode(b, q) for b in W['borders']])
    grat = []
    for g_lon in range(-180, 180, 10):
        grat.append([(g_lon, la / 2) for la in range(-170, 171, 1)])
    for g_lat in range(-80, 81, 10):
        grat.append([(lo / 2, g_lat) for lo in range(-360, 361, 1)])
    lights = []
    for name, c_lat, c_lon, pop, country, cap in W['cities'][:4000]:
        if pop < 120000:
            continue
        p = o.xy(c_lon, c_lat)
        if p is None or not (-20 < p[0] < 460 and -20 < p[1] < 980):
            continue
        dl = daylight(c_lon, c_lat)
        if dl > 0.04:
            continue
        r = 0.5 + max(0.0, min(2.4, math.log10(max(pop, 1e4)) - 4)) * 0.6
        a = max(0.3, min(1.0, 0.35 + (0.04 - dl) * 4))
        lights.append((round(p[0], 1), round(p[1], 1), round(r, 2), round(a, 2), name))
    # the sun's side on screen: from a point 20 deg west of the target towards it
    w0 = o.xy(lon - 25, lat) or (px - 300, py)
    return dict(o=o, land=''.join(land), borders=borders, grat=_lines(o, grat, 1.0), lights=lights,
                limb=o.limb_path(), sun=(w0[0], w0[1], px + (px - w0[0]), py + (py - w0[1])), alt=o.alt_km)
