"""The words and numbers on every mock screen, in one place so the three directions show the same things and only the
design differs. Nothing here is a placeholder: the hub cards' names, titles and readouts are the ones in
apps/web/src/shell/hubcards.ts (CARDS) with the values that card would read on a real evening; the area lines are
shell/areadefs.ts; the book is a real one (public domain, so its words may be set in full); the journey is a real station.
The day is Friday 6 November 2026, Birmingham. Ghosty says "I"."""

NAME = 'Boss'
DAY_LONG = 'Friday 6 November'
DAY_SHORT = 'Fri 6 Nov'
EVENING = '21:08'
MORNING = '07:12'

# --------------------------------------------------------------------------------------------------------- Home
HOME = dict(
    greeting=f'Good evening, {NAME}.',
    line='Nothing needs you tonight. Shall we read?',
    weather='9° and clear in Birmingham',
    free_left=0.72,  # "Free AI 72 % left today", the ring on the orb
    hint='Press me to ask, or to find anything.',
    stats=dict(passages='4,186', studied='1,312'),
)

# The areas, as shell/areadefs.ts has them (Ask is Mind itself; Me is the avatar), with their own one-line promise.
AREAS = [
    dict(id='see', name='See', glyph='see', sub='The world live, and the camera that understands it.'),
    dict(id='make', name='Make', glyph='make', sub='Build, take apart and plan real things.'),
    dict(id='learn', name='Learn', glyph='learn', sub='Courses and free games for you; the gym, school and a library for me.'),
    dict(id='plan', name='Plan', glyph='plan', sub='Your days, the markets, the world’s alerts and the radio.'),
    dict(id='life', name='Life', glyph='life', sub='Money, body, kitchen, people, work, creative, outside and home.'),
    dict(id='me', name='Me', glyph='me', sub='What I know, how I look and what I am linked to.'),
]

# Recents (newest first) and favourites (he starred them): the two taps. A screen can be both; Home shows each once.
RECENTS = [
    dict(id='library', name='Library', glyph='library'),
    dict(id='eye', name='God’s eye', glyph='godseye'),
    dict(id='brief', name='Brief', glyph='briefing'),
]
FAVOURITES = [
    dict(id='lens', name='Lens', glyph='lens'),
    dict(id='agenda', name='Agenda', glyph='agenda'),
    dict(id='gym', name='Gym', glyph='gym'),
    dict(id='learn', name='Courses', glyph='courses'),
]

# --------------------------------------------------------------------------------------------------------- the book
BOOK = dict(
    id='alice', title='Alice’s Adventures in Wonderland', author='Lewis Carroll', page=42, of=112,
    when='you were here yesterday', pct=42 / 112, chapter='Chapter V', chapter_title='Advice from a Caterpillar',
)
READER_LINE = f'{BOOK["title"]} · page {BOOK["page"]} of {BOOK["of"]} · {BOOK["when"]}'

# The text on page 42 (Lewis Carroll, 1865: public domain). Each item is one passage as the library keeps it; the one at
# `lit` is the passage being read aloud. A page mark sits where the source's page turns.
READER_TEXT = [
    ('p', 'The Caterpillar and Alice looked at each other for some time in silence: at last the Caterpillar took the hookah out of its mouth, and addressed her in a languid, sleepy voice.'),
    ('p', '“Who are you?” said the Caterpillar.'),
    ('p', 'This was not an encouraging opening for a conversation. Alice replied, rather shyly, “I—I hardly know, sir, just at present—at least I know who I was when I got up this morning, but I think I must have been changed several times since then.”'),
    ('p', '“What do you mean by that?” said the Caterpillar sternly. “Explain yourself!”'),
    ('mark', '43'),
    ('p', '“I can’t explain myself, I’m afraid, sir,” said Alice, “because I’m not myself, you see.”'),
    ('p', '“I don’t see,” said the Caterpillar.'),
    ('p', '“I’m afraid I can’t put it more clearly,” Alice replied very politely, “for I can’t understand it myself to begin with; and being so many different sizes in a day is very confusing.”'),
]
READER_LIT = 2  # index into READER_TEXT
READER_PILLS = ['Read', 'Chapters', 'Search', 'About']

