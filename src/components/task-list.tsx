"use client";

import { memo, useMemo } from "react";
import { Bell, Check, Clock3 } from "lucide-react";
import { useData } from "~/components/data-provider";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { TaskLabelBadge } from "~/components/task-label-badge";
import { Badge } from "~/components/ui/badge";
import { useTaskDataset } from "~/hooks/use-task-dataset";
import { getProjectColorClasses } from "~/lib/project-appearance";
import { getRecurrenceLabel } from "~/lib/task-recurrence";
import {
  getReminderOffsetLabel,
  normalizeReminderOffsetMinutes,
} from "~/lib/task-reminders";
import { formatTaskDueLabel, isTaskOverdue } from "~/lib/task-views";
import { getVisibleTaskLabels } from "~/lib/things-views";
import type { ProjectMemberProfile, TodoList } from "~/lib/types";
import type { TaskDatasetRecord } from "~/hooks/use-task-dataset";
import { cn } from "~/lib/utils";

function PriorityDot({ priority }: { priority: "high" | "medium" | "low" }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full shrink-0",
        priority === "high"
          ? "bg-destructive/70"
          : priority === "medium"
            ? "bg-amber-500/60"
            : "bg-muted-foreground/40",
      )}
      title={`${priority} priority`}
    />
  );
}

interface TaskListItemProps {
  task: TaskDatasetRecord;
  project?: TodoList | null;
  assignee?: ProjectMemberProfile | null;
  timeZone?: string | null;
  selected?: boolean;
  bulkSelected?: boolean;
  selectionMode?: boolean;
  onSelect: (task: TaskDatasetRecord, options?: { shiftKey?: boolean }) => void;
  onToggle: (task: TaskDatasetRecord, nextIsDone: boolean) => void;
  onSelectionToggle?: (
    task: TaskDatasetRecord,
    options?: { shiftKey?: boolean },
  ) => void;
  showProject?: boolean;
  divider?: boolean;
  isDragging?: boolean;
  compact?: boolean;
  variant?: "default" | "tasks";
}

