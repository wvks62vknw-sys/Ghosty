"""Round 3 of the Every screen deck (BRIEF-DECK-MOCKUPS-3.md): a deck that makes you want to tap.
F the showcase (and f-scrolled), G superpowers (and g-scrolled), H tap to find out, and contact3.
Run from the worktree root:  python3 -I docs/build-plan/mockups/deck/build3.py
then:                        node docs/build-plan/mockups/deck/render.mjs f f-scrolled g g-scrolled h contact3
Every capability named here is one the app has (MAP.md, features/*/index.ts); the miniatures in shots/ are the
real route C screens (design-build-2 and hero-build screenshots, scaled down)."""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
from common import FRAME_CSS, HOME_INDICATOR, icon, page, status_bar, write  # noqa: E402
from build import DECK_CSS, g  # noqa: E402
from build2 import ROUND2_CSS, TIME, gopill  # noqa: E402

# id: (name, promise, [you can...], reading or '', did you know or '')
S = {
    'core': ('Core', 'Talk to him, out loud or typed, and he gets it done',
             ['Ask for sources and every claim gets its link', 'Paste a YouTube link: a summary with timestamps', 'Say “build me a website for my café”'],
             'Online · 93 ms', 'Home’s Mind is a 3-D hologram of everything he has read: one point for every 20 passages, lit as he studies.'),
    'brief': ('Brief', 'Your day in one look, or read out loud',
              ['Rain hour by hour for Birmingham', 'Headlines by section: world, tech, science', 'Say “brief me” and he reads it to you'],
              '8°C · partly cloudy', ''),
    'eye': ('God’s eye', 'The planet live: every plane, ship and satellite',
            ['Watch 5,000 public traffic cameras, the M5 included', 'Tap any spot for Street View, 3-D and traffic', 'Plan a bus or train journey from here'],
            '1,204 aircraft · 894 satellites', ''),
    'lens': ('Lens', 'Point the camera at anything and he tells you what it is',
             ['Translate a sign or a menu through the camera', 'Measure a wall or a sofa from one photo', 'Read a number plate and see its MOT history'],
             '', 'Naming runs on the phone itself: 4,624 everyday names (32,800 with More names), and Aim labels the planes, ships and the ISS you point at.'),
    'studio': ('3D studio', 'Turn a photo into a 3-D model, then take it apart',
               ['Explode the arc reactor into its 16 parts', 'Find a real model: “oak dining chair”', 'Walk through your own room plan in 3-D'],
               '', ''),
    'workshop': ('Workshop', 'Tell him what to build and he changes his own code',
                 ['See a preview, then ship it or bin it', 'Roll back to any earlier version', 'Open the widgets and mini-games he made'],
                 'Self-edit off', 'Every morning he proposes upgrades for himself; one tap on Build starts one.'),
    'reverse': ('Reverse', 'Paste a link and find out how any app or site works',
                ['A website, an npm package or a GitHub project', 'Even an .apk or an .exe: the report in minutes', 'Runs on GitHub’s free computers'],
                '', ''),
    'space': ('Space', 'Plan a room to scale: will the sofa fit before you buy it?',
              ['Draw the room from a photo of a floor plan', 'Make space: he tries six ways to rearrange it', 'Check it against UK building regulations'],
              '', ''),
    'learn': ('Learn', 'Say “teach me…” and he builds you a course',
              ['Lessons with sources, read aloud', 'Quizzes that mark themselves', 'Flashcards that return just before you forget'],
              '', ''),
    'gym': ('Gym', 'Watch Ghosty teach himself by playing 22 games',
            ['Mazes, sudoku, chess, Go and more', 'Train all and watch the levels climb', 'Mastery checked against the right answer'],
            '0 of 22 mastered', ''),
    'school': ('School', 'He sits real SATs, GCSE and A‑level papers',
               ['From nursery to university, strictly in order', 'Every answer marked, with the marker’s note', 'A report on how he did, every night'],
               'Nursery · 2 papers sat', 'Every week his offline brain trains on Kaggle’s free GPUs, and School is where he proves it worked.'),
    'library': ('Library', 'Everything he has read, found in a second, even offline',
                ['Add books and PDFs and he reads them', 'Ask the library: answers with no AI used', 'Fresh every morning: BBC, Hacker News, arXiv'],
                '8,556 passages · 801 offline', ''),
    'agenda': ('Agenda', 'Your diary, your reminders and the jobs he runs for you',
               ['Say “remind me at 6 to call Mum”', 'Connect your calendars', 'See what he has scheduled overnight'],
               'Dentist 01:00 · in 54 min', ''),
    'markets': ('Markets', 'Crypto, indices and currencies, live, in plain words',
                ['Bitcoin and friends with their 24-hour charts', 'Prices in £, $ or €', 'Ask “why is bitcoin down today?”'],
                'Risk off · BTC −0.52%', ''),
    'threats': ('Threats', 'Quakes, storms, space weather and launches, worst first',
                ['See what is near you right now', 'Recon: check a website’s weak spots', 'Tap a quake to fly there on the globe'],
                'Elevated · 170 live signals', ''),
    'radio': ('Radio', 'Any station on Earth: say “play some jazz”',
              ['Search by name, genre or country', 'talkSPORT, Times Radio, BBC News…', 'Keep your favourites one tap away'],
              'Off air · 18 stations', ''),
    'memory': ('Memory', 'Everything he knows about you, and where he learned it',
               ['Edit, lock or forget any memory, with undo', 'Patterns he noticed in your days', 'Read the diary he writes every night'],
               '7 things · 5 patterns', 'Every night he reflects on the day’s chats and writes a diary entry. Passwords and card numbers are never kept.'),
    'settings': ('Settings', 'Make him yours: his look, his voice, his manner',
                 ['Three dials: how dry, how brief, how warm', 'Choose whose voice he speaks in', 'Download the offline brain'],
                 'Graphite · °C · km', ''),
    'system': ('System', 'Under the bonnet: models, keys and backups',
               ['See which free AI models are answering', 'Back up this phone every day', 'The offline brain’s report card'],
               'Database 7% today', ''),
    'links': ('Links', 'Connect him to your email, Spotify, Telegram and phone',
              ['Message him on Telegram, voice notes too', 'Notifications on this phone', 'Live traffic from TomTom'],
              '', ''),
}
SECTIONS = [
    ('Ask and see', ['core', 'brief', 'eye', 'lens']),
    ('Make', ['studio', 'workshop', 'reverse', 'space']),
    ('Learn and plan', ['learn', 'gym', 'school', 'library', 'agenda', 'markets', 'threats', 'radio']),
    ('Me', ['memory', 'settings', 'system', 'links']),
]
CUR = 'core'     # where you came from
DUE = 'agenda'   # due within the hour