# The Shelf: a cover, the author and the progress on every row; sorted by recent; a finished book marked.
SHELF = [
    dict(id='alice', title='Alice’s Adventures in Wonderland', author='Lewis Carroll', progress='Page 42 of 112', when='yesterday', pct=42 / 112),
    dict(id='hobbit', title='The Hobbit', author='J. R. R. Tolkien', progress='Page 187 of 310', when='Sunday', pct=187 / 310),
    dict(id='island', title='Treasure Island', author='Robert Louis Stevenson', progress='Finished', when='18 October', pct=1.0),
    dict(id='willows', title='The Wind in the Willows', author='Kenneth Grahame', progress='Not started', when='added 2 November', pct=0.0),
]

# --------------------------------------------------------------------------------------------------------- the Stage
STAGE = dict(
    time=MORNING,
    kicker='Journey',
    title='The 7:42 from New Street',
    sentence='That’s the 7:42 from New Street. Platform 3 — I’ll say when to leave.',
    readings=[('Leave by', '07:24'), ('Walk', '14 min'), ('Platform', '3'), ('Coventry', '08:03')],
    ask_placeholder='Ask me about it, or change it',
)

# --------------------------------------------------------------------------------------------------------- the Lens
LENS = dict(
    time='18:26',
    title='Lens',
    status='3 things in view',
    say='I see a plant, some text and a barcode. Tap one.',
    tags=[
        dict(id='plant', noun='a Dracaena', hint='tap to name it'),
        dict(id='text', noun='Text', hint='tap to read it'),
        dict(id='barcode', noun='A barcode', hint='tap for the product'),
    ],
    # the act on a tap of the text tag
    act=dict(
        kicker='I read it',
        title='A letter about your bins',
        body='From Monday 9 November your general waste moves to Thursdays. Recycling stays on alternate Fridays.',
        actions=['Add to my agenda', 'Read it to me'],
    ),
)

# --------------------------------------------------------------------------------------------------------- the Learn hub
# Exactly shell/hubcards.ts CARDS: kicker = glyph + name + status word; `title` the one line; two readouts each
# (label, value, unit). Library reads "Reading" and "Page" while a book is open (BRIEF-LIBRARY-READER 5).
HUB = dict(
    title='Learn',
    line='I’m in Nursery at school, and rated 1,240 at Chess.',
    recent=['library'],
    favourites=['gym', 'learn'],
    rest=['school', 'arcade', 'learning', 'coach'],
    cards={
        'library': dict(glyph='library', name='Library', status='READY', title='All I have read',
                        reads=[('Reading', 'Alice’s Adventures in Wonderland', ''), ('Page', '42 of 112', '')],
                        panels=['The reader', 'The shelf', 'Ask the library']),
        'gym': dict(glyph='gym', name='Gym', status='TRAINING', live=True, title='I teach myself',
                    reads=[('Rating', '1,240', '↑35'), ('Now', 'Sudoku Lv 6', '')],
                    panels=['Train all', 'Play me at chess'], ring=(3, 22)),
        'learn': dict(glyph='courses', name='Courses', status='READY', title='Learn anything',
                      reads=[('Next', 'Lesson 3', ''), ('Cards due', '14', '')],
                      panels=['Revise 14 cards', 'Quizzes'], course=('Part 3 of 8', 'Algebra', 3, 8)),
        'school': dict(glyph='school', name='School', status='READY', title='I sit real papers',
                       reads=[('Stage', 'Nursery', ''), ('Papers', '7', '')], ring=(2, 4)),
        'arcade': dict(glyph='arcade', name='Arcade', status='READY', title='Free classics',
                       reads=[('Games', '16', 'free'), ('Last game', 'Epic Pinball', '')]),
        'learning': dict(glyph='learning', name='Learning', status='READY', title='Words and maths',
                         reads=[('Streak', '12', 'days'), ('Skills', '9', '')],
                         works='Its words and first aid are typed in by hand'),
        'coach': dict(glyph='coach', name='Coach', status='READY', title='Music and typing',
                      reads=[('Streak', '3', 'days'), ('Passed', '5', 'lessons')],
                      works='Its words are a starter set, typed in by hand'),
    },
)


def is_figure(v):
    """hubcards' rule: a reading that is a figure ("14", "1,240", "42 of 112") is set in the mono; anything else is words."""
    import re
    return bool(re.match(r'^[-+−]?[£$€]?\d[\d.,:/]*( of \d[\d.,]*)?(%|°[CF]?)?$', v.strip()))
