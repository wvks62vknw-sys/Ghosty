"""The Every screen deck without "app icons" (OWNER-ISSUES 32): three options and the Me sheet, as static HTML.
Run from the worktree root:  python3 -I docs/build-plan/mockups/deck/build.py
then:                        node docs/build-plan/mockups/tools/render.mjs deck a b c me contact
style.css is route C's, copied unchanged; each page carries its own few extra rules inline.
Every glyph is the app's own (features/*/index.ts `icon`, shell/areas.ts Me glyphs); every number is one the
app showed on Friday 23 Oct, late evening, in Birmingham (design-build-2 screenshots)."""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
from common import FRAME_CSS, HOME_INDICATOR, icon, page, status_bar, write  # noqa: E402

CYAN = '#64d2ff'
TIME = '23:06'

# The app's own glyphs (24 x 24, line).
G = {
    'core': '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    'brief': '<rect x="3" y="4" width="18" height="14" rx="1"/><path d="M7 9h10M7 13h6M8 21h8"/>',
    'eye': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
    'lens': '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    'studio': '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
    'workshop': '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    'reverse': '<path d="M4 7h11a4 4 0 010 8H9"/><path d="M7 11l-3 4 3 4"/><circle cx="18" cy="7" r="2"/>',
    'space': '<path d="M3 4h18v16H3z"/><path d="M3 12h7v8M14 4v5h7"/><path d="M6 15h2M16 6h2"/>',
    'learn': '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5"/><path d="M22 8v6"/>',
    'gym': '<path d="M2 9v6M5 7v10M19 7v10M22 9v6"/><path d="M5 12h14"/>',
    'school': '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c3 2.1 8 2.1 11 0v-4.2"/><path d="M12 14v6.5"/>',
    'library': '<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z"/><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z"/>',
    'agenda': '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h3M13.5 13h3M7.5 16.5h3"/>',
    'markets': '<path d="M3 20h18M6 16v-5M11 16V7M16 16v-8M21 16V4"/>',
    'threats': '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    'radio': '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8l10-5"/><circle cx="15.5" cy="14" r="3"/><path d="M6 12h4M6 15h4"/>',
    'memory': '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="M8 7l8 1M7 8l2 8M17 10l-6 7"/>',
    'settings': '<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
    'system': '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
    'links': '<path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>',
    # the Me sheet's own (shell/areas.ts GLYPHS)
    'me-memory': '<path d="M12 4.5c-1.2-1.3-3.6-1.4-4.8.1-1.3-.1-2.6 1-2.5 2.5C3.4 7.8 3 9.6 4 10.8c-.9 1.2-.6 3 .7 3.7-.2 1.6 1 3 2.6 2.9.6 1.5 2.6 2.1 3.9 1.1.3.1.5.1.8 0V4.5z"/><path d="M12 4.5c1.2-1.3 3.6-1.4 4.8.1 1.3-.1 2.6 1 2.5 2.5 1.3.7 1.7 2.5.7 3.7.9 1.2.6 3-.7 3.7.2 1.6-1 3-2.6 2.9-.6 1.5-2.6 2.1-3.9 1.1"/>',
    'me-settings': '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    'me-system': '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
    'me-links': '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.2-1.2"/>',
    'deck': '<rect x="4" y="4" width="6" height="6" rx="1.6"/><rect x="14" y="4" width="6" height="6" rx="1.6"/><rect x="4" y="14" width="6" height="6" rx="1.6"/><rect x="14" y="14" width="6" height="6" rx="1.6"/>',
    'search': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    'sparkle': '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    'mic': '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    'return': '<path d="M19 6v5a3 3 0 01-3 3H6"/><path d="M9.5 10.5L6 14l3.5 3.5"/>',
    'clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
}


def g(name, cls='g'):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{G[name]}</svg>'


