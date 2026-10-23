"""Shared pieces for the three routes' mock-up pages: the iPhone 18 Pro Max frame (status bar, Dynamic Island,
home indicator), the icon set (24-pt line glyphs, most taken from the app's own SVG paths) and page writing.
Each route's build.py imports this and writes static HTML next to itself."""
import os

# 24 x 24 line icons. Paths marked (app) are the app's own glyphs (shell/areas.ts, features/*).
ICONS = {
    # the five areas and Me (app)
    'ask': '<path d="M4.5 5.5h15a1.5 1.5 0 011.5 1.5v8.5a1.5 1.5 0 01-1.5 1.5H10l-4.5 3.5V17H4.5A1.5 1.5 0 013 15.5V7a1.5 1.5 0 011.5-1.5z"/><path d="M12 8.5v5M9.5 11h5"/>',
    'see': '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>',
    'make': '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>',
    'learn': '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c3 2.1 8 2.1 11 0v-4.2M21.5 9.5v5"/>',
    'plan': '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
    'me': '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6"/>',
    # chat (app)
    'mic': '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    'cam': '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    'copy': '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7.5a2 2 0 002 2h2.5"/>',
    'listen': '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>',
    'brief': '<path d="M5 4.5h11.5a2 2 0 012 2V19a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19z"/><path d="M8.5 8.5h6M8.5 12h6M8.5 15.5h3.5M18.5 9H20v9.5a2 2 0 01-2 2"/>',
    'globe': '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5S14.6 18.1 12 20.5M12 3.5C9.4 5.9 8.2 8.7 8.2 12s1.2 6.1 3.8 8.5"/>',
    'calendar': '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
    'grid': '<rect x="4" y="4" width="6" height="6" rx="1.6"/><rect x="14" y="4" width="6" height="6" rx="1.6"/><rect x="4" y="14" width="6" height="6" rx="1.6"/><rect x="14" y="14" width="6" height="6" rx="1.6"/>',
    'sliders': '<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
    'gym': '<path d="M2 9v6M5 7v10M19 7v10M22 9v6"/><path d="M5 12h14"/>',
    'core': '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    # drawn for the mock-ups
    'search': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'minus': '<path d="M5 12h14"/>',
    'close': '<path d="M7 7l10 10M17 7L7 17"/>',
    'back': '<path d="M15 4.5L7.5 12l7.5 7.5"/>',
    'chev': '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    'chevdown': '<path d="M6 9.5l6 6 6-6"/>',
    'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'up': '<path d="M7.5 10.5V20H5a1.5 1.5 0 01-1.5-1.5V12A1.5 1.5 0 015 10.5zM7.5 10.5L11 3.5a2.4 2.4 0 012.4 2.6l-.5 3.9h5.4a2 2 0 012 2.3l-1.2 6.4a2 2 0 01-2 1.8H7.5"/>',
    'down': '<path d="M7.5 13.5V4H5a1.5 1.5 0 00-1.5 1.5V12A1.5 1.5 0 005 13.5zM7.5 13.5l3.5 7a2.4 2.4 0 002.4-2.6l-.5-3.9h5.4a2 2 0 002-2.3l-1.2-6.4a2 2 0 00-2-1.8H7.5"/>',
    'car': '<path d="M5 16.5V12l1.8-4.6A2 2 0 018.7 6h6.6a2 2 0 011.9 1.4L19 12v4.5"/><path d="M3.5 16.5h17v2a1 1 0 01-1 1H18a1 1 0 01-1-1v-1H7v1a1 1 0 01-1 1H4.5a1 1 0 01-1-1zM5 12h14"/><circle cx="8" cy="14.3" r=".6"/><circle cx="16" cy="14.3" r=".6"/>',
    'road': '<path d="M8 3.5L4.5 20.5M16 3.5l3.5 17M12 4v2.5M12 10v3M12 16.5V20"/>',
    'map': '<path d="M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    'cube': '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    'street': '<circle cx="12" cy="5.5" r="2.3"/><path d="M9 21l1-7-2-1 1.5-4.5h5L16 13l-2 1 1 7"/>',
    'traffic': '<rect x="8" y="2.5" width="8" height="19" rx="4"/><circle cx="12" cy="7" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="17" r="1.6"/>',
    'route': '<circle cx="6" cy="18" r="2.3"/><circle cx="18" cy="6" r="2.3"/><path d="M8.3 18H15a3 3 0 000-6H9a3 3 0 010-6h6.7"/>',
    'nav': '<path d="M12 3l7 17-7-4-7 4z"/>',
    'eye': '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>',
    'home': '<path d="M4 11l8-6.5 8 6.5v8.5a1 1 0 01-1 1h-4.5V15h-5v5.5H5a1 1 0 01-1-1z"/>',
    'north': '<circle cx="12" cy="12" r="8.5"/><path d="M12 6l2.8 7h-5.6z"/><path d="M9.2 13L12 18l2.8-5"/>',
    'tilt': '<path d="M3.5 17l5-10h7l5 10z"/><path d="M8.5 7l-2 10M15.5 7l2 10M5 13.5h14"/>',
    'layers': '<path d="M12 3.5l9 4.5-9 4.5L3 8z"/><path d="M3 12l9 4.5 9-4.5M3 16l9 4.5 9-4.5"/>',
    'plane': '<path d="M10.5 3.5c0-1 .7-1.5 1.5-1.5s1.5.5 1.5 1.5v5.5l7 4v2l-7-2v4.5l2.5 2V21L12 20l-4 1v-1.5l2.5-2V13l-7 2v-2l7-4z"/>',
    'quake': '<path d="M2.5 12h4l2-5.5 3.5 11 3-8 1.5 2.5h5"/>',
    'rain': '<path d="M7 15.5a4.5 4.5 0 01-.6-9A6 6 0 0117.8 8 3.8 3.8 0 0117 15.5z"/><path d="M8.5 18.5l-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2"/>',
    'sat': '<rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M8 8L4 4M16 16l4 4"/><path d="M2.5 7.5l5-5 3 3-5 5zM13.5 18.5l5-5 3 3-5 5z"/>',
    'ship': '<path d="M3 15.5l2 4.5h14l2-4.5-9-3z"/><path d="M6 13.5V8h12v5.5M12 8V4M9.5 4h5"/>',
    'cctv': '<path d="M3 7.5l13-3 1.5 5.5-13 3z"/><path d="M8 12l1 3.5h4M17.5 8.5l3.5-1M3 18.5v-4h3.5"/>',
    'warn': '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    'bolt': '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    'play': '<path d="M7.5 4.5v15l12-7.5z"/>',
    'stop': '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    'moon': '<path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z"/>',
    'brain': '<path d="M9 4.5a3 3 0 00-3 3 3 3 0 00-2 5.2A3.2 3.2 0 006.5 18a3 3 0 005.5 1.5V6A2.8 2.8 0 009 4.5z"/><path d="M15 4.5a3 3 0 013 3 3 3 0 012 5.2 3.2 3.2 0 01-2.5 5.3 3 3 0 01-5.5 1.5"/>',
    'chip': '<rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9.5 2.5V6M14.5 2.5V6M9.5 18v3.5M14.5 18v3.5M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5"/>',
    'link': '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    'shield': '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/>',
    'help': '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 014.9.6c0 1.8-2.5 2-2.5 3.6M12 16.6v.3"/>',
    'cloud': '<path d="M7 18.5a4.5 4.5 0 01-.6-9A6 6 0 0117.8 11 3.8 3.8 0 0117 18.5z"/>',
    'key': '<circle cx="8" cy="15.5" r="4"/><path d="M11 12.5l8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>',
    'wave': '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10.5v3"/>',
    'sparkle': '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    'clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    'pin': '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    'think': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/><path d="M3.5 12h2M18.5 12h2"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
}

