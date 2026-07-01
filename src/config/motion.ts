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
}

export const octagonShape: OctagonMotion = {
  motionRadius: 12, // px  (safe-inset-x is 20px, so 10px clears with room)
  defaultSpeed: 5, // a smaller number will be faster (1 = fast; 10 = medium)
};

// ─── Scroll ───────────────────────────────────────────────────────────────────

export const motion = {
  scroll: {
    flyUp: {
      ease: "power2.in",
      distance: 110, // vh — how far the paper travels off-screen
      duration: 1, // scroll-progress units (0-1)
    },
  },
};
