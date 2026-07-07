/**
 * Dev-only beat ruler overlay.
 *
 * A fixed column on the right edge that slides with scroll. Shows:
 *   LEFT lane   — numbered beat bars, chapter-relative (resets to 0 at each
 *                 chapter), each bar exactly one vhPerBeat of scroll tall.
 *   MIDDLE lane — labeled event spans from chapter.schedule, positioned at
 *                 their chapter-relative beat offsets.
 *   RIGHT lane  — labeled event spans from model.pageSchedule, positioned at
 *                 page-absolute beat offsets. Amber/orange color to distinguish
 *                 from chapter-level events.
 *
 * Coordinate space: EVERYTHING is derived from the model's absolute vh
 * offsets (ch.scrollVH.*) converted to px via vhToPx(). The inner strip
 * height is vhToPx(model.totalVH), which exactly matches the engine's
 * spacer element. scrollY drives translateY in the same units. No beatPx
 * arithmetic — that was the source of drift.
 *
 * Chapter 1 has endBeat: 0 → no numbered bars, only a dim exit band.
 * Chapter 2 has no fly-away → no exit band, only numbered bars + events.
 *
 * The ?beats URL param activates a page HUD showing:
 *   page beat / total   active-chapter   ch-beat / ch-total
 *
 * Keyboard toggle: Cmd/Ctrl + Shift + \
 * Reads only BeatModel + window.scrollY. Zero timing logic.
 */

import type { BeatModel, ScheduledEvent } from "../motion/beat-model";

/** Minimum rendered height for a zero-length event span (px). */
const MIN_SPAN_PX = 4;

// ── Event grouping ────────────────────────────────────────────────────────────
// Events sharing the same startBeat are merged into one span so their labels
// stack vertically instead of layering on top of each other.

interface GroupedEvent {
  startBeat: number;
  endBeat: number; // max across all events in the group
  label: string; // labels joined by "\n"
}

// ── Label rendering ───────────────────────────────────────────────────────────
// Renders a (possibly multi-line) grouped label into a parent element.
// Lines matching the chapter format "name (Xb)" are bold + capitalized;
// all other lines (exit, enter, morph, …) use normal weight.

/** Matches "intro (0b)", "timeline (14.4b)", etc. */
const CHAPTER_LINE_RE = /^.+\s\(\d+(\.\d+)?b\)$/;

function renderLines(
  parent: HTMLElement,
  text: string,
  color: string,
  fontSize = "0.75em",
): void {
  for (const line of text.split("\n")) {
    const el = document.createElement("div");
    const isChapter = CHAPTER_LINE_RE.test(line);
    Object.assign(el.style, {
      fontSize,
      lineHeight: "1.2",
      color,
      userSelect: "none",
      whiteSpace: "normal",
      fontWeight: isChapter ? "bold" : "normal",
      textTransform: isChapter ? "capitalize" : "none",
    });
    el.textContent = line;
    parent.appendChild(el);
  }
}

