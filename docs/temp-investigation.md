# Investigation regarding how scrolling works in the app.

The actual scroller

The window/document scrolls natively. There is no scroll container, no custom scroller, no GSAP SmoothScroll.

- Visual layers (#midground-mat, the foreground stage div.fixed.inset-0) are position: fixed in CSS — they pin implicitly, without GSAP
  pin: true.
- A <div> spacer appended to <body> at the end of initScrollEngine provides all real scroll height: height: ${totalVH}vh.
- <html> is the scroll container. document.scrollingElement = <html>. document.body.scrollTop = 0 (expected — body does not scroll, html
  does).
- No custom scroller is passed to any ScrollTrigger.create() call. GSAP defaults to window.
- Confirmed by diagnostics: window.scrollY, document.scrollingElement.scrollTop, and document.documentElement.scrollTop all agreed at the
  same value. document.body.scrollTop = 0.

---

File / function inventory

src/config/scroll.ts

- Reads scroll from: nothing.
- Defines: vhPerBeat = 100, minBeatPx = 560, beatPx(win), chapterExitBeats = 1.5, endRestBeats = 1.
- Drives: all downstream consumers import from here. beatPx is exported and placed on BeatModel but is not currently called by any
  consumer.

---

src/motion/engine.ts — computeSlots()

- Reads scroll from: nothing (pure function of config constants).
- Works in: beats internally, converts to vh at output edge.
- Input: ChapterMotion.beatDurationVH (vh), vhPerBeat, chapterExitBeats, endRestBeats.
- Conversion beats→vh: beats × vhPerBeat.
- Conversion vh→beats: beatDurationVH / vhPerBeat (reads the incoming vh back; see rounding note below).
- Output: ChapterSlot.{beatStart, beatEnd, flyStart, flyEnd} in vh; totalVH in vh.
- No beatPx floor anywhere in this path.

---

src/motion/engine.ts — buildModel()

- Reads: slot vh values.
- Converts vh→beats: (slot.beatEnd - slot.beatStart) / vhPerBeat and (slot.flyEnd - slot.flyStart) / vhPerBeat.
- Outputs: ChapterBeats.endBeat, exitBeat in chapter-relative beats; scrollVH.\* in vh (unchanged from slots); totalVH in vh.

---

src/motion/engine.ts — spacer

- spacer.style.cssText = "height:${totalVH}vh".
- Uses CSS vh units, which the browser resolves dynamically as totalVH × window.innerHeight / 100 px. This is what makes the page
  scrollable. If the viewport is resized, the spacer's computed px height changes automatically without a rebuild.

---

src/motion/engine.ts — ScrollTrigger setup (fly-aways, color morphs, beats)

- For each chapter: start: "top+=${slot.flyStart}vh top", end: "top+=${slot.flyEnd}vh top".
- GSAP interprets these as CSS vh — value × window.innerHeight / 100 px from the spacer's top edge.
- Scroller: window (GSAP default; never overridden).
- Reads scroll from: GSAP/ScrollTrigger internal window scroll listener.
- Drives: tween/timeline progress 0→1 across the chapter's scroll window.
- The scrub value is 1.5 — timeline progress lags scroll by up to ~1.5 seconds of smoothing.

---

src/chapters/home/02-placeholder/motion.ts

- beatDurationVH: Math.round(SCRIPT.totalBeats \* vhPerBeat) — converts the script's totalBeats (in beats) to vh, passing it to the engine.
- Math.round here: if totalBeats × vhPerBeat is not an integer, rounding introduces a fractional beat error on the round-trip through
  computeSlots. At the current values (37.25 × 100 = 3725.0), no error. But this is a fragile assumption.

---

src/motion/timeline-kit.ts — compile()

- Builds a raw GSAP timeline authored in beats. Timeline duration = SCRIPT.totalBeats.
- tl.time() is in beats. tl.progress() is 0→1 across the beat window.
- No scroll reads here. The engine wraps the returned timeline in a ScrollTrigger.

---

src/motion/timeline-kit.ts — attachDebugHud()

- Beat source: tl.time() — the GSAP timeline's current playhead in beats.
- Does NOT read window.scrollY directly.
- Year source: gsap.getProperty(tape, "y", "vh") → inverted through yFor().
- Effective beat formula (derived): tl.time() = (scrollY − beatStart_px) / window.innerHeight chapter-relative beats. (Because
  ScrollTrigger maps scrollY over a range of totalBeats × window.innerHeight px, and the timeline duration is totalBeats, they cancel.)
- Note: tl.time() lags scrollY by the scrub: 1.5 smoothing during active scrolling. At steady state they converge.

---

src/motion/timeline-kit.ts — ?beats console table

- Source: chapterBeats.schedule (pre-computed BeatModel, printed once at compile time).
- No scroll read. Static output.

---

src/dev/beat-ruler.ts — build()

- Beat source: model.scrollVH.\* (vh) and model.vhPerBeat (vh).
- Conversion: vhToPx(vh) = vh × window.innerHeight / 100 — no floor.
- window.innerHeight is captured once at build time via makeVhToPx() and held in closure.
- Strip height: vhToPx(model.totalVH) px.
- Beat bar height: vhToPx(model.vhPerBeat) = window.innerHeight px.
- Chapter 2 start in strip: vhToPx(ch.scrollVH.beatStart) = 150 × 857/100 = 1285.5 px (confirmed by build diagnostic).
- Event span tops: vhToPx(ch.scrollVH.beatStart) + vhToPx(evt.startBeat × model.vhPerBeat).

---

src/dev/beat-ruler.ts — syncScroll()

- Reads: window.scrollY (CSS px).
- Applies: translateY(-${window.scrollY}px).
- The strip is laid out in CSS px (via vhToPx). window.scrollY is also CSS px. These are the same coordinate space.

---

src/motion/octagon.ts

- No scroll involvement. Driven by requestAnimationFrame + performance.now() via GSAP time. Reads window.innerWidth/innerHeight for
  geometry, not scroll position.

---

Every beat conversion, listed

┌──────────────────┬─────────────────────────┬───────────────────────────────────────────────┬─────────────────────────┐
│ Location │ Direction │ Formula │ Divisor │
├──────────────────┼─────────────────────────┼───────────────────────────────────────────────┼─────────────────────────┤
│ computeSlots │ beats → vh │ beats × vhPerBeat │ ×100 │
├──────────────────┼─────────────────────────┼───────────────────────────────────────────────┼─────────────────────────┤
│ computeSlots │ vh → beats │ beatDurationVH / vhPerBeat │ ÷100 │
├──────────────────┼─────────────────────────┼───────────────────────────────────────────────┼─────────────────────────┤
│ buildModel │ vh → beats │ (beatEnd_vh − beatStart_vh) / vhPerBeat │ ÷100 │
├──────────────────┼─────────────────────────┼───────────────────────────────────────────────┼─────────────────────────┤
│ ScrollTrigger │ vh → px (internal) │ vh_value × window.innerHeight / 100 │ GSAP parses "vh" string │
├──────────────────┼─────────────────────────┼───────────────────────────────────────────────┼─────────────────────────┤
│ HUD tl.time() │ scrollY → chapter beats │ (scrollY − beatStart_px) / window.innerHeight │ ÷innerHeight │
├──────────────────┼─────────────────────────┼───────────────────────────────────────────────┼─────────────────────────┤
│ Ruler vhToPx │ vh → px │ vh × window.innerHeight / 100 │ ×innerHeight/100 │
├──────────────────┼─────────────────────────┼───────────────────────────────────────────────┼─────────────────────────┤
│ Ruler syncScroll │ px → strip offset │ translateY(−scrollY) │ direct (no conversion) │
└──────────────────┴─────────────────────────┴───────────────────────────────────────────────┴─────────────────────────┘

No two consumers use different formulas for the same concept. Every active path is vh × innerHeight / 100. No consumer uses a raw vhPerBeat
value as pixels.

---

vhPerBeat vs beatPx(window) — can they disagree?

At window.innerHeight = 857 (confirmed): beatPx(window) = max(560, 857) = 857. Both give 857 px/beat. No disagreement at this window size.

They disagree only when window.innerHeight < 560. The floor activates at minBeatPx = 560. Below that height: beatPx = 560, but the actual
scroll beat size = window.innerHeight (< 560). Content authored for 560px/beat would be compressed into fewer px of scroll.

Who uses which:

┌──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────┐
│ Consumer │ Uses │
├──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
│ Engine computeSlots │ vhPerBeat (no floor) │
├──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
│ Engine buildModel │ vhPerBeat (no floor) │
├──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
│ motion.ts beatDurationVH │ vhPerBeat (no floor) │
├──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
│ Ruler build() via vhToPx │ vhPerBeat (no floor, via model.vhPerBeat) │
├──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
│ HUD tl.time() │ Implicit: window.innerHeight (derived through GSAP progress, which uses actual scroll px) │
├──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
│ BeatModel.beatPx │ Exported, not called by any current consumer │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────┘

beatPx() exists on the model but nothing calls it at runtime. Every active consumer derives beat size without the floor.

---

Concrete end-to-end trace

Using the values confirmed by the diagnostic session: window.innerHeight = 857, model.totalVH = 3975.

Derived from totalVH: (cursorBeats + endRestBeats) × vhPerBeat = 3975 → cursorBeats = 38.75. Chapter 1 has no beats (only a 1.5-beat exit).
Chapter 2 has no exit (last chapter). So chapter 2's beat window = 38.75 − 1.5 − 1.0 = 37.25 beats (SCRIPT.totalBeats). Chapter 2 scroll
range: 150vh to 3875vh.

Scroll position: scrollY = 2257px

┌─────────────────────────────────────┬─────────────────────────┬──────────────┐
│ Consumer │ Formula │ Value │
├─────────────────────────────────────┼─────────────────────────┼──────────────┤
│ Page position in vh │ 2257 / 857 × 100 │ 263.5 vh │
├─────────────────────────────────────┼─────────────────────────┼──────────────┤
│ Chapter 2 beatStart in px │ 150 × 857 / 100 │ 1285.5 px │
├─────────────────────────────────────┼─────────────────────────┼──────────────┤
│ Offset into ch2 beat window │ 2257 − 1285.5 = 971.5px │ 971.5 px │
├─────────────────────────────────────┼─────────────────────────┼──────────────┤
│ Ch2 scroll range in px │ 37.25 × 857 │ 31,923 px │
├─────────────────────────────────────┼─────────────────────────┼──────────────┤
│ ScrollTrigger ch2 progress │ 971.5 / 31923 │ 3.04 % │
├─────────────────────────────────────┼─────────────────────────┼──────────────┤
│ HUD tl.time() │ 0.0304 × 37.25 │ ≈ 1.13 beats │
├─────────────────────────────────────┼─────────────────────────┼──────────────┤
│ Ruler strip offset at ch2 beat 1.13 │ 1285.5 + 1.13 × 857 │ ≈ 2253 px │
├─────────────────────────────────────┼─────────────────────────┼──────────────┤
│ Ruler translateY │ −window.scrollY │ −2257 px │
└─────────────────────────────────────┴─────────────────────────┴──────────────┘

All three consumers resolve to ~beat 1.13 of chapter 2 at scrollY = 2257. The ruler's translateY(−2257px) moves the strip to show strip
position 2257px at the viewport top — which is beat 1.13 — matching what ScrollTrigger and the HUD report. The three consumers agree.

The "beat 21 / translateY −2256" observation from the prior session cannot be reproduced at scrollY = 2257 with innerHeight = 857. Beat 21
would require scrollY ≈ 19,283px (= 1285.5 + 21 × 857), at which point translateY(−19283px) is what the ruler would apply — also correct.

---

Potential divergence points (not confirmed bugs — observations only)

1. Math.round in motion.ts: beatDurationVH = Math.round(totalBeats × vhPerBeat). Round-trip through computeSlots (÷ vhPerBeat) can lose a
   fractional beat if the product isn't an integer. Currently 37.25 × 100 = 3725.0 exactly — no loss. Fragile to non-integer vhPerBeat or
   non-quarter-beat scripts.
2. Ruler window.innerHeight captured once at build: The spacer's CSS vh resolves dynamically on every frame. If the window is resized and
   the 100ms debounce hasn't fired yet, the spacer's px height and the ruler's strip height are briefly out of sync. Rebuild-on-resize
   corrects it.
3. scrub: 1.5 lag: tl.time() (and therefore the HUD) trails the raw scroll by up to ~1.5s during active scrolling. The ruler
   (window.scrollY) and ScrollTrigger progress diverge by that lag during scroll motion. At rest, they converge.
4. beatPx floor dormant but present: The floor activates at innerHeight < 560. Nothing calls beatPx() today, so it has no effect. If a
   consumer is added that uses beatPx, it will disagree with all existing consumers below 560px window height.

We also changed beatDurationVH, which was being used by motion.ts files. Before: if I wanted to make the first chapter take 4 beats to fly away,
I need to set beatDurationVH = 4000, not 4. THis was confusing. Here's what changed:

- ChapterMotion.beatDurationVH → durationBeats — now in beats, the natural unit
- Engine computeSlots — durationBeats is used directly; no vh conversion needed at the authoring level (the engine converts internally:
  durationBeats \* vhPerBeat)
- Chapter 1 — durationBeats: 2 means 2 beats, 2 full scroll lengths before the fly-away
- Chapter 2 — durationBeats: SCRIPT.totalBeats directly, no Math.round needed since we're not converting to vh anymore
- Chapter 2 — unused vhPerBeat import removed