R3_CSS = '''
.sub3 { position: absolute; left: 20px; right: 20px; top: 124px; font-size: 15px; line-height: 20px; color: var(--ink2); letter-spacing: -0.12px; }
.flow3 { position: absolute; left: 16px; right: 16px; }
.flow3 > .t-kick { margin: 22px 4px 10px; color: var(--ink3); display: flex; justify-content: space-between; }
.flow3 > .t-kick em { font-style: normal; text-transform: none; letter-spacing: 0.01em; font-weight: 500; }
.flow3 > .t-kick:first-child { margin-top: 0; }
.mini { flex: none; width: 96px; height: 208px; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.16); box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.35), 0 10px 24px rgba(0, 0, 0, 0.5); background: #000; position: relative; }
.mini img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: top; }
.mini::after { content: ''; position: absolute; inset: 0; border-radius: 14px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12); background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,0) 40%); }
.nmrow { display: flex; align-items: center; gap: 7px; }
.nmrow svg.g { width: 17px; height: 17px; stroke-width: 1.8; }
.nmrow b { font-size: 13px; line-height: 16px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink2); }
.promise { font-size: 17px; line-height: 22px; font-weight: 600; letter-spacing: -0.3px; color: var(--ink); }
.cans { list-style: none; }
.cans li { position: relative; padding-left: 13px; font-size: 13px; line-height: 17.5px; color: var(--ink2); letter-spacing: -0.04px; }
.cans li::before { content: ''; position: absolute; left: 1px; top: 7.5px; width: 4px; height: 4px; border-radius: 2px; background: var(--ink4); }
.cans .lead { padding-left: 0; color: var(--ink3); font-size: 11px; line-height: 14px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; margin-bottom: 3px; }
.cans .lead::before { display: none; }
.live { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; line-height: 15px; color: var(--ink3); font-feature-settings: 'tnum', 'cv05'; white-space: nowrap; }
.live i { width: 5px; height: 5px; border-radius: 3px; background: var(--ink3); }
.live.cy { color: var(--cyan-ink); }
.live.cy i { background: var(--cyan); box-shadow: 0 0 6px var(--cyan); }
.glass3 { border-radius: 22px; background: var(--glass); border: 1px solid var(--hair); box-shadow: var(--glass-shadow); }
.navbar { position: absolute; z-index: 46; left: 0; right: 0; top: 0; height: 128px; background: linear-gradient(180deg, rgba(5,6,7,1) 0, rgba(5,6,7,.98) 74%, rgba(5,6,7,0)); }
.navbar .ttl { position: absolute; left: 0; right: 0; top: 66px; text-align: center; font-size: 17px; line-height: 22px; font-weight: 600; letter-spacing: -0.25px; }
.navbar .gbtn { position: absolute; right: 16px; top: 57px; }
.try { display: flex; gap: 10px; overflow: hidden; margin-right: -16px; }
.tcard { flex: none; width: 232px; padding: 13px 14px 12px; border-radius: 20px; background: linear-gradient(160deg, rgba(100, 210, 255, 0.07), rgba(255, 255, 255, 0.03) 60%); border: 1px solid rgba(255, 255, 255, 0.10); box-shadow: var(--glass-shadow); }
.tcard .tk { display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink3); }
.tcard .tk svg.g { width: 14px; height: 14px; stroke-width: 2; }
.tcard p { margin-top: 7px; font-size: 15px; line-height: 20px; font-weight: 600; letter-spacing: -0.2px; }
.tcard .go { margin-top: 9px; font-size: 13px; line-height: 16px; font-weight: 600; color: var(--cyan-ink); }
'''


