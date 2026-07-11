/**
 * timeline-kit — authoring layer for scroll-driven timeline chapters.
 *
 * You write a SCRIPT in the chapter's script.ts. This kit compiles it into one
 * GSAP timeline; the engine scrubs it. You think in YEARS and BEATS — never
 * timeline-seconds, never pixels.
 *
 * UNITS
 *   beat   — the scroll unit. 1 beat = `vhPerBeat` viewport-heights of scroll.
 *            All `over` / `dwell` / `hold` values are in beats.
 *   pitch  — tape spacing, in vh per year (bigger pitch = years further apart).
 *   anchor — where the "current" year sits on screen, as a fraction of the
 *            viewport height (0 = top, 0.5 = center, 1 = bottom).
 *
 * ELEMENT ROLES the kit looks for inside the chapter container:
 *   [data-el="intro"]     independent block (any named block works: show/hide by id)
 *   [data-el="line"]      the vertical line — its own element, driven via show/hide
 *   [data-el="tape"]      the year strip — driven via enterTape/travel/stopTimelineAt
 *   [data-year="1996"]    a year row on the tape, containing .tl-num and .tl-tick
 *   [data-overlay="xyz"]  independent overlay content, hidden until revealed
 *
 * MOMENTS (the verbs — see factories at the bottom)
 *   show(id)/hide(id)            reveal / dismiss a [data-el] block
 *   hold(beats)                  dead air
 *   enterTape({at})              year strip rises in, `at` landing on the anchor
 *   travel({to})                 strip moves continuously until `to` is anchored
 *   stopTimelineAt(year, {...})  decelerate in, tick + brighten, reveal overlays,
 *                                dwell, auto-release as travel resumes
 *   morph({from,to})             midground color morph between palette tokens
 *
 * SEQUENCING — the `sequence` style:
 *   Write each entry as at(beat, ...moments) where beat is the absolute start
 *   in the script's own scope (0 = script start). Moments in the same entry
 *   start together; the entry's end is the end of its longest moment.
 *
 *     sequence: [
 *       at(0,    show("intro", { over: 1 })),
 *       at(0.5,  show("line",  { over: 1.5 })),
 *       at(2,    hide("intro", { over: 0.8 })),
 *     ]
 *
 *   Keep entries in chronological order for readability. Tape-moving entries
 *   (enterTape / travel / stopTimelineAt) MUST stay chronological: the walk
 *   processes entries in list order to track tape state, so an out-of-order
 *   tape entry produces wrong approach durations for stopTimelineAt.
 *
 *   Editing ripple is handled by plain TS consts in the script file:
 *     const INTRO_IN  = 0;
 *     const INTRO_OUT = INTRO_IN + 2;
 *     at(INTRO_IN,  show("intro")),
 *     at(INTRO_OUT, hide("intro")),
 *
 *   With ?beats in the URL the full resolved schedule (absolute start/end of
 *   every moment) is printed as a console table — the ground truth while tuning.
 *
 *   Deprecated: sinceStart() / sinceEnd() — relative entries still compile but
 *   are not for use in new scripts.
 *
 *   The legacy `moments` style (withPrevious/offset) still compiles.
 */

import gsap from "gsap";
import type { ScheduledEvent, ChapterBeats } from "./beat-model";

// ─── Shared authoring types ───────────────────────────────────────────────────

/**
 * GSAP built-in ease names. Add CustomEase.create() names as needed.
 * The `(string & {})` tail allows any string while preserving autocomplete.
 */
export type GsapEase =
  | "none"
  | "linear"
  | "power1.in"
  | "power1.out"
  | "power1.inOut"
  | "power2.in"
  | "power2.out"
  | "power2.inOut"
  | "power3.in"
  | "power3.out"
  | "power3.inOut"
  | "power4.in"
  | "power4.out"
  | "power4.inOut"
  | "back.in"
  | "back.out"
  | "back.inOut"
  | "bounce.in"
  | "bounce.out"
  | "bounce.inOut"
  | "circ.in"
  | "circ.out"
  | "circ.inOut"
  | "elastic.in"
  | "elastic.out"
  | "elastic.inOut"
  | "expo.in"
  | "expo.out"
  | "expo.inOut"
  | "sine.in"
  | "sine.out"
  | "sine.inOut"
  | (string & {}); // escape hatch for CustomEase names