# The four groups (shell/launcher.ts SECTIONS) and what each screen shows right now.
# id: (name, the index's grey line, the instrument's value, its unit, the command deck's count)
S = {
    'core': ('Core', 'Online · free AI open, no daily cap', 'Online', '93 ms uplink', ''),
    'brief': ('Brief', '8°C · partly cloudy in Birmingham', '8°C', 'Partly cloudy', ''),
    'eye': ('God’s eye', '1,204 aircraft · 894 satellites live', '1,204', 'aircraft live', ''),
    'lens': ('Lens', 'Camera · read, name, scan, measure', 'Ready', 'camera', ''),
    'studio': ('3D studio', 'Arc reactor · 16 parts, 8,312 triangles', '16', 'parts · arc reactor', ''),
    'workshop': ('Workshop', 'Self-edit off · widgets, training ground', 'Off', 'self-edit', ''),
    'reverse': ('Reverse', 'Apps, sites and packages', 'Ready', 'nothing open', ''),
    'space': ('Space', 'Plan a room · fit · make space', 'Ready', 'plan a room', ''),
    'learn': ('Learn', 'Courses · quizzes · flashcards', 'Courses', 'quizzes · flashcards', ''),
    'gym': ('Gym', '0 of 22 games mastered', '0/22', 'games mastered', '0/22'),
    'school': ('School', 'Nursery · 2 papers sat', 'Nursery', '2 papers sat', ''),
    'library': ('Library', '8,556 passages · 801 on this phone', '8,556', 'passages', '8,556'),
    'agenda': ('Agenda', 'Next: Dentist, 01:00 · 4 reminders', '01:00', 'Dentist', '4'),
    'markets': ('Markets', 'Risk off · BTC $80,823, −0.52%', 'Risk off', 'BTC −0.52%', ''),
    'threats': ('Threats', 'Elevated · 170 live signals', '170', 'signals · elevated', '170'),
    'radio': ('Radio', 'Off air · 18 stations', 'Off air', '18 stations', ''),
    'memory': ('Memory', '7 things I know about you', '7', 'things about you', '7'),
    'settings': ('Settings', 'Graphite · °C · km', 'Graphite', '°C · km', ''),
    'system': ('System', 'Database 7% used today · keys, models', '7%', 'database today', ''),
    'links': ('Links', 'Email, Spotify and your phone', '3', 'linked', ''),
}
SECTIONS = [
    ('Ask and see', ['core', 'brief', 'eye', 'lens']),
    ('Make', ['studio', 'workshop', 'reverse', 'space']),
    ('Learn and plan', ['learn', 'gym', 'school', 'library', 'agenda', 'markets', 'threats', 'radio']),
    ('Me', ['memory', 'settings', 'system', 'links']),
]
LIVE = 'core'  # the screen you came from: the one cyan glyph

DECK_CSS = '''
.deck .glow { position: absolute; left: -200px; top: -170px; width: 760px; height: 600px; background: radial-gradient(closest-side, rgba(100, 210, 255, 0.10), rgba(100, 210, 255, 0.035) 50%, rgba(100, 210, 255, 0) 100%); pointer-events: none; }
svg.g { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; display: block; flex: none; color: var(--ink); }
.on svg.g, svg.g.on { color: var(--cyan); filter: drop-shadow(0 0 6px rgba(100, 210, 255, 0.45)); }
.dhd { position: absolute; left: 20px; right: 20px; top: 62px; }
.dhd .t-kick { color: var(--ink3); }
.dhd .t-large { margin-top: 5px; }
.dclose { position: absolute; right: 16px; top: 60px; }
.fadebot2 { position: absolute; z-index: 30; left: 0; right: 0; bottom: 0; height: 120px; pointer-events: none; background: linear-gradient(180deg, rgba(5, 6, 7, 0), rgba(5, 6, 7, 0.86) 62%, rgba(5, 6, 7, 0.97)); }
.dot { display: inline-block; width: 6px; height: 6px; border-radius: 3px; background: var(--cyan); box-shadow: 0 0 8px var(--cyan); margin-right: 6px; vertical-align: 1px; }
.amb { color: var(--amber); }
'''


def frame(body, cls='', fade=True):
    return (f'<div class="screen deck {cls}"><div class="glow" data-bleed></div>' + status_bar(TIME) + body
            + ('<div class="fadebot2"></div>' if fade else '') + HOME_INDICATOR + '</div>')


