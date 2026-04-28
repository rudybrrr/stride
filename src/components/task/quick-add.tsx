"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { TaskSyntaxComposer } from "~/components/task-syntax-composer";
import { TaskDueDatePicker } from "~/components/task-due-date-picker";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { useData } from "~/components/data-provider";
import { useTaskDataset } from "~/hooks/use-task-dataset";
import {
    applyQuickAddSuggestion,
    getQuickAddActiveSuggestionState,
    parseQuickAddInput,
} from "~/lib/quick-add-parser";
import { createProject } from "~/lib/project-actions";
import { ensureDefaultInboxListId, getDefaultInboxListId } from "~/lib/default-inbox";
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

const PRIORITY_OPTIONS: Array<{
    value: "high" | "medium" | "low" | "";
    label: string;
    swatch: string;
}> = [
    { value: "high", label: "P1", swatch: "var(--priority-p1)" },
    { value: "medium", label: "P2", swatch: "var(--priority-p2)" },
    { value: "low", label: "P3", swatch: "var(--priority-p3)" },
    { value: "", label: "-", swatch: "transparent" },
];

function priorityColor(value: "high" | "medium" | "low" | "") {
    if (value === "high") return "var(--priority-p1)";
    if (value === "medium") return "var(--priority-p2)";
    if (value === "low") return "var(--priority-p3)";
    return "var(--input)";
}

function isQuickAddFloatingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;

    return Boolean(target.closest(
        "[data-slot='select-content'], [data-slot='select-item'], [data-slot='popover-content'], [data-slot='dialog-content'], [data-slot='calendar'], [role='dialog'], [role='menu'], [role='listbox']",
    ));
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
    const composerRef = useRef<HTMLDivElement | null>(null);
    const [inputValue, setInputValue] = useState(defaults?.title ?? "");
    const [description, setDescription] = useState("");
    const [manualDueDate, setManualDueDate] = useState<string | null | undefined>(undefined);
    const [manualPriority, setManualPriority] = useState<"high" | "medium" | "low" | "" | undefined>(undefined);
    const [manualListId, setManualListId] = useState<string | undefined>(undefined);
    const [composerSelection, setComposerSelection] = useState((defaults?.title ?? "").length);
    const [selectionPosition, setSelectionPosition] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
    const isExpanded = inputValue.trim().length > 0 || description.trim().length > 0;
    const transition = {
        type: "spring" as const,
        stiffness: 420,
        damping: 34,
        mass: 0.85,
    };

    const defaultListId = useMemo(() => {
        return defaults?.listId ?? getDefaultInboxListId(lists);
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
    const effectiveListId = parsedInput.hasProjectToken ? parsedInput.listId ?? "" : manualListId ?? defaultListId;
    const pendingProjectName = parsedInput.hasProjectToken ? parsedInput.pendingProjectName : null;
    const effectiveDueDate = manualDueDate ?? parsedInput.dueDate ?? defaultDueDate;
    const effectiveDueTime = parsedInput.dueTime ?? defaultDueTime;
    const effectivePriority = manualPriority ?? parsedInput.priority ?? "";
    const effectiveLabelNames = useMemo(
        () => dedupeLabelNames([...(defaults?.labelNames ?? []), ...parsedInput.labelNames]),
        [defaults?.labelNames, parsedInput.labelNames],
    );
    const cleanedTitle = parsedInput.title.trim();
    const canSubmit = Boolean(userId && cleanedTitle && !saving);
    const isDirty = Boolean(
        inputValue.trim()
        || description.trim()
        || manualDueDate !== undefined
        || manualPriority !== undefined
        || manualListId !== undefined,
    );

    const resetDraft = useCallback(() => {
        setInputValue(defaults?.title ?? "");
        setDescription("");
        setManualDueDate(undefined);
        setManualPriority(undefined);
        setManualListId(undefined);
        setComposerSelection((defaults?.title ?? "").length);
        setSelectionPosition((defaults?.title ?? "").length);
    }, [defaults?.title]);

    const requestDiscard = useCallback((event?: Event) => {
        if (saving || !isDirty) return;

        event?.preventDefault();
        event?.stopPropagation();
        setDiscardDialogOpen(true);
    }, [isDirty, saving]);

    useEffect(() => {
        if (!isDirty || discardDialogOpen) return;

        const shouldBlockDismissEvent = (target: EventTarget | null) => {
            if (target instanceof Node && composerRef.current?.contains(target)) return false;
            if (isQuickAddFloatingTarget(target)) return false;

            return true;
        };

        const handlePointerDown = (event: PointerEvent) => {
            if (event.defaultPrevented) return;
            if (!shouldBlockDismissEvent(event.target)) return;

            requestDiscard(event);
        };

        const handleClick = (event: MouseEvent) => {
            if (event.defaultPrevented) return;
            if (!shouldBlockDismissEvent(event.target)) return;

            requestDiscard(event);
        };

        document.addEventListener("pointerdown", handlePointerDown, { capture: true });
        document.addEventListener("click", handleClick, { capture: true });
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
            document.removeEventListener("click", handleClick, { capture: true });
        };
    }, [discardDialogOpen, isDirty, requestDiscard]);

    useEffect(() => {
        if (!isDirty || discardDialogOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.key !== "Escape") return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (isQuickAddFloatingTarget(event.target)) return;

            requestDiscard(event);
        };

        window.addEventListener("keydown", handleKeyDown, { capture: true });
        return () => {
            window.removeEventListener("keydown", handleKeyDown, { capture: true });
        };
    }, [discardDialogOpen, isDirty, requestDiscard]);

    function handleConfirmDiscard() {
        setDiscardDialogOpen(false);
        resetDraft();
    }

    async function handleSubmit() {
        if (!userId || !cleanedTitle || saving) return false;
        if (effectiveDueTime && !effectiveDueDate) {
            toast.error("Add a date before setting a time.");
            return false;
        }
        if (parsedInput.recurrenceRule && !effectiveDueDate) {
            toast.error("Recurring tasks need a deadline.");
            return false;
        }
        if (parsedInput.reminderOffsetMinutes != null && !effectiveDueDate) {
            toast.error("Reminders need a deadline.");
            return false;
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
                resolvedListId = await ensureDefaultInboxListId(supabase);
                await refreshData();
            }

            const createdTask = await createTask(supabase, {
                userId,
                listId: resolvedListId,
                sectionId: defaults?.listId === resolvedListId ? defaults?.sectionId ?? null : null,
                title: cleanedTitle,
                description,
                dueDate: effectiveDueDate || null,
                dueTime: effectiveDueTime || null,
                reminderOffsetMinutes: parsedInput.reminderOffsetMinutes,
                recurrenceRule: parsedInput.recurrenceRule ?? null,
                priority: effectivePriority || null,
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

            resetDraft();
            setDiscardDialogOpen(false);
            toast.success("Task added.");
            return true;
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to add task.");
            return false;
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <motion.div
                ref={composerRef}
                layout
                transition={transition}
                className={cn(
                    "group rounded-[0.7rem] border px-2.5 py-2 transition-colors",
                    isExpanded
                        ? "border-border/80 bg-[color:var(--surface-elevated)] shadow-[var(--shadow-xs)]"
                        : "border-transparent hover:border-border/60 hover:bg-[color:var(--surface-hover)] focus-within:border-border/70 focus-within:bg-[color:var(--surface-hover)]",
                    className,
                )}
            >
                <div className="flex items-start gap-2">
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

                <AnimatePresence initial={false}>
                    {isExpanded ? (
                        <motion.div
                            key="quick-add-detail"
                            initial={{ height: 0, opacity: 0, y: -4 }}
                            animate={{ height: "auto", opacity: 1, y: 0 }}
                            exit={{ height: 0, opacity: 0, y: -4 }}
                            transition={transition}
                            className="overflow-hidden"
                        >
                            <div className="space-y-3 border-t border-border/70 pt-3">
                                <Textarea
                                    placeholder="Notes"
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    className="min-h-[42px] resize-none border-none bg-transparent px-0 py-0 text-[13.5px] leading-relaxed text-muted-foreground/90 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/45"
                                    rows={1}
                                />

                                <div className="flex flex-wrap items-center gap-2">
                                    <TaskDueDatePicker
                                        value={effectiveDueDate || null}
                                        allowClear
                                        onChange={setManualDueDate}
                                        placeholder="When"
                                        className="h-7 rounded-full border-none bg-[color:var(--surface-hover)] px-3 text-[12px] hover:bg-[color:var(--surface-selected)]"
                                    />

                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button
                                                type="button"
                                                className={cn(
                                                    "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] transition-colors",
                                                    effectivePriority
                                                        ? "bg-[color:var(--surface-hover)] text-foreground hover:bg-[color:var(--surface-selected)]"
                                                        : "bg-[color:var(--surface-hover)] text-muted-foreground/80 hover:bg-[color:var(--surface-selected)]",
                                                )}
                                            >
                                                <span
                                                    className="h-1.5 w-1.5 rounded-full"
                                                    style={{ backgroundColor: priorityColor(effectivePriority) }}
                                                />
                                                {effectivePriority === "high" ? "P1" : effectivePriority === "medium" ? "P2" : effectivePriority === "low" ? "P3" : "Priority"}
                                                <ChevronDown className="h-3 w-3 opacity-60" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent align="start" className="w-44 p-1">
                                            <div className="grid gap-0.5">
                                                {PRIORITY_OPTIONS.map((option) => (
                                                    <button
                                                        key={option.label}
                                                        type="button"
                                                        onClick={() => setManualPriority(option.value)}
                                                        className={cn(
                                                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-[color:var(--surface-hover)]",
                                                            effectivePriority === option.value && "bg-[color:var(--surface-selected)]",
                                                        )}
                                                    >
                                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.swatch }} />
                                                        {option.label === "-" ? "No priority" : option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>

                                    <Select value={effectiveListId} onValueChange={setManualListId}>
                                        <SelectTrigger className="h-7 w-auto gap-1.5 rounded-full border-none bg-[color:var(--surface-hover)] px-3 text-[12px] hover:bg-[color:var(--surface-selected)]">
                                            <SelectValue placeholder="Project" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {lists.map((list) => (
                                                <SelectItem key={list.id} value={list.id}>
                                                    {list.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </motion.div>

            <Dialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Discard quick add changes?</DialogTitle>
                        <DialogDescription>
                            Your draft hasn&apos;t been saved.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDiscardDialogOpen(false)}>
                            Keep editing
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmDiscard}>
                            Discard changes
                        </Button>
                        <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
                            {saving ? "Saving..." : "Save task"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
