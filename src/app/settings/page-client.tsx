"use client";

import { Keyboard, Palette, User } from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { PageHeader } from "~/components/app-primitives";
import { AppearanceSettings } from "~/components/settings/appearance-settings";
import { ShortcutsSettings } from "~/components/settings/shortcuts-settings";
import { ProfileForm } from "./profile-form";

export default function SettingsPageClient({ userId }: { userId: string }) {
    const sections = [
        {
            title: "Account",
            description: "Profile identity, planner defaults, and password changes.",
            icon: User,
        },
        {
            title: "Appearance",
            description: "Theme and accent choices that stay aligned with the calmer shell.",
            icon: Palette,
        },
        {
            title: "Keyboard",
            description: "Shortcuts and quick-add syntax for faster capture.",
            icon: Keyboard,
        },
    ] as const;

    return (
        <AppShell>
            <div className="page-container space-y-5">
                <PageHeader
                    eyebrow="Preferences"
                    title="Settings"
                    description="Account, appearance, and capture preferences in the same calmer language as the shell and settings dialog."
                />

                <div className="grid gap-5 xl:grid-cols-[17.5rem_minmax(0,1fr)]">
                    <aside className="surface-card h-fit p-4 sm:p-5">
                        <div className="space-y-2">
                            <p className="eyebrow">Overview</p>
                            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                                One source of truth
                            </h2>
                            <p className="text-sm leading-6 text-muted-foreground">
                                The page version stays aligned with the dialog surface: concise sections, softer hierarchy, and no separate settings aesthetic.
                            </p>
                        </div>

                        <div className="mt-4 space-y-2">
                            {sections.map((section) => {
                                const Icon = section.icon;

                                return (
                                    <div
                                        key={section.title}
                                        className="rounded-[1rem] border border-border/55 bg-background/60 px-3.5 py-3.5"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/55 bg-secondary/55 text-muted-foreground">
                                                <Icon className="h-4.5 w-4.5" />
                                            </span>
                                            <div className="space-y-1">
                                                <p className="text-sm font-semibold text-foreground">{section.title}</p>
                                                <p className="text-xs leading-5 text-muted-foreground">{section.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </aside>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <p className="eyebrow">Account</p>
                                <h2 className="text-xl font-semibold tracking-[-0.04em] text-foreground">
                                    Profile and planner defaults
                                </h2>
                                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                                    Manage your profile identity, daily planning defaults, and password settings without switching into a different visual mode.
                                </p>
                            </div>
                            <ProfileForm userId={userId} />
                        </div>

                        <div className="surface-card p-5 sm:p-6">
                            <AppearanceSettings />
                        </div>

                        <div className="surface-card p-5 sm:p-6">
                            <ShortcutsSettings />
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
