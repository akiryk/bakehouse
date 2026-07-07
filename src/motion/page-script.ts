/**
 * page-script — page-scope authoring for inter-chapter choreography.
 *
 * One master GSAP timeline scrubbed by one ScrollTrigger drives the whole page.
 * Chapters, enters, exits, morphs, and holds are placed as at() entries on that
 * master in page-absolute beats (0 = page start).
 *
 * AUTHORING  (e.g. src/pages/home.script.ts):
 *
 *   import { definePageScript, at, chapter, enter, exit } from "@motion/page-script";
 *   import { morph, hold } from "@motion/timeline-kit";
 *
 *   export const PAGE = definePageScript({
 *     sequence: [
 *       at(0,    chapter("intro")),
 *       at(0,    exit("intro",    { over: 1 })),
 *       at(0,    morph({ from: "--midground-tan", to: "--midground-sage", over: 1 })),
 *       at(2,    chapter("timeline", { dwellBeats: 14.4 })),
 *       at(16.4, hold(1)),
 *     ]
 *   });
 *
 * SCOPE RULE: page scripts place chapters and express cross-chapter motion.
 * Chapter scripts stay chapter-relative. Never import chapter storyboard files
 * (script.ts) from here — chapter dwell lengths are authored directly as
 * dwellBeats in the chapter() factory.
 *
 * UNITS: beats. 1 beat = vhPerBeat (100) viewport-heights of scroll.
 * Use at() exclusively. Keep entries chronological.
 *
 * ScrollTrigger positions must use px via arrow functions — GSAP silently drops
 * "vh" unit suffixes in start/end strings (see engine.ts for the pattern).
 */

import gsap from "gsap";
import type { Moment } from "./timeline-kit";
import type { ScheduledEvent } from "./beat-model";
import { scroll } from "../config/scroll";

// ─── Page-specific moment kinds ───────────────────────────────────────────────

/** Place a chapter's dwell window at a page beat. */
export interface ChapterMoment {
  kind: "chapter";
  /** Matches a [data-chapter] id and a ChapterMotion entry. */
  id: string;
  /** Beats to scrub the chapter's internal timeline over. */
  dwellBeats: number;
}

/** Animate a chapter's [data-chapter] paper into its resting position. */
export interface EnterMoment {
  kind: "enter-chapter";
  id: string;
  /** Duration in beats. */
  over: number;
  /** Starting tween vars. Default: y ≈ 120 vh below viewport (px, computed at runtime). */
  from?: gsap.TweenVars;
  ease?: string;
}

/**
 * Animate a chapter's [data-chapter] paper off the screen.
 * Defaults match flyUpAccelerate() from presets.
 */
export interface ExitMoment {
  kind: "exit-chapter";
  id: string;
  /** Duration in beats. */
  over: number;
  /** Destination overrides. Default: y = -flyUp.distance vh, ease = flyUp.ease. */
  to?: gsap.TweenVars;
  ease?: string;
}

/**
 * All moment kinds valid at page scope.
 * Standard timeline-kit moments (morph, hold, show, hide, etc.) plus the
 * page-specific chapter / enter-chapter / exit-chapter.
 */
export type PageMoment = Moment | ChapterMoment | EnterMoment | ExitMoment;

// ─── Sequence entries ─────────────────────────────────────────────────────────

export type PageSequenceEntry =
  | { anchor: "start" | "end"; gap: number; moments: PageMoment[] }
  | { anchor: "absolute"; beat: number; moments: PageMoment[] };

/**
 * Start these moments at an absolute page beat (0 = page start).
 * This is the only authoring style for page scripts.
 */
export function at(beat: number, ...moments: PageMoment[]): PageSequenceEntry {
  return { anchor: "absolute", beat, moments };
}

// ─── Factories ────────────────────────────────────────────────────────────────

/** Place a chapter's dwell window. dwellBeats defaults to 0 (no beats timeline). */
export function chapter(
  id: string,
  opts?: { dwellBeats?: number },
): ChapterMoment {
  return { kind: "chapter", id, dwellBeats: opts?.dwellBeats ?? 0 };
}

/** Animate a chapter's paper up from off-screen. Replaces EnterSpec. */
export function enter(
  id: string,
  opts: { over?: number; from?: gsap.TweenVars; ease?: string } = {},
): EnterMoment {
  return {
    kind: "enter-chapter",
    id,
    over: opts.over ?? 1,
    from: opts.from,
    ease: opts.ease,
  };
}

