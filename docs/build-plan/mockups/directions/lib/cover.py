"""A drawn cover for a book that has none (STARS 169: "a drawn cover from the title in the theme's accent"). One small
drawing per title, set in the theme's accent and the direction's ink, so the Shelf is never a grey block. 64 x 96 viewBox,
drawn at any size. Colours are tokens (--accent-rgb, --accent-pale-rgb, --ink-rgb), so Ember recolours every cover."""

# (lines of the title, the motif)
_TITLES = {
    'alice': (['Alice’s', 'Adventures', 'in Wonderland'], 'Lewis Carroll', 7.6),
    'hobbit': (['The', 'Hobbit'], 'J. R. R. Tolkien', 9.4),
    'island': (['Treasure', 'Island'], 'R. L. Stevenson', 9.0),
    'willows': (['The Wind', 'in the', 'Willows'], 'Kenneth Grahame', 8.2),
}


def _motif(book):
    a = 'rgba(var(--accent-pale-rgb),.9)'
    soft = 'rgba(var(--accent-pale-rgb),.28)'
    if book == 'alice':  # the little door, and its key
        return (f'<circle cx="32" cy="27" r="11.5" fill="rgba(var(--accent-rgb),.10)" stroke="{a}" stroke-width=".9"/>'
                f'<circle cx="32" cy="23.8" r="2.5" fill="{a}"/><path d="M30.3 25.4h3.4l1 7.4h-5.4z" fill="{a}"/>'
                f'<path d="M12 9l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1zM52 44l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" fill="{soft}"/>')
    if book == 'hobbit':  # a round door in a green hill, mountains behind
        return (f'<path d="M0 36l13-17 9 11 9-15 11 14 8-9 14 16z" fill="rgba(var(--accent-rgb),.14)"/>'
                f'<path d="M-4 50a36 22 0 0168 0z" fill="rgba(var(--accent-rgb),.22)"/>'
                f'<circle cx="32" cy="38" r="8.4" fill="rgba(5,10,14,.6)" stroke="{a}" stroke-width="1"/>'
                f'<circle cx="35.4" cy="38.4" r=".9" fill="{a}"/>')
    if book == 'island':  # a dotted way to an X
        return (f'<path d="M10 46c8-14 15 2 22-10s8-6 16-12" fill="none" stroke="{a}" stroke-width=".9" stroke-dasharray="1.6 2.2" stroke-linecap="round"/>'
                f'<path d="M45.2 20.2l5.6 5.6M50.8 20.2l-5.6 5.6" stroke="{a}" stroke-width="1.5" stroke-linecap="round"/>'
                f'<path d="M8 52c10 4 18-2 26 1s14 2 22-2" fill="none" stroke="{soft}" stroke-width=".8"/>')
    return (f'<path d="M16 46V24M20 46V18M24 46V27M44 46V22M48 46V29" stroke="{a}" stroke-width="1.1" stroke-linecap="round"/>'  # reeds
            f'<path d="M6 50c6-3 10 3 16 0s10 3 16 0 10 3 16 0M8 55c6-3 10 3 16 0s10 3 16 0 10 3 14 0" fill="none" stroke="{soft}" stroke-width=".9"/>')


def cover(book, w=64, uid='c'):
    """A cover as an inline SVG, w px wide (3 : 2 tall)."""
    lines, author, fs = _TITLES[book]
    h = round(w * 1.5)
    ty = 60 if len(lines) == 3 else 66
    title = ''.join(f'<tspan x="32" dy="{0 if i == 0 else fs * 1.16:.2f}">{t}</tspan>' for i, t in enumerate(lines))
    return (f'<svg class="cover" width="{w}" height="{h}" viewBox="0 0 64 96" aria-hidden="true">'
            f'<defs><linearGradient id="{uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:rgba(var(--accent-rgb),.50)"/>'
            f'<stop offset=".55" style="stop-color:rgba(var(--accent-rgb),.16)"/><stop offset="1" style="stop-color:rgba(5,9,13,1)"/></linearGradient>'
            f'<clipPath id="{uid}k"><rect width="64" height="96" rx="2.2"/></clipPath></defs>'
            f'<g clip-path="url(#{uid}k)"><rect width="64" height="96" fill="url(#{uid}g)"/>{_motif(book)}'
            f'<rect x="0" y="0" width="3.2" height="96" fill="rgba(0,0,0,.28)"/><rect x="3.2" y="0" width=".7" height="96" fill="rgba(255,255,255,.14)"/></g>'
            f'<text x="32" y="{ty}" text-anchor="middle" font-family="var(--font-serif)" font-weight="600" font-size="{fs}" style="fill:rgb(var(--ink-rgb))">{title}</text>'
            f'<text x="32" y="90" text-anchor="middle" font-family="var(--font-text)" font-weight="600" font-size="4.4" letter-spacing=".55" style="fill:rgba(var(--ink-rgb),.72)">{author.upper()}</text>'
            f'<rect x=".4" y=".4" width="63.2" height="95.2" rx="2" fill="none" stroke="rgba(255,255,255,.16)" stroke-width=".8"/></svg>')