function groupByStartBeat(events: ScheduledEvent[]): GroupedEvent[] {
  const map = new Map<number, GroupedEvent>();
  for (const evt of events) {
    const existing = map.get(evt.startBeat);
    if (existing) {
      existing.label += "\n" + evt.label;
      existing.endBeat = Math.max(existing.endBeat, evt.endBeat);
    } else {
      map.set(evt.startBeat, { ...evt, label: evt.label });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.startBeat - b.startBeat);
}

export function initBeatRuler(model: BeatModel): void {
  // ── State ─────────────────────────────────────────────────────────────────────

  let visible = false;
  let outerEl: HTMLElement | null = null;
  let innerEl: HTMLElement | null = null;
  let pendingRAF: number | null = null;

  // ── vh → px conversion ────────────────────────────────────────────────────────
  // Single helper that matches how the engine's spacer and ScrollTrigger offsets
  // are expressed. Called once per build so window.innerHeight is stable.

  function makeVhToPx(): (vh: number) => number {
    const h = window.innerHeight;
    return (vh: number) => (vh * h) / 100;
  }

  // ── Measurement helpers ───────────────────────────────────────────────────────

  function measureTextWidth(labels: string[], fontSize: string): number {
    if (labels.length === 0) return 0;

    const probe = document.createElement("span");
    Object.assign(probe.style, {
      position: "fixed",
      top: "-9999px",
      left: "-9999px",
      fontSize,
      fontFamily: "sans-serif",
      whiteSpace: "nowrap",
      visibility: "hidden",
      pointerEvents: "none",
    });
    document.body.appendChild(probe);

    let maxW = 0;
    for (const label of labels) {
      probe.textContent = label;
      maxW = Math.max(maxW, probe.getBoundingClientRect().width);
    }
    document.body.removeChild(probe);
    return Math.ceil(maxW) + 8; // 4 px padding each side
  }

  function numericLabels(): string[] {
    const out: string[] = [];
    for (const ch of model.chapters) {
      const n = Math.ceil(ch.endBeat);
      for (let b = 0; b < n; b++) out.push(String(b));
    }
    return out;
  }

  function eventLabels(): string[] {
    return model.chapters.flatMap((ch) => ch.schedule.map((e) => e.label));
  }

  function pageEventLabels(): string[] {
    return (model.pageSchedule ?? []).map((e) => e.label);
  }

  // ── Build / destroy ───────────────────────────────────────────────────────────

  function build(): void {
    const vhToPx = makeVhToPx();

    // Lane widths — probe-measured so the column is no wider than necessary.
    const numLaneW = Math.max(24, measureTextWidth(numericLabels(), "1.125em"));

    const evtLabels = eventLabels();
    const evtLaneW =
      evtLabels.length > 0
        ? Math.min(200, Math.max(60, measureTextWidth(evtLabels, "0.75em")))
        : 0;

    const pgLabels = pageEventLabels();
    const pageLaneW =
      pgLabels.length > 0
        ? Math.min(180, Math.max(60, measureTextWidth(pgLabels, "0.75em")))
        : 0;

    const colW = numLaneW + evtLaneW + pageLaneW;

    // Strip height matches the engine's spacer (totalVH vh).
    const totalH = vhToPx(model.totalVH);

    // px height of one beat bar.
    const beatH = vhToPx(model.vhPerBeat);

    // Outer: fixed viewport column, clips inner content.
    const outer = document.createElement("div");
    outer.id = "beat-ruler";
    outer.setAttribute("aria-hidden", "true");
    Object.assign(outer.style, {
      position: "fixed",
      right: "0",
      top: "0",
      width: `${colW}px`,
      height: "100vh",
      overflow: "hidden",
      zIndex: "99999",
      pointerEvents: "none",
      fontFamily: "sans-serif",
    });

    // "Now" indicator — a line pinned to the bottom of the outer column.
    const nowLine = document.createElement("div");
    Object.assign(nowLine.style, {
      position: "absolute",
      bottom: "0",
      left: "0",
      width: "100%",
      height: "2px",
      background: "rgba(220,60,60,0.7)",
      zIndex: "1",
    });
    outer.appendChild(nowLine);

    // Inner: as tall as the engine's full scroll range; translateY tracks scrollY.
    const inner = document.createElement("div");
    Object.assign(inner.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: `${totalH}px`,
    });

    // ── Chapter lanes (beat bars + chapter event spans) ────────────────────────

    for (const ch of model.chapters) {
      const { scrollVH } = ch;

      // Numbered beat bars — chapter-relative.
      const numBars = Math.ceil(ch.endBeat);
      for (let b = 0; b < numBars; b++) {
        const topPx = vhToPx(scrollVH.beatStart) + b * beatH;
        const barH = Math.min(beatH, (ch.endBeat - b) * beatH);

        const bar = document.createElement("div");
        Object.assign(bar.style, {
          position: "absolute",
          top: `${topPx}px`,
          left: "0",
          width: `${numLaneW}px`,
          height: `${barH}px`,
          background: b % 2 === 0 ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        });

        const lbl = document.createElement("span");
        Object.assign(lbl.style, {
          fontSize: "1.125em",
          fontWeight: "bold",
          color: "rgba(0,0,0,0.75)",
          userSelect: "none",
          lineHeight: "1",
        });
        lbl.textContent = String(b);
        bar.appendChild(lbl);
        inner.appendChild(bar);
      }

      // Exit band — dim, unnumbered region covering the fly-away range.
      const flyH = vhToPx(scrollVH.flyEnd - scrollVH.flyStart);
      if (flyH > 0) {
        const band = document.createElement("div");
        Object.assign(band.style, {
          position: "absolute",
          top: `${vhToPx(scrollVH.flyStart)}px`,
          left: "0",
          width: `${numLaneW}px`,
          height: `${flyH}px`,
          background: "rgba(0,0,0,0.04)",
          boxSizing: "border-box",
          borderTop: "1px solid rgba(0,0,0,0.12)",
          padding: "2px 4px",
        });

        const lbl = document.createElement("span");
        Object.assign(lbl.style, {
          fontSize: "0.65em",
          color: "rgba(0,0,0,0.35)",
          userSelect: "none",
          lineHeight: "1.2",
          whiteSpace: "nowrap",
          display: "block",
        });
        lbl.textContent = "chapter transition";
        band.appendChild(lbl);
        inner.appendChild(band);
      }

      // Chapter event spans — grouped by startBeat to avoid overlap.
      if (evtLaneW > 0) {
        const chapterOriginPx = vhToPx(scrollVH.beatStart);

        for (const evt of groupByStartBeat(ch.schedule)) {
          const evtTopPx =
            chapterOriginPx + vhToPx(evt.startBeat * model.vhPerBeat);
          const evtH = Math.max(
            MIN_SPAN_PX,
            vhToPx((evt.endBeat - evt.startBeat) * model.vhPerBeat),
          );

          const span = document.createElement("div");
          Object.assign(span.style, {
            position: "absolute",
            top: `${evtTopPx}px`,
            left: `${numLaneW}px`,
            width: `${evtLaneW}px`,
            height: `${evtH}px`,
            background: "rgba(30,60,180,0.1)",
            borderTop: "1px solid rgba(30,60,180,0.35)",
            boxSizing: "border-box",
            padding: "1px 3px",
            overflow: "hidden",
          });

          renderLines(span, evt.label, "rgba(20,40,160,0.9)");
          inner.appendChild(span);
        }
      }
    }

    // ── Page event lane ────────────────────────────────────────────────────────
    // Events from model.pageSchedule, positioned at page-absolute beat offsets.
    // Grouped by startBeat; amber/orange to distinguish from chapter blue events.

    if (pageLaneW > 0) {
      for (const evt of groupByStartBeat(model.pageSchedule ?? [])) {
        const evtTopPx = vhToPx(evt.startBeat * model.vhPerBeat);
        const evtH = Math.max(
          MIN_SPAN_PX,
          vhToPx((evt.endBeat - evt.startBeat) * model.vhPerBeat),
        );

        const span = document.createElement("div");
        Object.assign(span.style, {
          position: "absolute",
          top: `${evtTopPx}px`,
          left: `${numLaneW + evtLaneW}px`,
          width: `${pageLaneW}px`,
          height: `${evtH}px`,
          background: "rgba(160,80,20,0.08)",
          borderTop: "1px solid rgba(160,80,20,0.4)",
          boxSizing: "border-box",
          padding: "1px 3px",
          overflow: "hidden",
        });

        renderLines(span, evt.label, "rgba(130,60,10,0.9)");
        inner.appendChild(span);
      }
    }

    outer.appendChild(inner);
    document.body.appendChild(outer);
    outerEl = outer;
    innerEl = inner;

    syncScroll();
  }

  function destroy(): void {
    if (outerEl) {
      document.body.removeChild(outerEl);
      outerEl = null;
      innerEl = null;
    }
    if (pendingRAF !== null) {
      cancelAnimationFrame(pendingRAF);
      pendingRAF = null;
    }
  }

  // ── Scroll tracking ───────────────────────────────────────────────────────────

  function syncScroll(): void {
    pendingRAF = null;
    if (innerEl) {
      innerEl.style.transform = `translateY(${window.innerHeight - window.scrollY}px)`;
    }
  }

  function onScroll(): void {
    if (!visible || pendingRAF !== null) return;
    pendingRAF = requestAnimationFrame(syncScroll);
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  // ── Resize ────────────────────────────────────────────────────────────────────

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener("resize", () => {
    if (!visible) return;
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      destroy();
      build();
    }, 100);
  });

  // ── Toggle ────────────────────────────────────────────────────────────────────

  function toggle(): void {
    visible = !visible;
    if (visible) build();
    else destroy();
  }

  window.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
    if (e.key === "\\") {
      e.preventDefault();
      toggle();
    }
  });

  // ── Page HUD (?beats) ─────────────────────────────────────────────────────────
  // Activated by ?beats in the URL. Positioned at bottom-left, above the
  // chapter-level timeline HUD (which timeline-kit.ts places at bottom:12px).
  // Shows: page beat / total · active chapter · chapter beat / ch-total

  if (new URLSearchParams(window.location.search).has("beats")) {
    const hud = document.createElement("div");
    hud.style.cssText =
      "position:fixed;left:12px;bottom:48px;z-index:9999;padding:6px 10px;" +
      "font:12px/1.4 monospace;background:rgba(0,0,0,.7);color:#fff;" +
      "border-radius:4px;pointer-events:none;";
    document.body.appendChild(hud);

    function updateHud(): void {
      const vhPx = window.innerHeight / 100;
      const scrollVH = window.scrollY / vhPx;
      const pageBeat = scrollVH / model.vhPerBeat;

      // Find the active chapter: the one whose scroll range includes scrollVH.
      // Prefer the dwell window; fall back to the exit band.
      let activeId = "—";
      let chBeat = 0;
      let chTotal = 0;
      for (const ch of model.chapters) {
        const { beatStart, flyEnd } = ch.scrollVH;
        if (scrollVH >= beatStart && scrollVH < flyEnd) {
          activeId = ch.id;
          chBeat = Math.max(
            0,
            Math.min(
              ch.endBeat,
              (scrollVH - ch.scrollVH.beatStart) / model.vhPerBeat,
            ),
          );
          chTotal = ch.endBeat;
          break;
        }
      }

      hud.textContent =
        `page ${pageBeat.toFixed(2)} / ${model.totalVH / model.vhPerBeat}` +
        `  ·  ${activeId}` +
        (chTotal > 0 ? `  ·  ch ${chBeat.toFixed(2)} / ${chTotal}` : "");
    }

    window.addEventListener("scroll", updateHud, { passive: true });
    updateHud();
  }
}
