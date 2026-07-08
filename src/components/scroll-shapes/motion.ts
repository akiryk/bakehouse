import gsap from "gsap";
import type { ScrollShapesConfig, ShapeColor } from "./config";

interface Shape {
  el: HTMLElement;
  x: number; // px
  w: number; // px
  h: number; // px
  color: ShapeColor;
  speed: number;
  /**
   * The scrollY value at which this shape first appears at the bottom of the
   * viewport. Position is a pure function of scrollY:
   *   y = innerHeight - (scrollY - scrollEntry) * speed
   * This makes motion fully reversible — scrolling back up retraces the same path.
   */
  scrollEntry: number;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomizeAttrs(
  config: ScrollShapesConfig,
): Pick<Shape, "x" | "w" | "h" | "color" | "speed"> {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: rand(config.xZone.left, config.xZone.right) * vw,
    w: rand(config.width.min, config.width.max) * vw * 0.01,
    h: rand(config.height.min, config.height.max) * vh * 0.01,
    color: pick(config.colors),
    speed: rand(config.speed.min, config.speed.max),
  };
}

function applyAttrs(shape: Shape): void {
  shape.el.style.width = `${shape.w}px`;
  shape.el.style.height = `${shape.h}px`;
  shape.el.style.left = `${shape.x}px`;
  shape.el.style.backgroundColor = shape.color.value;
  shape.el.style.opacity = String(shape.color.opacity);
}

/**
 * Initializes the scroll-shapes ambient layer.
 * Called once at page load by ScrollShapes.astro.
 */
export function initScrollShapes(
  container: HTMLElement,
  config: ScrollShapesConfig,
): void {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (reducedMotion) return;

  const vh = window.innerHeight;
  // Full scrollable range. Use a minimum so shapes spread even on short pages.
  const maxScroll = Math.max(
    document.documentElement.scrollHeight - vh,
    vh * 3,
  );
  // Divide scroll range into equal segments; each shape gets a random entry
  // point within its segment so they're evenly spread but not mechanical.
  const segment = maxScroll / config.count;
  const shapes: Shape[] = [];

  for (let i = 0; i < config.count; i++) {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.top = "0";

    const attrs = randomizeAttrs(config);
    const scrollEntry = i * segment + rand(0, segment);

    const shape: Shape = { el, scrollEntry, ...attrs };
    applyAttrs(shape);
    container.appendChild(el);
    shapes.push(shape);
  }

  gsap.ticker.add(() => {
    // Skip per-shape work while the container is hidden — free perf.
    if (container.style.opacity === "0") return;

    const scrollY = window.scrollY;

    for (const shape of shapes) {
      // y is a pure function of scrollY: fully reversible.
      const y = vh - (scrollY - shape.scrollEntry) * shape.speed;
      // Skip shapes that are entirely off-screen.
      if (y > vh || y < -shape.h) continue;
      gsap.set(shape.el, { y });
    }
  });
}
