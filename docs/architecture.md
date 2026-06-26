# Architecture

How the site is structured and — just as important — how it stays *un*-locked so we can
break our own rules later without hacking at shared code.

---

## The three layers

Every animated page renders three stacked layers, back to front:

1. **Background** — a flat fill (`--color-background`, white to start). Owned by
   `Base.astro`. It rarely changes.

2. **Midground** — a near-rectangular SVG polygon (~8 vertices) filled with
   `--color-midground`. It does **not** translate as a whole; instead each vertex drifts
   independently within a small range, so the edges feel quietly alive. This lives in
   `Base.astro` too, so it **persists across chapters** — papers come and go in front of
   it while it stays put. Its motion is ambient and continuous, unrelated to scroll.
   See `motion.md` → "The ambient octagon."

   > "Octagon" is shorthand. The exact vertex count and positions are a tunable detail,
   > not a contract. Start rough; refine later. It should read as a rectangle at a glance.

3. **Foreground** — the "paper": a rectangle (`--color-foreground`) that holds a
   chapter's content. Provided by `Chapter.astro`. **One paper per chapter**; on scroll
   it flies away and the next chapter's paper arrives.

---

## Pages are ordered lists of chapters

A page is not a hand-built scroll of sections. It is a manifest: an ordered list of
chapters plus a flag for whether the scroll engine is active. See
`authoring-content.md` for the `pages.ts` shape.

This is what makes "more or fewer chapters" a one-line edit and "reorder chapters" a
reshuffle of a list. The engine renders whatever list it's handed and knows nothing
about how many there are.

---

## A chapter has two decoupled parts

- **content** — `Content.astro`, the markup. Organized as optional `header` / `main` /
  `footer` slots, where `main` accepts arbitrary markup.
- **motion** — `motion.ts`, which describes how the chapter enters and leaves.

They live side by side in the chapter's folder but never depend on each other. You can
swap a chapter's content from a paragraph to an image grid without touching its motion,
and retime its motion without touching its content.

---

## The engine's contract is deliberately small

The scroll engine knows about exactly one thing: **elements that enter and leave on
scroll.** It does *not* know what a "paper" is, or that papers fly upward. Each chapter
hands the engine a small set of hooks (an enter and an exit), and the engine sequences
them against scroll progress via a pinned ScrollTrigger.

Keeping the contract this small is what lets a chapter do something completely different
without the engine caring. The default fly-away is supplied by a preset, not welded into
the engine.

---

## The escape-hatch ladder

The framework is a set of conveniences, not a cage. When you want to do something it
didn't anticipate, you **use less of the framework** — you don't modify it. Each rung
below just opts out of one more convenience:

1. **Use the defaults.** Put content in the slots, name a motion preset. The common path.
2. **Bespoke motion, normal content.** Write a chapter's `motion.ts` to compose GSAP
   directly instead of naming a preset. Presets are a library, never a requirement.
3. **Bespoke content shape.** Skip header/main/footer and write a custom content
   component. The engine only needs the chapter's enter/exit hooks; the markup is yours.
4. **Normal-scroll page.** Set `useScrollEngine: false` in `pages.ts`. That page renders
   in ordinary document flow — write any HTML, ignore the paper metaphor entirely.
5. **Fully bespoke page.** A page is ultimately just an `.astro` file. Give it a
   different layout, or no shared layout at all.

You never edit shared code to climb down this ladder.

---

## The one honest exception

There is exactly one kind of change that *does* mean editing shared code: changing the
engine's **fundamental default behavior** for everyone — e.g. deciding chapters should
cross-fade and overlap instead of fly-away-then-arrive. That's an edit to
`motion/engine.ts` and/or the default preset. But because the engine is a single
isolated module with a clear contract, it's a contained change in a known place, not a
hunt across the codebase. And even then, a single page can be handed an engine variant
without disturbing the others. So even "rewrite the rules" has a clean address.
