"use client";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    getPlannerDeadlineScopeLabel,
    getPlannerPlanningStatusFilterLabel,
    type PlannerFilterState,
    type PlannerSavedFilterRow,
} from "~/lib/planner-filters";
import type { TodoList } from "~/lib/types";

export function PlannerFilterBar({
    activeSavedFilterId,
    activeSavedFilterScopeApplied,
    currentFilterState,
    listMap,
    savedFilters,
    onApplySavedFilter,
    onClearFilters,
}: {
    activeSavedFilterId: string | null;
    activeSavedFilterScopeApplied: boolean;
    currentFilterState: PlannerFilterState;
    listMap: Map<string, TodoList>;
    savedFilters: PlannerSavedFilterRow[];
    onApplySavedFilter: (filterId: string) => void;
    onClearFilters: () => void;
}) {
    const hasTaskFilters = currentFilterState.listId !== "all"
        || currentFilterState.planningStatusFilter !== "all"
        || currentFilterState.deadlineScope !== "all";
    const activeSavedFilter = activeSavedFilterId
        ? savedFilters.find((filter) => filter.id === activeSavedFilterId) ?? null
        : null;

    if (savedFilters.length === 0 && !hasTaskFilters && !activeSavedFilter) {
        return null;
    }

    return (
        <div className="surface-card px-3.5 py-3">
            {savedFilters.length > 0 ? (
                <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">Saved views</span>
                    <div className="surface-muted flex flex-wrap items-center gap-2 px-2.5 py-2">
                        {savedFilters.map((filter) => {
                            const active = activeSavedFilterId === filter.id && activeSavedFilterScopeApplied;

                            return (
                                <Button
                                    key={filter.id}
                                    type="button"
                                    size="xs"
                                    variant={active ? "tonal" : "ghost"}
                                    onClick={() => onApplySavedFilter(filter.id)}
                                    className={active ? "rounded-full px-3.5" : "rounded-full border border-transparent px-3.5 text-muted-foreground hover:border-border/60 hover:text-foreground"}
                                >
                                    {filter.name}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            {(hasTaskFilters || activeSavedFilter) ? (
                <div className="mt-3 space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">Active</span>
                    <div className="surface-muted flex flex-wrap items-center gap-2 px-2.5 py-2">
                        {activeSavedFilter ? (
                            <Badge variant="secondary" className="rounded-full">
                                {activeSavedFilter.name}
                            </Badge>
                        ) : null}
                        {currentFilterState.listId !== "all" ? (
                            <Badge variant="outline" className="rounded-full">
                                {listMap.get(currentFilterState.listId)?.name ?? "Project"}
                            </Badge>
                        ) : null}
                        {currentFilterState.planningStatusFilter !== "all" ? (
                            <Badge variant="outline" className="rounded-full">
                                {getPlannerPlanningStatusFilterLabel(currentFilterState.planningStatusFilter)}
                            </Badge>
                        ) : null}
                        {currentFilterState.deadlineScope !== "all" ? (
                            <Badge variant="outline" className="rounded-full">
                                {getPlannerDeadlineScopeLabel(currentFilterState.deadlineScope)}
                            </Badge>
                        ) : null}
                        <Button type="button" size="xs" variant="ghost" className="rounded-full px-3.5 text-muted-foreground hover:text-foreground" onClick={onClearFilters}>
                            Clear filters
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
