# Archived: Things 3 x Todoist Hybrid Redesign Plan

Archived on 2026-04-28.

This document is a historical phase plan for the visual and information-architecture redesign. It is not the current source of truth for shipped product scope. Use `../README.md`, `system_architecture.md`, and `todo.md` for current evaluator-facing documentation.

## Original Goal

Pair Things 3-style minimalism with Todoist-style task power:

- paper-like surfaces, tinted view icons, large headings, and light chrome
- parser-first Quick Add, priorities, filters, labels, sections, recurrence, and keyboard-friendly flows

## Current Source-of-Truth Notes

- Auth uses Clerk, with Supabase used for Postgres, Realtime, Storage, and RLS-backed data access.
- Current active app surfaces are `/tasks`, `/calendar`, `/focus`, `/projects`, `/projects/[projectId]`, and `/settings`.
- Progress, Community, Dashboard, Home, and duplicate Planning routes are not current active App Router surfaces.
- Anytime means incomplete tasks with no due date, including Inbox tasks.

## Historical IA Mapping

| View | Current interpretation |
| --- | --- |
| Inbox | Tasks in the default Inbox list. |
| Today | Incomplete tasks overdue or due today. |
| Upcoming | Incomplete tasks due after today. |
| Anytime | Incomplete tasks with no due date, including Inbox tasks. |
| Logbook | Completed tasks ordered by completion time. |
| Projects | Flat project list with per-project workspaces. |

## Historical Phase Summary

- Phase 0: tokens, typography, view icon colors, and motion tokens.
- Phase 1: shell/sidebar IA with Inbox, Today, Upcoming, Anytime, Logbook, Projects, Calendar, and Focus.
- Phase 2: task row restyling and inline editing.
- Phase 3: parser-first Quick Add presentation.
- Phase 4: view selectors and grouped smart views.
- Phase 5: Magic Plus exploration.
- Phase 6: project sections and task movement.
- Phase 7: calendar/planner and focus restyling.
- Phase 8: cleanup and polish.

## Reusable Utilities Identified By The Plan

- Parser/filter/deadline utilities: `quick-add-parser.ts`, `task-filters.ts`, `task-deadlines.ts`, `task-recurrence.ts`, `task-reminders.ts`, `task-estimates.ts`, `task-labels.ts`, `task-ordering.ts`.
- Server actions: `task-actions.ts`, `task-section-actions.ts`, `task-step-actions.ts`, `project-actions.ts`, `project-appearance.ts`.
- Hooks: `use-task-dataset.ts`, `use-task-sections.ts`, `use-task-steps.ts`, `use-task-comments.ts`, `use-task-selection-actions.ts`, `use-task-transition-buffer.ts`.
- Providers: `data-provider.tsx`, `accent-provider.tsx`, `compact-mode-provider.tsx`, `theme-provider.tsx`, `focus-provider.tsx`.

## Historical Risks

- Large UI cleanup can remove useful route evidence if done before reliability work.
- Direct-manipulation planner and drag flows need interaction tests before major refactors.
- Parser scope should stay explicit and predictable.
- Performance should be checked on long task lists when using animation and drag behavior.

## Current Verification Standard

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```
