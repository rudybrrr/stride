import {
    compareDeterministicTasks,
    comparePriorityDescending,
    isTaskDueToday,
    isTaskOverdue,
    isTaskUpcoming,
    type TaskRecord,
} from "~/lib/task-views";
import { hasTaskDeadline } from "~/lib/task-deadlines";
import type { TodoList } from "~/lib/types";

export type ThingsViewKind = "inbox" | "today" | "upcoming" | "anytime" | "logbook";

export interface ThingsViewContext {
    inboxListId: string | null;
    timeZone?: string | null;
    now?: Date;
}

export function getInboxListId(lists: TodoList[]): string | null {
    for (const list of lists) {
        if (list.name?.trim().toLowerCase() === "inbox") {
            return list.id;
        }
    }
    return null;
}

export function getVisibleTaskLabels<T extends { name?: string | null }>(labels: T[] = []) {
    return labels;
}

export function selectInboxView<T extends TaskRecord>(tasks: T[], ctx: ThingsViewContext): T[] {
    if (!ctx.inboxListId) return [];
    return tasks
        .filter((task) => !task.is_done && task.list_id === ctx.inboxListId)
        .sort(compareDeterministicTasks);
}

export function selectTodayView<T extends TaskRecord>(tasks: T[], ctx: ThingsViewContext): T[] {
    const now = ctx.now ?? new Date();
    return tasks
        .filter((task) =>
            !task.is_done &&
            (isTaskOverdue(task, now, ctx.timeZone) || isTaskDueToday(task, now, ctx.timeZone)),
        )
        .sort((a, b) => {
            const overdueDelta = Number(isTaskOverdue(b, now, ctx.timeZone)) - Number(isTaskOverdue(a, now, ctx.timeZone));
            if (overdueDelta !== 0) return overdueDelta;
            return comparePriorityDescending(a, b);
        });
}

export function selectUpcomingView<T extends TaskRecord>(tasks: T[], ctx: ThingsViewContext): T[] {
    const now = ctx.now ?? new Date();
    return tasks
        .filter((task) =>
            !task.is_done &&
            isTaskUpcoming(task, now, ctx.timeZone),
        )
        .sort(compareDeterministicTasks);
}

export function selectAnytimeView<T extends TaskRecord>(tasks: T[], ctx: ThingsViewContext): T[] {
    return tasks
        .filter((task) =>
            !task.is_done &&
            task.list_id !== ctx.inboxListId &&
            !hasTaskDeadline(task),
        )
        .sort(compareDeterministicTasks);
}

export function selectLogbookView<T extends TaskRecord>(tasks: T[]): T[] {
    return tasks
        .filter((task) => task.is_done)
        .sort((a, b) => {
            const completedComparison = (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
            if (completedComparison !== 0) return completedComparison;
            return compareDeterministicTasks(a, b);
        });
}

export function selectThingsView<T extends TaskRecord>(
    kind: ThingsViewKind,
    tasks: T[],
    ctx: ThingsViewContext,
): T[] {
    switch (kind) {
        case "inbox":
            return selectInboxView(tasks, ctx);
        case "today":
            return selectTodayView(tasks, ctx);
        case "upcoming":
            return selectUpcomingView(tasks, ctx);
        case "anytime":
            return selectAnytimeView(tasks, ctx);
        case "logbook":
            return selectLogbookView(tasks);
        default:
            return tasks;
    }
}

export const THINGS_VIEW_LABELS: Record<ThingsViewKind, { title: string; subtitle: string }> = {
    inbox: { title: "Inbox", subtitle: "Capture without commitment" },
    today: { title: "Today", subtitle: "Plus what's overdue" },
    upcoming: { title: "Upcoming", subtitle: "Coming up next" },
    anytime: { title: "Anytime", subtitle: "Pick from your projects" },
    logbook: { title: "Logbook", subtitle: "Recently completed" },
};
