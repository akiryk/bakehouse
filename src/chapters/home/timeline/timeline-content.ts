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
}

/** Smart default for a project's dwell — override per project via dwellBeats. */
export const DEFAULT_DWELL_BEATS = 3;

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
  },
  {
    year: 2008,
    title: "Carnival Cruise Lines",
    description: "I led a major redesign effort for the Carnival website.",
    image: "/timeline/2008-carnival.png",
    size: "small",
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
  1995: "Build first-generation sites for non-profits around SF Bay Area",
  1997: "Study interaction design at California College of the Arts",
  2003: "Lead design at a small product studio",
  2016: "Bakehouse Studio opens in Durango",
};
