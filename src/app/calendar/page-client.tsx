"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, format, isSameDay, startOfDay, subDays, subMonths } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { DayButtonProps } from "react-day-picker";
import { toast } from "sonner";

import { AppShell } from "~/components/app-shell";
import { EmptyState, PageHeader, SectionCard } from "~/components/app-primitives";
import { CompactFocusStrip } from "~/components/focus-strip";
import { Button } from "~/components/ui/button";
import { Calendar, CalendarDayButton } from "~/components/ui/calendar";
import { DatePickerField } from "~/components/ui/date-picker-field";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { TimeSelectField } from "~/components/ui/time-select-field";
import { useData } from "~/components/data-provider";
import { useTaskDataset } from "~/hooks/use-task-dataset";
import { createSupabaseBrowserClient } from "~/lib/supabase/browser";
import {
    combineDateAndTime,
    formatBlockTimeRange,
    formatMinutesCompact,
    getPlannerRangeLabel,
    getWeekDays,
    toDateKey,
    type PlannerView,
} from "~/lib/planning";
import { getSmartViewTasks } from "~/lib/task-views";
import type { PlannedFocusBlock } from "~/lib/types";
import { cn } from "~/lib/utils";

interface BlockFormState {
    id: string | null;
    title: string;
    listId: string;
    todoId: string | null;
    date: string;
    startTime: string;
    durationMinutes: string;
}

interface PlannerDaySummary {
    dueCount: number;
    blockCount: number;
}

function createBlockForm(listId: string, date = toDateKey(new Date())): BlockFormState {
    return {
        id: null,
        title: "",
        listId,
        todoId: null,
        date,
        startTime: "09:00",
        durationMinutes: "60",
    };
}

function getDayBlocks(blocks: PlannedFocusBlock[], date: Date) {
    return blocks
        .filter((block) => isSameDay(new Date(block.scheduled_start), date))
        .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
}

function CalendarMonthDayButton({
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
                "group/month-day h-full min-h-[var(--cell-size)] w-full items-start justify-start rounded-lg border border-transparent px-2 py-2 text-left shadow-none hover:border-border hover:bg-muted/55 data-[today=true]:border-primary/30 data-[today=true]:bg-primary/8 data-[selected-single=true]:border-primary data-[selected-single=true]:bg-primary/14 data-[selected-single=true]:text-foreground [&>span:first-child]:text-sm [&>span:first-child]:font-semibold sm:[&>span:first-child]:text-base",
                className,
            )}
        >
            <span className="leading-none">{format(day.date, "d")}</span>
            {metrics && (metrics.dueCount > 0 || metrics.blockCount > 0) ? (
                <span className="mt-auto flex flex-wrap items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em]">
                    {metrics.dueCount > 0 ? (
                        <span className="rounded-sm bg-amber-500/14 px-1.5 py-0.5 text-amber-800 dark:text-amber-200">
                            {metrics.dueCount}T
                        </span>
                    ) : null}
                    {metrics.blockCount > 0 ? (
                        <span className="rounded-sm bg-primary/14 px-1.5 py-0.5 text-primary">
                            {metrics.blockCount}B
                        </span>
                    ) : null}
                </span>
            ) : (
                <span className="mt-auto text-[9px] uppercase tracking-[0.12em] text-transparent">.</span>
            )}
        </CalendarDayButton>
    );
}

export default function CalendarClient() {
    return (
        <AppShell>
            <CalendarContent />
        </AppShell>
    );
}