def head(title='At your service, Boss'):
    return (f'<div class="dhd"><div class="t-kick">Every screen</div><div class="t-large">{title}</div></div>'
            f'<span class="gbtn dclose">{icon("close")}</span>')


def styles(extra):
    return f'<style>{FRAME_CSS}{DECK_CSS}{extra}</style>'


# ------------------------------------------------------------------ A. the index
A_CSS = '''
.flow { position: absolute; left: 16px; right: 16px; top: 140px; }
.flow .kick { margin: 22px 16px 8px; color: var(--ink3); }
.flow .kick:first-child { margin-top: 0; }
.icard { border-radius: 20px; background: var(--glass); border: 1px solid var(--hair); box-shadow: var(--glass-shadow); overflow: hidden; }
.irow { position: relative; height: 56px; display: flex; align-items: center; gap: 15px; padding: 0 14px 0 16px; }
.irow + .irow::before { content: ''; position: absolute; left: 53px; right: 0; top: 0; height: 1px; background: var(--hair); }
.irow .tx { flex: 1; min-width: 0; }
.irow .tx b { display: block; font-size: 17px; line-height: 21px; font-weight: 600; letter-spacing: -0.25px; }
.irow .tx span { display: block; font-size: 13px; line-height: 17px; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-feature-settings: 'tnum', 'cv05'; }
.irow svg.chv { width: 15px; height: 15px; color: var(--ink4); stroke-width: 2.4; }
.irow.solo .tx b { line-height: 22px; }
'''


def irow(gl, name, line, on=False, live=False):
    sub = f'<span>{"<i class=dot></i>" if live else ""}{line}</span>' if line else ''
    return (f'<div class="irow{" on" if on else ""}">{g(gl)}<span class="tx"><b>{name}</b>{sub}</span>'
            f'{icon("chev", "i chv")}</div>')


def option_a():
    parts = ['<div class="icard">'
             + irow('search', 'Search', 'Screens, commands and all he has read')
             + irow('settings', 'Settings', S['settings'][1]) + '</div>']
    for name, ids in SECTIONS:
        ids = [i for i in ids if i != 'settings']
        rows = ''.join(irow(i, S[i][0], S[i][1], on=i == LIVE, live=i == LIVE) for i in ids)
        parts.append(f'<div class="t-kick kick">{name}</div><div class="icard">{rows}</div>')
    body = head() + f'<div class="flow">{"".join(parts)}</div>'
    return page('Every screen · A · the index', styles(A_CSS) + frame(body))


