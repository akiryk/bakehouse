export interface ChapterConfig {
  id: string;
  /** Path to the chapter's motion.ts (relative to src/chapters/) */
  motionPath: string;
}

export interface PageConfig {
  chapters: ChapterConfig[];
  useScrollEngine: boolean;
}

export const pages: Record<string, PageConfig> = {
  home: {
    useScrollEngine: true,
    chapters: [
      { id: "intro", motionPath: "home/intro/motion" },
      { id: "services", motionPath: "home/services/motion" },
      { id: "timeline", motionPath: "home/timeline/motion" },
    ],
  },
};
