// Edit decision list: [source, filmStart, filmEnd, sourceIn]. A = 35 LIGHTS canvas engine, B = specimen footage.
// Every segment keeps (filmStart − sourceIn) a whole number of bars (2 s at 120 bpm), so both scores stay on the grid.
window.EDL = [
  ["B", 0.0, 3.6, 0.0],
  ["A", 3.6, 8.0, 5.6],
  ["A", 8.0, 16.0, 12.0],
  ["B", 16.0, 27.9, 4.0],
  ["A", 27.9, 38.4, 19.9],
  ["B", 38.4, 51.3, 22.4],
  ["A", 51.3, 64.0, 35.3],
  ["B", 64.0, 76.0, 38.0],
  ["A", 76.0, 82.0, 50.0],
  ["B", 82.0, 88.4, 58.0],
  ["A", 88.4, 92.0, 56.4],
];
window.FILM_LEN = 92;