/**
 * CSS custom property names for mat morph source colors.
 * These must be defined in the :root palette block in global.css.
 * The `(string & {})` tail allows new entries before the type is updated.
 */
export type PaletteToken =
  | "--palette-white"
  | "--palette-tan"
  | "--palette-sage"
  | "--palette-slate"
  | "--palette-brown"
  | "--palette-shadow"
  | "--palette-grey"
  | "--palette-blue"
  | "--palette-steel"
  | "--palette-blush"
  | (string & {}); // escape hatch for new palette entries

// ─── Script types ─────────────────────────────────────────────────────────────

export interface TimelineConfig {
  firstYear: number;
  lastYear: number;
  /** vh of tape per year */
  pitch: number;
  /** where the current year sits: fraction of viewport height (0.5 = center) */
  anchor: number;
  /** how far below its resting spot the tape starts, in vh (default 100) */
  enterFrom?: number;
}

interface MomentBase {
  /** legacy style: start together with the previous moment */
  withPrevious?: boolean;
  /** legacy style: nudge the start by this many beats (negative = earlier) */
  offset?: number;
}

export type Moment = MomentBase &
  (
    | {
        kind: "show";
        id: string;
        over: number;
        from?: ShowTweenVars;
        to?: ShowTweenVars;
        ease?: GsapEase;
      }
    | {
        kind: "hide";
        id: string;
        over: number;
        /** Exit-state overrides, merged into { opacity: 0, y: -18 }. */
        to?: ShowTweenVars;
        /** Easing. Default: "power1.in" */
        ease?: GsapEase;
      }
    | { kind: "hold"; beats: number }
    | {
        kind: "enterTape";
        at: number;
        over: number;
        /** vh below the final year-aligned resting position */
        fromOffset?: number;
        fromOpacity?: number;
        toOpacity?: number;
        ease?: GsapEase;
      }
    | { kind: "travel"; to: number; over: number; ease?: GsapEase }
    | {
        kind: "stopTimelineAt";
        year: number;
        /** beats the tape dwells at the year (the reading time) */
        dwell: number;
        /** beats to decelerate into the year if not already there (default 0.75) */
        approach?: number;
        /** [data-overlay] ids or per-overlay RevealSpec objects */
        reveal?: (string | RevealSpec)[];
        /** beats each reveal takes (default 0.6) */
        revealOver?: number;
        /** don't auto-hide the reveals when the tape resumes */
        persist?: boolean;
        /** beats the exit fade takes as the tape resumes (default 0.5) */
        exitOver?: number;
        /** easing for the exit fade/slide (default "power1.out") */
        exitEase?: GsapEase;
      }
    | { kind: "morph"; from: PaletteToken; to: PaletteToken; over: number }
  );

// ─── Sequence entries (the flat, explicit-timing authoring style) ────────────

export type SequenceEntry =
  | { anchor: "start" | "end"; gap: number; moments: Moment[] }
  | { anchor: "absolute"; beat: number; moments: Moment[] };

function makeEntry(
  anchor: "start" | "end",
  first: number | Moment,
  rest: Moment[],
): SequenceEntry {
  return typeof first === "number"
    ? { anchor, gap: first, moments: rest }
    : { anchor, gap: 0, moments: [first, ...rest] };
}

/**
 * Start these moments at an absolute beat (0 = start of this script's scope).
 * This is the preferred authoring model — see SEQUENCING in the file header.
 */
export function at(beat: number, ...moments: Moment[]): SequenceEntry {
  return { anchor: "absolute", beat, moments };
}

