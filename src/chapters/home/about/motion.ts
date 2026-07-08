/**
 * About has no dwell-then-fly-away — it's a dead end, nothing hands off to a
 * next chapter. Instead its own paper (the [data-chapter] container passed
 * in as `container`) has its `y` continuously scrubbed upward across the
 * whole dwell window, so scrolling reads as steady reading progress rather
 * than a hold-then-snap. Same technique the timeline chapter already uses
 * to scrub its year-strip's y inside beats() — just applied to the paper
 * itself.
 *
 * Travel distance is MEASURED at runtime (container's rendered height minus
 * the viewport), not hand-tuned — a fixed vh distance was tried first and
 * failed on a narrow viewport: text reflows into far more lines in a
 * narrower column, so the paper is much taller there, and a vh number tuned
 * against the wide layout left the tail of the copy permanently
 * unreachable. This is a correctness requirement (nothing may become
 * unreachable), not a feel value — same reasoning octagon.ts already
 * applies to its own runtime-measured insets.
 *
 * DWELL_BEATS (how much scroll the read takes) stays a hand-tuned constant
 * — re-tune it if the pacing feels off, same as any other feel value in
 * this codebase (e.g. timeline/script.ts's CONFIG.pitch). It's exported so
 * about.script.ts's chapter() placement always matches this timeline's own
 * duration instead of a second, independently-drifting copy of the number.
 */
import gsap from "gsap";
import type { ChapterMotion } from "../../../motion/engine";

export const DWELL_BEATS = 3.5;

/** Extra px past the measured content height so the last line fully clears
 * the viewport edge rather than stopping flush with it. */
const TRAVEL_BUFFER_PX = 40;

const motion: ChapterMotion = {
  beats(container) {
    const travelPx = Math.max(
      0,
      container.getBoundingClientRect().height -
        window.innerHeight +
        TRAVEL_BUFFER_PX,
    );
    const tl = gsap.timeline();
    tl.to(container, { y: -travelPx, ease: "none", duration: DWELL_BEATS }, 0);
    return tl;
  },
};

export default motion;
