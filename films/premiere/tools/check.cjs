require("../src/glyphs.js"); require("../src/model.js");
const P = globalThis.PUNCTUM; let mx = 0;
for (let t = 0; t < P.LEN; t += 0.25) { const F = P.frame(t); mx = Math.max(mx, F.n); if (!F.cam || F.cam.pos.some(isNaN)) console.log("bad cam", t); }
console.log("ok, max instances", mx, "events", P.EVENTS.length);
