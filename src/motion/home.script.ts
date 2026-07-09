/**
 * Home page script — inter-chapter choreography for the home page.
 *
 * Beat map:
 *   0    intro chapter (0 dwell beats)
 *   0–1  intro exits; services enters; mat morphs tan → sage
 *   1    services chapter (0 dwell beats)
 *   1–2  services exits; mat morphs sage → slate
 *   2–16.4  timeline chapter dwell (14.4 beats)
 *   16.4–17.4  trailing rest
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
    at(3, chapter("timeline", { dwellBeats: 14.4 })),

    at(16.4, hold(1)),
  ],
});
