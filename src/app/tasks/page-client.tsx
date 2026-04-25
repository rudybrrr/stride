"use client";

import { AnimatePresence } from "framer-motion";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckSquare2, Filter, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { AppShell, useShellActions } from "~/components/app-shell";
import { EmptyState } from "~/components/app-primitives";
import { useData } from "~/components/data-provider";
import { TaskDetailPanel } from "~/components/task-detail-panel";
import { TaskListView } from "~/components/task/task-list-view";
import { InlineTaskEditor } from "~/components/task/inline-task-editor";
import { QuickAddInlineComposer, type QuickAddDefaults } from "~/components/task/quick-add";
import { TaskSelectionBar } from "~/components/task-selection-bar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "~/components/ui/sheet";
import type { TaskDatasetRecord } from "~/hooks/use-task-dataset";
import { useTaskDataset } from "~/hooks/use-task-dataset";
import { dedupeTasks, useTaskSelectionActions } from "~/hooks/use-task-selection-actions";
import { mergeBufferedTasks, useTaskTransitionBuffer } from "~/hooks/use-task-transition-buffer";
import { useSupabaseBrowserClient } from "~/lib/supabase/browser";
import { getTaskDeadlineDateKey, toDateKeyInTimeZone } from "~/lib/task-deadlines";
import { normalizeTaskSavedViewLabelIds } from "~/lib/task-labels";
import {
    PLANNER_DEADLINE_SCOPE_OPTIONS,
    PLANNER_PLANNING_STATUS_FILTER_OPTIONS,
    type PlannerDeadlineScope,
    type PlannerPlanningStatusFilter,
} from "~/lib/planner-filters";
import {
    applyTaskViewFilters,
    areTaskViewFilterStatesEqual,
    createTaskViewFilterState,
    isTaskSavedViewDeadlineScope,
    isTaskSavedViewPlanningStatusFilter,
    normalizeTaskSavedViewRow,
    TASK_PRIORITY_FILTER_OPTIONS,
    TASK_SAVED_VIEW_FIELDS,
    taskSavedViewToState,
    type TaskPriorityFilter,
    type TaskViewFilterState,
} from "~/lib/task-filters";
import {
    isTaskDueToday,
    isTaskOverdue,
    type SmartView,
} from "~/lib/task-views";
import {
    getInboxListId,
    selectThingsView,
    THINGS_VIEW_LABELS,
    type ThingsViewKind,
} from "~/lib/things-views";
import type { TaskLabel, TaskSavedViewRow } from "~/lib/types";
import { TaskSavedViewBar } from "./_components/task-saved-view-bar";

interface PendingTaskLeaveAction {
    run: () => void;
}

function isTaskNavigationBlockedTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;

    return Boolean(target.closest(
        "input, textarea, select, [contenteditable='true'], #detailDue, [data-slot='select-trigger'], [data-slot='select-content'], [data-slot='select-item'], [data-slot='popover-content']",
    ));
}

function getRouteView(value: string | null): SmartView {
    if (value === "upcoming" || value === "inbox" || value === "done" || value === "anytime") {
        return value;
    }
    return "today";
}

function getThingsViewKind(view: SmartView): ThingsViewKind {
    return view === "done" ? "logbook" : view;
}

function getUpcomingGroupId(task: TaskDatasetRecord, now: Date, timeZone?: string | null) {
    const deadlineDateKey = getTaskDeadlineDateKey(task, timeZone);
    if (!deadlineDateKey) return "later";

    const todayKey = toDateKeyInTimeZone(now, timeZone);
    const diffDays = differenceInCalendarDays(parseISO(`${deadlineDateKey}T00:00:00`), parseISO(`${todayKey}T00:00:00`));

    if (diffDays <= 0) return "today";
    if (diffDays === 1) return "tomorrow";
    if (diffDays <= 7) return "this-week";
    return "later";
}

function groupUpcomingTasks(tasks: TaskDatasetRecord[], now: Date, timeZone?: string | null) {
    const groupOrder = [
        { id: "today", title: "Today" },
        { id: "tomorrow", title: "Tomorrow" },
        { id: "this-week", title: "This Week" },
        { id: "later", title: "Later" },
    ];
    const tasksByGroup = new Map<string, TaskDatasetRecord[]>();

    tasks.forEach((task) => {
        const groupId = getUpcomingGroupId(task, now, timeZone);
        const current = tasksByGroup.get(groupId) ?? [];
        current.push(task);
        tasksByGroup.set(groupId, current);
    });

    return groupOrder
        .map((group) => ({ ...group, tasks: tasksByGroup.get(group.id) ?? [] }))
        .filter((group) => group.tasks.length > 0);
}

function sortTaskSavedViews(views: TaskSavedViewRow[]) {
    return [...views].sort((a, b) => {
        const updatedAtComparison = b.updated_at.localeCompare(a.updated_at);
        if (updatedAtComparison !== 0) return updatedAtComparison;
        return a.name.localeCompare(b.name);
    });
}

function isMissingTaskSavedViewsTableError(error: unknown) {
    if (!error || typeof error !== "object") return false;

    const code = "code" in error ? String(error.code) : "";
    const message = "message" in error ? String(error.message) : "";

    return code === "PGRST205" || code === "42P01" || message.includes("task_saved_views");
}

export default function TasksClient({
    initialView,
    initialTaskId,
}: {
    initialView?: string | null;
    initialTaskId?: string | null;
}) {
    return (
        <AppShell>
            <TasksContent initialView={initialView} initialTaskId={initialTaskId} />
        </AppShell>
    );
}

