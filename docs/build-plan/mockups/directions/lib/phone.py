"""The phone around every mock screen, for the three directions: a status bar and home indicator that centre
themselves at any width (390 and 440 both), and the page writer. The screens themselves are fluid; this file only
draws what iOS draws (the Dynamic Island is 126 x 37 pt, 11 pt down; the home indicator is 139 x 5 pt, 8 pt up).
Standard library only. Imported by each dN/build.py (python3 -I -B docs/build-plan/mockups/directions/dN/build.py)."""
import os

# The one set of line glyphs is the app's own (tools/common.py ICONS); a direction sets their size and stroke by tokens.
FRAME_CSS = '''
/* the phone: status bar (time in the left ear, signal / Wi-Fi / battery in the right, the Island between) */
.sb { position: absolute; z-index: 50; top: 0; left: 0; right: 0; height: 54px; display: grid; grid-template-columns: 1fr 126px 1fr; pointer-events: none; color: #fff; }
.sb .time { align-self: start; margin-top: 18px; text-align: center; padding-left: 14px; font: 600 17px/22px var(--font-text); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.sb .island { margin-top: 11px; width: 126px; height: 37px; border-radius: 19px; background: #000; }
.sb .right { align-self: start; margin-top: 22px; padding-right: 12px; display: flex; gap: 6px; justify-content: center; align-items: center; }
.sb .right svg { display: block; fill: currentColor; }
.hi { position: absolute; z-index: 60; left: 50%; bottom: 8px; width: 139px; height: 5px; margin-left: -69.5px; border-radius: 3px; background: #fff; opacity: .92; pointer-events: none; }
html, body { margin: 0; padding: 0; }
body { width: 100vw; height: 100vh; overflow: hidden; background: var(--canvas); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
.screen { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--canvas); color: var(--ink-1); font: var(--t-body); letter-spacing: var(--tr-body); }
'''


def status_bar(time='21:08'):
    return f'''<div class="sb" aria-hidden="true">
  <span class="time">{time}</span>
  <span class="island"></span>
  <span class="right">
    <svg viewBox="0 0 18 12" width="18" height="12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg viewBox="0 0 17 12" width="17" height="12"><path d="M8.5 2.2c2.5 0 4.8 1 6.5 2.6l1.2-1.3A11 11 0 008.5.4 11 11 0 00.8 3.5L2 4.8a9.3 9.3 0 016.5-2.6zM8.5 5.8c1.5 0 2.9.6 4 1.6l1.2-1.3a7.4 7.4 0 00-10.4 0l1.2 1.3c1.1-1 2.5-1.6 4-1.6zM8.5 9.2c.6 0 1.1.2 1.5.6L8.5 11.5 7 9.8c.4-.4.9-.6 1.5-.6z"/></svg>
    <svg viewBox="0 0 28 13" width="28" height="13"><rect x=".5" y=".5" width="24" height="12" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".38"/><rect x="2" y="2" width="17.5" height="9" rx="2.2"/><path d="M26 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill-opacity=".45"/></svg>
  </span>
</div>'''


HOME_INDICATOR = '<div class="hi" aria-hidden="true"></div>'


def page(title, body, css=('tokens.css', 'style.css'), theme='reactor', extra_head='', body_cls=''):
    """One static screen. `css` are the direction's own files, beside the page; fonts.css is two levels up."""
    links = ''.join(f'<link rel="stylesheet" href="{c}">' for c in ('../../fonts.css',) + tuple(css))
    return f'''<!doctype html>
<html lang="en-GB" data-theme="{theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
{links}
<style>{FRAME_CSS}</style>
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