/**
 * @deprecated Use at() instead. Relative anchors still compile but are not
 * for use in new scripts.
 * TODO: candidate for removal — kept provisionally in case a use case survives
 * real-world authoring in the absolute style. Do not use in new scripts.
 */
export function sinceStart(gap: number, ...moments: Moment[]): SequenceEntry;
/** @deprecated Use at() instead. */
export function sinceStart(...moments: Moment[]): SequenceEntry;
export function sinceStart(
  first: number | Moment,
  ...rest: Moment[]
): SequenceEntry {
  return makeEntry("start", first, rest);
}

/**
 * @deprecated Use at() instead. Relative anchors still compile but are not
 * for use in new scripts.
 * TODO: candidate for removal — kept provisionally in case a use case survives
 * real-world authoring in the absolute style. Do not use in new scripts.
 */
export function sinceEnd(gap: number, ...moments: Moment[]): SequenceEntry;
/** @deprecated Use at() instead. */
export function sinceEnd(...moments: Moment[]): SequenceEntry;
export function sinceEnd(
  first: number | Moment,
  ...rest: Moment[]
): SequenceEntry {
  return makeEntry("end", first, rest);
}

export interface TimelineScript {
  config: TimelineConfig;
  /** preferred authoring style */
  sequence?: SequenceEntry[];
  /** legacy authoring style — still compiles */
  moments?: Moment[];
  /** computed by defineScript — total beats of the whole script */
  totalBeats: number;
}

// ─── Position walk (shared by measurement + compilation) ─────────────────────
// Computes each moment's absolute start time and duration, in beats.

interface Placed {
  m: Moment;
  start: number;
  dur: number;
}

type ShowTweenVars = {
  opacity?: number;
  y?: number | string;
};

/**
 * Per-overlay reveal animation spec. Use instead of a plain string id when
 * you need control over how the overlay enters.
 *
 * @example
 *   reveal: [{ id: "winesmarts", from: { opacity: 0, x: 60, y: 0 }, ease: "power1.out" }]
 */
export interface RevealSpec {
  /** [data-overlay] id */
  id: string;
  /** Initial hidden state. Default: { opacity: 0, y: 28 } */
  from?: gsap.TweenVars;
  /** Visible-state overrides, merged into { opacity: 1, y: 0 }. */
  to?: gsap.TweenVars;
  /** Duration in beats. Overrides stopTimelineAt.revealOver for this overlay. */
  over?: number;
  /** Easing. Default: "power2.out" */
  ease?: GsapEase;
}

function durationOf(m: Moment, tapeYear: number | null): number {
  switch (m.kind) {
    case "show":
    case "hide":
    case "enterTape":
    case "travel":
      return m.over;
    case "hold":
      return m.beats;
    case "morph":
      return m.over;
    case "stopTimelineAt": {
      const needsApproach = tapeYear !== m.year;
      return (needsApproach ? (m.approach ?? 0.75) : 0) + m.dwell;
    }
  }
}

/** Legacy walk for the `moments` style (withPrevious/offset). */
function walk(moments: Moment[]): { placed: Placed[]; total: number } {
  let cursor = 0; // end of the sequence so far
  let prevStart = 0;
  let tapeYear: number | null = null;

  const placed: Placed[] = moments.map((m) => {
    let start = m.withPrevious ? prevStart : cursor;
    start += m.offset ?? 0;
    if (start < 0) start = 0;

    const dur = durationOf(m, tapeYear);

    if (m.kind === "enterTape") tapeYear = m.at;
    if (m.kind === "travel") tapeYear = m.to;
    if (m.kind === "stopTimelineAt") tapeYear = m.year;

    cursor = Math.max(cursor, start + dur);
    prevStart = start;
    return { m, start, dur };
  });

  return { placed, total: cursor };
}

