/**
 * Dev-only beat ruler overlay.
 *
 * A fixed column on the right edge that slides with scroll, showing beat
 * numbers chapter-relative (resetting to 0 at each chapter's beatStart).
 * The fly-away range is shown as a dim unnumbered "exit" region.
 *
 * Keyboard toggle: Cmd/Ctrl + Shift + \
 *
 * Gated on import.meta.env.DEV. The engine imports this module dynamically
 * inside `if (import.meta.env.DEV)`, so it is fully excluded from prod bundles.
 *
 * Source of truth: the engine's slots array, passed in at init. This module
 * does not recompute timing — it only reads what it receives.
 */

/** One chapter's scroll geometry, as supplied by the engine. */
export interface RulerSlot {
  beatStart: number; // vh — where this chapter's beats window begins
  beatEnd: number; // vh — where this chapter's beats window ends
  flyStart: number; // vh — where this chapter's fly-away begins
  flyEnd: number; // vh — where this chapter's fly-away ends
  chapterId: string; // for labeling (e.g. "intro", "placeholder")
}

export function initBeatRuler(
  slots: RulerSlot[],
  totalVH: number,
  vhPerBeat: number,
): void {
  if (!import.meta.env.DEV) return;

  // ── State ───────────────────────────────────────────────────────────────────

  let visible = false;
  let outerEl: HTMLElement | null = null;
  let innerEl: HTMLElement | null = null;
  let pendingRAF: number | null = null;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function toPx(vh: number): number {
    return (vh * window.innerHeight) / 100;
  }

  /**
   * Collect every label string that will appear in the ruler so we can
   * measure the widest one and size the column accordingly.
   */
  function collectLabels(): string[] {
    const out: string[] = [];
    slots.forEach((slot) => {
      const hasBeatWindow = slot.beatEnd > slot.beatStart;
      const rangeStart = hasBeatWindow ? slot.beatStart : slot.flyStart;
      const rangeEnd = hasBeatWindow ? slot.beatEnd : slot.flyEnd;
      if (rangeEnd > rangeStart) {
        const n = Math.ceil((rangeEnd - rangeStart) / vhPerBeat);
        for (let b = 0; b < n; b++) out.push(String(b));
      }
    });
    return out;
  }

  /**
   * Measure the width of the widest label using a probe element.
   * Called once per build (init + resize) — never per frame.
   */
  function measureColWidth(): number {
    const labels = collectLabels();
    if (labels.length === 0) return 40;

    const probe = document.createElement("span");
    Object.assign(probe.style, {
      position: "fixed",
      top: "-9999px",
      left: "-9999px",
      fontSize: "1.125em",
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

  // ── Build / destroy ─────────────────────────────────────────────────────────

  function build(): void {
    const colW = measureColWidth();
    const totalPx = toPx(totalVH);

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

    // Inner: as tall as the full scroll range; translateY tracks scrollY.
    const inner = document.createElement("div");
    Object.assign(inner.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: `${totalPx}px`,
    });

    // ── Bars ─────────────────────────────────────────────────────────────────

    slots.forEach((slot) => {
      const hasBeatWindow = slot.beatEnd > slot.beatStart;
      const hasFlyWindow = slot.flyEnd > slot.flyStart;

      // ── Beat bars ────────────────────────────────────────────────────────────
      // If the chapter has a scripted beats window, divide it into vhPerBeat bars.
      // If it has NO beats window (e.g. a paper-only chapter), use the fly-away
      // range as the beat bars — every chapter gets at least one numbered bar.
      const beatRangeStart = hasBeatWindow ? slot.beatStart : slot.flyStart;
      const beatRangeEnd = hasBeatWindow ? slot.beatEnd : slot.flyEnd;

      if (beatRangeEnd > beatRangeStart) {
        const rangeVH = beatRangeEnd - beatRangeStart;
        const numBars = Math.ceil(rangeVH / vhPerBeat);

        for (let b = 0; b < numBars; b++) {
          const topVH = beatRangeStart + b * vhPerBeat;
          const endVH = Math.min(topVH + vhPerBeat, beatRangeEnd);

          const bar = document.createElement("div");
          Object.assign(bar.style, {
            position: "absolute",
            top: `${toPx(topVH)}px`,
            left: "0",
            width: "100%",
            height: `${toPx(endVH - topVH)}px`,
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
      }

      // ── Exit region ───────────────────────────────────────────────────────────
      // Only shown for chapters that have BOTH a beats window and a fly-away.
      // (Chapters with no beats window use the fly-away as their beat bars above.)
      if (hasBeatWindow && hasFlyWindow) {
        const bar = document.createElement("div");
        Object.assign(bar.style, {
          position: "absolute",
          top: `${toPx(slot.flyStart)}px`,
          left: "0",
          width: "100%",
          height: `${toPx(slot.flyEnd - slot.flyStart)}px`,
          background: "rgba(0,0,0,0.04)",
          boxSizing: "border-box",
          borderTop: "1px solid rgba(0,0,0,0.12)",
        });
        inner.appendChild(bar);
      }
    });

    outer.appendChild(inner);
    document.body.appendChild(outer);
    outerEl = outer;
    innerEl = inner;

    // Align to current scroll immediately on mount.
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

  // ── Scroll tracking ─────────────────────────────────────────────────────────

  function syncScroll(): void {
    pendingRAF = null;
    if (innerEl) {
      innerEl.style.transform = `translateY(-${window.scrollY}px)`;
    }
  }

  function onScroll(): void {
    if (!visible || pendingRAF !== null) return;
    pendingRAF = requestAnimationFrame(syncScroll);
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  // ── Resize ──────────────────────────────────────────────────────────────────
  // Rebuild on resize: bar heights and column width are viewport-dependent.

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener("resize", () => {
    if (!visible) return;
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      destroy();
      build();
    }, 100);
  });

  // ── Toggle ──────────────────────────────────────────────────────────────────

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
