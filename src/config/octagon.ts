// ─── Mat wobble ───────────────────────────────────────────────────────────────
//
// Vertex homes are no longer stored here — they are derived at runtime from the
// --mat-safe-inset-* CSS tokens (see octagon.ts). This file only holds the
// timing and motion-magnitude values GSAP needs.
//
// Invariant: motionRadius <= every --mat-safe-inset-* value.
// If you tighten an inset below motionRadius, edge clipping returns.

export interface OctagonMotion {
  motionRadius: number; // px — radius of the random-wander circle per vertex
  defaultSpeed: number; // seconds — nominal duration of each wander leg
  edgeCurve: number; // fraction of the relevant side — bezier handle length for center points
}

export const octagonShape: OctagonMotion = {
  motionRadius: 12, // px  (safe-inset-x is 20px, so 10px clears with room)
  defaultSpeed: 4, // a smaller number will be faster (1 = fast; 10 = medium)
  edgeCurve: 0.035, // 3.5% of side → ~35px handles at 1000 px wide, ~24.5 px tall
};
