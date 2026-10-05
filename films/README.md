# 影片源码 Films

Punctum 第一版的五支影片。画面都由字体的点阵数据生成，配乐用 numpy 按画面事件合成（35 LIGHTS 另有 ElevenLabs 版）。成片（1080p 原片）在 [Releases · films-2026-10](https://github.com/sundyme/punctum/releases/tag/films-2026-10)。

| 目录 | 影片 | 时长 | 做法 |
| --- | --- | --- | --- |
| `35-lights/` | **35 Lights** · 字体即乐谱 | 0:42 | HyperFrames + 单张 canvas 点阵引擎；点阵网格就是步进音序器 |
| `35-lights-social/` | 35 Lights 社媒剪辑：`16x9/`、`9x16/`、`2x3/` | 0:31 | 同一个 `film.js`，用 `window.PUNCTUM_W/H` 改画幅，`window.CUT` 重映射时间 |
| `specimen-demo/` | **Specimen** · 网页演示 | 1:06 | 录下样张页的交互，在三维平面上运镜 |
| `launch/` | **Launch** · 合剪 | 1:32 | 35 Lights 引擎与网页演示片按小节线交叉剪辑 |
| `premiere/` | **Premiere** · 点光世界 | 1:20 | 自写 WebGL2 渲染器（玻璃珠点、地面反射、景深、辉光），不用 HyperFrames |

## 构建

HyperFrames 项目（`35-lights`、`35-lights-social/*`、`specimen-demo`、`launch`）：

```bash
python3 tools/score.py     # 或该片的 music.py / mix.py：生成 assets/ 里的配乐 WAV
npm run check
npm run render             # → renders/
```

`premiere`：

```bash
cd premiere/tools && npm i playwright && cd ..
node tools/events.cjs && python3 tools/score.py
node tools/render.mjs
```

## 未收录的文件

- **配乐 WAV**、渲染输出（`renders/`、`out/`、`stills/`、`snapshots/`）和评审截图。配乐可以用各片的脚本重新生成，成片里也已包含。
- **`launch/footage/specimen.mp4`**：它是 `specimen-demo` 去掉 HUD 后的渲染，先渲染 `specimen-demo` 再放到这里。
- **`specimen-demo/capture/*.mp4`**：由 `tools/capture.cjs` 从 `capture/page.html` 录制，`capture/proxy/` 里保留了小尺寸代理。

---

**English.** Sources for the five Punctum v1 films (35 Lights and its three social cuts, the specimen demo, the 92 s launch cut and the WebGL2 Premiere). Pictures are generated from the font's dot data and scores are synthesized from the on-screen events. 1080p masters are attached to the [films-2026-10 release](https://github.com/sundyme/punctum/releases/tag/films-2026-10); score WAVs and render outputs are not committed.
