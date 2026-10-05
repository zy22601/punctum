require("../src/glyphs.js"); require("../src/model.js");
const P = globalThis.PUNCTUM, fs = require("fs");
const pad = []; for (let t = 20; t < 26; t += 0.125) pad.push([+t.toFixed(3), ...P.padAt(t).map((v) => Math.round(v))]);
fs.writeFileSync(__dirname + "/../assets/events.json", JSON.stringify({ len: P.LEN, events: P.EVENTS, pad }));
console.log("events", P.EVENTS.length);
