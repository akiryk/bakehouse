/**
 * Work-detail page script — unlike every other page, this isn't a single
 * hand-authored `PAGE` constant: the number of chapters varies per project
 * (2, 3, 4 heroes), so the page script itself is computed from that
 * project's own hero-content, the same "compute, don't hand-author" spirit
 * work-browse/motion-script.ts already uses for its total beat length —
 * just extended one step further to also vary chapter *count*.
 *
 * Each hero's paper (if any) and image are independent page-level
 * chapters, not one chapter's internal choreography — chapter()/enter()/
 * exit() already give every chapter its own timing/easing/fade for free.
 * A hero's image can't begin its own exit until its paper's exit has
 * finished (paper leaves first, fully, then the image follows).
 *
 * One pair is NOT independent, on purpose: image N's exit and image N+1's
 * entrance share duration, easing, and an equal-but-opposite distance
 * (IMAGE_TRANSITION_VH, config.ts) so the leaving and arriving images stay
 * perfectly edge-to-edge ("locked") through the whole transition, not just
 * at its start and end — see config.ts's own comment for the math this
 * relies on.
 *
 * chapterIdsFor() and buildHeroPageScript() must derive chapter identity
 * from the exact same walk over `heroes`, in the exact same order Content
 * .astro renders them in — the engine maps rendered [data-chapter]
 * elements to PageConfig.chapters by index, so the two can never drift
 * apart as long as both walk the same array the same way.
 */
import {
  definePageScript,
  at,
  chapter,
  enter,
  exit,
  type PageSequenceEntry,
  type PageScript,
} from "@components/page-system/motion-script";
import { hold } from "@components/timeline/motion-script";
import { heroDefaults, doneMotion, IMAGE_TRANSITION_VH } from "./config";
import type { Hero } from "./hero-content";

/** Ordered chapter ids for a project's heroes, plus the trailing "done". */
export function chapterIdsFor(heroes: Hero[]): string[] {
  const ids: string[] = [];
  heroes.forEach((hero, i) => {
    if (hero.paper) ids.push(`hero-paper-${i}`);
    ids.push(`hero-image-${i}`);
  });
  ids.push("done");
  return ids;
}

export function buildHeroPageScript(heroes: Hero[]): PageScript {
  const sequence: PageSequenceEntry[] = [];
  // Two cursors, tracking different things: exitStartCursor is when the
  // PREVIOUS hero's image began leaving — the next hero's own entrance
  // starts from there (+ gapBeforeBeats), so by default (gap 0) the two
  // cross paths and something is always on screen ("abut" — no beat where
  // neither image is visible). fullyGoneCursor is when it's actually
  // finished leaving, which is what "done" waits for at the very end.
  let exitStartCursor = 0;
  let fullyGoneCursor = 0;

  heroes.forEach((hero, i) => {
    const m = { ...heroDefaults, ...hero.motion };
    const start = i === 0 ? 0 : exitStartCursor + m.gapBeforeBeats;
    // The very first hero needs no enter() at all — like home's intro
    // chapter, it's simply rendered at rest from page load; only heroes
    // after it rise into place as the previous one leaves.
    const isFirst = i === 0;
    const imageEnterOver = isFirst ? 0 : m.imageEnterBeats;
    const paperEnterOver = isFirst ? 0 : m.paperEnterBeats;

    if (!isFirst) {
      sequence.push(
        at(
          start,
          enter(`hero-image-${i}`, {
            over: m.imageEnterBeats,
            ease: m.imageEnterEase,
            from: { y: `${IMAGE_TRANSITION_VH}vh` },
          }),
        ),
      );
    }

    let imageExitStart: number;

    if (hero.paper) {
      const paperExitStart =
        start + Math.max(paperEnterOver, imageEnterOver) + m.dwellBeats;
      if (!isFirst) {
        sequence.push(
          at(
            start,
            enter(`hero-paper-${i}`, {
              over: m.paperEnterBeats,
              ease: m.paperEnterEase,
            }),
          ),
        );
      }
      sequence.push(
        at(start, chapter(`hero-paper-${i}`, { dwellBeats: m.dwellBeats })),
        at(
          paperExitStart,
          exit(`hero-paper-${i}`, {
            over: m.paperExitBeats,
            ease: m.paperExitEase,
            ...(m.paperExitFade ? { to: { opacity: 0 } } : {}),
          }),
        ),
      );
      // The image can't start leaving until the paper is fully gone.
      imageExitStart = paperExitStart + m.paperExitBeats;
    } else {
      imageExitStart = start + imageEnterOver + m.dwellBeats;
    }

    sequence.push(
      at(
        start,
        chapter(`hero-image-${i}`, { dwellBeats: imageExitStart - start }),
      ),
      at(
        imageExitStart,
        exit(`hero-image-${i}`, {
          over: m.imageExitBeats,
          ease: m.imageExitEase,
          to: {
            y: `-${IMAGE_TRANSITION_VH}vh`,
            ...(m.imageExitFade ? { opacity: 0 } : {}),
          },
        }),
      ),
    );

    exitStartCursor = imageExitStart;
    fullyGoneCursor = imageExitStart + m.imageExitBeats;
  });

  sequence.push(
    at(
      fullyGoneCursor,
      enter("done", {
        over: doneMotion.enterBeats,
        ease: doneMotion.enterEase,
      }),
    ),
    at(fullyGoneCursor, chapter("done", { dwellBeats: 1 })),
  );

  sequence.push(at(fullyGoneCursor + doneMotion.enterBeats + 1, hold(1)));

  return definePageScript({ sequence });
}