/** Walk for the `sequence` style (sinceStart/sinceEnd). */
function walkSequence(entries: SequenceEntry[]): {
  placed: Placed[];
  total: number;
} {
  const placed: Placed[] = [];
  let prevStart = 0;
  let prevEnd = 0;
  let tapeYear: number | null = null;
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
      const dur = durationOf(m, tapeYear);
      if (m.kind === "enterTape") tapeYear = m.at;
      if (m.kind === "travel") tapeYear = m.to;
      if (m.kind === "stopTimelineAt") tapeYear = m.year;
      placed.push({ m, start, dur });
      entryEnd = Math.max(entryEnd, start + dur);
    }

    prevStart = start;
    prevEnd = entryEnd;
    total = Math.max(total, entryEnd);
  }

  return { placed, total };
}

/** Resolve either authoring style to placed moments. */
function resolveScript(script: {
  sequence?: SequenceEntry[];
  moments?: Moment[];
}): { placed: Placed[]; total: number } {
  return script.sequence
    ? walkSequence(script.sequence)
    : walk(script.moments ?? []);
}

/** Every moment in the script, in order, regardless of authoring style. */
function allMoments(script: {
  sequence?: SequenceEntry[];
  moments?: Moment[];
}): Moment[] {
  return script.sequence
    ? script.sequence.flatMap((e) => e.moments)
    : (script.moments ?? []);
}

/**
 * Resolve a compiled script to its flat event schedule.
 *
 * Reuses the existing moment walk and describeMoment — no new timing logic.
 * Call this in a chapter's motion.ts and assign to ChapterMotion.schedule so
 * the engine can include it in the BeatModel without reaching into script.ts.
 *
 * @example
 *   schedule: resolveSchedule(SCRIPT)
 */
export function resolveSchedule(script: {
  sequence?: SequenceEntry[];
  moments?: Moment[];
}): ScheduledEvent[] {
  const { placed } = resolveScript(script);
  return placed.map(({ m, start, dur }) => ({
    startBeat: +start.toFixed(4),
    endBeat: +(start + dur).toFixed(4),
    label: describeMoment(m),
  }));
}

/** Wrap a config + storyboard into a script, computing its total length. */
export function defineScript(input: {
  config: TimelineConfig;
  sequence?: SequenceEntry[];
  moments?: Moment[];
}): TimelineScript {
  return { ...input, totalBeats: resolveScript(input).total };
}

// ─── Compiler ─────────────────────────────────────────────────────────────────

/** tape translateY (vh) that puts `year` on the anchor line */
function yFor(cfg: TimelineConfig, year: number): number {
  return cfg.anchor * 100 - (year - cfg.firstYear) * cfg.pitch;
}

function resolveStageColor(
  stage: Element,
  prop: string,
  fallback: string,
): string {
  const v = getComputedStyle(stage).getPropertyValue(prop).trim();
  return v || fallback;
}

function describeMoment(m: Moment): string {
  switch (m.kind) {
    case "show":
    case "hide":
      return `${m.kind} ${m.id}`;
    case "hold":
      return "hold";
    case "enterTape":
      return `enterTape @ ${m.at}`;
    case "travel":
      return `travel → ${m.to}`;
    case "stopTimelineAt":
      return `stop @ ${m.year}`;
    case "morph":
      return `morph ${m.from} → ${m.to}`;
  }
}

function normalizeReveal(r: string | RevealSpec): RevealSpec {
  return typeof r === "string" ? { id: r } : r;
}

/**
 * Compile a script into a single GSAP timeline (in beat units).
 * The engine wraps it in a scrubbed ScrollTrigger — no engine changes needed.
 *
 * @param chapterBeats  When supplied by the engine, the ?beats table reads from
 *                      it rather than recomputing the walk — proving the model
 *                      is the single source of truth.
 */
