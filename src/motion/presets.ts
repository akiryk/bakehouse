/**
 * Reusable motion factories. Each returns GSAP tween vars the engine applies.
 * Values that affect feel come from config/motion.ts, not hardcoded here.
 */
import type { TweenVars } from "gsap";
import { motion as cfg } from "../config/motion";

export type MotionVars = TweenVars;

/** Default paper exit: slow lift then rapid acceleration off the top of the viewport. */
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
