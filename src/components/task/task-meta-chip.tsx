"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

interface TaskMetaChipProps {
    icon?: LucideIcon;
    label: string;
    tone?: "default" | "danger" | "muted";
    swatch?: string;
}

export function TaskMetaChip({ icon: Icon, label, tone = "default", swatch }: TaskMetaChipProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-[11.5px] leading-none tabular-nums",
                tone === "danger"
                    ? "text-[color:var(--priority-p1)]"
                    : tone === "muted"
                        ? "text-muted-foreground/60"
                        : "text-muted-foreground/85",
            )}
        >
            {swatch ? (
                <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: swatch }}
                    aria-hidden
                />
            ) : null}
            {Icon ? <Icon className="h-3 w-3 shrink-0" strokeWidth={2} /> : null}
            <span className="truncate">{label}</span>
        </span>
    );
}

interface PriorityDotProps {
    priority: "high" | "medium" | "low";
}

export function PriorityDot({ priority }: PriorityDotProps) {
    const color =
        priority === "high"
            ? "var(--priority-p1)"
            : priority === "medium"
                ? "var(--priority-p2)"
                : "var(--priority-p3)";
    return (
        <span
            aria-hidden
            title={`${priority} priority`}
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
        />
    );
}
