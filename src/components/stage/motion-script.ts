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
import { octagonShape } from "./config";

// ─── Cross-page transition controller ──────────────────────────────────────
//
// Exposed so components/page-transitions/motion-script.ts can expand the mat to fill the
// viewport on exit and spring it back to its idle shape on enter (see
// docs/epics/epic-17-*). Kept as a reassignable singleton object — rather
// than exporting the functions directly from initOctagonWobble()'s closure
// — so a module that imports { octagonController } always reaches the live
// instance regardless of import order. This is safe as a true singleton
// because the mat is transition:persist-ed and this module's init script
// only ever executes once per session (Astro doesn't re-run an inline
// script whose exact source it's already seen — see docs/motion.md).
// Before initOctagonWobble() runs, both methods are harmless no-ops.

export interface OctagonController {
  /** Tween all 8 vertices to the nearest viewport edge/corner, arriving together. */
  expandToEdges(durationMs: number): Promise<void>;
  /** Tween all 8 vertices back to their idle homes, then resume ambient wobble. */
  springToHome(durationMs: number): Promise<void>;
}

export const octagonController: OctagonController = {
  expandToEdges: async () => {},
  springToHome: async () => {},
};

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

  // Whether the ambient random-wander loop should keep scheduling new legs.
  // expandToEdges() clears this so in-flight wobble tweens stop recursing;
  // springToHome() sets it back and calls startAmbientWobble() to resume.
  // Reassigned inside the matchMedia "motion" branch below; stays a no-op
  // under reduced motion, where there's no ambient loop to resume.
  let wobbling = true;
  let startAmbientWobble: () => void = () => {};

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

    const pathValue = `path('${d}')`;
    mat!.style.clipPath = pathValue;
    // Broadcast the same live shape as a custom property so anything else
    // that wants to be clipped to "the current stage shape" (e.g. a
    // work-detail hero image) can reference it directly — one computation,
    // any number of consumers, no duplicated vertex/wobble math.
    document.documentElement.style.setProperty("--stage-clip-path", pathValue);
  }

  // ── Cross-page transition: expand / spring back ──────────────────────────
  //
  // Corners collapse fully to the viewport corner; edge-centers keep
  // whatever their free axis currently is (including in-flight wobble) and
  // only the axis facing that edge moves — "each vertex makes a beeline for
  // the nearest edge." Bezier handles (handleW/handleH) are left as-is, so
  // the mat still reads as a very-slightly-bowed near-rectangle at full
  // bleed rather than a hard rectangle — consistent with the rest of the
  // shape, not a defect.
  //
  // Targets are expressed as the FINAL working[i].dx/dy value (not a delta),
  // computed once per call from the current homes/W/H cache. Omitting an
  // axis leaves that axis's tween absent, so GSAP simply doesn't touch it —
  // it keeps whatever value it already had, frozen at the current wobble
  // position rather than snapping back to the vertex's rest home.
  type EdgeTarget = { dx?: number; dy?: number };
  function edgeTargets(): EdgeTarget[] {
    return [
      { dx: -homes[0][0], dy: -homes[0][1] }, // upperLeft   → (0, 0)
      { dy: -homes[1][1] }, // upperCenter → y=0, x frozen
      { dx: W - homes[2][0], dy: -homes[2][1] }, // upperRight  → (W, 0)
      { dx: W - homes[3][0] }, // centerRight → x=W, y frozen
      { dx: W - homes[4][0], dy: H - homes[4][1] }, // lowerRight  → (W, H)
      { dy: H - homes[5][1] }, // lowerCenter → y=H, x frozen
      { dx: -homes[6][0], dy: H - homes[6][1] }, // lowerLeft   → (0, H)
      { dx: -homes[7][0] }, // centerLeft  → x=0, y frozen
    ];
  }

  function tweenAllVertices(
    targets: EdgeTarget[],
    durationMs: number,
    ease: string,
  ): Promise<void> {
    const duration = durationMs / 1000;
    const tweens = working.map((w, i) =>
      gsap.to(w, { ...targets[i], duration, ease, onUpdate: writeClipPath }),
    );
    return Promise.all(tweens.map((t) => t.then(() => undefined))).then(
      () => undefined,
    );
  }

  function expandToEdges(durationMs: number): Promise<void> {
    wobbling = false;
    working.forEach((w) => gsap.killTweensOf(w));
    return tweenAllVertices(edgeTargets(), durationMs, "power2.inOut");
  }

  async function springToHome(durationMs: number): Promise<void> {
    working.forEach((w) => gsap.killTweensOf(w));
    const restTargets: EdgeTarget[] = working.map(() => ({ dx: 0, dy: 0 }));
    await tweenAllVertices(restTargets, durationMs, "power2.out");
    wobbling = true;
    startAmbientWobble();
  }

  octagonController.expandToEdges = expandToEdges;
  octagonController.springToHome = springToHome;

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
        // expandToEdges() clears `wobbling` and kills in-flight tweens of
        // working[i] directly — but a leg that already finished its tween
        // and is about to call scheduleNext() in this same tick hasn't been
        // killed (there's nothing to kill), so this check is what actually
        // stops the recursion from re-arming itself during a transition.
        if (!wobbling) return;

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
      // always out of phase from the first frame. Reassigned here (not just
      // called) so springToHome() can call the same function again to
      // resume the loop after a transition — re-staggering rather than
      // resuming mid-leg is a deliberate simplification, not a bug: the
      // vertices lose their exact prior phase relationship, but end up
      // staggered and out of phase again within one cycle either way.
      startAmbientWobble = () => {
        const phaseStep = defaultSpeed / homes.length;
        homes.forEach((_, i) => {
          gsap.delayedCall(i * phaseStep, () => animateVertex(i));
        });
      };
      startAmbientWobble();
    },
  );
}