# ------------------------------------------------------------------ B. the command deck
B_CSS = '''
.dhd .t-large { font-size: 30px; line-height: 36px; }
.cmd { position: absolute; left: 16px; right: 16px; top: 126px; border-radius: 24px; background: var(--glass); border: 1px solid var(--hair2); box-shadow: var(--glass-shadow), 0 0 0 4px rgba(100, 210, 255, 0.05); overflow: hidden; }
.field { height: 54px; display: flex; align-items: center; gap: 12px; padding: 0 10px 0 18px; border-bottom: 1px solid var(--hair); }
.field svg.g { color: var(--ink2); width: 21px; height: 21px; stroke-width: 1.9; }
.field .typed { flex: 1; font-size: 20px; line-height: 26px; letter-spacing: -0.3px; color: var(--ink); display: flex; align-items: center; }
.field .typed i { width: 2px; height: 24px; border-radius: 1px; background: var(--cyan); margin-left: 1px; box-shadow: 0 0 6px rgba(100, 210, 255, 0.7); }
.field .typed em { font-style: normal; color: var(--ink3); margin-left: 2px; }
.field .mic { width: 40px; height: 40px; border-radius: 20px; display: grid; place-items: center; border: 1px solid var(--hair2); }
.field .mic svg.g { color: var(--ink); width: 20px; height: 20px; }
.hit { height: 50px; display: flex; align-items: center; gap: 14px; padding: 0 14px 0 18px; }
.hit + .hit { border-top: 1px solid var(--hair); }
.hit .tx { flex: 1; min-width: 0; }
.hit .tx b { display: block; font-size: 17px; line-height: 21px; font-weight: 600; letter-spacing: -0.25px; }
.hit .tx b u { text-decoration: none; color: var(--cyan-ink); }
.hit .tx span { display: block; font-size: 13px; line-height: 17px; color: var(--ink2); font-feature-settings: 'tnum', 'cv05'; }
.hit .ret { height: 26px; padding: 0 9px; border-radius: 13px; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--ink2); border: 1px solid var(--hair2); }
.hit .ret svg.g { width: 14px; height: 14px; stroke-width: 2; color: var(--ink2); }
.hit.askrow svg.g { color: var(--ink2); }
.groups { position: absolute; left: 20px; right: 20px; top: 294px; }
.groups .t-kick { color: var(--ink3); margin: 12px 0 8px; display: flex; justify-content: space-between; }
.groups .t-kick:first-child { margin-top: 0; }
.groups .t-kick em { font-style: normal; letter-spacing: 0.02em; text-transform: none; font-weight: 500; }
.pills { display: flex; flex-wrap: wrap; gap: 8px; }
.pill { height: 32px; padding: 0 13px; border-radius: 16px; display: inline-flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 500; letter-spacing: -0.15px; color: var(--ink); background: rgba(255, 255, 255, 0.045); border: 1px solid var(--hair); white-space: nowrap; }
.pill small { font-size: 13px; font-weight: 500; color: var(--ink3); font-feature-settings: 'tnum', 'cv05'; }
.pill svg.g { width: 15px; height: 15px; stroke-width: 1.9; color: var(--ink2); }
.pill.rec { padding: 0 11px 0 10px; gap: 6px; font-size: 14px; background: transparent; }
.pills.one { gap: 6px; flex-wrap: nowrap; }
.pill.match { border-color: rgba(100, 210, 255, 0.45); color: var(--cyan-ink); box-shadow: 0 0 0 3px rgba(100, 210, 255, 0.07); }
.pill.match small { color: var(--cyan-ink); opacity: 0.7; }
.pill.cur { color: var(--ink); }
.pill.cur::before { content: ''; width: 6px; height: 6px; border-radius: 3px; background: var(--cyan); box-shadow: 0 0 8px var(--cyan); margin-left: -3px; }
/* the keyboard (faked: iOS dark, 440 pt wide) */
.kb { position: absolute; z-index: 55; left: 0; right: 0; bottom: 0; height: 302px; background: rgba(38, 39, 42, 0.94); backdrop-filter: blur(30px); border-top: 1px solid rgba(255, 255, 255, 0.06); }
.kb .sug { height: 44px; display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: center; text-align: center; font-size: 16px; color: var(--ink); }
.kb .sug span + span { border-left: 1px solid rgba(255, 255, 255, 0.12); }
.kb .sug .q { color: var(--ink2); }
.kr { position: absolute; left: 3px; right: 3px; height: 44px; display: flex; gap: 6px; justify-content: center; }
.k { width: 37.4px; height: 44px; border-radius: 6px; display: grid; place-items: center; font-size: 23px; font-weight: 400; color: #fff; background: rgba(110, 112, 118, 0.62); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.45); }
.k.f { background: rgba(70, 72, 76, 0.9); font-size: 16px; }
.k svg { width: 22px; height: 22px; fill: none; stroke: #fff; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.kb .bot { position: absolute; left: 0; right: 0; bottom: 0; height: 46px; }
.kb .bot svg { position: absolute; top: 4px; width: 25px; height: 25px; fill: none; stroke: rgba(255, 255, 255, 0.85); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
'''


