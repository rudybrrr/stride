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
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-2">
                {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
                <div className="space-y-2">
                    <h1 className="text-balance text-[2rem] font-semibold tracking-[-0.05em] text-foreground sm:text-[2.35rem]">
                        {title}
                    </h1>
                    {description ? (
                        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                            {description}
                        </p>
                    ) : null}
                </div>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
    );
}

export function SectionCard({
    title,
    description,
    action,
    className,
    children,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
            <Card className={cn("overflow-hidden", className)}>
                <CardHeader className="border-b border-border/70 pb-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-[17px] font-semibold tracking-[-0.03em]">{title}</CardTitle>
                            {description ? <CardDescription>{description}</CardDescription> : null}
                        </div>
                        {action ? <div className="shrink-0">{action}</div> : null}
                    </div>
                </CardHeader>
                <CardContent className="pt-5">{children}</CardContent>
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
        <div className={cn("surface-card flex min-h-24 flex-col justify-between p-4", className)}>
            <p className="eyebrow">{label}</p>
            <div className="space-y-1">
                <p className="font-mono text-[1.7rem] font-semibold tracking-[-0.05em] text-foreground">{value}</p>
                {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
            </div>
        </div>
    );
}

export function EmptyState({
    title,
    description,
    icon,
    action,
}: {
    title: string;
    description: string;
    icon?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="surface-card flex min-h-56 flex-col items-center justify-center gap-4 p-6 text-center">
            {icon ? <div className="rounded-lg border border-border bg-muted/70 p-4 text-primary">{icon}</div> : null}
            <div className="space-y-2.5">
                <h3 className="text-lg font-semibold tracking-[-0.04em] text-foreground">{title}</h3>
                <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            {action ? <div className="pt-2">{action}</div> : null}
        </div>
    );
}