def head3(sub):
    return (f'<div class="dhd"><div class="t-kick">Every screen</div><div class="t-large">At your service, Boss</div></div>'
            f'<span class="gbtn dclose">{icon("close")}</span><div class="sub3">{sub}</div>')


def css3(extra):
    return f'<style>{FRAME_CSS}{DECK_CSS}{ROUND2_CSS}{R3_CSS}{extra}</style>'


def screen3(body, fade=True):
    return (f'<div class="screen deck"><div class="glow" data-bleed></div>' + status_bar(TIME) + body
            + ('<div class="fadebot2"></div>' if fade else '') + gopill() + HOME_INDICATOR + '</div>')


def live(i, small=False):
    r = S[i][3]
    if not r:
        return ''
    cy = i in (CUR, DUE)
    return f'<span class="live{" cy" if cy else ""}"><i></i>{r}</span>'


def mini(i):
    return f'<span class="mini"><img src="shots/{i}.jpg" alt=""></span>'


def navbar(title='Every screen'):
    return f'<div class="navbar"><div class="ttl">{title}</div><span class="gbtn">{icon("close")}</span></div>'


# ------------------------------------------------------------------ F. the showcase
F_CSS = '''
.fcard { display: flex; gap: 16px; padding: 14px 16px 14px 14px; margin-bottom: 12px; }
.fcard .rt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.fcard .promise { margin-top: 7px; }
.fcard .cans { margin-top: 10px; }
.fcard .cans li + li { margin-top: 4px; }
.fcard .ft { margin-top: auto; padding-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.fcard .ft .live { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.fcard .ft .op { font-size: 13px; font-weight: 600; color: var(--ink); display: inline-flex; align-items: center; gap: 2px; }
.fcard .ft .op svg.i { width: 14px; height: 14px; stroke-width: 2.4; color: var(--ink3); }
.fcard.cur .nmrow svg.g { color: var(--cyan); }
.fcard.due .nmrow svg.g { color: var(--cyan); }
'''


