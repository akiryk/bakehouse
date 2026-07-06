/**
 * Ambient mat wobble — continuous, independent of scroll.
 *
 * Each vertex wanders randomly within a circle of radius motionRadius (px)
 * around its home. On each leg it picks a fresh random point inside the circle,
 * tweens to it, then picks another — forever. No fixed directions, no rails.
 *
 * ── Coordinate system ────────────────────────────────────────────────────────
 * The mat element is position:fixed; inset:0 — its box is always the full
 * viewport. clip-path:path() takes absolute px coordinates in that box.
 *
 * Homes are precomputed in px from two measurements cached at init and on resize:
 *   W / H  — window.innerWidth / innerHeight (no reflow)
 *   insets  — resolved via a probe <div> whose dimensions are set to the CSS
 *              vars (letting the browser resolve clamp() etc.), then measured
 *              once with getBoundingClientRect. Do NOT parseFloat a custom
 *              property — it returns the unresolved string for clamp() values.
 *
 * The per-frame wobble tick adds dx/dy offsets to the cached homes and emits a
 * path() string. It reads only from the caches — no getBoundingClientRect per
 * frame (that forces layout every frame → jank).
 *
 * On resize (debounced 100 ms), caches are recomputed and the path redrawn.
 *
 * ── Wobble model ─────────────────────────────────────────────────────────────
 * Velocity continuity at leg boundaries is controlled by two constants:
 *   LEG_EASE    — "none" (linear) = no deceleration hitch at targets.
 *                 Try "power1.in" or "sine.in" if linear feels mechanical.
 *   LEG_OVERLAP — fraction of a leg at which the next begins (0 = sequential).
 *                 0.1–0.2 blends velocity when using a non-linear ease.
 */

import gsap from "gsap";
import { octagonShape } from "../config/octagon";

// ─── Tunable constants ────────────────────────────────────────────────────────

/** Ease per leg. "none" = constant velocity, no hitch at targets. */
const LEG_EASE = "sine.in";

/**
 * Fraction of a leg's duration at which the next leg begins.
 * 0 = purely sequential. 0.1–0.2 = overlap (blends velocity with non-linear ease).
 */
const LEG_OVERLAP = 0;

/** Each leg duration = defaultSpeed × rand(1 ± VARIANCE/2). */
const LEG_SPEED_VARIANCE = 0.4;

// ─────────────────────────────────────────────────────────────────────────────

