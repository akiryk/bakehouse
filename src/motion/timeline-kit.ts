/**
 * timeline-kit — authoring layer for scroll-driven timeline chapters.
 *
 * You write a SCRIPT: an ordered list of "moments" in the chapter's script.ts.
 * This kit compiles the script into one GSAP timeline; the engine scrubs it.
 * You think in YEARS and BEATS — never timeline-seconds, never pixels.
 *
 * UNITS
 *   beat   — the scroll unit. 1 beat = `vhPerBeat` viewport-heights of scroll.
 *            All `over` / `dwell` / `hold` values are in beats.
 *   pitch  — tape spacing, in vh per year (bigger pitch = years further apart).
 *   anchor — where the "current" year sits on screen, as a fraction of the
 *            viewport height (0 = top, 0.5 = center, 1 = bottom).
 *
 * ELEMENT ROLES the kit looks for inside the chapter container:
 *   [data-el="intro"]     independent intro block (any named block works: show/hide by id)
 *   [data-el="tape"]      the moving tape — the line + year rows ride it
 *   [data-year="1996"]    a year row on the tape, containing .tl-num and .tl-tick
 *   [data-overlay="xyz"]  independent overlay content (cards/images), hidden until revealed
 *
 * MOMENTS (see the factory functions at the bottom)
 *   show(id)/hide(id)  fade a [data-el=id] block in/out (fade + small vertical move)
 *   hold(beats)        dead air — nothing moves for a stretch of scroll
 *   enterTape({at})    tape rises into view with `at` landing on the anchor
 *   travel({to})       tape moves continuously until `to` is on the anchor
 *   stopTimelineAt(year,{...}) decelerate into a year, tick + brighten it, reveal
 *                      overlays, dwell, then auto-release as travel resumes
 *   morph({from,to})   midground color morph between two palette tokens
 *
 * SEQUENCING: moments run one after another. Set `withPrevious: true` to start
 * a moment at the same time as the previous one, and/or `offset: n` (beats,
 * may be negative) to nudge it. That's the whole concurrency model.
 */

import gsap from "gsap";

// ─── Script types ─────────────────────────────────────────────────────────────

export interface TimelineConfig {
  firstYear: number;
  lastYear: number;
  /** vh of tape per year */
  pitch: number;
  /** where the current year sits: fraction of viewport height (0.5 = center) */
  anchor: number;
  /** scroll feel: how many vh of scrolling one beat represents */
  vhPerBeat: number;
  /** how far below its resting spot the tape starts, in vh (default 100) */
  enterFrom?: number;
}

interface MomentBase {
  /** start together with the previous moment instead of after it */
  withPrevious?: boolean;
  /** nudge the start by this many beats (negative = earlier) */
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
        ease?: string;
      }
    | { kind: "hide"; id: string; over: number }
    | { kind: "hold"; beats: number }
    | {
        kind: "enterTape";
        at: number;
        over: number;
        /** vh below the final year-aligned resting position */
        fromOffset?: number;
        fromOpacity?: number;
        toOpacity?: number;
        ease?: string;
      }
    | { kind: "travel"; to: number; over: number; ease?: string }
    | {
        kind: "stopTimelineAt";
        year: number;
        /** beats the tape dwells at the year (the reading time) */
        dwell: number;
        /** beats to decelerate into the year if not already there (default 0.75) */
        approach?: number;
        /** [data-overlay] ids to reveal at the stop */
        reveal?: string[];
        /** beats each reveal takes (default 0.6) */
        revealOver?: number;
        /** don't auto-hide the reveals when the tape resumes */
        persist?: boolean;
        /** beats the exit fade takes as the tape resumes (default 0.5) */
        exitOver?: number;
      }
    | { kind: "morph"; from: string; to: string; over: number }
  );

