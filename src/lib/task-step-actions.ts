import type { SupabaseClient } from "@supabase/supabase-js";

import type { TodoStepRow } from "~/lib/types";

export const TODO_STEP_FIELDS = "id, todo_id, title, is_done, position, inserted_at, updated_at";

function sortTaskSteps(steps: TodoStepRow[]) {
    return [...steps].sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return a.inserted_at.localeCompare(b.inserted_at);
    });
}

export async function listTaskSteps(
    supabase: SupabaseClient,
    taskId: string,
): Promise<TodoStepRow[]> {
    const { data, error } = await supabase
        .from("todo_steps")
        .select(TODO_STEP_FIELDS)
        .eq("todo_id", taskId)
        .order("position", { ascending: true })
        .order("inserted_at", { ascending: true });

    if (error) throw error;
    return sortTaskSteps((data ?? []) as TodoStepRow[]);
}

export async function createTaskStep(
    supabase: SupabaseClient,
    input: {
        taskId: string;
        title: string;
        position: number;
    },
): Promise<TodoStepRow> {
    const { data, error } = await supabase
        .from("todo_steps")
        .insert({
            todo_id: input.taskId,
            title: input.title.trim(),
            position: input.position,
        })
        .select(TODO_STEP_FIELDS)
        .single();

    if (error) throw error;
    return data as TodoStepRow;
}

export async function updateTaskStep(
    supabase: SupabaseClient,
    input: {
        stepId: string;
        title?: string;
        position?: number;
    },
): Promise<TodoStepRow> {
    const payload: Record<string, string | number> = {};

    if (typeof input.title === "string") {
        payload.title = input.title.trim();
    }

    if (typeof input.position === "number") {
        payload.position = input.position;
    }

    const { data, error } = await supabase
        .from("todo_steps")
        .update(payload)
        .eq("id", input.stepId)
        .select(TODO_STEP_FIELDS)
        .single();

    if (error) throw error;
    return data as TodoStepRow;
}

export async function setTaskStepCompletion(
    supabase: SupabaseClient,
    stepId: string,
    nextIsDone: boolean,
): Promise<TodoStepRow> {
    const { data, error } = await supabase
        .from("todo_steps")
        .update({
            is_done: nextIsDone,
        })
        .eq("id", stepId)
        .select(TODO_STEP_FIELDS)
        .single();

    if (error) throw error;
    return data as TodoStepRow;
}

export async function deleteTaskStep(
    supabase: SupabaseClient,
    stepId: string,
) {
    const { error } = await supabase
        .from("todo_steps")
        .delete()
        .eq("id", stepId);

    if (error) throw error;
}
