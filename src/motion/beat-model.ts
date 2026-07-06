/**
 * Public beat-model — the read-only timing API for the scroll engine.
 *
 * A single BeatModel is assembled by the engine once, immediately after
 * computeSlots, and returned from initScrollEngine. Every consumer (devtools,
 * tests, future readers) accesses timing from this model — no consumer
 * recomputes it or reaches into engine internals.
 *
 * All beat values are CHAPTER-RELATIVE (each chapter starts at beat 0).
 * The engine owns absolute vh offsets for ScrollTrigger; this is the beat view.
 */

export interface ScheduledEvent {
  /** Chapter-relative beat at which this event starts. */
  startBeat: number;
  /** Chapter-relative beat at which this event ends. */
  endBeat: number;
  /** Human-readable label, e.g. "show intro", "stop @ 2002", "travel → 2026". */
  label: string;
}

export interface ChapterBeats {
  /** Matches config.chapters[i].id */
  id: string;
  /** Array index — stable identifier across consumers. */
  index: number;
  /** Always 0; kept explicit so consumers never have to special-case this. */
  startBeat: number;
  /** End of the scripted beats window (0 for scriptless chapters). */
  endBeat: number;
  /**
   * End of the fly-away exit, in chapter-relative beats.
   * Equal to endBeat when there is no exit (last chapter, paperless chapters).
   */
  exitBeat: number;
  /** Resolved event schedule; empty array for scriptless chapters. */
  schedule: ScheduledEvent[];
  /**
   * Absolute scroll geometry for this chapter, in vh from the page origin.
   * These are the exact values the engine passes to ScrollTrigger — use them
   * for layout in devtools so positions share the engine's coordinate space.
   */
  scrollVH: {
    beatStart: number;
    beatEnd: number;
    flyStart: number;
    flyEnd: number;
  };
}

export interface BeatModel {
  vhPerBeat: number;
  minBeatPx: number;
  beatPx(win: { innerHeight: number }): number;
  /** Total page scroll height in vh — matches the engine's spacer element. */
  totalVH: number;
  chapters: ChapterBeats[];
}