export function initOctagonWobble(): void {
  const mat = document.getElementById("midground-mat") as HTMLElement | null;
  if (!mat) return;

  const { motionRadius, defaultSpeed, edgeCurve } = octagonShape;

  // ── Measurement cache ─────────────────────────────────────────────────────
  // Updated once at init and on debounced resize. Never read during animation frames.

  let W = 0;
  let H = 0;
  let insetX = 0;
  let insetTop = 0;
  let insetBottom = 0;
  /** Bezier handle length for top/bottom center points (edgeCurve × W). */
  let handleW = 0;
  /** Bezier handle length for left/right center points (edgeCurve × H). */
  let handleH = 0;

  /**
   * Precomputed px home positions — [x, y] for each of the 8 vertices.
   * Order matches the vertex list below (upperLeft → clockwise → centerLeft).
   */
  let homes: [number, number][] = [];

  function measureAndCache(): void {
    W = window.innerWidth;
    H = window.innerHeight;

    // Resolve CSS inset vars to px using a probe element.
    // Custom-property strings (especially clamp()) cannot be parsed with parseFloat —
    // the browser returns the unresolved string. Setting a probe's dimensions to
    // those vars and reading the layout result gives the correct computed px.
    const probe = document.createElement("div");
    Object.assign(probe.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "var(--mat-safe-inset-x)",
      height: "var(--mat-safe-inset-top)",
      margin: "0",
      padding: "0",
      border: "none",
      pointerEvents: "none",
      visibility: "hidden",
    });
    document.body.appendChild(probe);
    const pr = probe.getBoundingClientRect();
    insetX = pr.width;
    insetTop = pr.height;
    probe.style.height = "var(--mat-safe-inset-bottom)";
    insetBottom = probe.getBoundingClientRect().height;
    document.body.removeChild(probe);

    // Bezier handle lengths — fraction of the relevant side, recomputed on resize.
    handleW = edgeCurve * W;
    handleH = edgeCurve * H;

    // Vertex homes in absolute px.
    // upperCenter is at 66 % of W, lowerCenter at 33 % — matching Base.astro.
    homes = [
      [insetX, insetTop], // upperLeft
      [W * 0.66, insetTop], // upperCenter
      [W - insetX, insetTop], // upperRight
      [W - insetX, H * 0.5], // centerRight
      [W - insetX, H - insetBottom], // lowerRight
      [W * 0.33, H - insetBottom], // lowerCenter
      [insetX, H - insetBottom], // lowerLeft
      [insetX, H * 0.5], // centerLeft
    ];
  }

  // ── Wobble offsets ────────────────────────────────────────────────────────
  // GSAP animates dx/dy; writeClipPath adds them to the cached home positions.

  const working = Array.from({ length: 8 }, () => ({ dx: 0, dy: 0 }));

  function writeClipPath(): void {
    // Absolute px position of vertex i, including wobble offset.
    const x = (i: number) => homes[i][0] + working[i].dx;
    const y = (i: number) => homes[i][1] + working[i].dy;
    const p = (px: number, py: number) => `${px.toFixed(2)} ${py.toFixed(2)}`;

    // Vertex index key:
    //   0 upperLeft  1 upperCenter  2 upperRight
    //   3 centerRight  4 lowerRight  5 lowerCenter
    //   6 lowerLeft  7 centerLeft
    //
    // Each edge is TWO cubic segments meeting at its center point.
    // Corner-side control points = the corner itself → sharp join (zero tangent).
    // Center-side control points = center ± handleW/H → smooth, edge-parallel tangent.
    // The handles translate rigidly with their center point's dx/dy wobble.
    const d = [
      `M ${p(x(0), y(0))}`,
      // ── top edge (→ right) ─────────────────────────────────────────────────
      `C ${p(x(0), y(0))} ${p(x(1) - handleW, y(1))} ${p(x(1), y(1))}`,
      `C ${p(x(1) + handleW, y(1))} ${p(x(2), y(2))} ${p(x(2), y(2))}`,
      // ── right edge (↓ down) ───────────────────────────────────────────────
      `C ${p(x(2), y(2))} ${p(x(3), y(3) - handleH)} ${p(x(3), y(3))}`,
      `C ${p(x(3), y(3) + handleH)} ${p(x(4), y(4))} ${p(x(4), y(4))}`,
      // ── bottom edge (← left) ──────────────────────────────────────────────
      `C ${p(x(4), y(4))} ${p(x(5) + handleW, y(5))} ${p(x(5), y(5))}`,
      `C ${p(x(5) - handleW, y(5))} ${p(x(6), y(6))} ${p(x(6), y(6))}`,
      // ── left edge (↑ up) ──────────────────────────────────────────────────
      `C ${p(x(6), y(6))} ${p(x(7), y(7) + handleH)} ${p(x(7), y(7))}`,
      `C ${p(x(7), y(7) - handleH)} ${p(x(0), y(0))} ${p(x(0), y(0))}`,
      "Z",
    ].join(" ");

    mat!.style.clipPath = `path('${d}')`;
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  // Debounced so we don't thrash on every pixel of a drag-resize.
  // Runs in both full-motion and reduced-motion contexts.

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener("resize", () => {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      measureAndCache();
      writeClipPath();
    }, 100);
  });

  // ── Initialise ────────────────────────────────────────────────────────────

  measureAndCache();

  // Assert the invariant: every inset must be >= motionRadius.
  // Violation means an outward-drifting vertex can reach the clip boundary.
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

  // Write rest positions immediately — correct for reduced-motion, and avoids
  // a flash before matchMedia initialises.
  writeClipPath();

  // ── Animation ─────────────────────────────────────────────────────────────

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
      // Reduced-motion: rest path already written above.
      // Resize handler will recompute on window size change.
      if (reduced) return;

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
      const phaseStep = defaultSpeed / homes.length;
      homes.forEach((_, i) => {
        gsap.delayedCall(i * phaseStep, () => animateVertex(i));
      });
    },
  );
}
