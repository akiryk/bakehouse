// Chapter 2 motion — paperless, no fly-away, two scroll beats.
// Beat A fades in from below; on further scroll beat B fades in while A shifts up
// and the midground morphs from slate (#c1caca) to slate-deep (#8a9ba5).
import gsap from "gsap";
import type { ChapterMotion } from "../../../motion/engine";
import { fadeInUpFrom, fadeInUpTo, shiftUp } from "../../../motion/presets";

// ── Tuning ────────────────────────────────────────────────────────────────────
// All timing values in timeline-seconds. The engine maps the full timeline
// duration to beatDurationVH of scroll — so changing positions here changes
// when things happen (in scroll distance) without touching the engine.
//
// Quick guide:
//   beat1       — scroll position where line A starts fading in (blank before it)
//   beat2       — scroll position where line B starts (= how long line A sits alone)
//   fadeInDur   — how many timeline-seconds each line's fade-in takes
//   beat2Dur    — how many timeline-seconds the shift + morph take
//   shiftPx     — how far line A moves up when line B appears
//   beatDurVH   — total viewport-heights of scroll for this chapter's beat window
const T = {
  beat1: 0.8, // blank scroll before line A appears
  beat2: 2.4, // line A alone from beat1+fadeInDur to here; then line B + shift
  fadeInDur: 0.5, // duration of each line's fade-in
  beat2Dur: 0.6, // duration of shift-up + midground morph
  shiftPx: 36, // px line A moves up on beat 2
  beatDurVH: 150, // total scroll distance (vh) for this chapter's beats window
};
// ─────────────────────────────────────────────────────────────────────────────

const motion: ChapterMotion = {
  beatDurationVH: T.beatDurVH,

  beats(container) {
    const a = container.querySelector<HTMLElement>("[data-beat='a']");
    const b = container.querySelector<HTMLElement>("[data-beat='b']");

    // Resolve palette colors at runtime so they stay single-sourced from global.css.
    const style = getComputedStyle(document.documentElement);
    const colorFrom = style.getPropertyValue("--midground-slate").trim();
    const colorTo = style.getPropertyValue("--midground-slate-deep").trim();
    const proxy = { t: 0 };
    const interpolate = gsap.utils.interpolate(colorFrom, colorTo);

    const tl = gsap.timeline();

    // Beat 1: line A fades in from below after an initial blank scroll window.
    tl.fromTo(
      a,
      fadeInUpFrom(),
      fadeInUpTo({ duration: T.fadeInDur }),
      T.beat1,
    );

    // Beat 2: line B fades in, line A shifts up (linear — no easing), midground darkens.
    tl.fromTo(
      b,
      fadeInUpFrom(),
      fadeInUpTo({ duration: T.fadeInDur }),
      T.beat2,
    );
    tl.to(
      a,
      shiftUp(T.shiftPx, { ease: "linear", duration: T.beat2Dur }),
      T.beat2,
    );
    tl.fromTo(
      proxy,
      { t: 0 },
      {
        t: 1,
        duration: T.beat2Dur,
        ease: "linear",
        onUpdate() {
          document.documentElement.style.setProperty(
            "--color-midground",
            interpolate(proxy.t),
          );
        },
      },
      T.beat2,
    );

    return tl;
  },
};

export default motion;
