import gsap from "gsap";
import type { ScrollShapesConfig, ShapeColor } from "./config";

interface Shape {
  el: HTMLElement;
  x: number; // px
  w: number; // px
  h: number; // px
  color: ShapeColor;
  speed: number;
  baseY: number; // px — y at scrollY=0; decreases as the user scrolls down
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
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
  const count = randInt(config.count.min, config.count.max);
  const shapes: Shape[] = [];

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.top = "0";

    const attrs = randomizeAttrs(config);
    // All shapes start below the viewport. Stagger across [vh, 2vh] so they
    // trickle in from the bottom rather than arriving all at once.
    const baseY = vh + attrs.h + (i / count) * vh;

    const shape: Shape = { el, baseY, ...attrs };
    applyAttrs(shape);
    container.appendChild(el);
    shapes.push(shape);
  }

  gsap.ticker.add(() => {
    // Skip per-shape work while the container is hidden — free perf.
    if (container.style.opacity === "0") return;

    const scrollY = window.scrollY;

    for (const shape of shapes) {
      const y = shape.baseY - scrollY * shape.speed;

      if (y <= -shape.h) {
        // Shape scrolled off the top — reborn below the bottom with fresh attrs.
        Object.assign(shape, randomizeAttrs(config));
        applyAttrs(shape);
        // Place below screen at a random depth so shapes don't bunch up.
        shape.baseY =
          scrollY * shape.speed +
          window.innerHeight +
          rand(0, window.innerHeight);
      }

      gsap.set(shape.el, { y: shape.baseY - scrollY * shape.speed });
    }
  });
}
