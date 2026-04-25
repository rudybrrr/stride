"use client";

import { Check } from "lucide-react";
import { cn } from "~/lib/utils";

interface TaskCheckboxProps {
    isDone: boolean;
    priority?: "high" | "medium" | "low" | null;
    onToggle: (next: boolean) => void;
    size?: "sm" | "md";
    ariaLabel?: string;
}

export function TaskCheckbox({
    isDone,
    priority,
    onToggle,
    size = "md",
    ariaLabel,
}: TaskCheckboxProps) {
    const dimension = size === "sm" ? "h-[14px] w-[14px]" : "h-[18px] w-[18px]";
    const checkSize = size === "sm" ? "h-[9px] w-[9px]" : "h-[11px] w-[11px]";

    const ring =
        priority === "high"
            ? "[--checkbox-ring:var(--priority-p1)]"
            : priority === "medium"
                ? "[--checkbox-ring:var(--priority-p2)]"
                : priority === "low"
                    ? "[--checkbox-ring:var(--priority-p3)]"
                    : "[--checkbox-ring:var(--input)]";

    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={isDone}
            aria-label={ariaLabel ?? (isDone ? "Mark task incomplete" : "Mark task complete")}
            onClick={(event) => {
                event.stopPropagation();
                onToggle(!isDone);
            }}
            className={cn(
                ring,
                "shrink-0 cursor-pointer rounded-full border-[1.5px] transition-[background-color,border-color,color,transform] duration-[160ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
                "flex items-center justify-center",
                dimension,
                isDone
                    ? "border-[color:var(--checkbox-ring)] bg-[color:var(--checkbox-ring)] text-[color:var(--paper)]"
                    : "border-[color:var(--checkbox-ring)] bg-transparent text-transparent hover:border-foreground/40",
            )}
        >
            <Check
                className={cn(checkSize, "transition-transform duration-[160ms]", isDone ? "scale-100" : "scale-0")}
                strokeWidth={3}
            />
        </button>
    );
}
