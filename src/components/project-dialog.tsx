"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useData } from "~/components/data-provider";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useSupabaseBrowserClient } from "~/lib/supabase/browser";
import { createProject, deleteOrLeaveProject, updateProject } from "~/lib/project-actions";
import {
    getProjectColorClasses,
    getProjectIcon,
    PROJECT_COLOR_TOKENS,
    PROJECT_ICON_TOKENS,
} from "~/lib/project-appearance";
import type { TodoList } from "~/lib/types";

function formatProjectOptionLabel(token: string) {
    return token
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export function ProjectDialog({
    open,
    onOpenChange,
    initialProject,
    onSaved,
    onRemoved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialProject?: TodoList | null;
    onSaved?: (projectId: string) => void;
    onRemoved?: () => void;
}) {
    const supabase = useSupabaseBrowserClient();
    const { userId, refreshData } = useData();
    const [name, setName] = useState("");
    const [colorToken, setColorToken] = useState<(typeof PROJECT_COLOR_TOKENS)[number]>("cobalt");
    const [iconToken, setIconToken] = useState<(typeof PROJECT_ICON_TOKENS)[number]>("book-open");
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(initialProject?.name ?? "");
        setColorToken((initialProject?.color_token as typeof PROJECT_COLOR_TOKENS[number]) ?? "cobalt");
        setIconToken((initialProject?.icon_token as typeof PROJECT_ICON_TOKENS[number]) ?? "book-open");
    }, [initialProject, open]);

    async function handleSubmit() {
        if (!userId) return;

        try {
            setSaving(true);
            const project = initialProject
                ? await updateProject(supabase, initialProject.id, {
                    name,
                    color_token: colorToken,
                    icon_token: iconToken,
                })
                : await createProject(supabase, {
                    userId,
                    name,
                    colorToken,
                    iconToken,
                });

            await refreshData();
            toast.success(initialProject ? "Project updated." : "Project created.");
            onOpenChange(false);
            onSaved?.(project.id);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to save project.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteOrLeave() {
        if (!userId || !initialProject || isInbox) return;

        try {
            setRemoving(true);
            await deleteOrLeaveProject(supabase, initialProject.id, userId, initialProject.owner_id);
            await refreshData();
            toast.success(isOwner ? "Project deleted." : "You left the project.");
            onOpenChange(false);
            onRemoved?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to update the project.");
        } finally {
            setRemoving(false);
        }
    }

    const PreviewIcon = getProjectIcon(iconToken);
    const previewPalette = getProjectColorClasses(colorToken);
    const isOwner = initialProject?.owner_id === userId;
    const isInbox = initialProject?.name.trim().toLowerCase() === "inbox";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-[1.4rem] border-border/60 p-0 shadow-none sm:max-h-[calc(100dvh-3rem)] sm:rounded-[1.75rem]">
                <div className="border-b border-border/50 bg-background/25 p-4 sm:p-6">
                    <DialogHeader className="text-left">
                        <p className="eyebrow">Workspace</p>
                        <DialogTitle className="text-xl font-semibold tracking-[-0.04em] sm:text-2xl">
                            {initialProject ? "Edit project" : "Create project"}
                        </DialogTitle>
                        <DialogDescription>
                            Set the project name, icon, and color without changing project structure.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-6">
                    <div className="surface-card flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
                        <div
                            className={`rounded-xl border border-border/60 p-2.5 sm:rounded-2xl sm:p-3 ${previewPalette.soft}`}
                            style={{ boxShadow: "inset 0 1px 0 var(--surface-topline), var(--shadow-xs)" }}
                        >
                            <PreviewIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${previewPalette.text}`} />
                        </div>
                        <div>
                            <p className="eyebrow">Preview</p>
                            <p className="text-base font-semibold tracking-[-0.03em] text-foreground sm:text-lg">
                                {name.trim() || "Untitled Project"}
                            </p>
                            <p className="text-sm text-muted-foreground">How this project appears in the sidebar and views.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="projectName" className="eyebrow">
                            Name
                        </Label>
                        <Input
                            id="projectName"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Organic Chemistry"
                        />
                    </div>

                    <div className="space-y-2.5 sm:space-y-3">
                        <Label className="eyebrow">Color</Label>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
                            {PROJECT_COLOR_TOKENS.map((token) => {
                                const palette = getProjectColorClasses(token);
                                return (
                                    <button
                                        key={token}
                                        type="button"
                                        onClick={() => setColorToken(token)}
                                        className={`rounded-xl border px-2.5 py-3 text-[11px] font-semibold capitalize transition-[transform,background-color,border-color,color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:rounded-2xl sm:px-3 sm:py-4 sm:text-xs ${colorToken === token ? `${palette.soft} ${palette.border} ${palette.text} shadow-[var(--shadow-soft)]` : "motion-safe-lift border-border/60 bg-background/60 text-muted-foreground hover:-translate-y-px hover:bg-secondary/60 hover:text-foreground"}`}
                                        style={colorToken === token ? { boxShadow: "inset 0 1px 0 var(--surface-topline), var(--shadow-soft)" } : undefined}
                                    >
                                        <span className={`mx-auto mb-1.5 block h-2.5 w-2.5 rounded-full sm:mb-2 sm:h-3 sm:w-3 ${palette.accent}`} />
                                        {token}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2.5 sm:space-y-3">
                        <Label className="eyebrow">Icon</Label>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
                            {PROJECT_ICON_TOKENS.map((token) => {
                                const Icon = getProjectIcon(token);
                                const active = iconToken === token;
                                const label = formatProjectOptionLabel(token);
                                return (
                                    <button
                                        key={token}
                                        type="button"
                                        onClick={() => setIconToken(token)}
                                        title={label}
                                        aria-label={label}
                                        className={`aspect-square rounded-xl border p-3 transition-[transform,background-color,border-color,color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:rounded-2xl sm:p-4 ${active ? `${previewPalette.soft} ${previewPalette.border} ${previewPalette.text} shadow-[var(--shadow-soft)]` : "motion-safe-lift border-border/60 bg-background/60 text-muted-foreground hover:-translate-y-px hover:bg-secondary/60 hover:text-foreground"}`}
                                        style={active ? { boxShadow: "inset 0 1px 0 var(--surface-topline), var(--shadow-soft)" } : undefined}
                                    >
                                        <Icon className="mx-auto h-4 w-4 sm:h-5 sm:w-5" />
                                        <span className="sr-only">{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {initialProject ? (
                        isInbox ? (
                            <div className="surface-muted flex items-start gap-3 px-4 py-3 text-sm text-muted-foreground sm:py-4">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                <p>Inbox is permanent and cannot be deleted or left.</p>
                            </div>
                        ) : (
                            <div className="rounded-[1rem] border border-destructive/20 bg-destructive/4 p-3.5 sm:rounded-[1.25rem] sm:p-4">
                                <div className="space-y-2">
                                    <p className="eyebrow text-destructive">Danger zone</p>
                                    <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                                        {isOwner ? "Delete this project" : "Leave this project"}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {isOwner
                                            ? "This removes the project for all members."
                                            : "You will lose access to this shared project."}
                                    </p>
                                </div>
                                <div className="mt-3 sm:mt-4">
                                    <Button
                                        variant="destructive"
                                        onClick={() => void handleDeleteOrLeave()}
                                        disabled={removing}
                                    >
                                        {removing ? "Working..." : isOwner ? "Delete project" : "Leave project"}
                                    </Button>
                                </div>
                            </div>
                        )
                    ) : null}
                </div>

                <DialogFooter className="border-t border-border/50 bg-background/20 p-4 sm:p-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={() => void handleSubmit()} disabled={saving || removing || !name.trim()}>
                        {saving ? "Saving..." : initialProject ? "Save project" : "Create project"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
