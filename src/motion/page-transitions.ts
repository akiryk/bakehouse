/**
 * Cross-page transition — the exit/enter sequence for Astro's ClientRouter.
 *
 * Astro's own default crossfade is disabled (transition:animate="none" on
 * <html> in Base.astro); this module is the only thing that animates a
 * navigation. It hooks the router's lifecycle events directly rather than
 * Astro's transition:animate directives, because the sequence needed here
 * is strictly ordered (expand, THEN contract, THEN reveal) — not a
 * simultaneous crossfade, which is all transition:animate can express.
 *
 * Lifecycle (confirmed against the installed Astro version's own source,
 * node_modules/astro/dist/transitions/events.js — not assumed from docs):
 *   astro:before-preparation  → event.loader() is awaited immediately after
 *     this event's listeners run synchronously, and reassigning
 *     event.loader in a listener genuinely gates the navigation on it. This
 *     is the exit hook: the destination fetch (the original loader) and the
 *     exit animation run concurrently via Promise.all, so a slow connection
 *     doesn't add fetch time on top of the animation.
 *   astro:before-swap / astro:before-swap → DOM swap happens here, outside
 *     this module's concern.
 *   astro:page-load → fires after every swap AND on a cold `window load` —
 *     one code path for both, which is exactly what "the enter animation
 *     plays on every load" needs. Enter is wired here in a later step.
 */
import gsap from "gsap";
import { octagonController } from "./octagon";
import { pageTransition } from "../config/page-transition";

/** Fades whatever primary content is on screen. `.foreground-stage` exists
 * on every page (rendered unconditionally by Base.astro); the scroll-shapes
 * layer only exists on pages that mount it (currently just home) — querying
 * for it and filtering out `null` keeps this page-agnostic without a
 * per-page branch. */
function fadeOutContent(durationMs: number): Promise<void> {
  const targets = [
    document.querySelector<HTMLElement>(".foreground-stage"),
    document.querySelector<HTMLElement>('[data-el="scroll-shapes"]'),
  ].filter((el): el is HTMLElement => el !== null);

  if (targets.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    gsap.to(targets, {
      opacity: 0,
      duration: durationMs / 1000,
      ease: pageTransition.exitEase,
      onComplete: () => resolve(),
    });
  });
}

/** Mat expand + content fade, in parallel, over the same duration. */
async function runExit(): Promise<void> {
  await Promise.all([
    octagonController.expandToEdges(pageTransition.exitDurationMs),
    fadeOutContent(pageTransition.exitDurationMs),
  ]);
}

export function initPageTransitions(): void {
  document.addEventListener("astro:before-preparation", (event) => {
    const originalLoader = event.loader;
    event.loader = async () => {
      await Promise.all([runExit(), originalLoader()]);
    };
  });
}