def keyboard():
    def row(keys, top, pad=0):
        return f'<div class="kr" style="top:{top}px;padding:0 {pad}px">' + ''.join(keys) + '</div>'
    k = lambda c: f'<span class="k">{c}</span>'
    shift = '<span class="k f" style="width:46px"><svg viewBox="0 0 24 24"><path d="M12 4l7.5 8H15v7H9v-7H4.5z"/></svg></span>'
    dele = '<span class="k f" style="width:46px"><svg viewBox="0 0 24 24"><path d="M8.5 6H20a1 1 0 011 1v10a1 1 0 01-1 1H8.5L3 12z"/><path d="M11.5 9.5l5 5M16.5 9.5l-5 5"/></svg></span>'
    r1 = row([k(c) for c in 'qwertyuiop'], 50)
    r2 = row([k(c) for c in 'asdfghjkl'], 106, 20)
    r3 = row([shift, '<span style="width:7px"></span>'] + [k(c) for c in 'zxcvbnm'] + ['<span style="width:7px"></span>', dele], 162)
    r4 = row(['<span class="k f" style="width:92px">123</span>', '<span class="k" style="flex:1;font-size:16px">space</span>',
              '<span class="k f" style="width:92px">go</span>'], 218)
    globe = '<svg viewBox="0 0 24 24" style="left:26px"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5S14.6 18.1 12 20.5M12 3.5C9.4 5.9 8.2 8.7 8.2 12s1.2 6.1 3.8 8.5"/></svg>'
    mic = f'<svg viewBox="0 0 24 24" style="right:26px">{G["mic"]}</svg>'
    return (f'<div class="kb"><div class="sug"><span class="q">“ag”</span><span>Agenda</span><span>again</span></div>'
            f'{r1}{r2}{r3}{r4}<div class="bot">{globe}{mic}</div></div>')


def pill(i, match=False, cur=False):
    n, _, _, _, c = S[i]
    cnt = f'<small>{c}</small>' if c else ''
    return f'<span class="pill{" match" if match else ""}{" cur" if cur else ""}">{n}{cnt}</span>'


def option_b():
    cmd = f'''<div class="cmd">
  <div class="field">{g('search')}<span class="typed">ag<i></i></span><span class="mic">{g('mic')}</span></div>
  <div class="hit on">{g('agenda')}<span class="tx"><b><u>Ag</u>enda</b><span>Next: Dentist, 01:00 · 4 reminders</span></span><span class="ret">{g('return')}go</span></div>
  <div class="hit askrow">{g('sparkle')}<span class="tx"><b>Ask Ghosty “ag…”</b><span>Finish the thought and he answers</span></span></div>
</div>'''
    rec = ''.join(f'<span class="pill rec">{g(i)}{S[i][0]}</span>' for i in ['library', 'school', 'markets', 'gym'])
    groups = f'<div class="t-kick">Recent</div><div class="pills one">{rec}</div>'
    for name, ids in SECTIONS:
        groups += f'<div class="t-kick">{name}</div><div class="pills">' + ''.join(pill(i, i == 'agenda', i == LIVE) for i in ids) + '</div>'
    body = head() + cmd + f'<div class="groups">{groups}</div>' + keyboard()
    return page('Every screen · B · the command deck', styles(B_CSS) + frame(body, fade=False))


# ------------------------------------------------------------------ C. instruments
C_CSS = '''
.inst { position: absolute; left: 20px; right: 20px; top: 146px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.inst .gap { grid-column: 1 / -1; height: 6px; }
.ins { position: relative; aspect-ratio: 16 / 10; padding: 12px 14px 12px; border-radius: 20px; background: var(--glass); border: 1px solid var(--hair); box-shadow: var(--glass-shadow); overflow: hidden; }
.ins .k { font-size: 10px; line-height: 12px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink3); }
.ins .nm { margin-top: 3px; font-size: 15px; line-height: 19px; font-weight: 600; letter-spacing: -0.15px; }
.ins svg.g { position: absolute; right: 13px; top: 12px; width: 19px; height: 19px; stroke-width: 1.6; color: var(--cyan); opacity: 0.9; }
.ins .v { position: absolute; left: 14px; right: 12px; bottom: 28px; font-size: 31px; line-height: 34px; font-weight: 300; letter-spacing: -0.8px; font-feature-settings: 'tnum', 'cv05'; white-space: nowrap; }
.ins .u { position: absolute; left: 14px; right: 12px; bottom: 11px; font-size: 12px; line-height: 15px; color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ins.on { border-color: rgba(100, 210, 255, 0.28); box-shadow: var(--glass-shadow), inset 0 0 0 0.5px rgba(100, 210, 255, 0.2); }
.ins.on .v { color: var(--cyan-ink); }
.ins .tick { position: absolute; left: 14px; right: 14px; bottom: 50px; height: 1px; background: linear-gradient(90deg, var(--hair2), rgba(255,255,255,0)); display: none; }
'''


