"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Brain, ChevronDown, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { getDayOverviewPayloadSignature, type DayOverviewPayload } from "~/lib/day-overview";
import { cn } from "~/lib/utils";

type DayOverviewStatus = "idle" | "loading" | "success" | "error";

interface DayOverviewApiResponse {
    error?: unknown;
    summary?: unknown;
}

function getApiErrorMessage(data: DayOverviewApiResponse) {
    return typeof data.error === "string" && data.error.trim()
        ? data.error.trim()
        : "Unable to generate the day overview right now.";
}

export function AiDayOverviewCard({
    payload,
}: {
    payload: DayOverviewPayload | null;
}) {
    const [expanded, setExpanded] = useState(true);
    const [status, setStatus] = useState<DayOverviewStatus>("idle");
    const [summary, setSummary] = useState("");
    const [error, setError] = useState("");
    const requestIdRef = useRef(0);
    const payloadRef = useRef<DayOverviewPayload | null>(payload);
    const payloadSignature = useMemo(
        () => payload ? getDayOverviewPayloadSignature(payload) : "",
        [payload],
    );
    const payloadSignatureRef = useRef(payloadSignature);

    useEffect(() => {
        payloadRef.current = payload;
        payloadSignatureRef.current = payloadSignature;
    }, [payload, payloadSignature]);

    const fetchOverview = useCallback(async (options?: { signal?: AbortSignal }) => {
        const currentPayload = payloadRef.current;
        const currentSignature = payloadSignatureRef.current;

        if (!currentPayload || !currentSignature) {
            setStatus("idle");
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setStatus("loading");
        setError("");

        try {
            const response = await fetch("/api/day-overview", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(currentPayload),
                cache: "no-store",
                signal: options?.signal,
            });
            const data = await response.json().catch(() => ({})) as DayOverviewApiResponse;

            if (!response.ok) {
                throw new Error(getApiErrorMessage(data));
            }

            const nextSummary = typeof data.summary === "string" ? data.summary.trim() : "";
            if (!nextSummary) {
                throw new Error("AI overview came back empty.");
            }

            if (
                options?.signal?.aborted
                || requestIdRef.current !== requestId
                || payloadSignatureRef.current !== currentSignature
            ) {
                return;
            }

            setSummary(nextSummary);
            setStatus("success");
        } catch (caughtError) {
            if (options?.signal?.aborted || requestIdRef.current !== requestId) {
                return;
            }

            setError(caughtError instanceof Error ? caughtError.message : "Unable to generate the day overview right now.");
            setStatus("error");
        }
    }, []);

    useEffect(() => {
        if (!payloadSignature) {
            requestIdRef.current += 1;
            setStatus("idle");
            setSummary("");
            setError("");
            return;
        }

        const controller = new AbortController();
        void fetchOverview({ signal: controller.signal });

        return () => {
            controller.abort();
        };
    }, [fetchOverview, payloadSignature]);

    const subtitle = status === "loading"
        ? "Generating from Today data"
        : status === "error"
            ? "Overview unavailable"
            : "Tasks, planning, and focus";

    return (
        <section className="mb-3 overflow-hidden rounded-xl border border-border/45 bg-[var(--surface-elevated)] shadow-[var(--shadow-xs)]">
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 pr-2 text-left outline-none transition-colors hover:bg-[color:var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-ring/35"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((current) => !current)}
                >
                    <span className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/14 bg-primary/10 text-primary">
                        <Brain className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold tracking-[-0.02em] text-foreground">
                            AI Day Overview
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground/65">
                            {subtitle}
                        </span>
                    </span>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="rounded-full text-muted-foreground hover:bg-[color:var(--surface-hover)] hover:text-foreground"
                        disabled={status === "loading" || !payloadSignature}
                        title="Refresh overview"
                        onClick={() => void fetchOverview()}
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", status === "loading" && "animate-spin")} />
                        <span className="sr-only">Refresh overview</span>
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="rounded-full text-muted-foreground hover:bg-[color:var(--surface-hover)] hover:text-foreground"
                        aria-expanded={expanded}
                        title={expanded ? "Collapse overview" : "Expand overview"}
                        onClick={() => setExpanded((current) => !current)}
                    >
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
                        <span className="sr-only">{expanded ? "Collapse overview" : "Expand overview"}</span>
                    </Button>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {expanded ? (
                    <motion.div
                        key="overview-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-border/35 px-4 pb-4 pt-3">
                            {status === "loading" ? (
                                <div className="space-y-2 py-1">
                                    <Skeleton className="h-3 w-11/12 rounded-full bg-muted/70" />
                                    <Skeleton className="h-3 w-10/12 rounded-full bg-muted/70" />
                                    <Skeleton className="h-3 w-7/12 rounded-full bg-muted/70" />
                                </div>
                            ) : status === "error" ? (
                                <p className="rounded-xl border border-border/40 bg-[color:var(--surface-hover)] px-3 py-2.5 text-[13px] leading-5 text-muted-foreground">
                                    {error}
                                </p>
                            ) : summary ? (
                                <p className="whitespace-pre-line text-[13.5px] leading-6 text-foreground/82">
                                    {summary}
                                </p>
                            ) : (
                                <p className="text-[13px] leading-5 text-muted-foreground">
                                    Preparing the day overview.
                                </p>
                            )}
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </section>
    );
}
