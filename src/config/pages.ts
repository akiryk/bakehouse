export interface ChapterConfig {
  id: string;
  /** Path to the chapter's motion.ts (relative to src/chapters/) */
  motionPath: string;
  /**
   * CSS custom property name for this chapter's midground color.
   * Must be a key defined in the :root palette block in global.css.
   * Defaults to "--midground-tan" if omitted.
   * Example: "--midground-slate"
   */
  midground?: string;
}

export interface PageConfig {
  chapters: ChapterConfig[];
  useScrollEngine: boolean;
}

export const pages: Record<string, PageConfig> = {
  home: {
    useScrollEngine: true,
    chapters: [
      {
        id: "intro",
        motionPath: "home/intro/motion",
        midground: "--midground-tan",
      },
      {
        id: "services",
        motionPath: "home/services/motion",
        midground: "--midground-sage",
      },
      {
        id: "timeline",
        motionPath: "home/timeline/motion",
        midground: "--midground-slate",
      },
    ],
  },
};