def option_c():
    cards = ''
    for si, (name, ids) in enumerate(SECTIONS):
        if si:
            cards += '<div class="gap"></div>'
        for i in ids:
            n, _, v, u, _ = S[i]
            if i == 'threats':
                u = 'signals · <span class="amb">elevated</span>'
            if i == 'markets':
                v = '<span class="amb">Risk off</span>'
            live = '<i class="dot"></i>' if i == LIVE else ''
            cards += (f'<div class="ins{" on" if i == LIVE else ""}"><div class="k">{name}</div><div class="nm">{n}</div>'
                      f'{g(i)}<div class="v">{v}</div><div class="u">{live}{u}</div></div>')
    body = head() + f'<div class="inst">{cards}</div>'
    return page('Every screen · C · instruments', styles(C_CSS) + frame(body))


# ------------------------------------------------------------------ the Me sheet (in the index's language)
def P(cx, cy, r, a):
    t = math.radians(a)
    return cx + r * math.cos(t), cy + r * math.sin(t)


def dial(frac):
    """Route C's gauge (mockups/c/build.py dial)."""
    r = 31
    C = 2 * math.pi * r
    sweep = 0.75
    ticks = ''.join(
        f'<line x1="{P(37, 37, 35.5, 135 + 27 * k)[0]:.1f}" y1="{P(37, 37, 35.5, 135 + 27 * k)[1]:.1f}" x2="{P(37, 37, 37, 135 + 27 * k)[0]:.1f}" y2="{P(37, 37, 37, 135 + 27 * k)[1]:.1f}" stroke="#fff" stroke-opacity=".3" stroke-width="1"/>'
        for k in range(11))
    arc = (f'<circle cx="37" cy="37" r="{r}" fill="none" stroke="{CYAN}" stroke-width="4" stroke-linecap="round" stroke-dasharray="{C * sweep * frac:.1f} {C:.1f}" transform="rotate(135 37 37)" style="filter:drop-shadow(0 0 3px {CYAN}88)"/>'
           if frac > 0 else '')
    return (f'<svg width="74" height="74" viewBox="0 0 74 74">{ticks}'
            f'<circle cx="37" cy="37" r="{r}" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="4" stroke-linecap="round" stroke-dasharray="{C * sweep:.1f} {C:.1f}" transform="rotate(135 37 37)"/>'
            f'{arc}</svg>')


ME_CSS = '''
.grp .lrow { gap: 15px; padding: 0 14px 0 18px; }
.grp .lrow + .lrow::before { left: 55px; }
.grp .lrow svg.g { width: 22px; height: 22px; }
.grp .lrow .tx span { color: var(--ink2); }
.sheet { background: #0b0d0f; }
'''


