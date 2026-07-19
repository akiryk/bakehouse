# Story — Sharpen `CLAUDE.md` against drift

Not part of Epic 19 — a standalone housekeeping story to be run when convenient. Best done by
Claude Code specifically, because the load-bearing evidence isn't in `CLAUDE.md` itself — it's
in the recent stories and commits, which CC has the fullest context on.

**Goal:** rewrite `CLAUDE.md` so it does the two jobs it exists to do — telling CC how to work
on this codebase, and telling it what the codebase values — sharper and shorter than it does
today. Cut what's stale, narrow, or one-off; reinforce what actually prevents drift; add the
principle that's implicit today but hasn't been stopping mistakes.

**Why now.** Recent stories drifted toward hardcoded values and one-off assumptions, and were
cleaned up after the fact. The file didn't catch them. Some of that is unavoidable; some is
because the file has accreted specifics that dilute its principles, or omits a principle it
should have been asserting all along. This story is to close that gap.

**Out of scope:** any code change. This edits `CLAUDE.md` (and, if warranted, spawns a small
sibling doc under `docs/`). It does not touch components, config files, or the epic in flight.

---

## The principle to add (or sharpen if it's already implied)

The through-line the file is missing — or under-stating — is a **developer-experience
principle**: this app is authored by iterating on how things look, animate, and transition.
The dev/ex the file should be asserting is the ability to fine-tune all three from an obvious,
predictable place — a token, a config value, or a Tailwind class on the element itself — without
tracing up a component tree to find where a value was buried, and without editing shared code
to change one page's behavior. That principle has three domains:

- **Element motion** — timing, delay, easing, duration, what properties animate (translate
  only? color morph? opacity?), reveal vs. scrub.
- **Page transitions** — the stage color change from one page to the next, the motion between
  pages, its duration and character.
- **Styling** — color, padding, margin, font-size, line-height, and everything downstream. A
  card is not a fixed card; it's markup whose styling I want to keep changing.

The last one has a specific corollary the current file doesn't state clearly enough:
**components should inherit minimal styling, so Tailwind classes applied at the point of use
work straightforwardly.** A shared component that bakes in styling downstream of what a
consumer can override — such that adding a utility class doesn't take effect because a parent
class is asserting the property first — is the anti-pattern to name. If a `ProjectCard`'s
markup means adding `text-lg` at the call site does nothing because the card sets `text-base`
internally, the card is wrong, not the caller.

This principle is what backs the existing conventions (tokens, config files, no arbitrary
values, minimal engine contract) — it's why they exist. Naming it explicitly lets the specific
rules read as expressions of it rather than as an accumulating checklist.

---

## How to work this story

This is a rewrite, not a diff. Do the diagnostic first, then rewrite from what it found — don't
edit the current file paragraph by paragraph. That produces a fresher file and a shorter one.

### Task 1 — Diagnose the drift

Read the last several shipped stories and their commits (Epic 19 in particular — Stories 19.1
through 19.6 are landed; 19.7 is being written). For each drift you find or recall, capture:

- **What went wrong.** A hardcoded value that should have been a config knob, a one-off folder
  or naming decision, a shared component that swallowed a child's stylability, an animation
  whose timing was baked in rather than exposed. Be specific — file, symptom.
- **What in `CLAUDE.md` should have prevented it.** Was the rule there but too buried to
  register? Absent? Present but stated so narrowly that it didn't apply?
- **What form of guidance would actually catch it next time.** A named principle, a stated
  convention, a specific anti-pattern, a folder-map entry. Not "add a rule" — the right *kind*
  of rule.

Also read the current `CLAUDE.md` with a critical eye and flag:

- **Stale content** — anything that no longer matches how the codebase works. (E.g. references
  to `01-intro/` numeric folder prefixes when the real folders don't use them; anything about
  `paper={false}` if 19.1 has landed by then; the `src/config/motion.ts` reference — the real
  files are `octagon.ts` and `scroll.ts`.)
- **Overly narrow content** — rules born from a single episode that don't generalize; things
  more suited to a chapter-specific doc than the canonical guide.
- **Repetition** — the same principle asserted three ways.

**Output of this task**, before touching the file: a short written diagnosis — the drifts
found, the stale/narrow content flagged, and a proposed shape for the rewrite. **Pause here for
review** before Task 2.

### Task 2 — Rewrite

Rewrite `CLAUDE.md` around what Task 1 found. The rewrite must:

- **Lead with the developer-experience principle** (motion, page transitions, styling) as a
  first-class section — not as an afterthought. It's the "why" the rest of the rules serve.
- **Keep every convention that has been earning its keep** — tokens as single source, no
  arbitrary Tailwind values, native scroll never hijacked, reduced motion honored, chapters as
  ordered manifests, minimal engine contract, verify against the rendered result.
- **Cut what didn't.** You have explicit permission to remove content — stale references,
  rules born from a single conversation, over-specified detail. A shorter file that lands the
  principles is worth more than a complete file that buries them. If you're unsure, cut. This
  is the part CC will most naturally under-do; do it anyway.
- **Move deep-dive content to `docs/`** rather than keeping it inline. If a chunk of
  `CLAUDE.md` would be a useful reference in one narrow situation and dead weight the rest of
  the time, that's a `docs/` doc. Link to it from the relevant section in a single line;
  don't summarize it inline.
- **Name anti-patterns as anti-patterns.** The style-inheritance one above is the clearest
  example; the diagnosis in Task 1 will surface others. "Don't do X, because Y" prevents
  drift better than a general principle alone.
- **Preserve accurate specifics that prevent real bugs** — the SPA/`data-astro-rerun` reasoning
  around `page-init.ts`, the `pointer-events: none` on `.foreground-stage` and why each chapter
  restores it, the `will-change`/compositing placement, the Tailwind v4 stale-content-cache
  note. These are load-bearing.

Length target: **shorter than today**, measurably. Not a character count — a judgment. If a
section can be halved without losing what a fresh reader needs, halve it.

Then verify the file *against the codebase*:

- Every folder path mentioned exists.
- Every filename mentioned is real (`octagon.ts` and `scroll.ts`, not a stale `motion.ts`).
- Every rule that claims "we do X" — verify the code actually does X.
- Every "we do not X" — verify no recent story quietly did X.

Anything that fails these is either fixed in the codebase (out of scope for this story — flag
it) or corrected in the doc.

### Task 3 — Land it, and flag follow-ups

Commit the rewrite. In the note, list:

- **The drifts diagnosed** (from Task 1).
- **What was cut** and why, so anyone re-reading git history sees the reasoning.
- **Any deep-dive content moved to `docs/`**, and the new filenames.
- **Any drift found in the codebase itself** that this story couldn't fix — a story to file
  next, not a code change here.

---

## Done when

- `CLAUDE.md` opens with the developer-experience principle and treats motion, page
  transitions, and styling as its three domains — not as scattered rules.
- The anti-pattern of shared components swallowing child stylability is named as such.
- Every stale filename, folder reference, and outdated rule (`paper={false}`, `motion.ts`,
  `01-intro/`, etc., as applicable at the time of writing) is corrected or removed.
- The file is measurably shorter and the remaining content earns its place; deep-dive content
  that was inline lives in `docs/` and is linked, not summarized.
- Every specific claim in the file has been checked against the codebase and matches.
- The commit note lists the drifts diagnosed, what was cut, any docs spawned, and any drift
  that's a codebase problem to file separately.
