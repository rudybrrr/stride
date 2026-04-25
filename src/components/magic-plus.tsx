"use client";

import { Plus } from "lucide-react";
import { useShellActions } from "~/components/app-shell";
import { cn } from "~/lib/utils";

interface MagicPlusProps {
    listId?: string | null;
    sectionId?: string | null;
    className?: string;
}

export function MagicPlus({ listId, sectionId, className }: MagicPlusProps) {
    const { openQuickAdd } = useShellActions();

    return (
        <button
            type="button"
            aria-label="Quick add task"
            title="Quick add"
            onClick={() => openQuickAdd({ listId, sectionId })}
            className={cn(
                "magic-plus group fixed right-5 bottom-5 z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-primary-foreground shadow-[var(--shadow-raised)]",
                "bg-[color:var(--accent-brand)] transition-[transform,box-shadow,background-color] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                "hover:scale-[1.04] hover:bg-[color:var(--accent-ink)] active:scale-[0.97]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "lg:right-8 lg:bottom-8",
                className,
            )}
        >
            <Plus
                className="h-6 w-6 transition-transform duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-90"
                strokeWidth={2.4}
            />
            <span className="sr-only">Quick add task</span>
        </button>
    );
}
