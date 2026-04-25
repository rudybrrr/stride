"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, Clock3, FolderKanban, Plus, Rows3, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "~/components/app-shell";
import { EmptyState } from "~/components/app-primitives";
import { ProjectDialog } from "~/components/project-dialog";
import { Button } from "~/components/ui/button";
import { useTaskDataset } from "~/hooks/use-task-dataset";
import { formatProjectScheduledLabel, getProjectScheduledBlockState } from "~/lib/project-summaries";
import { getProjectColorClasses, getProjectIcon } from "~/lib/project-appearance";
import { getInboxListId } from "~/lib/things-views";
import type { TodoList } from "~/lib/types";
import { cn } from "~/lib/utils";

export default function ProjectsClient() {
    return (
        <AppShell>
            <ProjectsContent />
        </AppShell>
    );
}

function ProjectsContent() {
    const { lists, orderedProjectSummaries, loading } = useTaskDataset();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<TodoList | null>(null);
    const inboxListId = useMemo(() => getInboxListId(lists), [lists]);
    const visibleProjectSummaries = useMemo(
        () => orderedProjectSummaries.filter((summary) => summary.list.id !== inboxListId),
        [inboxListId, orderedProjectSummaries],
    );

    const projectCounts = useMemo(() => {
        const activeProjects = visibleProjectSummaries.filter((s) => s.incompleteCount > 0).length;
        const urgentProjects = visibleProjectSummaries.filter((s) => s.overdueCount > 0 || s.dueSoonCount > 0).length;
        const scheduledProjects = visibleProjectSummaries.filter((s) => s.nextScheduledBlock).length;
        return { totalProjects: visibleProjectSummaries.length, activeProjects, urgentProjects, scheduledProjects };
    }, [visibleProjectSummaries]);

    const overviewTitle = projectCounts.totalProjects === 0
        ? "Create the first workspace when you're ready."
        : projectCounts.urgentProjects > 0
            ? `${projectCounts.urgentProjects} project${projectCounts.urgentProjects === 1 ? "" : "s"} need${projectCounts.urgentProjects === 1 ? "s" : ""} attention.`
            : `${projectCounts.activeProjects} active project${projectCounts.activeProjects === 1 ? "" : "s"} moving steadily.`;

    const overviewDescription = projectCounts.totalProjects === 0
        ? "Projects help you group work by class, objective, or shared workspace. Everything stays in one place."
        : `${projectCounts.scheduledProjects} ${projectCounts.scheduledProjects === 1 ? "has" : "have"} time on the planner — ${projectCounts.totalProjects - projectCounts.scheduledProjects} still ${projectCounts.totalProjects - projectCounts.scheduledProjects === 1 ? "relies" : "rely"} on ad hoc coverage.`;

    return (
        <div className="page-container space-y-5">
            <header className="flex items-end justify-between gap-4">
                <h1 className="section-heading">Projects</h1>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    New project
                </Button>
            </header>

            {/* Overview */}
            <section className="surface-card overflow-hidden">
                <div className="px-5 py-6 sm:px-6">
                    <div className="max-w-2xl space-y-1.5">
                        <h2 className="text-[1.2rem] font-semibold leading-tight tracking-[-0.04em] text-foreground sm:text-[1.3rem]">
                            {overviewTitle}
                        </h2>
                        <p className="text-[0.9rem] leading-6 text-muted-foreground">
                            {overviewDescription}
                        </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        <ProjectsOverviewMetric
                            label="Total"
                            value={`${projectCounts.totalProjects}`}
                            meta="Workspaces tracked"
                        />
                        <ProjectsOverviewMetric
                            label="Active"
                            value={`${projectCounts.activeProjects}`}
                            meta="With open tasks"
                        />
                        <ProjectsOverviewMetric
                            label="Urgent"
                            value={`${projectCounts.urgentProjects}`}
                            meta="Overdue or due soon"
                            danger={projectCounts.urgentProjects > 0}
                        />
                        <ProjectsOverviewMetric
                            label="Scheduled"
                            value={`${projectCounts.scheduledProjects}`}
                            meta="On the planner"
                        />
                    </div>
                </div>
            </section>

            {/* Project catalog */}
            {loading ? (
                <div className="surface-muted rounded-xl px-4 py-4 text-sm text-muted-foreground">
                    Loading projects...
                </div>
            ) : visibleProjectSummaries.length > 0 ? (
                <section className="surface-card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
                        <h2 className="text-[0.9rem] font-medium tracking-[-0.01em] text-foreground/75">
                            {visibleProjectSummaries.length} project{visibleProjectSummaries.length === 1 ? "" : "s"}
                        </h2>
                    </div>
                    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                        {visibleProjectSummaries.map((summary) => (
                            <ProjectCard
                                key={summary.list.id}
                                summary={summary}
                                onManage={() => setEditingProject(summary.list)}
                            />
                        ))}
                    </div>
                </section>
            ) : (
                <EmptyState
                    title="No projects yet"
                    description="Create a project to start organizing work into focused workspaces."
                    icon={<FolderKanban className="h-8 w-8" />}
                    action={(
                        <Button size="sm" onClick={() => setDialogOpen(true)}>
                            <Plus className="h-4 w-4" />
                            New project
                        </Button>
                    )}
                />
            )}

            <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
            {editingProject ? (
                <ProjectDialog
                    open={!!editingProject}
                    onOpenChange={(open) => { if (!open) setEditingProject(null); }}
                    initialProject={editingProject}
                    onRemoved={() => setEditingProject(null)}
                />
            ) : null}
        </div>
    );
}

