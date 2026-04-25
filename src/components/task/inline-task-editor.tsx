"use client";

import { ChevronDown, MoreHorizontal, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Input } from "~/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { TaskDueDatePicker } from "~/components/task-due-date-picker";
import { TaskStepsSection } from "~/components/task-steps-section";
import { useData } from "~/components/data-provider";
import type { TaskDatasetRecord } from "~/hooks/use-task-dataset";
import { useTaskDataset } from "~/hooks/use-task-dataset";
import {
    deleteTask,
    replaceTaskLabels,
    updateTask,
} from "~/lib/task-actions";
import {
    getDateInputValue,
    getTimeInputValue,
} from "~/lib/task-deadlines";
import {
    formatTaskLabelInput,
    parseTaskLabelInput,
} from "~/lib/task-labels";
import { getVisibleTaskLabels } from "~/lib/things-views";
import { useSupabaseBrowserClient } from "~/lib/supabase/browser";
import { cn } from "~/lib/utils";

interface InlineTaskEditorProps {
    task: TaskDatasetRecord;
    onClose: () => void;
    onOpenFullEditor?: () => void;
    showProject?: boolean;
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

export function InlineTaskEditor({
    task,
    onClose,
    onOpenFullEditor,
    showProject = false,
}: InlineTaskEditorProps) {
    const supabase = useSupabaseBrowserClient();
    const { profile, userId } = useData();
    const { lists, taskLabels, applyTaskPatch, removeTask, upsertTaskLabels } = useTaskDataset();
    const timeZone = profile?.timezone ?? null;
    const visibleTaskLabels = getVisibleTaskLabels(task.labels ?? []);

    const [description, setDescription] = useState(task.description ?? "");
    const [dueDate, setDueDate] = useState(getDateInputValue(task, timeZone));
    const [dueTime, setDueTime] = useState(getTimeInputValue(task, timeZone));
    const [priority, setPriority] = useState<"high" | "medium" | "low" | "">(
        task.priority ?? "",
    );
    const [labelsInput, setLabelsInput] = useState(formatTaskLabelInput(visibleTaskLabels));
    const [listId, setListId] = useState<string>(task.list_id);
    const [saving, setSaving] = useState(false);
    const lastTaskIdRef = useRef(task.id);

    useEffect(() => {
        if (lastTaskIdRef.current === task.id) return;
        lastTaskIdRef.current = task.id;
        setDescription(task.description ?? "");
        setDueDate(getDateInputValue(task, timeZone));
        setDueTime(getTimeInputValue(task, timeZone));
        setPriority(task.priority ?? "");
        setLabelsInput(formatTaskLabelInput(getVisibleTaskLabels(task.labels ?? [])));
        setListId(task.list_id);
    }, [task, timeZone]);

    async function persistField(patch: Partial<{
        description: string;
        dueDate: string;
        dueTime: string;
        priority: "high" | "medium" | "low" | "";
        listId: string;
    }>) {
        setSaving(true);
        try {
            const next = {
                description: patch.description ?? description,
                dueDate: patch.dueDate ?? dueDate,
                dueTime: patch.dueTime ?? dueTime,
                priority: patch.priority ?? priority,
                listId: patch.listId ?? listId,
            };

            const updated = await updateTask(supabase, {
                id: task.id,
                title: task.title,
                description: next.description,
                dueDate: next.dueDate || null,
                dueTime: next.dueTime || null,
                reminderOffsetMinutes: task.reminder_offset_minutes ?? null,
                recurrenceRule: task.recurrence_rule ?? null,
                priority: next.priority || null,
                listId: next.listId,
                sectionId: task.section_id ?? null,
                estimatedMinutes: task.estimated_minutes ?? null,
                preferredTimeZone: timeZone,
            });
            applyTaskPatch(task.id, updated);
        } catch (err) {
            toast.error("Couldn't save task", {
                description: err instanceof Error ? err.message : "Unknown error",
            });
        } finally {
            setSaving(false);
        }
    }

    async function commitLabels(raw: string) {
        if (!userId) return;
        const desired = parseTaskLabelInput(raw);
        const desiredLowered = desired.map((n) => n.toLowerCase());
        const current = visibleTaskLabels;
        const currentLowered = new Set(current.map((l) => l.name.toLowerCase()));

        const same =
            desired.length === current.length &&
            desiredLowered.every((n) => currentLowered.has(n));
        if (same) return;

        try {
            const updated = await replaceTaskLabels(supabase, {
                taskId: task.id,
                userId,
                labelNames: desired,
            });
            applyTaskPatch(task.id, { labels: updated });
            upsertTaskLabels(updated);
        } catch (err) {
            toast.error("Couldn't update labels", {
                description: err instanceof Error ? err.message : "Unknown error",
            });
        }
    }

    async function handleDelete() {
        if (!window.confirm("Delete this task?")) return;
        try {
            await deleteTask(supabase, task.id);
            removeTask(task.id);
            toast.success("Task deleted");
            onClose();
        } catch (err) {
            toast.error("Couldn't delete task", {
                description: err instanceof Error ? err.message : "Unknown error",
            });
        }
    }

    return (
        <div className="space-y-3">
            <Textarea
                placeholder="Notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                    if ((task.description ?? "") !== description) {
                        void persistField({ description });
                    }
                }}
                className="min-h-[42px] resize-none border-none bg-transparent px-0 py-0 text-[13.5px] leading-relaxed text-muted-foreground/90 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/45"
                rows={1}
            />

            <TaskStepsSection taskId={task.id} />

            <div className="flex flex-wrap items-center gap-2">
                {/* When picker */}
                <TaskDueDatePicker
                    value={dueDate || null}
                    allowClear
                    onChange={(value) => {
                        setDueDate(value);
                        void persistField({ dueDate: value });
                    }}
                    placeholder="When"
                    className="h-7 rounded-full border-none bg-[color:var(--surface-hover)] px-3 text-[12px] hover:bg-[color:var(--surface-selected)]"
                />

                {/* Priority pills */}
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] transition-colors",
                                priority
                                    ? "bg-[color:var(--surface-hover)] text-foreground hover:bg-[color:var(--surface-selected)]"
                                    : "bg-[color:var(--surface-hover)] text-muted-foreground/80 hover:bg-[color:var(--surface-selected)]",
                            )}
                        >
                            <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: priorityColor(priority) }}
                            />
                            {priority === "high" ? "P1" : priority === "medium" ? "P2" : priority === "low" ? "P3" : "Priority"}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-44 p-1">
                        <div className="grid gap-0.5">
                            {PRIORITY_OPTIONS.map((opt) => (
                                <button
                                    key={opt.label}
                                    type="button"
                                    onClick={() => {
                                        setPriority(opt.value);
                                        void persistField({ priority: opt.value });
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-[color:var(--surface-hover)]",
                                        priority === opt.value && "bg-[color:var(--surface-selected)]",
                                    )}
                                >
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: opt.swatch }} />
                                    {opt.label === "-" ? "No priority" : opt.label}
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Labels */}
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[color:var(--surface-hover)] px-3 text-[12px] text-muted-foreground/85 transition-colors hover:bg-[color:var(--surface-selected)]"
                        >
                            {visibleTaskLabels.length > 0
                                ? visibleTaskLabels.map((l) => l.name).join(", ")
                                : "Tags"}
                            <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-2">
                        <Input
                            value={labelsInput}
                            onChange={(e) => setLabelsInput(e.target.value)}
                            onBlur={() => void commitLabels(labelsInput)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    void commitLabels(labelsInput);
                                }
                            }}
                            placeholder="comma, separated"
                            className="h-8 text-[13px]"
                        />
                        {taskLabels.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {getVisibleTaskLabels(taskLabels).slice(0, 12).map((label) => {
                                    const active = task.labels.some((l) => l.id === label.id);
                                    return (
                                        <button
                                            key={label.id}
                                            type="button"
                                            onClick={() => {
                                                const names = parseTaskLabelInput(labelsInput);
                                                const existsLower = names.map((n) => n.toLowerCase());
                                                const lower = label.name.toLowerCase();
                                                const next = existsLower.includes(lower)
                                                    ? names.filter((n) => n.toLowerCase() !== lower)
                                                    : [...names, label.name];
                                                const formatted = formatTaskLabelInput(next.map((name) => ({ name })));
                                                setLabelsInput(formatted);
                                                void commitLabels(formatted);
                                            }}
                                            className={cn(
                                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] transition-colors",
                                                active
                                                    ? "bg-[color:var(--surface-selected)] text-foreground"
                                                    : "bg-[color:var(--surface-hover)] text-muted-foreground/85 hover:bg-[color:var(--surface-selected)]",
                                            )}
                                        >
                                            <span
                                                className="h-1.5 w-1.5 rounded-full"
                                                style={{ backgroundColor: label.color_token ?? "var(--muted-foreground)" }}
                                            />
                                            {label.name}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                    </PopoverContent>
                </Popover>

                {/* Project select (if showProject is enabled) */}
                {showProject ? (
                    <Select
                        value={listId}
                        onValueChange={(value) => {
                            setListId(value);
                            void persistField({ listId: value });
                        }}
                    >
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
                ) : null}

                <div className="ml-auto flex items-center gap-1">
                    {onOpenFullEditor ? (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onOpenFullEditor}
                            className="h-7 w-7 rounded-full text-muted-foreground/70 hover:text-foreground"
                            title="More options"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    ) : null}
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleDelete()}
                        className="h-7 w-7 rounded-full text-muted-foreground/60 hover:text-[color:var(--priority-p1)]"
                        title="Delete task"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {saving ? (
                <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/50">
                    Saving...
                </p>
            ) : null}
        </div>
    );
}

function priorityColor(value: "high" | "medium" | "low" | "") {
    if (value === "high") return "var(--priority-p1)";
    if (value === "medium") return "var(--priority-p2)";
    if (value === "low") return "var(--priority-p3)";
    return "var(--input)";
}
