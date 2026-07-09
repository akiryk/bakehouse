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
 *     plays on every load" needs. This is the enter hook.
 */
import gsap from "gsap";
import { octagonController } from "./octagon";
import { pageTransition } from "../config/page-transition";

/** Set by runExit(), read by runEnter() — the mat only needs to spring back
 * if this navigation actually expanded it. Without this guard, the very
 * first (cold) astro:page-load would call springToHome() on a mat that was
 * never expanded, interrupting its ambient wobble mid-leg for no reason
 * (killTweensOf + a tween to {dx:0,dy:0} is a visible "snap toward center"
 * even when nothing needed correcting). Module-level state is safe here
 * because this script only ever executes once per session (see the header
 * comment) — the same closure persists across every navigation. */
let didExpand = false;

/** octagonController.expandToEdges/springToHome and the opacity tweens below
 * are all directly callable regardless of motion preference — they don't
 * check prefers-reduced-motion themselves (they're imperative methods, not
 * a persistent gsap.matchMedia() context like octagon.ts's own ambient
 * wobble). This module is what decides whether to invoke them at all. */
function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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

/** Mat expand + content fade, in parallel, over the same duration. Under
 * reduced motion, resolves immediately — the navigation proceeds at
 * whatever speed the fetch itself takes, no animation delay added. */
async function runExit(): Promise<void> {
  if (prefersReducedMotion()) return;
  didExpand = true;
  await Promise.all([
    octagonController.expandToEdges(pageTransition.exitDurationMs),
    fadeOutContent(pageTransition.exitDurationMs),
  ]);
}

/** Fades the incoming page's paper in from 0. Not gated on didExpand — per
 * the product decision, this plays on every load, cold or in-app, so a
 * direct/refreshed load of any page gets the same reveal moment.
 *
 * Starts from a plain gsap.to(), not fromTo() — the 0 starting state is
 * baked into the SSR markup (opacity-0 class in Base.astro) rather than
 * forced here via immediateRender, which was measurably causing a flash
 * (content briefly visible at full opacity, then snapped to 0, then faded
 * back in) on a cold load, before this element's own animation had a
 * chance to run.
 *
 * delayMs uses GSAP's own `delay`, not setTimeout — the tween is scheduled
 * synchronously either way; only when it visibly starts is offset. */
function fadeInPaper(durationMs: number, delayMs = 0): void {
  const stage = document.querySelector<HTMLElement>(".foreground-stage");
  if (!stage) return;
  gsap.to(stage, {
    opacity: 1,
    duration: durationMs / 1000,
    delay: delayMs / 1000,
    ease: pageTransition.enterPaperEase,
  });
}

/** Toggles the persisted nav's active-link color to match the current URL.
 * Nav.astro's SSR output only reflects whichever page it was FIRST rendered
 * on (transition:persist means the node — and its baked-in classes — never
 * re-renders on a later swap), so this is the only thing that keeps it
 * correct across an SPA navigation. Runs immediately on astro:page-load,
 * not gated behind the mat/paper sequence — there's no reason to delay a
 * plain class toggle. Services/Work are still href="#" placeholders, not
 * real routes — a.pathname for those would resolve to the *current* page
 * (a bare "#" href resolves against the current URL), so they're excluded
 * rather than being incorrectly matched as "active". */
function updateNavActiveState(): void {
  document.querySelectorAll<HTMLAnchorElement>("nav a[href]").forEach((a) => {
    if (a.getAttribute("href") === "#") return;
    const isActive = a.pathname === location.pathname;
    a.classList.toggle("text-ink", isActive);
    a.classList.toggle("text-nav-text", !isActive);
  });
}

/** Mat spring-back and paper fade-in start together (only if this
 * navigation actually expanded the mat) — overlapping, not sequential.
 * enterPaperDelayMs offsets how long after the mat starts springing the
 * paper begins fading in; 0 means both start at the same instant. On a
 * cold load (mat was never expanded, nothing to overlap with) the paper
 * just fades in immediately, ignoring that delay. Under reduced motion,
 * skips both tweens and jumps the paper straight to visible — content
 * must still be reachable without motion (CLAUDE.md), and since runExit()
 * never expanded the mat for a reduced-motion navigation, didExpand is
 * already false here too. */
async function runEnter(): Promise<void> {
  if (prefersReducedMotion()) {
    const stage = document.querySelector<HTMLElement>(".foreground-stage");
    if (stage) gsap.set(stage, { opacity: 1 });
    return;
  }

  const matSpringing = didExpand;
  didExpand = false;

  const matPromise = matSpringing
    ? octagonController.springToHome(pageTransition.enterMatDurationMs)
    : Promise.resolve();

  fadeInPaper(
    pageTransition.enterPaperDurationMs,
    matSpringing ? pageTransition.enterPaperDelayMs : 0,
  );

  await matPromise;
}

export function initPageTransitions(): void {
  document.addEventListener("astro:before-preparation", (event) => {
    const originalLoader = event.loader;
    event.loader = async () => {
      await Promise.all([runExit(), originalLoader()]);
    };
  });

  document.addEventListener("astro:page-load", () => {
    updateNavActiveState();
    runEnter();
  });
}
