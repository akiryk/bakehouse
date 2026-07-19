/**
 * Per-page bootstrapping, dispatched by Base.astro's own <script> on every
 * astro:page-load (cold load or SPA navigation — see components/page-transitions/motion-script.ts's
 * header comment for why that event is the single right hook for both).
 *
 * This exists because data-astro-rerun — the attribute that would otherwise
 * make a page's own <script> tag re-execute on a repeat visit — cannot be
 * combined with module processing at all: any inline-content script with
 * an extra attribute is forced into unprocessed is:inline treatment (no
 * imports, no TS), and Astro's compiler explicitly rejects combining
 * data-astro-rerun with `src` on the same tag ("two out of three is OK:
 * type=module, src, or data-astro-rerun" — confirmed via `astro check`,
 * not assumed). So the previous design — each page's own bundled <script>
 * calling initPageEngine directly — could never be made to re-run without
 * giving up bundling entirely.
 *
 * Instead, this file is imported ONCE by Base.astro's own script (which
 * never needs to re-run — it's the thing REGISTERING the astro:page-load
 * listener that fires on every future navigation), and dispatch happens by
 * page identity (Base.astro's `page` prop, rendered as
 * document.body.dataset.page) rather than by re-executing a page-specific
 * script tag at all.
 *
 * Each function dynamically imports its page's script/chapter motions so
 * Vite still code-splits them into separate chunks — Home's JS payload
 * doesn't need to include About's chapter code, and vice versa.
 */
import {
  initPageEngine,
  type ChapterMotion,
} from "../components/scroll-engine/motion-script";
import { pages } from "../components/page-system/config";
import type { PageConfig } from "../components/page-system/config";

async function exposeBeatModelForDevtools(
  model: Awaited<ReturnType<typeof initPageEngine>>,
): Promise<void> {
  if (!import.meta.env.DEV || !model) return;
  (window as any).__beatModel = model;
  const { initBeatRuler } = await import("../dev/beat-ruler");
  initBeatRuler(model);
}

export async function initHomePage(): Promise<void> {
  const [{ PAGE }, introMotion, servicesMotion, timelineMotion] =
    await Promise.all([
      import("../pages/home/motion-script"),
      import("../pages/home/_chapters/01-intro/motion-script").then(
        (m) => m.default,
      ),
      import("../pages/home/_chapters/02-services/motion-script").then(
        (m) => m.default,
      ),
      import("../pages/home/_chapters/03-timeline/motion-script").then(
        (m) => m.default,
      ),
    ]);

  const model = initPageEngine(pages.home, PAGE, [
    introMotion,
    servicesMotion,
    timelineMotion,
  ]);
  await exposeBeatModelForDevtools(model);

  // ScrollShapes.astro renders only the container + its config (as a
  // data-config JSON attribute) — the actual init call lives here, for the
  // same data-astro-rerun/bundling reason as the rest of this file. A page
  // that doesn't mount <ScrollShapes /> simply has no matching container,
  // so this is a no-op there.
  const shapesContainer = document.querySelector<HTMLElement>(
    '[data-el="scroll-shapes"]',
  );
  if (shapesContainer) {
    const { initScrollShapes } =
      await import("../components/scroll-shapes/motion-script");
    const config = JSON.parse(shapesContainer.dataset.config ?? "{}");
    initScrollShapes(shapesContainer, config);
  }
}

export async function initAboutPage(): Promise<void> {
  const [{ PAGE }, aboutMotion] = await Promise.all([
    import("../pages/about/motion-script"),
    import("../pages/about/_chapters/about/motion-script").then(
      (m) => m.default,
    ),
  ]);

  const model = initPageEngine(pages.about, PAGE, [aboutMotion]);
  await exposeBeatModelForDevtools(model);
}

export async function initWorkPage(): Promise<void> {
  const [{ PAGE }, browseMotion] = await Promise.all([
    import("../pages/work-browse/motion-script"),
    import("../pages/work-browse/_chapters/browse/motion-script").then(
      (m) => m.default,
    ),
  ]);

  const model = initPageEngine(pages.work, PAGE, [browseMotion]);
  await exposeBeatModelForDevtools(model);
}

/**
 * Work-detail's PageConfig isn't looked up from the static `pages` map
 * above — unlike every other page, its chapter count varies per project,
 * so it's built here from that project's own hero-content, the same
 * "compute, don't hand-author" pattern its page script already follows
 * (see work-detail/motion-script.ts's header comment).
 */
export async function initWorkDetailPage(): Promise<void> {
  const slug = document.body.dataset.slug;
  if (!slug) return;

  const [{ heroContent }, { buildHeroPageScript, chapterIdsFor }] =
    await Promise.all([
      import("../pages/work-detail/hero-content"),
      import("../pages/work-detail/motion-script"),
    ]);

  const heroes = heroContent[slug] ?? [];
  const ids = chapterIdsFor(heroes);

  const config: PageConfig = {
    useScrollEngine: true,
    matColor: "--palette-slate-light",
    chapters: ids.map((id) => ({
      id,
      motionPath: `work-detail (data-driven, slug: ${slug})`,
    })),
  };
  const chapterMotions: ChapterMotion[] = ids.map(() => ({}));

  const model = initPageEngine(
    config,
    buildHeroPageScript(heroes),
    chapterMotions,
  );
  await exposeBeatModelForDevtools(model);
}
