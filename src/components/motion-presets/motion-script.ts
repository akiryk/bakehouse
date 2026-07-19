/**
 * Reusable motion factories for a chapter's beats() timeline. Values that affect
 * feel come from scroll-engine/config.ts or stage/config.ts, not hardcoded here.
 *
 * Used inside a chapter's beats() function to build the scrubbed timeline. Use
 * them with gsap.fromTo():
 *
 *   tl.fromTo(el, fadeInUpFrom(), fadeInUpTo());   // reveal
 *   tl.to(el, shiftUp(), "<");                     // shift while next reveals
 *
 * Paper-level motion (a chapter's own fly-away/entrance) is no longer a
 * per-chapter preset — it's authored in the page script via enter()/exit()
 * (see src/components/page-system/motion-script.ts and docs/motion.md).
 */
import "gsap";

export type MotionVars = gsap.TweenVars;

// ─── Beat presets ─────────────────────────────────────────────────────────────

/**
 * Starting state for a fade-in-from-below beat.
 * Use as the `from` argument of gsap.fromTo() / tl.fromTo().
 */
export function fadeInUpFrom(overrides?: MotionVars): MotionVars {
  return { opacity: 0, y: 40, ...overrides };
}

/**
 * Ending state for a fade-in-from-below beat.
 * Use as the `to` argument of gsap.fromTo() / tl.fromTo().
 */
export function fadeInUpTo(overrides?: MotionVars): MotionVars {
  return { opacity: 1, y: 0, ease: "power2.out", ...overrides };
}

/**
 * Shift an element upward from its current position.
 * Used to move a prior beat out of the way while the next one appears.
 * @param distance  px to move up (default 36)
 */
export function shiftUp(distance = 36, overrides?: MotionVars): MotionVars {
  return { y: `-=${distance}`, ease: "power1.inOut", ...overrides };
}
