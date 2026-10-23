# Fonts used by the mock-ups

Downloaded once on 23 Oct 2026, only for rendering the design mock-ups on a Linux machine. The real app on the
iPhone uses the system font (SF Pro) through `-apple-system`; nothing here ships in the app.

| File | Font | Version / source | Licence |
| --- | --- | --- | --- |
| `InterVariable.woff2` | Inter (variable, weights 100–900, optical sizes) | Inter v4.1, `cdn.jsdelivr.net/gh/rsms/inter@v4.1/docs/font-files/` | SIL Open Font License 1.1, see `LICENSE-Inter.txt` |
| `SourceSerif4-Variable.woff2` | Source Serif 4 (variable, Latin subset, weights 200–900) | Google Fonts (`fonts.gstatic.com/s/sourceserif4/v15`) | SIL Open Font License 1.1, see `LICENSE-SourceSerif4.md` |
| `SourceSerif4-Variable-Italic.woff2` | Source Serif 4 Italic (Latin subset, 400) | Google Fonts (`fonts.gstatic.com/s/sourceserif4/v15`) | SIL Open Font License 1.1, see `LICENSE-SourceSerif4.md` |

- Inter stands in for SF Pro in routes A, B and C.
- Source Serif 4 is route B's display serif (titles only); everything else in B is Inter.
- The OFL lets these files be used, studied, copied and redistributed with the licence kept beside them, which
  it is. Neither font is sold or renamed here.
- "Monospaced" readouts in route C use Inter with tabular figures (`tnum`) and wide tracking as the stand-in for
  SF Mono, so no third font was downloaded.
- Route C2 asks for real monospaced readouts (`ui-monospace`, SF Mono on the iPhone). On this Linux machine that stack
  falls back to DejaVu Sans Mono, which was already installed with the system (Bitstream Vera / DejaVu licence,
  free); it was not downloaded and is not copied here. SF Mono is a little narrower, so phone readouts will be
  slightly tighter than in the pictures.
