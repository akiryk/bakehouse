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

export interface ScrollShapesConfig {
  /**
   * Exact number of shapes to generate. Each shape gets a random entry point
   * spread evenly across the full scroll range, so a higher count means more
   * shapes appear throughout the page.
   */
  count: number;
  /**
   * Horizontal zone where shapes may appear, as viewport-width fractions (0–1).
   * e.g. { left: 0.65, right: 1.0 } confines shapes to the right 35% of the viewport.
   */
  xZone: { left: number; right: number };
  /** Shape height range in vh. */
  height: { min: number; max: number };
  /** Shape width range in vw. */
  width: { min: number; max: number };
  /**
   * Scroll-parallax speed range. Multiplier applied to scrollY to derive upward
   * travel. 0.3 = slow drift; 1.0 = moves one px per px of scroll.
   */
  speed: { min: number; max: number };
  /** Pool of colors randomly assigned to each shape. At least one entry required. */
  colors: ShapeColor[];
}

export const defaultConfig: ScrollShapesConfig = {
  count: 12,
  xZone: { left: 0.65, right: 1.0 },
  height: { min: 25, max: 100 }, // vh
  width: { min: 0.05, max: 5 }, // vw
  speed: { min: 0.3, max: 0.9 },
  colors: [
    { value: "#ffffff", opacity: 0.1 },
    { value: "#000000", opacity: 0.08 },
  ],
};