export interface TimelineScript {
  config: TimelineConfig;
  moments: Moment[];
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

/** Wrap a config + moments into a script, computing its total length. */
export function defineScript(input: {
  config: TimelineConfig;
  moments: Moment[];
}): TimelineScript {
  return { ...input, totalBeats: walk(input.moments).total };
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

/**
 * Compile a script into a single GSAP timeline (in beat units).
 * The engine wraps it in a scrubbed ScrollTrigger — no engine changes needed.
 */
export function compile(
  container: HTMLElement,
  script: TimelineScript,
): gsap.core.Timeline {
  const { config } = script;
  const el = <T extends HTMLElement>(sel: string) =>
    container.querySelector<T>(sel);

  const tape = el("[data-el='tape']");
  if (!tape) {
    console.warn("timeline-kit: no [data-el='tape'] found — empty timeline.");
    return gsap.timeline();
  }

  const firstEnterTape = script.moments.find(
    (m): m is Extract<Moment, { kind: "enterTape" }> => m.kind === "enterTape",
  );

  if (firstEnterTape) {
    const restY = yFor(config, firstEnterTape.at);
    const fromOffset = firstEnterTape.fromOffset ?? config.enterFrom ?? 100;

    gsap.set(tape, {
      y: `${restY + fromOffset}vh`,
      opacity: firstEnterTape.fromOpacity ?? 1,
    });
  }

  // Colors for the year highlight, styleable from CSS on the stage element.
  const stage = el("[data-el='stage']") ?? container;
  const yearMuted = resolveStageColor(
    stage,
    "--tl-year",
    "rgba(255,255,255,0.35)",
  );
  const yearActive = resolveStageColor(stage, "--tl-year-active", "#ffffff");

  // Overlays start hidden (set here, not in CSS, so no-JS still shows content).
  const overlays = Array.from(
    container.querySelectorAll<HTMLElement>("[data-overlay]"),
  );
  gsap.set(overlays, { opacity: 0, y: 28 });

  const tl = gsap.timeline();
  const { placed } = walk(script.moments);
  let tapeYear: number | null = null;

  for (const { m, start, dur } of placed) {
    switch (m.kind) {
      case "show": {
        const target = el(`[data-el='${m.id}']`);
        if (!target) break;

        tl.fromTo(
          target,
          {
            opacity: 0,
            y: 24,
            ...m.from,
          },
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
          { opacity: 0, y: -18, duration: m.over, ease: "power1.in" },
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
        (m.reveal ?? []).forEach((id, i) => {
          const overlay = el(`[data-overlay='${id}']`);
          if (!overlay) return;
          tl.to(
            overlay,
            { opacity: 1, y: 0, duration: revealOver, ease: "power2.out" },
            tArrive + 0.1 + i * 0.15,
          );
        });

        // Release: exits overlap the start of whatever comes next,
        // so content "animates away as the years begin scrolling again".
        if (!m.persist) {
          (m.reveal ?? []).forEach((id) => {
            const overlay = el(`[data-overlay='${id}']`);
            if (!overlay) return;
            tl.to(
              overlay,
              { opacity: 0, y: -20, duration: exitOver, ease: "power1.in" },
              tRelease,
            );
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
              root.style.setProperty("--color-midground", lerp(proxy.t));
            },
          },
          start,
        );
        break;
      }
    }
  }

  attachDebugHud(container, tl, config);
  return tl;
}

// ─── Debug HUD (?beats) ───────────────────────────────────────────────────────
// Append ?beats to the URL to get a live readout of the playhead (in beats)
// and the year currently on the anchor — makes correlating scroll position to
// script positions much easier while tuning.

function attachDebugHud(
  container: HTMLElement,
  tl: gsap.core.Timeline,
  cfg: TimelineConfig,
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
    hud.textContent = `beat ${tl.time().toFixed(2)} / ${tl
      .duration()
      .toFixed(2)}   year ${year}`;
  });
}

// ─── Moment factories (the vocabulary you write scripts with) ─────────────────

type Opts = MomentBase;

type ShowOpts = {
  over?: number;
  from?: ShowTweenVars;
  to?: ShowTweenVars;
  ease?: string;
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

export const hide = (id: string, o: { over?: number } & Opts = {}): Moment => ({
  kind: "hide",
  id,
  over: o.over ?? 0.6,
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
    ease?: string;
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
  o: { to: number; over: number; ease?: string } & Opts,
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
    reveal?: string[];
    revealOver?: number;
    persist?: boolean;
    exitOver?: number;
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
  withPrevious: o.withPrevious,
  offset: o.offset,
});

export const morph = (
  o: { from: string; to: string; over?: number } & Opts,
): Moment => ({
  kind: "morph",
  from: o.from,
  to: o.to,
  over: o.over ?? 1.5,
  withPrevious: o.withPrevious,
  offset: o.offset,
});
