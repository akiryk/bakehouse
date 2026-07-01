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

gsap.registerPlugin(ScrollTrigger);

/** A function that builds and returns a scrubbed beats timeline for a chapter. */
export type BeatsFn = (container: HTMLElement) => gsap.core.Timeline;

export interface ChapterMotion {
  /** Fly-away tween vars. Omit for chapters with no paper exit (e.g. paperless last chapter). */
  paper?: MotionVars;
  /** Content track tween vars (optional, rides with paper by default). */
  content?: MotionVars;
  /** Builds the scrubbed beats timeline. Receives the [data-chapter] element. */
  beats?: BeatsFn;
  /** Scroll travel (vh) allocated to the beats dwell. Default: 100. */
  beatDurationVH?: number;
}

// ─── Scroll geometry constants ────────────────────────────────────────────────

/** vh of scroll travel for a chapter's fly-away */
const TRAVEL_PER_CHAPTER_VH = 150;
/** Default vh of scroll travel for a chapter's beats dwell */
const DEFAULT_BEAT_VH = 100;
/** Quiet rest at end of page */
const REST_VH = 100;
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
 */
function computeSlots(motions: ChapterMotion[]): {
  slots: ChapterSlot[];
  totalVH: number;
} {
  let cursor = 0;
  const slots: ChapterSlot[] = motions.map((m) => {
    const beatDuration = m.beats ? (m.beatDurationVH ?? DEFAULT_BEAT_VH) : 0;
    const beatStart = cursor;
    const beatEnd = cursor + beatDuration;
    cursor = beatEnd;

    const flyDuration = m.paper ? TRAVEL_PER_CHAPTER_VH : 0;
    const flyStart = cursor;
    const flyEnd = cursor + flyDuration;
    cursor = flyEnd;

    return { beatStart, beatEnd, flyStart, flyEnd };
  });
  return { slots, totalVH: cursor + REST_VH };
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
): void {
  if (!config.useScrollEngine) return;

  const papers = Array.from(
    document.querySelectorAll<HTMLElement>("[data-chapter]"),
  );

  const { slots, totalVH } = computeSlots(chapterMotions);

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
            const tl = motion.beats(paper);
            tl.progress(1);
          }
        });
        return;
      }

      // ── Fly-aways ──────────────────────────────────────────────────────────
      papers.forEach((paper, i) => {
        const motion = chapterMotions[i];
        if (!motion?.paper) return;
        const slot = slots[i];

        gsap.to(paper, {
          ...motion.paper,
          scrollTrigger: {
            trigger: spacer,
            start: `top+=${slot.flyStart}vh top`,
            end: `top+=${slot.flyEnd}vh top`,
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
            start: `top+=${slot.flyStart}vh top`,
            end: `top+=${slot.flyEnd}vh top`,
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

        const tl = motion.beats(paper);
        ScrollTrigger.create({
          trigger: spacer,
          start: `top+=${slot.beatStart}vh top`,
          end: `top+=${slot.beatEnd}vh top`,
          scrub: 1.5,
          animation: tl,
        });
      });

      ScrollTrigger.refresh();
    },
  );
}