def fcard(i):
    n, pr, cans, _, _ = S[i]
    cls = ' cur' if i == CUR else ' due' if i == DUE else ''
    lis = '<li class="lead">You can</li>' + ''.join(f'<li>{c}</li>' for c in cans)
    return (f'<div class="fcard glass3{cls}">{mini(i)}<div class="rt"><div class="nmrow">{g(i)}<b>{n}</b></div>'
            f'<div class="promise">{pr}</div><ul class="cans">{lis}</ul>'
            f'<div class="ft">{live(i) or "<span></span>"}<span class="op">Open{icon("chev")}</span></div></div></div>')


def f_body():
    parts = []
    for name, ids in SECTIONS:
        parts.append(f'<div class="t-kick">{name}<em>{len(ids)} screens</em></div>' + ''.join(fcard(i) for i in ids))
    return ''.join(parts)


def f(scrolled=False):
    if not scrolled:
        body = head3('Twenty screens, and what each one does for you.') + f'<div class="flow3" style="top:164px">{f_body()}</div>'
        return page('Every screen · F · the showcase', css3(F_CSS) + screen3(body))
    body = f'<div class="flow3" style="top:-2240px">{f_body()}</div>' + navbar()
    return page('Every screen · F · the showcase, further down', css3(F_CSS) + screen3(body))


# ------------------------------------------------------------------ G. superpowers
G_CSS = '''
.sp { overflow: hidden; }
.sprow { position: relative; min-height: 54px; display: flex; align-items: center; gap: 14px; padding: 8px 14px 8px 16px; }
.sprow + .sprow::before { content: ''; position: absolute; left: 52px; right: 0; top: 0; height: 1px; background: var(--hair); }
.sprow svg.g { width: 20px; height: 20px; }
.sprow .tx { flex: 1; min-width: 0; }
.sprow .tx b { display: block; font-size: 16px; line-height: 21px; font-weight: 600; letter-spacing: -0.22px; }
.sprow .tx span { display: block; font-size: 13px; line-height: 17px; color: var(--ink3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-feature-settings: 'tnum', 'cv05'; }
.sprow .tx span em { font-style: normal; color: var(--ink2); }
.sprow svg.chv { width: 14px; height: 14px; color: var(--ink4); stroke-width: 2.4; }
.sprow.cy svg.g { color: var(--cyan); }
.flow3 > .t-kick b { color: var(--ink2); font-weight: 600; }
'''

