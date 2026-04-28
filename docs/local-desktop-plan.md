# Local Desktop Plan

Status: future distribution and offline-first planning note. This is not current product behavior.

## Goal

Ship a standalone desktop version of Stride that keeps working locally after Supabase is removed from runtime execution.

## Assumptions

- Single-user desktop use is the primary target.
- Offline-first behavior is required for this future desktop version.
- Cross-device sync is out of scope for the first pass.
- Collaboration features can be simplified or removed.

## Simplest Approach

1. Keep the current Next.js UI where practical.
2. Replace Supabase reads and writes with a local data layer.
3. Use SQLite for structured data.
4. Store attachments and avatars on the local filesystem.
5. Package the app with Electron first.
6. Host the installer on the website and treat the website as distribution only.

## Migration Phases

### Phase 1: Local data layer

- Define repository-style interfaces for tasks, projects, planner blocks, focus sessions, comments, steps, labels, and preferences.
- Implement those interfaces against SQLite.
- Add import/export so local data can be backed up before any future migration.

### Phase 2: Remove hosted auth dependency

- Replace Clerk login/sign-up with a local first-run profile setup.
- Gate the app on local app state instead of remote session state.
- Keep a simple onboarding screen if needed, but remove hosted auth assumptions.

### Phase 3: Move feature surfaces to local storage

- Tasks, calendar, focus, projects, and settings should read from local repositories.
- Attachment uploads should become local file copies.
- Avatar handling should point to local files or generated defaults.

### Phase 4: Degrade or drop collaboration

- Disable or simplify shared project membership.
- Remove realtime subscriptions.
- Remove account-sharing behavior that depends on a hosted backend.

### Phase 5: Desktop packaging

- Wrap the app with Electron.
- Persist data in the user profile directory.
- Add auto-update only if it does not reintroduce a required backend dependency.

## Tradeoffs

- Electron is the fastest path, but it is heavier than Tauri.
- SQLite keeps local persistence simple, but it changes the current data model and query layer.
- Removing Supabase reduces runtime dependency risk, but it also removes realtime and hosted storage.

## Success Criteria

- The desktop app launches without Clerk or Supabase environment variables.
- Core task management works entirely offline.
- Data survives app restarts.
- Attachments remain available from local storage.
- The website can distribute the installer without being part of runtime execution.
