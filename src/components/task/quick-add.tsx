"use client";

import { SendHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { TaskSyntaxComposer } from "~/components/task-syntax-composer";
import { Button } from "~/components/ui/button";
import { useData } from "~/components/data-provider";
import { useTaskDataset } from "~/hooks/use-task-dataset";
import {
    applyQuickAddSuggestion,
    getQuickAddActiveSuggestionState,
    parseQuickAddInput,
} from "~/lib/quick-add-parser";
import { createProject } from "~/lib/project-actions";
import { useSupabaseBrowserClient } from "~/lib/supabase/browser";
import { createTask, replaceTaskLabels } from "~/lib/task-actions";
import { getDateInputValue, getTimeInputValue } from "~/lib/task-deadlines";
import { getVisibleTaskLabels } from "~/lib/things-views";
import { cn } from "~/lib/utils";

export interface QuickAddDefaults {
    dueDate?: string | null;
    labelNames?: string[];
    listId?: string | null;
    sectionId?: string | null;
    title?: string;
}

function dedupeLabelNames(names: string[]) {
    const seen = new Set<string>();
    const result: string[] = [];

    names.forEach((name) => {
        const normalized = name.trim();
        if (!normalized) return;

        const key = normalized.toLowerCase();
        if (seen.has(key)) return;

        seen.add(key);
        result.push(normalized);
    });

    return result;
}

export function QuickAddInlineComposer({
    className,
    defaults,
    placeholder = "Add a task",
}: {
    className?: string;
    defaults?: QuickAddDefaults | null;
    placeholder?: string;
}) {
    const { userId, lists, profile, refreshData } = useData();
    const { applyTaskPatch, taskLabels, upsertTask, upsertTaskLabels } = useTaskDataset();
    const supabase = useSupabaseBrowserClient();
    const [inputValue, setInputValue] = useState(defaults?.title ?? "");
    const [composerSelection, setComposerSelection] = useState((defaults?.title ?? "").length);
    const [selectionPosition, setSelectionPosition] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    const defaultListId = useMemo(() => {
        const inbox = lists.find((list) => list.name.toLowerCase() === "inbox") ?? lists[0];
        return defaults?.listId ?? inbox?.id ?? "";
    }, [defaults?.listId, lists]);
    const defaultDueDate = useMemo(
        () => defaults?.dueDate ? getDateInputValue(defaults.dueDate, profile?.timezone) : "",
        [defaults?.dueDate, profile?.timezone],
    );
    const defaultDueTime = useMemo(
        () => defaults?.dueDate ? getTimeInputValue(defaults.dueDate, profile?.timezone) : "",
        [defaults?.dueDate, profile?.timezone],
    );
    const visibleTaskLabels = useMemo(() => getVisibleTaskLabels(taskLabels), [taskLabels]);
    const parsedInput = useMemo(
        () => parseQuickAddInput(inputValue, lists, { labels: visibleTaskLabels }),
        [inputValue, lists, visibleTaskLabels],
    );
    const activeSuggestion = useMemo(
        () => getQuickAddActiveSuggestionState(inputValue, composerSelection, lists, visibleTaskLabels),
        [composerSelection, inputValue, lists, visibleTaskLabels],
    );
    const effectiveListId = parsedInput.hasProjectToken ? parsedInput.listId ?? "" : defaultListId;
    const pendingProjectName = parsedInput.hasProjectToken ? parsedInput.pendingProjectName : null;
    const effectiveDueDate = parsedInput.dueDate ?? defaultDueDate;
    const effectiveDueTime = parsedInput.dueTime ?? defaultDueTime;
    const effectiveLabelNames = useMemo(
        () => dedupeLabelNames([...(defaults?.labelNames ?? []), ...parsedInput.labelNames]),
        [defaults?.labelNames, parsedInput.labelNames],
    );
    const cleanedTitle = parsedInput.title.trim();
    const canSubmit = Boolean(userId && cleanedTitle && !saving);

    async function handleSubmit() {
        if (!userId || !cleanedTitle || saving) return;
        if (effectiveDueTime && !effectiveDueDate) {
            toast.error("Add a date before setting a time.");
            return;
        }
        if (parsedInput.recurrenceRule && !effectiveDueDate) {
            toast.error("Recurring tasks need a deadline.");
            return;
        }
        if (parsedInput.reminderOffsetMinutes != null && !effectiveDueDate) {
            toast.error("Reminders need a deadline.");
            return;
        }

        try {
            setSaving(true);
            let resolvedListId = effectiveListId;

            if (!resolvedListId && pendingProjectName) {
                const createdProject = await createProject(supabase, {
                    userId,
                    name: pendingProjectName,
                    colorToken: "cobalt",
                    iconToken: "book-open",
                });
                resolvedListId = createdProject.id;
                await refreshData();
            }

            if (!resolvedListId) {
                toast.error("Choose a project before adding the task.");
                return;
            }

            const createdTask = await createTask(supabase, {
                userId,
                listId: resolvedListId,
                sectionId: defaults?.listId === resolvedListId ? defaults?.sectionId ?? null : null,
                title: cleanedTitle,
                dueDate: effectiveDueDate || null,
                dueTime: effectiveDueTime || null,
                reminderOffsetMinutes: parsedInput.reminderOffsetMinutes,
                recurrenceRule: parsedInput.recurrenceRule ?? null,
                priority: parsedInput.priority ?? null,
                estimatedMinutes: parsedInput.estimatedMinutes ?? null,
                preferredTimeZone: profile?.timezone,
            });

            upsertTask(createdTask, { suppressRealtimeEcho: true });

            if (effectiveLabelNames.length > 0) {
                const assignedLabels = await replaceTaskLabels(supabase, {
                    userId,
                    taskId: createdTask.id,
                    labelNames: effectiveLabelNames,
                });
                upsertTaskLabels(assignedLabels);
                applyTaskPatch(createdTask.id, { labels: assignedLabels });
            }

            setInputValue("");
            setComposerSelection(0);
            setSelectionPosition(0);
            toast.success("Task added.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to add task.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            className={cn(
                "group flex items-start gap-2 rounded-[0.7rem] border border-transparent px-2.5 py-2 transition-colors",
                "hover:border-border/60 hover:bg-[color:var(--surface-hover)] focus-within:border-border/70 focus-within:bg-[color:var(--surface-hover)]",
                className,
            )}
        >
            <div className="min-w-0 flex-1">
                <TaskSyntaxComposer
                    ariaLabel="Add task"
                    rows={1}
                    value={inputValue}
                    tokens={parsedInput.tokens}
                    placeholder={placeholder}
                    suggestionState={activeSuggestion}
                    selectionPosition={selectionPosition}
                    onSelectionChange={(selection) => {
                        setComposerSelection(selection);
                        if (selectionPosition != null) {
                            setSelectionPosition(null);
                        }
                    }}
                    onChange={setInputValue}
                    onApplySuggestion={(suggestion) => {
                        if (!activeSuggestion) return;
                        const nextValue = applyQuickAddSuggestion(inputValue, activeSuggestion, suggestion);
                        setInputValue(nextValue.value);
                        setComposerSelection(nextValue.selection);
                        setSelectionPosition(nextValue.selection);
                    }}
                    onSubmit={() => void handleSubmit()}
                    inputClassName="min-h-7 text-[14px]"
                    highlightClassName="text-[14px] leading-7"
                    composerClassName="min-h-7 leading-7 tracking-[-0.012em]"
                />
            </div>

            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-0.5 h-7 w-7 rounded-full text-muted-foreground/70 opacity-70 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                disabled={!canSubmit}
                onClick={() => void handleSubmit()}
                title="Add task"
            >
                <SendHorizontal className="h-3.5 w-3.5" />
                <span className="sr-only">{saving ? "Adding task" : "Add task"}</span>
            </Button>
        </div>
    );
}
