import type { PlanningStatus } from "~/lib/types";

export const DAY_OVERVIEW_TASK_LIMIT = 18;
export const DAY_OVERVIEW_PLANNED_BLOCK_LIMIT = 8;
export const DAY_OVERVIEW_LABEL_LIMIT = 6;
export const DAY_OVERVIEW_MAX_REQUEST_CHARS = 18_000;
export const DAY_OVERVIEW_MAX_SUMMARY_CHARS = 900;

export type DayOverviewTaskTiming = "overdue" | "due_today";

export interface DayOverviewTask {
    description?: string | null;
    dueLabel?: string | null;
    estimatedMinutes?: number | null;
    labels?: string[];
    plannedMinutes?: number;
    planningStatus?: PlanningStatus;
    priority?: "high" | "medium" | "low" | null;
    projectName?: string | null;
    remainingEstimatedMinutes?: number | null;
    timing: DayOverviewTaskTiming;
    title: string;
}

export interface DayOverviewPlannedBlock {
    durationMinutes: number;
    projectName?: string | null;
    taskTitle?: string | null;
    timeRange: string;
    title: string;
}

export interface DayOverviewPayload {
    counts: {
        dueToday: number;
        overdue: number;
        totalVisible: number;
    };
    focus: {
        averageSession?: string | null;
        dailyGoalMinutes: number;
        streak: number;
        todayMinutes: number;
    };
    plannedBlocks: DayOverviewPlannedBlock[];
    tasks: DayOverviewTask[];
    timezone?: string | null;
    todayDate: string;
}

function cleanText(value: string | null | undefined, maxLength: number) {
    if (typeof value !== "string") return null;

    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) return null;

    return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trimEnd() : cleaned;
}

function cleanRequiredText(value: string | null | undefined, fallback: string, maxLength: number) {
    return cleanText(value, maxLength) ?? fallback;
}

function normalizeInteger(value: number | null | undefined, max = 999) {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return Math.min(Math.max(Math.round(value), 0), max);
}

function normalizeOptionalMinutes(value: number | null | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return normalizeInteger(value, 24 * 60);
}

function normalizePlanningStatus(value: PlanningStatus | undefined) {
    return value === "partially_planned"
        || value === "fully_planned"
        || value === "overplanned"
        || value === "unplanned"
        ? value
        : "unplanned";
}

function formatPlanningStatus(value: PlanningStatus) {
    return value.replace("_", " ");
}

function normalizeLabels(labels: string[] | undefined) {
    const cleanedLabels = (labels ?? []).flatMap((label) => {
        const cleaned = cleanText(label, 36);
        return cleaned ? [cleaned] : [];
    });

    return Array.from(new Set(cleanedLabels)).slice(0, DAY_OVERVIEW_LABEL_LIMIT);
}

export function normalizeDayOverviewPayload(input: DayOverviewPayload): DayOverviewPayload {
    return {
        todayDate: cleanRequiredText(input.todayDate, new Date().toISOString().slice(0, 10), 20),
        timezone: cleanText(input.timezone, 64),
        counts: {
            overdue: normalizeInteger(input.counts.overdue),
            dueToday: normalizeInteger(input.counts.dueToday),
            totalVisible: normalizeInteger(input.counts.totalVisible),
        },
        focus: {
            todayMinutes: normalizeInteger(input.focus.todayMinutes, 24 * 60),
            dailyGoalMinutes: normalizeInteger(input.focus.dailyGoalMinutes, 24 * 60),
            streak: normalizeInteger(input.focus.streak, 3650),
            averageSession: cleanText(input.focus.averageSession, 32),
        },
        tasks: input.tasks
            .flatMap((task) => {
                const title = cleanText(task.title, 140);
                if (!title) return [];

                return [{
                    title,
                    timing: task.timing === "overdue" ? "overdue" : "due_today",
                    description: cleanText(task.description, 320),
                    projectName: cleanText(task.projectName, 90),
                    priority: task.priority === "high" || task.priority === "medium" || task.priority === "low" ? task.priority : null,
                    dueLabel: cleanText(task.dueLabel, 60),
                    labels: normalizeLabels(task.labels),
                    estimatedMinutes: normalizeOptionalMinutes(task.estimatedMinutes),
                    plannedMinutes: normalizeInteger(task.plannedMinutes, 24 * 60),
                    remainingEstimatedMinutes: normalizeOptionalMinutes(task.remainingEstimatedMinutes),
                    planningStatus: normalizePlanningStatus(task.planningStatus),
                } satisfies DayOverviewTask];
            })
            .slice(0, DAY_OVERVIEW_TASK_LIMIT),
        plannedBlocks: input.plannedBlocks
            .flatMap((block) => {
                const title = cleanText(block.title, 120);
                const taskTitle = cleanText(block.taskTitle, 140);
                if (!title && !taskTitle) return [];

                return [{
                    title: title ?? taskTitle ?? "Planned block",
                    projectName: cleanText(block.projectName, 90),
                    taskTitle,
                    timeRange: cleanRequiredText(block.timeRange, "Scheduled today", 80),
                    durationMinutes: normalizeInteger(block.durationMinutes, 24 * 60),
                } satisfies DayOverviewPlannedBlock];
            })
            .slice(0, DAY_OVERVIEW_PLANNED_BLOCK_LIMIT),
    };
}

