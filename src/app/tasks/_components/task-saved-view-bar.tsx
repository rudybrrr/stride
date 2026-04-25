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
        <div className="surface-card px-3.5 py-3">
            <div className="space-y-3">
                {savedViews.length > 0 ? (
                    <div className="space-y-2">
                        <p className="eyebrow">
                            Saved views
                        </p>
                        <div className="surface-muted flex flex-wrap items-center gap-2 overflow-x-auto px-2.5 py-2">
                            {savedViews.map((view) => {
                                const active = activeSavedViewId === view.id && activeSavedViewStateApplied;

                                return (
                                    <Button
                                        key={view.id}
                                        type="button"
                                        size="xs"
                                        variant={active ? "tonal" : "ghost"}
                                        onClick={() => onApplySavedView(view.id)}
                                        className={active ? "h-8 rounded-full px-3.5" : "h-8 rounded-full border border-transparent px-3.5 text-muted-foreground hover:border-border/60 hover:text-foreground"}
                                    >
                                        <span
                                            className={active ? "bg-primary-foreground h-1.5 w-1.5 rounded-full" : "bg-border h-1.5 w-1.5 rounded-full"}
                                        />
                                        {view.name}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                ) : null}

                {(hasTaskFilters || activeSavedView) ? (
                    <div className="space-y-2">
                        <p className="eyebrow">
                            Active filters
                        </p>
                        <div className="surface-muted flex flex-wrap items-center gap-2 px-2.5 py-2">
                            {activeSavedView ? (
                                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 normal-case tracking-normal">
                                    {activeSavedView.name}
                                </Badge>
                            ) : null}
                            {currentFilterState.listId !== "all" ? (
                                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 normal-case tracking-normal">
                                    {listMap.get(currentFilterState.listId)?.name ?? "Project"}
                                </Badge>
                            ) : null}
                            {currentFilterState.priorityFilter !== "all" ? (
                                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 normal-case tracking-normal">
                                    {getTaskPriorityFilterLabel(currentFilterState.priorityFilter)}
                                </Badge>
                            ) : null}
                            {currentFilterState.planningStatusFilter !== "all" ? (
                                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 normal-case tracking-normal">
                                    {getPlannerPlanningStatusFilterLabel(currentFilterState.planningStatusFilter)}
                                </Badge>
                            ) : null}
                            {currentFilterState.deadlineScope !== "all" ? (
                                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 normal-case tracking-normal">
                                    {getPlannerDeadlineScopeLabel(currentFilterState.deadlineScope)}
                                </Badge>
                            ) : null}
                            {currentFilterState.labelIds.map((labelId) => {
                                const label = labelMap.get(labelId);
                                if (!label) return null;

                                return (
                                    <TaskLabelBadge key={labelId} label={label} className="px-2.5 py-0.5 text-[10px] font-medium tracking-normal" />
                                );
                            })}
                            <Button type="button" size="xs" variant="ghost" onClick={onClearFilters} className="h-8 rounded-full px-3.5 text-muted-foreground hover:text-foreground">
                                Clear all
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