# group: [(glyph, capability, screen, example)]
POWERS = [
    ('See', [
        ('lens', 'Name anything you point the camera at', 'Lens', '4,624 everyday names, on the phone'),
        ('lens', 'Translate a sign or a menu', 'Lens', 'Scan, then Translate'),
        ('lens', 'Measure a wall or a sofa from one photo', 'Lens', 'Measure: no tape needed'),
        ('lens', 'Check a car’s MOT from its number plate', 'Lens', 'Read a UK plate'),
        ('lens', 'Label the planes and ships you point at', 'Lens', 'Aim: the ISS too'),
        ('eye', 'Every plane, ship and satellite, live', 'God’s eye', '1,204 aircraft right now'),
        ('eye', 'Watch 5,000 public traffic cameras', 'God’s eye', 'the M5 and the West Midlands too'),
        ('eye', 'Street View, 3-D and traffic for any spot', 'God’s eye', 'tap anywhere on the globe'),
    ]),
    ('Ask', [
        ('core', 'Ask anything, out loud or typed', 'Core', 'he answers like a person, not a bot'),
        ('core', 'Answers with every source checked', 'Core', 'turn on Cited'),
        ('core', 'Summarise a YouTube video', 'Core', 'paste the link: timestamps and quiz cards'),
        ('lens', 'Ask about a photo: “what’s in this?”', 'Lens', 'Ask, with the picture'),
        ('library', 'Search all he has read in a second', 'Library', 'no AI used, works offline'),
        ('brief', 'Hear your day read out loud', 'Brief', 'say “brief me”'),
        ('settings', 'Answers with no signal at all', 'Settings', 'the offline brain on this phone'),
    ]),
    ('Make', [
        ('core', 'Build a website from one sentence', 'Core', 'he builds it and publishes it'),
        ('workshop', 'Tell him how to change himself', 'Workshop', 'preview, then ship or roll back'),
        ('workshop', 'Make a mini-game or a widget', 'Workshop', 'opens instantly'),
        ('studio', 'Turn a photo into a 3-D model', '3D studio', 'Make · photo'),
        ('studio', 'Take any model apart', ' 3D studio', 'the arc reactor has 16 parts'),
        ('reverse', 'Find out how an app or site works', 'Reverse', 'even an .apk or an .exe'),
        ('space', 'Plan a room: will the sofa fit?', 'Space', 'Will it fit? and Make space'),
        ('space', 'Check a plan against building regs', 'Space', 'Design review'),
    ]),
    ('Learn', [
        ('learn', 'Learn anything: “teach me photosynthesis”', 'Learn', 'a course of 5–12 lessons'),
        ('learn', 'Quizzes that mark themselves', 'Learn', 'and flashcards timed to your memory'),
        ('library', 'Give him books and PDFs to read', 'Library', '8,556 passages so far'),
        ('gym', 'Watch him teach himself 22 games', 'Gym', '0 of 22 mastered'),
        ('school', 'Send him to school, nursery to A‑level', 'School', 'real SATs and GCSE papers, marked'),
    ]),
    ('Plan', [
        ('agenda', '“Remind me at 6 to call Mum”', 'Agenda', 'next: Dentist at 01:00, in 54 min'),
        ('agenda', 'Connect your calendars', 'Agenda', 'one diary for everything'),
        ('eye', 'Plan a bus or train journey', 'God’s eye', 'Go: leave now, or arrive by'),
        ('workshop', 'Hand him a project that runs for days', 'Workshop', 'Projects: pause, resume, cancel'),
        ('markets', 'Crypto, indices and currencies', 'Markets', 'risk off · BTC −0.52%'),
        ('radio', '“Play some jazz”', 'Radio', 'any station, by name, genre or country'),
    ]),
    ('Keep safe', [
        ('threats', 'Quakes, storms and space weather', 'Threats', 'elevated · 170 live signals'),
        ('threats', 'Check a website’s weak spots', 'Threats', 'Recon'),
        ('lens', 'Spot a fake link in a QR code', 'Lens', 'Scan warns about lookalike sites'),
        ('system', 'Back up this phone every day', 'System', 'and restore in one tap'),
        ('links', 'Keys locked in an encrypted vault', 'Links', 'never shown again'),
    ]),
    ('Me', [
        ('memory', 'See everything he knows about you', 'Memory', '7 things, each with its source'),
        ('memory', 'Forget or lock any memory', 'Memory', 'with undo'),
        ('memory', 'Read the diary he writes each night', 'Memory', 'Diary'),
        ('settings', 'Make him drier, briefer or warmer', 'Settings', 'Character'),
        ('settings', 'Choose his voice', 'Settings', 'Voice'),
        ('links', 'Talk to him on Telegram', 'Links', 'text, voice notes and photos'),
    ]),
]

TRY = [
    ('lens', 'Lens', 'Point the Lens at tonight’s dinner and ask what’s in it', 'Open Lens'),
    ('core', 'Core', 'Paste a YouTube link: the gist, with timestamps', 'Ask Ghosty'),
    ('learn', 'Learn', 'Say “teach me how the stock market works”', 'Start a course'),
]


def try_strip():
    return '<div class="t-kick">Try this now<em>3 picks for today</em></div><div class="try">' + ''.join(
        f'<div class="tcard"><div class="tk">{g(i)}{n}</div><p>{t}</p><div class="go">{go} ›</div></div>' for i, n, t, go in TRY) + '</div>'


def g_body():
    parts = [try_strip()]
    total = sum(len(x) for _, x in POWERS)
    for name, rows in POWERS:
        rr = ''.join(f'<div class="sprow{" cy" if (i == DUE and k == 0 and name == "Plan") else ""}">{g(i)}<span class="tx"><b>{c}</b><span><em>{s.strip()}</em> · {ex}</span></span>{icon("chev", "i chv")}</div>'
                     for k, (i, c, s, ex) in enumerate(rows))
        parts.append(f'<div class="t-kick">{name}<em>{len(rows)}</em></div><div class="sp glass3">{rr}</div>')
    return ''.join(parts), total


