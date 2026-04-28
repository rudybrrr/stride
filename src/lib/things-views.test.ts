import { describe, expect, test } from "vitest";

import { selectAnytimeView } from "~/lib/things-views";
import type { TaskRecord } from "~/lib/task-views";

function createTask(overrides?: Partial<TaskRecord>): TaskRecord {
    return {
        id: overrides?.id ?? "task-1",
        user_id: "user-1",
        list_id: overrides?.list_id ?? "project-1",
        title: overrides?.title ?? "Task",
        is_done: overrides?.is_done ?? false,
        inserted_at: overrides?.inserted_at ?? "2026-04-11T00:00:00.000Z",
        due_date: overrides?.due_date ?? null,
        deadline_on: overrides?.deadline_on ?? null,
        deadline_at: overrides?.deadline_at ?? null,
        ...overrides,
    };
}

describe("things views", () => {
    test("anytime includes all incomplete tasks with no due date", () => {
        const projectTask = createTask({ id: "project-task", list_id: "project-1" });
        const inboxTask = createTask({ id: "inbox-task", list_id: "inbox" });

        expect(selectAnytimeView([
            createTask({ id: "done-task", is_done: true }),
            createTask({ id: "dated-task", deadline_on: "2026-04-12" }),
            projectTask,
            inboxTask,
        ])).toEqual([inboxTask, projectTask]);
    });
});
