// Chapter 2 motion — paperless timeline chapter.
// All choreography lives in script.ts (the tweak file); this just compiles it.
// The engine is unchanged: beats() returns one timeline, scrubbed as usual.
import type { ChapterMotion } from "../../../motion/engine";
import { compile, resolveSchedule } from "../../../motion/timeline-kit";
import { SCRIPT } from "./script";

const motion: ChapterMotion = {
  // Resolved event schedule — devtools only; tree-shaken from production builds.
  schedule: import.meta.env.DEV ? resolveSchedule(SCRIPT) : undefined,

  beats(container, chapterBeats) {
    return compile(container, SCRIPT, chapterBeats);
  },
};

export default motion;
