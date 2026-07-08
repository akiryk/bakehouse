// ─── Beat unit ────────────────────────────────────────────────────────────────
//
// One beat = one viewport-height of scroll (100 vh), with a pixel floor.
// This is the app-wide unit of time. Both inter-chapter pacing and intra-chapter
// scripting derive from it — changing vhPerBeat rescales the entire app uniformly.

/** vh of scroll per beat (default 100 → 1 beat = 1 full viewport). */
export const vhPerBeat = 100;

/** Minimum px per beat — prevents a beat collapsing on very short windows. */
export const minBeatPx = 560;

/**
 * Resolve one beat to px for the given window.
 *   beatPx = max(minBeatPx, vhPerBeat/100 × window.innerHeight)
 */
export function beatPx(win: { innerHeight: number }): number {
  return Math.max(minBeatPx, (vhPerBeat / 100) * win.innerHeight);
}

// ─── Scroll motion ────────────────────────────────────────────────────────────
//
// flyUp moved from config/motion.ts — it governs scroll-driven paper exits,
// so it belongs here rather than alongside the octagon wobble config.

export const scroll = {
  flyUp: {
    ease: "power2.in",
    distance: 110, // vh — how far the paper travels off-screen
    duration: 1, // scroll-progress units (0-1)
  },
};
