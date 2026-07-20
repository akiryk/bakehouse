/**
 * Work-detail hero content — one entry per project slug, each an ordered
 * list of "heroes": a masked stage image, optionally with an overlaid
 * paper. Pure content plus per-hero motion overrides; defaults live in
 * config.ts. A slug with no entry here has no generated detail page (see
 * work/[slug].astro's getStaticPaths) — its "Learn More" link 404s until
 * content is added.
 *
 * Images live in public/work-detail/<slug>/ — referenced here by their
 * full public path, same convention as work-browse/projects-data.ts.
 */
import type { HeroMotion } from "./config";

export interface Hero {
  /** Public path, e.g. "/work-detail/winesmarts/01-hero.jpg". */
  image: string;
  /** Omit for an image-only hero (no overlaid paper). */
  paper?: {
    title: string;
    description: string;
  };
  motion?: Partial<HeroMotion>;
}

export const heroContent: Record<string, Hero[]> = {
  winesmarts: [
    {
      image: "/work-detail/winesmarts/01-hero.jpg",
      paper: {
        title: "WineSmarts",
        description:
          "Design and branding for an educational card game about wine — a scorecard, playing cards, and packaging built to feel collectible, not corporate.",
      },
    },
    {
      image: "/work-detail/winesmarts/02-box.jpg",
      // Plain default enter/exit — locks to hero 0's exit on one side and
      // hero 2's entrance on the other (same duration/ease/distance on
      // both, per config.ts's own comment on why that pairing must match).
    },
    {
      image: "/work-detail/winesmarts/03-cards.jpg",
      // The last hero: flies away quickly to reveal "Done" — a snappier
      // exit than the default, not a full-length fly-away like every
      // hero before it.
      motion: { imageExitBeats: 0.4 },
    },
  ],
};
