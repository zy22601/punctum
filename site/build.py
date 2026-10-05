"""Build the GitHub Pages site into docs/.

docs/index.html        the final specimen (src/specimen.template.html, font + bitmaps inlined)
docs/first/index.html  the first specimen page, 2026-10-03, kept as it was (site/first.html)
docs/favicon.svg       the P bitmap as lit dots

Run after src/build.py:  python3 site/build.py
"""
import base64, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
URL = "https://sundyme.github.io/punctum/"
DESC = "Punctum 是一款免费开源的可变点阵字体：5×7 点阵，两条轴控制点的大小和形状，从圆点到方块像素。SIL OFL 1.1。"
DESC_EN = "Punctum, a free variable dot-matrix typeface. 5×7 dots, two axes: dot size and dot shape, round to pixel."


def read(*p, mode="r"):
    with open(os.path.join(ROOT, *p), mode, **({} if "b" in mode else {"encoding": "utf-8"})) as f:
        return f.read()


def write(path, s):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)


def favicon(bitmaps):
    rows = bitmaps["P"][:7]
    dots = "".join(
        f'<circle cx="{4 + x * 6}" cy="{4 + y * 6}" r="2.4"/>'
        for y, row in enumerate(rows) for x, c in enumerate(row) if c == "#"
    )
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -4 44 48">'
            '<rect x="-6" y="-4" width="44" height="48" rx="8" fill="#0A0A09"/>'
            f'<g fill="#EEEDE7">{dots}</g></svg>\n')


def head(title, desc, url, image):
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<link rel="icon" href="{URL}favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Punctum">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{DESC_EN}">
<meta name="twitter:image" content="{image}">
"""


def page(src, top):
    """Template files start with <title>; swap it for the full head."""
    assert src.startswith("<title>Punctum</title>")
    return top + src[len("<title>Punctum</title>"):].replace("</style>", "</style>\n</head>\n<body>", 1) + "\n</body>\n</html>\n"


bitmaps = json.loads(read("src", "bitmaps.json"))
woff2 = base64.b64encode(read("fonts", "Punctum-VF.woff2", mode="rb")).decode()

final = read("src", "specimen.template.html").replace("__WOFF2__", woff2).replace("__BITMAPS__", json.dumps(bitmaps, separators=(",", ":")))
write(os.path.join(DOCS, "index.html"),
      page(final, head("Punctum · 可变点阵字体", DESC, URL, URL + "media/social.png")))

BANNER = """<style>
.v1bar { position: sticky; top: 0; z-index: 99; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px;
  padding: 10px 16px; margin-inline: -16px; background: #0A0A09; color: #EEEDE7;
  font: 500 13px/1.4 "JetBrains Mono", ui-monospace, Menlo, monospace; letter-spacing: .02em; }
.v1bar a { color: inherit; text-underline-offset: 3px; }
</style>
<div class="v1bar" role="note"><span>这是第一版样张页 · 2026-10-03</span><a href="../">查看最终版 →</a><a href="https://github.com/sundyme/punctum/blob/main/PROCESS.md">创作过程</a></div>
"""
first = read("site", "first.html").replace('<div class="sheet">', BANNER + '<div class="sheet">', 1)
write(os.path.join(DOCS, "first", "index.html"),
      page(first, head("Punctum · 第一版样张页", "Punctum 的第一版样张页（2026-10-03），后来被重做成现在的版本。", URL + "first/", URL + "media/compare.png")))

write(os.path.join(DOCS, "favicon.svg"), favicon(bitmaps))
write(os.path.join(DOCS, ".nojekyll"), "")
for f in ("index.html", "first/index.html"):
    print(f, os.path.getsize(os.path.join(DOCS, f)))
