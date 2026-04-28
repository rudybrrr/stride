import type { SupabaseClient } from "@supabase/supabase-js";

import { getInboxListId } from "~/lib/things-views";
import type { TodoList } from "~/lib/types";

export function getDefaultInboxListId(lists: TodoList[]) {
    return getInboxListId(lists) ?? "";
}

export async function ensureDefaultInboxListId(supabase: SupabaseClient) {
    const { data, error } = await supabase.rpc("ensure_default_inbox").returns<string>();

    if (error) throw error;
    if (!data) throw new Error("Inbox creation returned no list id.");
    if (typeof data !== "string") throw new Error("Inbox creation returned an invalid list id.");

    return data;
}
