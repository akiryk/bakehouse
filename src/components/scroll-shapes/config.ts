/**
 * ScrollShapes — config interface and default values.
 *
 * Import defaultConfig and spread it to override only what you need:
 *
 *   import { defaultConfig } from "@components/scroll-shapes/config";
 *   const homeConfig = { ...defaultConfig, xZone: { left: 0.70, right: 0.95 } };
 */

/** A single color option for shape fill. */
export interface ShapeColor {
  /** CSS color value (hex, rgb, named, etc.). */
  value: string;
  /** Opacity 0–1. */
  opacity: number;
}

/** One size bucket: how many shapes, and the width/height range for each. */
export interface ScrollShapesSizeGroup {
  /** How many shapes to generate at this size. */
  count: number;
  /** Shape width range, in px. */
  width: { min: number; max: number };
  /** Shape height range, in vh. */
  height: { min: number; max: number };
}

export interface ScrollShapesConfig {
  /**
   * Shapes are generated in named size groups instead of one flat
   * width/height range — e.g. a handful of large shapes plus many thin,
   * narrow ones. The total shape count is the sum of every group's `count`.
   * Each shape gets a random entry point spread evenly across scrollZone;
   * groups are shuffled together first, so a group's position in this array
   * has no bearing on *where* down the page its shapes tend to appear —
   * sizes are interspersed, not clustered by group.
   */
  sizeGroups: ScrollShapesSizeGroup[];
  /**
   * Horizontal zone where shapes may appear, as viewport-width fractions (0–1).
   * e.g. { left: 0.65, right: 1.0 } confines shapes to the right 35% of the viewport.
   */
  xZone: { left: number; right: number };
  /**
   * Vertical entry range, in viewport-height units (vh), anchored to the
   * page's top — not a fraction of total scroll. 100 = exactly one viewport
   * height down the page (where the first screen ends).
   *
   * A shape's entry point (the scrollY at which its top reaches the bottom
   * of the viewport) is randomly distributed within [start, end]:
   *   - start < 100 lets a shape already be partly visible on a fresh load
   *     (scrollY 0) — e.g. 40 means shapes may appear as high as 40vh down
   *     the (visible-at-load) first screen.
   *   - start > 100 pushes every shape's entry below the fold — e.g. 110
   *     means nothing appears until the user has scrolled 10vh past the
   *     first screen.
   *   - end has no fixed ceiling; a value at or beyond the page's actual
   *     height (in vh) is clamped to the page's real max scroll at runtime,
   *     so "run entries all the way to the bottom" doesn't require knowing
   *     the exact page length.
   *
   * To get several shapes visible at load (not just 0–1), start usually needs
   * to be a few hundred *negative*, not just below 100 — entries are spread
   * evenly across the whole [start, end] span, so with end reaching all the
   * way down the page, only the sliver of that span below scrollY 0 is ever
   * "already active" at load. Raising the total shape count (the sum of
   * sizeGroups[].count) spreads the same shapes thinner across the whole
   * page rather than concentrating more of them near the start — it doesn't
   * by itself make more of them visible on load.
   */
  scrollZone: { start: number; end: number };
  /**
   * Scroll-parallax speed range. Multiplier applied to scrollY to derive upward
   * travel. 0.3 = slow drift; 1.0 = moves one px per px of scroll.
   */
  speed: { min: number; max: number };
  /** Pool of colors randomly assigned to each shape. At least one entry required. */
  colors: ShapeColor[];
}

export const defaultConfig: ScrollShapesConfig = {
  sizeGroups: [
    { count: 10, width: { min: 1, max: 10 }, height: { min: 50, max: 100 } }, // vh
    { count: 10, width: { min: 100, max: 200 }, height: { min: 80, max: 130 } }, // vh
  ],
  xZone: { left: 0.65, right: 1.0 },
  scrollZone: { start: -400, end: 100_000 },
  speed: { min: 0.3, max: 0.9 },
  colors: [
    { value: "#ffffff", opacity: 0.1 },
    { value: "#000000", opacity: 0.08 },
  ],
};
