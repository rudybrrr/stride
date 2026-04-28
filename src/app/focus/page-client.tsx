"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    ArrowUpRight,
    Brain,
    CalendarRange,
    CheckSquare2,
    Pause,
    Play,
    RotateCcw,
    type LucideIcon,
} from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { useData } from "~/components/data-provider";
import { MODE_CONFIG, useFocus } from "~/components/focus-provider";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useTaskDataset } from "~/hooks/use-task-dataset";
import {
    formatBlockTimeRange,
    formatMinutesCompact,
    getCurrentPlannedBlock,
    getNextPlannedBlock,
    getRemainingPlannedMinutesForDay,
} from "~/lib/planning";
import { cn } from "~/lib/utils";

const MODE_OPTIONS = ["focus", "shortBreak", "longBreak"] as const;

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function getModeLabel(mode: (typeof MODE_OPTIONS)[number]) {
    switch (mode) {
        case "focus":
            return "Focus";
        case "shortBreak":
            return "Short break";
        case "longBreak":
            return "Long break";
    }
}

function getModeHeading(mode: (typeof MODE_OPTIONS)[number]) {
    switch (mode) {
        case "focus":
            return "One quiet block at a time";
        case "shortBreak":
            return "A short reset between blocks";
        case "longBreak":
            return "A longer reset before you start again";
    }
}

function getModeDescription(mode: (typeof MODE_OPTIONS)[number], isActive: boolean) {
    switch (mode) {
        case "focus":
            return isActive
                ? "Stay with the current block and let the rest of the interface recede."
                : "Start a clean session when you are ready to work on one thing at a time.";
        case "shortBreak":
            return isActive
                ? "Take a short reset before you slide back into the next planned block."
                : "Pause briefly, then return to the next block with a clean handoff.";
        case "longBreak":
            return isActive
                ? "Step away properly so the next focus block starts with a quieter mind."
                : "Use a longer reset when you need more distance before the next session.";
    }
}

function getModeTone(mode: (typeof MODE_OPTIONS)[number]) {
    switch (mode) {
        case "focus":
            return {
                pill: "border-primary/18 bg-primary/10 text-primary",
                iconWrap: "border-primary/16 bg-primary/10 text-primary",
                status: "border-primary/18 bg-primary/10 text-primary",
            };
        case "shortBreak":
            return {
                pill: "border-[color-mix(in_oklab,var(--color-chart-3)_24%,transparent)] bg-[color-mix(in_oklab,var(--color-chart-3)_10%,transparent)] text-[color:var(--color-chart-3)]",
                iconWrap: "border-[color-mix(in_oklab,var(--color-chart-3)_22%,transparent)] bg-[color-mix(in_oklab,var(--color-chart-3)_9%,transparent)] text-[color:var(--color-chart-3)]",
                status: "border-[color-mix(in_oklab,var(--color-chart-3)_24%,transparent)] bg-[color-mix(in_oklab,var(--color-chart-3)_10%,transparent)] text-[color:var(--color-chart-3)]",
            };
        case "longBreak":
            return {
                pill: "border-[color-mix(in_oklab,var(--color-chart-2)_24%,transparent)] bg-[color-mix(in_oklab,var(--color-chart-2)_10%,transparent)] text-[color:var(--color-chart-2)]",
                iconWrap: "border-[color-mix(in_oklab,var(--color-chart-2)_22%,transparent)] bg-[color-mix(in_oklab,var(--color-chart-2)_9%,transparent)] text-[color:var(--color-chart-2)]",
                status: "border-[color-mix(in_oklab,var(--color-chart-2)_24%,transparent)] bg-[color-mix(in_oklab,var(--color-chart-2)_10%,transparent)] text-[color:var(--color-chart-2)]",
            };
    }
}

