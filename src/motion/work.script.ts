/**
 * Work page script — a single chapter, no inter-chapter choreography.
 *
 * dwellBeats is DERIVED from the project count, on purpose — unlike
 * home.script.ts's hand-authored timeline dwellBeats (see that file's own
 * comment for the footgun this avoids). Browse is regular and data-driven:
 * adding or removing a project must re-length the scroll automatically, or
 * it silently goes stale. Computed from projects.length + browse.ts's
 * constants, NOT by importing this chapter's own motion.ts — page scripts
 * never import a chapter's script, per page-script.ts's own scope rule.
 *
 * The trailing hold(1) is structurally required, same reasoning as
 * about.script.ts's own hold(1): the master timeline maps onto scroll
 * positions the page's real max scrollY is one viewport short of reaching,
 * so at least 1 beat of trailing dead air is needed for the last page's
 * dwell to actually be reachable at max scroll.
 */
import { definePageScript, at, chapter } from "@motion/page-script";
import { hold } from "@motion/timeline-kit";
import { browse, advancePhaseLength } from "@config/browse";
import { projects } from "../data/projects";

const rows = Math.ceil(projects.length / browse.columns);
const total =
  rows * browse.dwellBeats + (rows - 1) * advancePhaseLength(browse);

export const PAGE = definePageScript({
  sequence: [
    at(0, chapter("browse", { dwellBeats: total })),
    at(total, hold(1)),
  ],
});
