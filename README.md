# Stride

Stride was an execution-first student productivity web app that connected tasks, projects, planning, and focus sessions in one workspace.

Status: concluded and archived as a portfolio project. This repository is no longer in active product development.

Live deployment: https://stride.rudhresh.app is no longer available.

## Portfolio Summary

Stride explored a dense, student-focused productivity workflow where task capture, project planning, calendar blocks, and focus sessions all shared the same workspace. The project focused on the practical loop of deciding what matters, scheduling realistic work, executing with focus sessions, and using that activity to adjust the next plan.

## Product Loop

Stride is built around one practical loop:

1. Capture tasks quickly.
2. Clarify what matters now.
3. Plan realistic focus time.
4. Execute in focused sessions.
5. Adjust the next plan from what happened.

## Who It Is For

Students who:

- manage multiple classes, projects, and deadlines
- want one workflow that ties tasks -> planned work -> focus time
- prefer a dense, keyboard-friendly workspace over a lightweight checklist

## Feature List

Current App Router surfaces:

- Primary: `/tasks`, `/calendar`, `/focus`, `/projects`
- Secondary: `/settings`
- Auth: `/login`, `/sign-up`; `/sign-in` redirects to the login experience

Auth and onboarding:

- Clerk login and sign-up, mounted through the app routes above
- Server-side route gating for authenticated pages
- Clerk identity tokens used with Supabase clients
- Workspace bootstrap for new users: profile and default Inbox provisioning

Tasks:

- Smart views: Inbox, Today, Upcoming, Anytime, Logbook
- AI Day Overview on Today, generated server-side from visible tasks, descriptions, planning, and focus context
- Anytime shows incomplete tasks with no due date
- Saved task views and filter presets
- Quick Add parser for projects, deadlines, priority, estimates, reminders, recurrence, and labels
- Rich task detail: description, labels, priority, deadlines, reminders, recurrence, estimates
- Steps, attachments, comments, assignee foundation, and bulk task actions

Calendar and planning:

- Persisted planned focus blocks, optionally linked to tasks
- Planner filtering and saved planner filters
- Week and month planning surfaces built around persisted blocks and profile preferences

Focus:

- Dedicated focus/break timer surface
- Focus sessions persisted and attributed to task or planned block context when available

Projects:

- Project workspace with list and board views
- Sections with reorder and cross-section task movement
- Membership model in the database for shared lists
- Collaboration-aware fields such as assignees and comments

Preferences:

- Synced profile preferences: timezone, planner defaults, week start, compact mode, shell ordering, and accent tokens

## Architecture Snapshot

- Frontend: Next.js App Router application with React and TypeScript.
- Auth: Clerk handles login, sign-up, route protection, and user identity.
- Data platform: Supabase provides Postgres, Realtime, Storage, and RLS-backed data access.
- App structure: authenticated pages live under `src/app/*` and render inside a shared shell with navigation, command-style actions, user controls, and project access.
- State layers: `DataProvider` manages user profile/preferences and top-level workspace data, `useTaskDataset` powers route-focused task/planning data, and `FocusProvider` manages timer state plus focus session persistence.
- Authorization: Supabase RLS remains the database access boundary, with Clerk identity tokens passed to Supabase clients.
- Storage: `todo-images` stores task attachments and `profile-avatars` stores profile images.

## Tech Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS + shadcn/ui + Framer Motion
- Clerk for authentication and route protection
- Supabase for Postgres, Realtime, Storage, and RLS-backed data access
- OpenAI Responses API for the AI Day Overview
- Observability/analytics used during development: Sentry, Vercel Speed Insights, PostHog
- Tests: Vitest for semantic utilities and focused behavior coverage

## Gallery

| Tasks | Calendar | Focus |
| :---: | :---: | :---: |
| ![Tasks](screenshots/tasks.png) | ![Calendar](screenshots/planner.png) | ![Focus](screenshots/focus.png) |

| Login |
| :---: |
| ![Login](screenshots/auth.png) |

## Setup / Environment

This setup information is retained for reference. Reuse requires new service projects and environment variables.

Prereqs: Node.js + npm, a Clerk application, a Supabase project, and optionally the Supabase CLI.

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

Start from `.env.example`:

```bash
cp .env.example .env
```

