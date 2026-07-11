/**
 * The timeline's content — every project card and every year label, in one
 * place. Pure content data, no motion: script.ts (the tweak file) decides
 * *where in the sequence* this shows up and how it moves; this file only
 * decides *what it says*. Editing a project's wording, dwell time, size, or
 * position, or adding/removing a year note, never requires touching
 * script.ts.
 *
 * Project data transcribed from docs/epics/addendum-epic-18-content.md, with
 * two corrections against the actual files in public/timeline/ (the
 * addendum's paths didn't match):
 *   - 2011: addendum said "npr.jpg"; the real file is "2011-npr.png".
 *   - 2014: addendum said "npr-corepub.jpg" (no year prefix); the real
 *     file is "2014-npr-corepub.jpg".
 * `size` casing in the addendum was inconsistent (Medium/Large/Small/
 * medium/small) — normalized to the lowercase ProductCardSize union here.
 */
import type { ProductCardSize } from "@components/timeline/product-card/ProductCard.astro";
import type { GsapEase } from "@motion/timeline-kit";

export interface Project {
  year: number;
  title: string;
  description: string;
  /** public/ path, e.g. "/timeline/2000-winesmarts.png" — not astro:assets. */
  image: string;
  size: ProductCardSize;
  /** Beats to dwell on this year with the card shown. Default: DEFAULT_DWELL_BEATS. */
  dwellBeats?: number;
  /** Horizontal nudge off the shared card anchor, in vw. Default: 0. */
  dx?: number;
  /** Vertical nudge off the shared card anchor, in vw. Default: 0. */
  dy?: number;

  // ── Entrance (card arriving as the tape decelerates into this year) ──────
  /** Beats the entrance takes — how quickly the card appears. Default: 0.6. */
  enterOver?: number;
  /** Easing for the entrance. Default: "power2.out". */
  enterEase?: GsapEase;
  /**
   * How far below its resting position the card starts, in px — bigger
   * means it visibly travels further/rises from lower on the page before
   * settling. Default: 28.
   */
  enterFrom?: number;

  // ── Exit (card leaving as the tape resumes toward the next stop) ────────
  /**
   * Beats the exit takes. Default: whatever this stop's approach into it
   * was (timeline-sequence.ts's APPROACH_BEATS) — that default is what
   * keeps the card's exit moving at the same rate the tape resumes at
   * (see timeline-kit.ts's compile() comment on the release tween).
   * Overriding this deliberately breaks that sync; only do it if you want
   * the card to noticeably lag or lead the numbers on the way out.
   */
  exitOver?: number;
  /** Easing for the exit. Default: "power1.out" (matches the tape's own approach ease). */
  exitEase?: GsapEase;
}

/** Smart default for a project's dwell — override per project via dwellBeats. */
export const DEFAULT_DWELL_BEATS = 2;

export const PROJECTS: Project[] = [
  {
    year: 2000,
    title: "WineSmarts",
    description: "Design and branding for an educational game about wine.",
    image: "/timeline/2000-winesmarts.png",
    size: "medium",
  },
  {
    year: 2005,
    title: "Arnold Worldwide",
    description:
      "I was an art director for clients including Carnival, RadioShack, Oceanspray, Verizon, and others.",
    image: "/timeline/2005-arnold.jpg",
    size: "large",
    dx: -2, // nudge left
  },
  {
    year: 2008,
    title: "Carnival Cruise Lines",
    description: "I led a major redesign effort for the Carnival website.",
    image: "/timeline/2008-carnival.png",
    size: "small",
    dx: 4,
  },
  {
    year: 2011,
    title: "NPR",
    description:
      "I managed user experience design for NPR member stations starting in 2010.",
    image: "/timeline/2011-npr.png",
    size: "medium",
  },
  {
    year: 2014,
    title: "NPR Core Publisher",
    description: "News platform used by over 112 member stations.",
    image: "/timeline/2014-npr-corepub.jpg",
    size: "large",
  },
  {
    year: 2017,
    title: "Wayfair",
    description: 'Frontend engineer on favorites lists ("Boards").',
    image: "/timeline/2017-boards.png",
    size: "medium",
  },
  {
    year: 2021,
    title: "Wayfair Wedding Registry",
    description: "Built a new wedding registry site for Wayfair.",
    image: "/timeline/2021-registry.png",
    size: "small",
  },
  {
    year: 2025,
    title: "Gambel Custom Homes",
    description:
      "Demo site displaying my interest in motion and custom design.",
    image: "/timeline/2025-gambel.png",
    size: "medium",
  },
  {
    year: 2026,
    title: "Rainday",
    description: "Personal budget app.",
    image: "/timeline/2026-budget-tool.png",
    size: "medium",
  },
];

/**
 * Year annotations — riders that live on the tape and scroll with it. Add a
 * note to any year and it appears beside it, fading in/out at the viewport
 * edges automatically (the dissolve is a CSS mask — no choreography).
 *
 * A year should never carry both a note and a project card at the same
 * time — if it does, that's a mistake to fix here (move or reword the
 * note), not something the motion layer should try to reconcile.
 */
export const NOTES: Record<number, string> = {
  // 1995: "Started building first-generation websites for non-profits around the SF Bay Area",
  // 1998: "Enrolled in interaction design program at California College of the Arts",
  // 2003: "Lead design at a small product studio",
  // 2016: "Bakehouse Studio opens in Durango",
};
