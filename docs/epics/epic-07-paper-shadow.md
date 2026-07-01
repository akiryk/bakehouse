# Epic 07 — The paper shadow

**Goal:** give the letter paper a refined, asymmetric drop shadow — the look of one corner
lifting slightly off the surface — built as a blurred pseudo-element behind the card and
driven entirely by a small set of CSS variables, so it's tweakable by changing one number.
This **supersedes** the `--shadow-paper` `box-shadow` from Epic 03; that token is retired so
there's one shadow mechanism, not two.

**In scope:** the `.paper` layering model, the `::before` shadow rectangle, the
`--paper-shadow-*` tokens, retiring `--shadow-paper`, and a scroll-perf check.

**Out of scope:** the card's own slight rotation/tilt (a separate tweak if wanted later);
the irregular Illustrator silhouette (see *Upgrade path*); the mat; the scroll engine logic.

**Don't touch:** the mat, the scroll engine's behavior (only verify perf), chapter content.

---

## The model

Keep it simple — **no `clip-path` polygons, no coordinate puzzles.** The shadow is just a
plain rectangle, slightly **smaller** than the card, **offset** toward one corner and
**rotated** a degree or two, then **blurred**. Because it's smaller and rotated, the blur
reveals mainly at one corner/edge — exactly the lifting-corner effect — with none of the
polygon math (a blurred rectangle's edges are soft anyway, so the irregularity isn't worth
chasing).

Layering (do **not** use `z-index: -1`):

- `.paper` — positioning wrapper / shadow stage: `position: relative; isolation: isolate;`
  (the `isolation` is what lets the pseudo-element sit behind the content without negative
  z-index). **No `overflow: hidden`** on `.paper` — it would clip the blur.
- `.paper::before` — the shadow rectangle, behind the content, taking color/opacity/blur
  from the tokens, inset from the card edges, transformed by offset + rotate.
- `.paper-content` — the crisp white card: `position: relative; z-index: 1`, above the
  shadow. The shadow must **never** overlay the content.

Only reach for a second `.paper::after` (a darker, tighter contact shadow) **if a single
layer looks flat** — and if so, make it token-driven too.

## The tokens (the actual deliverable)

Define these where our other design tokens live (the global token layer, alongside where
`--shadow-paper` was — `:root` in `global.css` is the natural home since several aren't
Tailwind-utility types). Report where they land. Each is one number to tweak:

```
--paper-shadow-color      /* reference an existing dark/ink token, not a raw hex */
--paper-shadow-opacity
--paper-shadow-blur
--paper-shadow-inset       /* how much smaller the shadow rect is than the card */
--paper-shadow-offset-x
--paper-shadow-offset-y
--paper-shadow-rotate      /* the slight angle (relative to the card) that reveals the
                              shadow at a corner — this is the key dial for the effect */
```

The reveal comes from the shadow being rotated/offset **relative to the card**; if the card
is later given its own tilt, this rotate is measured against it.

## Retire `--shadow-paper`

Remove the Epic 03 `box-shadow: var(--shadow-paper)` from the paper and delete the token.
One shadow system on the card, not two. Update `design-tokens.md` accordingly.

## Scroll-perf check (real, not theoretical)

The paper is the foreground that **flies away on scroll** in the chapter system. A heavy
`blur()` that transforms during that animation can cost paint. Keep the fly-away a pure
transform (translate) so the blurred shadow layer is rasterized once and just moved, and
promote the shadow layer if needed (`will-change: transform` / its own compositing layer).
**Verify the fly-away is smooth with the shadow present;** if it janks, the fix is promoting
the layer, not removing the shadow.

---

## Steps

Per `CLAUDE.md` → **How we work**: autonomous; verify against the rendered result; note;
continue unless a real question.

1. **Layering.** Wrap the card as `.paper` > `.paper-content` with `isolation: isolate`, no
   `overflow: hidden`, content at `z-index: 1`. *Verify:* content unchanged and crisp; no
   negative z-index used.
2. **Shadow + tokens.** Add `.paper::before` as the smaller, offset, rotated, blurred
   rectangle driven by the `--paper-shadow-*` tokens; define the tokens in the global token
   layer; color references an existing token. *Verify:* the shadow reveals at one corner,
   reads as a soft lift, and never covers the content. Tweak one token (e.g. `rotate`) and
   confirm the single-number control works.
3. **Retire the old shadow.** Remove the `--shadow-paper` `box-shadow` and the token.
   *Verify:* only the new shadow remains; nothing else referenced `--shadow-paper`.
4. **Perf.** Confirm the paper's fly-away on scroll stays smooth with the blurred shadow;
   promote the layer if needed. *Verify:* no jank on the exit at a normal window.
5. **Docs.** In `design-tokens.md`, record the `--paper-shadow-*` tokens and remove
   `--shadow-paper`. *Verify:* no stale `--shadow-paper` reference remains in docs or code.

## Upgrade path (not now)

If you later want the irregular Illustrator silhouette, swap the `::before` rectangle for a
`clip-path` on that one pseudo-element — the layering model and tokens stay; only the shape
changes. Don't build it this epic.

## Done when

The paper has a soft, asymmetric corner-lift shadow built from a single blurred
pseudo-element rectangle, every aspect controlled by a `--paper-shadow-*` token (one number
each), the old `--shadow-paper` is gone, and the paper's scroll fly-away stays smooth.