/**
 * Animate a chapter's paper off the screen. Replaces ChapterMotion.paper.
 * Defaults: y = -flyUp.distance vh, ease = flyUp.ease (power2.in), over = 1.
 */
export function exit(
  id: string,
  opts?: { over?: number; to?: gsap.TweenVars; ease?: string },
): ExitMoment {
  return {
    kind: "exit-chapter",
    id,
    over: opts?.over ?? 1,
    to: opts?.to,
    ease: opts?.ease,
  };
}

// ─── Script definition ────────────────────────────────────────────────────────

export interface PageScript {
  sequence: PageSequenceEntry[];
  totalBeats: number;
}

// ─── Walk ─────────────────────────────────────────────────────────────────────

function durationOfPage(m: PageMoment): number {
  switch (m.kind) {
    case "chapter":
      return m.dwellBeats;
    case "enter-chapter":
      return m.over;
    case "exit-chapter":
      return m.over;
    case "show":
      return m.over;
    case "hide":
      return m.over;
    case "hold":
      return m.beats;
    case "morph":
      return m.over;
    case "travel":
      return m.over;
    case "enterTape":
      return m.over;
    case "stopTimelineAt":
      return (m.approach ?? 0.75) + m.dwell;
  }
}

interface PagePlaced {
  m: PageMoment;
  start: number;
  dur: number;
}

function walkPageSequence(entries: PageSequenceEntry[]): {
  placed: PagePlaced[];
  total: number;
} {
  const placed: PagePlaced[] = [];
  let prevStart = 0;
  let prevEnd = 0;
  let total = 0;

  for (const entry of entries) {
    let start: number;
    if (entry.anchor === "absolute") {
      start = entry.beat;
    } else {
      const base = entry.anchor === "start" ? prevStart : prevEnd;
      start = Math.max(0, base + entry.gap);
    }
    let entryEnd = start;

    for (const m of entry.moments) {
      const dur = durationOfPage(m);
      placed.push({ m, start, dur });
      entryEnd = Math.max(entryEnd, start + dur);
    }

    prevStart = start;
    prevEnd = entryEnd;
    total = Math.max(total, entryEnd);
  }

  return { placed, total };
}

/** Wrap a sequence into a PageScript, computing totalBeats from the walk. */
export function definePageScript(input: {
  sequence: PageSequenceEntry[];
}): PageScript {
  const { total } = walkPageSequence(input.sequence);
  return { sequence: input.sequence, totalBeats: total };
}

// ─── Chapter placement resolution ────────────────────────────────────────────

/** Per-chapter timing extracted from a page script, used to build the BeatModel. */
export interface ChapterPlacement {
  id: string;
  /** Page-absolute beat where this chapter's dwell begins. */
  dwellStartBeat: number;
  /** Duration of the dwell window in chapter-relative beats (0 for paperless pass-through). */
  dwellBeats: number;
  /** Page-absolute beat where this chapter's exit begins. -1 if there is no exit. */
  exitStartBeat: number;
  /** Duration of the exit animation in beats. 0 if there is no exit. */
  exitBeats: number;
}

/**
 * Extract per-chapter timing from a page script.
 * The engine calls this to build its BeatModel instead of computeSlots.
 */
export function resolveChapterPlacements(
  script: PageScript,
): ChapterPlacement[] {
  const { placed } = walkPageSequence(script.sequence);

  const dwells = new Map<string, { start: number; dur: number }>();
  const exits = new Map<string, { start: number; dur: number }>();

  for (const { m, start } of placed) {
    if (m.kind === "chapter") dwells.set(m.id, { start, dur: m.dwellBeats });
    if (m.kind === "exit-chapter") exits.set(m.id, { start, dur: m.over });
  }

  return Array.from(dwells.entries()).map(([id, dwell]) => {
    const ex = exits.get(id);
    return {
      id,
      dwellStartBeat: dwell.start,
      dwellBeats: dwell.dur,
      exitStartBeat: ex?.start ?? -1,
      exitBeats: ex?.dur ?? 0,
    };
  });
}

// ─── Schedule resolution ──────────────────────────────────────────────────────

function describePageMoment(m: PageMoment): string {
  switch (m.kind) {
    case "chapter":
      return `${m.id} (${m.dwellBeats}b)`;
    case "enter-chapter":
      return `enter ${m.id}`;
    case "exit-chapter":
      return `exit ${m.id}`;
    case "show":
      return `show ${m.id}`;
    case "hide":
      return `hide ${m.id}`;
    case "hold":
      return `hold`;
    case "morph":
      return `morph ${m.from} → ${m.to}`;
    case "travel":
      return `travel → ${m.to}`;
    case "enterTape":
      return `enterTape @ ${m.at}`;
    case "stopTimelineAt":
      return `stop @ ${m.year}`;
  }
}

