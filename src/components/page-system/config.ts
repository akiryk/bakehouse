import type { PaletteToken } from "@components/timeline/motion-script";

export interface ChapterConfig {
  id: string;
  /** Path to the chapter's motion-script.ts (relative to src/pages/) */
  motionPath: string;
}

export interface PageConfig {
  chapters: ChapterConfig[];
  useScrollEngine: boolean;
  /**
   * This page's resting mat color, applied once and unconditionally by
   * initPageEngine (scroll-engine/motion-script.ts) before any scroll-driven
   * morph runs — cold load, SPA navigation, and reduced motion alike. Omit
   * to use the CSS default (--palette-tan). A page's own script can still
   * morph to other colors during scroll via its own morph() moments; this
   * only sets where it starts.
   */
  matColor?: PaletteToken;
}

export const pages: Record<string, PageConfig> = {
  home: {
    useScrollEngine: true,
    chapters: [
      { id: "intro", motionPath: "home/_chapters/01-intro/motion-script" },
      {
        id: "services",
        motionPath: "home/_chapters/02-services/motion-script",
      },
      {
        id: "timeline",
        motionPath: "home/_chapters/03-timeline/motion-script",
      },
    ],
  },
  about: {
    useScrollEngine: true,
    chapters: [
      { id: "about", motionPath: "about/_chapters/about/motion-script" },
    ],
  },
  work: {
    useScrollEngine: true,
    matColor: "--palette-slate-light",
    chapters: [
      {
        id: "browse",
        motionPath: "work-browse/_chapters/browse/motion-script",
      },
    ],
  },
};
