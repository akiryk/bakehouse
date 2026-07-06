/**
 * Dev-only beat ruler overlay.
 *
 * A fixed column on the right edge that slides with scroll. Shows:
 *   LEFT lane  — numbered beat bars, chapter-relative (resets to 0 at each
 *                chapter), each bar exactly one vhPerBeat of scroll tall.
 *   RIGHT lane — labeled event spans from chapter.schedule, positioned at
 *                their chapter-relative beat offsets.
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
 * Keyboard toggle: Cmd/Ctrl + Shift + \
 * Reads only BeatModel + window.scrollY. Zero timing logic.
 */

import type { BeatModel } from "../motion/beat-model";

/** Minimum rendered height for a zero-length event span (px). */
const MIN_SPAN_PX = 4;

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
    const colW = numLaneW + evtLaneW;

    // Strip height matches the engine's spacer (totalVH vh).
    // Using this instead of document.documentElement.scrollHeight keeps the
    // coordinate space consistent: all positions are vh→px from the same origin.
    const totalH = vhToPx(model.totalVH);

    // px height of one beat bar — same scale as the engine's ScrollTrigger ranges.
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
    // The strip scrolls so events enter from the bottom exactly when they start,
    // making the bottom edge the current-beat reference point.
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

    for (const ch of model.chapters) {
      const { scrollVH } = ch;

      // ── Numbered beat bars ──────────────────────────────────────────────────
      // Placed at the chapter's absolute scroll position (scrollVH.beatStart),
      // one bar per beat, each beatH px tall.
      // Numbers are chapter-relative (0, 1, 2…) — reset at each chapter.
      const numBars = Math.ceil(ch.endBeat);

      for (let b = 0; b < numBars; b++) {
        const topPx = vhToPx(scrollVH.beatStart) + b * beatH;
        // Fractional last bar: clamp height so it doesn't overshoot beatEnd.
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

      // ── Exit band ───────────────────────────────────────────────────────────
      // Dim, unnumbered region covering the fly-away range.
      // Position and height come from the engine's absolute vh offsets.
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

      // ── Event span lane ─────────────────────────────────────────────────────
      // Each schedule event gets a labeled band in the right lane.
      // startBeat / endBeat are chapter-relative beats; offset them by the
      // chapter's absolute beatStart (in vh→px) to land at the right position.
      if (evtLaneW > 0) {
        const chapterOriginPx = vhToPx(scrollVH.beatStart);

        for (const evt of ch.schedule) {
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
            overflow: "visible",
          });

          const lbl = document.createElement("span");
          Object.assign(lbl.style, {
            fontSize: "0.75em",
            color: "rgba(20,40,160,0.9)",
            userSelect: "none",
            lineHeight: "1.2",
            whiteSpace: "nowrap",
            display: "block",
          });
          lbl.textContent = evt.label;
          span.appendChild(lbl);
          inner.appendChild(span);
        }
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
  // "Now" is at the BOTTOM of the ruler. translateY(innerHeight - scrollY) positions
  // the strip so that the beat at the current scroll offset aligns with the bottom
  // edge. Events enter from the bottom when they start and exit from the top when done.

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
  // Rebuild on resize: vhToPx changes with window.innerHeight, so bar heights,
  // strip height, and all event positions must be recomputed.

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

  // Keyboard shortcut: Cmd/Ctrl + Shift + \
  window.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
    if (e.key === "\\") {
      e.preventDefault();
      toggle();
    }
  });
}
