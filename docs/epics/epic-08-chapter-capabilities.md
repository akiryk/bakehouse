# Epic 08 — Chapter-system capabilities

**Goal:** add three reusable capabilities to the chapter system, proven with a **placeholder**
second chapter. These are engine features every future chapter draws on — not chapter-2
content (that's Epic 09). Build and verify the machinery first, on throwaway content.

**In scope:** (A) per-chapter midground color that morphs on transition + nav follows it,
(B) a paperless chapter variant, (C) intra-chapter scroll beats. Plus a placeholder chapter
exercising all three.

**Out of scope:** the real chapter-2 copy/font/white text (Epic 09).

**Don't touch:** the mat geometry/wobble, the paper shadow (Epic 07), chapter 1's content or
its fly-away.

---

## A. Per-chapter midground color + morph + nav-follow

- **Palette tokens.** Define the possible midground colors as tokens in the global token
  layer — e.g. `--midground-tan: #cfc6b6` (base) and `--midground-slate: #c1caca`. Keep the
  **live** value in `--color-midground`; the engine drives it. (No hardcoded hex in chapter
  config — chapters reference a palette token.)
- **Per-chapter declaration.** A chapter declares its midground (in its `pages.ts` entry),
  defaulting to the base tan. Chapter 1 = tan; the placeholder chapter = slate.
- **Morph on transition.** As one chapter leaves and the next enters, the engine
  **interpolates `--color-midground`** from the outgoing color to the incoming one across the
  transition scroll range — scrubbed, so it morphs gradually (not a jump). Two clean
  techniques; CC picks and reports which: register `--color-midground` with `@property` as
  `<color>` and let it interpolate, or scrub a proxy `0→1` and set the var via
  `gsap.utils.interpolate(colorA, colorB, t)` in `onUpdate`. Either way it must be smooth.
- **Nav follows for free.** Change `--color-nav-text` from a duplicated hex to
  `var(--color-midground)`. The nav color then tracks the morph with no extra animation.

## B. Paperless chapter variant

`Chapter.astro` gains a `paper` prop (default `true`). When `false`, it skips the white
card and its shadow and centers its content directly on the midground. This is rung 3 of the
escape-hatch ladder — reusable for any full-bleed chapter.

## C. Intra-chapter scroll beats

Until now a chapter enters and exits as a unit. Add **internal beats**: a chapter can be
**pinned** for a scroll distance long enough to hold its beats, and its `motion.ts` defines a
**scrubbed timeline** over that range that reveals/moves its content blocks in sequence
(block A appears; on further scroll block B fades in while A shifts up; both remain).

- Same **presets + bespoke** pattern as the rest of the motion system: add beat presets for
  the common cases (`fadeInUp`, `shiftUp`), with raw GSAP as the escape hatch.
- Reduced motion: content blocks simply appear in place, all reachable; no pinned scrub.

This is the foundational one — get the shape right; every future multi-part chapter inherits
it.

---

## Steps

Per `CLAUDE.md` → **How we work**: autonomous; verify against the rendered result; note;
continue unless a real question.

1. **Palette + live var + nav.** Add the palette tokens; make `--color-midground` the live
   value; point `--color-nav-text` at `var(--color-midground)`. *Verify:* nav still matches
   the mat; nothing else changed.
2. **Per-chapter color + morph.** Chapter declares its midground; engine scrubs
   `--color-midground` between adjacent chapters' colors across the transition. *Verify:*
   scrolling the transition morphs the color **gradually**, and the nav tracks it.
3. **Paperless variant.** `Chapter.astro` `paper={false}` skips card+shadow, centers content
   on the mat. *Verify:* a paperless chapter shows content directly on the midground, no card.
4. **Scroll beats.** Pin-for-beats + scrubbed `motion.ts` timeline + `fadeInUp`/`shiftUp`
   presets; reduced-motion branch. *Verify:* within one chapter, block A shows, then on
   scroll block B fades in as A shifts up; both remain.
5. **Placeholder chapter.** Add a throwaway second chapter (placeholder text) that is
   paperless, declares the slate color, and has two beats — exercising A+B+C together.
   *Verify:* scrolling ch1→placeholder morphs tan→slate (nav follows), the placeholder is
   paperless, and its two beats play; all scrubbed and reduced-motion-safe.
6. **Docs.** `motion.md`: the color-morph and scroll-beat models. `authoring-content.md`:
   the `paper={false}` variant, how a chapter declares its midground, and how to add beats.

## Done when

Scrolling from chapter 1 to the placeholder chapter morphs the midground tan→slate gradually
(nav color following), the placeholder is paperless with content centered on the mat, and its
content reveals in two scroll beats (a block appears, then a second fades in as the first
shifts up) — all scrubbed and reduced-motion-safe. Content is placeholder; Epic 09 makes it
real.
