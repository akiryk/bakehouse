/**
 * Scroll engine — compiles a page script into one master GSAP timeline scrubbed
 * by one ScrollTrigger.
 *
 * Architecture:
 *   - Visual layers (midground + papers) are position:fixed — they stay in the viewport.
 *   - A scroll spacer appended to <body> gives the page real scrollable height.
 *   - One ScrollTrigger scrubs one master timeline over [0, totalVH px].
 *   - No wheel/touch interception; reduced-motion collapses to a static page.
 *
 * Scroll geometry derives from the page script (home.script.ts), not from a
 * per-chapter slot accumulator. Chapter motion files supply only the beats
 * timeline function and an optional event schedule — no paper/enter/durationBeats.
 *
 * Color morph technique (handled in page-script compilePage):
 *   A proxy object { t: 0 } is tweened 0→1 with the master scrub. onUpdate calls
 *   gsap.utils.interpolate(colorA, colorB)(proxy.t) and writes the result to
 *   --color-midground on :root.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { PageConfig } from "../config/pages";
import { vhPerBeat, minBeatPx, beatPx } from "../config/scroll";
import type { BeatModel, ChapterBeats, ScheduledEvent } from "./beat-model";
import {
  compilePage,
  resolveChapterPlacements,
  resolvePageSchedule,
} from "./page-script";
import type { PageScript } from "./page-script";

gsap.registerPlugin(ScrollTrigger);

/**
 * A function that builds and returns a scrubbed beats timeline for a chapter.
 * The engine passes the chapter's ChapterBeats so the timeline can surface it
 * to devtools (e.g. the ?beats HUD) without recomputing timing.
 */
export type BeatsFn = (
  container: HTMLElement,
  chapterBeats: ChapterBeats,
) => gsap.core.Timeline;

export interface ChapterMotion {
  /** Builds the scrubbed beats timeline. Receives the [data-chapter] element. */
  beats?: BeatsFn;
  /**
   * Resolved event schedule for this chapter, built by resolveSchedule(SCRIPT)
   * in the chapter's motion.ts. Omit for scriptless chapters.
   * The engine includes this in the BeatModel without ever touching script.ts.
   */
  schedule?: ScheduledEvent[];
}

// ─── Beat model ───────────────────────────────────────────────────────────────

/**
 * Build the BeatModel from the page script's resolved chapter placements.
 * scrollVH values derive from the script — no separate slot accumulator.
 * Called once, before any GSAP setup, so all devtools consumers read from it.
 */
function buildModelFromPageScript(
  script: PageScript,
  chapterMotions: ChapterMotion[],
  chapterIds: string[],
): BeatModel {
  const placements = resolveChapterPlacements(script);
  const totalVH = script.totalBeats * vhPerBeat;

  const chapters: ChapterBeats[] = chapterIds.map((id, i) => {
    const p = placements.find((pl) => pl.id === id);
    const dwellBeats = p?.dwellBeats ?? 0;
    const exitBeats = p?.exitBeats ?? 0;

    const dwellStartVH = (p?.dwellStartBeat ?? 0) * vhPerBeat;
    const dwellEndVH = dwellStartVH + dwellBeats * vhPerBeat;
    const flyStartVH =
      p && p.exitStartBeat >= 0 ? p.exitStartBeat * vhPerBeat : dwellEndVH;
    const flyEndVH = flyStartVH + exitBeats * vhPerBeat;

    return {
      id,
      index: i,
      startBeat: 0,
      endBeat: dwellBeats,
      exitBeat: dwellBeats + exitBeats,
      schedule: chapterMotions[i]?.schedule ?? [],
      scrollVH: {
        beatStart: dwellStartVH,
        beatEnd: dwellEndVH,
        flyStart: flyStartVH,
        flyEnd: flyEndVH,
      },
    };
  });

  return {
    vhPerBeat,
    minBeatPx,
    beatPx,
    totalVH,
    chapters,
    pageSchedule: import.meta.env.DEV ? resolvePageSchedule(script) : undefined,
  };
}

