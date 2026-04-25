"use client";

import { Loader2, Target, Trophy, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "~/components/app-shell";
import { EmptyState, PageHeader, SectionCard } from "~/components/app-primitives";
import { useData } from "~/components/data-provider";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { buildCommunityLeaderboard, createEmptyWeeklyCommitment, type CommunityLeaderboardEntry } from "~/lib/community-data";
import { getPlannerPreferences } from "~/lib/planning";
import { getProgressWeekWindow } from "~/lib/progress-review";
import { useSupabaseBrowserClient } from "~/lib/supabase/browser";
import type { FocusSession, WeeklyCommitmentRow } from "~/lib/types";

interface SharedPeerMembershipRow {
    list_id: string;
    user_id: string;
}

interface CommunityProfileRow {
    id: string;
    username?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
}

function isMissingWeeklyCommitmentsError(error: unknown) {
    if (!error || typeof error !== "object") return false;

    const code = "code" in error ? String(error.code) : "";
    const message = "message" in error ? String(error.message) : "";

    return code === "PGRST205"
        || code === "42P01"
        || message.includes("weekly_commitments");
}

function CommunityOverviewMetric({
    label,
    value,
    meta,
}: {
    label: string;
    value: string;
    meta: string;
}) {
    return (
        <div className="rounded-[1rem] border border-border/55 bg-background/60 px-3.5 py-3.5">
            <p className="eyebrow">{label}</p>
            <p className="mt-2 font-mono text-[1.15rem] font-semibold tracking-[-0.04em] text-foreground">{value}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{meta}</p>
        </div>
    );
}

export default function CommunityClient() {
    return (
        <AppShell>
            <CommunityContent />
        </AppShell>
    );
}

function CommunityContent() {
    const supabase = useSupabaseBrowserClient();
    const { userId, lists, profile } = useData();
    const plannerPreferences = useMemo(() => getPlannerPreferences(profile), [profile]);
    const currentWindow = useMemo(
        () => getProgressWeekWindow(profile?.timezone, new Date(), plannerPreferences.weekStartsOn),
        [plannerPreferences.weekStartsOn, profile?.timezone],
    );
    const [loading, setLoading] = useState(true);
    const [leaderboard, setLeaderboard] = useState<CommunityLeaderboardEntry[]>([]);
    const [peerCount, setPeerCount] = useState(0);
    const [commitmentSummary, setCommitmentSummary] = useState("");
    const [targetFocusMinutes, setTargetFocusMinutes] = useState("");
    const [targetTaskCount, setTargetTaskCount] = useState("");
    const [savingCommitment, setSavingCommitment] = useState(false);

    const loadCommunity = useCallback(async () => {
        if (!userId) {
            setLeaderboard([]);
            setPeerCount(0);
            setLoading(false);
            return;
        }

        const sharedListIds = lists.map((list) => list.id);
        if (sharedListIds.length === 0) {
            setLeaderboard([]);
            setPeerCount(0);
            const emptyCommitment = createEmptyWeeklyCommitment({
                userId,
                weekStartOn: currentWindow.startDateKey,
            });
            setCommitmentSummary(emptyCommitment.summary ?? "");
            setTargetFocusMinutes("");
            setTargetTaskCount("");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const { data: membershipRows, error: membershipError } = await supabase
                .from("todo_list_members")
                .select("list_id, user_id")
                .in("list_id", sharedListIds);

            if (membershipError) throw membershipError;

            const sharedProjectCounts = new Map<string, number>();
            const peerIds = Array.from(new Set(
                ((membershipRows ?? []) as SharedPeerMembershipRow[])
                    .filter((row) => row.user_id !== userId)
                    .map((row) => {
                        sharedProjectCounts.set(row.user_id, (sharedProjectCounts.get(row.user_id) ?? 0) + 1);
                        return row.user_id;
                    }),
            ));

            setPeerCount(peerIds.length);

            const peerProfiles = new Map<string, CommunityProfileRow>();
            if (peerIds.length > 0) {
                const { data: profileRows, error: profileError } = await supabase
                    .from("profiles")
                    .select("id, username, full_name, avatar_url")
                    .in("id", peerIds);

                if (profileError) throw profileError;

                ((profileRows ?? []) as CommunityProfileRow[]).forEach((profileRow) => {
                    peerProfiles.set(profileRow.id, profileRow);
                });
            }

            const [focusSessionsResponse, commitmentResponse] = await Promise.all([
                peerIds.length > 0
                    ? supabase
                        .from("focus_sessions")
                        .select("id, user_id, list_id, todo_id, planned_block_id, duration_seconds, mode, inserted_at")
                        .in("user_id", peerIds)
                        .order("inserted_at", { ascending: false })
                        .limit(300)
                    : Promise.resolve({ data: [], error: null }),
                supabase
                    .from("weekly_commitments")
                    .select("id, user_id, week_start_on, summary, target_focus_minutes, target_task_count, inserted_at, updated_at")
                    .eq("user_id", userId)
                    .eq("week_start_on", currentWindow.startDateKey)
                    .maybeSingle(),
            ]);

            if (focusSessionsResponse.error) throw focusSessionsResponse.error;
            if (commitmentResponse.error && !isMissingWeeklyCommitmentsError(commitmentResponse.error)) throw commitmentResponse.error;

            const nextCommitment = (commitmentResponse.data as WeeklyCommitmentRow | null) ?? createEmptyWeeklyCommitment({
                userId,
                weekStartOn: currentWindow.startDateKey,
            });

            setLeaderboard(buildCommunityLeaderboard({
                sessions: (focusSessionsResponse.data ?? []) as FocusSession[],
                peerProfiles,
                sharedProjectCounts,
                timeZone: profile?.timezone,
                weekStartsOn: plannerPreferences.weekStartsOn,
            }));
            setCommitmentSummary(nextCommitment.summary ?? "");
            setTargetFocusMinutes(nextCommitment.target_focus_minutes ? String(nextCommitment.target_focus_minutes) : "");
            setTargetTaskCount(nextCommitment.target_task_count ? String(nextCommitment.target_task_count) : "");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to load community.");
        } finally {
            setLoading(false);
        }
    }, [currentWindow.startDateKey, lists, plannerPreferences.weekStartsOn, profile?.timezone, supabase, userId]);

    useEffect(() => {
        void loadCommunity();
    }, [loadCommunity]);

    useEffect(() => {
        if (!userId || lists.length === 0) return;

        const channel = supabase
            .channel(`community-${userId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "focus_sessions" }, () => void loadCommunity())
            .on("postgres_changes", { event: "*", schema: "public", table: "weekly_commitments", filter: `user_id=eq.${userId}` }, () => void loadCommunity())
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [lists.length, loadCommunity, supabase, userId]);

    async function handleSaveCommitment() {
        if (!userId) return;

        try {
            setSavingCommitment(true);
            const { error } = await supabase
                .from("weekly_commitments")
                .upsert({
                    user_id: userId,
                    week_start_on: currentWindow.startDateKey,
                    summary: commitmentSummary.trim() ? commitmentSummary.trim() : null,
                    target_focus_minutes: targetFocusMinutes.trim() ? Number.parseInt(targetFocusMinutes, 10) : null,
                    target_task_count: targetTaskCount.trim() ? Number.parseInt(targetTaskCount, 10) : null,
                }, { onConflict: "user_id,week_start_on" })
                .select("id, user_id, week_start_on, summary, target_focus_minutes, target_task_count, inserted_at, updated_at")
                .single();

            if (error) throw error;

            toast.success("Commitment saved.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save commitment.");
        } finally {
            setSavingCommitment(false);
        }
    }

    const totalSharedProjects = useMemo(
        () => leaderboard.reduce((total, entry) => total + entry.shared_project_count, 0),
        [leaderboard],
    );
    const commitmentState = commitmentSummary.trim() ? "Written" : "Open";
    const overviewTitle = peerCount === 0
        ? "Community becomes useful once work is shared with at least one other person."
        : leaderboard.length > 0
            ? `${leaderboard.length} focused peer${leaderboard.length === 1 ? "" : "s"} showed up this week.`
            : `${peerCount} peer${peerCount === 1 ? "" : "s"} share work with you this week.`;
    const overviewDescription = commitmentSummary.trim()
        ? `Your weekly commitment is written, ${targetFocusMinutes ? `${targetFocusMinutes} focus minutes` : "focus time"} is on the table, and the leaderboard shows who is already moving inside those shared workspaces.`
        : "Capture a weekly commitment first, then use the leaderboard as a quiet accountability check instead of a loud competition board.";

    return (
        <div className="page-container space-y-5">
            <PageHeader
                eyebrow="Shared accountability"
                title="Community"
                description={`Shared accountability for ${currentWindow.label}.`}
            />

            {loading ? (
                <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    Loading community...
                </div>
            ) : (
                <div className="space-y-5">
                    <section className="surface-card overflow-hidden">
                        <div className="grid gap-6 px-5 py-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <p className="eyebrow">Weekly accountability</p>
                                    <h2 className="text-xl font-semibold tracking-[-0.04em] text-foreground">
                                        {overviewTitle}
                                    </h2>
                                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                                        {overviewDescription}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                                        {peerCount} shared peer{peerCount === 1 ? "" : "s"}
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                                        {totalSharedProjects} overlapping project{totalSharedProjects === 1 ? "" : "s"}
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                                        Commitment {commitmentState.toLowerCase()}
                                    </span>
                                </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                                <CommunityOverviewMetric label="Peers" value={`${peerCount}`} meta="People sharing a project with you" />
                                <CommunityOverviewMetric label="Ranked" value={`${leaderboard.length}`} meta="Peers with focus logged this week" />
                                <CommunityOverviewMetric label="Shared projects" value={`${totalSharedProjects}`} meta="Overlap across shared workspaces" />
                                <CommunityOverviewMetric
                                    label="Commitment"
                                    value={commitmentState}
                                    meta={targetFocusMinutes || targetTaskCount ? "Weekly target captured" : "No weekly target yet"}
                                />
                            </div>
                        </div>
                    </section>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                        <SectionCard
                            title="Weekly commitment"
                            description="Write the outcome you want to protect this week."
                            action={(
                                <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                    Week of {currentWindow.label}
                                </span>
                            )}
                        >
                            <div className="space-y-4">
                                <div className="rounded-[1.1rem] border border-border/55 bg-secondary/32 p-4 shadow-[var(--shadow-xs)]">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                        {commitmentState === "Written" ? "Commitment in place" : "Set the tone for the week"}
                                    </p>
                                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                                        State the work you are protecting, then add rough focus or completion targets only if they help.
                                    </p>
                                    <Textarea
                                        value={commitmentSummary}
                                        onChange={(event) => setCommitmentSummary(event.target.value)}
                                        placeholder="State the work you are committing to finish."
                                        className="mt-4 min-h-[112px] resize-none rounded-[1rem] border-border/70 bg-background/65 px-3.5 py-3 text-sm leading-6 shadow-none focus-visible:ring-0"
                                    />
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">Focus target</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                inputMode="numeric"
                                                value={targetFocusMinutes}
                                                onChange={(event) => setTargetFocusMinutes(event.target.value)}
                                                placeholder="120"
                                            />
                                        </label>
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">Task target</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                inputMode="numeric"
                                                value={targetTaskCount}
                                                onChange={(event) => setTargetTaskCount(event.target.value)}
                                                placeholder="8"
                                            />
                                        </label>
                                    </div>
                                    <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs leading-5 text-muted-foreground">
                                            Keep the commitment concise. This page should read like an accountability note, not a scoreboard.
                                        </p>
                                        <Button size="sm" onClick={() => void handleSaveCommitment()} disabled={savingCommitment}>
                                            {savingCommitment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                                            Save commitment
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Peer leaderboard" description="Focused peers across your shared projects this week.">
                            {peerCount > 0 ? (
                                leaderboard.length > 0 ? (
                                    <div className="space-y-2">
                                        {leaderboard.map((entry) => (
                                            <div
                                                key={entry.user_id}
                                                className="flex items-center gap-3 rounded-[1.05rem] border border-border/55 bg-background/60 px-3.5 py-3 shadow-[var(--shadow-xs)]"
                                            >
                                                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/55 bg-secondary/60 text-sm font-semibold text-foreground">
                                                    {entry.rank === 1 ? <Trophy className="h-5 w-5 text-amber-500" /> : entry.rank}
                                                </div>
                                                <Avatar className="h-9 w-9 border border-border/60">
                                                    <AvatarImage src={entry.avatar_url ?? ""} alt={entry.username} />
                                                    <AvatarFallback className="bg-primary/12 text-primary">
                                                        {entry.username.slice(0, 1).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold text-foreground">@{entry.username}</p>
                                                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                                        {entry.shared_project_count} shared project{entry.shared_project_count === 1 ? "" : "s"}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-mono text-base font-semibold text-foreground">{entry.total_minutes}m</p>
                                                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">focus</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState
                                        title="No shared focus yet"
                                        description="Shared peers will show up here once this week's sessions start coming in."
                                        icon={<Users className="h-8 w-8" />}
                                        size="compact"
                                    />
                                )
                            ) : (
                                <EmptyState
                                    title="No shared peers yet"
                                    description="Invite someone into a project to turn Community into an accountability surface."
                                    icon={<Users className="h-8 w-8" />}
                                    size="compact"
                                />
                            )}
                        </SectionCard>
                    </div>
                </div>
            )}
        </div>
    );
}
