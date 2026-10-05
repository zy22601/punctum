<a href="https://sundyme.github.io/punctum/"><img src="docs/media/social.png" alt="The Punctum website hero: PUNCTUM set in white dots, with a lens that makes dots larger and square" width="100%"></a>

# Punctum <sub>A variable dot-matrix typeface</sub>

**Every letter is made of 35 lights.** Punctum is a free, open-source variable dot-matrix typeface: a 5 × 7 lattice with two axes, one for dot size and one for dot shape, from pinhole LED to square pixel.

[Website](https://sundyme.github.io/punctum/) · [Download](https://github.com/sundyme/punctum/releases/latest/download/Punctum.zip) · [First page](https://sundyme.github.io/punctum/first/) · [How it was made](PROCESS.en.md) · [中文](README.md)

<br>

## Features

- **One continuous lattice.** Dot pitch 100 units, advance 600, line 1000. Neighbouring letters and lines all land on the same grid, so set text reads as one display.
- **Real descenders.** Capitals sit on 5 × 7; lowercase gets 2 more rows, so g, j, p, q and y are not squashed.
- **Two axes, one file.** Every dot in every master is the same 16-point quadratic contour, so the axes combine freely.
- **108 glyphs.** Full ASCII plus departure-board symbols ° · • … × — ← ↑ → ↓ ♥ ■.
- **18 named styles.** Nine weights from Thin to Black, each in round and Pixel.

<br>

## Axes

| Axis | Range | Default | Controls |
| --- | --- | --- | --- |
| `wght` | 100–900 | 400 | Dot size. 100 is a pinhole LED; at 900 the dots touch |
| `ROND` | 0–100 | 100 | Dot shape. 100 is round, 0 is a square pixel, values between are squircles |

<img src="docs/media/proof.png" alt="Punctum proof across weights and dot shapes" width="100%">

<br>

## Usage

**Desktop:** download [Punctum.zip](https://github.com/sundyme/punctum/releases/latest/download/Punctum.zip) and install `Desktop/Punctum[ROND,wght].ttf`. For apps without variable-font support, install the 10 static styles in `Desktop/Static/`.

**Web:**

```css
@font-face {
  font-family: "Punctum";
  src: url("Punctum-VF.woff2") format("woff2");
  font-weight: 100 900;
}

.display {
  font-family: "Punctum";
  font-variation-settings: "wght" 400, "ROND" 100;
  font-size: 60px;   /* multiples of 10px keep every dot on whole pixels */
  line-height: 1;    /* lines join into one lattice */
}
```

<br>

## Films

Three short films. Picture and sound are generated in code. Click a still to play.

| [<img src="docs/media/specimen-demo.jpg" alt="Specimen demo">](https://sundyme.github.io/punctum/media/specimen-demo.mp4) | [<img src="docs/media/35-lights.jpg" alt="35 LIGHTS">](https://sundyme.github.io/punctum/media/35-lights.mp4) | [<img src="docs/media/premiere.jpg" alt="Premiere">](https://sundyme.github.io/punctum/media/premiere.mp4) |
| --- | --- | --- |
| **Specimen** · site demo · 1:06 | **35 Lights** · the type as score · 0:42 | **Premiere** · WebGL2 dot light · 1:20 |

There is also a 92-second **Launch** cut and three social formats of 35 Lights (16:9, 9:16, 2:3). Sources for all five films are in [films/](films); 1080p masters are attached to [Releases · films-2026-10](https://github.com/sundyme/punctum/releases/tag/films-2026-10).

<br>

## Two pages

The typeface was essentially done on day one. The specimen page had two versions. The first was a continuous-form printout. The final one turns the whole page into a dot-matrix display, draws the dark dots too, and rolls text into place like a split-flap board.

<img src="docs/media/compare-full.jpg" alt="Left, the first specimen page on green-bar printout paper; right, the final page as a black dot-matrix display" width="100%">

Both are online: [first version](https://sundyme.github.io/punctum/first/) · [final version](https://sundyme.github.io/punctum/). The whole path from "can you design a dot-matrix typeface?" to here is in [How it was made](PROCESS.en.md).

<br>

## Build from source

Needs Python 3 and fontTools (`pip install fonttools brotli`).

```bash
python3 src/build.py      # glyphs → variable font, static styles and woff2 in fonts/
python3 site/build.py     # font + template → the website in docs/
python3 tools/release.py  # package dist/Punctum.zip
```

To change a letter, edit its `#` and `.` drawing in [src/glyphs.py](src/glyphs.py) and rebuild.

```text
src/glyphs.py                  dot-matrix sources, 108 glyphs
src/build.py                   builds the font files
src/specimen.template.html     final specimen page template
site/first.html                first specimen page, kept as it was on 2026-10-03
site/build.py                  builds docs/
docs/                          GitHub Pages site, with films and images
films/                         sources for the five films (picture engines, score scripts)
fonts/                         built font files
```

<br>

## Prior art

Building letters from dots is an old idea. Punctum is not the first dot-matrix typeface, nor the first to put dot size and dot shape on axes. These are the relatives we know of.

| Typeface | Designer / year | In common | Different |
| --- | --- | --- | --- |
| [Doto](https://fonts.google.com/specimen/Doto) | Óliver Lalan · 2024 · OFL | Variable dot matrix; `wght` sets dot size, `ROND` sets round versus square | The closest idea. Punctum uses a 5 × 9 grid (capitals on 5 × 7), Doto 6 × 10. Punctum's glyphs were drawn one by one and its files are built by this repository's scripts; no Doto files were used |
| [Powerhouse Punctum](https://matterofsorts.com/) | Vincent Chan · 2023 · custom for the Powerhouse museum | Same name; also drawn from punch cards and dot-matrix printers | Unrelated |

A 5 × 7 grid leaves little room, so many capitals inevitably resemble decades of LCD and printer fonts. That is the shared vocabulary of the grid.

<br>

## License

- Fonts: [SIL Open Font License 1.1](OFL.txt). Free for any project, including commercial work, and you may modify and redistribute them.
- Code and website: [MIT](LICENSE).

Punctum was designed by Claude (Opus 5.5) for [sundyme](https://x.com/sundyme).