export const TaskListItem = memo(function TaskListItem({
  task,
  project = null,
  assignee = null,
  timeZone = null,
  selected = false,
  bulkSelected = false,
  selectionMode = false,
  onSelect,
  onToggle,
  onSelectionToggle,
  showProject = false,
  divider = false,
  isDragging = false,
  compact = false,
  variant = "default",
}: TaskListItemProps) {
  const now = new Date();
  const dueLabel = formatTaskDueLabel(task, now, timeZone);
  const reminderOffsetMinutes = normalizeReminderOffsetMinutes(
    task.reminder_offset_minutes,
  );
  const palette = getProjectColorClasses(project?.color_token);
  const displayLabels = getVisibleTaskLabels(task.labels);
  const visibleLabels = displayLabels.slice(0, 2);
  const isTasksVariant = variant === "tasks";
  const isOverdue = dueLabel ? isTaskOverdue(task, now, timeZone) : false;
  const hasMetadata = [
    showProject && project,
    visibleLabels.length > 0,
    displayLabels.length > visibleLabels.length,
    task.priority,
    assignee,
    dueLabel,
    task.recurrence_rule,
    !task.is_done && reminderOffsetMinutes != null,
    task.estimated_minutes,
  ].some(Boolean);
  const hasSecondaryContent = Boolean(task.description) || hasMetadata;

  if (isTasksVariant) {
    return (
      <div
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150",
          selectionMode
            ? bulkSelected
              ? "bg-black/[0.05] dark:bg-white/[0.06]"
              : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
            : selected
              ? "bg-black/[0.05] dark:bg-white/[0.06]"
              : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]",
          isDragging && "z-20 scale-[1.01] bg-[var(--surface-elevated)] shadow-[var(--shadow-soft)]",
        )}
      >
        <button
          type="button"
          aria-label={task.is_done ? "Mark task incomplete" : "Mark task complete"}
          onClick={() => onToggle(task, !task.is_done)}
          className={cn(
            "flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all duration-150",
            task.is_done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/70 bg-transparent text-transparent hover:border-primary/50",
          )}
        >
          <Check className={cn("h-2.5 w-2.5 transition-transform duration-150", !task.is_done && "scale-0")} />
        </button>

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (selectionMode) {
                onSelectionToggle?.(task, { shiftKey: event.shiftKey });
                return;
              }
              onSelect(task, { shiftKey: event.shiftKey });
            }
          }}
          onClick={(event) => {
            if (selectionMode) {
              onSelectionToggle?.(task, { shiftKey: event.shiftKey });
              return;
            }
            onSelect(task, { shiftKey: event.shiftKey });
          }}
          className="focus-visible:ring-ring/60 flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none"
          aria-label={selectionMode ? `Select ${task.title}` : `Open details for ${task.title}`}
        >
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[14px] font-[500] leading-snug tracking-[-0.01em] transition-opacity",
              task.is_done ? "text-muted-foreground/50 line-through" : "text-foreground",
            )}
          >
            {task.title}
          </p>

          {/* hover-only metadata — hidden by default, visible on row hover */}
          <div className="hidden shrink-0 items-center gap-1.5 group-hover:flex">
            {task.priority ? <PriorityDot priority={task.priority} /> : null}
            {visibleLabels.map((label) => (
              <span
                key={label.id}
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: label.color_token ?? undefined }}
                title={label.name}
              />
            ))}
            {showProject && project ? (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground/55">
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", palette.accent)} />
                {project.name}
              </span>
            ) : null}
            {assignee ? (
              <Avatar className="h-3.5 w-3.5 border border-border/60">
                <AvatarImage src={assignee.avatar_url ?? ""} alt={assignee.username ?? "Assignee"} />
                <AvatarFallback className="text-[7px]">
                  {(assignee.full_name ?? assignee.username ?? "A").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : null}
            {task.estimated_minutes ? (
              <span className="text-[11px] text-muted-foreground/50">
                {task.estimated_minutes < 60
                  ? `${task.estimated_minutes}m`
                  : `${Math.floor(task.estimated_minutes / 60)}h${task.estimated_minutes % 60 ? ` ${task.estimated_minutes % 60}m` : ""}`}
              </span>
            ) : null}
          </div>

          {/* always-visible trailing date */}
          {dueLabel ? (
            <span
              className={cn(
                "shrink-0 text-[11.5px] tabular-nums",
                isOverdue ? "text-destructive/70" : "text-muted-foreground/55",
              )}
            >
              {dueLabel}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex transition-colors duration-200",
        hasSecondaryContent ? "items-start" : "items-center",
        compact
          ? "gap-2.5 rounded-xl border border-border/70 bg-background/95 px-3 py-2.5"
          : "gap-3 px-3 py-3.5 sm:px-3",
        divider && !compact && "border-border/70 border-b",
        selectionMode
          ? bulkSelected
            ? compact
              ? "border-primary/35 bg-primary/10 ring-1 ring-primary/20"
              : "bg-accent"
            : compact
              ? "hover:border-border hover:bg-muted/40"
              : "hover:bg-muted/60"
          : selected
            ? compact
              ? "border-primary/40 bg-primary/12 ring-1 ring-primary/20 shadow-[var(--shadow-soft)]"
              : "bg-accent/78"
            : compact
              ? "motion-safe-lift hover:-translate-y-[1px] hover:border-border/90 hover:bg-card hover:shadow-[var(--shadow-soft)]"
              : "hover:bg-muted/60",
        isDragging && "z-20 scale-[1.01] rounded-xl border border-primary/35 bg-card shadow-[var(--shadow-raised)]",
      )}
    >
      <button
        type="button"
        aria-label={task.is_done ? "Mark task incomplete" : "Mark task complete"}
        onClick={() => onToggle(task, !task.is_done)}
        className={cn(
          "flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border transition-all duration-200",
          hasSecondaryContent && "mt-0.5",
          compact ? "border-border/80 mt-[1px] rounded-full" : "border-border rounded-sm",
          task.is_done
            ? "border-primary bg-primary text-primary-foreground"
            : "bg-card hover:border-primary/60 hover:bg-primary/5 text-transparent",
        )}
      >
        <Check className={cn("transition-transform duration-200", compact ? "h-3 w-3" : "h-3.5 w-3.5", !task.is_done && "scale-0")} />
      </button>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (selectionMode) {
              onSelectionToggle?.(task, { shiftKey: event.shiftKey });
              return;
            }
            onSelect(task, { shiftKey: event.shiftKey });
          }
        }}
        onClick={(event) => {
          if (selectionMode) {
            onSelectionToggle?.(task, { shiftKey: event.shiftKey });
            return;
          }
          onSelect(task, { shiftKey: event.shiftKey });
        }}
        className={cn(
          "focus-visible:ring-ring/60 min-w-0 flex-1 cursor-pointer rounded-md px-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
          hasSecondaryContent ? "py-0.5" : "py-0",
        )}
        aria-label={selectionMode ? `Select ${task.title}` : `Open details for ${task.title}`}
      >
        <div className={cn(hasSecondaryContent && "space-y-2")}>
          <div className="min-w-0">
            <p
              className={cn(
                "text-foreground leading-5 font-medium tracking-tight transition-opacity",
                compact ? "line-clamp-2 text-[13.5px] sm:text-[14px]" : "text-[14px] sm:text-[14.5px]",
                task.is_done ? "text-muted-foreground/60 line-through" : "",
              )}
            >
              {task.title}
            </p>
            {task.description ? (
              <p className={cn("text-muted-foreground/80 line-clamp-1", compact ? "mt-0 text-[11.5px]" : "mt-0.5 text-[13px]")}>
                {task.description}
              </p>
            ) : null}
          </div>

          <div
            className={cn(
              "text-muted-foreground/90 flex flex-wrap items-center",
              compact
                ? "gap-1.5 text-[10.5px]"
                : "gap-x-3 gap-y-1.5 text-[11px] font-bold tracking-[0.12em] uppercase",
            )}
          >
            {showProject && project ? (
              <span className={cn("inline-flex items-center gap-1.5", compact && "rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 font-medium tracking-normal normal-case")}>
                <span className={cn("h-1.5 w-1.5 rounded-sm", palette.accent)} />
                {project.name}
              </span>
            ) : null}
            {visibleLabels.map((label) => (
              <TaskLabelBadge key={label.id} label={label} className={cn(compact && "px-2 py-0.5 text-[10px] font-medium tracking-normal")} />
            ))}
            {displayLabels.length > visibleLabels.length ? (
              <span className={cn("inline-flex items-center", compact && "rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 font-medium tracking-normal normal-case")}>
                +{displayLabels.length - visibleLabels.length} label{displayLabels.length - visibleLabels.length === 1 ? "" : "s"}
              </span>
            ) : null}
            {task.priority ? (
              <Badge
                variant={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "default"}
                className={cn(compact && "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-normal normal-case")}
              >
                {task.priority}
              </Badge>
            ) : null}
            {assignee ? (
              <span className={cn("text-foreground inline-flex items-center gap-1.5 tracking-normal normal-case", compact && "rounded-full border border-border/70 bg-muted/35 px-2 py-0.5")}>
                <Avatar className="border-border/70 h-4 w-4 border">
                  <AvatarImage src={assignee.avatar_url ?? ""} alt={assignee.username ?? "Assignee"} />
                  <AvatarFallback className="text-[8px]">
                    {(assignee.full_name ?? assignee.username ?? "A").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {assignee.full_name ?? `@${assignee.username ?? "unknown"}`}
              </span>
            ) : null}
            {dueLabel ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  compact && "rounded-full border border-border/70 bg-muted/35 px-2 py-0.5 tracking-normal normal-case",
                  isOverdue ? compact ? "border-destructive/25 bg-destructive/10 text-destructive" : "text-destructive" : "",
                )}
              >
                <Clock3 className="h-3.5 w-3.5" />
                {dueLabel}
              </span>
            ) : null}
            {task.recurrence_rule ? (
              <Badge variant="secondary" className={cn(compact && "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-normal normal-case")}>
                {getRecurrenceLabel(task.recurrence_rule)}
              </Badge>
            ) : null}
            {!task.is_done && reminderOffsetMinutes != null ? (
              <span className={cn("inline-flex items-center gap-1", compact && "rounded-full border border-border/70 bg-muted/35 px-2 py-0.5 tracking-normal normal-case")}>
                <Bell className="h-3.5 w-3.5" />
                {getReminderOffsetLabel(reminderOffsetMinutes)}
              </span>
            ) : null}
            {task.estimated_minutes ? (
              <span className={cn("inline-flex items-center", compact && "rounded-full border border-border/70 bg-muted/35 px-2 py-0.5 tracking-normal normal-case")}>
                {task.estimated_minutes} min
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

TaskListItem.displayName = "TaskListItem";

function buildAssigneeDirectory(
  membersByListId: Record<string, ProjectMemberProfile[]>,
) {
  const directory = new Map<string, ProjectMemberProfile>();

  Object.entries(membersByListId).forEach(([listId, members]) => {
    members.forEach((member) => {
      directory.set(`${listId}:${member.user_id}`, member);
    });
  });

  return directory;
}

export function TaskList({
  tasks,
  lists,
  selectedTaskId,
  selectedTaskIds,
  selectionMode = false,
  onSelect,
  onToggle,
  onSelectionToggle,
  showProject = false,
  emptyMessage = "No tasks here yet.",
  compact = false,
  variant = "default",
}: {
  tasks: TaskDatasetRecord[];
  lists: TodoList[];
  selectedTaskId?: string | null;
  selectedTaskIds?: Set<string>;
  selectionMode?: boolean;
  onSelect: (task: TaskDatasetRecord, options?: { shiftKey?: boolean }) => void;
  onToggle: (task: TaskDatasetRecord, nextIsDone: boolean) => void;
  onSelectionToggle?: (
    task: TaskDatasetRecord,
    options?: { shiftKey?: boolean },
  ) => void;
  showProject?: boolean;
  emptyMessage?: string;
  compact?: boolean;
  variant?: "default" | "tasks";
}) {
  const { profile } = useData();
  const { membersByListId } = useTaskDataset();
  const projectById = useMemo(
    () => new Map(lists.map((list) => [list.id, list])),
    [lists],
  );
  const assigneeDirectory = useMemo(
    () => buildAssigneeDirectory(membersByListId),
    [membersByListId],
  );
  const timeZone = profile?.timezone ?? null;

  if (tasks.length === 0) {
    return (
      <div className="surface-empty-state flex items-center justify-center px-4 py-6 text-center" data-size="compact">
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        variant === "tasks"
          ? "overflow-hidden rounded-2xl divide-y divide-border/30"
          : compact
            ? "space-y-2"
            : "border-border bg-card overflow-hidden rounded-xl border",
      )}
    >
      {tasks.map((task, index) => {
        const assignee = task.assignee_user_id
          ? (assigneeDirectory.get(`${task.list_id}:${task.assignee_user_id}`) ?? null)
          : null;

        return (
          <TaskListItem
            key={task.id}
            task={task}
            project={projectById.get(task.list_id) ?? null}
            assignee={assignee}
            timeZone={timeZone}
            selected={task.id === selectedTaskId}
            bulkSelected={selectedTaskIds?.has(task.id) ?? false}
            selectionMode={selectionMode}
            showProject={showProject}
            divider={!compact && index !== tasks.length - 1}
            compact={compact}
            variant={variant}
            onSelectionToggle={onSelectionToggle}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        );
      })}
    </div>
  );
}
