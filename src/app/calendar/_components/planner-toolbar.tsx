"use client";

import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import {
  getPlannerDeadlineScopeLabel,
  getPlannerPlanningStatusFilterLabel,
  PLANNER_DEADLINE_SCOPE_OPTIONS,
  PLANNER_PLANNING_STATUS_FILTER_OPTIONS,
  type PlannerDeadlineScope,
  type PlannerPlanningStatusFilter,
} from "~/lib/planner-filters";
import type { TodoList } from "~/lib/types";
import { cn } from "~/lib/utils";

import type { PlannerView } from "~/lib/planning";

export function PlannerToolbar({
  lists,
  activeSavedFilterName = null,
  canDeleteActiveFilter = false,
  canUpdateActiveFilter = false,
  plannerRangeLabel,
  deadlineScope,
  planningStatusFilter,
  saveFilterName,
  selectedListId,
  selectedScopeLabel,
  showSidebarTrigger = false,
  sidebarButtonLabel = "Details",
  savingFilter = false,
  view,
  onChangeSaveFilterName,
  onClearFilters,
  onDeleteActiveFilter,
  onGoToToday,
  onOpenSidebar,
  onSaveCurrentFilter,
  onSelectList,
  onSetDeadlineScope,
  onSetPlanningStatusFilter,
  onSetView,
  onShiftPeriod,
  onUpdateActiveFilter,
}: {
  lists: TodoList[];
  activeSavedFilterName?: string | null;
  canDeleteActiveFilter?: boolean;
  canUpdateActiveFilter?: boolean;
  plannerRangeLabel: string;
  deadlineScope: PlannerDeadlineScope;
  planningStatusFilter: PlannerPlanningStatusFilter;
  saveFilterName: string;
  selectedListId: string;
  selectedScopeLabel: string;
  showSidebarTrigger?: boolean;
  sidebarButtonLabel?: string;
  savingFilter?: boolean;
  view: PlannerView;
  onChangeSaveFilterName: (value: string) => void;
  onClearFilters: () => void;
  onDeleteActiveFilter?: () => void;
  onGoToToday: () => void;
  onOpenSidebar?: () => void;
  onSaveCurrentFilter: () => void;
  onSelectList: (value: string) => void;
  onSetDeadlineScope: (value: PlannerDeadlineScope) => void;
  onSetPlanningStatusFilter: (value: PlannerPlanningStatusFilter) => void;
  onSetView: (view: PlannerView) => void;
  onShiftPeriod: (direction: -1 | 1) => void;
  onUpdateActiveFilter?: () => void;
}) {
  return (
    <div className="surface-card px-3.5 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-full border border-border/60 bg-background/76">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-none border-r border-border/60"
              onClick={() => onShiftPeriod(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-40 px-3 text-center text-sm font-semibold tracking-[-0.01em] text-foreground">
              {plannerRangeLabel}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-none border-l border-border/60"
              onClick={() => onShiftPeriod(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" className="rounded-full" onClick={onGoToToday}>
            Today
          </Button>

          <div className="inline-flex items-center rounded-lg bg-muted/40 p-0.5">
            {(["day", "week", "month"] as const).map((nextView) => (
              <button
                key={nextView}
                type="button"
                onClick={() => onSetView(nextView)}
                className={cn(
                  "rounded-[0.4rem] px-3 py-1.5 text-[13px] font-medium transition-colors",
                  view === nextView
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground/70 hover:text-foreground",
                )}
              >
                {nextView === "day" ? "Day" : nextView === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center rounded-full border border-border/60 bg-background/76 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            {selectedScopeLabel}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showSidebarTrigger && onOpenSidebar ? (
            <Button variant="outline" size="sm" className="rounded-full" onClick={onOpenSidebar}>
              {sidebarButtonLabel}
            </Button>
          ) : null}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon-sm" className="rounded-full">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="sr-only">Open planner controls</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="floating-surface w-80 p-3.5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Saved filter</p>
                    {activeSavedFilterName ? (
                      <span className="text-[11px] text-muted-foreground">{activeSavedFilterName}</span>
                    ) : null}
                  </div>

                  <Input
                    value={saveFilterName}
                    onChange={(event) => onChangeSaveFilterName(event.target.value)}
                    placeholder="Exam prep queue"
                    className="h-9 rounded-xl border-border/60 bg-background/82"
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button size="xs" variant="outline" className="rounded-full" onClick={onSaveCurrentFilter} disabled={savingFilter}>
                      Save current
                    </Button>
                    {canUpdateActiveFilter && onUpdateActiveFilter ? (
                      <Button size="xs" variant="tonal" className="rounded-full" onClick={onUpdateActiveFilter} disabled={savingFilter}>
                        Update
                      </Button>
                    ) : null}
                    {canDeleteActiveFilter && onDeleteActiveFilter ? (
                      <Button size="xs" variant="ghost" className="rounded-full" onClick={onDeleteActiveFilter} disabled={savingFilter}>
                        Delete
                      </Button>
                    ) : null}
                    <Button size="xs" variant="ghost" className="rounded-full" onClick={onClearFilters}>
                      Clear to all
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Project filter</p>
                  <Select value={selectedListId} onValueChange={onSelectList}>
                    <SelectTrigger className="h-9 rounded-xl border-border/60 bg-background/82 text-sm">
                      <SelectValue placeholder="All projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All projects</SelectItem>
                      {lists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Planning status</p>
                  <Select
                    value={planningStatusFilter}
                    onValueChange={(value) => onSetPlanningStatusFilter(value as PlannerPlanningStatusFilter)}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-border/60 bg-background/82 text-sm">
                      <SelectValue placeholder={getPlannerPlanningStatusFilterLabel(planningStatusFilter)} />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANNER_PLANNING_STATUS_FILTER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Deadline scope</p>
                  <Select
                    value={deadlineScope}
                    onValueChange={(value) => onSetDeadlineScope(value as PlannerDeadlineScope)}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-border/60 bg-background/82 text-sm">
                      <SelectValue placeholder={getPlannerDeadlineScopeLabel(deadlineScope)} />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANNER_DEADLINE_SCOPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
