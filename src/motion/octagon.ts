/**
 * Ambient mat wobble — continuous, independent of scroll.
 *
 * Each vertex wanders randomly within a circle of radius `drift` (px) around
 * its home. On each leg it picks a fresh random point inside the circle, tweens
 * to it, then picks another — forever. No fixed directions, no ping-pong rails.
 *
 * Velocity continuity at leg boundaries is controlled by two constants:
 *   LEG_EASE    — ease per leg. "none" (linear) = no deceleration hitch.
 *                 Try "power1.in" for a gentle ease-in if linear feels mechanical.
 *   LEG_OVERLAP — fraction of a leg's duration at which the next leg begins.
 *                 0 = purely sequential. 0.1–0.2 = slight overlap for smoother
 *                 transitions when using a non-linear ease.
 *
 * Base positions (% of mat box) and drift radii (px) come from
 * config/motion.ts → octagonShape. Honors prefers-reduced-motion.
 */

import gsap from "gsap";
import { octagonShape } from "../config/motion";

// ─── Tunable constants ────────────────────────────────────────────────────────
// Adjust these to change motion feel without touching the logic.

/** Ease applied to each leg. "none" = linear (no hitch at targets). */
// Alternates: try power1.in or sine.in
const LEG_EASE = "sine.in";

/**
 * When this fraction of a leg's duration remains, the next leg begins.
 * 0 = purely sequential (safe with any ease).
 * 0.1–0.2 = slight overlap (useful with non-linear eases to blend velocity).
 */
const LEG_OVERLAP = 0;

/** Duration of each leg = defaultSpeed × random in [1 - VAR/2, 1 + VAR/2]. */
const LEG_SPEED_VARIANCE = 0.4;

// ─────────────────────────────────────────────────────────────────────────────

export function initOctagonWobble(): void {
  const mat = document.getElementById("midground-mat") as HTMLElement | null;
  if (!mat) return;

  const entries = Object.entries(octagonShape.vertices) as [
    string,
    { x: number; y: number; drift?: number },
  ][];

  const { defaultDrift, defaultSpeed } = octagonShape;

  // Home positions in % — fixed. Mutable pixel offsets animated by GSAP.
  const homes = entries.map(([, v]) => ({ x: v.x, y: v.y }));
  const working = entries.map(() => ({ dx: 0, dy: 0 }));

  function writeClipPath(): void {
    const points = working
      .map(
        (w, i) =>
          `calc(${homes[i].x}% + ${w.dx.toFixed(2)}px) ` +
          `calc(${homes[i].y}% + ${w.dy.toFixed(2)}px)`,
      )
      .join(", ");
    mat!.style.clipPath = `polygon(${points})`;
  }

  // Write rest positions immediately (correct for reduced-motion and avoids
  // a single-frame flash before matchMedia initialises).
  writeClipPath();

  gsap.matchMedia().add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      reduced: "(prefers-reduced-motion: reduce)",
    },
    (ctx) => {
      const { reduced } = ctx.conditions as {
        motion: boolean;
        reduced: boolean;
      };
      if (reduced) return; // rest positions already written above

      /**
       * Pick a uniformly distributed random point inside the drift circle.
       * Using sqrt(random) for the radius gives uniform area distribution
       * (without it, points cluster near the center).
       */
      function randomTarget(radius: number): { dx: number; dy: number } {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
      }

      function animateVertex(i: number): void {
        const drift = entries[i][1].drift ?? defaultDrift;
        const target = randomTarget(drift);
        const duration =
          defaultSpeed * (1 + (Math.random() - 0.5) * LEG_SPEED_VARIANCE);

        let nextScheduled = false;
        function scheduleNext() {
          if (!nextScheduled) {
            nextScheduled = true;
            animateVertex(i);
          }
        }

        const tween = gsap.to(working[i], {
          dx: target.dx,
          dy: target.dy,
          duration,
          ease: LEG_EASE,
          overwrite: "auto",
          onUpdate() {
            writeClipPath();
            if (LEG_OVERLAP > 0 && tween.progress() >= 1 - LEG_OVERLAP) {
              scheduleNext();
            }
          },
          onComplete: scheduleNext,
        });
      }

      // Stagger vertex start times evenly across one speed cycle so they
      // are always out of phase from the first moment.
      const phaseStep = defaultSpeed / entries.length;
      entries.forEach((_, i) => {
        gsap.delayedCall(i * phaseStep, () => animateVertex(i));
      });
    },
  );
}