Required:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_YOUR_CLERK_PUBLISHABLE_KEY"
CLERK_SECRET_KEY="sk_test_YOUR_CLERK_SECRET_KEY"
```

Optional:

```bash
OPENAI_API_KEY="your_openai_key"
OPENAI_DAY_OVERVIEW_MODEL="gpt-5.5"
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN="phc_your_project_token"
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
NEXT_PUBLIC_SENTRY_DSN="https://your-public-sentry-dsn"
SENTRY_DSN="https://your-server-sentry-dsn"
SENTRY_ORG="your-sentry-org"
SENTRY_PROJECT="your-sentry-project"
```

`OPENAI_API_KEY` enables the AI Day Overview card on Today. `OPENAI_DAY_OVERVIEW_MODEL` defaults to `gpt-5.5` when omitted.
PostHog is only initialized when both optional PostHog variables are present. Sentry is only useful when configured with a replacement DSN and project settings.

3. Apply database migrations

- Source of truth: `supabase/migrations/*.sql`
- Recommended: `supabase db push` with the Supabase CLI
- Alternative: apply the SQL files in timestamp order through the Supabase SQL editor

4. Create required Supabase Storage buckets

- `todo-images` for task attachments
- `profile-avatars` for profile images

5. Run locally

```bash
npm run dev
```

If PowerShell blocks `npm.ps1`, use:

```bash
npm.cmd run dev
```

## Known Limitations

- The data model evolved through timestamped SQL migrations and is not presented as a fully clean-room reproducible product schema.
- Optimistic UI and realtime updates are used in several flows, but this archive does not claim production-grade reliability.
- Offline-first behavior was not a product guarantee.
- Desktop/PWA packaging was explored separately and was not completed as a release target.
- The live deployment and connected service projects may be disabled, removed, or stale.
- Collaboration foundations exist through memberships, assignees, comments, and realtime data, but the archive does not claim a fully polished multi-user collaboration product.

## Future Ideas / Archived Plans

The project had several deferred tracks that were not completed before archival:

- Reliability and regression protection: add interaction tests for Quick Add, task detail save/leave behavior, section reorder, planner block changes, focus session persistence, and optimistic rollback paths.
- UX polish: unify loading, error, and empty states across Tasks, Projects, Calendar, Focus, and Settings; improve dense mobile planner and board ergonomics.
- Shell depth: add richer command palette actions, recent items, pinned entities, and smoother cross-route transitions between tasks, projects, and planner blocks.
- Preferences: separate synced preferences from device-local preferences and define clearer contracts for reminder, notification, and working-hours behavior.
- Collaboration refinement: improve member, assignee, section, and comment signal density before expanding collaboration or accountability surfaces.
- Planner and focus refinement: improve direct manipulation confidence, post-focus transitions, continuation suggestions, and estimate-vs-actual feedback.
- Quick Add refinement: improve parser discoverability while keeping parser behavior explicit and predictable.
- Design direction: continue the historical Things 3 x Todoist hybrid approach of calm surfaces, parser-first capture, smart views, filters, labels, sections, recurrence, and keyboard-friendly flows.
- Desktop/offline track: a future standalone version could replace hosted Supabase access with local SQLite repositories, local file storage for attachments and avatars, local first-run profile setup instead of Clerk, simplified collaboration, and Electron packaging.

Archived success criteria for the desktop/offline idea were: launch without Clerk or Supabase environment variables, keep core task management working offline, persist data across restarts, keep attachments available locally, and use the website only for installer distribution.

## Verification Standard

Before final archive, run:

```bash
npm run lint
npm run test
npm run build
```

## Security / Privacy Note

During development, Stride used external services including Supabase, Clerk, Sentry, Vercel, OpenAI, and PostHog. Before reuse, create fresh service projects, rotate or replace all credentials, review data retention settings, and remove or reconfigure analytics and error reporting. Do not reuse archived production credentials, Sentry DSNs, Supabase projects, Clerk apps, Vercel projects, OpenAI keys, or PostHog project tokens.

## Decommissioning Note

For final archival, verify that hosted deployments are intentionally disabled or clearly marked stale, service projects are paused or deleted as appropriate, and any public portfolio link points to this repository or screenshots rather than implying an actively maintained SaaS product.
