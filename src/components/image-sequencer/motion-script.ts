/**
 * Assigns src to every img[data-src] in DOM order (== visible order here),
 * imageConcurrency at a time — the replacement for native loading="lazy",
 * which can't help on this site: rows are absolutely positioned and
 * transform-hidden off-screen, so the browser's viewport heuristic never
 * sees them the way a user scrolling down would. See docs/image-loading.md.
 *
 * Safe to call repeatedly (cold load and every SPA navigation back into a
 * page that uses it): an image loses its data-src attribute the moment
 * it's claimed, so querySelectorAll only ever returns unclaimed images.
 *
 * Runs unconditionally, including under prefers-reduced-motion — reduced
 * motion governs animation, not resource loading; gating fetches on it
 * would strand content behind a media query that has nothing to do with
 * whether an image loads.
 */
import { imageSequencer } from "./config";

export function runImageSequencer(root: ParentNode = document): void {
  const images = Array.from(
    root.querySelectorAll<HTMLImageElement>("img[data-src]"),
  );
  if (images.length === 0) return;

  let next = 0;
  function loadNext(): void {
    const img = images[next++];
    if (!img) return;

    const src = img.dataset.src;
    delete img.dataset.src;
    if (!src) {
      loadNext();
      return;
    }

    img.addEventListener("load", loadNext, { once: true });
    img.addEventListener(
      "error",
      () => {
        console.error(`image-sequencer: failed to load "${src}"`);
        loadNext();
      },
      { once: true },
    );
    img.src = src;
  }

  const workers = Math.max(1, imageSequencer.imageConcurrency);
  for (let i = 0; i < workers; i++) loadNext();
}