export function getDayOverviewPayloadSignature(input: DayOverviewPayload) {
    return JSON.stringify(normalizeDayOverviewPayload(input));
}

function formatTaskForPrompt(task: DayOverviewTask, index: number) {
    const details = [
        task.timing === "overdue" ? "overdue" : "due today",
        task.projectName ? `project: ${task.projectName}` : null,
        task.priority ? `priority: ${task.priority}` : null,
        task.dueLabel ? `due: ${task.dueLabel}` : null,
        task.description ? `description: ${task.description}` : null,
        `planning: ${formatPlanningStatus(task.planningStatus ?? "unplanned")}`,
        task.estimatedMinutes ? `estimate: ${task.estimatedMinutes}m` : null,
        task.plannedMinutes ? `planned: ${task.plannedMinutes}m` : null,
        task.remainingEstimatedMinutes != null ? `remaining estimate: ${task.remainingEstimatedMinutes}m` : null,
        task.labels && task.labels.length > 0 ? `labels: ${task.labels.join(", ")}` : null,
    ].filter(Boolean);

    return `${index + 1}. ${task.title}${details.length > 0 ? ` (${details.join("; ")})` : ""}`;
}

function formatBlockForPrompt(block: DayOverviewPlannedBlock, index: number) {
    const details = [
        block.projectName ? `project: ${block.projectName}` : null,
        block.taskTitle ? `task: ${block.taskTitle}` : null,
        block.timeRange,
        `${block.durationMinutes}m`,
    ].filter(Boolean);

    return `${index + 1}. ${block.title}${details.length > 0 ? ` (${details.join("; ")})` : ""}`;
}

export function buildDayOverviewPrompt(input: DayOverviewPayload) {
    const payload = normalizeDayOverviewPayload(input);
    const taskLines = payload.tasks.length > 0
        ? payload.tasks.map(formatTaskForPrompt).join("\n")
        : "No visible Today tasks after the current filters.";
    const blockLines = payload.plannedBlocks.length > 0
        ? payload.plannedBlocks.map(formatBlockForPrompt).join("\n")
        : "No planned focus blocks for today in this scope.";
    const focusGoal = payload.focus.dailyGoalMinutes > 0
        ? `${payload.focus.todayMinutes}/${payload.focus.dailyGoalMinutes} minutes`
        : `${payload.focus.todayMinutes} minutes`;

    return [
        "You write the AI Day Overview for Stride, a task and focus planning app.",
        "Write a concise, personal overview for the user using only the data below.",
        "Requirements:",
        "- Use 2 short paragraphs or 3 tight bullets, under 90 words total.",
        "- Reference actual task or project names when they are clearly important.",
        "- Treat task descriptions as user notes; if they mention deadlines, urgency, or constraints, factor that into the overview without inventing details.",
        "- Prioritize what needs attention first, then the next concrete action.",
        "- Avoid generic motivation, quotes, emojis, markdown headings, and invented details.",
        "- If data is light, say what is clear and suggest one practical next step.",
        "",
        `Date: ${payload.todayDate}`,
        `Timezone: ${payload.timezone ?? "not provided"}`,
        `Visible Today counts: ${payload.counts.overdue} overdue, ${payload.counts.dueToday} due today, ${payload.counts.totalVisible} visible total`,
        `Focus: ${focusGoal} today, ${payload.focus.streak} day streak, average session ${payload.focus.averageSession ?? "not available"}`,
        "",
        "Today tasks:",
        taskLines,
        "",
        "Planned blocks:",
        blockLines,
    ].join("\n");
}

export function sanitizeDayOverviewSummary(value: unknown) {
    if (typeof value !== "string") return "";

    const cleaned = value
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (cleaned.length <= DAY_OVERVIEW_MAX_SUMMARY_CHARS) {
        return cleaned;
    }

    return `${cleaned.slice(0, DAY_OVERVIEW_MAX_SUMMARY_CHARS - 3).trimEnd()}...`;
}
