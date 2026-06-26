/**
 * Scroll engine — reads a page's chapter list and builds a scroll-driven timeline
 * for each chapter's enter/exit. Does nothing when useScrollEngine is false.
 *
 * The engine knows only about "things that enter and leave on scroll."
 * Papers, fly-aways, and presets are all the chapters' concern, not ours.
 *
 * Architecture:
 *   - Visual layers (midground + papers) are position:fixed — they stay in the viewport.
 *   - The engine appends a scroll spacer to body, giving the page real scrollable height.
 *   - ScrollTrigger drives each chapter's timeline via scrub, using native scroll.
 *   - No wheel/touch interception; reduced-motion collapses to a static page.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { PageConfig } from "../config/pages";
import type { MotionVars } from "./presets";

gsap.registerPlugin(ScrollTrigger);

export interface ChapterMotion {
  paper?: MotionVars;
  content?: MotionVars;
}

/** vh of scroll travel allocated to each chapter's fly-away */
const TRAVEL_PER_CHAPTER_VH = 150;
/** vh of quiet rest at the end before the page bottoms out */
const REST_VH = 100;

export function initScrollEngine(
  config: PageConfig,
  chapterMotions: ChapterMotion[]
): void {
  if (!config.useScrollEngine) return;

  // Append a spacer to provide real scroll height.
  // Fixed layers don't contribute to body height, so we need this.
  const totalVH =
    config.chapters.length * TRAVEL_PER_CHAPTER_VH + REST_VH;
  const spacer = document.createElement("div");
  spacer.style.cssText = `height:${totalVH}vh;pointer-events:none;`;
  spacer.setAttribute("aria-hidden", "true");
  document.body.appendChild(spacer);

  // Collect chapter papers in DOM order (matches config order).
  const papers = Array.from(
    document.querySelectorAll<HTMLElement>("[data-chapter]")
  );

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
        // Content is reachable as a static page — no scroll animation.
        return;
      }

      papers.forEach((paper, i) => {
        const motion = chapterMotions[i];
        if (!motion?.paper) return;

        // Each chapter occupies its own slice of scroll travel.
        // ScrollTrigger offset syntax: "top+={N}vh top" means "when a point
        // Nvh below the spacer's top reaches the viewport top."
        const startOffset = i * TRAVEL_PER_CHAPTER_VH;
        const endOffset = (i + 1) * TRAVEL_PER_CHAPTER_VH;

        gsap.to(paper, {
          ...motion.paper,
          scrollTrigger: {
            trigger: spacer,
            start: `top+=${startOffset}vh top`,
            end: `top+=${endOffset}vh top`,
            scrub: 1.5,
          },
        });
      });

      ScrollTrigger.refresh();
    }
  );
}