function TasksContent({
    initialView,
    initialTaskId,
}: {
    initialView?: string | null;
    initialTaskId?: string | null;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { enterPrimaryActivity, openQuickAdd, registerPrimaryActivityReset } = useShellActions();
    const { profile } = useData();
    const { userId, tasks, taskLabels, lists, imagesByTodo, loading } = useTaskDataset();
    const { bufferedTasks, queueBufferedTask } = useTaskTransitionBuffer();
    const supabase = useSupabaseBrowserClient();

    const routeView = getRouteView(searchParams.get("view"));
    const routeTaskId = searchParams.get("taskId");

    const [view, setView] = useState<SmartView>(() => getRouteView(initialView ?? null));
    const [projectFilter, setProjectFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>("all");
    const [planningStatusFilter, setPlanningStatusFilter] = useState<PlannerPlanningStatusFilter>("all");
    const [deadlineScope, setDeadlineScope] = useState<PlannerDeadlineScope>("all");
    const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
    const [savedViews, setSavedViews] = useState<TaskSavedViewRow[]>([]);
    const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
    const [saveViewName, setSaveViewName] = useState("");
    const [savingView, setSavingView] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId ?? null);
    const [fullEditorOpen, setFullEditorOpen] = useState(false);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [bulkDeletingOpen, setBulkDeletingOpen] = useState(false);
    const [detailDirty, setDetailDirty] = useState(false);
    const [pendingTaskLeaveAction, setPendingTaskLeaveAction] = useState<PendingTaskLeaveAction | null>(null);

    useEffect(() => {
        setView(routeView);
    }, [routeView]);

    const currentFilterState = useMemo<TaskViewFilterState>(() => createTaskViewFilterState({
        smartView: view,
        listId: projectFilter,
        priorityFilter,
        planningStatusFilter,
        deadlineScope,
        labelIds: selectedLabelIds,
    }), [deadlineScope, planningStatusFilter, priorityFilter, projectFilter, selectedLabelIds, view]);
    const labelMap = useMemo(() => new Map(taskLabels.map((label) => [label.id, label])), [taskLabels]);
    const listMap = useMemo(() => new Map(lists.map((list) => [list.id, list])), [lists]);
    const filteredTasks = useMemo(
        () => applyTaskViewFilters(tasks, currentFilterState, profile?.timezone),
        [currentFilterState, profile?.timezone, tasks],
    );

    const inboxListId = useMemo(() => getInboxListId(lists), [lists]);
    const visibleTasks = useMemo(() => {
        const viewKind = getThingsViewKind(view);
        return selectThingsView(viewKind, filteredTasks, {
            inboxListId,
            timeZone: profile?.timezone,
            now: new Date(),
        });
    }, [filteredTasks, inboxListId, profile?.timezone, view]);
    const overdueTasks = useMemo(
        () => visibleTasks.filter((task) => isTaskOverdue(task, new Date(), profile?.timezone)),
        [profile?.timezone, visibleTasks],
    );
    const dueTodayTasks = useMemo(
        () => visibleTasks.filter((task) => !isTaskOverdue(task, new Date(), profile?.timezone) && isTaskDueToday(task, new Date(), profile?.timezone)),
        [profile?.timezone, visibleTasks],
    );
    const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
    const defaultListId = useMemo(
        () => {
            if (projectFilter !== "all") return projectFilter;

            const firstProject = lists.find((list) => list.id !== inboxListId);
            if (view === "anytime") {
                return firstProject?.id ?? inboxListId ?? lists[0]?.id ?? null;
            }

            return inboxListId ?? lists[0]?.id ?? null;
        },
        [inboxListId, lists, projectFilter, view],
    );
    const thingsViewKind = getThingsViewKind(view);
    const currentViewMeta = THINGS_VIEW_LABELS[thingsViewKind];
    const activeSavedView = useMemo(
        () => activeSavedViewId ? savedViews.find((savedView) => savedView.id === activeSavedViewId) ?? null : null,
        [activeSavedViewId, savedViews],
    );
    const activeSavedViewState = useMemo(
        () => activeSavedView ? taskSavedViewToState(activeSavedView) : null,
        [activeSavedView],
    );
    const activeSavedViewStateApplied = useMemo(
        () => activeSavedViewState ? areTaskViewFilterStatesEqual(currentFilterState, activeSavedViewState) : false,
        [activeSavedViewState, currentFilterState],
    );
    const activeFilterCount = Number(projectFilter !== "all")
        + Number(priorityFilter !== "all")
        + Number(planningStatusFilter !== "all")
        + Number(deadlineScope !== "all")
        + Number(selectedLabelIds.length > 0);

    const setRouteView = useCallback((nextView: SmartView) => {
        const nextParams = new URLSearchParams(searchParams.toString());

        if (nextView === "today") {
            nextParams.delete("view");
        } else {
            nextParams.set("view", nextView);
        }

        const nextQuery = nextParams.toString();
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }, [pathname, router, searchParams]);

    useEffect(() => {
        if (!userId) {
            setSavedViews([]);
            setActiveSavedViewId(null);
            setSaveViewName("");
            return;
        }

        let cancelled = false;

        async function loadSavedViews() {
            const { data, error } = await supabase
                .from("task_saved_views")
                .select(TASK_SAVED_VIEW_FIELDS)
                .eq("user_id", userId)
                .order("updated_at", { ascending: false });

            if (cancelled) return;

            if (error) {
                if (isMissingTaskSavedViewsTableError(error)) {
                    setSavedViews([]);
                    return;
                }

                toast.error(error.message || "Unable to load saved task views.");
                return;
            }

            setSavedViews(sortTaskSavedViews(((data ?? []) as TaskSavedViewRow[]).map(normalizeTaskSavedViewRow)));
        }

        void loadSavedViews();

        return () => {
            cancelled = true;
        };
    }, [supabase, userId]);

    useEffect(() => {
        if (!activeSavedViewId) return;
        if (savedViews.some((savedView) => savedView.id === activeSavedViewId)) return;
        setActiveSavedViewId(null);
    }, [activeSavedViewId, savedViews]);

    useEffect(() => {
        setSaveViewName(activeSavedView?.name ?? "");
    }, [activeSavedView]);

    const clearTaskFilters = useCallback(() => {
        setActiveSavedViewId(null);
        setSaveViewName("");
        setProjectFilter("all");
        setPriorityFilter("all");
        setPlanningStatusFilter("all");
        setDeadlineScope("all");
        setSelectedLabelIds([]);
    }, []);

    const handleApplySavedView = useCallback((viewId: string) => {
        const savedView = savedViews.find((item) => item.id === viewId);
        if (!savedView) return;

        const nextState = taskSavedViewToState(savedView);
        setActiveSavedViewId(savedView.id);
        setProjectFilter(nextState.listId);
        setPriorityFilter(nextState.priorityFilter);
        setPlanningStatusFilter(nextState.planningStatusFilter);
        setDeadlineScope(nextState.deadlineScope);
        setSelectedLabelIds(nextState.labelIds);
        setSaveViewName(savedView.name);
        setRouteView(nextState.smartView);
    }, [savedViews, setRouteView]);

    const canUpdateActiveSavedView = useMemo(() => {
        if (!activeSavedView || !activeSavedViewState) return false;

        const normalizedName = saveViewName.trim();
        if (!normalizedName) return false;

        return normalizedName !== activeSavedView.name
            || !areTaskViewFilterStatesEqual(currentFilterState, activeSavedViewState);
    }, [activeSavedView, activeSavedViewState, currentFilterState, saveViewName]);

    const handleSaveCurrentView = useCallback(async () => {
        if (!userId) return;

        const normalizedName = saveViewName.trim();
        if (!normalizedName) {
            toast.error("Name the saved view first.");
            return;
        }

        if (savedViews.some((savedView) => savedView.name.trim().toLowerCase() === normalizedName.toLowerCase())) {
            toast.error("A saved view with that name already exists.");
            return;
        }

        try {
            setSavingView(true);
            const { data, error } = await supabase
                .from("task_saved_views")
                .insert({
                    user_id: userId,
                    name: normalizedName,
                    smart_view: currentFilterState.smartView,
                    list_id: currentFilterState.listId === "all" ? null : currentFilterState.listId,
                    priority_filter: currentFilterState.priorityFilter,
                    planning_status_filter: currentFilterState.planningStatusFilter,
                    deadline_scope: currentFilterState.deadlineScope,
                    label_ids: currentFilterState.labelIds,
                })
                .select(TASK_SAVED_VIEW_FIELDS)
                .single();

            if (error) throw error;

            const savedView = normalizeTaskSavedViewRow(data as TaskSavedViewRow);
            setSavedViews((current) => sortTaskSavedViews([savedView, ...current.filter((item) => item.id !== savedView.id)]));
            setActiveSavedViewId(savedView.id);
            setSaveViewName(savedView.name);
            toast.success("Saved view created.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save this view.");
        } finally {
            setSavingView(false);
        }
    }, [currentFilterState, saveViewName, savedViews, supabase, userId]);

    const handleUpdateActiveSavedView = useCallback(async () => {
        if (!activeSavedView) return;

        const normalizedName = saveViewName.trim();
        if (!normalizedName) {
            toast.error("Name the saved view first.");
            return;
        }

        if (savedViews.some((savedView) => savedView.id !== activeSavedView.id && savedView.name.trim().toLowerCase() === normalizedName.toLowerCase())) {
            toast.error("A saved view with that name already exists.");
            return;
        }

        try {
            setSavingView(true);
            const { data, error } = await supabase
                .from("task_saved_views")
                .update({
                    name: normalizedName,
                    smart_view: currentFilterState.smartView,
                    list_id: currentFilterState.listId === "all" ? null : currentFilterState.listId,
                    priority_filter: currentFilterState.priorityFilter,
                    planning_status_filter: currentFilterState.planningStatusFilter,
                    deadline_scope: currentFilterState.deadlineScope,
                    label_ids: currentFilterState.labelIds,
                })
                .eq("id", activeSavedView.id)
                .select(TASK_SAVED_VIEW_FIELDS)
                .single();

            if (error) throw error;

            const updatedView = normalizeTaskSavedViewRow(data as TaskSavedViewRow);
            setSavedViews((current) => sortTaskSavedViews(current.map((savedView) => savedView.id === updatedView.id ? updatedView : savedView)));
            setSaveViewName(updatedView.name);
            toast.success("Saved view updated.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to update this saved view.");
        } finally {
            setSavingView(false);
        }
    }, [activeSavedView, currentFilterState, saveViewName, savedViews, supabase]);

    const handleDeleteActiveSavedView = useCallback(async () => {
        if (!activeSavedView) return;

        try {
            setSavingView(true);
            const { error } = await supabase
                .from("task_saved_views")
                .delete()
                .eq("id", activeSavedView.id);

            if (error) throw error;

            setSavedViews((current) => current.filter((savedView) => savedView.id !== activeSavedView.id));
            setActiveSavedViewId(null);
            setSaveViewName("");
            toast.success("Saved view deleted.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to delete this saved view.");
        } finally {
            setSavingView(false);
        }
    }, [activeSavedView, supabase]);

    const overdueDisplayTasks = useMemo(
        () => mergeBufferedTasks(overdueTasks, bufferedTasks.filter((item) => item.bucket === "today-overdue")),
        [bufferedTasks, overdueTasks],
    );
    const dueTodayDisplayTasks = useMemo(
        () => mergeBufferedTasks(dueTodayTasks, bufferedTasks.filter((item) => item.bucket === "today-due")),
        [bufferedTasks, dueTodayTasks],
    );
    const visibleDisplayTasks = useMemo(
        () => mergeBufferedTasks(visibleTasks, bufferedTasks.filter((item) => item.bucket === `view:${view}`)),
        [bufferedTasks, view, visibleTasks],
    );
    const hasTodayDisplayTasks = overdueDisplayTasks.length > 0 || dueTodayDisplayTasks.length > 0;
    const upcomingGroups = useMemo(
        () => view === "upcoming" ? groupUpcomingTasks(visibleDisplayTasks, new Date(), profile?.timezone) : [],
        [profile?.timezone, view, visibleDisplayTasks],
    );
    const taskCreationDefaults = useMemo<QuickAddDefaults>(() => {
        const defaults: QuickAddDefaults = {};

        if (defaultListId) {
            defaults.listId = defaultListId;
        }

        if (view === "today") {
            defaults.dueDate = toDateKeyInTimeZone(new Date(), profile?.timezone);
        } else if (view === "upcoming") {
            defaults.dueDate = toDateKeyInTimeZone(addDays(new Date(), 1), profile?.timezone);
        }

        return defaults;
    }, [defaultListId, profile?.timezone, view]);
    const inlineComposerPlaceholder = view === "today"
        ? "Add to Today"
        : view === "upcoming"
            ? "Add to Tomorrow"
            : view === "inbox"
                ? "Add to Inbox"
                : "Add a task";
    const openTaskCreation = useCallback(() => {
        openQuickAdd(taskCreationDefaults);
    }, [openQuickAdd, taskCreationDefaults]);
    const currentViewDescription = view === "today"
        ? hasTodayDisplayTasks
            ? `${overdueDisplayTasks.length} overdue / ${dueTodayDisplayTasks.length} due today`
            : "Nothing due today."
        : view === "upcoming"
            ? `${visibleDisplayTasks.length} upcoming`
            : view === "inbox"
                ? `${visibleDisplayTasks.length} in your inbox`
                : view === "anytime"
                    ? `${visibleDisplayTasks.length} ready when you are`
                    : `${visibleDisplayTasks.length} completed`;
    const selectableTasks = useMemo(
        () => view === "today"
            ? dedupeTasks([...overdueDisplayTasks, ...dueTodayDisplayTasks])
            : dedupeTasks(visibleDisplayTasks),
        [dueTodayDisplayTasks, overdueDisplayTasks, view, visibleDisplayTasks],
    );
    const selectedTaskIndex = useMemo(
        () => selectableTasks.findIndex((task) => task.id === selectedTaskId),
        [selectableTasks, selectedTaskId],
    );
    const previousTask = selectedTaskIndex > 0 ? selectableTasks[selectedTaskIndex - 1] ?? null : null;
    const nextTask = selectedTaskIndex !== -1 && selectedTaskIndex < selectableTasks.length - 1
        ? (selectableTasks[selectedTaskIndex + 1] ?? null)
        : null;
    const taskPositionLabel = selectedTaskIndex === -1 ? null : `${selectedTaskIndex + 1} of ${selectableTasks.length}`;
    const getBufferPlacement = useCallback((task: TaskDatasetRecord, nextIsDone: boolean) => {
        if (view === "today" && nextIsDone) {
            const overdueIndex = overdueTasks.findIndex((item) => item.id === task.id);
            if (overdueIndex !== -1) {
                return { bucket: "today-overdue", index: overdueIndex };
            }

            const dueTodayIndex = dueTodayTasks.findIndex((item) => item.id === task.id);
            if (dueTodayIndex !== -1) {
                return { bucket: "today-due", index: dueTodayIndex };
            }
        }

        const willLeaveCurrentView = (view === "done" && !nextIsDone) || (view !== "done" && nextIsDone);
        if (!willLeaveCurrentView) return null;

        const visibleIndex = visibleTasks.findIndex((item) => item.id === task.id);
        return visibleIndex !== -1 ? { bucket: `view:${view}`, index: visibleIndex } : null;
    }, [dueTodayTasks, overdueTasks, view, visibleTasks]);

    const {
        selectionMode,
        selectedTaskIdSet,
        selectedVisibleTasks,
        allVisibleSelected,
        bulkCompleting,
        bulkDeleting,
        bulkEditing,
        handleToggle,
        handleToggleTaskSelection,
        handleToggleSelectionMode,
        handleCancelSelectionMode,
        handleToggleSelectAll,
        handleCompleteSelected,
        handleDeleteSelected,
        handleSetSelectedDueDate,
        handleSetSelectedPriority,
        handleMoveSelectedTasks,
    } = useTaskSelectionActions({
        allTasks: tasks,
        selectableTasks,
        queueBufferedTask,
        getBufferPlacement,
        onTaskDeleted(taskId) {
            setSelectedTaskId((current) => current === taskId ? null : current);
        },
    });

    async function handleConfirmDeleteSelected() {
        await handleDeleteSelected();
        setBulkDeletingOpen(false);
    }

    const requestTaskLeave = useCallback((action: () => void) => {
        if (detailDirty && selectedTaskId) {
            setPendingTaskLeaveAction({ run: action });
            return;
        }

        action();
    }, [detailDirty, selectedTaskId]);

    const activateSelectionMode = useCallback(() => {
        if (selectionMode) return;
        enterPrimaryActivity("tasks:selection");
        handleToggleSelectionMode();
    }, [enterPrimaryActivity, handleToggleSelectionMode, selectionMode]);

    const handleConfirmTaskLeave = useCallback(() => {
        if (!pendingTaskLeaveAction) return;

        const { run } = pendingTaskLeaveAction;
        setPendingTaskLeaveAction(null);
        setDetailDirty(false);
        run();
    }, [pendingTaskLeaveAction]);

    const handleCancelTaskLeave = useCallback(() => {
        setPendingTaskLeaveAction(null);
    }, []);

    const requestSelectionModeExit = useCallback(() => {
        if (!selectionMode || bulkEditing || bulkCompleting || bulkDeleting) return;
        handleCancelSelectionMode();
    }, [bulkCompleting, bulkDeleting, bulkEditing, handleCancelSelectionMode, selectionMode]);

    const handleSelectionModeChange = useCallback(() => {
        if (selectionMode) {
            requestSelectionModeExit();
            return;
        }
        requestTaskLeave(() => {
            setSelectedTaskId(null);
            setDetailDirty(false);
            activateSelectionMode();
        });
    }, [activateSelectionMode, requestSelectionModeExit, requestTaskLeave, selectionMode]);

    const handleTaskSelect = useCallback((task: TaskDatasetRecord, options?: { shiftKey?: boolean }) => {
        if (options?.shiftKey) {
            requestTaskLeave(() => {
                setSelectedTaskId(null);
                setDetailDirty(false);
                enterPrimaryActivity("tasks:selection");
                handleToggleTaskSelection(task, { shiftKey: true, enterSelectionMode: true });
            });
            return;
        }

        const nextTaskId = selectedTaskId === task.id ? null : task.id;
        requestTaskLeave(() => {
            if (nextTaskId) {
                enterPrimaryActivity("tasks:detail");
            }
            setSelectedTaskId(nextTaskId);
            setDetailDirty(false);
        });
    }, [enterPrimaryActivity, handleToggleTaskSelection, requestTaskLeave, selectedTaskId]);

    const handleTaskPanelNavigate = useCallback((taskId: string) => {
        if (taskId === selectedTaskId) return;

        requestTaskLeave(() => {
            enterPrimaryActivity("tasks:detail");
            setSelectedTaskId(taskId);
            setDetailDirty(false);
        });
    }, [enterPrimaryActivity, requestTaskLeave, selectedTaskId]);

    const handleTaskSelection = useCallback((task: TaskDatasetRecord, options?: { shiftKey?: boolean }) => {
        handleToggleTaskSelection(task, { shiftKey: options?.shiftKey });
    }, [handleToggleTaskSelection]);

    useEffect(() => registerPrimaryActivityReset("tasks:selection", () => {
        setBulkDeletingOpen(false);
        setPendingTaskLeaveAction(null);
        setDetailDirty(false);
        handleCancelSelectionMode();
    }), [handleCancelSelectionMode, registerPrimaryActivityReset]);

    useEffect(() => registerPrimaryActivityReset("tasks:detail", () => {
        setPendingTaskLeaveAction(null);
        setDetailDirty(false);
        setSelectedTaskId(null);
    }), [registerPrimaryActivityReset]);

    useEffect(() => {
        if (selectionMode) return;
        if (routeTaskId) {
            enterPrimaryActivity("tasks:detail");
        }
        setSelectedTaskId(routeTaskId);
    }, [enterPrimaryActivity, routeTaskId, selectionMode]);

    useEffect(() => {
        if (!selectionMode) return;
        setSelectedTaskId(null);
        setDetailDirty(false);
    }, [selectionMode]);

    useEffect(() => {
        if (selectedTask) return;
        setDetailDirty(false);
        setPendingTaskLeaveAction(null);
    }, [selectedTask]);

    useEffect(() => {
        if (!selectedTask || selectionMode) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
            if (pendingTaskLeaveAction || bulkDeletingOpen || mobileFiltersOpen) return;
            if (isTaskNavigationBlockedTarget(event.target)) return;

            if (event.key === "ArrowLeft") {
                if (!previousTask) return;
                event.preventDefault();
                handleTaskPanelNavigate(previousTask.id);
                return;
            }

            if (event.key === "ArrowRight") {
                if (!nextTask) return;
                event.preventDefault();
                handleTaskPanelNavigate(nextTask.id);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [
        bulkDeletingOpen,
        handleTaskPanelNavigate,
        mobileFiltersOpen,
        nextTask,
        pendingTaskLeaveAction,
        previousTask,
        selectedTask,
        selectionMode,
    ]);

    useEffect(() => {
        if (!selectionMode) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.key !== "Escape") return;
            if (bulkDeletingOpen) return;

            event.preventDefault();
            requestSelectionModeExit();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [bulkDeletingOpen, requestSelectionModeExit, selectionMode]);

    const renderInlineTaskEditor = useCallback((task: TaskDatasetRecord) => (
        <InlineTaskEditor
            task={task}
            showProject={projectFilter === "all"}
            onClose={() => setSelectedTaskId(null)}
            onOpenFullEditor={() => setFullEditorOpen(true)}
        />
    ), [projectFilter]);

    const canCreateInCurrentView = view !== "done";

    const taskContent = loading ? (
        <div className="px-1 py-6 text-sm text-muted-foreground">Loading tasks...</div>
    ) : view === "today" ? (
        hasTodayDisplayTasks ? (
            <div className="space-y-1">
                {overdueDisplayTasks.length > 0 ? (
                    <div>
                        <div className="flex items-baseline gap-3 px-1 pb-1 pt-5">
                            <h2 className="text-[1.05rem] font-semibold tracking-[-0.025em] text-foreground/80">Overdue</h2>
                            <span className="text-[13px] text-muted-foreground/50">{overdueTasks.length}</span>
                        </div>
                        <TaskListView
                            tasks={overdueDisplayTasks}
                            lists={lists}
                            showProject
                            selectedTaskId={selectedTaskId}
                            selectedTaskIds={selectedTaskIdSet}
                            selectionMode={selectionMode}
                            onSelectionToggle={handleTaskSelection}
                            onSelect={handleTaskSelect}
                            onToggle={(task, nextIsDone) => void handleToggle(task.id, nextIsDone)}
                            emptyMessage="Nothing overdue."
                            renderInlineDetail={renderInlineTaskEditor}
                        />
                    </div>
                ) : null}

                <div>
                    <TaskListView
                        tasks={dueTodayDisplayTasks}
                        lists={lists}
                        showProject
                        selectedTaskId={selectedTaskId}
                        selectedTaskIds={selectedTaskIdSet}
                        selectionMode={selectionMode}
                        onSelectionToggle={handleTaskSelection}
                        onSelect={handleTaskSelect}
                        onToggle={(task, nextIsDone) => void handleToggle(task.id, nextIsDone)}
                        emptyMessage="Nothing else due today."
                        renderInlineDetail={renderInlineTaskEditor}
                    />
                </div>
            </div>
        ) : (
            <EmptyState
                title="No tasks"
                description="Adjust filters or add one."
                size="compact"
                action={canCreateInCurrentView ? (
                    <Button size="sm" onClick={openTaskCreation}>
                        <Plus className="h-4 w-4" />
                        Add
                    </Button>
                ) : undefined}
            />
        )
    ) : visibleDisplayTasks.length === 0 ? (
        <EmptyState
            title="No tasks"
            description="Adjust filters or add one."
            size="compact"
            action={canCreateInCurrentView ? (
                <Button size="sm" onClick={openTaskCreation}>
                    <Plus className="h-4 w-4" />
                    Add
                </Button>
            ) : undefined}
        />
    ) : view === "upcoming" ? (
        <div className="space-y-3">
            {upcomingGroups.map((group) => (
                <div key={group.id}>
                    <div className="flex items-baseline gap-3 px-1 pb-1 pt-3">
                        <h2 className="text-[1.05rem] font-semibold tracking-[-0.025em] text-foreground/80">{group.title}</h2>
                        <span className="text-[13px] text-muted-foreground/50">{group.tasks.length}</span>
                    </div>
                    <TaskListView
                        tasks={group.tasks}
                        lists={lists}
                        showProject={projectFilter === "all"}
                        selectedTaskId={selectedTaskId}
                        selectedTaskIds={selectedTaskIdSet}
                        selectionMode={selectionMode}
                        onSelectionToggle={handleTaskSelection}
                        onSelect={handleTaskSelect}
                        onToggle={(task, nextIsDone) => void handleToggle(task.id, nextIsDone)}
                        renderInlineDetail={renderInlineTaskEditor}
                    />
                </div>
            ))}
        </div>
    ) : (
        <TaskListView
            tasks={visibleDisplayTasks}
            lists={lists}
            showProject={projectFilter === "all"}
            selectedTaskId={selectedTaskId}
            selectedTaskIds={selectedTaskIdSet}
            selectionMode={selectionMode}
            onSelectionToggle={handleTaskSelection}
            onSelect={handleTaskSelect}
            onToggle={(task, nextIsDone) => void handleToggle(task.id, nextIsDone)}
            renderInlineDetail={renderInlineTaskEditor}
        />
    );

    return (
        <>
            <div className={selectionMode ? "page-container gap-4 pb-28" : "page-container gap-4"}>
                <div className="mx-auto w-full max-w-[44rem]">
                    <header className="flex items-start justify-between gap-4 pb-2">
                        <div>
                            <h1 className="view-heading">{currentViewMeta.title}</h1>
                            <p className="mt-1.5 text-[13px] text-muted-foreground/60">{currentViewDescription}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pt-1">
                            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                                <SheetTrigger asChild>
                                    <Button variant="outline" size="icon-sm" className="relative rounded-full sm:hidden">
                                        <Filter className="h-4 w-4" />
                                        {activeFilterCount > 0 ? (
                                            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-sm bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                                                {activeFilterCount}
                                            </span>
                                        ) : null}
                                        <span className="sr-only">Open filters</span>
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="bottom" className="rounded-t-[1.75rem] border-x-0 border-t border-border/70 bg-[var(--surface-elevated)]">
                                    <SheetHeader className="sr-only">
                                        <SheetTitle>Filters</SheetTitle>
                                        <SheetDescription>Refine this task view and save reusable task views.</SheetDescription>
                                    </SheetHeader>
                                    <TasksFilterPanel
                                        lists={lists}
                                        taskLabels={taskLabels}
                                        saveViewName={saveViewName}
                                        savingView={savingView}
                                        canDeleteActiveSavedView={Boolean(activeSavedView)}
                                        canUpdateActiveSavedView={canUpdateActiveSavedView}
                                        projectFilter={projectFilter}
                                        priorityFilter={priorityFilter}
                                        planningStatusFilter={planningStatusFilter}
                                        deadlineScope={deadlineScope}
                                        selectedLabelIds={selectedLabelIds}
                                        onProjectFilterChange={setProjectFilter}
                                        onPriorityFilterChange={setPriorityFilter}
                                        onPlanningStatusFilterChange={setPlanningStatusFilter}
                                        onDeadlineScopeChange={setDeadlineScope}
                                        onToggleLabelId={(labelId) => setSelectedLabelIds((current) => {
                                            return current.includes(labelId)
                                                ? current.filter((currentLabelId) => currentLabelId !== labelId)
                                                : normalizeTaskSavedViewLabelIds([...current, labelId]);
                                        })}
                                        onChangeSaveViewName={setSaveViewName}
                                        onClearFilters={clearTaskFilters}
                                        onDeleteActiveSavedView={() => void handleDeleteActiveSavedView()}
                                        onSaveCurrentView={() => void handleSaveCurrentView()}
                                        onUpdateActiveSavedView={() => void handleUpdateActiveSavedView()}
                                    />
                                </SheetContent>
                            </Sheet>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="icon-sm" className="relative hidden rounded-full sm:flex">
                                        <Filter className="h-4 w-4" />
                                        {activeFilterCount > 0 ? (
                                            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-sm bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                                                {activeFilterCount}
                                            </span>
                                        ) : null}
                                        <span className="sr-only">Open filters</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="floating-surface w-[22rem] p-3.5">
                                    <TasksFilterPanel
                                        lists={lists}
                                        taskLabels={taskLabels}
                                        saveViewName={saveViewName}
                                        savingView={savingView}
                                        canDeleteActiveSavedView={Boolean(activeSavedView)}
                                        canUpdateActiveSavedView={canUpdateActiveSavedView}
                                        projectFilter={projectFilter}
                                        priorityFilter={priorityFilter}
                                        planningStatusFilter={planningStatusFilter}
                                        deadlineScope={deadlineScope}
                                        selectedLabelIds={selectedLabelIds}
                                        onProjectFilterChange={setProjectFilter}
                                        onPriorityFilterChange={setPriorityFilter}
                                        onPlanningStatusFilterChange={setPlanningStatusFilter}
                                        onDeadlineScopeChange={setDeadlineScope}
                                        onToggleLabelId={(labelId) => setSelectedLabelIds((current) => {
                                            return current.includes(labelId)
                                                ? current.filter((currentLabelId) => currentLabelId !== labelId)
                                                : normalizeTaskSavedViewLabelIds([...current, labelId]);
                                        })}
                                        onChangeSaveViewName={setSaveViewName}
                                        onClearFilters={clearTaskFilters}
                                        onDeleteActiveSavedView={() => void handleDeleteActiveSavedView()}
                                        onSaveCurrentView={() => void handleSaveCurrentView()}
                                        onUpdateActiveSavedView={() => void handleUpdateActiveSavedView()}
                                    />
                                </PopoverContent>
                            </Popover>

                            <Button
                                variant={selectionMode ? "tonal" : "outline"}
                                size="icon-sm"
                                className="rounded-full"
                                onClick={handleSelectionModeChange}
                                aria-pressed={selectionMode}
                                title={selectionMode ? "Exit selection mode" : "Select tasks"}
                            >
                                <CheckSquare2 className="h-4 w-4" />
                                <span className="sr-only">{selectionMode ? "Exit selection mode" : "Select tasks"}</span>
                            </Button>

                            {!selectionMode && canCreateInCurrentView ? (
                                <Button size="sm" className="rounded-full px-4" onClick={openTaskCreation}>
                                    <Plus className="h-4 w-4" />
                                    Add
                                </Button>
                            ) : null}
                        </div>
                    </header>

                </div>

                <AnimatePresence>
                    {selectionMode ? (
                        <TaskSelectionBar
                            lists={lists}
                            selectedCount={selectedVisibleTasks.length}
                            totalVisibleCount={selectableTasks.length}
                            allVisibleSelected={allVisibleSelected}
                            editing={bulkEditing}
                            completing={bulkCompleting}
                            deleting={bulkDeleting}
                            variant="tasks"
                            onCancel={requestSelectionModeExit}
                            onToggleSelectAll={handleToggleSelectAll}
                            onSetDueDate={handleSetSelectedDueDate}
                            onSetPriority={handleSetSelectedPriority}
                            onSetProject={handleMoveSelectedTasks}
                            onCompleteSelected={() => void handleCompleteSelected()}
                            onDeleteSelected={() => setBulkDeletingOpen(true)}
                        />
                    ) : null}
                </AnimatePresence>

                <TaskSavedViewBar
                    activeSavedViewId={activeSavedViewId}
                    activeSavedViewStateApplied={activeSavedViewStateApplied}
                    currentFilterState={currentFilterState}
                    labelMap={labelMap}
                    listMap={listMap}
                    savedViews={savedViews}
                    onApplySavedView={handleApplySavedView}
                    onClearFilters={clearTaskFilters}
                />

                <div className="grid gap-5 lg:flex lg:items-start lg:gap-0">
                    <div className="mx-auto w-full max-w-[44rem] min-w-0 flex-1">
                        {taskContent}
                        {canCreateInCurrentView && !loading && !selectionMode ? (
                            <QuickAddInlineComposer
                                className="mt-2"
                                defaults={taskCreationDefaults}
                                placeholder={inlineComposerPlaceholder}
                            />
                        ) : null}
                    </div>
                    {userId ? (
                        <TaskDetailPanel
                            task={selectedTask}
                            lists={lists}
                            images={selectedTask ? imagesByTodo[selectedTask.id] ?? [] : []}
                            userId={userId}
                            previousTask={previousTask}
                            nextTask={nextTask}
                            taskPositionLabel={taskPositionLabel}
                            open={fullEditorOpen && !selectionMode && !!selectedTask}
                            onOpenChange={(open) => {
                                if (!open) {
                                    requestTaskLeave(() => {
                                        setFullEditorOpen(false);
                                        setDetailDirty(false);
                                    });
                                }
                            }}
                            onClose={() => {
                                requestTaskLeave(() => {
                                    setFullEditorOpen(false);
                                    setDetailDirty(false);
                                });
                            }}
                            onNavigateToTask={handleTaskPanelNavigate}
                            onDirtyChange={setDetailDirty}
                            onSaved={() => undefined}
                            onDeleted={() => {
                                setPendingTaskLeaveAction(null);
                                setDetailDirty(false);
                                setSelectedTaskId(null);
                            }}
                        />
                    ) : null}
                </div>
            </div>

            <Dialog open={!!pendingTaskLeaveAction} onOpenChange={(open) => {
                if (!open) {
                    handleCancelTaskLeave();
                }
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Discard unsaved changes?</DialogTitle>
                        <DialogDescription>
                            Your edits to {selectedTask?.title ? `"${selectedTask.title}"` : "this task"} haven&apos;t been saved.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCancelTaskLeave}>
                            Stay
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmTaskLeave}>
                            Discard changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={bulkDeletingOpen} onOpenChange={setBulkDeletingOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete selected tasks?</DialogTitle>
                        <DialogDescription>
                            Delete {selectedVisibleTasks.length} selected task{selectedVisibleTasks.length === 1 ? "" : "s"}.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkDeletingOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => void handleConfirmDeleteSelected()} disabled={bulkDeleting}>
                            {bulkDeleting ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function TasksFilterPanel({
    canDeleteActiveSavedView,
    canUpdateActiveSavedView,
    deadlineScope,
    lists,
    onChangeSaveViewName,
    onClearFilters,
    onDeadlineScopeChange,
    onDeleteActiveSavedView,
    onPlanningStatusFilterChange,
    projectFilter,
    priorityFilter,
    planningStatusFilter,
    saveViewName,
    savingView,
    selectedLabelIds,
    taskLabels,
    onProjectFilterChange,
    onPriorityFilterChange,
    onSaveCurrentView,
    onToggleLabelId,
    onUpdateActiveSavedView,
}: {
    canDeleteActiveSavedView: boolean;
    canUpdateActiveSavedView: boolean;
    deadlineScope: PlannerDeadlineScope;
    lists: { id: string; name: string }[];
    onChangeSaveViewName: (value: string) => void;
    onClearFilters: () => void;
    onDeadlineScopeChange: (value: PlannerDeadlineScope) => void;
    onDeleteActiveSavedView: () => void;
    onPlanningStatusFilterChange: (value: PlannerPlanningStatusFilter) => void;
    projectFilter: string;
    priorityFilter: TaskPriorityFilter;
    planningStatusFilter: PlannerPlanningStatusFilter;
    saveViewName: string;
    savingView: boolean;
    selectedLabelIds: string[];
    taskLabels: TaskLabel[];
    onProjectFilterChange: (value: string) => void;
    onPriorityFilterChange: (value: TaskPriorityFilter) => void;
    onSaveCurrentView: () => void;
    onToggleLabelId: (labelId: string) => void;
    onUpdateActiveSavedView: () => void;
}) {
    const hasActiveFilters = projectFilter !== "all"
        || priorityFilter !== "all"
        || planningStatusFilter !== "all"
        || deadlineScope !== "all"
        || selectedLabelIds.length > 0;

    return (
        <div className="space-y-4 p-1">
            <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">Project</p>
                <Select value={projectFilter} onValueChange={onProjectFilterChange}>
                    <SelectTrigger className="h-9 rounded-lg bg-background">
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">Priority</p>
                <div className="flex flex-wrap gap-2">
                    {TASK_PRIORITY_FILTER_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onPriorityFilterChange(option.value)}
                            className={cnFilterChip(priorityFilter === option.value)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">Planning</p>
                <Select value={planningStatusFilter} onValueChange={(value) => {
                    if (!isTaskSavedViewPlanningStatusFilter(value)) return;
                    onPlanningStatusFilterChange(value);
                }}>
                    <SelectTrigger className="h-9 rounded-lg bg-background">
                        <SelectValue placeholder="All planning" />
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">Deadline</p>
                <Select value={deadlineScope} onValueChange={(value) => {
                    if (!isTaskSavedViewDeadlineScope(value)) return;
                    onDeadlineScopeChange(value);
                }}>
                    <SelectTrigger className="h-9 rounded-lg bg-background">
                        <SelectValue placeholder="All deadlines" />
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

            {taskLabels.length > 0 ? (
                <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">Labels</p>
                    <div className="flex flex-wrap gap-2">
                        {taskLabels.map((label) => {
                            const active = selectedLabelIds.includes(label.id);

                            return (
                                <button
                                    key={label.id}
                                    type="button"
                                    onClick={() => onToggleLabelId(label.id)}
                                    className={cnFilterChip(active, active ? "normal-case tracking-normal" : "normal-case tracking-normal")}
                                >
                                    {active ? <Check className="h-3 w-3" /> : null}
                                    {label.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}

            <div className="space-y-2 border-t border-border/60 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">Saved view</p>
                <Input
                    value={saveViewName}
                    onChange={(event) => onChangeSaveViewName(event.target.value)}
                    placeholder="Exam prep, deep work, backlog"
                    className="h-9 rounded-lg bg-background"
                />
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={savingView}
                        onClick={onSaveCurrentView}
                    >
                        Save current
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={savingView || !canUpdateActiveSavedView}
                        onClick={onUpdateActiveSavedView}
                    >
                        Update
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={savingView || !canDeleteActiveSavedView}
                        onClick={onDeleteActiveSavedView}
                    >
                        Delete
                    </Button>
                </div>
            </div>

            {hasActiveFilters ? (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-full justify-center rounded-lg"
                    onClick={onClearFilters}
                >
                    Clear filters
                </Button>
            ) : null}
        </div>
    );
}

function cnFilterChip(active: boolean, className?: string) {
    return active
        ? `inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-[11px] font-semibold tracking-normal text-primary ${className ?? ""}`.trim()
        : `inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] font-medium tracking-normal text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground ${className ?? ""}`.trim();
}
