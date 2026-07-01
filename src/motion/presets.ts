/**
 * Reusable motion factories. Each returns GSAP tween vars the engine applies.
 * Values that affect feel come from config/motion.ts, not hardcoded here.
 *
 * Beat presets (fadeInUpFrom/To, shiftUp) are used inside a chapter's beats()
 * function to build the scrubbed timeline. Use them with gsap.fromTo():
 *
 *   tl.fromTo(el, fadeInUpFrom(), fadeInUpTo());   // reveal
 *   tl.to(el, shiftUp(), "<");                     // shift while next reveals
 */
import "gsap";
import { motion as cfg } from "../config/motion";

export type MotionVars = gsap.TweenVars;

// ─── Paper presets ────────────────────────────────────────────────────────────

/** Default paper exit: slow lift then rapid acceleration off the top. */
export function flyUpAccelerate(overrides?: MotionVars): MotionVars {
  return {
    y: `-${cfg.scroll.flyUp.distance}vh`,
    ease: cfg.scroll.flyUp.ease,
    ...overrides,
  };
}

/** Paper entering from below into resting position. */
export function paperRise(overrides?: MotionVars): MotionVars {
  return {
    y: "0%",
    ease: "power2.out",
    ...overrides,
  };
}

/** Content fading in, optionally delayed relative to its paper. */
export function fadeIn(options?: { delay?: number } & MotionVars): MotionVars {
  const { delay = 0, ...rest } = options ?? {};
  return {
    opacity: 1,
    ease: "power1.out",
    delay,
    ...rest,
  };
}

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
