# Things 3 × Todoist Hybrid Redesign — Phase Plan & Status

_Last updated: 2026-04-25_

## Goal

Full visual + IA rebuild that pairs **Things 3's minimalism** (paper backgrounds, tinted view icons, large weighted headings, no card chrome, inline task expansion, magic-plus FAB) with **Todoist's functionality** (NLP quick add, priorities P1–P4, filters & labels, sections, recurrence, keyboard shortcuts).

## Scope

- **Keep**: Supabase schema, Clerk auth, all `src/lib/*` utilities (parsers, filters, ordering, deadlines, recurrence, labels), all `src/hooks/*`, all `*-provider.tsx` context.
- **Cut**: Progress dashboard, Community/Leaderboard, Dashboard, Home, Planning duplicate routes.
- **Restyle**: Calendar/Planner and Focus/Pomodoro to fit the new shell.

## IA Shim (zero schema migration)

Every Things 3 view maps onto existing schema with **no SQL changes**:

| Things 3 view | Mapping |
|---|---|
| **Inbox** | Route to seeded `todo_lists.name = 'Inbox'` (auto-created by `ensure_user_bootstrap()`). |
| **Today** | Existing `SmartView = "today"`. |
| **Upcoming** | Existing `SmartView = "upcoming"`. |
| **Anytime** | New filter: has `list_id` (≠ Inbox), `deadline_on IS NULL`, `is_done = false`. |
| **Logbook** | Existing `SmartView = "done"`, ordered by `completed_at desc`. |
| **Areas** | Deferred — flat project list in sidebar. |

## Phases

### Phase 0 — Tokens & Typography ✅ DONE
- Replaced `src/styles/globals.css` with paper backgrounds, view-icon palette, motion tokens, Things-3 chrome stripping.
- Fixed `--icon-*` palette (Inbox slate, Today yellow, Upcoming red, Anytime orange, Logbook green) — does NOT shift with accent.
- Added `--priority-p1..p4` tokens for Todoist-style priority dots.
- Motion: `--motion-fast: 160ms`, `--motion-base: 220ms`, `--motion-spring`.
- New utility classes: `.view-heading`, `.task-row[data-completed]` strikethrough fade, `.list-paint-skip`.

### Phase 1 — Shell + Sidebar IA ✅ DONE
- Sidebar order: **Inbox → Today → Upcoming → Anytime → Logbook** · Projects (drag-reorder) · Calendar / Focus.
- Each Things-3 view icon uses fixed `--icon-*` tint.
- Removed Progress + Community from nav (routes still exist, deleted in Phase 8).
- Profile dropdown trimmed to Settings + All Projects + Logout.
- Extended `SmartView` type to include `"anytime"` (filter falls back to all-incomplete until Phase 4).
- Updated `TaskSavedViewRow.smart_view` and `SmartViewCounts` to match.
- Files touched: `src/components/app-shell.tsx`, `src/lib/task-views.ts`, `src/lib/task-filters.ts`, `src/lib/types.ts`, `src/hooks/use-task-dataset.ts`.

### Phase 2 — Task Row + Inline Expansion 🚧 IN PROGRESS
- Restyle `task-list.tsx` to Things 3 row: circle checkbox + title + dimmed metadata that fades on hover.
- New `inline-task-editor.tsx` with notes, checklist (reuse `task-steps-section.tsx`), due date (reuse `task-due-date-picker.tsx`), priority, labels.
- Strikethrough fade on completion via `data-completed`.
- Reuse `applyTaskPatch` from `useTaskDataset` for optimistic updates; persist via `lib/task-actions.ts` (`updateTask`, `setTaskCompletion`).

### Phase 3 — NLP Quick Add 📋 PENDING
- New `src/components/task/quick-add.tsx`. Replaces `quick-add-dialog.tsx`.
- Reuse `src/lib/quick-add-parser.ts` entirely (already parses dates/times/priorities/estimates/reminders/recurrence/`#projects`/`+labels`).
- Two presentations: bottom-of-list inline composer + `Q`-shortcut centered dialog.

### Phase 4 — View Screens 📋 PENDING
- New: `inbox-view.tsx`, `today-view.tsx`, `upcoming-view.tsx`, `anytime-view.tsx`, `logbook-view.tsx`, `view-header.tsx`.
- New: `src/lib/things-views.ts` (selectors for each Things 3 view).
- Wire as `src/app/tasks/[view]/page.tsx` segments OR continue using search params.
- Upcoming groups by date (Today / Tomorrow / This Week / Later).

### Phase 5 — Magic Plus FAB 📋 PENDING
- New: `src/components/magic-plus.tsx`, `magic-plus-drop-target.tsx`.
- Floating circular blue button, bottom-right. Tap → composer at end of list. Drag → between-row drop indicator → release inserts at position.
- `@hello-pangea/dnd` programmatic sensor API. Reuse `src/lib/task-ordering.ts`.

