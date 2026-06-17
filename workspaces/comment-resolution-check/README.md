# comment-resolution-check

Brainstorming space for the comment-resolution-check workflow — a future
review mode that checks whether a resubmitted site plan resolves the
comments raised in an earlier formal review.

## Idea

After a city department issues a Master Comment Report (MCR), the applicant
revises the plans and resubmits. The next review cycle has to determine,
comment-by-comment, whether each prior issue was actually addressed. Today
that's done manually. We want an agent that takes the prior MCR plus the
updated plan set (often delivered as a "redlines" PDF showing what changed)
and produces a per-comment resolution status.

## Layout

- `1700-S-Lamar/` — first concrete site plan we'll target for the MVP.
  Source artifacts (prior MCR, redlines) live here. See its README for
  what's present and what's still missing.

## Spec

See [`SPEC.md`](./SPEC.md) — full context + proposals from the 2026-06-15 brainstorm
(reuse map: `mcr-prep`/`mcr-convert` ingestion, completeness-check workflow clone,
navalbase for redlines later). To be reviewed/refined in a follow-up session.

## TODOs

(tracked in SPEC.md §12 — proposed `bd` epic, not yet created)
