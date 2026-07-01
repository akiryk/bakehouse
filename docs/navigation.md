# Navigation

The site navigation is a persistent horizontal list fixed to the top-right of the viewport, always visible above the midground mat.

## File location

```
src/components/Nav.astro
```

It is mounted directly in `src/layouts/Base.astro` (the root layout), so it appears on every page automatically.

## Styling

All styles are scoped inside `Nav.astro`'s `<style>` block — nothing bleeds into global CSS.

| Property        | Value                                         | Where to change                    |
| --------------- | --------------------------------------------- | ---------------------------------- |
| Position        | `fixed; top: 50px; right: --mat-safe-inset-x` | `.site-nav` in `Nav.astro`         |
| Color (resting) | `--color-nav-text` (#cfc6b6)                  | `@theme` block in `global.css`     |
| Color (hover)   | `--color-ink` (#79530b)                       | `.site-nav a:hover` in `Nav.astro` |
| Font            | `--font-sans` → Futura PT Book 400            | `.site-nav a` in `Nav.astro`       |
| Font size       | 18px                                          | `.site-nav a` in `Nav.astro`       |
| Item spacing    | 6px padding (no margin)                       | `.site-nav a` in `Nav.astro`       |

The `--color-nav-text` token is defined in the `@theme` block in `src/styles/global.css` alongside the other color tokens.

## Adding or reordering items

Edit the `<ul>` in `Nav.astro`:

```astro
<ul>
  <li><a href="/about">About</a></li>
  <li><a href="/services">Services</a></li>
  <!-- add more <li> items here -->
</ul>
```

Items render left-to-right in source order.

## Font dependency

The nav uses **Futura PT Book (400)** via Adobe Fonts (`futura-pt`). This weight must be included in the Adobe Fonts kit embedded in `Base.astro`. If the font appears to fall back to a system sans-serif, log into Adobe Fonts, open the active kit, and confirm Futura PT Book is checked.
