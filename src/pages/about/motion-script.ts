/**
 * About page script — a single chapter, no inter-chapter choreography.
 *
 * No exit()/enter(): About is a dead end (nothing hands off to a next
 * chapter), and the chapter's own beats() continuously scrubs the paper's y
 * itself (see about/_chapters/about/motion-script.ts) rather than the page
 * script moving it.
 *
 * The trailing hold(1) is NOT just a cosmetic soft landing — it's
 * structurally required. The engine's ScrollTrigger maps the master
 * timeline over [0, totalBeats] onto native scroll positions [0,
 * totalBeats*vhPerBeat px], but the page's actual max scrollY is
 * exactly one viewport short of that (scrollHeight - innerHeight,
 * since the spacer is the only element contributing document height).
 * That means the last vhPerBeat=100vh (1 beat) of the master timeline can
 * never actually be reached by scrolling — you can't scroll a page "past"
 * its own last screen. home/motion-script.ts's trailing hold(1) exists for the
 * exact same reason: without at least 1 beat of trailing dead air, the
 * final ~1 beat of real content/motion is unreachable. Here, dropping
 * this below 1 was tried and measurably broke reachability — the about
 * paper's own scrub landed short of its target at max native scroll.
 */
import {
  definePageScript,
  at,
  chapter,
} from "@components/page-system/motion-script";
import { hold } from "@components/timeline/motion-script";
import { DWELL_BEATS } from "./_chapters/about/motion-script";

export const PAGE = definePageScript({
  sequence: [
    at(0, chapter("about", { dwellBeats: DWELL_BEATS })),
    at(DWELL_BEATS, hold(1)),
  ],
});