export function compile(
  container: HTMLElement,
  script: TimelineScript,
  chapterBeats?: ChapterBeats,
): gsap.core.Timeline {
  const { config } = script;
  const el = <T extends HTMLElement>(sel: string) =>
    container.querySelector<T>(sel);

  const tape = el("[data-el='tape']");
  if (!tape) {
    console.warn("timeline-kit: no [data-el='tape'] found — empty timeline.");
    return gsap.timeline();
  }

  // Park the tape at its pre-entrance position (works for both script styles).
  // Based on yFor(firstYear) — the tape's own topmost/largest translateY,
  // reached at zero row-offset — not on the landing year's own restY. Using
  // restY was a real bug: for a landing year close to firstYear (e.g. 1997,
  // only 4 years in), restY is already close to its on-screen resting value,
  // so restY + fromOffset could land the tape only partway below the
  // viewport instead of fully offscreen — early rows (1993-1995) were
  // visible peeking in before the entrance ever started. yFor(firstYear) is
  // always >= any other yFor(year) in range (row-offset only grows with
  // later years), so parking fromOffset below THAT guarantees every row,
  // including the very first one, starts below the viewport regardless of
  // which year enterTape happens to land on.
  const firstEnterTape = allMoments(script).find(
    (m): m is Extract<Moment, { kind: "enterTape" }> => m.kind === "enterTape",
  );

  if (firstEnterTape) {
    const topY = yFor(config, config.firstYear);
    const fromOffset = firstEnterTape.fromOffset ?? config.enterFrom ?? 100;

    gsap.set(tape, {
      y: `${topY + fromOffset}vh`,
      opacity: firstEnterTape.fromOpacity ?? 1,
    });
  }

  // Colors for the year highlight, styleable from CSS on the stage element.
  const stage = el("[data-el='stage']") ?? container;
  const yearMuted = resolveStageColor(
    stage,
    "--color-tl-year",
    "rgba(255,255,255,0.35)",
  );
  const yearActive = resolveStageColor(
    stage,
    "--color-tl-year-active",
    "#ffffff",
  );

  // Overlays: all start hidden. Per-reveal custom `from` states are applied
  // after resolveScript so the initial state matches the tween's from exactly.
  //
  // pointerEvents: "none" here matters beyond visuals: every overlay shares
  // one on-screen anchor (only one is ever meant to be visible at a time),
  // so without this, the 8 invisible-but-still-hit-testable siblings behind
  // whichever one is actually showing would silently win DevTools' element
  // picker and swallow text selection/clicks — opacity:0 alone doesn't
  // remove an element from hit-testing. Each stopTimelineAt flips this back
  // to "auto" for the duration its own overlay is actually shown (see the
  // reveal/release blocks below) via explicit tl.set() calls rather than
  // relying on GSAP's own timing for non-tweened properties in a .to()/
  // .fromTo() vars object, which isn't something to depend on implicitly.
  const overlays = Array.from(
    container.querySelectorAll<HTMLElement>("[data-overlay]"),
  );
  gsap.set(overlays, { opacity: 0, y: 28, pointerEvents: "none" });

  const { placed } = resolveScript(script);

  // Override default hidden state for any overlay whose RevealSpec has a custom from.
  for (const { m } of placed) {
    if (m.kind !== "stopTimelineAt" || !m.reveal) continue;
    for (const r of m.reveal) {
      if (typeof r !== "string" && r.from) {
        const overlay = el(`[data-overlay='${r.id}']`);
        if (overlay) gsap.set(overlay, r.from);
      }
    }
  }

  // ?beats: print the resolved schedule — absolute start/end of every moment.
  // Reads from chapterBeats.schedule (the BeatModel) when supplied by the engine;
  // falls back to the local walk so compile() stays usable standalone in tests.
  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("beats")
  ) {
    const rows = chapterBeats
      ? chapterBeats.schedule.map((e) => ({
          start: +e.startBeat.toFixed(2),
          end: +e.endBeat.toFixed(2),
          what: e.label,
        }))
      : placed.map(({ m, start, dur }) => ({
          start: +start.toFixed(2),
          end: +(start + dur).toFixed(2),
          what: describeMoment(m),
        }));
    const label = chapterBeats
      ? `[beats] chapter ${chapterBeats.id}`
      : "[beats]";
    console.group(label);
    console.table(rows);
    console.groupEnd();
  }

  // Pre-hide every element that will be shown via a `show` moment.
  // GSAP's fromTo has immediateRender:false by default — the `from` state is NOT
  // applied until the playhead reaches that position. Before that, the element is
  // in its HTML/CSS state (visible). This gsap.set fires immediately when compile()
  // is called (before any ScrollTrigger), so elements start hidden and only become
  // visible when the scrub reaches their moment's start position.
  // Same pattern as the overlays block above.
  for (const { m } of placed) {
    if (m.kind === "show") {
      const target = el(`[data-el='${m.id}']`);
      if (target) gsap.set(target, { opacity: 0, y: 24, ...m.from });
    }
  }

  const tl = gsap.timeline();
  let tapeYear: number | null = null;

  for (const { m, start, dur } of placed) {
    switch (m.kind) {
      case "show": {
        const target = el(`[data-el='${m.id}']`);
        if (!target) break;

        tl.fromTo(
          target,
          { opacity: 0, y: 24, ...m.from },
          {
            opacity: 1,
            y: 0,
            duration: m.over,
            ease: m.ease ?? "power2.out",
            ...m.to,
          },
          start,
        );

        break;
      }

      case "hide": {
        const target = el(`[data-el='${m.id}']`);
        if (!target) break;
        tl.to(
          target,
          {
            opacity: 0,
            y: -18,
            duration: m.over,
            ease: m.ease ?? "power1.in",
            ...m.to,
          },
          start,
        );
        break;
      }

      case "hold": {
        tl.to({}, { duration: m.beats }, start);
        break;
      }

      case "enterTape": {
        const restY = yFor(config, m.at);

        tl.to(
          tape,
          {
            y: `${restY}vh`,
            opacity: m.toOpacity ?? 1,
            duration: m.over,
            ease: m.ease ?? "power2.out",
          },
          start,
        );

        tapeYear = m.at;
        break;
      }

      case "travel": {
        tl.to(
          tape,
          {
            y: `${yFor(config, m.to)}vh`,
            duration: m.over,
            ease: m.ease ?? "none", // constant tape speed by default
          },
          start,
        );
        tapeYear = m.to;
        break;
      }

      case "stopTimelineAt": {
        const approach = tapeYear !== m.year ? (m.approach ?? 0.75) : 0;
        const tArrive = start + approach;
        const tRelease = start + dur; // end of dwell — tape resumes here
        const revealOver = m.revealOver ?? 0.6;
        const exitOver = m.exitOver ?? 0.5;
        const exitEase = m.exitEase ?? "power1.out";

        if (approach > 0) {
          tl.to(
            tape,
            {
              y: `${yFor(config, m.year)}vh`,
              duration: approach,
              ease: "power1.out", // decelerate into the stop
            },
            start,
          );
        }

        const row = el(`[data-year='${m.year}']`);
        const num = row?.querySelector<HTMLElement>(".tl-num") ?? null;
        const tick = row?.querySelector<HTMLElement>(".tl-tick") ?? null;

        // Highlight on: tick draws, numeral brightens.
        if (tick)
          tl.fromTo(
            tick,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 0.35,
              ease: "power2.out",
              immediateRender: false,
            },
            tArrive,
          );
        if (num) tl.to(num, { color: yearActive, duration: 0.35 }, tArrive);

        // Reveals, slightly staggered.
        (m.reveal ?? []).forEach((r, i) => {
          const spec = normalizeReveal(r);
          const overlay = el(`[data-overlay='${spec.id}']`);
          if (!overlay) return;
          const tShow = tArrive + 0.1 + i * 0.15;
          // Discrete flip, not tweened — see the pointerEvents comment on
          // the initial gsap.set() above. Placed at the same beat as this
          // overlay's own reveal starts, not tArrive itself, so a
          // still-hidden (opacity near 0) card doesn't briefly intercept
          // hits meant for whatever it's about to replace.
          tl.set(overlay, { pointerEvents: "auto" }, tShow);
          tl.fromTo(
            overlay,
            spec.from ?? { opacity: 0, y: 28 },
            {
              opacity: 1,
              y: 0,
              ...spec.to,
              duration: spec.over ?? revealOver,
              ease: spec.ease ?? "power2.out",
            },
            tShow,
          );
        });

        // Release: exits overlap the start of whatever comes next, so
        // content animates away exactly as the years begin scrolling again.
        // ease defaults to matching the tape's own approach-into-the-next-
        // stop tween (power1.out, above) rather than power1.in — with
        // matching ease *and* matching duration (callers default exitOver
        // to the next stop's approach, e.g. timeline-sequence.ts's
        // APPROACH_BEATS for both), the card moves away at the same rate
        // the numbers resume at, instead of the numbers visibly outrunning
        // a slow, barely-moving card. Both exitOver and exitEase are
        // per-stop overrides (see stopTimelineAt's options) — overriding
        // exitOver away from the next stop's approach re-introduces that
        // mismatch, so change it deliberately, not by accident.
        //
        // y: -70vh, not a small nudge — matching duration/ease alone still
        // read as "the card barely moves" (a ~28px nudge is nothing next to
        // the tape sweeping a whole approach's worth of years). -70vh moves
        // the card's own center from the 50vh anchor to -20vh — comfortably
        // off the top of the viewport by the time the tween ends — putting
        // it in the same visual ballpark as how far the tape itself travels
        // over one approach (commonly several hundred px, same duration),
        // so the two read as leaving together instead of the numbers
        // visibly outrunning an almost-stationary, merely-fading card.
        if (!m.persist) {
          (m.reveal ?? []).forEach((r) => {
            const spec = normalizeReveal(r);
            const overlay = el(`[data-overlay='${spec.id}']`);
            if (!overlay) return;
            tl.to(
              overlay,
              {
                opacity: 0,
                y: "-70vh",
                duration: exitOver,
                ease: exitEase,
              },
              tRelease,
            );
            // Flips back off once the exit has visually finished (not at
            // tRelease, when it starts) — the card stays hit-testable for
            // the whole visible fade-out, only stepping aside once it's
            // actually gone, matching the pointerEvents:"auto" set above.
            tl.set(overlay, { pointerEvents: "none" }, tRelease + exitOver);
          });
        }
        if (tick)
          tl.to(
            tick,
            { scaleX: 0, duration: exitOver, ease: "power1.in" },
            tRelease,
          );
        if (num) tl.to(num, { color: yearMuted, duration: exitOver }, tRelease);

        tapeYear = m.year;
        break;
      }

      case "morph": {
        const root = document.documentElement;
        const style = getComputedStyle(root);
        const from = style.getPropertyValue(m.from).trim();
        const to = style.getPropertyValue(m.to).trim();
        if (!from || !to) break;
        const lerp = gsap.utils.interpolate(from, to) as (t: number) => string;
        const proxy = { t: 0 };
        tl.to(
          proxy,
          {
            t: 1,
            duration: m.over,
            ease: "none",
            onUpdate() {
              root.style.setProperty("--color-mat", lerp(proxy.t));
            },
          },
          start,
        );
        break;
      }
    }
  }

  attachDebugHud(container, tl, config, chapterBeats);
  return tl;
}

