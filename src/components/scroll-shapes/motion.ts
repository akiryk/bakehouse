import gsap from "gsap";
import type {
  ScrollShapesConfig,
  ScrollShapesSizeGroup,
  ShapeColor,
} from "./config";

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

function shuffle<T>(arr: T[]): T[] {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// One entry per shape, flattened out of sizeGroups and shuffled so a group's
// position in the config array doesn't correlate with where down the page
// its shapes' entry points land — sizes end up interspersed, not clustered.
function buildSizePool(
  groups: ScrollShapesSizeGroup[],
): ScrollShapesSizeGroup[] {
  return shuffle(groups.flatMap((group) => Array(group.count).fill(group)));
}

function randomizeAttrs(
  config: ScrollShapesConfig,
  size: ScrollShapesSizeGroup,
): Pick<Shape, "x" | "w" | "h" | "color" | "speed"> {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: rand(config.xZone.left, config.xZone.right) * vw,
    w: rand(size.width.min, size.width.max),
    h: rand(size.height.min, size.height.max) * vh * 0.01,
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

  // The scroll engine gives the page its real scrollable height by appending
  // a spacer to <body> at init — but that init script runs later in document
  // order than this one, so measuring scrollHeight right now would see the
  // page before the spacer exists (just a few viewport-heights tall) and
  // badly under-count the usable entry range. `load` is guaranteed to fire
  // only after every module script, including the engine's, has run.
  if (document.readyState === "complete") setup();
  else window.addEventListener("load", setup, { once: true });

  function setup(): void {
    const vh = window.innerHeight;
    const maxScroll = Math.max(
      document.documentElement.scrollHeight - vh,
      vh * 3,
    );

    // scrollZone is expressed in vh, anchored to the page top (100 = one
    // viewport height down). Converting a page position P (vh) to the scrollY
    // at which it reaches the viewport's bottom edge: scrollY = P/100 * vh - vh.
    // end is clamped to the page's actual max scroll so a generously large
    // config value ("run to the bottom, however long that is") never wastes
    // shapes on entry points beyond what's reachable.
    const toScrollY = (posVh: number) => (posVh / 100) * vh - vh;
    const zoneStart = toScrollY(config.scrollZone.start);
    const zoneEnd = Math.min(toScrollY(config.scrollZone.end), maxScroll);
    const zoneRange = zoneEnd - zoneStart;

    const sizePool = buildSizePool(config.sizeGroups);
    const totalCount = sizePool.length;

    // Divide zone into equal segments; each shape enters at a random point
    // within its segment so they're evenly spread but not mechanical.
    const segment = zoneRange / totalCount;
    const shapes: Shape[] = [];

    // Pure function of scrollY — reversible by design. Applied unconditionally,
    // even when the result is fully off-screen: skipping the update while out
    // of view left the previous transform in place, so a shape could freeze
    // mid-transit and sit "poking" into the viewport instead of clearing it.
    const positionShape = (shape: Shape, scrollY: number): void => {
      const y = vh - (scrollY - shape.scrollEntry) * shape.speed;
      gsap.set(shape.el, { y });
    };

    for (let i = 0; i < totalCount; i++) {
      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.top = "0";

      const attrs = randomizeAttrs(config, sizePool[i]);
      const scrollEntry = zoneStart + i * segment + rand(0, segment);

      const shape: Shape = { el, scrollEntry, ...attrs };
      applyAttrs(shape);
      container.appendChild(el);
      // Position before first paint so a fresh load never shows a shape
      // sitting at its default (untransformed) spot — it starts wherever the
      // formula places it for the current scroll position (fully off-screen
      // at scrollY 0, or partly visible if scrollZone.start puts it there).
      positionShape(shape, window.scrollY);
      shapes.push(shape);
    }

    gsap.ticker.add(() => {
      const scrollY = window.scrollY;
      for (const shape of shapes) positionShape(shape, scrollY);
    });
  }
}