def gpage(scrolled=False):
    body, total = g_body()
    if not scrolled:
        b = head3(f'What do you want to do? {total} things Ghosty can do.') + f'<div class="flow3" style="top:166px">{body}</div>'
        return page('Every screen · G · superpowers', css3(G_CSS) + screen3(b))
    b = f'<div class="flow3" style="top:-1290px">{body}</div>' + navbar('What do you want to do?')
    return page('Every screen · G · superpowers, further down', css3(G_CSS) + screen3(b))


# ------------------------------------------------------------------ H. tap to find out
H_CSS = '''
.hgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.hc { position: relative; min-height: 104px; padding: 12px 13px 11px; display: flex; flex-direction: column; }
.hc .hd { display: flex; align-items: center; gap: 8px; }
.hc .hd svg.g { width: 19px; height: 19px; }
.hc .hd b { font-size: 15px; line-height: 19px; font-weight: 600; letter-spacing: -0.15px; }
.hc p { margin-top: 6px; font-size: 13px; line-height: 17px; color: var(--ink2); letter-spacing: -0.04px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.hc .live { margin-top: auto; padding-top: 7px; font-size: 11px; }
.hc .more { position: absolute; right: 11px; top: 12px; width: 18px; height: 18px; color: var(--ink4); }
.hc.cur .hd svg.g, .hc.due .hd svg.g { color: var(--cyan); }
.hc.sel { border-color: rgba(255, 255, 255, 0.24); background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.05)); }
.hc.sel::after { content: ''; position: absolute; left: 50%; bottom: -11px; width: 14px; height: 14px; margin-left: -7px; transform: rotate(45deg); background: #15181b; border-left: 1px solid rgba(255,255,255,.14); border-top: 1px solid rgba(255,255,255,.14); z-index: 2; }
.hx { grid-column: 1 / -1; padding: 16px 16px 16px 16px; display: flex; gap: 16px; background: linear-gradient(180deg, rgba(255,255,255,.085), rgba(255,255,255,.045)); border-color: rgba(255,255,255,.14); }
.hx .mini { width: 100px; height: 217px; }
.hx { padding: 14px; gap: 14px; }
.hx .promise { font-size: 17px !important; line-height: 22px !important; }
.hx .cans li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hx .dyk { margin-top: 10px; }
.hx .acts { padding-top: 10px; }
.hx .rt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.hx .promise { font-size: 18px; line-height: 23px; margin-top: 6px; }
.hx .cans { margin-top: 10px; }
.hx .cans li + li { margin-top: 4px; }
.dyk { margin-top: 12px; padding: 9px 11px; border-radius: 12px; border: 1px solid var(--hair); background: rgba(0,0,0,.18); }
.dyk b { display: block; font-size: 10px; line-height: 12px; font-weight: 700; letter-spacing: 0.1em; color: var(--ink3); }
.dyk span { display: block; margin-top: 3px; font-size: 12.5px; line-height: 16.5px; color: var(--ink2); }
.hx .acts { margin-top: auto; padding-top: 12px; display: flex; gap: 8px; }
.hx .open { flex: 1; height: 40px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600; letter-spacing: -0.15px; color: #03141b; background: linear-gradient(180deg, #92e1ff, #52c5f6); box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 8px 22px rgba(100,210,255,.22); }
.hx .less { width: 40px; height: 40px; border-radius: 20px; display: grid; place-items: center; border: 1px solid var(--hair2); color: var(--ink2); }
.hx .less svg.i { width: 18px; height: 18px; stroke-width: 2.2; transform: rotate(180deg); }
.try .tcard { width: 214px; padding: 11px 13px 11px; }
.try .tcard p { margin-top: 5px; font-size: 14px; line-height: 18px; }
.try .tcard .go { display: none; }
'''


def hc(i, sel=False):
    n, pr, _, _, _ = S[i]
    cls = ' cur' if i == CUR else ' due' if i == DUE else ''
    return (f'<div class="hc glass3{cls}{" sel" if sel else ""}"><div class="hd">{g(i)}<b>{n}</b></div>'
            f'{icon("chevdown", "i more")}<p>{pr}</p>{live(i)}</div>')


H_CANS = {'lens': ['Translate a sign or a menu', 'Measure a wall from one photo', 'Read a plate: its MOT history']}
H_DYK = {'lens': 'He names things on the phone itself, from 4,624 everyday names.'}


