import gsap from "gsap";
import type { ScrollShapesConfig, ShapeColor } from "./config";

interface Shape {
  el: HTMLElement;
  x: number; // px
  w: number; // px
  h: number; // px
  color: ShapeColor;
  speed: number;
  baseY: number; // px — initial vertical offset (distributed across [0, 100vh])
  cycleIndex: number;
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
    // Stagger baseY across [0, 100vh] so shapes are distributed at load,
    // not all entering from the bottom at once.
    const baseY = (i / count) * vh;

    const shape: Shape = {
      el,
      baseY,
      cycleIndex: 0,
      ...randomizeAttrs(config),
    };

    applyAttrs(shape);
    container.appendChild(el);
    shapes.push(shape);
  }

  gsap.ticker.add(() => {
    // Skip per-shape work while the container is hidden — free perf.
    if (container.style.opacity === "0") return;

    const scrollY = window.scrollY;

    for (const shape of shapes) {
      const rawY = shape.baseY - scrollY * shape.speed;
      const totalH = shape.h + window.innerHeight;
      const newCycle = Math.floor(-rawY / totalH);

      if (newCycle !== shape.cycleIndex) {
        // Shape scrolled off-screen — rerandomize before it re-enters from bottom.
        shape.cycleIndex = newCycle;
        Object.assign(shape, randomizeAttrs(config));
        applyAttrs(shape);
      }

      // Wrap rawY into [0, totalH), then offset so the shape starts below screen.
      const y = (((rawY % totalH) + totalH) % totalH) - shape.h;
      gsap.set(shape.el, { y });
    }
  });
}
