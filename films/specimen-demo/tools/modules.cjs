// Interaction scripts per module. τ = film time − (start − 0.5); every clip has 0.5 s handles.
// cursor: [τ, target, ease?]  target = {x,y} viewport | {sel,fx,fy} | {sel,pad:[wght,rond]} | {sel,range:value}
// events: [τ, "down"|"up"|"click"|"key"|"char"|"eval", arg]
const typeText = (t0, s, dt = 0.058) => [...s].map((ch, i) => [t0 + i * dt, "char", ch]);
const g = (ch) => ({ sel: `#gset button[data-ch="${ch}"]` });

module.exports = {
  hero: {
    start: 2, dur: 5.5,
    cursor: [[0.9, { x: 1570, y: 870 }], [1.5, { x: 1240, y: 380 }], [2.1, { x: 760, y: 470 }], [2.7, { x: 320, y: 360 }],
      [3.4, { x: 880, y: 330 }], [4.0, { x: 1300, y: 470 }], [4.7, { x: 1460, y: 720 }]],
  },
  idea: {
    start: 10, dur: 7,
    scroll: [[0, { sel: "#idea", off: 700 }], [0.4, { sel: "#idea", off: 700 }], [2.0, { sel: "#idea", off: 30 }], [3.6, { sel: "#idea", off: 30 }], [6.9, { sel: "#idea", off: -240 }]],
  },
  system: {
    start: 10.3, dur: 7.5,
    scroll: [[0, { sel: "#system", off: 30 }], [3.0, { sel: "#system", off: 30 }], [7.4, { sel: "#mfig", off: 250 }]],
  },
  axes: {
    start: 22, dur: 9,
    scroll: [[0, { sel: ".axes .grid2", off: 120 }], [8.9, { sel: ".axes .grid2", off: 150 }]],
    cursor: [[0.5, { x: 1580, y: 820 }], [1.2, { sel: "#pad", pad: [400, 100] }], [1.45, { sel: "#pad", pad: [400, 100] }],
      [2.4, { sel: "#pad", pad: [100, 100] }], [3.5, { sel: "#pad", pad: [900, 100] }], [4.5, { sel: "#pad", pad: [900, 0] }],
      [5.4, { sel: "#pad", pad: [400, 0] }], [6.3, { sel: "#pad", pad: [640, 55] }],
      [7.1, { sel: '#ax-chips .chip[data-w="900"][data-r="100"]' }], [8.6, { x: 1480, y: 860 }]],
    events: [[1.5, "down"], [6.4, "up"], [7.2, "click"]],
  },
  glyphs: {
    start: 30, dur: 7,
    scroll: [[0, { sel: ".glyphs .grid2", off: 110 }], [6.9, { sel: ".glyphs .grid2", off: 130 }]],
    cursor: [[0.5, { x: 1580, y: 620 }], [1.1, g("A")], [1.9, g("M"), "lin"], [2.5, g("Z"), "lin"], [3.2, g("g")],
      [4.2, { sel: '#g-filter .chip[data-f="sign"]' }], [5.1, g("♥")], [5.8, g("→")], [6.7, { sel: '#g-filter .chip[data-f="all"]' }]],
    events: [[3.35, "click"], [4.35, "click"], [5.25, "click"], [6.85, "click"]],
  },
  board: {
    start: 36, dur: 9,
    scroll: [[0, { sel: "#boardbox", off: 150 }], [8.9, { sel: "#boardbox", off: 165 }]],
    cursor: [[1.6, { x: 1580, y: 700 }], [2.4, { sel: "#face", fx: 0.55, fy: 0.5 }], [3.6, { sel: '#b-modes .chip[data-m="dep"]' }],
      [4.9, { sel: "#board-msg", fx: 0.25, fy: 0.5 }], [6.6, { sel: "#board-msg", fx: 0.28, fy: 0.5 }], [7.6, { sel: "#face", fx: 0.85, fy: 0.95 }]],
    events: [[2.55, "click"], [3.7, "click"], [5.0, "click"], ...typeText(5.15, "35 LIGHTS PER LETTER"), [6.45, "key", "Enter"]],
  },
  tester: {
    start: 44, dur: 7,
    scroll: [[0, { sel: ".tctl", off: 150 }], [6.9, { sel: ".tctl", off: 165 }]],
    cursor: [[0.5, { x: 1580, y: 820 }], [1.0, { sel: "#t-area", fx: 0.45, fy: 0.5 }], [2.6, { sel: "#t-area", fx: 0.47, fy: 0.55 }],
      [3.0, { sel: "#t-w", range: 400 }], [3.15, { sel: "#t-w", range: 400 }], [4.0, { sel: "#t-w", range: 900 }],
      [4.6, { sel: "#t-r", range: 100 }], [4.75, { sel: "#t-r", range: 100 }], [5.6, { sel: "#t-r", range: 0 }], [6.6, { x: 1480, y: 860 }]],
    events: [[1.1, "click"], [1.15, "eval", "document.querySelector('#t-area').select()"], ...typeText(1.25, "Dots, not strokes.", 0.06),
      [3.2, "down"], [4.05, "up"], [4.8, "down"], [5.65, "up"]],
  },
  use: {
    start: 50, dur: 7,
    scroll: [[0, { sel: "#use .uses", off: 140 }], [0.3, { sel: "#use .uses", off: 140 }], [6.9, { sel: "#use .uses", off: -420 }]],
  },
  footer: {
    start: 52, dur: 9,
    scroll: [[0, { sel: "#fbig", off: 260 }]],
    cursor: [[0.6, { x: 1580, y: 850 }], [1.3, { sel: "#fbig", fx: 0.3, fy: 0.5 }], [2.5, { sel: "#fbig", fx: 0.6, fy: 0.55 }], [3.4, { x: 900, y: 885 }]],
  },
};
