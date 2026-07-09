// ─── Cross-page transition timing ──────────────────────────────────────────
//
// Durations/eases for the exit/enter sequence driven by Astro's ClientRouter
// lifecycle (see motion/page-transitions.ts). Kept separate from
// config/scroll.ts (which times scroll-linked chapter motion, not
// route-to-route navigation).

export const pageTransition = {
  /** How long the mat takes to expand to the viewport edges, and content to
   * fade out, on the outgoing page. Both run in parallel. */
  exitDurationMs: 350,
  exitEase: "power1.in",

  /** How long the mat takes to spring back to its idle shape on the
   * incoming page, before the paper fades in. */
  enterMatDurationMs: 450,

  /** How long the incoming page's paper takes to fade in, once the mat has
   * settled. */
  enterPaperDurationMs: 400,
  enterPaperEase: "power1.out",
};
