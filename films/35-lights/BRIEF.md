---
workflow: general-video
flow: automation
storyboard: no
message: "Every letter is a decision about 35 lights — and you can hear it."
aspect: 1920x1080
length: 60s
language: en (on-screen text drawn in Punctum dots only)
audience: designers, type lovers, social feed
---

## Intent
User asked (2026-10-04): 为 Punctum 做一个 motion video，动感十足，有格调，像世界顶级设计工作室的代表作。
Chose to MIX all five pitched directions; 60 s; straight to final film; automation.
Spine: "the typeface is the score" — the 5×7 lattice is a step sequencer; every lit dot is a note.
Arc: 01 One light (35 lights fill one cell) → 02 Score (playhead writes PUNCTUM and plays it)
→ 03 Countdown (16→01 split-flap wall, rolls ripple outward) → 04 Design space (drop; THIN→BLACK, ROUND→PIXEL wipe; timbre follows the axes: ROND = sine↔square, wght = brightness/level)
→ 05 Endless board (whip-pans across panels: world clock, glyph set, LED, VFD, thermal paper, LCD, amber departures)
→ 06 35 lights (zoom out to a wall of text, ripple clears it, dive back into one cell, final playhead) → 07 PUNCTUM end card, one dot remains, then off.

## Customizations
- Synthesized score (numpy) generated from the same glyph bitmaps and event times as the picture.
- Everything, including HUD text, is drawn as Punctum dots on one lattice (no other typeface).
- Motion signature: split-flap drum cascade; lens swells dots and turns them square; whip pans smear dots.

## Assets
- ../../src/bitmaps.json (Punctum v1 glyph bitmaps)
