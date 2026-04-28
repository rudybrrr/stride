# Stride: System Architecture

Status: living technical overview. The codebase and data model are still evolving.

## High-Level Architecture

- Frontend: Next.js App Router application with React and TypeScript.
- Auth: Clerk handles login, sign-up, route protection, and user identity.
- Data platform: Supabase provides Postgres, Realtime, Storage, and RLS-backed data access.
- Pattern: client-heavy interaction surfaces with optimistic updates, selective realtime subscriptions, and server-side route gating.

## Frontend Structure

- Routing lives under `src/app/*`.
- Public auth routes: `/login`, `/sign-up`; `/sign-in` redirects to `/login`.
- Authenticated surfaces: `/tasks`, `/calendar`, `/focus`, `/projects`, `/projects/[projectId]`, `/settings`.
- `src/app/layout.tsx` mounts global providers, Clerk, Sentry integration, analytics hooks, and Speed Insights.
- Pages render inside a shared `AppShell` for navigation, command-style actions, user controls, and project access.

Main state layers:

- `DataProvider`: Clerk user context, Supabase-backed profile/preferences, list membership, and top-level counts.
- `useTaskDataset`: route-focused task/planning datasets, optimistic helpers, and realtime wiring.
- `FocusProvider`: timer state plus focus session lifecycle persistence.

## Backend and Data Layer

Schema management:

- SQL-first migrations live in `supabase/migrations/*.sql`.
- Migrations define tables, indexes, triggers, helper functions, and RLS policies.

Representative entities:

- `profiles`: user preferences and profile metadata synced from Clerk where useful.
- `todo_lists` and `todo_list_members`: projects, Inbox, and membership.
- `todos`: tasks, deadlines, recurrence, reminders, estimates, assignee foundation, and ordering.
- `todo_sections`: project sections for list and board organization.
- `planned_focus_blocks`: calendar/planner blocks.
- `focus_sessions`: execution sessions, optionally attributed to a task or planned block.
- `task_saved_views` and `planner_saved_filters`: persisted filter presets.
- `task_labels` and `todo_label_links`: labels.
- `todo_steps`: checklist steps.
- `todo_comments`: task comments.

Storage:

- `todo-images` stores task attachments.
- `profile-avatars` stores profile images.
- Attachment metadata is tracked in database rows alongside Storage objects.

## Authentication and Authorization

- Clerk protects authenticated routes through `src/middleware.ts`.
- `requireUser()` guards server-rendered authenticated pages and redirects unauthenticated users to `/login`.
- Supabase browser and server clients request Clerk tokens and pass them as access tokens.
- New-user bootstrap creates or syncs a profile and ensures a default Inbox.
- Supabase RLS remains the data authorization boundary for database access.

## Main App Surfaces

- `/tasks`: execution workspace with smart views, saved views, filters, bulk actions, and task detail editing.
- `/calendar`: planning surface around persisted focus blocks, planner filters, and scheduling.
- `/focus`: focus/break timer that can carry task or planned-block context.
- `/projects`: project overview.
- `/projects/[projectId]`: per-project workspace with list/board views, sections, comments, attachments, and member-aware task fields.
- `/settings`: profile, preferences, appearance, and account settings.

## Realtime, Mutations, and Consistency

- The UI favors optimistic updates for responsiveness.
- Realtime is scoped selectively by user, list, task, or related resource to reduce stale collaboration state.
- Some flows degrade defensively when optional tables or feature data are unavailable during migration rollout.
- Near-term hardening is focused on rollback behavior, mutation error reporting, and interaction-level regression tests.

## Observability and Analytics

- Sentry is integrated through `@sentry/nextjs`.
- Vercel Speed Insights is mounted at the root layout.
- PostHog initializes only when the public PostHog environment variables are configured.

## Current Limitations

- Offline-first behavior is not guaranteed.
- Collaboration foundations exist, but the UI is still being refined.
- Optimistic updates and realtime reconciliation need more regression coverage.
- Packaging and desktop distribution are tracked separately in `local-desktop-plan.md`.
