// Chapter 2 motion — paperless timeline chapter.
// All choreography lives in script.ts (the tweak file); this just compiles it.
// The engine is unchanged: beats() returns one timeline, scrubbed as usual.
import type { ChapterMotion } from "../../../motion/engine";
import { compile } from "../../../motion/timeline-kit";
import { SCRIPT } from "./script";

const motion: ChapterMotion = {
  // Total scroll allocated to this chapter's beats window, derived from the
  // script — add moments and the scroll length grows to match automatically.
  beatDurationVH: Math.round(SCRIPT.totalBeats * SCRIPT.config.vhPerBeat),

  beats(container) {
    return compile(container, SCRIPT);
  },
};

export default motion;
