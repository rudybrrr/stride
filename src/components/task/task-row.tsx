"use client";

import { Bell, CalendarRange, Repeat } from "lucide-react";
import { memo, type ReactNode } from "react";

import { TaskCheckbox } from "~/components/task/task-checkbox";
import { PriorityDot, TaskMetaChip } from "~/components/task/task-meta-chip";
import type { TaskDatasetRecord } from "~/hooks/use-task-dataset";
import { getProjectColorToken } from "~/lib/project-appearance";
import { getRecurrenceLabel } from "~/lib/task-recurrence";
import { hasTaskReminder } from "~/lib/task-reminders";
import { formatTaskDueLabel, isTaskOverdue } from "~/lib/task-views";
import { getVisibleTaskLabels } from "~/lib/things-views";
import type { ProjectMemberProfile, TodoList } from "~/lib/types";
import { cn } from "~/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

function getProjectSwatchVar(token?: string | null) {
    return `var(--project-${getProjectColorToken(token)})`;
}

export interface TaskRowProps {
    task: TaskDatasetRecord;
    project?: TodoList | null;
    assignee?: ProjectMemberProfile | null;
    timeZone?: string | null;
    selected?: boolean;
    bulkSelected?: boolean;
    selectionMode?: boolean;
    showProject?: boolean;
    isDragging?: boolean;
    onSelect?: (task: TaskDatasetRecord, options?: { shiftKey?: boolean }) => void;
    onToggle: (task: TaskDatasetRecord, nextIsDone: boolean) => void;
    onSelectionToggle?: (task: TaskDatasetRecord, options?: { shiftKey?: boolean }) => void;
    inlineDetail?: ReactNode;
}

export const TaskRow = memo(function TaskRow({
    task,
    project = null,
    assignee = null,
    timeZone = null,
    selected = false,
    bulkSelected = false,
    selectionMode = false,
    showProject = false,
    isDragging = false,
    onSelect,
    onToggle,
    onSelectionToggle,
    inlineDetail,
}: TaskRowProps) {
    const now = new Date();
    const hasInlineDetail = Boolean(inlineDetail);
    const dueLabel = formatTaskDueLabel(task, now, timeZone);
    const overdue = dueLabel ? isTaskOverdue(task, now, timeZone) : false;
    const projectSwatch = project ? getProjectSwatchVar(project.color_token) : null;
    const displayLabels = getVisibleTaskLabels(task.labels);
    const visibleLabels = displayLabels.slice(0, 3);
    const remainingLabels = displayLabels.length - visibleLabels.length;
    const reminderActive = !task.is_done && hasTaskReminder(task);

    const handleClick = (event: React.MouseEvent) => {
        if (selectionMode) {
            onSelectionToggle?.(task, { shiftKey: event.shiftKey });
            return;
        }
        onSelect?.(task, { shiftKey: event.shiftKey });
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (selectionMode) {
            onSelectionToggle?.(task, { shiftKey: event.shiftKey });
            return;
        }
        onSelect?.(task, { shiftKey: event.shiftKey });
    };

    return (
        <div
            className={cn(
                "task-row group/task relative transition-[background,border-color,box-shadow] duration-[var(--motion-base)]",
                hasInlineDetail && "rounded-[0.72rem] border border-border/80 bg-[color:var(--surface-elevated)] shadow-[var(--shadow-xs)]",
                isDragging && "z-20",
            )}
            data-completed={task.is_done ? "true" : undefined}
            data-selected={selected ? "true" : undefined}
        >
            <div
                role="button"
                tabIndex={0}
                aria-label={selectionMode ? `Select ${task.title}` : `Open ${task.title}`}
                aria-pressed={bulkSelected || selected}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                className={cn(
                    "relative flex cursor-pointer items-start gap-3 rounded-[0.6rem] px-2.5 py-[0.55rem] text-left transition-colors duration-[160ms]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    hasInlineDetail && "rounded-b-none px-[calc(0.625rem-1px)] pt-[calc(0.55rem-1px)]",
                    bulkSelected
                        ? "bg-[color:var(--surface-selected-strong)]"
                        : selected
                            ? "bg-[color:var(--surface-selected)]"
                            : "hover:bg-[color:var(--surface-hover)]",
                    isDragging && "shadow-[var(--shadow-soft)]",
                )}
            >
                <div className="mt-[2px] shrink-0">
                    <TaskCheckbox
                        isDone={task.is_done}
                        priority={task.priority}
                        onToggle={(next) => onToggle(task, next)}
                    />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-baseline gap-2">
                        <span
                            className={cn(
                                "task-row-title min-w-0 flex-1 truncate text-[14px] leading-snug tracking-[-0.012em]",
                                "text-foreground",
                            )}
                        >
                            {task.title}
                        </span>

                        {dueLabel ? (
                            <span
                                className={cn(
                                    "shrink-0 text-[11.5px] tabular-nums leading-none",
                                    overdue ? "text-[color:var(--priority-p1)]" : "text-muted-foreground/60",
                                )}
                            >
                                {dueLabel}
                            </span>
                        ) : null}
                    </div>

                    {(task.description ||
                        showProject ||
                        displayLabels.length > 0 ||
                        task.priority ||
                        task.recurrence_rule ||
                        reminderActive ||
                        assignee) ? (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                            {task.description ? (
                                <span className="line-clamp-1 max-w-full text-[12px] leading-tight text-muted-foreground/65">
                                    {task.description}
                                </span>
                            ) : null}

                            {showProject && project ? (
                                <TaskMetaChip
                                    label={project.name}
                                    swatch={projectSwatch ?? undefined}
                                />
                            ) : null}

                            {task.priority ? <PriorityDot priority={task.priority} /> : null}

                            {visibleLabels.map((label) => (
                                <TaskMetaChip
                                    key={label.id}
                                    label={label.name}
                                    swatch={label.color_token ?? undefined}
                                />
                            ))}
                            {remainingLabels > 0 ? (
                                <TaskMetaChip
                                    tone="muted"
                                    label={`+${remainingLabels}`}
                                />
                            ) : null}

                            {task.recurrence_rule ? (
                                <TaskMetaChip
                                    icon={Repeat}
                                    label={getRecurrenceLabel(task.recurrence_rule)}
                                    tone="muted"
                                />
                            ) : null}

                            {reminderActive ? (
                                <TaskMetaChip icon={Bell} label="Reminder" tone="muted" />
                            ) : null}

                            {!dueLabel && task.estimated_minutes ? (
                                <TaskMetaChip
                                    icon={CalendarRange}
                                    label={formatEstimate(task.estimated_minutes)}
                                    tone="muted"
                                />
                            ) : null}

                            {assignee ? (
                                <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground/85">
                                    <Avatar className="h-3.5 w-3.5 border border-border/60">
                                        <AvatarImage src={assignee.avatar_url ?? ""} alt={assignee.username ?? "Assignee"} />
                                        <AvatarFallback className="text-[7px]">
                                            {(assignee.full_name ?? assignee.username ?? "A").slice(0, 1).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{assignee.full_name ?? assignee.username ?? "Assignee"}</span>
                                </span>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>

            {inlineDetail ? (
                <div className="ml-[calc(18px+1.25rem)] border-t border-border/70 pb-3 pl-0 pr-3 pt-3">
                    {inlineDetail}
                </div>
            ) : null}
        </div>
    );
});

TaskRow.displayName = "TaskRow";

function formatEstimate(minutes: number) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
