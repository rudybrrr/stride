import type { SupabaseClient } from "@supabase/supabase-js";

import type { TodoSectionRow } from "~/lib/types";

export const TODO_SECTION_FIELDS = "id, list_id, name, position, inserted_at, updated_at";

function sortTaskSections(sections: TodoSectionRow[]) {
    return [...sections].sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return a.inserted_at.localeCompare(b.inserted_at);
    });
}

export function isMissingTaskSectionsError(error: unknown) {
    if (!error || typeof error !== "object") return false;

    const code = "code" in error ? String(error.code) : "";
    const message = "message" in error ? String(error.message) : "";
    const details = "details" in error ? String(error.details) : "";
    const normalizedMessage = `${message} ${details}`.toLowerCase();

    return (
        code === "PGRST205"
        || code === "42P01"
        || normalizedMessage.includes("could not find the table 'public.todo_sections' in the schema cache")
        || normalizedMessage.includes('relation "public.todo_sections" does not exist')
        || normalizedMessage.includes('relation "todo_sections" does not exist')
    );
}

export function getTaskSectionsErrorMessage(error: unknown) {
    if (isMissingTaskSectionsError(error)) {
        return "Project sections are not available yet. Apply the latest migration.";
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
        return error.message;
    }

    return "Unable to update project sections.";
}

export async function listTaskSections(
    supabase: SupabaseClient,
    listId: string,
): Promise<TodoSectionRow[]> {
    const { data, error } = await supabase
        .from("todo_sections")
        .select(TODO_SECTION_FIELDS)
        .eq("list_id", listId)
        .order("position", { ascending: true })
        .order("inserted_at", { ascending: true });

    if (error) throw error;
    return sortTaskSections((data ?? []) as TodoSectionRow[]);
}

export async function createTaskSection(
    supabase: SupabaseClient,
    input: {
        listId: string;
        name: string;
        position: number;
    },
): Promise<TodoSectionRow> {
    const { data, error } = await supabase
        .from("todo_sections")
        .insert({
            list_id: input.listId,
            name: input.name.trim(),
            position: input.position,
        })
        .select(TODO_SECTION_FIELDS)
        .single();

    if (error) throw error;
    return data as TodoSectionRow;
}

export async function updateTaskSection(
    supabase: SupabaseClient,
    input: {
        sectionId: string;
        name?: string;
        position?: number;
    },
): Promise<TodoSectionRow> {
    const payload: Record<string, string | number> = {};

    if (typeof input.name === "string") {
        payload.name = input.name.trim();
    }

    if (typeof input.position === "number") {
        payload.position = input.position;
    }

    const { data, error } = await supabase
        .from("todo_sections")
        .update(payload)
        .eq("id", input.sectionId)
        .select(TODO_SECTION_FIELDS)
        .single();

    if (error) throw error;
    return data as TodoSectionRow;
}

export async function deleteTaskSection(
    supabase: SupabaseClient,
    sectionId: string,
) {
    const { error } = await supabase
        .from("todo_sections")
        .delete()
        .eq("id", sectionId);

    if (error) throw error;
}
