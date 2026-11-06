"""D1's night: a deterministic scatter of faint stars behind everything, so the page reads as a sky Mind sits in and not as a
black rectangle. Colours are tokens (--ink-rgb), so the stars take the direction's ink. 440 x 956, `slice`."""
import random


def sky(seed=4, n=58):
    rnd = random.Random(seed)
    dots = []
    for _ in range(n):
        x, y = rnd.uniform(0, 440), rnd.uniform(0, 956)
        r = rnd.choice((.45, .55, .65, .8, 1.0))
        a = rnd.uniform(.10, .46)
        dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" style="fill:rgba(var(--ink-rgb),{a:.2f})"/>')
    for _ in range(5):  # a few brighter ones, with a hair of cross
        x, y = rnd.uniform(20, 420), rnd.uniform(60, 900)
        dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.2" style="fill:rgba(var(--accent-pale-rgb),.7)"/>'
                    f'<path d="M{x - 4:.1f} {y:.1f}h8M{x:.1f} {y - 4:.1f}v8" style="stroke:rgba(var(--accent-pale-rgb),.28)" stroke-width=".6"/>')
    return f'<svg class="sky" width="100%" height="100%" viewBox="0 0 440 956" preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-bleed>{"".join(dots)}</svg>'
