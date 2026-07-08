# Navigation

The site navigation is a persistent horizontal list fixed to the top-right of the viewport, always visible above the midground mat and the scroll-shapes ambient layer.

## Stacking and background

The nav sits at `--z-nav: 25`, above `--z-shapes: 20` — the ambient scroll-shapes layer is
purely decorative (see `docs/scroll-shapes.md`) and must never render on top of real UI.
The white backing (`--color-nav-background`) keeps it legible against the mat and shapes
regardless of z-order — text color alone (`--color-nav-text`, which tracks the live mat
color) isn't enough once shapes can pass behind it. The shapes layer is
`pointer-events: none`, so hover/click on nav links were never blocked by it; the fix was
purely about paint order and contrast.

## Backdrop (rotated paper)

The white background isn't on `<nav>` itself — it's a separate `.nav-backdrop` div, a
sibling of the `<ul>`, absolutely positioned and tilted `rotate(-0.5deg)` — mirroring
`.logo-backdrop`'s `0.5deg` in `Base.astro` (opposite corner, opposite direction).
`<nav>` stays unrotated (it's the fixed positioning
anchor); only the backdrop tilts, and the `<ul>` (given `position: relative` so it's
promoted into the same "positioned, z-index:auto" paint bucket) renders on top of it
purely by DOM order — no explicit z-index needed between the two.

The backdrop extends past `<nav>`'s own box on each side independently via the
`--nav-backdrop-inset-{top,right,bottom,left}` tokens in `global.css`'s `:root` block —
the right inset is deliberately generous so the tilted edge clears the viewport rather
than showing a seam. Tune padding per side there, not in `Nav.astro`. There's no drop
shadow on the backdrop currently (unlike the logo's `.logo-shadow-wrap`/`-shape` layers) —
add one the same way if it's ever wanted.

The offsets and rotation live in `Nav.astro`'s scoped `<style>` block rather than Tailwind
utilities: Tailwind has no way to express four independent, non-scale inset values plus a
fractional-degree rotation without arbitrary bracket syntax, which the project's Tailwind
conventions disallow. This mirrors `.logo-backdrop`, which hits the same wall.

## File location

```
src/components/Nav.astro
```

It is mounted directly in `src/layouts/Base.astro` (the root layout), so it appears on every page automatically.

## Styling

Almost every property is a Tailwind utility class applied directly in the markup. The one
exception is the backdrop's offsets/rotation (see **Backdrop** above), which live in a
scoped `<style>` block for the reason explained there. `right-(--mat-safe-inset-x)` and
`z-25` reference the same named tokens (`--mat-safe-inset-x`, `--z-nav`) as CSS-variable/
bare-numeral utilities rather than arbitrary values (see CLAUDE.md's Tailwind conventions).

| Property              | Value                                                            | Where it's set                                                      |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Position              | `fixed; top: 24px; right: --mat-safe-inset-x`                    | `fixed top-6 right-(--mat-safe-inset-x)` on `<nav>`                 |
| Z-index               | `--z-nav` (25, above `--z-shapes` at 20)                         | `z-25` on `<nav>`                                                   |
| Background            | `--color-nav-background` (white)                                 | `bg-nav-background` on `.nav-backdrop`                              |
| Backdrop offsets/tilt | `--nav-backdrop-inset-*` tokens; `rotate(-0.5deg)`               | `.nav-backdrop` scoped style in `Nav.astro`; tokens in `global.css` |
| Color (resting)       | `--color-nav-text` (#cfc6b6); `--color-ink` for the current item | `text-nav-text` / `text-ink` on each `<a>`                          |
| Color (hover)         | `--color-ink` (#79530b)                                          | `hover:text-ink` on each `<a>`                                      |
| Font                  | `--font-sans` → Futura PT Book 400                               | `font-sans` on each `<a>`                                           |
| Font size             | 18px                                                             | `text-lg` on each `<a>`                                             |
| Item spacing          | 6px padding per link; 12px horizontal on the list                | `p-1.5` on each `<a>`; `px-3` on the `<ul>`                         |

The `--color-nav-text` and `--color-nav-background` tokens are defined in the `@theme` block in `src/styles/global.css` alongside the other color tokens.

## Adding or reordering items, and the "current" item

Edit the `<ul>` in `Nav.astro`. Each link shares a common `linkClasses` string (defined in
the frontmatter) plus one color utility — `text-ink` for whichever item represents the
current page, `text-nav-text` for the rest:

```astro
<li><a href="/about" class={`${linkClasses} text-nav-text`}>About</a></li>
```

Items render left-to-right in source order. There's no shared "current" class doing the
override — each link gets exactly one resting-color utility, so there's no specificity or
utility-ordering ambiguity to reason about.

## Font dependency

The nav uses **Futura PT Book (400)** via Adobe Fonts (`futura-pt`). This weight must be included in the Adobe Fonts kit embedded in `Base.astro`. If the font appears to fall back to a system sans-serif, log into Adobe Fonts, open the active kit, and confirm Futura PT Book is checked.