# The GYM's game glyphs and tints (app: features/gym/index.ts GLYPH).
GAMES = {
    'sudoku': ('#64d2ff', '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>'),
    'chess': ('#bf5af2', '<path d="M8 20.5h8M9 17.5h6l-.6-6h-4.8zM10 11.5L8.5 8.5h7L14 11.5M12 8.5V4.5M10.5 5.5h3"/>'),
    'tictactoe': ('#0a84ff', '<path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>'),
    'connect4': ('#ff453a', '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="8" cy="10" r="1.6"/><circle cx="12" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/><circle cx="8" cy="14.5" r="1.6"/><circle cx="12" cy="14.5" r="1.6"/><circle cx="16" cy="14.5" r="1.6"/>'),
    'maze': ('#30d158', '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8.5 4v8h4M15.5 8.5V20M8.5 16h3.5"/>'),
    'words': ('#30d158', '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 16l3.5-8 3.5 8M9.8 13.2h4.4"/>'),
    'debate': ('#ff9f0a', '<path d="M3.5 5h10v7.5H8l-3 2.5v-2.5H3.5z"/><path d="M16.5 9h4v7.5H19V19l-3-2.5h-4.5v-1"/>'),
    'go': ('#ac8e68', '<circle cx="8" cy="8" r="2.6"/><circle cx="16" cy="16" r="2.6"/><path d="M4 12h16M12 4v16"/>'),
}


def icon(name, cls='i', size=None):
    s = f' width="{size}" height="{size}"' if size else ''
    return f'<svg class="{cls}" viewBox="0 0 24 24"{s} aria-hidden="true">{ICONS[name]}</svg>'


def game_icon(name, cls='i'):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{GAMES[name][1]}</svg>'


