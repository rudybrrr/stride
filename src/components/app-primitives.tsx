"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export function PageHeader({
    eyebrow,
    title,
    description,
    actions,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-2">
                {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
                <h1 className="text-balance text-[1.72rem] font-semibold leading-tight tracking-[-0.04em] text-foreground sm:text-[1.96rem]">
                    {title}
                </h1>
                {description ? (
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
        </header>
    );
}

export function SectionCard({
    title,
    description,
    action,
    className,
    dense,
    children,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
    dense?: boolean;
    children: ReactNode;
}) {
    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className={cn("border-b border-border/40", dense ? "px-3 py-2.5" : "px-4 py-3")}>
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className={cn("font-medium tracking-[-0.02em]", dense ? "text-[0.95rem]" : "text-[0.98rem]")}>{title}</CardTitle>
                        {description ? <CardDescription>{description}</CardDescription> : null}
                    </div>
                    {action ? <div className="shrink-0">{action}</div> : null}
                </div>
            </CardHeader>
            <CardContent className={dense ? "px-3 py-3" : "px-4 py-4"}>{children}</CardContent>
        </Card>
    );
}

export function MetricTile({
    label,
    value,
    meta,
    className,
}: {
    label: string;
    value: string;
    meta?: string;
    className?: string;
}) {
    return (
        <div className={cn("surface-card flex min-h-[4.5rem] flex-col justify-between gap-3 p-3.5", className)}>
            <p className="text-[11px] text-muted-foreground/55">{label}</p>
            <div className="space-y-0.5">
                <p className="font-mono text-[1.25rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.35rem]">{value}</p>
                {meta ? <p className="text-[13px] leading-5 text-muted-foreground">{meta}</p> : null}
            </div>
        </div>
    );
}

export function EmptyState({
    title,
    description,
    icon,
    action,
    size = "default",
    className,
}: {
    title: string;
    description: string;
    icon?: ReactNode;
    action?: ReactNode;
    size?: "default" | "compact";
    className?: string;
}) {
    return (
        <div
            data-size={size}
            className={cn(
                "surface-empty-state flex flex-col items-center justify-center gap-3.5 p-6 text-center",
                size === "compact" && "min-h-[10.75rem] gap-3 p-5",
                className,
            )}
        >
            {icon ? (
                <div className="rounded-xl p-2.5 text-muted-foreground/50">
                    {icon}
                </div>
            ) : null}
            <div className="space-y-1.5">
                <h3 className={cn("text-[0.98rem] font-semibold tracking-[-0.03em] text-foreground", size === "compact" && "text-[0.95rem]")}>{title}</h3>
                <p className={cn("mx-auto max-w-sm text-sm leading-6 text-muted-foreground", size === "compact" && "max-w-[28rem] text-[13px] leading-[1.45rem]")}>{description}</p>
            </div>
            {action ? <div className="pt-1">{action}</div> : null}
        </div>
    );
}
