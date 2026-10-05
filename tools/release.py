"""Package the release download: dist/Punctum.zip

Punctum-1.000/
  README.txt  OFL.txt
  Desktop/Punctum[ROND,wght].ttf   Desktop/Static/*.ttf
  Web/Punctum-VF.woff2             Web/punctum.css
"""
import os, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
TOP = "Punctum-1.000"

README = """Punctum 1.000
A variable dot-matrix typeface. 可变点阵字体。

Desktop  Install Desktop/Punctum[ROND,wght].ttf. 安装这一个文件就够了。
         Apps without variable fonts: Desktop/Static/ (10 styles).
Web      Web/Punctum-VF.woff2 + Web/punctum.css

Axes     wght 100-900  dot size   点的大小
         ROND 0-100    dot shape  点的形状 (100 round, 0 square pixel)
Tip      font-size in multiples of 10px, line-height 1.

Website  https://sundyme.github.io/punctum/
Source   https://github.com/sundyme/punctum
License  SIL Open Font License 1.1 (OFL.txt)
"""

CSS = """@font-face {
  font-family: "Punctum";
  src: url("Punctum-VF.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}

/* round dots (default) */
.punctum { font-family: "Punctum", monospace; font-variation-settings: "wght" 400, "ROND" 100; line-height: 1; }
/* square pixels */
.punctum-pixel { font-family: "Punctum", monospace; font-variation-settings: "wght" 400, "ROND" 0; line-height: 1; }
"""

os.makedirs(DIST, exist_ok=True)
out = os.path.join(DIST, "Punctum.zip")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr(f"{TOP}/README.txt", README)
    z.write(os.path.join(ROOT, "OFL.txt"), f"{TOP}/OFL.txt")
    z.write(os.path.join(ROOT, "fonts", "Punctum[ROND,wght].ttf"), f"{TOP}/Desktop/Punctum[ROND,wght].ttf")
    for f in sorted(os.listdir(os.path.join(ROOT, "fonts", "static"))):
        if f.endswith(".ttf"):
            z.write(os.path.join(ROOT, "fonts", "static", f), f"{TOP}/Desktop/Static/{f}")
    z.write(os.path.join(ROOT, "fonts", "Punctum-VF.woff2"), f"{TOP}/Web/Punctum-VF.woff2")
    z.writestr(f"{TOP}/Web/punctum.css", CSS)
print(out, os.path.getsize(out))
