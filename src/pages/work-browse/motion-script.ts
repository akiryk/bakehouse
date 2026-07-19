/**
 * Work page script — a single chapter, no inter-chapter choreography.
 *
 * dwellBeats is DERIVED from the project count, on purpose — unlike
 * home/motion-script.ts's hand-authored timeline dwellBeats (see that file's own
 * comment for the footgun this avoids). Browse is regular and data-driven:
 * adding or removing a project must re-length the scroll automatically, or
 * it silently goes stale. Computed from projects.length + browse.ts's
 * constants, NOT by importing this chapter's own motion.ts — page scripts
 * never import a chapter's script, per components/page-system/motion-script.ts's own scope rule.
 *
 * The trailing hold(1) is structurally required, same reasoning as
 * about/motion-script.ts's own hold(1): the master timeline maps onto scroll
 * positions the page's real max scrollY is one viewport short of reaching,
 * so at least 1 beat of trailing dead air is needed for the last page's
 * dwell to actually be reachable at max scroll.
 *
 * rows includes the trailing "All Done" page (totalPages()'s job) — the
 * chapter pages through every project, then one more page for that
 * message, so the scroll length needs to cover it too.
 */
import {
  definePageScript,
  at,
  chapter,
} from "@components/page-system/motion-script";
import { hold, morph } from "@components/timeline/motion-script";
import { browse, advancePhaseLength, totalPages } from "./config";
import { projects } from "./projects-data";

const rows = totalPages(projects.length, browse);
const total =
  rows * browse.dwellBeats + (rows - 1) * advancePhaseLength(browse);

export const PAGE = definePageScript({
  sequence: [
    at(0, chapter("browse", { dwellBeats: total })),
    at(total, hold(1)),
    at(
      3.5,
      morph({
        from: "--palette-slate-light",
        to: "--palette-blue",
        over: 0.5,
      }),
    ),
  ],
});