// ─── Debug HUD (?beats) ───────────────────────────────────────────────────────
// Append ?beats to the URL for a live readout of the playhead (in beats) and
// the year currently on the anchor. The full resolved schedule is also printed
// to the console as a table (see compile()).

function attachDebugHud(
  container: HTMLElement,
  tl: gsap.core.Timeline,
  cfg: TimelineConfig,
  chapterBeats?: ChapterBeats,
): void {
  if (typeof window === "undefined") return;
  if (!new URLSearchParams(window.location.search).has("beats")) return;

  const hud = document.createElement("div");
  hud.style.cssText =
    "position:fixed;left:12px;bottom:12px;z-index:9999;padding:6px 10px;" +
    "font:12px/1.4 monospace;background:rgba(0,0,0,.7);color:#fff;" +
    "border-radius:4px;pointer-events:none;";
  document.body.appendChild(hud);

  const tape = container.querySelector<HTMLElement>("[data-el='tape']");
  tl.eventCallback("onUpdate", () => {
    let year = "—";
    if (tape) {
      const yVh = Number(gsap.getProperty(tape, "y", "vh"));
      year = (cfg.firstYear + (cfg.anchor * 100 - yVh) / cfg.pitch).toFixed(1);
    }
    const ch = chapterBeats ? ` [${chapterBeats.id}]` : "";
    hud.textContent = `beat ${tl.time().toFixed(2)} / ${tl.duration().toFixed(2)}   year ${year}${ch}`;
  });
}

