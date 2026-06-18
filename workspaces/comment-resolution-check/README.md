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

See [`SPEC.md`](./SPEC.md) — refined 2026-06-18. Architecture is three components:
a `generate-crc-guides` Claude Code skill (MCR → per-department checklist files),
a Conductor workflow (clone of completeness-check, 2-status schema) that runs against
the updated plan set, and a `generate-crc-report` Claude Code skill that renders the
city-ready PDF. Both skills live in the `claude-plugins` repo.

## TODOs

(tracked in SPEC.md §12 — proposed `bd` epic, not yet created)
