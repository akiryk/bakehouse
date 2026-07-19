/**
 * Work-detail hero motion — shared defaults for every hero's paper/image
 * enter and exit, overridable per hero in hero-content.ts. Same spirit as
 * work-browse/config.ts: one home for the knobs, split from the content.
 *
 * A "hero" is one masked stage image, optionally with an overlaid paper.
 * Paper and image are independently timed: the paper's own exit must
 * finish before the image's exit begins (see motion-script.ts), and each
 * has its own duration/ease/fade — one might translate only, another might
 * fade as it moves.
 *
 * imageEnterEase/imageEnterBeats and imageExitEase/imageExitBeats are the
 * SAME values by default, and IMAGE_TRANSITION_VH is used as both the
 * previous hero's exit distance and this one's entrance distance (see
 * motion-script.ts) — on purpose: image N's exit and image N+1's entrance
 * must share duration, easing curve, and equal-but-opposite distance for
 * the two to stay perfectly edge-to-edge ("locked") at every instant of
 * the transition, not just at its start and end. Override these per hero
 * only in matched pairs — changing one side without the other reopens a
 * gap or overlap mid-scroll.
 */
import type { GsapEase } from "@components/timeline/motion-script";

/** vh one hero's image travels on exit/entrance — exactly one stage height,
 * so the leaving and arriving images meet edge-to-edge, not the generic
 * site-wide flyUp distance (which was never meant to line up with anything). */
export const IMAGE_TRANSITION_VH = 100;

export interface HeroMotion {
  /** Beats the hero rests before its own exit begins. */
  dwellBeats: number;
  paperEnterBeats: number;
  paperEnterEase: GsapEase;
  paperExitBeats: number;
  paperExitEase: GsapEase;
  /** true = the paper's exit also fades to 0 opacity; false = translate only. */
  paperExitFade: boolean;
  imageEnterBeats: number;
  imageEnterEase: GsapEase;
  imageExitBeats: number;
  imageExitEase: GsapEase;
  /** true = the image's exit also fades to 0 opacity; false = translate only. */
  imageExitFade: boolean;
  /**
   * Beats between the PREVIOUS hero's image beginning to leave and this
   * hero's image beginning to enter. 0 (the default) = the two cross paths
   * — this one rises into place while the previous one is still on its way
   * out, so something is always visible ("abut," no gap where neither
   * image is on screen). A larger value delays the entrance, opening up a
   * real, visible pause between them. Ignored for the first hero.
   */
  gapBeforeBeats: number;
}

export const heroDefaults: HeroMotion = {
  dwellBeats: 1.5,
  paperEnterBeats: 0.75,
  paperEnterEase: "power2.out",
  paperExitBeats: 0.6,
  paperExitEase: "power2.in",
  paperExitFade: false,
  imageEnterBeats: 1,
  imageEnterEase: "power2.inOut",
  imageExitBeats: 1,
  imageExitEase: "power2.inOut",
  imageExitFade: false,
  gapBeforeBeats: 0,
};

/** The trailing "Done" chapter's own entrance — it never exits itself. */
export const doneMotion: { enterBeats: number; enterEase: GsapEase } = {
  enterBeats: 0.6,
  enterEase: "power2.out",
};