def status_bar(time='18:42'):
    """iOS status bar for the 18 Pro Max: time in the left ear, signal, Wi-Fi and battery in the right, the
    Dynamic Island (126 x 37 pt, 11 pt down) between them. Colour follows `currentColor`."""
    return f'''<div class="sb" aria-hidden="true">
  <span class="sb-time">{time}</span>
  <span class="island"></span>
  <span class="sb-right">
    <svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg viewBox="0 0 17 12" width="17" height="12"><path d="M8.5 2.2c2.5 0 4.8 1 6.5 2.6l1.2-1.3A11 11 0 008.5.4 11 11 0 00.8 3.5L2 4.8a9.3 9.3 0 016.5-2.6zM8.5 5.8c1.5 0 2.9.6 4 1.6l1.2-1.3a7.4 7.4 0 00-10.4 0l1.2 1.3c1.1-1 2.5-1.6 4-1.6zM8.5 9.2c.6 0 1.1.2 1.5.6L8.5 11.5 7 9.8c.4-.4.9-.6 1.5-.6z"/></svg>
    <svg viewBox="0 0 28 13" width="28" height="13"><rect x=".5" y=".5" width="24" height="12" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".38"/><rect x="2" y="2" width="17.5" height="9" rx="2.2"/><path d="M26 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill-opacity=".45"/></svg>
  </span>
</div>'''


HOME_INDICATOR = '<div class="hi" aria-hidden="true"></div>'

FRAME_CSS = '''
/* iPhone 18 Pro Max frame: 440 x 956 pt, Dynamic Island 126 x 37 at 11 pt, home indicator 139 x 5 at 8 pt up. */
.sb { position: absolute; z-index: 50; top: 0; left: 0; right: 0; height: 54px; pointer-events: none; }
.sb-time { position: absolute; left: 0; width: 157px; top: 18px; text-align: center; font: 600 17px/22px var(--f, 'Inter Mock'); letter-spacing: -0.2px; font-feature-settings: 'tnum'; padding-left: 14px; }
.island { position: absolute; left: 157px; top: 11px; width: 126px; height: 37px; border-radius: 19px; background: #000; }
.sb-right { position: absolute; right: 0; width: 157px; top: 22px; display: flex; gap: 6px; justify-content: center; align-items: center; padding-right: 12px; }
.sb-right svg { fill: currentColor; display: block; }
.hi { position: absolute; z-index: 60; left: 150.5px; bottom: 8px; width: 139px; height: 5px; border-radius: 3px; background: currentColor; }
'''


def page(title, body, css=('style.css',), body_cls='', extra_head=''):
    links = ''.join(f'<link rel="stylesheet" href="{c}">' for c in ('../fonts.css',) + tuple(css))
    return f'''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=440, initial-scale=1">
<title>{title}</title>
{links}
{extra_head}
</head>
<body class="{body_cls}">
{body}
</body>
</html>
'''


def write(folder, name, html):
    with open(os.path.join(folder, name), 'w', encoding='utf-8') as f:
        f.write(html)


def sparkline(values, w, h, pad=2):
    """Points for an SVG polyline drawn through `values` (0..1)."""
    n = len(values)
    pts = []
    for i, v in enumerate(values):
        x = pad + (w - 2 * pad) * (i / (n - 1 if n > 1 else 1))
        y = h - pad - (h - 2 * pad) * v
        pts.append(f'{x:.1f},{y:.1f}')
    return ' '.join(pts)


def contact(route, title, subtitle, bg, ink, ink2, hair, font="'Inter Mock'", title_font=None):
    """The contact sheet: the five screens side by side at 2x, framed as the phone, labelled."""
    shots = [('home', '1', 'Home'), ('chat', '2', 'Chat'), ('eye', '3', 'God’s Eye'), ('gym', '4', 'Gym'), ('settings', '5', 'Me · Settings')]
    tf = title_font or font
    cells = ''.join(f'''<figure><div class="ph"><img src="{n}.png" alt="{lab}"></div><figcaption><b>{k}</b>{lab}</figcaption></figure>''' for n, k, lab in shots)
    css = f'''
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: {bg}; color: {ink}; font-family: {font}, sans-serif; -webkit-font-smoothing: antialiased; width: 1730px; padding: 48px 56px 52px; }}
header {{ display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 34px; }}
h1 {{ font-family: {tf}, serif; font-size: 34px; line-height: 40px; font-weight: 700; letter-spacing: -0.6px; }}
h1 span {{ color: {ink2}; font-weight: 500; }}
header p {{ font-size: 17px; color: {ink2}; }}
.row {{ display: flex; gap: 46px; }}
figure {{ width: 284px; }}
.ph {{ width: 284px; height: 617px; border-radius: 44px; overflow: hidden; box-shadow: 0 0 0 1.5px {hair}, 0 0 0 7px #16181b, 0 0 0 8px rgba(255,255,255,.14), 0 30px 60px rgba(0,0,0,.45); }}
.ph img {{ width: 284px; height: 617px; display: block; }}
figcaption {{ margin-top: 22px; font-size: 16px; font-weight: 600; letter-spacing: -0.2px; text-align: center; }}
figcaption b {{ display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 12px; margin-right: 8px; font-size: 12px; background: {hair}; color: {ink}; vertical-align: 1px; }}
'''
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><title>Ghosty {route.upper()} · contact sheet</title>
<link rel="stylesheet" href="../fonts.css"><style>{css}</style></head>
<body><header><h1>{title}</h1><p>{subtitle}</p></header><div class="row">{cells}</div></body></html>
'''
