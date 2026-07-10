/**
 * Home page script — inter-chapter choreography for the home page.
 *
 * Beat map:
 *   0    intro chapter (0 dwell beats)
 *   0–1  intro exits; services enters; mat morphs tan → sage
 *   1    services chapter (0 dwell beats)
 *   1–2  services exits; mat morphs sage → slate
 *   3–43.5  timeline chapter dwell (40.5 beats)
 *   43.5–44.5  trailing rest
 *
 * chapter("timeline", { dwellBeats }) MUST be kept in sync with the
 * timeline chapter's OWN script total (chapters/home/timeline/script.ts's
 * SCRIPT.totalBeats, visible via ?beats) — chapter() does NOT auto-derive
 * this from the chapter's own schedule; its real default when omitted is
 * 0, not the chapter's total. page-script.ts's own header comment
 * deliberately forbids importing a chapter's script.ts from here to
 * auto-compute it — dwellBeats is meant to be independently authored.
 * Concretely: Epic 18 grew the timeline chapter's own total from 14.4 to
 * 40.5 beats (9 project stops added), and this value was originally left
 * stale at 14.4 until caught during that epic's own verification pass — a
 * ~2.8x compression of the whole chapter's scroll-to-content mapping that
 * isn't visually obvious from a quick look, only from actually scrolling
 * through it or checking ?beats.
 */

import {
  definePageScript,
  at,
  chapter,
  enter,
  exit,
} from "@motion/page-script";
import { morph, hold } from "@motion/timeline-kit";

export const PAGE = definePageScript({
  sequence: [
    at(0, chapter("intro")),
    at(0, exit("intro", { over: 1, ease: "power4.out" })),
    at(0, morph({ from: "--palette-tan", to: "--palette-yellow", over: 1 })),
    at(0.25, enter("services", { over: 0.75, ease: "expo.out" })),
    at(2.0, exit("services", { over: 1 })),
    at(
      2.0,
      morph({ from: "--palette-yellow", to: "--palette-slate", over: 1 }),
    ),
    at(3, chapter("timeline", { dwellBeats: 40.5 })),

    at(43.5, hold(1)),
  ],
});