// ─── Page engine ──────────────────────────────────────────────────────────────

/**
 * Page-script engine: one master GSAP timeline scrubbed by one ScrollTrigger.
 * Geometry derives from the page script; chapter motion files supply only beats
 * timelines and event schedules.
 */
export function initPageEngine(
  config: PageConfig,
  script: PageScript,
  chapterMotions: ChapterMotion[],
): BeatModel | undefined {
  if (!config.useScrollEngine) return undefined;

  // Kill any ScrollTrigger left over from a previous call. initPageEngine is
  // now re-run on every visit to a page (data-astro-rerun on the calling
  // <script> — see index.astro/about.astro), including repeat visits within
  // the same SPA session. Astro's cross-page navigation discards each page's
  // own spacer/papers (they aren't transition:persist-ed), but GSAP doesn't
  // know that — a ScrollTrigger isn't automatically killed just because its
  // trigger element left the DOM, so without this, every repeat visit to a
  // page would leave one more orphaned trigger still registered globally.
  // Nothing else in this app uses ScrollTrigger, so this is safe to do
  // unconditionally.
  ScrollTrigger.getAll().forEach((st) => st.kill());

  const papers = Array.from(
    document.querySelectorAll<HTMLElement>("[data-chapter]"),
  );
  const papersMap = new Map<string, HTMLElement>();
  config.chapters.forEach((ch, i) => {
    if (papers[i]) papersMap.set(ch.id, papers[i]);
  });

  // Assemble the public BeatModel before any GSAP setup so all devtools
  // consumers (ruler, ?beats HUD) read from it immediately.
  const model = buildModelFromPageScript(
    script,
    chapterMotions,
    config.chapters.map((c) => c.id),
  );

  const totalVH = script.totalBeats * vhPerBeat;

  // Spacer gives the page real scroll height (fixed layers contribute none).
  const spacer = document.createElement("div");
  spacer.style.cssText = `height:${totalVH}vh;pointer-events:none;`;
  spacer.setAttribute("aria-hidden", "true");
  document.body.appendChild(spacer);

  gsap.matchMedia().add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      reduced: "(prefers-reduced-motion: reduce)",
    },
    (ctx) => {
      const { reduced } = ctx.conditions as {
        motion: boolean;
        reduced: boolean;
      };

      if (reduced) {
        // Content is reachable as a static page. Jump all beats to their end
        // state so beat content is visible without animation.
        papers.forEach((paper, i) => {
          const motion = chapterMotions[i];
          if (motion?.beats) {
            const tl = motion.beats(paper, model.chapters[i]);
            tl.progress(1);
          }
        });
        return;
      }

      // vh → px conversion for ScrollTrigger positions.
      // GSAP does not support "vh" as a unit in position strings — parseFloat
      // strips the suffix and the number is treated as raw px. We convert
      // explicitly so positions are correct and resize-safe (arrow functions
      // are re-evaluated on every ScrollTrigger.refresh()).
      const vhToPx = (vh: number) => (vh * window.innerHeight) / 100;

      // Build child timelines (chapter-internal beats, chapter-relative).
      const childTimelines = new Map<string, gsap.core.Timeline>();
      config.chapters.forEach((ch, i) => {
        const motion = chapterMotions[i];
        const paper = papersMap.get(ch.id);
        if (motion?.beats && paper) {
          childTimelines.set(ch.id, motion.beats(paper, model.chapters[i]));
        }
      });

      // One master timeline compiled from the page script.
      const master = compilePage(script, papersMap, childTimelines);

      // One ScrollTrigger scrubs the entire master over the full scroll range.
      // start/end are absolute px positions — same arrow-function pattern as the
      // old engine (GSAP drops "vh" unit strings; functions are resize-safe).
      ScrollTrigger.create({
        trigger: spacer,
        start: () => 0,
        end: () => vhToPx(totalVH),
        scrub: 1.5,
        animation: master,
      });

      ScrollTrigger.refresh();
    },
  );

  return model;
}
