import type { SupabaseClient } from "@supabase/supabase-js";

import { createProject } from "~/lib/project-actions";
import type { TodoList } from "~/lib/types";

interface BootstrapOptions {
    userId: string;
    email?: string | null;
    profileIdentity?: ClerkProfileIdentity;
    currentProfile?: ProfileSnapshot | null;
    lists?: TodoList[];
    hasProfile?: boolean;
}

interface ClerkProfileIdentity {
    username?: string | null;
    fullName?: string | null;
    avatarUrl?: string | null;
}

interface ProfileSnapshot {
    username?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
}

interface BootstrapMembershipRow {
    role: string;
    todo_lists: TodoList | TodoList[] | null;
}

const DEFAULT_INBOX_NAME = "Inbox";
const DEFAULT_INBOX_COLOR = "cobalt";
const DEFAULT_INBOX_ICON = "book-open";

function normalizeList(value: TodoList | TodoList[] | null): TodoList | null {
    if (!value) return null;
    if (Array.isArray(value)) return value[0] ?? null;
    return value;
}

function isInboxListName(name: string) {
    return name.trim().toLowerCase() === DEFAULT_INBOX_NAME.toLowerCase();
}

function hasOwnedInbox(lists: TodoList[], userId: string) {
    return lists.some((list) => list.owner_id === userId && isInboxListName(list.name));
}

function isMissingProfilesEmailColumnError(error: unknown) {
    if (!error || typeof error !== "object") return false;

    const code = "code" in error ? String(error.code) : "";
    const message = "message" in error ? String(error.message) : "";

    return code === "PGRST204" && message.includes("email");
}

function isDuplicateProfilesUsernameError(error: unknown) {
    if (!error || typeof error !== "object") return false;

    const code = "code" in error ? String(error.code) : "";
    const message = "message" in error ? String(error.message) : "";

    return code === "23505" && (message.includes("profiles_username_key") || message.includes("username"));
}

function cleanProfileText(value?: string | null) {
    const cleaned = value?.trim();
    if (!cleaned) return null;
    return cleaned;
}

function normalizeClerkUsername(value?: string | null) {
    const cleaned = cleanProfileText(value);
    if (!cleaned) return null;
    return cleaned.toLowerCase().replace(/\s+/g, "_");
}

function buildClerkProfilePatch(
    userId: string,
    identity?: ClerkProfileIdentity,
    currentProfile?: ProfileSnapshot | null,
) {
    const patch: Record<string, string> = { id: userId };
    const username = normalizeClerkUsername(identity?.username);
    const fullName = cleanProfileText(identity?.fullName);

    if (username && !currentProfile?.username) {
        patch.username = username;
    }
    if (fullName && !currentProfile?.full_name) {
        patch.full_name = fullName;
    }

    return patch;
}

async function upsertProfileWithSafeFallbacks(
    supabase: SupabaseClient,
    payload: Record<string, string>,
) {
    let nextPayload = { ...payload };
    let canDropEmail = "email" in nextPayload;
    let canDropUsername = "username" in nextPayload;

    while (true) {
        const { error } = await supabase
            .from("profiles")
            .upsert(nextPayload, { onConflict: "id" });

        if (!error) return;

        if (canDropEmail && isMissingProfilesEmailColumnError(error)) {
            const { email: _email, ...payloadWithoutEmail } = nextPayload;
            void _email;
            nextPayload = payloadWithoutEmail;
            canDropEmail = false;
            continue;
        }

        if (canDropUsername && isDuplicateProfilesUsernameError(error)) {
            const { username: _username, ...payloadWithoutUsername } = nextPayload;
            void _username;
            nextPayload = payloadWithoutUsername;
            canDropUsername = false;
            continue;
        }

        throw error;
    }
}

export async function syncClerkProfileToSupabase(
    supabase: SupabaseClient,
    userId: string,
    identity?: ClerkProfileIdentity,
    currentProfile?: ProfileSnapshot | null,
) {
    const profilePatch = buildClerkProfilePatch(userId, identity, currentProfile);
    if (Object.keys(profilePatch).length <= 1) return;

    await upsertProfileWithSafeFallbacks(supabase, profilePatch);
}

async function ensureProfileRow(
    supabase: SupabaseClient,
    userId: string,
    email?: string | null,
    identity?: ClerkProfileIdentity,
) {
    const resolvedEmail = email?.trim() ?? null;
    const profilePatch = buildClerkProfilePatch(userId, identity, null);

    const profilePayloadWithEmail = resolvedEmail
        ? { ...profilePatch, email: resolvedEmail }
        : profilePatch;

    await upsertProfileWithSafeFallbacks(supabase, profilePayloadWithEmail);
}

async function fetchAccessibleLists(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase
        .from("todo_list_members")
        .select("list_id, role, todo_lists(*)")
        .eq("user_id", userId);

    if (error) throw error;

    return ((data ?? []) as BootstrapMembershipRow[]).flatMap((membership) => {
        const list = normalizeList(membership.todo_lists);
        if (!list) return [];

        return [{
            ...list,
            user_role: membership.role,
        }];
    });
}

export async function bootstrapUserWorkspace(
    supabase: SupabaseClient,
    { userId, email, profileIdentity, currentProfile, lists, hasProfile }: BootstrapOptions,
) {
    if (!hasProfile) {
        await ensureProfileRow(supabase, userId, email, profileIdentity);
    } else {
        await syncClerkProfileToSupabase(supabase, userId, profileIdentity, currentProfile);
    }

    try {
        const { error } = await supabase.rpc("ensure_default_inbox");
        if (!error) {
            return;
        }
    } catch {
        // Fall through to client-side repair.
    }

    let accessibleLists = lists ?? [];

    if (!hasOwnedInbox(accessibleLists, userId)) {
        accessibleLists = await fetchAccessibleLists(supabase, userId);
    }

    if (hasOwnedInbox(accessibleLists, userId)) {
        return;
    }

    await createProject(supabase, {
        userId,
        name: DEFAULT_INBOX_NAME,
        colorToken: DEFAULT_INBOX_COLOR,
        iconToken: DEFAULT_INBOX_ICON,
    });
}
