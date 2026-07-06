/**
 * Scroll engine — reads a page's chapter list and builds scroll-driven timelines
 * for fly-aways, midground color morphs, and intra-chapter beats.
 *
 * Architecture:
 *   - Visual layers (midground + papers) are position:fixed — they stay in the viewport.
 *   - A scroll spacer appended to <body> gives the page real scrollable height.
 *   - ScrollTrigger scrubs each chapter's timeline via native scroll.
 *   - No wheel/touch interception; reduced-motion collapses to a static page.
 *
 * Scroll geometry (computed per-chapter, beats before fly-away):
 *   For each chapter:
 *     1. Beats dwell  — chapter is pinned (fixed layers do this implicitly);
 *                       beats timeline is scrubbed over this range.
 *     2. Fly-away     — paper element animated off the top; next chapter revealed.
 *   Color morph between chapter[i] and chapter[i+1] is scrubbed across chapter[i]'s
 *   fly-away window using a gsap.utils.interpolate proxy (not @property).
 *
 * Color morph technique:
 *   A proxy object { t: 0 } is tweened 0→1 with scrub. onUpdate calls
 *   gsap.utils.interpolate(colorA, colorB)(proxy.t) and writes the result to
 *   --color-midground on :root. --color-nav-text is var(--color-midground) so
 *   the nav tracks for free.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { PageConfig } from "../config/pages";
import type { MotionVars } from "./presets";
import {
  vhPerBeat,
  minBeatPx,
  beatPx,
  chapterExitBeats,
  endRestBeats,
} from "../config/scroll";
import type { BeatModel, ChapterBeats, ScheduledEvent } from "./beat-model";

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
  /** Fly-away tween vars. Omit for chapters with no paper exit (e.g. paperless last chapter). */
  paper?: MotionVars;
  /** Content track tween vars (optional, rides with paper by default). */
  content?: MotionVars;
  /** Builds the scrubbed beats timeline. Receives the [data-chapter] element. */
  beats?: BeatsFn;
  /**
   * How many beats this chapter's dwell window occupies.
   * Works with or without a `beats` function — set this alone to hold the chapter
   * static for extra scroll distance before the fly-away begins.
   * Default when `beats` is present: 1. Default otherwise: 0.
   */
  durationBeats?: number;
  /**
   * Resolved event schedule for this chapter, built by resolveSchedule(SCRIPT)
   * in the chapter's motion.ts. Omit for scriptless chapters.
   * The engine includes this in the BeatModel without ever touching script.ts.
   */
  schedule?: ScheduledEvent[];
}

// ─── Scroll geometry ──────────────────────────────────────────────────────────

/** Default midground CSS property name */
const DEFAULT_MIDGROUND = "--midground-tan";

// ─── Internal types ───────────────────────────────────────────────────────────