def me():
    def lrow(gl, name, sub):
        return f'<div class="lrow">{g(gl)}<span class="tx"><b>{name}</b><span>{sub}</span></span>{icon("chev", "i chv")}</div>'
    body = f'''
<div class="behind"><img src="../c/home.png" alt=""></div>
<div class="sheet">
  <span class="grab"></span>
  <div class="mehead"><span class="meav">B</span><div class="who2"><div class="t-title">Boss</div><span>Graphite · °C, km</span></div><span class="gbtn">{icon('close')}</span></div>
  <div class="status glass">
    <div class="hd"><span class="t-head">Status</span><span class="ok"><i></i>All good</span></div>
    <div class="gauges">
      <div class="gauge"><div class="dial">{dial(1.0)}<b style="top:26px;font-size:16px">Open</b></div><div class="gl">Free AI today</div><div class="gs">Pollinations ready</div></div>
      <div class="gauge"><div class="dial">{dial(0.07)}<b class="num">7<small>%</small></b><em>USED</em></div><div class="gl">Database today</div><div class="gs num">Resets 00:00</div></div>
      <div class="gauge"><div class="dial">{dial(0)}<b style="top:26px;font-size:16px">No</b></div><div class="gl">Offline brain</div><div class="gs">not on this phone</div></div>
    </div>
    <div class="srow"><span class="k">Ghosty</span><span class="v"><i></i>Connected</span></div>
    <div class="srow"><span class="k">Self-edit</span><span class="v">Off</span></div>
    <div class="srow"><span class="k">This phone</span><span class="v">Paired with your owner key</span></div>
    <div class="srow"><span class="k">Version</span><span class="v">Local build</span></div>
  </div>
  <div class="grp" style="top:470px">
    {lrow('me-memory', 'Memory', '7 things I know about you')}
    {lrow('me-settings', 'Settings', 'Look, voice, home and about')}
    {lrow('me-system', 'System', 'Keys, models, storage and backups')}
  </div>
  <div class="grp" style="top:666px">
    {lrow('me-links', 'Links', 'Email, Spotify and your phone')}
    {lrow('deck', 'Every screen', 'All of Ghosty at once')}
  </div>
  <div class="foot num" style="top:808px">Ghosty local · built now</div>
</div>
'''
    return page('Every screen · Me', f'<style>{FRAME_CSS}{DECK_CSS}{ME_CSS}</style>'
                + f'<div class="screen mescreen">{status_bar(TIME)}{body}{HOME_INDICATOR}</div>')


# ------------------------------------------------------------------ the contact sheet
def contact_sheet():
    shots = [('a', 'A', 'The index', 'One page, rows with what is there now'),
             ('b', 'B', 'The command deck', 'Type to go; every screen as words'),
             ('c', 'C', 'Instruments', 'A cockpit: one live value each'),
             ('me', 'Me', 'The Me sheet', 'Same glyphs, no tiles')]
    cells = ''.join(f'<figure><div class="ph"><img src="{n}.png" alt="{t}"></div><figcaption><b>{k}</b>{t}<span>{s}</span></figcaption></figure>'
                    for n, k, t, s in shots)
    css = '''
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0a0b0d; color: #f4f6f8; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; width: 1064px; padding: 48px 56px 56px; }
header { margin-bottom: 34px; }
h1 { font-size: 32px; line-height: 38px; font-weight: 700; letter-spacing: -0.6px; }
header p { margin-top: 6px; font-size: 16px; line-height: 22px; color: rgba(235, 240, 245, 0.6); }
.grid { display: grid; grid-template-columns: 440px 440px; gap: 48px 72px; }
.ph { width: 440px; height: 956px; border-radius: 56px; overflow: hidden; box-shadow: 0 0 0 1.5px rgba(255,255,255,.10), 0 0 0 8px #16181b, 0 0 0 9px rgba(255,255,255,.14), 0 30px 60px rgba(0,0,0,.5); }
.ph img { width: 440px; height: 956px; display: block; }
figcaption { margin-top: 24px; font-size: 19px; line-height: 24px; font-weight: 600; letter-spacing: -0.2px; text-align: center; }
figcaption b { display: inline-grid; place-items: center; min-width: 28px; height: 28px; padding: 0 7px; border-radius: 14px; margin-right: 10px; font-size: 13px; border: 1px solid rgba(255,255,255,.22); vertical-align: 1px; }
figcaption span { display: block; margin-top: 4px; font-size: 15px; font-weight: 400; color: rgba(235, 240, 245, 0.55); }
'''
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="mock-scale" content="1.5"><title>Every screen · contact sheet</title>
<link rel="stylesheet" href="../fonts.css"><style>{css}</style></head>
<body><header><h1>Every screen, without app icons</h1><p>Route C · thin line glyphs, no tinted squares · iPhone 18 Pro Max, 440 × 956</p></header>
<div class="grid">{cells}</div></body></html>
'''


if __name__ == '__main__':
    for name, fn in [('a', option_a), ('b', option_b), ('c', option_c), ('me', me), ('contact', contact_sheet)]:
        write(HERE, f'{name}.html', fn())
    print('deck pages written')
