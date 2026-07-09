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
 * The formula MUST include the paper's own starting distance from the
 * viewport top (its rendered `top`, e.g. from the top-32 positioning in
 * Content.astro) — an earlier version of this formula only used
 * `height - innerHeight`, which silently assumed the paper starts flush
 * with the viewport top (y=0). It doesn't, so every scroll fell exactly
 * that offset short of the true end, permanently hiding the last stretch
 * of copy — confirmed by a real user, reproduced by scrolling to the
 * measured max scrollY and finding the paper's rendered bottom still
 * below the viewport edge. rect.top (read before any transform is
 * applied) gives that offset for free from the same measurement.
 *
 * DWELL_BEATS (how much scroll the read takes) stays a hand-tuned constant
 * — re-tune it if the pacing feels off, same as any other feel value in
 * this codebase (e.g. timeline/script.ts's CONFIG.pitch). It's exported so
 * about.script.ts's chapter() placement always matches this timeline's own
 * duration instead of a second, independently-drifting copy of the number.
 *
 * Reduced motion needs an explicit check HERE, not just the generic
 * handling in engine.ts. Under reduced motion, initPageEngine jumps every
 * chapter's beats() timeline to progress(1) — correct for a normal
 * chapter, where that's its final REVEALED state, but wrong for this one:
 * the "beat" here IS the paper's reading-progress scroll, so progress(1)
 * would jump straight to the fully-scrolled end, permanently hiding the
 * beginning of the copy (confirmed visually — the page loaded mid-paragraph
 * with no way to scroll back up to the title). Returning an empty timeline
 * under reduced motion makes that progress(1) a no-op, leaving the paper at
 * its natural position with the beginning of the content visible.
 */
import gsap from "gsap";
import type { ChapterMotion } from "../../../motion/engine";

export const DWELL_BEATS = 3.5;

/** Extra px past the measured content height so the last line fully clears
 * the viewport edge rather than stopping flush with it. */
const TRAVEL_BUFFER_PX = 40;

const motion: ChapterMotion = {
  beats(container) {
    const tl = gsap.timeline();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return tl;
    }

    const rect = container.getBoundingClientRect();
    const travelPx = Math.max(
      0,
      rect.top + rect.height - window.innerHeight + TRAVEL_BUFFER_PX,
    );
    tl.to(container, { y: -travelPx, ease: "none", duration: DWELL_BEATS }, 0);
    return tl;
  },
};

export default motion;
