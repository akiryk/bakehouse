# Epic 09 — Chapter 2 (the intro)

**Goal:** turn the Epic 08 placeholder chapter into the real chapter 2 — a paperless,
slate-midground chapter whose text sits directly on the mat and reveals in two scroll beats.

**Depends on:** Epic 08 (color morph, paperless variant, scroll beats). This epic is content
+ tuning, not new machinery.

**In scope:** the real copy, the Futura PT medium / white / centered treatment, and tuning
the two beats.

**Out of scope:** new engine capabilities (all in Epic 08).

**Don't touch:** the mat, chapter 1, the paper shadow, the engine.

---

## Font

The text is **Futura PT medium, 32px**. Futura PT is **confirmed available** in the Adobe kit
(it's used elsewhere on the site) — but the chapter-2 text isn't using it yet, and must.
Apply Futura PT at the **medium weight (500)** (confirm `--font-sans` resolves to Futura PT;
if another var carries it, use that). Fall back gracefully to the sans stack.

## The treatment

- **Type:** Futura PT medium, **32px** (expressed in rem), centered **vertically and
  horizontally** on the midground.
- **Color:** **white**, via a token — reference `--color-foreground` (already white) or add a
  small `--color-text-inverse: #fff`; pick one and document it. Not a raw hex.
- Paperless (from Epic 08): no card, text directly on the midground.

## Midground color — two stages

White text is low-contrast on the light slate, so the midground **darkens across the two
beats** (which also gives the chapter movement):

- **Beat 1:** `#c1caca` (the slate from the ch1→ch2 transition), with line 1.
- **Beat 2:** as line 2 comes in, **morph the midground `#c1caca → #8a9ba5`** (a darker blue)
  for legibility.

Add `#8a9ba5` as a palette token (e.g. `--midground-slate-deep`). The morph reuses Epic 08's
color-morph mechanism, now driven by a **beat** (intra-chapter) rather than a chapter
transition — a small generalization worth recording (a beat can carry a target midground
color).

## The content — two beats

- **Beat 1:** "Bakehouse Studio is Adam Kiryk, a designer and web developer." — centered, on
  `#c1caca`.
- **Beat 2 (on scroll):** "I've been leading web design projects for several years." fades in
  **below** line 1; line 1 **shifts up a bit** and **remains**; both visible — and the
  midground morphs to `#8a9ba5` across the beat.

Use the Epic 08 beat presets (`fadeInUp` for line 2, `shiftUp` for line 1) plus the color
morph on beat 2. Tune the shift distance, fade, and morph timing **by eye**.

---

## Steps

Per `CLAUDE.md` → **How we work**: autonomous; verify against the rendered result; note;
continue unless a real question.

1. **Font.** Apply Futura PT medium (500) to the chapter-2 text. *Verify:* the text renders
   in Futura PT medium, not the fallback.
2. **Beat 1.** Replace the placeholder with line 1 in Futura PT medium 32px, white, centered
   on `#c1caca`. *Verify:* centered both axes; the ch1→ch2 morph plays into it.
3. **Beat 2 + darken.** Add `--midground-slate-deep: #8a9ba5`; line 2 fades in below on
   scroll, line 1 shifts up and stays, and the midground morphs `#c1caca → #8a9ba5` across
   the beat. *Verify:* both lines visible after; white text is legible on the darker blue;
   the morph is smooth; reduced-motion shows both lines in place on the darker color.
4. **Tune + docs.** Adjust shift/fade/morph by eye; record the palette token and the "a beat
   can carry a target midground color" generalization in the docs.

## Done when

Chapter 2 is paperless, with "Bakehouse Studio is Adam Kiryk, a designer and web developer."
centered in white Futura PT medium 32px on `#c1caca`; and on scroll "I've been leading web
design projects for several years." fades in below as the first line shifts up and the
midground morphs to `#8a9ba5` for legibility — both lines remaining, reduced-motion-safe.
