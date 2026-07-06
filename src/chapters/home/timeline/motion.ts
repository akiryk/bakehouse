// Chapter 2 motion — paperless timeline chapter.
// All choreography lives in script.ts (the tweak file); this just compiles it.
// The engine is unchanged: beats() returns one timeline, scrubbed as usual.
import type { ChapterMotion } from "../../../motion/engine";
import { compile, resolveSchedule } from "../../../motion/timeline-kit";
import { SCRIPT } from "./script";

const motion: ChapterMotion = {
  // Total beats allocated to this chapter's dwell window — derived directly
  // from the script. Add moments and this grows automatically; change vhPerBeat
  // in config/scroll.ts and the scroll distance rescales with it.
  durationBeats: SCRIPT.totalBeats,

  // Resolved event schedule — the engine includes this in the BeatModel.
  // script.ts never knows a consumer exists; the schedule just flows out here.
  schedule: resolveSchedule(SCRIPT),

  beats(container, chapterBeats) {
    return compile(container, SCRIPT, chapterBeats);
  },
};

export default motion;
