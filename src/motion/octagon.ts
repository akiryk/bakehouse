/**
 * Ambient mat wobble — continuous, independent of scroll.
 *
 * Each vertex drifts smoothly and continuously around its base position using
 * a looping GSAP tween (sine.inOut, yoyo). Vertices run slightly out of phase
 * via evenly distributed delays — no randomness per frame.
 *
 * Base positions (% of mat box) and drift radii (px) come from
 * config/motion.ts → octagonShape. On each tick a clip-path: polygon() string
 * is written to the mat div. Drift in px keeps the breathing visually even
 * regardless of aspect ratio.
 * Honors prefers-reduced-motion: holds the shape still when requested.
 */

import gsap from "gsap";
import { octagonShape } from "../config/motion";

export function initOctagonWobble(): void {
  const mat = document.getElementById("midground-mat") as HTMLElement | null;
  if (!mat) return;

  // Pull vertices in polygon draw order (object key insertion order, which
  // matches the clockwise layout declared in config/motion.ts).
  const entries = Object.entries(octagonShape.vertices) as [
    string,
    { x: number; y: number; drift?: number },
  ][];

  const { defaultDrift, defaultSpeed } = octagonShape;

  // Home positions in % — fixed. Mutable pixel offsets animated by GSAP.
  const homes = entries.map(([, v]) => ({ x: v.x, y: v.y }));
  const working = entries.map(() => ({ dx: 0, dy: 0 }));

  // Debug dots — one 2px square per vertex, fixed above the mat.
  const dots = entries.map(() => {
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;width:5px;height:5px;background:#a30513;z-index:1000;pointer-events:none;";
    document.body.appendChild(el);
    return el;
  });

  function writeClipPath(): void {
    const points = working
      .map(
        (w, i) =>
          `calc(${homes[i].x}% + ${w.dx.toFixed(2)}px) ` +
          `calc(${homes[i].y}% + ${w.dy.toFixed(2)}px)`,
      )
      .join(", ");
    mat!.style.clipPath = `polygon(${points})`;

    // Keep dots in sync with the vertices.
    const r = mat!.getBoundingClientRect();
    working.forEach((w, i) => {
      const x = r.left + (homes[i].x / 100) * r.width + w.dx - 1;
      const y = r.top + (homes[i].y / 100) * r.height + w.dy - 1;
      dots[i].style.left = `${x.toFixed(2)}px`;
      dots[i].style.top = `${y.toFixed(2)}px`;
    });
  }

  // Write rest positions immediately (correct for reduced-motion, and avoids
  // a single-frame flash if the matchMedia branch is slow to initialise).
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

      // Distribute delays evenly across the cycle so vertices are always
      // out of phase without relying on Math.random().
      const phaseStep = defaultSpeed / entries.length;

      // Explicit 2D drift directions — one per vertex, in the same clockwise
      // order as the config (upperLeft → … → centerLeft).
      // Both components are always meaningfully non-zero so every vertex
      // drifts diagonally, never purely side-to-side or up-and-down.
      // Values are unit-ish fractions; actual displacement = fraction × drift px.
      const DRIFT_DIRS: readonly [number, number][] = [
        [0.65, 0.76], // upperLeft    — right and down (inward)
        [0.0, 0.9], // upperCenter  — mostly down (edge bows inward)
        [-0.65, 0.76], // upperRight   — left and down (inward)
        [-0.9, 0.2], // centerRight  — mostly left, slight down (inward)
        [-0.65, -0.76], // lowerRight   — left and up (inward)
        [0.0, -0.9], // lowerCenter  — mostly up (edge bows inward)
        [0.65, -0.76], // lowerLeft    — right and up (inward)
        [0.9, -0.2], // centerLeft   — mostly right, slight up (inward)
      ];

      entries.forEach(([, base], i) => {
        const drift = base.drift ?? defaultDrift;
        const [fx, fy] = DRIFT_DIRS[i];

        gsap.to(working[i], {
          dx: fx * drift,
          dy: fy * drift,
          duration: defaultSpeed,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: i * phaseStep,
          onUpdate: writeClipPath,
        });
      });
    },
  );
}
