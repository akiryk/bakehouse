import gsap from "gsap";
import type { ScrollShapesConfig, ScrollShapesSizeGroup } from "./config";

interface Shape {
  el: HTMLElement;
  x: number; // px
  w: number; // px
  h: number; // px
  opacity: number;
  speed: number;
  /**
   * The scrollY value at which this shape first appears at the bottom of the
   * viewport. Position is a pure function of scrollY:
   *   y = innerHeight - (scrollY - scrollEntry) * speed
   * This makes motion fully reversible — scrolling back up retraces the same path.
   */
  scrollEntry: number;
  /**
   * Added on top of the scrollY formula above (see positionShape). Only
   * non-zero for a shape that would actually be visible at the current
   * scroll position when it's set — see the entrance-offset computation in
   * initScrollShapes for why every OTHER shape must stay at exactly 0, not
   * some shared "push everything down" amount.
   */
  entranceOffset: number;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
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
): Pick<Shape, "x" | "w" | "h" | "opacity" | "speed"> {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: rand(config.xZone.left, config.xZone.right) * vw,
    w: rand(size.width.min, size.width.max),
    h: rand(size.height.min, size.height.max) * vh * 0.01,
    opacity: rand(config.opacity.min, config.opacity.max),
    speed: rand(config.speed.min, config.speed.max),
  };
}

function applyAttrs(shape: Shape): void {
  shape.el.style.width = `${shape.w}px`;
  shape.el.style.height = `${shape.h}px`;
  shape.el.style.left = `${shape.x}px`;
  shape.el.style.opacity = String(shape.opacity);
}

// The ticker callback / "paper-entered" listener from the most recent
// initScrollShapes() call, if any. This is called fresh on every visit to a
// page mounting <ScrollShapes /> (global-scripts/page-init.ts's initHomePage() —
// see its own comment for why that replaced a self-contained, re-runnable
// script tag) — but gsap.ticker and `document` are both *global*,
// cross-navigation singletons, so without this, every repeat visit would
// add one more ticker callback / event listener forever, each looping over
// or referencing shapes belonging to a container that's already been
// removed from the DOM.
let activeTicker: (() => void) | null = null;
let activeEnterListener: (() => void) | null = null;

/**
 * Initializes the scroll-shapes ambient layer. Called on every visit to a
 * page mounting this component (see global-scripts/page-init.ts's initHomePage()).
 */
export function initScrollShapes(
  container: HTMLElement,
  config: ScrollShapesConfig,
): void {
  if (activeTicker) {
    gsap.ticker.remove(activeTicker);
    activeTicker = null;
  }
  if (activeEnterListener) {
    document.removeEventListener("bh:paper-entered", activeEnterListener);
    activeEnterListener = null;
  }

  // Reduced motion: this layer doesn't run at all (see docs/scroll-shapes.md),
  // so it never registers a "bh:paper-entered" listener either — a harmless
  // no-op on the dispatching side, nothing to reach for on this side.
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

    // Pure function of scrollY plus the shape's own entranceOffset —
    // reversible by design. Applied unconditionally, even when the result
    // is fully off-screen: skipping the update while out of view left the
    // previous transform in place, so a shape could freeze mid-transit and
    // sit "poking" into the viewport instead of clearing it.
    const positionShape = (shape: Shape, scrollY: number): void => {
      const y =
        vh - (scrollY - shape.scrollEntry) * shape.speed + shape.entranceOffset;
      gsap.set(shape.el, { y });
    };

    // How far below the viewport's bottom edge a pushed-down shape clears
    // by, once its entranceOffset has fully collapsed the gap — a shape
    // landing exactly flush with the edge (0px clearance) is a plausible
    // subpixel-clipping risk; this just guarantees a clean gap beforehand.
    const ENTRANCE_PUSH_BUFFER_PX = 40;

    for (let i = 0; i < totalCount; i++) {
      const el = document.createElement("div");
      // bg-mat: the same live --color-mat token the midground and nav track
      // (global.css) — shapes carry no color of their own, so the morph
      // comes for free from the mechanism that already writes --color-mat
      // every scrubbed frame. No polling, no event wiring: this component
      // just references a token by name.
      //
      // mix-blend-multiply here (child level) blends overlapping shapes with
      // *each other* — two overlapping shapes read as compounded-darker than
      // either alone. This is a separate responsibility from the container's
      // own mix-blend-mode in ScrollShapes.astro, which blends the layer as a
      // whole against the mat *outside* this stacking context. See the
      // comment there for why both are needed.
      el.className = "absolute top-0 bg-mat mix-blend-multiply";

      const attrs = randomizeAttrs(config, sizePool[i]);
      const scrollEntry = zoneStart + i * segment + rand(0, segment);

      const shape: Shape = { el, scrollEntry, entranceOffset: 0, ...attrs };

      // The entrance ("fly in from below, then stop exactly where the
      // formula already puts it") must only touch shapes that would
      // actually be visible right now — restY is this shape's position
      // with zero entranceOffset, i.e. exactly what positionShape would
      // already compute. A shape that's naturally off-screen (above OR
      // below the fold) needs no push at all: forcing one on it would make
      // it visibly sweep THROUGH the viewport while its offset eases away,
      // even though it was never meant to be seen at all — a phantom shape
      // "flying in from nowhere" that isn't actually part of the entrance.
      const restY = vh - (window.scrollY - scrollEntry) * shape.speed;
      const visibleAtRest = restY < vh && restY + shape.h > 0;
      shape.entranceOffset = visibleAtRest
        ? Math.max(0, vh - restY) + ENTRANCE_PUSH_BUFFER_PX
        : 0;

      applyAttrs(shape);
      container.appendChild(el);
      // Position before first paint so a fresh load never shows a shape
      // sitting at its default (untransformed) spot, or — for a
      // visible-at-rest shape — anywhere but already pushed below the
      // fold, ready for its entrance.
      positionShape(shape, window.scrollY);
      shapes.push(shape);
    }

    activeTicker = () => {
      const scrollY = window.scrollY;
      for (const shape of shapes) positionShape(shape, scrollY);
    };
    gsap.ticker.add(activeTicker);

    // Eases every shape's own entranceOffset to 0 in parallel (harmless,
    // instant no-op for the shapes that were already at 0). The ticker
    // above reads shape.entranceOffset fresh every frame via
    // positionShape, so tweening the property directly on each shape
    // object "just works" without touching gsap.set(shape.el) here or
    // fighting the ticker's own per-frame writes. GSAP tweens plain object
    // properties in an array just as well as DOM styles — same technique
    // components/stage/motion-script.ts uses for its wobble offsets.
    activeEnterListener = () => {
      gsap.to(shapes, {
        entranceOffset: 0,
        duration: config.entranceDurationMs / 1000,
        ease: config.entranceEase,
      });
    };
    document.addEventListener("bh:paper-entered", activeEnterListener);
  }
}