### Phase 6 — Project View + Sections 📋 PENDING
- New: `project-view.tsx`, `section-header.tsx`.
- Reuse existing `todo_sections` table + `useTaskSections` hook.
- Bold lower-cased section headings; tasks below; drag-reorder both.

### Phase 7 — Calendar/Planner + Focus Restyling 📋 PENDING
- **Restyle, not rewrite** `src/app/calendar/page-client.tsx` and `src/app/focus/page.tsx`.
- Strip surface chrome, adopt new typography/tokens, mount inside new shell.
- Keep all logic (`planner-filters.ts`, `planning.ts`, `focus-session-events.ts`).

### Phase 8 — Cleanup + Polish 📋 PENDING
- Delete: `src/app/progress/`, `src/app/community/`, `src/app/dashboard/`, `src/app/home/`, `src/app/planning/`.
- Delete legacy: `app-shell.tsx` (after replacement), `quick-add-dialog.tsx`, `task-detail-panel.tsx`, `task-list.tsx`.
- Polish: 200 ms ease-out, gentle scale-on-tap, dark-mode pass, audit all 6 accents.
- Full keyboard sweep: `Q`, `/`, `Cmd+K`, arrow nav, `Enter`, `Esc`, `Cmd+Enter`.

## Reusable Utilities (do NOT reinvent)

- **Parsers/filters**: `quick-add-parser.ts`, `task-filters.ts`, `task-deadlines.ts`, `task-recurrence.ts`, `task-reminders.ts`, `task-estimates.ts`, `task-labels.ts`, `task-ordering.ts`.
- **Server actions**: `task-actions.ts` (`createTask`, `updateTask`, `setTaskCompletion`, `completeTaskWithRecurrence`, `deleteTask`, `replaceTaskLabels`), `task-section-actions.ts`, `task-step-actions.ts`, `project-actions.ts`, `project-appearance.ts`.
- **Hooks**: `use-task-dataset.ts`, `use-task-sections.ts`, `use-task-steps.ts`, `use-task-comments.ts`, `use-task-selection-actions.ts`, `use-task-transition-buffer.ts`.
- **Providers**: `data-provider.tsx`, `accent-provider.tsx`, `compact-mode-provider.tsx`, `theme-provider.tsx`, `focus-provider.tsx`.
- **Sub-editors**: `task-due-date-picker.tsx`, `task-steps-section.tsx`, `task-label-badge.tsx`, `task-comments-section.tsx`, `task-attachment-upload.tsx`, `task-syntax-composer.tsx`.

## Hardest Sub-Problems

1. **Magic Plus drag-to-position** — `@hello-pangea/dnd` non-standard FAB drag. Plan A: programmatic sensor API. Plan B (fallback): single drop zone + `pointermove` math.
2. **Inline expansion height animation** — `framer-motion` `layout` on long lists. Use `<motion.div layout="size">` 200 ms ease-out. Skip virtualization (use `content-visibility: auto`).
3. **Token migration without breaking accents** — Parallel non-themed `--icon-*` palette so view tints don't shift with accent.

## Verification (manual, per phase)

- **P0**: every existing route loads, paper background visible in light + dark.
- **P1**: sidebar resolves all six views, `Cmd+K` opens search, projects drag-reorder.
- **P2**: complete/uncomplete; expand row, edit notes, add subtask, add tag, set deadline; reload → persists.
- **P3**: parse `Buy milk tomorrow at 5pm #errands p1` into chips; create; verify all fields.
- **P4**: project assignment removes from Inbox; complete moves to Logbook; remove deadline removes from Today.
- **P5**: drag FAB between rows → ghost → release → new task at correct position with title focused.
- **P6**: create section, drag tasks across sections, rename, delete.
- **P7**: schedule focus block on calendar → run timer → check `planned_focus_blocks` and `focus_sessions` rows.
- **P8**: removed routes return 404; full keyboard sweep passes.

## Risks

- **Reversible**: token swaps, component renames, route deletions.
- **Not easily reversible**: Phase 8 deletions of `progress/`, `community/`, `dashboard/`, `home/`, `planning/`. Defer until last; tag commit `pre-cleanup-redesign`. Underlying SQL tables stay untouched so reintroduction is UI-only.
- **Performance regression** (`framer-motion` + `dnd` in long lists): Phase 2 ships first with only Today wired up; expand to Anytime/Logbook only after stress test.
- **NLP scope creep**: cap parser additions to one extension per phase.
- **Accent migration UX**: re-test all 6 accents in light + dark.

## Build verification

After each phase: `npm run build` must succeed.

## Current build status

✅ Compiles cleanly. Routes still listed: `/`, `/calendar`, `/community`, `/focus`, `/login`, `/progress`, `/projects`, `/projects/[projectId]`, `/settings`, `/sign-in`, `/sign-up`, `/tasks` (dormant routes Progress/Community/Home/Dashboard/Planning will be deleted in Phase 8).