// ─── Moment factories (the vocabulary you write scripts with) ─────────────────

type Opts = MomentBase;

type ShowOpts = {
  over?: number;
  from?: ShowTweenVars;
  to?: ShowTweenVars;
  ease?: GsapEase;
} & Opts;

export const show = (id: string, o: ShowOpts = {}): Moment => ({
  kind: "show",
  id,
  over: o.over ?? 0.8,
  from: o.from,
  to: o.to,
  ease: o.ease,
  withPrevious: o.withPrevious,
  offset: o.offset,
});

type HideOpts = {
  over?: number;
  to?: ShowTweenVars;
  ease?: GsapEase;
} & Opts;

export const hide = (id: string, o: HideOpts = {}): Moment => ({
  kind: "hide",
  id,
  over: o.over ?? 0.6,
  to: o.to,
  ease: o.ease,
  withPrevious: o.withPrevious,
  offset: o.offset,
});

export const hold = (beats: number, o: Opts = {}): Moment => ({
  kind: "hold",
  beats,
  ...o,
});

export const enterTape = (
  o: {
    at: number;
    over?: number;
    fromOffset?: number;
    fromOpacity?: number;
    toOpacity?: number;
    ease?: GsapEase;
  } & Opts,
): Moment => ({
  kind: "enterTape",
  at: o.at,
  over: o.over ?? 1.5,
  fromOffset: o.fromOffset,
  fromOpacity: o.fromOpacity,
  toOpacity: o.toOpacity,
  ease: o.ease,
  withPrevious: o.withPrevious,
  offset: o.offset,
});
export const travel = (
  o: { to: number; over: number; ease?: GsapEase } & Opts,
): Moment => ({
  kind: "travel",
  to: o.to,
  over: o.over,
  ease: o.ease,
  withPrevious: o.withPrevious,
  offset: o.offset,
});

export const stopTimelineAt = (
  year: number,
  o: {
    dwell?: number;
    approach?: number;
    reveal?: (string | RevealSpec)[];
    revealOver?: number;
    persist?: boolean;
    exitOver?: number;
    exitEase?: GsapEase;
  } & Opts = {},
): Moment => ({
  kind: "stopTimelineAt",
  year,
  dwell: o.dwell ?? 2,
  approach: o.approach,
  reveal: o.reveal,
  revealOver: o.revealOver,
  persist: o.persist,
  exitOver: o.exitOver,
  exitEase: o.exitEase,
  withPrevious: o.withPrevious,
  offset: o.offset,
});

export const morph = (
  o: { from: PaletteToken; to: PaletteToken; over?: number } & Opts,
): Moment => ({
  kind: "morph",
  from: o.from,
  to: o.to,
  over: o.over ?? 1.5,
  withPrevious: o.withPrevious,
  offset: o.offset,
});
