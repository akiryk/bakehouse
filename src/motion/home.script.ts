/**
 * Home page script — inter-chapter choreography for the home page.
 *
 * Beat map:
 *   0    intro chapter (0 dwell beats)
 *   0–1  intro exits; services enters; mat morphs tan → sage
 *   1    services chapter (0 dwell beats)
 *   1–2  services exits; mat morphs sage → slate
 *   3–41.75  timeline chapter dwell (38.75 beats)
 *   41.75–42.75  trailing rest
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
 * through it or checking ?beats. It dropped again to 38.75 when the tape's
 * entrance was converted from a dwelling stopTimelineAt (2 + 0.75 approach
 * + 3 dwell = 5.75 beats) to a non-dwelling enterTape (2 + 2 over = 4
 * beats) — same footgun, different cause: any change to the entrance or
 * to a project's dwellBeats shifts this chapter's total and must be
 * re-synced here by hand.
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
    at(3, chapter("timeline", { dwellBeats: 38.75 })),

    at(41.75, hold(1)),
  ],
});