function FocusMetricTile({
    label,
    value,
    meta,
}: {
    label: string;
    value: string;
    meta?: string;
}) {
    return (
        <div className="rounded-xl border border-border/35 bg-[color:var(--surface-hover)]/45 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">{label}</p>
            <p className="mt-1.5 font-mono text-[1.2rem] font-semibold tracking-normal text-foreground">
                {value}
            </p>
            {meta ? <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground/60">{meta}</p> : null}
        </div>
    );
}

function FocusSupportStat({
    label,
    value,
    meta,
    valueClassName,
}: {
    label: string;
    value: string;
    meta?: string;
    valueClassName?: string;
}) {
    return (
        <div className="px-1.5 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">{label}</p>
            <p className={cn("mt-1.5 text-[0.95rem] font-semibold tracking-[-0.03em] text-foreground", valueClassName)}>
                {value}
            </p>
            {meta ? <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground/60">{meta}</p> : null}
        </div>
    );
}

function FocusLinkCard({
    href,
    icon: Icon,
    title,
    description,
}: {
    href: string;
    icon: LucideIcon;
    title: string;
    description: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-[color:var(--surface-selected)]"
        >
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/45 bg-[color:var(--surface-hover)] text-muted-foreground transition-colors group-hover:text-foreground">
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-semibold tracking-[-0.03em] text-foreground sm:text-[15px]">{title}</p>
                    <p className="line-clamp-2 text-[12px] leading-5 text-muted-foreground">{description}</p>
                </div>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        </Link>
    );
}

function FocusPlannerBlockCard({
    label,
    emptyLabel,
    projectName,
    taskTitle,
    timeLabel,
}: {
    label: string;
    emptyLabel: string;
    projectName?: string | null;
    taskTitle?: string | null;
    timeLabel?: string | null;
}) {
    return (
        <div className="flex items-start justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0 space-y-1">
                <p className="eyebrow">{label}</p>
                <p className={cn("truncate text-sm font-semibold tracking-[-0.03em] text-foreground", !taskTitle && "text-muted-foreground")}>
                    {taskTitle ?? emptyLabel}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                    {[projectName, timeLabel].filter(Boolean).join(" / ") || "No block in scope"}
                </p>
            </div>
            <div className="shrink-0 text-right">
                <p className="text-xs font-medium text-foreground/80">{timeLabel ?? "--"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{projectName ?? "General"}</p>
            </div>
        </div>
    );
}

function FocusScopeCard({
    selectedProjectId,
    selectedProjectName,
    orderedProjectSummaries,
    setCurrentListId,
    setCurrentTaskId,
    setCurrentBlockId,
}: {
    selectedProjectId: string | null;
    selectedProjectName: string | null;
    orderedProjectSummaries: ReturnType<typeof useTaskDataset>["orderedProjectSummaries"];
    setCurrentListId: (value: string | null) => void;
    setCurrentTaskId: (value: string | null) => void;
    setCurrentBlockId: (value: string | null) => void;
}) {
    return (
        <section className="surface-muted rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <p className="eyebrow">Session scope</p>
                    <p className="text-sm font-semibold tracking-[-0.03em] text-foreground">
                        {selectedProjectName ?? "General"}
                    </p>
                    <p className="text-[12px] leading-5 text-muted-foreground">
                        {selectedProjectId
                            ? "Keep the timer and planner context inside one project."
                            : "Leave focus open across every project and task."}
                    </p>
                </div>
                <span className="rounded-full border border-border/45 bg-[color:var(--surface-hover)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {selectedProjectId ? "Scoped" : "General"}
                </span>
            </div>

            <div className="mt-3">
                <Select
                    value={selectedProjectId ?? "general"}
                    onValueChange={(value) => {
                        setCurrentListId(value === "general" ? null : value);
                        setCurrentTaskId(null);
                        setCurrentBlockId(null);
                    }}
                >
                    <SelectTrigger className="h-10 rounded-xl border-border/50 bg-[color:var(--surface-hover)] px-3 text-[13px] shadow-none transition-colors hover:bg-[color:var(--surface-selected)]">
                        <SelectValue placeholder="General" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        {orderedProjectSummaries.map((summary) => (
                            <SelectItem key={summary.list.id} value={summary.list.id}>
                                {summary.list.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </section>
    );
}

export default function FocusClient() {
    return (
        <AppShell>
            <FocusPageContent />
        </AppShell>
    );
}

function FocusPageContent() {
    const { profile, stats, loading: dataLoading } = useData();
    const { lists, plannedBlocks, tasks, todayFocusMinutes, orderedProjectSummaries, loading: datasetLoading } = useTaskDataset();
    const [now, setNow] = useState(() => new Date());
    const {
        mode,
        timeLeft,
        isActive,
        toggleTimer,
        resetTimer,
        handleModeChange,
        currentListId,
        setCurrentListId,
        currentTaskId,
        setCurrentTaskId,
        currentBlockId,
        setCurrentBlockId,
    } = useFocus();

    const isFocusDataLoading = dataLoading || datasetLoading;
    const config = MODE_CONFIG[mode];
    const tone = getModeTone(mode);
    const dailyGoal = profile?.daily_focus_goal_minutes ?? 120;
    const focusProgress = clamp((todayFocusMinutes / Math.max(dailyGoal, 1)) * 100, 0, 100);
    const remainingMinutes = Math.max(dailyGoal - todayFocusMinutes, 0);
    const sessionMinutes = mode === "focus" && timeLeft < config.duration ? Math.ceil((config.duration - timeLeft) / 60) : 0;
    const sessionProgress = clamp(((config.duration - timeLeft) / Math.max(config.duration, 1)) * 100, 0, 100);
    const selectedProjectId = orderedProjectSummaries.some((summary) => summary.list.id === currentListId) ? currentListId : null;
    const selectedProjectName = orderedProjectSummaries.find((summary) => summary.list.id === selectedProjectId)?.list.name ?? null;
    const listMap = useMemo(() => new Map(lists.map((list) => [list.id, list])), [lists]);
    const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
    const scopedBlocks = useMemo(
        () => selectedProjectId ? plannedBlocks.filter((block) => block.list_id === selectedProjectId) : plannedBlocks,
        [plannedBlocks, selectedProjectId],
    );
    const focusContextBlock = useMemo(
        () => currentBlockId ? plannedBlocks.find((block) => block.id === currentBlockId) ?? null : null,
        [currentBlockId, plannedBlocks],
    );
    const currentPlannedBlock = useMemo(
        () => getCurrentPlannedBlock(scopedBlocks, now),
        [now, scopedBlocks],
    );
    const nextDetectedBlock = useMemo(
        () => getNextPlannedBlock(scopedBlocks, now),
        [now, scopedBlocks],
    );
    const nextPlannedBlock = useMemo(() => {
        if (
            focusContextBlock
            && focusContextBlock.id !== currentPlannedBlock?.id
            && new Date(focusContextBlock.scheduled_start).getTime() > now.getTime()
        ) {
            return focusContextBlock;
        }

        return nextDetectedBlock;
    }, [currentPlannedBlock?.id, focusContextBlock, nextDetectedBlock, now]);
    const focusContextTask = useMemo(
        () => currentTaskId ? taskMap.get(currentTaskId) ?? null : null,
        [currentTaskId, taskMap],
    );
    const plannerTask = useMemo(() => {
        if (currentPlannedBlock?.todo_id) {
            return taskMap.get(currentPlannedBlock.todo_id) ?? null;
        }

        if (nextPlannedBlock?.todo_id) {
            return taskMap.get(nextPlannedBlock.todo_id) ?? null;
        }

        return focusContextTask;
    }, [currentPlannedBlock?.todo_id, focusContextTask, nextPlannedBlock?.todo_id, taskMap]);
    const remainingPlannedMinutes = useMemo(
        () => getRemainingPlannedMinutesForDay(scopedBlocks, now),
        [now, scopedBlocks],
    );
    const plannerAnchorBlock = currentPlannedBlock ?? nextPlannedBlock ?? focusContextBlock;
    const plannerHref = useMemo(() => {
        const params = new URLSearchParams();

        if (selectedProjectId) {
            params.set("listId", selectedProjectId);
        }

        if (plannerAnchorBlock) {
            params.set("blockId", plannerAnchorBlock.id);
            params.set("view", "day");
        } else if (plannerTask) {
            params.set("taskId", plannerTask.id);
            params.set("view", "day");
        }

        const query = params.toString();
        return query ? `/calendar?${query}` : "/calendar";
    }, [plannerAnchorBlock, plannerTask, selectedProjectId]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setNow(new Date());
        }, 60_000);

        return () => {
            window.clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        if (!currentTaskId) return;
        if (taskMap.has(currentTaskId)) return;
        setCurrentTaskId(null);
    }, [currentTaskId, setCurrentTaskId, taskMap]);

    useEffect(() => {
        if (!currentBlockId) return;
        if (plannedBlocks.some((block) => block.id === currentBlockId)) return;
        setCurrentBlockId(null);
    }, [currentBlockId, plannedBlocks, setCurrentBlockId]);

    return (
        <div className="page-container gap-5">
            <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
                <header className="flex flex-col gap-3 border-b border-border/35 pb-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        <h1 className="view-heading">Focus</h1>
                        <p className="max-w-[38rem] text-sm leading-6 text-muted-foreground">
                            A quieter timer surface for the current block, next handoff, and today&apos;s focus goal.
                        </p>
                    </div>
                    <div className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]", tone.status)}>
                        <Brain className="h-3.5 w-3.5" />
                        {isActive ? "Running" : mode === "focus" ? "Ready" : "Paused"}
                    </div>
                </header>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,22rem)]">
                    <section className="surface-card overflow-hidden rounded-xl border border-border/35">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/35 px-4 py-3 sm:px-5">
                            <div className="inline-flex rounded-xl bg-[color:var(--surface-hover)] p-1">
                                {MODE_OPTIONS.map((nextMode) => {
                                    const active = mode === nextMode;
                                    return (
                                        <button
                                            key={nextMode}
                                            type="button"
                                            onClick={() => handleModeChange(nextMode)}
                                            className={cn(
                                                "inline-flex h-8 items-center rounded-lg border px-3 text-[11.5px] font-semibold uppercase tracking-[0.12em] transition-colors",
                                                active
                                                    ? `${tone.pill} shadow-[var(--shadow-xs)]`
                                                    : "border-transparent bg-transparent text-muted-foreground hover:bg-[color:var(--surface-selected)] hover:text-foreground",
                                            )}
                                        >
                                            {getModeLabel(nextMode)}
                                        </button>
                                    );
                                })}
                            </div>

                            <span className="rounded-full border border-border/45 bg-[color:var(--surface-hover)] px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                {selectedProjectName ?? "General scope"}
                            </span>
                        </div>

                        <div className="px-4 py-6 sm:px-6 sm:py-8">
                            <div className="mx-auto flex max-w-[38rem] flex-col items-center text-center">
                                <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl border", tone.iconWrap)}>
                                    <config.icon className="h-6 w-6" />
                                </div>

                                <p className="mt-5 eyebrow">Session timer</p>
                                <h2 className="mt-2 text-balance text-[1.65rem] font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-[2rem]">
                                    {getModeHeading(mode)}
                                </h2>
                                <p className="mt-2 max-w-[31rem] text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
                                    {getModeDescription(mode, isActive)}
                                </p>

                                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                                    <span className="rounded-full border border-border/45 bg-[color:var(--surface-hover)] px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                        {config.label}
                                    </span>
                                    <span className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", tone.status)}>
                                        {isActive ? "In session" : "Ready to start"}
                                    </span>
                                </div>

                                <p className="mt-6 font-mono text-[clamp(4.4rem,10vw,8rem)] leading-none font-light tracking-normal tabular-nums text-foreground">
                                    {formatTime(timeLeft)}
                                </p>

                                <div className="mt-5 h-2 w-full max-w-[26rem] overflow-hidden rounded-full bg-[color:var(--surface-hover)]">
                                    <div
                                        className="h-full rounded-full bg-primary transition-[width]"
                                        style={{ width: `${sessionProgress}%` }}
                                    />
                                </div>

                                <div className="mt-4 rounded-full border border-border/45 bg-[color:var(--surface-hover)] px-4 py-2 text-sm leading-6 text-muted-foreground">
                                    {selectedProjectId
                                        ? `Scoped to ${selectedProjectName}`
                                        : "Open focus session across all projects"}
                                </div>

                                <div className="mt-6 flex w-full max-w-[31rem] flex-col gap-2.5 sm:flex-row">
                                    <Button size="lg" className="w-full rounded-xl shadow-none sm:min-w-[12rem] sm:flex-1" onClick={toggleTimer}>
                                        {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                        {isActive ? "Pause" : mode === "focus" ? "Start focus" : "Start break"}
                                    </Button>
                                    <Button size="lg" variant="outline" className="w-full rounded-xl border-border/50 bg-[color:var(--surface-hover)] shadow-none hover:bg-[color:var(--surface-selected)] sm:min-w-[9.5rem] sm:flex-1" onClick={resetTimer}>
                                        <RotateCcw className="h-4 w-4" />
                                        Reset
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
                                <FocusMetricTile
                                    label="Session"
                                    value={sessionMinutes > 0 ? `${sessionMinutes}m` : "0m"}
                                    meta="Elapsed this cycle"
                                />
                                <FocusMetricTile
                                    label="Typical"
                                    value={isFocusDataLoading ? "--" : (stats?.avgSession ?? "0m")}
                                    meta="Average focus block"
                                />
                                <FocusMetricTile
                                    label="Streak"
                                    value={isFocusDataLoading ? "--" : `${stats?.streak ?? 0}d`}
                                    meta={isFocusDataLoading ? "Loading" : "Consecutive days"}
                                />
                            </div>
                        </div>
                    </section>

                    <aside className="flex flex-col gap-4">
                        <FocusScopeCard
                            selectedProjectId={selectedProjectId}
                            selectedProjectName={selectedProjectName}
                            orderedProjectSummaries={orderedProjectSummaries}
                            setCurrentListId={setCurrentListId}
                            setCurrentTaskId={setCurrentTaskId}
                            setCurrentBlockId={setCurrentBlockId}
                        />

                        <section className="surface-card overflow-hidden rounded-xl border border-border/35">
                            <div className="flex items-start justify-between gap-3 border-b border-border/35 px-4 py-3.5">
                                <div className="space-y-1">
                                    <p className="eyebrow">Planner context</p>
                                    <p className="text-sm font-semibold tracking-[-0.03em] text-foreground">
                                        {currentPlannedBlock
                                            ? "Run the current block"
                                            : nextPlannedBlock
                                                ? "Next block is queued"
                                                : "No scheduled block in scope"}
                                    </p>
                                    <p className="text-[12px] leading-5 text-muted-foreground">
                                        Keep the active block and the next handoff visible without leaving focus mode.
                                    </p>
                                </div>
                                <Button asChild variant="outline" size="xs" className="rounded-full border-border/50 bg-[color:var(--surface-hover)] shadow-none hover:bg-[color:var(--surface-selected)]">
                                    <Link href={plannerHref}>
                                        <CalendarRange className="h-3.5 w-3.5" />
                                        Open calendar
                                    </Link>
                                </Button>
                            </div>

                            <div className="divide-y divide-border/35">
                                <FocusPlannerBlockCard
                                    label="Current block"
                                    emptyLabel="Nothing running now"
                                    projectName={currentPlannedBlock ? (listMap.get(currentPlannedBlock.list_id)?.name ?? "Project") : null}
                                    taskTitle={currentPlannedBlock?.todo_id ? (taskMap.get(currentPlannedBlock.todo_id)?.title ?? currentPlannedBlock.title) : currentPlannedBlock?.title}
                                    timeLabel={currentPlannedBlock ? formatBlockTimeRange(currentPlannedBlock.scheduled_start, currentPlannedBlock.scheduled_end) : null}
                                />
                                <FocusPlannerBlockCard
                                    label="Next block"
                                    emptyLabel="Nothing else planned today"
                                    projectName={nextPlannedBlock ? (listMap.get(nextPlannedBlock.list_id)?.name ?? "Project") : null}
                                    taskTitle={nextPlannedBlock?.todo_id ? (taskMap.get(nextPlannedBlock.todo_id)?.title ?? nextPlannedBlock.title) : nextPlannedBlock?.title}
                                    timeLabel={nextPlannedBlock ? formatBlockTimeRange(nextPlannedBlock.scheduled_start, nextPlannedBlock.scheduled_end) : null}
                                />
                            </div>

                            <div className="grid gap-2 border-t border-border/35 p-4 sm:grid-cols-2 xl:grid-cols-1">
                                <FocusSupportStat
                                    label="Planned left"
                                    value={formatMinutesCompact(remainingPlannedMinutes)}
                                    meta={remainingPlannedMinutes > 0 ? "Still scheduled today" : "Nothing else scheduled today"}
                                />
                                <FocusSupportStat
                                    label="Task context"
                                    value={plannerTask?.title ?? "General focus"}
                                    meta={selectedProjectName ?? "Project context"}
                                    valueClassName="line-clamp-2 leading-5"
                                />
                            </div>
                        </section>

                        <section className="surface-muted rounded-xl p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="eyebrow">Daily goal</p>
                                    <p className="text-sm font-semibold tracking-[-0.03em] text-foreground">
                                        {isFocusDataLoading
                                            ? "Loading focus data"
                                            : `${todayFocusMinutes}m / ${dailyGoal}m today`}
                                    </p>
                                    <p className="text-[12px] leading-5 text-muted-foreground">
                                        Keep the goal visible, but secondary to the active timer.
                                    </p>
                                </div>
                                <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium", tone.status)}>
                                    <Brain className="h-3.5 w-3.5" />
                                    {isFocusDataLoading ? "--" : (stats?.streak ?? 0)} day streak
                                </div>
                            </div>

                            <div className="mt-3 space-y-2">
                                <div className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-hover)]">
                                    <div
                                        className="h-full rounded-full bg-primary transition-[width]"
                                        style={{ width: `${focusProgress}%` }}
                                    />
                                </div>
                                <p className="text-sm leading-6 text-muted-foreground">
                                    {isFocusDataLoading
                                        ? "Syncing goal and session totals"
                                        : remainingMinutes > 0
                                            ? `${remainingMinutes} minutes left to goal`
                                            : "Daily focus goal reached"}
                                </p>
                            </div>

                            <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                                <FocusSupportStat
                                    label="Today"
                                    value={isFocusDataLoading ? "--" : `${todayFocusMinutes}m`}
                                    meta="Logged so far"
                                />
                                <FocusSupportStat
                                    label="Remaining"
                                    value={isFocusDataLoading ? "--" : `${remainingMinutes}m`}
                                    meta="Before goal"
                                />
                                <FocusSupportStat
                                    label="Goal"
                                    value={isFocusDataLoading ? "--" : `${Math.round(focusProgress)}%`}
                                    meta="Progress to target"
                                />
                            </div>
                        </section>

                        <section className="surface-muted rounded-xl p-2">
                            <div className="px-2 py-1.5">
                                <p className="eyebrow">Related routes</p>
                            </div>
                            <div className="space-y-1">
                                <FocusLinkCard
                                    href="/tasks"
                                    icon={CheckSquare2}
                                    title="Today"
                                    description="Return to the tasks due now."
                                />

                                <FocusLinkCard
                                    href={plannerHref}
                                    icon={CalendarRange}
                                    title="Calendar"
                                    description={currentPlannedBlock || nextPlannedBlock ? "Open the active planning context." : "Plan the next focus block."}
                                />
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    );
}
