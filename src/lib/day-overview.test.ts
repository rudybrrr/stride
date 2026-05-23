import { describe, expect, test } from "vitest";

import {
    buildDayOverviewPrompt,
    DAY_OVERVIEW_LABEL_LIMIT,
    DAY_OVERVIEW_TASK_LIMIT,
    normalizeDayOverviewPayload,
    sanitizeDayOverviewSummary,
    type DayOverviewPayload,
} from "~/lib/day-overview";

function createPayload(overrides?: Partial<DayOverviewPayload>): DayOverviewPayload {
    return {
        todayDate: "2026-05-23",
        timezone: "Asia/Singapore",
        counts: {
            overdue: 1,
            dueToday: 1,
            totalVisible: 2,
        },
        focus: {
            todayMinutes: 45,
            dailyGoalMinutes: 120,
            streak: 4,
            averageSession: "25m",
        },
        tasks: [
            {
                title: "Finish chemistry lab report",
                timing: "overdue",
                description: "Hard deadline is 5 PM before lab closes.",
                projectName: "Chemistry",
                priority: "high",
                dueLabel: "Yesterday",
                labels: ["exam", "exam", " lab "],
                estimatedMinutes: 90,
                plannedMinutes: 30,
                remainingEstimatedMinutes: 60,
                planningStatus: "partially_planned",
            },
            {
                title: "Read chapter notes",
                timing: "due_today",
                projectName: "History",
                priority: "medium",
                dueLabel: "Today",
                labels: [],
                estimatedMinutes: null,
                plannedMinutes: 0,
                remainingEstimatedMinutes: null,
                planningStatus: "unplanned",
            },
        ],
        plannedBlocks: [
            {
                title: "Chemistry block",
                projectName: "Chemistry",
                taskTitle: "Finish chemistry lab report",
                timeRange: "2:00 PM - 3:00 PM",
                durationMinutes: 60,
            },
        ],
        ...overrides,
    };
}

describe("day-overview", () => {
    test("normalizes and caps the payload before prompt generation", () => {
        const payload = createPayload({
            tasks: Array.from({ length: DAY_OVERVIEW_TASK_LIMIT + 2 }, (_, index) => ({
                title: `Task ${index + 1}`,
                timing: index === 0 ? "overdue" : "due_today",
                labels: Array.from({ length: DAY_OVERVIEW_LABEL_LIMIT + 2 }, (_unused, labelIndex) => `Label ${labelIndex + 1}`),
                plannedMinutes: 10,
                planningStatus: "unplanned",
            })),
        });

        const normalized = normalizeDayOverviewPayload(payload);

        expect(normalized.tasks).toHaveLength(DAY_OVERVIEW_TASK_LIMIT);
        expect(normalized.tasks[0]?.labels).toHaveLength(DAY_OVERVIEW_LABEL_LIMIT);
        expect(normalized.tasks.at(-1)?.title).toBe(`Task ${DAY_OVERVIEW_TASK_LIMIT}`);
    });

    test("builds a prompt that includes concrete task, project, focus, and planning data", () => {
        const prompt = buildDayOverviewPrompt(createPayload());

        expect(prompt).toContain("Finish chemistry lab report");
        expect(prompt).toContain("Hard deadline is 5 PM before lab closes.");
        expect(prompt).toContain("Chemistry");
        expect(prompt).toContain("1 overdue, 1 due today, 2 visible total");
        expect(prompt).toContain("45/120 minutes");
        expect(prompt).toContain("planning: partially planned");
        expect(prompt).toContain("Chemistry block");
    });

    test("sanitizes generated summary text without preserving excessive length", () => {
        const summary = sanitizeDayOverviewSummary(`  First line.  \n\n\n${"a".repeat(950)}  `);

        expect(summary).toContain("First line.");
        expect(summary.length).toBeLessThanOrEqual(900);
        expect(summary.endsWith("...")).toBe(true);
    });
});
