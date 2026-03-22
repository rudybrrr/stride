"use client";

import { useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";

import { createSupabaseBrowserClient } from "~/lib/supabase/browser";
import { uploadTaskAttachments } from "~/lib/task-actions";

interface TaskAttachmentUploadProps {
    userId: string;
    todoId: string;
    listId: string | null;
    onUploaded: () => Promise<void> | void;
}

export function TaskAttachmentUpload({
    userId,
    todoId,
    listId,
    onUploaded,
}: TaskAttachmentUploadProps) {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [uploading, setUploading] = useState(false);

    async function handleFiles(files: File[]) {
        if (!listId || files.length === 0) return;

        setUploading(true);
        try {
            await uploadTaskAttachments(supabase, userId, todoId, listId, files);
            await onUploaded();
            toast.success(files.length === 1 ? "File uploaded." : `${files.length} files uploaded.`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to upload files.");
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="flex items-center gap-2 overflow-hidden">
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${uploading
                ? "bg-muted text-muted-foreground/50"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}>
                {uploading ? (
                    <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                        Uploading...
                    </>
                ) : (
                    <>
                        <Paperclip className="h-3.5 w-3.5" />
                        Attach files
                    </>
                )}
                <input
                    type="file"
                    className="hidden"
                    multiple
                    disabled={uploading || !listId}
                    onChange={(event) => {
                        const files = Array.from(event.currentTarget.files ?? []);
                        event.currentTarget.value = "";
                        if (files.length > 0) {
                            void handleFiles(files);
                        }
                    }}
                />
            </label>
        </div>
    );
}
