"""The line glyphs: the app's own (tools/common.py ICONS, and the tab glyphs each feature gives itself) so a direction
draws what the app already draws. A direction sets size and stroke with its tokens (--icon, --icon-stroke), never here."""
import importlib.util
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('mock_common', os.path.join(_HERE, '..', '..', 'tools', 'common.py'))
_common = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_common)

GLYPHS = dict(_common.ICONS)
# the tab glyphs, as each feature file gives them (apps/web/src/features/<tab>/index.ts) and the areas' (shell/areadefs.ts)
GLYPHS.update({
    'library': '<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z"/><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z"/>',
    'lens': '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    'school': '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c3 2.1 8 2.1 11 0v-4.2"/><path d="M12 14v6.5"/>',
    'arcade': '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>',
    'coach': '<path d="M8 20.5h8l-2.6-16h-2.8z"/><path d="M12 15.5l4.8-8.5M9.2 17.5h5.6"/>',
    'learning': '<path d="M4.5 19.5V6A2 2 0 016.5 4H19v13H6.5a2 2 0 00-2 2.5z"/><path d="M6.5 19.5H19M8.5 8h7M8.5 11.5h5"/>',
    'courses': '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5"/><path d="M22 8v6"/>',
    'godseye': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
    'agenda': '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h3M13.5 13h3M7.5 16.5h3"/>',
    'briefing': '<rect x="3" y="4" width="18" height="14" rx="1"/><path d="M7 9h10M7 13h6M8 21h8"/>',
    'money': '<rect x="3" y="6.5" width="18" height="11" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
    'life': '<circle cx="12" cy="12" r="3.6"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>',
    'star': '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    'listen2': '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>',
    'walk': '<circle cx="13" cy="4.5" r="2"/><path d="M10 21l1.6-6.5-2.4-2.5L10.5 8l3-1 2.5 3.5 2.5 1M13 14.5l2.8 2 .7 4.5"/>',
    'train': '<rect x="5" y="3.5" width="14" height="13" rx="3"/><path d="M5 11h14M8.5 20.5l2-4M15.5 20.5l-2-4"/><circle cx="9" cy="13.5" r=".7"/><circle cx="15" cy="13.5" r=".7"/>',
    'torch': '<path d="M8 3.5h8l-1.5 5h-5zM9.5 8.5V20a1 1 0 001 1h3a1 1 0 001-1V8.5M12 12v2.5"/>',
    'flip': '<path d="M4 8.5a8 8 0 0113.5-3.2L20 8M20 3.5V8h-4.5M20 15.5a8 8 0 01-13.5 3.2L4 16M4 20.5V16h4.5"/>',
    'type': '<path d="M5 19l4-14h2l4 14M6.8 14h6.4M17 19v-6M15 15.2h4"/>',
    'chaptersg': '<path d="M5 6.5h14M5 12h14M5 17.5h9"/>',
    'dots': '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
    'pause': '<path d="M8 5v14M16 5v14"/>',
    'forward': '<path d="M5 6l8 6-8 6zM15 6v12"/>',
    'book': '<path d="M5 4.5h11a2 2 0 012 2V19a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19z"/><path d="M8.5 8.5h6M8.5 12h6"/>',
    'plus2': '<path d="M12 5v14M5 12h14"/>',
    'sort': '<path d="M7 5v14M7 19l-3-3M7 19l3-3M17 19V5M17 5l-3 3M17 5l3 3"/>',
})


def glyph(name, cls='i', size=None):
    s = f' width="{size}" height="{size}"' if size else ''
    return f'<svg class="{cls}" viewBox="0 0 24 24"{s} aria-hidden="true">{GLYPHS[name]}</svg>'
