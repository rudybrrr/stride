"use client";

import { TaskLabelBadge } from "~/components/task-label-badge";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    getPlannerDeadlineScopeLabel,
    getPlannerPlanningStatusFilterLabel,
} from "~/lib/planner-filters";
import {
    getTaskPriorityFilterLabel,
    type TaskViewFilterState,
} from "~/lib/task-filters";
import type { TaskLabel, TaskSavedViewRow, TodoList } from "~/lib/types";
import { cn } from "~/lib/utils";

const filterChipClass = "inline-flex h-7 items-center rounded-full border border-border/55 bg-[color:var(--surface-hover)] px-3 text-[11.5px] font-medium text-muted-foreground/90 transition-colors";
const activeFilterChipClass = "border-primary/20 bg-primary/10 text-foreground";

export function TaskSavedViewBar({
    activeSavedViewId,
    activeSavedViewStateApplied,
    currentFilterState,
    labelMap,
    listMap,
    savedViews,
    onApplySavedView,
    onClearFilters,
}: {
    activeSavedViewId: string | null;
    activeSavedViewStateApplied: boolean;
    currentFilterState: TaskViewFilterState;
    labelMap: Map<string, TaskLabel>;
    listMap: Map<string, TodoList>;
    savedViews: TaskSavedViewRow[];
    onApplySavedView: (viewId: string) => void;
    onClearFilters: () => void;
}) {
    const hasTaskFilters = currentFilterState.listId !== "all"
        || currentFilterState.priorityFilter !== "all"
        || currentFilterState.planningStatusFilter !== "all"
        || currentFilterState.deadlineScope !== "all"
        || currentFilterState.labelIds.length > 0;
    const activeSavedView = activeSavedViewId
        ? savedViews.find((view) => view.id === activeSavedViewId) ?? null
        : null;

    if (savedViews.length === 0 && !hasTaskFilters && !activeSavedView) {
        return null;
    }

    return (
        <div className="mx-auto w-full max-w-[44rem] space-y-2.5">
            <div className="space-y-2.5">
                {savedViews.length > 0 ? (
                    <section className="flex flex-col gap-2 rounded-xl border border-border/35 bg-[color:var(--surface-hover)]/45 px-3 py-2.5 sm:flex-row sm:items-center">
                        <p className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/48">
                            Saved views
                        </p>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                            {savedViews.map((view) => {
                                const active = activeSavedViewId === view.id && activeSavedViewStateApplied;

                                return (
                                    <Button
                                        key={view.id}
                                        type="button"
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => onApplySavedView(view.id)}
                                        className={cn(
                                            "h-7 rounded-full border px-3 text-[11.5px] shadow-none",
                                            active
                                                ? "border-primary/20 bg-primary/10 text-foreground hover:bg-primary/12"
                                                : "border-border/45 bg-transparent text-muted-foreground/78 hover:border-border/70 hover:bg-[color:var(--surface-selected)] hover:text-foreground",
                                        )}
                                    >
                                        <span
                                            className={active ? "h-1.5 w-1.5 rounded-full bg-primary" : "h-1.5 w-1.5 rounded-full bg-border"}
                                        />
                                        {view.name}
                                    </Button>
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                {(hasTaskFilters || activeSavedView) ? (
                    <section className="flex flex-col gap-2 rounded-xl border border-border/35 bg-[color:var(--surface-hover)]/45 px-3 py-2.5 sm:flex-row sm:items-center">
                        <p className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/48">
                            Active filters
                        </p>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                            {activeSavedView ? (
                                <Badge variant="secondary" className={cn(filterChipClass, activeFilterChipClass, "normal-case tracking-normal")}>
                                    {activeSavedView.name}
                                </Badge>
                            ) : null}
                            {currentFilterState.listId !== "all" ? (
                                <Badge variant="outline" className="h-7 rounded-full border-border/55 bg-[color:var(--surface-hover)] px-3 text-[11.5px] font-medium normal-case tracking-normal text-muted-foreground/90">
                                    {listMap.get(currentFilterState.listId)?.name ?? "Project"}
                                </Badge>
                            ) : null}
                            {currentFilterState.priorityFilter !== "all" ? (
                                <Badge variant="outline" className="h-7 rounded-full border-border/55 bg-[color:var(--surface-hover)] px-3 text-[11.5px] font-medium normal-case tracking-normal text-muted-foreground/90">
                                    {getTaskPriorityFilterLabel(currentFilterState.priorityFilter)}
                                </Badge>
                            ) : null}
                            {currentFilterState.planningStatusFilter !== "all" ? (
                                <Badge variant="outline" className="h-7 rounded-full border-border/55 bg-[color:var(--surface-hover)] px-3 text-[11.5px] font-medium normal-case tracking-normal text-muted-foreground/90">
                                    {getPlannerPlanningStatusFilterLabel(currentFilterState.planningStatusFilter)}
                                </Badge>
                            ) : null}
                            {currentFilterState.deadlineScope !== "all" ? (
                                <Badge variant="outline" className="h-7 rounded-full border-border/55 bg-[color:var(--surface-hover)] px-3 text-[11.5px] font-medium normal-case tracking-normal text-muted-foreground/90">
                                    {getPlannerDeadlineScopeLabel(currentFilterState.deadlineScope)}
                                </Badge>
                            ) : null}
                            {currentFilterState.labelIds.map((labelId) => {
                                const label = labelMap.get(labelId);
                                if (!label) return null;

                                return (
                                    <TaskLabelBadge key={labelId} label={label} className="h-7 px-3 py-0 text-[11px] font-medium tracking-normal" />
                                );
                            })}
                            <Button type="button" size="xs" variant="ghost" onClick={onClearFilters} className="h-7 rounded-full px-3 text-[11.5px] text-muted-foreground/72 shadow-none hover:bg-[color:var(--surface-selected)] hover:text-foreground">
                                Clear all
                            </Button>
                        </div>
                    </section>
                ) : null}
            </div>
        </div>
    );
}