def hx(i):
    n, pr, cans, _, dyk = S[i]
    cans = H_CANS.get(i, cans)
    dyk = H_DYK.get(i, dyk)
    lis = '<li class="lead">You can</li>' + ''.join(f'<li>{c}</li>' for c in cans)
    return (f'<div class="hx glass3">{mini(i)}<div class="rt"><div class="nmrow">{g(i)}<b>{n}</b></div><div class="promise">{pr}</div>'
            f'<ul class="cans">{lis}</ul><div class="dyk"><b>DID YOU KNOW</b><span>{dyk}</span></div>'
            f'<div class="acts"><span class="open">Open Lens</span><span class="less">{icon("chevdown")}</span></div></div></div>')


def h_page():
    parts = [try_strip()]
    for name, ids in SECTIONS:
        cells = ''
        for k, i in enumerate(ids):
            cells += hc(i, sel=i == 'lens')
            if i == 'lens':
                cells += hx('lens')
        parts.append(f'<div class="t-kick">{name}</div><div class="hgrid">{cells}</div>')
    b = head3('Tap any screen to find out what it can do.') + f'<div class="flow3" style="top:164px">{"".join(parts)}</div>'
    return page('Every screen · H · tap to find out', css3(H_CSS) + screen3(b))


# ------------------------------------------------------------------ contact sheet 3
def contact3():
    shots = [('f', 'F', 'The showcase', 'A feature page per screen'), ('f-scrolled', 'F', 'Further down', 'Learn and plan'),
             ('g', 'G', 'Superpowers', 'By what you want to do'), ('g-scrolled', 'G', 'Further down', 'Make, Learn, Plan'),
             ('h', 'H', 'Tap to find out', 'Lens opened in place'), ('c2', 'C2', 'Round 2: the bridge', 'For comparison')]
    cells = ''.join(f'<figure><div class="ph"><img src="{n}.png" alt="{t}"></div><figcaption><b>{k}</b>{t}<span>{s}</span></figcaption></figure>'
                    for n, k, t, s in shots)
    css = '''
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0a0b0d; color: #f4f6f8; font-family: 'Inter Mock', sans-serif; -webkit-font-smoothing: antialiased; width: 3112px; padding: 48px 56px 56px; }
header { margin-bottom: 34px; }
h1 { font-size: 32px; line-height: 38px; font-weight: 700; letter-spacing: -0.6px; }
header p { margin-top: 6px; font-size: 16px; line-height: 22px; color: rgba(235, 240, 245, 0.6); }
.row { display: flex; gap: 56px; }
.ph { width: 440px; height: 956px; border-radius: 56px; overflow: hidden; box-shadow: 0 0 0 1.5px rgba(255,255,255,.10), 0 0 0 8px #16181b, 0 0 0 9px rgba(255,255,255,.14), 0 30px 60px rgba(0,0,0,.5); }
.ph img { width: 440px; height: 956px; display: block; }
figcaption { margin-top: 24px; font-size: 19px; line-height: 24px; font-weight: 600; letter-spacing: -0.2px; text-align: center; }
figcaption b { display: inline-grid; place-items: center; min-width: 28px; height: 28px; padding: 0 7px; border-radius: 14px; margin-right: 10px; font-size: 13px; border: 1px solid rgba(255,255,255,.22); vertical-align: 1px; }
figcaption span { display: block; margin-top: 4px; font-size: 15px; font-weight: 400; color: rgba(235, 240, 245, 0.55); }
'''
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="mock-scale" content="1"><title>Every screen · round 3</title>
<link rel="stylesheet" href="../fonts.css"><style>{css}</style></head>
<body><header><h1>Every screen, round 3: a deck that makes you want to tap</h1><p>Purpose first: a promise per screen, what you can do there, and the real screen shown · iPhone 18 Pro Max, 440 × 956 · round 2’s bridge on the right for comparison</p></header>
<div class="row">{cells}</div></body></html>
'''


if __name__ == '__main__':
    for name, html in [('f', f()), ('f-scrolled', f(True)), ('g', gpage()), ('g-scrolled', gpage(True)), ('h', h_page()), ('contact3', contact3())]:
        write(HERE, f'{name}.html', html)
    print('round 3 pages written')
