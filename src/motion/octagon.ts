/**
 * Ambient mat wobble — continuous, independent of scroll.
 *
 * Each vertex wanders randomly within a circle of radius motionRadius (px)
 * around its home. On each leg it picks a fresh random point inside the circle,
 * tweens to it, then picks another — forever. No fixed directions, no rails.
 *
 * Homes are derived from the --mat-safe-inset-* CSS tokens (read via
 * getComputedStyle at init) so the animated shape is identical to the static
 * clip-path in Base.astro, which uses the same tokens via CSS var(). One source,
 * no drift between pre-JS and post-JS rendering.
 *
 * Invariant: motionRadius <= every --mat-safe-inset-* value. If an inset is
 * smaller than the radius, a vertex on that edge can reach the clip boundary
 * and get cut flat. The assertion at init will warn if this is violated.
 *
 * Velocity continuity at leg boundaries is controlled by two constants:
 *   LEG_EASE    — "none" (linear) = no deceleration hitch at targets.
 *                 Try "power1.in" or "sine.in" if linear feels mechanical.
 *   LEG_OVERLAP — fraction of a leg at which the next begins (0 = sequential).
 *                 0.1-0.2 blends velocity when using a non-linear ease.
 */

import gsap from "gsap";
import { octagonShape } from "../config/motion";

// ─── Tunable constants ────────────────────────────────────────────────────────

/** Ease per leg. "none" = constant velocity, no hitch at targets. */
const LEG_EASE = "sine.in";

/**
 * Fraction of a leg's duration at which the next leg begins.
 * 0 = purely sequential. 0.1-0.2 = overlap (blends velocity with non-linear ease).
 */
const LEG_OVERLAP = 0;

/** Each leg duration = defaultSpeed * rand(1 ± VARIANCE/2). */
const LEG_SPEED_VARIANCE = 0.4;

// ─────────────────────────────────────────────────────────────────────────────

export function initOctagonWobble(): void {
  const mat = document.getElementById("midground-mat") as HTMLElement | null;
  if (!mat) return;

  // Read the safe-area inset tokens from :root at init time.
  // These are plain px values (e.g. "20px") — parseFloat extracts the number.
  const rootStyle = getComputedStyle(document.documentElement);
  const insetX =
    parseFloat(rootStyle.getPropertyValue("--mat-safe-inset-x")) || 20;
  const insetTop =
    parseFloat(rootStyle.getPropertyValue("--mat-safe-inset-top")) || 140;
  const insetBottom =
    parseFloat(rootStyle.getPropertyValue("--mat-safe-inset-bottom")) || 40;

  const { motionRadius, defaultSpeed } = octagonShape;

  // Assert the invariant: every inset must be >= motionRadius.
  // If violated, an outward-drifting vertex can reach the clip boundary.
  if (
    insetX < motionRadius ||
    insetTop < motionRadius ||
    insetBottom < motionRadius
  ) {
    console.warn(
      `[octagon] motionRadius (${motionRadius}px) exceeds a safe-area inset ` +
        `(x:${insetX}px top:${insetTop}px bottom:${insetBottom}px). ` +
        `Edge clipping may occur. Increase the inset or reduce motionRadius.`,
    );
  }

  // Vertex homes as [xAnchor%, xBaseOffset px, yAnchor%, yBaseOffset px].
  //
  // The clip-path expression for vertex i is:
  //   calc(xAnchor% + (xBaseOffset + dx)px)  calc(yAnchor% + (yBaseOffset + dy)px)
  //
  // xBaseOffset is the signed px offset that places the home from its anchor:
  //   left-edge vertices:    xAnchor=0,   xBase=+insetX   → home is insetX from left
  //   right-edge vertices:   xAnchor=100, xBase=-insetX   → home is insetX from right
  //   center (50%) vertices: xAnchor=50,  xBase=0         → home is dead-center
  //
  // Because |dx| ≤ motionRadius ≤ insetX, the expression calc(0% + ≥0px) and
  // calc(100% + ≤0px) never reaches the div edge — no clipping possible.
  const HOMES: readonly [number, number, number, number][] = [
    //  xA   xBase      yA   yBase
    [0, +insetX, 0, +insetTop], // upperLeft
    [66, 0, 0, +insetTop], // upperCenter
    [100, -insetX, 0, +insetTop], // upperRight
    [100, -insetX, 50, 0], // centerRight
    [100, -insetX, 100, -insetBottom], // lowerRight
    [33, 0, 100, -insetBottom], // lowerCenter
    [0, +insetX, 100, -insetBottom], // lowerLeft
    [0, +insetX, 50, 0], // centerLeft
  ];

  // Mutable wobble offsets — GSAP animates these, writeClipPath reads them.
  const working = HOMES.map(() => ({ dx: 0, dy: 0 }));

  function writeClipPath(): void {
    const points = HOMES.map(([xA, xBase, yA, yBase], i) => {
      const xTotal = xBase + working[i].dx;
      const yTotal = yBase + working[i].dy;
      return (
        `calc(${xA}% + ${xTotal.toFixed(2)}px) ` +
        `calc(${yA}% + ${yTotal.toFixed(2)}px)`
      );
    }).join(", ");
    mat!.style.clipPath = `polygon(${points})`;
  }

  // Write rest positions immediately — correct for reduced-motion and avoids
  // a flash before matchMedia initialises.
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
       * Pick a uniformly distributed random point inside the motionRadius circle.
       * sqrt(random) for radius gives uniform area distribution — without it,
       * points cluster near the center.
       */
      function randomTarget(): { dx: number; dy: number } {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * motionRadius;
        return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
      }

      function animateVertex(i: number): void {
        const target = randomTarget();
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

      // Stagger start times evenly across one speed cycle so vertices are
      // always out of phase from the first frame.
      const phaseStep = defaultSpeed / HOMES.length;
      HOMES.forEach((_, i) => {
        gsap.delayedCall(i * phaseStep, () => animateVertex(i));
      });
    },
  );
}
