# Calendar Redesign Plan

## Goal
Make the calendar planner page feel much closer to Todoist's calendar experience, especially the week view: dense, calendar-first, shortcut-friendly, and visually calm.

## Current Gap
The existing calendar page is functional but not structurally close to Todoist yet.

- It is wrapped like a planner dashboard rather than a calendar-first workspace.
- The week view is a set of day cards, not a real time grid.
- The month view is separate and more prominent than it should be for this redesign.
- Secondary side content currently competes with the main calendar surface.

## Phase 1
Start by rebuilding the week view to match the Todoist-style calendar layout.

### Main Calendar Surface
- Make the calendar the primary full-width surface.
- Remove the heavy planner card framing around the main calendar.
- Replace the current week card layout with a real 7-column calendar grid.
- Add sticky weekday headers.
- Add an `All day` row for due-date-only tasks.
- Add hourly labels on the left.
- Render a red current-time line.

### Data Mapping
- Tasks with only a due date should render as all-day pills.
- `planned_focus_blocks` should render as timed scheduled blocks in the hourly grid.
- Project colors should be used to visually separate different calendars/projects.

### Toolbar
Make the toolbar closer to Todoist's calendar controls.

- Previous / next period navigation
- `Today`
- Range label such as `June 2026`
- Project filter
- `Week / Month` view switch
- `New block`

### Layout Simplification
Reduce or remove non-essential planner UI from the first screen.

- Remove the current left-side `Queue / Unscheduled` card stack from the main layout
- Remove the large `Due soon` side card from the main layout
- Reduce the current separate selected-day summary panel
- Keep unscheduled tasks as a lighter secondary tray or compact section, not the main structure

### Interaction
Keep the existing block create/edit dialog for the first pass so the UI can change without destabilizing behavior.

## First Shortcut Pass
Add a small Todoist-like keyboard layer.

- `t` = go to today
- `n` = create new block
- Left / right arrows = previous / next week
- `w` = week view
- `m` = month view

## Explicitly Out Of Scope For Phase 1
These should wait until the first visual and structural pass is done.

- Drag-and-drop rescheduling
- Drag resize of blocks
- Advanced overlap packing
- Full Todoist-level keyboard system
- Exact mobile parity with Todoist

## Phase 2
After the first pass looks right:

- Click an empty timeslot to prefill date and time
- Drag blocks between days and times
- Resize planned blocks
- Improve overlapping block layout
- Improve mobile day/week behavior
- Expand keyboard support

## Implementation Notes
The first pass will probably touch these files most:

- `src/app/calendar/page-client.tsx`
- `src/lib/planning.ts`

Additional small calendar-specific components can be introduced if the page becomes too large.

## Product Direction
- Keep the app shell as-is; only the calendar surface should move toward Todoist.
- Focus on copying the calendar experience, not the entire Todoist app chrome.
- Prioritize week view first.
- Keep month view simpler in the first pass.

## First Execution Target
When executing later, start with:

1. Rebuild the `week` view into a dense Todoist-style calendar grid.
2. Keep `month` view functional but secondary.
3. Preserve the current modal save/edit flow.
4. Add the first batch of shortcuts.

