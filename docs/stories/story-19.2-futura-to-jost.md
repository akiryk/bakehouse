# Story 19.2 — Futura → Jost (app-wide sans)

Part of **`docs/epics/epic-19-portfolio-browse.md`** — its Step 2. Read that epic for
context; the font homes are documented in `docs/design-tokens.md`.

**Goal:** replace Futura with **Jost** as the app-wide sans, loaded as a **variable** font so
we get Regular (400) and Medium (500) — what the portfolio cards need — from one file instead
of separate weight downloads. Concretely: wire the Jost embed, repoint the existing
`--font-sans` token, and prove nothing already on `font-sans` regressed.

**Independent of Story 19.1** — it can land before, after, or alongside. The only file they
share is `global.css`, and they touch different parts of it (19.2 edits the `--font-sans`
line in `@theme`; 19.1 leaves the font tokens alone and only edits the shadow-token *docs*).
19.2 edits `Base.astro`'s `<head>`; 19.1 only reads `Base.astro`. They rebase cleanly.

**Out of scope:** the card type-size / color tokens (10/12/14pt, the slate/black/gray split —
a later story, Epic 19 Step 3) and any card or `/work` work; italics (not needed, and
deliberately avoided — see Task 1); chasing layout-shift-on-swap (noted, accepted for now).

---

## How we work

Per `CLAUDE.md` → **How we work**. **Verify against the rendered result**, wide and tall.
`astro check` stays clean. This story's risk isn't the swap itself — it's one line — it's the
**metric change**: Jost is not Futura, so anything already set in `font-sans` re-flows
slightly. The verification is the real work here.

---

## Task 0 — Find every `font-sans` usage, and baseline it

The swap is global, so first learn its blast radius. Grep the codebase for `font-sans` (the
Tailwind utility) and `var(--font-sans)` / `--font-sans` (direct references). Note that body
copy is `--font-serif` (Caslon); `--font-sans` is opt-in per element — the nav is the most
prominent one (`--color-nav-text`), but enumerate all of them.

Then, with the **current** (Futura) build, Playwright-screenshot each `font-sans` spot at a
wide and a tall viewport as a baseline. The nav especially — a font swap most visibly moves
tracking and cap height there.

**Verify & note:** the list of `font-sans` usages, and that baselines are captured.

---

## Task 1 — Wire the Jost embed in `Base.astro`'s `<head>`

Add the Google Fonts variable embed alongside the existing Adobe Typekit `<link>`, using the
standard preconnect + stylesheet pattern:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Jost:wght@400..600&display=swap"
  rel="stylesheet"
/>
```

- **Normal weights only — no `ital` axis.** We don't use italics, and there's a standing
  Google Fonts bug (google/fonts #2445) where requesting Jost's italic *together with* a
  normal weight range makes the italics silently fail to render. Requesting normal-only avoids
  it. If italics are ever wanted, request them as a *separate* family line, not merged in.
- `wght@400..600` covers Regular and Medium with headroom (SemiBold) and a lean file. Widen to
  `100..900` only if a future weight needs it — a wider range is a slightly larger download.
- `display=swap` shows the fallback first, then swaps to Jost. Because Jost and the fallback
  have different metrics, expect a small reflow on swap; that's acceptable this epic (desktop,
  not chasing CLS). Don't block anything on the embed loading — the fallback must render fine
  on its own.

**Verify & note:** the Jost file loads (Network panel), and text on `font-sans` picks it up.

---

## Task 2 — Repoint `--font-sans`, fix the fallback stack

In `global.css`'s `@theme` block, swap the family:

```css
/* was: "futura-pt", "Futura", "Century Gothic", sans-serif */
--font-sans: "Jost", "Century Gothic", sans-serif;
```

Keep a geometric-ish fallback (Century Gothic → generic `sans-serif`) so layout stays stable
before Jost loads and acceptable if it ever fails. The exact fallback is a judgment call —
tune it if the pre-swap flash looks off — but drop the Futura references from the token now
that Futura is being retired.

**Mind `font-synthesis: none`.** `body` sets `font-synthesis: none`, so the browser will *not*
fake a weight that isn't really present. This is a feature, not a snag: the variable axis
supplies genuine 400 and 500, so Medium renders as real Medium — but it also means a
misconfigured embed can't be papered over by synthesis. If 400 and 500 ever look identical,
the axis didn't load; there's no fake-bold safety net hiding it. (That's also your Task 3
test.)

**Verify & note:** the token now reads Jost; `astro check` clean.

---

## Task 3 — Verify existing `font-sans` usages against the baseline

Re-screenshot every Task-0 spot and compare. Expect *some* movement (different typeface) —
what you're checking is that it still reads well, not that it's identical:

- **Nav** — tracking, alignment, and that it doesn't wrap or collide differently. This is the
  one to scrutinize.
- **Weight distinctness** — confirm a 400 element and a 500 element render **visibly
  different**. Given `font-synthesis: none`, identical-looking 400/500 means the variable axis
  isn't actually loading — investigate the embed before calling this done.
- **Fallback** — throttle or block the Google request and confirm the fallback stack renders
  cleanly (no invisible text, no broken layout).

**Verify & note:** each `font-sans` spot after the swap, and confirm 400≠500 renders.

---

## Task 4 — Docs, and a pruning follow-up

- In `docs/design-tokens.md`, document the sans font the way Caslon is documented: `--font-sans`
  is **Jost**, loaded as a variable font via the Google Fonts `<link>` in `Base.astro`, normal
  weights only, replacing Futura. Note the `wght@400..600` range and why italics are requested
  separately if ever needed.
- **Flag for the human (don't action):** `--font-sans` pointed at `futura-pt`, which is an
  Adobe Typekit family name — almost certainly served by the *same* Typekit kit
  (`use.typekit.net/edz5xyo…`) that serves Caslon, confirm in the kit's family list. Nothing
  references `futura-pt` after this story, but that kit will keep shipping it until it's pruned
  from the Adobe web-project config — an account action, not a code change. Worth doing to drop
  the dead download; note it so it isn't forgotten.

**Verify & note:** the doc matches reality; the Typekit-pruning follow-up is recorded.

---

## Done when

- Jost loads as a variable font from the Google Fonts `<link>` in `Base.astro` (normal weights,
  `wght@400..600`, `display=swap`), fallback rendering cleanly on its own.
- `--font-sans` reads `"Jost", …` with no Futura references; `body`'s `font-synthesis: none` is
  respected and real 400/500 render distinctly.
- Every existing `font-sans` element (nav included) has been checked against its baseline and
  reads correctly at both viewports.
- `docs/design-tokens.md` documents the Jost embed; the Typekit-pruning follow-up is on record.
- `astro check` is clean.
