"use client";

import { Keyboard, Palette, User, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";
import { AppearanceSettings } from "./settings/appearance-settings";
import { ProfileForm } from "~/components/settings/profile-form";
import { ShortcutsSettings } from "./settings/shortcuts-settings";

type SettingsSection = "account" | "appearance" | "shortcuts";

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    initialSection?: SettingsSection;
}

export function SettingsDialog({
    open,
    onOpenChange,
    userId,
    initialSection = "account",
}: SettingsDialogProps) {
    const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

    useEffect(() => {
        if (open) {
            setActiveSection(initialSection);
        }
    }, [open, initialSection]);

    const sections = [
        { id: "account", label: "Account", icon: User, description: "Profile, planner defaults, and security" },
        { id: "appearance", label: "Appearance", icon: Palette, description: "Theme and accent choices" },
        { id: "shortcuts", label: "Shortcuts", icon: Keyboard, description: "Keyboard flow and capture syntax" },
    ] as const;
    const activeSectionConfig = sections.find((section) => section.id === activeSection) ?? sections[0];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="flex h-[100dvh] w-[100vw] max-h-[100dvh] flex-col overflow-hidden rounded-none border-border/60 p-0 shadow-none sm:h-[88vh] sm:w-[95vw] sm:max-h-[88vh] sm:max-w-[1100px] sm:rounded-[1.35rem] lg:flex-row"
            >
                <DialogTitle className="sr-only">Settings</DialogTitle>
                <DialogDescription className="sr-only">
                    Manage your account, appearance, and shortcut preferences.
                </DialogDescription>

                <aside className="flex w-full flex-col border-b border-border/60 bg-background/35 lg:w-[15rem] lg:border-b-0 lg:border-r">
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
                        <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">Settings</h2>
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-lg border border-border/60 bg-background/60 p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent/80 hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <nav className="flex-1 space-y-0.5 p-2">
                        {sections.map((section) => {
                            const Icon = section.icon;
                            const active = activeSection === section.id;

                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => setActiveSection(section.id)}
                                    className={cn(
                                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150",
                                        active
                                            ? "bg-accent/70 text-foreground font-medium"
                                            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                                    )}
                                >
                                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                                    {section.label}
                                </button>
                            );
                        })}
                    </nav>

                </aside>

                <main className="min-h-0 flex-1 bg-background/45">
                    <ScrollArea className="h-full">
                        <div className="border-b border-border/50 px-5 py-4 sm:px-7 lg:px-10">
                            <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                                {activeSectionConfig.label}
                            </h3>
                        </div>
                        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-6 sm:px-7 sm:py-8 lg:px-10">
                            {activeSection === "account" ? <ProfileForm userId={userId} /> : null}
                            {activeSection === "appearance" ? <AppearanceSettings /> : null}
                            {activeSection === "shortcuts" ? <ShortcutsSettings /> : null}
                        </div>
                    </ScrollArea>
                </main>
            </DialogContent>
        </Dialog>
    );
}
