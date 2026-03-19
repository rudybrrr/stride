"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Link2,
    ListTodo,
    Menu,
    Pause,
    PencilLine,
    Play,
    Plus,
    RotateCcw,
    Target,
    Trash2,
} from "lucide-react";
import type { DayButtonProps } from "react-day-picker";
import { addMinutes, addMonths, addWeeks, format, isToday, startOfMonth, subMonths, subWeeks } from "date-fns";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { RealtimePostgresChangesPayload } from "@supabase/realtime-js";

import { useData } from "~/components/data-provider";
import { MODE_CONFIG, useFocus } from "~/components/focus-provider";
import { Button } from "~/components/ui/button";
import { Calendar, CalendarDayButton } from "~/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { createSupabaseBrowserClient } from "~/lib/supabase/browser";
import {
    ALL_PROJECTS_VALUE,
    DEFAULT_DAILY_GOAL_MINUTES,
    type PlannerView,
    canNavigateToPreviousPlannerRange,
    clampPlannerAnchor,
    combineDateAndTime,
    formatBlockTimeRange,
    formatMinutesCompact,
    getDurationMinutes,
    getLocalDayBounds,
    getPlannerRangeLabel,
    getVisibleRange,
    getWeekDays,
    moveBlockToDate,
    parsePlannerDate,
    toDateKey,
} from "~/lib/planning";
import type { PlannedFocusBlock, TodoRow } from "~/lib/types";
import { cn } from "~/lib/utils";
import { ListSidebar } from "../todos/list-sidebar";

interface PlannerDaySummary {
    dueCount: number;
    blockCount: number;
}

interface BlockFormState {
    id: string | null;
    title: string;
    listId: string;
    todoId: string | null;
    date: string;
    startTime: string;
    durationMinutes: string;
    linkedTodoLabel: string | null;
}

function createBlockForm({
    dateKey,
    listId,
    title = "",
    todoId = null,
    linkedTodoLabel = null,
    startTime = "09:00",
    durationMinutes = "60",
    id = null,
}: {
    dateKey: string;
    listId: string;
    title?: string;
    todoId?: string | null;
    linkedTodoLabel?: string | null;
    startTime?: string;
    durationMinutes?: string;
    id?: string | null;
}): BlockFormState {
    return {
        id,
        title,
        listId,
        todoId,
        date: dateKey,
        startTime,
        durationMinutes,
        linkedTodoLabel,
    };
}

function sortBlocks(blocks: PlannedFocusBlock[]) {
    return [...blocks].sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
}

function blockMatchesPlannerView(
    block: PlannedFocusBlock,
    selectedListId: string,
    visibleStartIso: string,
    visibleEndIso: string,
) {
    const matchesList = selectedListId === ALL_PROJECTS_VALUE || block.list_id === selectedListId;
    const overlapsVisibleRange = block.scheduled_start < visibleEndIso && block.scheduled_end >= visibleStartIso;

    return matchesList && overlapsVisibleRange;
}

function removeBlockById(blocks: PlannedFocusBlock[], id: string) {
    return blocks.filter((block) => block.id !== id);
}

function PlannerCalendarDayButton({
    metrics,
    day,
    className,
    ...props
}: DayButtonProps & {
    metrics?: PlannerDaySummary;
}) {
    return (
        <CalendarDayButton
            {...props}
            day={day}
            className={cn(
                "group/planner-day h-full min-h-[var(--cell-size)] w-full items-start justify-start rounded-2xl px-2 py-2 text-left data-[selected-single=true]:bg-primary/15 data-[selected-single=true]:text-foreground data-[selected-single=true]:ring-2 data-[selected-single=true]:ring-primary/70 dark:data-[selected-single=true]:bg-primary/20",
                className,
            )}
        >
            <span className="text-sm font-semibold leading-none">{format(day.date, "d")}</span>
            {(metrics?.dueCount || metrics?.blockCount) ? (
                <span className="mt-auto flex flex-wrap items-center gap-1 text-[9px] font-bold uppercase tracking-wide">
                    {metrics.dueCount > 0 && (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-700 group-data-[selected-single=true]/planner-day:bg-amber-500/25 group-data-[selected-single=true]/planner-day:text-amber-950 dark:text-amber-300 dark:group-data-[selected-single=true]/planner-day:text-amber-100">
                            {metrics.dueCount}T
                        </span>
                    )}
                    {metrics.blockCount > 0 && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-primary group-data-[selected-single=true]/planner-day:bg-primary group-data-[selected-single=true]/planner-day:text-primary-foreground">
                            {metrics.blockCount}B
                        </span>
                    )}
                </span>
            ) : (
                <span className="mt-auto text-[9px] font-medium uppercase tracking-wide text-muted-foreground/0">.</span>
            )}
        </CalendarDayButton>
    );
}