interface ChapterSlot {
  beatStart: number; // vh offset where beats begin
  beatEnd: number; // vh offset where beats end
  flyStart: number; // vh offset where fly-away begins
  flyEnd: number; // vh offset where fly-away ends
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

/**
 * Compute each chapter's scroll slot.
 * Order: beats dwell first, then fly-away (so the chapter dwells while content
 * plays, then exits to reveal the next).
 *
 * Internally accumulates in beats, then converts to vh at the edge.
 * All timing derives from config/scroll.ts — no independent vh literals.
 */
function computeSlots(motions: ChapterMotion[]): {
  slots: ChapterSlot[];
  totalVH: number;
} {
  let cursorBeats = 0;
  const slots: ChapterSlot[] = motions.map((m) => {
    const beatDurationBeats = m.durationBeats ?? (m.beats ? 1 : 0);

    const beatStartBeats = cursorBeats;
    const beatEndBeats = cursorBeats + beatDurationBeats;
    cursorBeats = beatEndBeats;

    const flyDurationBeats = m.paper ? chapterExitBeats : 0;
    const flyStartBeats = cursorBeats;
    const flyEndBeats = cursorBeats + flyDurationBeats;
    cursorBeats = flyEndBeats;

    // Convert to vh for ScrollTrigger (beats × vhPerBeat).
    return {
      beatStart: beatStartBeats * vhPerBeat,
      beatEnd: beatEndBeats * vhPerBeat,
      flyStart: flyStartBeats * vhPerBeat,
      flyEnd: flyEndBeats * vhPerBeat,
    };
  });
  return { slots, totalVH: (cursorBeats + endRestBeats) * vhPerBeat };
}

// ─── Beat model ───────────────────────────────────────────────────────────────

/**
 * Assemble the public BeatModel from computed slots.
 * All beat values are chapter-relative (each chapter starts at 0).
 * Called once, immediately after computeSlots — before any GSAP setup.
 */
function buildModel(
  slots: ChapterSlot[],
  totalVH: number,
  motions: ChapterMotion[],
  chapterIds: string[],
): BeatModel {
  const chapters: ChapterBeats[] = slots.map((slot, i) => {
    const beatWindowBeats = (slot.beatEnd - slot.beatStart) / vhPerBeat;
    const flyBeats = (slot.flyEnd - slot.flyStart) / vhPerBeat;
    return {
      id: chapterIds[i] ?? `ch${i + 1}`,
      index: i,
      startBeat: 0,
      endBeat: beatWindowBeats,
      exitBeat: beatWindowBeats + flyBeats,
      schedule: motions[i]?.schedule ?? [],
      scrollVH: {
        beatStart: slot.beatStart,
        beatEnd: slot.beatEnd,
        flyStart: slot.flyStart,
        flyEnd: slot.flyEnd,
      },
    };
  });
  return { vhPerBeat, minBeatPx, beatPx, totalVH, chapters };
}

// ─── Color resolution ─────────────────────────────────────────────────────────

function resolveColor(prop: string): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue(prop).trim() ||
    "#cfc6b6"
  );
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export function initScrollEngine(
  config: PageConfig,
  chapterMotions: ChapterMotion[],
): BeatModel | undefined {
  if (!config.useScrollEngine) return undefined;

  const papers = Array.from(
    document.querySelectorAll<HTMLElement>("[data-chapter]"),
  );

  const { slots, totalVH } = computeSlots(chapterMotions);

  // Assemble the public BeatModel immediately — before any GSAP setup so
  // every subsequent consumer (ruler, ?beats HUD) reads from it, not its own walk.
  const model = buildModel(
    slots,
    totalVH,
    chapterMotions,
    config.chapters.map((c) => c.id),
  );

  // Spacer gives the page real scroll height (fixed layers contribute none).
  const spacer = document.createElement("div");
  spacer.style.cssText = `height:${totalVH}vh;pointer-events:none;`;
  spacer.setAttribute("aria-hidden", "true");
  document.body.appendChild(spacer);

  const root = document.documentElement;

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

      // ── Fly-aways ──────────────────────────────────────────────────────────
      papers.forEach((paper, i) => {
        const motion = chapterMotions[i];
        if (!motion?.paper) return;
        const slot = slots[i];

        gsap.to(paper, {
          ...motion.paper,
          scrollTrigger: {
            trigger: spacer,
            start: () => vhToPx(slot.flyStart),
            end: () => vhToPx(slot.flyEnd),
            scrub: 1.5,
          },
        });
      });

      // ── Color morphs ───────────────────────────────────────────────────────
      // One morph per adjacent chapter pair, scrubbed across the outgoing
      // chapter's fly-away window. Uses a proxy so GSAP scrubs 0→1 and we
      // write the interpolated color to --color-midground via onUpdate.
      // --color-nav-text is var(--color-midground) so it tracks automatically.
      for (let i = 0; i < papers.length - 1; i++) {
        const slot = slots[i];
        if (slot.flyStart === slot.flyEnd) continue; // no fly-away, skip

        const propA = config.chapters[i]?.midground ?? DEFAULT_MIDGROUND;
        const propB = config.chapters[i + 1]?.midground ?? DEFAULT_MIDGROUND;
        const colorA = resolveColor(propA);
        const colorB = resolveColor(propB);
        if (colorA === colorB) continue;

        const lerp = gsap.utils.interpolate(colorA, colorB) as (
          t: number,
        ) => string;
        const proxy = { t: 0 };

        gsap.to(proxy, {
          t: 1,
          ease: "none",
          onUpdate() {
            root.style.setProperty("--color-midground", lerp(proxy.t));
          },
          scrollTrigger: {
            trigger: spacer,
            start: () => vhToPx(slot.flyStart),
            end: () => vhToPx(slot.flyEnd),
            scrub: 1.5,
          },
        });
      }

      // ── Beats ──────────────────────────────────────────────────────────────
      // The beats function builds a raw GSAP timeline; the engine wraps it in
      // a scrubbed ScrollTrigger so scroll progress drives the timeline.
      papers.forEach((paper, i) => {
        const motion = chapterMotions[i];
        if (!motion?.beats) return;
        const slot = slots[i];
        if (slot.beatStart === slot.beatEnd) return;

        const tl = motion.beats(paper, model.chapters[i]);
        ScrollTrigger.create({
          trigger: spacer,
          start: () => vhToPx(slot.beatStart),
          end: () => vhToPx(slot.beatEnd),
          scrub: 1.5,
          animation: tl,
        });
      });

      ScrollTrigger.refresh();
    },
  );

  return model;
}