function ProjectCard({
    summary,
    onManage,
}: {
    summary: {
        list: TodoList;
        incompleteCount: number;
        overdueCount: number;
        dueSoonCount: number;
        memberCount: number;
        unplannedCount: number;
        partiallyPlannedCount: number;
        nextScheduledBlock: Parameters<typeof formatProjectScheduledLabel>[0];
    };
    onManage: () => void;
}) {
    const palette = getProjectColorClasses(summary.list.color_token);
    const Icon = getProjectIcon(summary.list.icon_token);
    const needsCoverageCount = summary.unplannedCount + summary.partiallyPlannedCount;
    const scheduledLabel = formatProjectScheduledLabel(summary.nextScheduledBlock);
    const scheduledState = getProjectScheduledBlockState(summary.nextScheduledBlock);
    const isUrgent = summary.overdueCount > 0 || summary.dueSoonCount > 0;

    const metaParts = [
        summary.incompleteCount === 0
            ? "No open tasks"
            : `${summary.incompleteCount} open ${summary.incompleteCount === 1 ? "task" : "tasks"}`,
    ];
    if (summary.memberCount > 1) metaParts.push(`${summary.memberCount} members`);

    return (
        <div className="group relative flex flex-col overflow-hidden rounded-[1.2rem] border border-border/40 bg-background/55 transition-all duration-150 hover:border-border/60 hover:shadow-[var(--shadow-xs)]">
            {/* Color accent strip */}
            <div className={cn("h-[3px] w-full", palette.accent)} />

            {/* Manage button */}
            <button
                type="button"
                onClick={onManage}
                title={`Manage ${summary.list.name}`}
                aria-label={`Manage ${summary.list.name}`}
                className="absolute right-3 top-4 rounded-lg p-1.5 text-muted-foreground/0 transition-all duration-150 hover:bg-muted/80 hover:text-foreground group-hover:text-muted-foreground/50"
            >
                <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>

            <Link
                href={`/projects/${summary.list.id}`}
                className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1"
            >
                {/* Header */}
                <div className="flex items-start gap-2.5 pr-7">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", palette.soft, palette.border)}>
                        <Icon className={cn("h-3.5 w-3.5", palette.text)} />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                        <h3 className="truncate text-[0.92rem] font-semibold tracking-[-0.025em] text-foreground">
                            {summary.list.name}
                        </h3>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground/55">
                            {metaParts.join(" · ")}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-end justify-between gap-3">
                    {/* Status chips */}
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                        {summary.overdueCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/18 bg-destructive/7 px-2 py-0.5 text-[10px] font-medium text-destructive">
                                <AlertTriangle className="h-3 w-3" />
                                {summary.overdueCount} overdue
                            </span>
                        ) : null}
                        {needsCoverageCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/18 bg-amber-500/7 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                <Rows3 className="h-3 w-3" />
                                {needsCoverageCount} to plan
                            </span>
                        ) : null}
                        {scheduledLabel ? (
                            <span className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                scheduledState === "current"
                                    ? "border-emerald-500/18 bg-emerald-500/7 text-emerald-700 dark:text-emerald-300"
                                    : "border-border/60 bg-muted/40 text-muted-foreground",
                            )}>
                                <Clock3 className="h-3 w-3" />
                                {scheduledState === "current" ? "In progress" : scheduledLabel}
                            </span>
                        ) : null}
                        {!summary.overdueCount && !needsCoverageCount && !scheduledLabel ? (
                            <span className="text-[11px] text-muted-foreground/35">No alerts</span>
                        ) : null}
                    </div>

                    {/* Task count + arrow */}
                    <div className="flex shrink-0 items-center gap-1.5">
                        <div className="text-right">
                            <p className={cn(
                                "font-mono text-[1.55rem] font-semibold leading-none tracking-[-0.05em]",
                                isUrgent ? "text-destructive/80" : "text-foreground/70",
                            )}>
                                {summary.incompleteCount}
                            </p>
                            <p className="mt-0.5 text-[9.5px] text-muted-foreground/35">open</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/25 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground/50" />
                    </div>
                </div>
            </Link>
        </div>
    );
}

function ProjectsOverviewMetric({
    label,
    value,
    meta,
    danger = false,
}: {
    label: string;
    value: string;
    meta: string;
    danger?: boolean;
}) {
    return (
        <div className={cn(
            "rounded-xl px-4 py-3.5",
            danger ? "bg-destructive/6 ring-1 ring-inset ring-destructive/12" : "bg-muted/40",
        )}>
            <p className={cn("text-[10.5px]", danger ? "text-destructive/55" : "text-muted-foreground/45")}>
                {label}
            </p>
            <p className={cn(
                "mt-1 font-mono text-[1.9rem] font-semibold leading-none tracking-[-0.055em]",
                danger ? "text-destructive" : "text-foreground",
            )}>
                {value}
            </p>
            <p className={cn("mt-1.5 text-[11px] leading-4", danger ? "text-destructive/50" : "text-muted-foreground/45")}>
                {meta}
            </p>
        </div>
    );
}