function formatFocusClock(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function PlanningFocusPanel({
    selectedDate,
    selectedDayTodosCount,
    selectedDayBlocks,
}: {
    selectedDate: Date;
    selectedDayTodosCount: number;
    selectedDayBlocks: PlannedFocusBlock[];
}) {
    const { mode, timeLeft, isActive, toggleTimer, resetTimer, handleModeChange } = useFocus();
    const config = MODE_CONFIG[mode];
    const progress = useMemo(() => {
        const total = MODE_CONFIG[mode].duration;
        return ((total - timeLeft) / total) * 100;
    }, [mode, timeLeft]);
    const plannedMinutes = useMemo(() => {
        return selectedDayBlocks.reduce((total, block) => {
            return total + getDurationMinutes(block.scheduled_start, block.scheduled_end);
        }, 0);
    }, [selectedDayBlocks]);
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    const selectedDaySummary = `${format(selectedDate, "EEEE, MMM d")} | ${selectedDayTodosCount} due ${selectedDayTodosCount === 1 ? "task" : "tasks"} | ${selectedDayBlocks.length} planned ${selectedDayBlocks.length === 1 ? "block" : "blocks"}`;
    const plannerNote = plannedMinutes > 0
        ? `${formatMinutesCompact(plannedMinutes)} planned for this day.`
        : "No focus blocks scheduled for this day yet.";

    return (
        <Card className="flex h-full min-h-[264px] flex-col rounded-2xl border-border/40 bg-card/50 shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <config.icon className={cn("h-5 w-5", config.color)} />
                            Focus Session
                        </CardTitle>
                        <CardDescription className="max-w-xl">
                            Run the timer without losing sight of what is due and what is already planned.
                        </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        {(Object.keys(MODE_CONFIG) as Array<keyof typeof MODE_CONFIG>).map((nextMode) => (
                            <button
                                key={nextMode}
                                type="button"
                                onClick={() => handleModeChange(nextMode)}
                                className={cn(
                                    "rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors",
                                    mode === nextMode
                                        ? "bg-primary/20 text-primary"
                                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                                )}
                            >
                                {nextMode === "focus" ? "Focus" : nextMode === "shortBreak" ? "Short" : "Long"}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-6">
                <div className="grid gap-6 md:grid-cols-[136px_1fr] md:items-center">
                    <div className="flex justify-center md:justify-start">
                        <div className="relative h-32 w-32">
                            <svg className="h-32 w-32 -rotate-90">
                                <circle
                                    cx="64"
                                    cy="64"
                                    r={radius}
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    className="text-border/60"
                                />
                                <circle
                                    cx="64"
                                    cy="64"
                                    r={radius}
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    style={{ transition: "stroke-dashoffset 0.45s ease" }}
                                    className={config.progressColor}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="font-mono text-[1.8rem] font-black tracking-tight text-foreground">
                                    {formatFocusClock(timeLeft)}
                                </span>
                                <span className={cn("text-[10px] font-bold uppercase tracking-[0.22em]", config.color)}>
                                    {mode === "focus" ? "Work" : "Break"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className={cn("text-xs font-bold uppercase tracking-[0.22em]", config.color)}>
                                {config.label}
                            </p>
                            <h3 className="text-2xl font-black tracking-tight text-foreground">
                                {mode === "focus" ? "Ready for a clean work block." : "Take a short reset."}
                            </h3>
                            <p className="max-w-xl text-sm text-muted-foreground">
                                {plannerNote}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                type="button"
                                size="lg"
                                onClick={toggleTimer}
                                className={cn(
                                    "min-w-[120px] rounded-xl px-5 font-bold shadow-sm",
                                    isActive
                                        ? "bg-muted text-foreground hover:bg-muted/80"
                                        : "bg-primary text-primary-foreground hover:bg-primary/95",
                                )}
                            >
                                {isActive ? (
                                    <Pause className="mr-2 h-4 w-4 fill-current" />
                                ) : (
                                    <Play className="mr-2 h-4 w-4 fill-current" />
                                )}
                                {isActive ? "Pause" : "Start"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                className="rounded-xl border-border/50 bg-background/40 font-semibold"
                                onClick={resetTimer}
                            >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reset
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="border-t border-border/40 pt-4">
                    <p className="text-sm text-muted-foreground">
                        {selectedDaySummary}
                    </p>

                    <p className="mt-2 text-sm text-muted-foreground">
                        {plannerNote}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function DailyTargetRing({
    goalMinutes,
    todayMinutes,
}: {
    goalMinutes: number;
    todayMinutes: number;
}) {
    const progress = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100));
    const radius = 48;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    const overGoalMinutes = Math.max(0, todayMinutes - goalMinutes);

    return (
        <Card className="flex h-full min-h-[264px] flex-col overflow-hidden rounded-2xl border-border/40 bg-card/50 shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-primary" />
                    Daily Target
                </CardTitle>
                <CardDescription>
                    Track today&apos;s completed focus time against your study goal.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid flex-1 gap-5 sm:grid-cols-[128px_1fr] sm:items-center">
                <div className="relative mx-auto flex h-32 w-32 items-center justify-center sm:mx-0">
                    <svg className="h-32 w-32 -rotate-90">
                        <circle
                            cx="64"
                            cy="64"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            className="text-border/60"
                        />
                        <circle
                            cx="64"
                            cy="64"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            style={{ transition: "stroke-dashoffset 0.35s ease" }}
                            className="text-primary"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[2rem] font-black tracking-tight">{progress}%</span>
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            Goal
                        </span>
                    </div>
                </div>

                <div className="space-y-3 text-center sm:text-left">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            Today&apos;s Focus
                        </p>
                        <h3 className="text-2xl font-black tracking-tight">
                            {formatMinutesCompact(todayMinutes)}
                            <span className="text-base font-semibold text-muted-foreground">
                                {" "}
                                / {formatMinutesCompact(goalMinutes)}
                            </span>
                        </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {todayMinutes >= goalMinutes
                            ? `${formatMinutesCompact(overGoalMinutes)} above your daily goal.`
                            : `${formatMinutesCompact(goalMinutes - todayMinutes)} left to hit today's target.`}
                    </p>
                    <Link href="/settings">
                        <Button variant="outline" size="sm" className="rounded-xl font-semibold">
                            Edit Goal
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

function WeekBlockCard({
    block,
    projectName,
    onEdit,
}: {
    block: PlannedFocusBlock;
    projectName: string;
    onEdit: (block: PlannedFocusBlock) => void;
}) {
    return (
        <div className="rounded-2xl border border-border/50 bg-background/80 p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                        {formatBlockTimeRange(block.scheduled_start, block.scheduled_end)}
                    </p>
                    <h4 className="truncate text-sm font-semibold text-foreground">{block.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{projectName}</span>
                        {block.todo_id && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                                <Link2 className="h-3 w-3" />
                                Linked task
                            </span>
                        )}
                    </div>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-lg text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(block)}
                >
                    <PencilLine className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

export default function PlanningClient() {
    const { lists, profile, loading: dataLoading, userId } = useData();
    const { setCurrentListId } = useFocus();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [dueTodos, setDueTodos] = useState<TodoRow[]>([]);
    const [blocks, setBlocks] = useState<PlannedFocusBlock[]>([]);
    const [todayFocusMinutes, setTodayFocusMinutes] = useState(0);
    const [loading, setLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [savingBlock, setSavingBlock] = useState(false);
    const [deletingBlock, setDeletingBlock] = useState(false);
    const latestRequestRef = useRef(0);
    const autoSelectionScopeRef = useRef<string | null>(null);
    const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);

    const rawView = searchParams.get("view");
    const view: PlannerView = rawView === "week" ? "week" : "month";
    const rawAnchorDate = useMemo(() => parsePlannerDate(searchParams.get("date")), [searchParams]);
    const todayKey = toDateKey(new Date());
    const todayDate = useMemo(() => parsePlannerDate(todayKey), [todayKey]);
    const anchorDate = useMemo(() => clampPlannerAnchor(view, rawAnchorDate, todayDate), [rawAnchorDate, todayDate, view]);
    const rawListId = searchParams.get("listId");
    const isKnownList = rawListId ? lists.some((list) => list.id === rawListId) : false;
    const selectedListId = rawListId === ALL_PROJECTS_VALUE
        ? ALL_PROJECTS_VALUE
        : rawListId && isKnownList
            ? rawListId
            : ALL_PROJECTS_VALUE;
    const defaultListId = lists[0]?.id ?? "";

    const [blockForm, setBlockForm] = useState<BlockFormState>(() => createBlockForm({
        dateKey: toDateKey(new Date()),
        listId: "",
    }));

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        let shouldReplace = false;

        if (!params.get("view")) {
            params.set("view", view);
            shouldReplace = true;
        }

        if (!params.get("date") || rawAnchorDate.getTime() !== anchorDate.getTime()) {
            params.set("date", toDateKey(anchorDate));
            shouldReplace = true;
        }

        if (!params.get("listId") || (rawListId && rawListId !== ALL_PROJECTS_VALUE && !isKnownList)) {
            params.set("listId", selectedListId);
            shouldReplace = true;
        }

        if (shouldReplace) {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [anchorDate, isKnownList, pathname, rawAnchorDate, rawListId, router, searchParams, selectedListId, view]);

    useEffect(() => {
        if (!blockForm.listId && defaultListId) {
            setBlockForm((prev) => ({
                ...prev,
                listId: defaultListId,
            }));
        }
    }, [blockForm.listId, defaultListId]);

    useEffect(() => {
        setCurrentListId(selectedListId === ALL_PROJECTS_VALUE ? null : selectedListId);
    }, [selectedListId, setCurrentListId]);

    const visibleRange = useMemo(() => getVisibleRange(view, anchorDate), [anchorDate, view]);
    const visibleStartIso = visibleRange.start.toISOString();
    const visibleEndIso = visibleRange.endExclusive.toISOString();
    const selectedDayKey = toDateKey(anchorDate);
    const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
    const listMap = useMemo(() => new Map(lists.map((list) => [list.id, list])), [lists]);
    const dailyGoalMinutes = profile?.daily_focus_goal_minutes ?? DEFAULT_DAILY_GOAL_MINUTES;
    const plannerScopeKey = `${view}|${visibleStartIso}|${visibleEndIso}|${selectedListId}`;
    const currentMonthStart = useMemo(() => startOfMonth(todayDate), [todayDate]);
    const canGoToPreviousRange = useMemo(
        () => canNavigateToPreviousPlannerRange(view, anchorDate, todayDate),
        [anchorDate, todayDate, view],
    );

    const updatePlannerQuery = useCallback((updates: Partial<{
        view: PlannerView;
        date: string;
        listId: string;
    }>) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", updates.view ?? view);
        params.set("date", updates.date ?? toDateKey(anchorDate));
        params.set("listId", updates.listId ?? selectedListId);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, [anchorDate, pathname, router, searchParams, selectedListId, view]);

    const getProjectName = useCallback((listId: string) => {
        return listMap.get(listId)?.name ?? "Unknown Project";
    }, [listMap]);

    const applyBlockToState = useCallback((incomingBlock: PlannedFocusBlock, previousId?: string) => {
        setBlocks((prev) => {
            const withoutBlock = prev.filter((block) => (
                block.id !== incomingBlock.id
                && (previousId ? block.id !== previousId : true)
            ));

            if (!blockMatchesPlannerView(incomingBlock, selectedListId, visibleStartIso, visibleEndIso)) {
                return withoutBlock;
            }

            return sortBlocks([...withoutBlock, incomingBlock]);
        });
    }, [selectedListId, visibleEndIso, visibleStartIso]);

    const removeBlockFromState = useCallback((blockId: string) => {
        setBlocks((prev) => removeBlockById(prev, blockId));
    }, []);

    const loadPlanningData = useCallback(async (showLoader = true) => {
        if (!userId) return;

        const requestId = ++latestRequestRef.current;
        const requestScopeKey = plannerScopeKey;

        if (showLoader) {
            setLoading(true);
        }

        const todayBounds = getLocalDayBounds(new Date());

        try {
            let todosQuery = supabase
                .from("todos")
                .select("id, user_id, list_id, title, is_done, inserted_at, description, due_date, priority")
                .eq("is_done", false)
                .not("due_date", "is", null)
                .gte("due_date", visibleStartIso)
                .lt("due_date", visibleEndIso)
                .order("due_date", { ascending: true });

            let blocksQuery = supabase
                .from("planned_focus_blocks")
                .select("id, user_id, list_id, todo_id, title, scheduled_start, scheduled_end, inserted_at, updated_at")
                .lt("scheduled_start", visibleEndIso)
                .gte("scheduled_end", visibleStartIso)
                .order("scheduled_start", { ascending: true });

            if (selectedListId !== ALL_PROJECTS_VALUE) {
                todosQuery = todosQuery.eq("list_id", selectedListId);
                blocksQuery = blocksQuery.eq("list_id", selectedListId);
            }

            const focusQuery = supabase
                .from("focus_sessions")
                .select("duration_seconds")
                .eq("user_id", userId)
                .eq("mode", "focus")
                .gte("inserted_at", todayBounds.start.toISOString())
                .lt("inserted_at", todayBounds.endExclusive.toISOString());

            const [todosResponse, blocksResponse, focusResponse] = await Promise.all([
                todosQuery,
                blocksQuery,
                focusQuery,
            ]);

            if (latestRequestRef.current !== requestId) return;

            if (todosResponse.error) throw todosResponse.error;
            if (blocksResponse.error) throw blocksResponse.error;
            if (focusResponse.error) throw focusResponse.error;

            const nextTodos = (todosResponse.data ?? []) as TodoRow[];
            const nextBlocks = sortBlocks((blocksResponse.data ?? []) as PlannedFocusBlock[]);
            const nextFocusMinutes = (focusResponse.data ?? []).reduce((total, session) => {
                return total + Math.round((session.duration_seconds ?? 0) / 60);
            }, 0);

            setDueTodos(nextTodos);
            setBlocks(nextBlocks);
            setTodayFocusMinutes(nextFocusMinutes);
            setLoadedScopeKey(requestScopeKey);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load planning data.";
            toast.error(message);
        } finally {
            if (latestRequestRef.current === requestId) {
                setLoading(false);
                setHasLoadedOnce(true);
            }
        }
    }, [plannerScopeKey, selectedListId, supabase, userId, visibleEndIso, visibleStartIso]);

    useEffect(() => {
        void loadPlanningData();
    }, [loadPlanningData]);

    useEffect(() => {
        if (!userId) return;

        const syncChannel = supabase
            .channel(`planning-sync-${userId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "planned_focus_blocks", filter: `user_id=eq.${userId}` },
                (payload: RealtimePostgresChangesPayload<PlannedFocusBlock>) => {
                    if (payload.eventType === "DELETE") {
                        const deletedId = payload.old.id;
                        if (typeof deletedId === "string") {
                            removeBlockFromState(deletedId);
                        }
                        return;
                    }

                    applyBlockToState(payload.new);
                },
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "focus_sessions", filter: `user_id=eq.${userId}` },
                () => void loadPlanningData(false),
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "todos" },
                () => void loadPlanningData(false),
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(syncChannel);
        };
    }, [applyBlockToState, loadPlanningData, removeBlockFromState, supabase, userId]);

    const dueTodosByDate = useMemo(() => {
        return dueTodos.reduce<Record<string, TodoRow[]>>((acc, todo) => {
            if (!todo.due_date) return acc;
            const key = toDateKey(new Date(todo.due_date));
            (acc[key] ??= []).push(todo);
            return acc;
        }, {});
    }, [dueTodos]);

    const blocksByDate = useMemo(() => {
        return blocks.reduce<Record<string, PlannedFocusBlock[]>>((acc, block) => {
            const key = toDateKey(new Date(block.scheduled_start));
            (acc[key] ??= []).push(block);
            return acc;
        }, {});
    }, [blocks]);

    const daySummaries = useMemo(() => {
        const summaries: Record<string, PlannerDaySummary> = {};

        for (const todo of dueTodos) {
            if (!todo.due_date) continue;
            const key = toDateKey(new Date(todo.due_date));
            summaries[key] ??= { dueCount: 0, blockCount: 0 };
            summaries[key].dueCount += 1;
        }

        for (const block of blocks) {
            const key = toDateKey(new Date(block.scheduled_start));
            summaries[key] ??= { dueCount: 0, blockCount: 0 };
            summaries[key].blockCount += 1;
        }

        return summaries;
    }, [blocks, dueTodos]);

    const selectedDayTodos = dueTodosByDate[selectedDayKey] ?? [];
    const selectedDayBlocks = blocksByDate[selectedDayKey] ?? [];
    const selectedDayHasContent = selectedDayTodos.length > 0 || selectedDayBlocks.length > 0;
    const visibleContentDateKeys = useMemo(() => {
        return Object.entries(daySummaries)
            .filter(([dateKey, summary]) => {
                if (summary.dueCount <= 0 && summary.blockCount <= 0) {
                    return false;
                }

                const date = parsePlannerDate(dateKey);
                return date >= visibleRange.start && date < visibleRange.endExclusive;
            })
            .map(([dateKey]) => dateKey)
            .sort((a, b) => parsePlannerDate(a).getTime() - parsePlannerDate(b).getTime());
    }, [daySummaries, visibleRange.endExclusive, visibleRange.start]);
    const autoSelectionScope = plannerScopeKey;

    useEffect(() => {
        if (loading) return;
        if (loadedScopeKey !== autoSelectionScope) return;
        if (autoSelectionScopeRef.current === autoSelectionScope) return;

        autoSelectionScopeRef.current = autoSelectionScope;

        if (selectedDayHasContent || visibleContentDateKeys.length === 0) {
            return;
        }

        const selectedTimestamp = anchorDate.getTime();
        const fallbackDateKey = visibleContentDateKeys.find(
            (dateKey) => parsePlannerDate(dateKey).getTime() >= selectedTimestamp,
        ) ?? visibleContentDateKeys[0];

        if (fallbackDateKey && fallbackDateKey !== selectedDayKey) {
            updatePlannerQuery({ date: fallbackDateKey });
        }
    }, [
        anchorDate,
        autoSelectionScope,
        loading,
        loadedScopeKey,
        selectedDayHasContent,
        selectedDayKey,
        updatePlannerQuery,
        visibleContentDateKeys,
    ]);

    const openNewBlockDialog = useCallback(() => {
        if (!defaultListId && selectedListId === ALL_PROJECTS_VALUE) {
            toast.error("Create a project in Todos before planning focus blocks.");
            return;
        }

        const listId = selectedListId !== ALL_PROJECTS_VALUE ? selectedListId : defaultListId;
        setBlockForm(createBlockForm({
            dateKey: selectedDayKey,
            listId,
        }));
        setDialogOpen(true);
    }, [defaultListId, selectedDayKey, selectedListId]);

    const openTaskPlanner = useCallback((todo: TodoRow) => {
        setBlockForm(createBlockForm({
            dateKey: todo.due_date ? toDateKey(new Date(todo.due_date)) : selectedDayKey,
            listId: todo.list_id,
            title: todo.title,
            todoId: todo.id,
            linkedTodoLabel: todo.title,
        }));
        setDialogOpen(true);
    }, [selectedDayKey]);

    const openEditDialog = useCallback((block: PlannedFocusBlock) => {
        setBlockForm(createBlockForm({
            id: block.id,
            dateKey: toDateKey(new Date(block.scheduled_start)),
            listId: block.list_id,
            title: block.title,
            todoId: block.todo_id,
            linkedTodoLabel: block.todo_id ? "Linked task attached" : null,
            startTime: format(new Date(block.scheduled_start), "HH:mm"),
            durationMinutes: String(getDurationMinutes(block.scheduled_start, block.scheduled_end)),
        }));
        setDialogOpen(true);
    }, []);

    const saveBlock = useCallback(async () => {
        if (!userId) return;

        const trimmedTitle = blockForm.title.trim();
        const parsedDuration = Number.parseInt(blockForm.durationMinutes, 10);
        const previousBlocks = blocks;
        const previousForm = blockForm;

        if (!trimmedTitle) {
            toast.error("Block title cannot be empty.");
            return;
        }

        if (!blockForm.listId) {
            toast.error("Select a project before saving.");
            return;
        }

        if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
            toast.error("Duration must be a positive number of minutes.");
            return;
        }

        try {
            setSavingBlock(true);

            const scheduledStart = combineDateAndTime(blockForm.date, blockForm.startTime);
            const scheduledEnd = addMinutes(scheduledStart, parsedDuration);
            const fallbackInsertedAt = blocks.find((block) => block.id === blockForm.id)?.inserted_at ?? new Date().toISOString();
            const optimisticId = blockForm.id ?? `temp-${crypto.randomUUID()}`;
            const optimisticBlock: PlannedFocusBlock = {
                id: optimisticId,
                user_id: userId,
                list_id: blockForm.listId,
                todo_id: blockForm.todoId,
                title: trimmedTitle,
                scheduled_start: scheduledStart.toISOString(),
                scheduled_end: scheduledEnd.toISOString(),
                inserted_at: fallbackInsertedAt,
                updated_at: new Date().toISOString(),
            };

            const payload = {
                user_id: userId,
                list_id: blockForm.listId,
                todo_id: blockForm.todoId,
                title: trimmedTitle,
                scheduled_start: scheduledStart.toISOString(),
                scheduled_end: scheduledEnd.toISOString(),
            };

            applyBlockToState(optimisticBlock, blockForm.id ?? undefined);
            setDialogOpen(false);

            const response = blockForm.id
                ? await supabase
                    .from("planned_focus_blocks")
                    .update(payload)
                    .eq("id", blockForm.id)
                    .select("id, user_id, list_id, todo_id, title, scheduled_start, scheduled_end, inserted_at, updated_at")
                    .single()
                : await supabase
                    .from("planned_focus_blocks")
                    .insert(payload)
                    .select("id, user_id, list_id, todo_id, title, scheduled_start, scheduled_end, inserted_at, updated_at")
                    .single();

            if (response.error) {
                throw response.error;
            }

            const savedBlock = response.data as PlannedFocusBlock;
            applyBlockToState(savedBlock, optimisticId);
            toast.success(blockForm.id ? "Focus block updated." : "Focus block created.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to save focus block.";
            setBlocks(previousBlocks);
            setBlockForm(previousForm);
            setDialogOpen(true);
            toast.error(message);
        } finally {
            setSavingBlock(false);
        }
    }, [applyBlockToState, blockForm, blocks, supabase, userId]);

    const deleteBlock = useCallback(async () => {
        if (!blockForm.id) return;

        const previousBlocks = blocks;
        const previousForm = blockForm;
        const deletedBlockId = blockForm.id;

        try {
            setDeletingBlock(true);

            removeBlockFromState(deletedBlockId);
            setDialogOpen(false);

            const { error } = await supabase
                .from("planned_focus_blocks")
                .delete()
                .eq("id", deletedBlockId);

            if (error) {
                throw error;
            }

            toast.success("Focus block deleted.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete focus block.";
            setBlocks(previousBlocks);
            setBlockForm(previousForm);
            setDialogOpen(true);
            toast.error(message);
        } finally {
            setDeletingBlock(false);
        }
    }, [blockForm, blocks, removeBlockFromState, supabase]);

    const handleDragEnd = useCallback(async (result: DropResult) => {
        if (!result.destination || result.destination.droppableId === result.source.droppableId) {
            return;
        }

        const movedBlock = blocks.find((block) => block.id === result.draggableId);
        if (!movedBlock) return;

        const nextTimes = moveBlockToDate(
            movedBlock.scheduled_start,
            movedBlock.scheduled_end,
            result.destination.droppableId,
        );

        const nextBlocks = sortBlocks(blocks.map((block) => (
            block.id === movedBlock.id
                ? {
                    ...block,
                    ...nextTimes,
                }
                : block
        )));

        setBlocks(nextBlocks);

        try {
            const { error } = await supabase
                .from("planned_focus_blocks")
                .update(nextTimes)
                .eq("id", movedBlock.id);

            if (error) {
                throw error;
            }

            toast.success("Focus block moved.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to move focus block.";
            toast.error(message);
            await loadPlanningData(false);
        }
    }, [blocks, loadPlanningData, supabase]);

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        router.push("/login");
    }, [router, supabase]);

    const noOp = useCallback(() => undefined, []);

    const goToPreviousRange = useCallback(() => {
        if (!canGoToPreviousRange) return;
        const nextDate = view === "month" ? subMonths(anchorDate, 1) : subWeeks(anchorDate, 1);
        updatePlannerQuery({ date: toDateKey(nextDate) });
    }, [anchorDate, canGoToPreviousRange, updatePlannerQuery, view]);

    const goToNextRange = useCallback(() => {
        const nextDate = view === "month" ? addMonths(anchorDate, 1) : addWeeks(anchorDate, 1);
        updatePlannerQuery({ date: toDateKey(nextDate) });
    }, [anchorDate, updatePlannerQuery, view]);

    if (dataLoading || !hasLoadedOnce && loading || !userId) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex animate-pulse flex-col items-center gap-3 text-muted-foreground">
                    <CalendarDays className="h-10 w-10 text-primary/40" />
                    <p className="text-xs font-bold uppercase tracking-[0.25em]">Preparing Planning Hub...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <aside className="hidden h-full w-80 border-r border-sidebar-border lg:block">
                <ListSidebar
                    lists={lists}
                    activeListId={null}
                    onListSelect={(id) => router.push(`/todos?listId=${id}`)}
                    onCreateList={() => router.push("/todos")}
                    onDeleteList={noOp}
                    onInvite={noOp}
                    onLogout={handleLogout}
                    userId={userId}
                    username={profile?.username}
                    avatarUrl={profile?.avatar_url}
                />
            </aside>

            <main className="relative flex-1 overflow-y-auto custom-scrollbar">
                <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] rounded-full bg-primary/5 blur-[120px]" />

                <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-7 p-4 pb-20 sm:p-8">
                    <header className="space-y-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                                        <SheetTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-10 w-10 -ml-3 lg:hidden">
                                                <Menu className="h-5 w-5" />
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent side="left" className="w-72 border-none p-0">
                                            <SheetHeader className="sr-only">
                                                <SheetTitle>Navigation Menu</SheetTitle>
                                                <SheetDescription>Move between your planner, projects, and settings.</SheetDescription>
                                            </SheetHeader>
                                            <ListSidebar
                                                lists={lists}
                                                activeListId={null}
                                                onListSelect={(id) => {
                                                    router.push(`/todos?listId=${id}`);
                                                    setMobileSidebarOpen(false);
                                                }}
                                                onCreateList={() => {
                                                    router.push("/todos");
                                                    setMobileSidebarOpen(false);
                                                }}
                                                onDeleteList={noOp}
                                                onInvite={noOp}
                                                onLogout={() => {
                                                    void handleLogout();
                                                    setMobileSidebarOpen(false);
                                                }}
                                                userId={userId}
                                                username={profile?.username}
                                                avatarUrl={profile?.avatar_url}
                                            />
                                        </SheetContent>
                                    </Sheet>

                                    <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-foreground">
                                        <CalendarDays className="h-8 w-8 text-primary" />
                                        Planning Hub
                                    </h1>
                                </div>
                                <p className="max-w-2xl text-sm font-medium text-muted-foreground">
                                    Schedule deep-work blocks, scan upcoming due tasks, and keep your day pointed at a real goal.
                                </p>
                            </div>

                            <Link href="/todos">
                                <Button variant="outline" className="gap-2 rounded-xl font-bold shadow-sm">
                                    <ArrowLeft className="h-4 w-4" />
                                    Back to Todos
                                </Button>
                            </Link>
                        </div>

                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                                <div className="flex h-11 items-center rounded-2xl border border-border/40 bg-card/60 p-1 shadow-sm">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={view === "month" ? "default" : "ghost"}
                                        className="h-9 rounded-xl px-4 font-semibold"
                                        onClick={() => updatePlannerQuery({ view: "month" })}
                                    >
                                        Month
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={view === "week" ? "default" : "ghost"}
                                        className="h-9 rounded-xl px-4 font-semibold"
                                        onClick={() => updatePlannerQuery({ view: "week" })}
                                    >
                                        Week
                                    </Button>
                                </div>

                                <div className="flex h-11 items-center gap-1 rounded-2xl border border-border/40 bg-card/60 p-1.5 shadow-sm">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="rounded-xl disabled:pointer-events-none disabled:opacity-40"
                                        onClick={goToPreviousRange}
                                        disabled={!canGoToPreviousRange}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div className="min-w-[11.5rem] px-2 text-center">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                            {view === "month" ? "Current Range" : "Planner Week"}
                                        </p>
                                        <p className="text-sm font-bold text-foreground">{getPlannerRangeLabel(view, anchorDate)}</p>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon-sm" className="rounded-xl" onClick={goToNextRange}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-11 rounded-xl px-4 font-semibold"
                                    onClick={() => updatePlannerQuery({ date: toDateKey(new Date()) })}
                                >
                                    Today
                                </Button>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-11 min-w-[220px] justify-between rounded-2xl border-border/40 bg-card/60 px-4 font-semibold shadow-sm"
                                            disabled={lists.length === 0}
                                        >
                                            <span className="flex min-w-0 items-center gap-3">
                                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                                    Project
                                                </span>
                                                <span className="truncate text-sm font-semibold text-foreground">
                                                    {selectedListId === ALL_PROJECTS_VALUE ? "All Projects" : getProjectName(selectedListId)}
                                                </span>
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-60 rounded-2xl border-border/50 bg-popover/95 p-2 shadow-xl backdrop-blur-xl"
                                    >
                                        <DropdownMenuLabel className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                            Project Filter
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator className="bg-border/50" />
                                        <DropdownMenuRadioGroup value={selectedListId} onValueChange={(value) => updatePlannerQuery({ listId: value })}>
                                            <DropdownMenuRadioItem value={ALL_PROJECTS_VALUE} className="rounded-xl px-3 py-2 text-sm font-medium">
                                                All Projects
                                            </DropdownMenuRadioItem>
                                            {lists.map((list) => (
                                                <DropdownMenuRadioItem
                                                    key={list.id}
                                                    value={list.id}
                                                    className="rounded-xl px-3 py-2 text-sm font-medium"
                                                >
                                                    {list.name}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button
                                    type="button"
                                    className="h-11 gap-2 rounded-xl px-5 font-bold shadow-sm"
                                    onClick={openNewBlockDialog}
                                >
                                    <Plus className="h-4 w-4" />
                                    New Block
                                </Button>
                            </div>
                        </div>
                    </header>

                    <div className="grid gap-5 xl:grid-cols-[1.28fr_0.92fr] xl:items-stretch">
                        <PlanningFocusPanel
                            selectedDate={anchorDate}
                            selectedDayTodosCount={selectedDayTodos.length}
                            selectedDayBlocks={selectedDayBlocks}
                        />
                        <DailyTargetRing goalMinutes={dailyGoalMinutes} todayMinutes={todayFocusMinutes} />
                    </div>

                    {lists.length === 0 ? (
                        <Card className="rounded-2xl border-border/40 bg-card/50 shadow-sm">
                            <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
                                <CalendarDays className="h-12 w-12 text-primary/30" />
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black tracking-tight">No Projects Yet</h2>
                                    <p className="max-w-md text-sm text-muted-foreground">
                                        Create your first project in Todos before scheduling focus blocks in Planning Hub.
                                    </p>
                                </div>
                                <Link href="/todos">
                                    <Button className="rounded-xl font-bold">Go to Todos</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : view === "month" ? (
                        <div className="grid gap-5 xl:grid-cols-[1.32fr_0.96fr] xl:items-start">
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                <Card className="rounded-2xl border-border/40 bg-card/50 shadow-sm">
                                    <CardHeader className="pb-3">
                                        <CardTitle>Calendar View</CardTitle>
                                        <CardDescription>
                                            Each day shows how many tasks are due and how many focus blocks are already planned.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-5 pt-0">
                                        <Calendar
                                            mode="single"
                                            selected={anchorDate}
                                            month={anchorDate}
                                            onMonthChange={(month) => updatePlannerQuery({ date: toDateKey(month) })}
                                            startMonth={currentMonthStart}
                                            disabled={{ before: currentMonthStart }}
                                            onSelect={(date) => {
                                                if (!date) return;
                                                updatePlannerQuery({ date: toDateKey(date) });
                                            }}
                                            className="w-full rounded-[28px] border border-border/40 bg-background/30 p-5 [--cell-size:--spacing(14)] sm:p-6 sm:[--cell-size:--spacing(16)]"
                                            classNames={{
                                                root: "relative w-full",
                                                month: "w-full",
                                                months: "w-full",
                                                month_grid: "w-full",
                                                table: "w-full",
                                                nav: "absolute inset-x-5 top-5 flex items-center justify-between sm:inset-x-6 sm:top-6",
                                                month_caption: "flex h-(--cell-size) w-full items-center justify-center px-14",
                                                weekdays: "mt-5 flex w-full",
                                                weeks: "w-full",
                                                weekday: "flex-1 text-center text-xs font-medium text-muted-foreground sm:text-sm",
                                                week: "mt-2.5 flex w-full",
                                                day: "group/day relative aspect-square flex-1 p-0 text-center select-none [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
                                            }}
                                            components={{
                                                DayButton: (props) => (
                                                    <PlannerCalendarDayButton
                                                        {...props}
                                                        metrics={daySummaries[toDateKey(props.day.date)]}
                                                    />
                                                ),
                                            }}
                                        />
                                        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
                                                T = due tasks
                                            </span>
                                            <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                                                B = planned blocks
                                            </span>
                                            {loading && <span className="text-primary">Refreshing...</span>}
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>

                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                                <Card className="rounded-2xl border-border/40 bg-card/50 shadow-sm">
                                    <CardHeader className="pb-3">
                                        <CardTitle>{format(anchorDate, "EEEE, MMMM d")}</CardTitle>
                                        <CardDescription>
                                            {selectedDayTodos.length} due {selectedDayTodos.length === 1 ? "task" : "tasks"} and{" "}
                                            {selectedDayBlocks.length} planned {selectedDayBlocks.length === 1 ? "block" : "blocks"}.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-5 pt-0">
                                        <section className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                                    <ListTodo className="h-4 w-4" />
                                                    Due Tasks
                                                </h3>
                                            </div>

                                            {selectedDayTodos.length > 0 ? (
                                                <div className="space-y-2">
                                                    {selectedDayTodos.map((todo) => (
                                                        <div key={todo.id} className="rounded-2xl border border-border/50 bg-background/75 p-3 shadow-sm">
                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                <div className="min-w-0 space-y-1">
                                                                    <h4 className="truncate text-sm font-semibold text-foreground">{todo.title}</h4>
                                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                                        <span>{getProjectName(todo.list_id)}</span>
                                                                        {todo.priority && (
                                                                            <span className="rounded-full bg-muted px-2 py-0.5 capitalize">
                                                                                {todo.priority} priority
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="rounded-xl font-semibold"
                                                                    onClick={() => openTaskPlanner(todo)}
                                                                >
                                                                    Plan Block
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
                                                    Nothing due on this day.
                                                </div>
                                            )}
                                        </section>

                                        <section className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                                    <Clock3 className="h-4 w-4" />
                                                    Planned Blocks
                                                </h3>
                                            </div>

                                            {selectedDayBlocks.length > 0 ? (
                                                <div className="space-y-2">
                                                    {selectedDayBlocks.map((block) => (
                                                        <WeekBlockCard
                                                            key={block.id}
                                                            block={block}
                                                            projectName={getProjectName(block.list_id)}
                                                            onEdit={openEditDialog}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
                                                    No focus blocks planned yet for this day.
                                                </div>
                                            )}
                                        </section>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </div>
                    ) : (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                            <Card className="rounded-2xl border-border/40 bg-card/50 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Weekly Planner</CardTitle>
                                    <CardDescription>
                                        Drag planned focus blocks between days. The block keeps its time and duration when moved.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {loading && (
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                                            Refreshing planner...
                                        </p>
                                    )}
                                    <div className="overflow-x-auto pb-2">
                                        <DragDropContext onDragEnd={(result) => void handleDragEnd(result)}>
                                            <div className="grid min-w-[980px] grid-cols-7 gap-3">
                                                {weekDays.map((day) => {
                                                    const dayKey = toDateKey(day);
                                                    const laneBlocks = blocksByDate[dayKey] ?? [];
                                                    return (
                                                        <Droppable droppableId={dayKey} key={dayKey}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.droppableProps}
                                                                    className={cn(
                                                                        "flex min-h-[360px] flex-col rounded-2xl border border-border/50 bg-background/60 transition-colors",
                                                                        snapshot.isDraggingOver && "border-primary/40 bg-primary/5",
                                                                    )}
                                                                >
                                                                    <div className="border-b border-border/40 px-4 py-4">
                                                                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                                                            {format(day, "EEE")}
                                                                        </p>
                                                                        <div className="mt-1 flex items-center justify-between gap-2">
                                                                            <h3 className="text-lg font-black tracking-tight">
                                                                                {format(day, "MMM d")}
                                                                            </h3>
                                                                            {isToday(day) && (
                                                                                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                                                                                    Today
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-1 flex-col gap-2 p-3">
                                                                        {laneBlocks.length > 0 ? (
                                                                            laneBlocks.map((block, index) => (
                                                                                <Draggable key={block.id} draggableId={block.id} index={index}>
                                                                                    {(draggableProvided, snapshot) => (
                                                                                        <div
                                                                                            ref={draggableProvided.innerRef}
                                                                                            {...draggableProvided.draggableProps}
                                                                                            {...draggableProvided.dragHandleProps}
                                                                                            style={draggableProvided.draggableProps.style}
                                                                                            className={cn(snapshot.isDragging && "rotate-[1deg] opacity-95")}
                                                                                        >
                                                                                            <WeekBlockCard
                                                                                                block={block}
                                                                                                projectName={getProjectName(block.list_id)}
                                                                                                onEdit={openEditDialog}
                                                                                            />
                                                                                        </div>
                                                                                    )}
                                                                                </Draggable>
                                                                            ))
                                                                        ) : (
                                                                            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                                                                                Drop a block here.
                                                                            </div>
                                                                        )}
                                                                        {provided.placeholder}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Droppable>
                                                    );
                                                })}
                                            </div>
                                        </DragDropContext>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </div>
            </main>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-xl rounded-3xl border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black tracking-tight">
                            {blockForm.id ? "Edit Focus Block" : "Create Focus Block"}
                        </DialogTitle>
                        <DialogDescription>
                            Set the date, time, and project for this planned study block.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5">
                        {blockForm.todoId && (
                            <div className="flex items-start justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                                        Linked Task
                                    </p>
                                    <p className="text-sm text-foreground">
                                        {blockForm.linkedTodoLabel ?? "This focus block is linked to a task."}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-xl font-semibold text-primary"
                                    onClick={() => setBlockForm((prev) => ({
                                        ...prev,
                                        todoId: null,
                                        linkedTodoLabel: null,
                                    }))}
                                >
                                    Unlink
                                </Button>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="blockTitle" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                Title
                            </Label>
                            <Input
                                id="blockTitle"
                                value={blockForm.title}
                                onChange={(event) => setBlockForm((prev) => ({ ...prev, title: event.target.value }))}
                                placeholder="Chemistry revision sprint"
                                className="rounded-xl border-border/40 bg-background/60 shadow-sm"
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="blockProject" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                    Project
                                </Label>
                                <select
                                    id="blockProject"
                                    value={blockForm.listId}
                                    onChange={(event) => setBlockForm((prev) => ({
                                        ...prev,
                                        listId: event.target.value,
                                        todoId: null,
                                        linkedTodoLabel: null,
                                    }))}
                                    className="flex h-10 w-full rounded-xl border border-border/40 bg-background/60 px-3 text-sm font-medium text-foreground shadow-sm outline-none"
                                >
                                    {lists.map((list) => (
                                        <option key={list.id} value={list.id}>
                                            {list.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="blockDate" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                    Date
                                </Label>
                                <Input
                                    id="blockDate"
                                    type="date"
                                    value={blockForm.date}
                                    onChange={(event) => setBlockForm((prev) => ({ ...prev, date: event.target.value }))}
                                    className="rounded-xl border-border/40 bg-background/60 shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="blockTime" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                    Start Time
                                </Label>
                                <Input
                                    id="blockTime"
                                    type="time"
                                    value={blockForm.startTime}
                                    onChange={(event) => setBlockForm((prev) => ({ ...prev, startTime: event.target.value }))}
                                    className="rounded-xl border-border/40 bg-background/60 shadow-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="blockDuration" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                    Duration
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="blockDuration"
                                        type="number"
                                        min="1"
                                        step="5"
                                        value={blockForm.durationMinutes}
                                        onChange={(event) => setBlockForm((prev) => ({
                                            ...prev,
                                            durationMinutes: event.target.value,
                                        }))}
                                        className="rounded-xl border-border/40 bg-background/60 pr-20 shadow-sm"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                        minutes
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-4 flex-col gap-3 sm:flex-row sm:justify-between">
                        <div className="flex items-center gap-2">
                            {blockForm.id && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    className="rounded-xl"
                                    disabled={deletingBlock}
                                    onClick={() => void deleteBlock()}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    {deletingBlock ? "Deleting..." : "Delete"}
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                className="rounded-xl font-bold"
                                disabled={savingBlock}
                                onClick={() => void saveBlock()}
                            >
                                {savingBlock ? "Saving..." : blockForm.id ? "Save Changes" : "Create Block"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