/**
 * Resolved flat event schedule for the page script.
 * Passed to BeatModel.pageSchedule so the ruler/HUD can display page events.
 */
export function resolvePageSchedule(script: PageScript): ScheduledEvent[] {
  const { placed } = walkPageSequence(script.sequence);
  return placed.map(({ m, start, dur }) => ({
    startBeat: +start.toFixed(4),
    endBeat: +(start + dur).toFixed(4),
    label: describePageMoment(m),
  }));
}

// ─── Master timeline compiler ─────────────────────────────────────────────────

/**
 * Compile a page script into one master GSAP timeline (in page-absolute beats).
 * The engine wraps this in a single scrubbed ScrollTrigger.
 *
 * @param script         Compiled page script.
 * @param papers         Map of chapter id → [data-chapter] element.
 * @param childTimelines Map of chapter id → chapter beats timeline (may be empty).
 */
export function compilePage(
  script: PageScript,
  papers: Map<string, HTMLElement>,
  childTimelines: Map<string, gsap.core.Timeline>,
): gsap.core.Timeline {
  const { placed } = walkPageSequence(script.sequence);
  const master = gsap.timeline({ paused: true });
  const root = document.documentElement;

  // Pre-position entering papers off-screen before the master scrub starts.
  // gsap.set fires immediately at compile time, keeping papers hidden from
  // page load without needing CSS overrides. (Same pattern as the old engine's
  // fromTo immediateRender:true — but explicit, so intent is clear.)
  for (const { m } of placed) {
    if (m.kind === "enter-chapter") {
      const paper = papers.get(m.id);
      if (paper) {
        gsap.set(paper, m.from ?? { y: window.innerHeight * 1.2 });
      }
    }
  }

  for (const { m, start } of placed) {
    switch (m.kind) {
      case "chapter": {
        const child = childTimelines.get(m.id);
        if (child && m.dwellBeats > 0) {
          master.add(child, start);
        }
        break;
      }

      case "exit-chapter": {
        const paper = papers.get(m.id);
        if (!paper) break;
        master.to(
          paper,
          {
            y: `-${scroll.flyUp.distance}vh`,
            ...(m.to ?? {}),
            ease: m.ease ?? scroll.flyUp.ease,
            duration: m.over,
          },
          start,
        );
        break;
      }

      case "enter-chapter": {
        const paper = papers.get(m.id);
        if (!paper) break;
        master.fromTo(
          paper,
          (m.from ?? { y: window.innerHeight * 1.2 }) as gsap.TweenVars,
          {
            y: 0,
            ease: m.ease ?? "power2.out",
            duration: m.over,
          },
          start,
        );
        break;
      }

      case "morph": {
        const style = getComputedStyle(root);
        const fromColor = style.getPropertyValue(m.from).trim();
        const toColor = style.getPropertyValue(m.to).trim();
        if (!fromColor || !toColor) break;
        const lerp = gsap.utils.interpolate(fromColor, toColor) as (
          t: number,
        ) => string;
        const proxy = { t: 0 };
        master.to(
          proxy,
          {
            t: 1,
            duration: m.over,
            ease: "none",
            onUpdate() {
              root.style.setProperty("--color-midground", lerp(proxy.t));
            },
          },
          start,
        );
        break;
      }

      case "hold": {
        // Dead air — advances the timeline's duration without animating anything.
        master.to({}, { duration: m.beats }, start);
        break;
      }

      case "show": {
        // Page-scope show: targets [data-el] anywhere in the document.
        const target = document.querySelector<HTMLElement>(
          `[data-el='${m.id}']`,
        );
        if (!target) break;
        master.fromTo(
          target,
          { opacity: 0, y: 24, ...(m.from as gsap.TweenVars | undefined) },
          {
            opacity: 1,
            y: 0,
            duration: m.over,
            ease: m.ease ?? "power2.out",
            ...(m.to as gsap.TweenVars | undefined),
          },
          start,
        );
        break;
      }

      case "hide": {
        const target = document.querySelector<HTMLElement>(
          `[data-el='${m.id}']`,
        );
        if (!target) break;
        master.to(
          target,
          { opacity: 0, y: -18, duration: m.over, ease: "power1.in" },
          start,
        );
        break;
      }

      default:
        // travel, enterTape, stopTimelineAt — chapter-scope moments; no-op at page scope.
        break;
    }
  }

  return master;
}