function CalendarContent() {
    const searchParams = useSearchParams();
    const { profile, userId } = useData();
    const { lists, tasks, plannedBlocks, todayFocusMinutes, loading, refresh } = useTaskDataset();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    const [view, setView] = useState<PlannerView>("week");
    const [anchorDate, setAnchorDate] = useState(startOfDay(new Date()));
    const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
    const [selectedListId, setSelectedListId] = useState(searchParams.get("listId") ?? "all");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<BlockFormState>(() => createBlockForm(""));

    useEffect(() => {
        if (!form.listId && lists[0]) {
            setForm((current) => ({ ...current, listId: lists[0]!.id }));
        }
    }, [form.listId, lists]);

    useEffect(() => {
        const taskId = searchParams.get("taskId");
        if (!taskId) return;
        const task = tasks.find((item) => item.id === taskId);
        if (!task) return;
        setForm({
            id: null,
            title: task.title,
            listId: task.list_id,
            todoId: task.id,
            date: task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd") : toDateKey(new Date()),
            startTime: "09:00",
            durationMinutes: task.estimated_minutes ? String(task.estimated_minutes) : "60",
        });
        setSelectedDate(task.due_date ? new Date(task.due_date) : startOfDay(new Date()));
        setSelectedListId(task.list_id);
        setDialogOpen(true);
    }, [searchParams, tasks]);

    const filteredTasks = useMemo(() => {
        const scoped = selectedListId === "all"
            ? tasks
            : tasks.filter((task) => task.list_id === selectedListId);
        return scoped.filter((task) => !task.is_done);
    }, [selectedListId, tasks]);

    const filteredBlocks = useMemo(() => {
        return selectedListId === "all"
            ? plannedBlocks
            : plannedBlocks.filter((block) => block.list_id === selectedListId);
    }, [plannedBlocks, selectedListId]);

    const daySummaries = useMemo(() => {
        const summaries: Record<string, PlannerDaySummary> = {};

        filteredTasks.forEach((task) => {
            if (!task.due_date) return;
            const key = toDateKey(new Date(task.due_date));
            summaries[key] ??= { dueCount: 0, blockCount: 0 };
            summaries[key].dueCount += 1;
        });

        filteredBlocks.forEach((block) => {
            const key = toDateKey(new Date(block.scheduled_start));
            summaries[key] ??= { dueCount: 0, blockCount: 0 };
            summaries[key].blockCount += 1;
        });

        return summaries;
    }, [filteredBlocks, filteredTasks]);

    const weekDays = getWeekDays(anchorDate);
    const dayTasks = filteredTasks.filter((task) => task.due_date && isSameDay(new Date(task.due_date), selectedDate));
    const dayBlocks = getDayBlocks(filteredBlocks, selectedDate);
    const upcomingTasks = getSmartViewTasks(
        filteredTasks.map((task) => ({
            ...task,
            has_planned_block: plannedBlocks.some((block) => block.todo_id === task.id),
        })),
        "upcoming",
    ).slice(0, 5);
    const unscheduledTasks = filteredTasks.filter((task) => !task.has_planned_block).slice(0, 5);
    const dailyGoal = profile?.daily_focus_goal_minutes ?? 120;

    function openBlockDialog(taskId?: string) {
        const task = taskId ? tasks.find((item) => item.id === taskId) : null;
        const listId = task?.list_id ?? (selectedListId === "all" ? lists[0]?.id ?? "" : selectedListId);
        setForm({
            id: null,
            title: task?.title ?? "",
            listId,
            todoId: task?.id ?? null,
            date: toDateKey(selectedDate),
            startTime: "09:00",
            durationMinutes: task?.estimated_minutes ? String(task.estimated_minutes) : "60",
        });
        setDialogOpen(true);
    }

    function editBlock(block: PlannedFocusBlock) {
        const durationMinutes = Math.max(
            15,
            Math.round((new Date(block.scheduled_end).getTime() - new Date(block.scheduled_start).getTime()) / 60000),
        );
        setForm({
            id: block.id,
            title: block.title,
            listId: block.list_id,
            todoId: block.todo_id,
            date: format(new Date(block.scheduled_start), "yyyy-MM-dd"),
            startTime: format(new Date(block.scheduled_start), "HH:mm"),
            durationMinutes: String(durationMinutes),
        });
        setDialogOpen(true);
    }

    async function handleSaveBlock() {
        if (!userId || !form.listId || !form.title.trim()) return;

        const start = combineDateAndTime(form.date, form.startTime);
        const end = new Date(start);
        end.setMinutes(start.getMinutes() + Number.parseInt(form.durationMinutes || "60", 10));

        try {
            setSaving(true);

            if (form.id) {
                const { error } = await supabase
                    .from("planned_focus_blocks")
                    .update({
                        title: form.title.trim(),
                        list_id: form.listId,
                        todo_id: form.todoId,
                        scheduled_start: start.toISOString(),
                        scheduled_end: end.toISOString(),
                    })
                    .eq("id", form.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("planned_focus_blocks").insert({
                    user_id: userId,
                    list_id: form.listId,
                    todo_id: form.todoId,
                    title: form.title.trim(),
                    scheduled_start: start.toISOString(),
                    scheduled_end: end.toISOString(),
                });
                if (error) throw error;
            }

            toast.success(form.id ? "Focus block updated." : "Focus block created.");
            setDialogOpen(false);
            await refresh({ silent: true });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save focus block.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteBlock() {
        if (!form.id) return;
        try {
            setSaving(true);
            const { error } = await supabase.from("planned_focus_blocks").delete().eq("id", form.id);
            if (error) throw error;
            toast.success("Focus block deleted.");
            setDialogOpen(false);
            await refresh({ silent: true });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to delete focus block.");
        } finally {
            setSaving(false);
        }
    }
    return (
        <>
            <div className="page-container">
                <PageHeader
                    title="Calendar"
                    description={view === "month"
                        ? "Use the full month to spot due tasks, scheduled focus blocks, and open planning gaps."
                        : "Plan the week without wasting space on dashboard fluff."}
                    actions={
                        <>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const today = startOfDay(new Date());
                                    setAnchorDate(today);
                                    setSelectedDate(today);
                                }}
                            >
                                Today
                            </Button>
                            <Button onClick={() => openBlockDialog()}>
                                <Plus className="h-4 w-4" />
                                New block
                            </Button>
                        </>
                    }
                />

                <SectionCard
                    title="Planner"
                    description={view === "month"
                        ? `${filteredTasks.length} open tasks, ${filteredBlocks.length} planned blocks, ${todayFocusMinutes} of ${dailyGoal} focus minutes today.`
                        : "Queue unscheduled tasks, review deadlines, and assign blocks across the week."}
                >
                    <div className="space-y-5">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="inline-flex rounded-lg border border-border bg-muted/60 p-1">
                                    {(["week", "month"] as const).map((nextView) => (
                                        <button
                                            key={nextView}
                                            type="button"
                                            onClick={() => setView(nextView)}
                                            className={cn(
                                                "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
                                                view === nextView
                                                    ? "bg-card text-foreground"
                                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                                            )}
                                        >
                                            {nextView === "week" ? "Week" : "Month"}
                                        </button>
                                    ))}
                                </div>
                                <div className="min-w-56">
                                    <Select value={selectedListId} onValueChange={setSelectedListId}>
                                        <SelectTrigger>
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
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => {
                                        setAnchorDate(view === "week" ? subDays(anchorDate, 7) : subMonths(anchorDate, 1));
                                        setSelectedDate(view === "week" ? subDays(anchorDate, 7) : subMonths(anchorDate, 1));
                                    }}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground">
                                    {getPlannerRangeLabel(view, anchorDate)}
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    onClick={() => {
                                        setAnchorDate(view === "week" ? addDays(anchorDate, 7) : addMonths(anchorDate, 1));
                                        setSelectedDate(view === "week" ? addDays(anchorDate, 7) : addMonths(anchorDate, 1));
                                    }}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {view === "week" ? (
                            <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
                                <div className="space-y-4">
                                    <CompactFocusStrip />

                                    <div className="surface-card p-5">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="eyebrow">Queue</p>
                                                <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">Unscheduled</h3>
                                            </div>
                                            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
                                                {unscheduledTasks.length}
                                            </span>
                                        </div>
                                        <div className="space-y-2.5">
                                            {unscheduledTasks.length > 0 ? unscheduledTasks.map((task) => (
                                                <button
                                                    key={task.id}
                                                    type="button"
                                                    onClick={() => openBlockDialog(task.id)}
                                                    className="flex w-full items-start justify-between gap-3 rounded-[1.1rem] border border-border/60 bg-background/65 px-3.5 py-3 text-left transition-colors hover:bg-muted/80"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            {lists.find((list) => list.id === task.list_id)?.name ?? "Project"}
                                                        </p>
                                                    </div>
                                                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                                                        Plan
                                                    </span>
                                                </button>
                                            )) : (
                                                <div className="surface-muted px-4 py-6 text-sm text-muted-foreground">
                                                    Nothing waiting to be scheduled.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="surface-card p-5">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <p className="eyebrow">Deadlines</p>
                                            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
                                                {upcomingTasks.length}
                                            </span>
                                        </div>
                                        <div className="mb-4">
                                            <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">Due soon</h3>
                                        </div>
                                        <div className="space-y-2.5">
                                            {upcomingTasks.length > 0 ? upcomingTasks.map((task) => (
                                                <div key={task.id} className="rounded-[1.1rem] border border-border/60 bg-background/65 px-3.5 py-3 text-sm">
                                                    <p className="font-semibold text-foreground">{task.title}</p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {task.due_date ? format(new Date(task.due_date), "EEE, MMM d") : "No date"}
                                                    </p>
                                                </div>
                                            )) : (
                                                <div className="surface-muted px-4 py-6 text-sm text-muted-foreground">
                                                    No upcoming deadlines in scope.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 lg:grid-cols-7">
                                    {weekDays.map((day) => {
                                        const dayCards = getDayBlocks(filteredBlocks, day);
                                        const tasksForDay = filteredTasks.filter((task) => task.due_date && isSameDay(new Date(task.due_date), day));
                                        const selected = isSameDay(day, selectedDate);

                                        return (
                                            <div
                                                key={day.toISOString()}
                                                className={cn(
                                                    "min-h-60 rounded-[1.4rem] border p-4 transition-colors",
                                                    selected
                                                        ? "border-primary/35 bg-accent/35 shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                                                        : "border-border/60 bg-background/55 hover:bg-muted/70",
                                                )}
                                            >
                                                <button type="button" className="mb-4 block w-full text-left" onClick={() => setSelectedDate(day)}>
                                                    <p className="eyebrow">{format(day, "EEE")}</p>
                                                    <div className="mt-2 flex items-center justify-between gap-3">
                                                        <p className="text-xl font-semibold tracking-[-0.04em] text-foreground">{format(day, "d")}</p>
                                                        <span className="rounded-full bg-background/80 px-2 py-1 text-[11px] font-mono text-muted-foreground">
                                                            {tasksForDay.length + dayCards.length}
                                                        </span>
                                                    </div>
                                                </button>

                                                <div className="space-y-2.5">
                                                    {tasksForDay.map((task) => (
                                                        <div key={task.id} className="rounded-[1rem] border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                                                            {task.title}
                                                        </div>
                                                    ))}
                                                    {dayCards.map((block) => (
                                                        <button
                                                            key={block.id}
                                                            type="button"
                                                            onClick={() => editBlock(block)}
                                                            className="w-full rounded-[1rem] border border-primary/20 bg-primary/10 px-3 py-3 text-left text-xs text-primary transition-colors hover:bg-primary/14"
                                                        >
                                                            <div className="font-semibold">{block.title}</div>
                                                            <div className="mt-1 flex items-center gap-1 text-[11px] uppercase tracking-[0.14em]">
                                                                <Clock3 className="h-3 w-3" />
                                                                {formatBlockTimeRange(block.scheduled_start, block.scheduled_end)}
                                                            </div>
                                                        </button>
                                                    ))}
                                                    {tasksForDay.length === 0 && dayCards.length === 0 ? (
                                                        <div className="text-xs text-muted-foreground">No items.</div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_20rem] xl:items-start">
                                <div className="surface-card p-4 sm:p-5">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        month={anchorDate}
                                        onMonthChange={(month) => {
                                            const normalizedMonth = startOfDay(month);
                                            setAnchorDate(normalizedMonth);
                                            setSelectedDate(normalizedMonth);
                                        }}
                                        onSelect={(date) => date && setSelectedDate(date)}
                                        className="w-full rounded-xl border border-border bg-muted/25 p-4 sm:p-5 [--cell-size:clamp(4.4rem,7vw,6.5rem)]"
                                        classNames={{
                                            root: "w-full",
                                            month: "w-full",
                                            months: "w-full",
                                            table: "w-full",
                                            month_grid: "w-full",
                                            nav: "absolute inset-x-4 top-4 flex items-center justify-between sm:inset-x-5 sm:top-5",
                                            month_caption: "flex h-(--cell-size) w-full items-center justify-center px-12 sm:px-14",
                                            weekdays: "mt-5 flex w-full",
                                            weeks: "w-full",
                                            week: "mt-2 flex w-full",
                                            weekday: "flex-1 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
                                            day: "group/day relative aspect-square flex-1 p-1 text-center select-none",
                                        }}
                                        components={{
                                            DayButton: (props) => (
                                                <CalendarMonthDayButton
                                                    {...props}
                                                    metrics={daySummaries[toDateKey(props.day.date)]}
                                                />
                                            ),
                                        }}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <CompactFocusStrip />

                                    <div className="surface-card p-5">
                                        <div className="space-y-4">
                                            <div>
                                                <p className="eyebrow">Selected day</p>
                                                <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                                                    {format(selectedDate, "EEEE, MMM d")}
                                                </h3>
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    {dayTasks.length} due task{dayTasks.length === 1 ? "" : "s"} and{" "}
                                                    {dayBlocks.length} planned block{dayBlocks.length === 1 ? "" : "s"}.
                                                </p>
                                            </div>

                                            <div className="surface-muted flex items-center justify-between px-4 py-3 text-sm">
                                                <span className="text-muted-foreground">Today focus</span>
                                                <span className="font-mono font-semibold text-foreground">
                                                    {todayFocusMinutes}m / {dailyGoal}m
                                                </span>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="eyebrow">Due tasks</p>
                                                    <Button variant="ghost" size="xs" onClick={() => openBlockDialog()}>
                                                        <Plus className="h-3.5 w-3.5" />
                                                        New
                                                    </Button>
                                                </div>
                                                {dayTasks.length > 0 ? dayTasks.map((task) => (
                                                    <div key={task.id} className="rounded-lg border border-border bg-background/70 px-3 py-3 text-sm">
                                                        {task.title}
                                                    </div>
                                                )) : (
                                                    <div className="surface-muted px-4 py-6 text-sm text-muted-foreground">
                                                        No tasks due this day.
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                <p className="eyebrow">Planned blocks</p>
                                                {dayBlocks.length > 0 ? dayBlocks.map((block) => (
                                                    <button
                                                        key={block.id}
                                                        type="button"
                                                        onClick={() => editBlock(block)}
                                                        className="w-full rounded-lg border border-primary/20 bg-primary/10 px-3 py-3 text-left text-sm text-primary transition-colors hover:bg-primary/14"
                                                    >
                                                        <div className="font-semibold">{block.title}</div>
                                                        <div className="mt-1 text-xs uppercase tracking-[0.14em]">
                                                            {formatBlockTimeRange(block.scheduled_start, block.scheduled_end)}
                                                        </div>
                                                    </button>
                                                )) : (
                                                    <div className="surface-muted px-4 py-6 text-sm text-muted-foreground">
                                                        No blocks planned this day.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </SectionCard>

                {!loading && lists.length === 0 ? (
                    <EmptyState
                        title="Create a project before planning"
                        description="Create a project first."
                        icon={<CalendarDays className="h-8 w-8" />}
                    />
                ) : null}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-xl rounded-[1.75rem] border-border/60 p-0">
                    <DialogHeader className="border-b border-border/60 px-6 py-5">
                        <DialogTitle>{form.id ? "Edit focus block" : "Plan focus block"}</DialogTitle>
                        <DialogDescription>
                            Add time for a task or project.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 px-6 py-6">
                        <div className="space-y-2">
                            <Label htmlFor="blockTitle" className="eyebrow">Title</Label>
                            <Input id="blockTitle" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="blockProject" className="eyebrow">Project</Label>
                                <Select
                                    value={form.listId}
                                    onValueChange={(value) => setForm((current) => ({ ...current, listId: value }))}
                                >
                                    <SelectTrigger id="blockProject">
                                        <SelectValue placeholder="Choose a project" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {lists.map((list) => (
                                            <SelectItem key={list.id} value={list.id}>
                                                {list.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="blockTask" className="eyebrow">Linked task</Label>
                                <Select
                                    value={form.todoId ?? "none"}
                                    onValueChange={(value) => setForm((current) => ({ ...current, todoId: value === "none" ? null : value }))}
                                >
                                    <SelectTrigger id="blockTask">
                                        <SelectValue placeholder="No linked task" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No linked task</SelectItem>
                                        {tasks.filter((task) => task.list_id === form.listId && !task.is_done).map((task) => (
                                            <SelectItem key={task.id} value={task.id}>
                                                {task.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="blockDate" className="eyebrow">Date</Label>
                                <DatePickerField id="blockDate" value={form.date} onChange={(value) => setForm((current) => ({ ...current, date: value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="blockStart" className="eyebrow">Start</Label>
                                <TimeSelectField id="blockStart" value={form.startTime} onChange={(value) => setForm((current) => ({ ...current, startTime: value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="blockDuration" className="eyebrow">Duration</Label>
                                <Input id="blockDuration" type="number" min="15" step="15" value={form.durationMinutes} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
                            </div>
                        </div>

                        <div className="surface-muted flex items-center justify-between px-4 py-4 text-sm text-muted-foreground">
                            <span>Reserved time</span>
                            <span className="font-mono text-foreground">
                                {formatMinutesCompact(Number.parseInt(form.durationMinutes || "0", 10) || 0)}
                            </span>
                        </div>
                    </div>

                    <DialogFooter className="justify-between border-t border-border/60 px-6 py-5 sm:justify-between">
                        {form.id ? (
                            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void handleDeleteBlock()}>
                                Delete
                            </Button>
                        ) : <div />}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button onClick={() => void handleSaveBlock()} disabled={saving || !form.title.trim() || !form.listId}>
                                {saving ? "Saving..." : form.id ? "Save block" : "Create block"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
