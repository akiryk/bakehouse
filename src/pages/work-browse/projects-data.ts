/**
 * Portfolio browse content — one entry per project. Pure content, no
 * geometry/timing (that's ./config.ts); the grid/motion (later steps)
 * read this array and know nothing about its length ahead of time.
 *
 * Dummy copy, drawn loosely from the timeline chapter's existing PROJECTS
 * (pages/home/_chapters/03-timeline/timeline-content.ts) so the two don't
 * contradict each other — rewrite as designer once real case-study copy
 * exists.
 *
 * Images (epic-20 story 1 — seeding real imagery for the loading-choreography
 * baseline): several `detailHero` values, and the three `image` values that
 * were previously missing, point directly at the real, full-size photos
 * already sitting in public/timeline/ (the same files the timeline chapter
 * itself references) rather than newly-sourced or pre-shrunk files — a
 * deliberate, pragmatic reuse for now, and deliberately NOT pre-optimized:
 * the baseline this story exists to measure has to reflect realistically
 * large images, not flattering thumbnails. Revisit once real case-study
 * assets replace the dummy copy above.
 */
export interface Project {
  slug: string; // url-safe; drives /work/<slug> (Step 8)
  year: string; // e.g. "2011–2012"
  name: string; // project / client name — the bold line
  role: string; // "My Role" — e.g. "Senior Art Director"
  title: string; // the small UPPERCASE label above the description
  // (the mock's "TITLE"; the reference's "BRIEF") — NOT the project name
  description: string; // the brief body; kept short — copy is cut to fit a uniform card
  image?: string; // optional; the card renders a gray placeholder when absent (Step 5)
  /**
   * The larger hero image for /work/<slug> — distinct from `image` in
   * principle (bigger, differently cropped), even though several entries
   * below point it at the same file as `image` for now (epic-20 story 1
   * explicitly allows this). What hover-preload (a later story) warms.
   * Optional so an unseeded project degrades cleanly (no preload fires).
   */
  detailHero?: string;
}

export const projects: Project[] = [
  {
    slug: "winesmarts",
    year: "2000",
    name: "WineSmarts",
    role: "Designer",
    title: "Educational Game",
    description: "Design and branding for an educational game about wine.",
    image: "/work/thumb-winesmarts.webp",
    detailHero: "/work-detail/winesmarts/01-hero.jpg",
  },
  {
    slug: "oceanspray",
    year: "2005",
    name: "Ocean Spray",
    role: "Art Director",
    title: "Website Design",
    description:
      "Art direction for a marketing website redesign focused on a successful TV ad campaign.",
    image: "/work/thumb-oceanspray.webp",
    // No unambiguous larger photo of this specific client (2005-arnold.jpg
    // covers the whole Arnold Worldwide period, shared with `carnival`
    // below) — same file as `image` for now, per this story's own allowance.
    detailHero: "/work/thumb-oceanspray.webp",
  },
  {
    slug: "carnival",
    year: "2005–2008",
    name: "Carnival Cruise Lines",
    role: "Art Director",
    title: "Web Design",
    description:
      "Led a major redesign effort for the Carnival Cruise Lines website.",
    image: "/work/thumb-carnival-fun.webp",
    detailHero: "/timeline/2008-carnival.png",
  },
  {
    slug: "npr-donate",
    year: "2011",
    name: "NPR Digital Services",
    role: "UX Lead",
    title: "Donation Flow",
    description:
      "Managed UX design for NPR member stations' donation flow, starting in 2010.",
    image: "/work/thumb-npr-donate.webp",
    detailHero: "/timeline/2011-npr.png",
  },
  {
    slug: "npr-corepub",
    year: "2014",
    name: "NPR Core Publisher",
    role: "UX Lead",
    title: "News Platform",
    description: "News platform used by over 112 member stations.",
    image: "/timeline/2014-npr-corepub.jpg",
    detailHero: "/timeline/2014-npr-corepub.jpg",
  },
  {
    slug: "wayfair-favorites",
    year: "2017",
    name: "Wayfair",
    role: "Frontend Engineer",
    title: "Favorites Lists",
    description: 'Frontend engineer on favorites lists ("Boards").',
    image: "/work/thumb-favorites.webp",
    detailHero: "/timeline/2017-boards.png",
  },
  {
    slug: "wayfair-registry",
    year: "2021",
    name: "Wayfair Wedding Registry",
    role: "Frontend Engineer",
    title: "Registry Platform",
    description: "Built a new wedding registry site for Wayfair.",
    image: "/work/thumb-registry.webp",
    detailHero: "/timeline/2021-registry.png",
  },
  {
    slug: "gambel-homes",
    year: "2025",
    name: "Gambel Custom Homes",
    role: "Designer & Developer",
    title: "Demo Site",
    description:
      "Demo site displaying an interest in motion and custom design.",
    image: "/timeline/2025-gambel.png",
    detailHero: "/timeline/2025-gambel.png",
  },
  {
    slug: "rainday",
    year: "2026",
    name: "Rainday",
    role: "Designer & Developer",
    title: "Budget App",
    description: "Personal budget app.",
    image: "/timeline/2026-budget-tool.png",
    detailHero: "/timeline/2026-budget-tool.png",
  },
];
