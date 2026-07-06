import type { ChapterMotion } from "../../../motion/engine";
import { flyUpAccelerate } from "@motion/presets";

const motion: ChapterMotion = {
  paper: flyUpAccelerate(),
  durationBeats: 0,
};

export default motion;
