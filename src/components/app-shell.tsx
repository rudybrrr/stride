"use client";

import {
    BarChart3,
    CalendarRange,
    CheckSquare2,
    ChevronLeft,
    ChevronRight,
    FolderKanban,
    Home,
    Inbox,
    LogOut,
    Menu,
    Moon,
    MoonStar,
    Plus,
    Settings,
    Sun,
    Users,
} from "lucide-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";

import { ProjectDialog } from "~/components/project-dialog";
import { QuickAddDialog } from "~/components/quick-add-dialog";
import { WorkspaceDataProvider, useTaskDataset } from "~/hooks/use-task-dataset";
import { useData } from "~/components/data-provider";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import { getPublicAvatarUrl } from "~/lib/avatar";
import { getProjectColorClasses, getProjectIcon } from "~/lib/project-appearance";
import { createSupabaseBrowserClient } from "~/lib/supabase/browser";
import { resolveThemeSelection } from "~/lib/theme-options";
import { cn } from "~/lib/utils";

interface ShellActionsContextValue {
    openQuickAdd: (defaults?: { listId?: string | null; title?: string; dueDate?: string | null }) => void;
}

const ShellActionsContext = createContext<ShellActionsContextValue | undefined>(undefined);

const SIDEBAR_COLLAPSED_STORAGE_KEY = "shell-sidebar-collapsed";
const SIDEBAR_HOVER_PREVIEW_DELAY_MS = 120;
const SIDEBAR_HOVER_PREVIEW_CLOSE_DELAY_MS = 160;
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = "4.25rem";
const DESKTOP_SIDEBAR_PREVIEW_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const PRIMARY_ITEMS = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/tasks", label: "Tasks", icon: CheckSquare2 },
    { href: "/calendar", label: "Calendar", icon: CalendarRange },
    { href: "/projects", label: "Projects", icon: FolderKanban },
] as const;

const SMART_VIEW_ITEMS = [
    { href: "/tasks?view=today", value: "today", label: "Today", icon: CheckSquare2 },
    { href: "/tasks?view=upcoming", value: "upcoming", label: "Upcoming", icon: CalendarRange },
    { href: "/tasks?view=inbox", value: "inbox", label: "No Due Date", icon: Inbox },
] as const;

function getActiveSmartView(pathname: string, rawView: string | null) {
    if (pathname !== "/tasks") return null;
    if (rawView === "upcoming" || rawView === "inbox") {
        return rawView;
    }
    return "today";
}

export function useShellActions() {
    const context = useContext(ShellActionsContext);
    if (!context) {
        throw new Error("useShellActions must be used within AppShell.");
    }
    return context;
}

export function AppShell({ children }: { children: ReactNode }) {
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [quickAddDefaults, setQuickAddDefaults] = useState<{ listId?: string | null; title?: string; dueDate?: string | null } | null>(null);

    const contextValue: ShellActionsContextValue = {
        openQuickAdd(defaults) {
            setQuickAddDefaults(defaults ?? null);
            setQuickAddOpen(true);
        },
    };

    return (
        <ShellActionsContext.Provider value={contextValue}>
            <WorkspaceDataProvider>
                <AppShellLayout
                    quickAddOpen={quickAddOpen}
                    quickAddDefaults={quickAddDefaults}
                    onQuickAddOpenChange={setQuickAddOpen}
                    onOpenQuickAdd={contextValue.openQuickAdd}
                >
                    {children}
                </AppShellLayout>
            </WorkspaceDataProvider>
        </ShellActionsContext.Provider>
    );
}

function AppShellLayout({
    children,
    quickAddOpen,
    quickAddDefaults,
    onQuickAddOpenChange,
    onOpenQuickAdd,
}: {
    children: ReactNode;
    quickAddOpen: boolean;
    quickAddDefaults: { listId?: string | null; title?: string; dueDate?: string | null } | null;
    onQuickAddOpenChange: (open: boolean) => void;
    onOpenQuickAdd: ShellActionsContextValue["openQuickAdd"];
}) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile, userId } = useData();
    const { orderedProjectSummaries, saveProjectOrder, smartViewCounts } = useTaskDataset();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const { resolvedTheme, setTheme, theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [desktopCollapsed, setDesktopCollapsed] = useState(false);
    const [desktopPreviewOpen, setDesktopPreviewOpen] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [projectDialogOpen, setProjectDialogOpen] = useState(false);
    const suppressProjectClickRef = useRef(false);
    const hoverPreviewTimerRef = useRef<number | null>(null);

    const activeSmartView = getActiveSmartView(pathname, searchParams.get("view"));
    const activeProjectId = pathname.startsWith("/projects/") ? pathname.split("/")[2] ?? null : null;
    const avatarUrl = getPublicAvatarUrl(supabase, profile?.avatar_url);
    const activeTheme = resolveThemeSelection(theme, resolvedTheme);

    useEffect(() => {
        setMounted(true);

        const savedCollapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
        if (savedCollapsed === "true") {
            setDesktopCollapsed(true);
        }
    }, []);

    useEffect(() => {
        return () => {
            if (hoverPreviewTimerRef.current !== null) {
                window.clearTimeout(hoverPreviewTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!desktopCollapsed) {
            if (hoverPreviewTimerRef.current !== null) {
                window.clearTimeout(hoverPreviewTimerRef.current);
                hoverPreviewTimerRef.current = null;
            }
            setDesktopPreviewOpen(false);
        }
    }, [desktopCollapsed]);

    function clearHoverPreviewTimer() {
        if (hoverPreviewTimerRef.current !== null) {
            window.clearTimeout(hoverPreviewTimerRef.current);
            hoverPreviewTimerRef.current = null;
        }
    }

    function setCollapsedState(nextValue: boolean) {
        clearHoverPreviewTimer();
        setDesktopPreviewOpen(false);
        setDesktopCollapsed(nextValue);
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(nextValue));
    }

    function openDesktopPreview() {
        clearHoverPreviewTimer();
        if (desktopPreviewOpen) return;
        setDesktopPreviewOpen(true);
    }

    function closeDesktopPreview() {
        setDesktopPreviewOpen(false);
    }

    function handleDesktopSidebarMouseEnter() {
        if (!desktopCollapsed) return;
        clearHoverPreviewTimer();
        hoverPreviewTimerRef.current = window.setTimeout(() => {
            openDesktopPreview();
            hoverPreviewTimerRef.current = null;
        }, SIDEBAR_HOVER_PREVIEW_DELAY_MS);
    }

    function handleDesktopSidebarMouseLeave() {
        if (!desktopCollapsed) return;
        clearHoverPreviewTimer();
        hoverPreviewTimerRef.current = window.setTimeout(() => {
            closeDesktopPreview();
            hoverPreviewTimerRef.current = null;
        }, SIDEBAR_HOVER_PREVIEW_CLOSE_DELAY_MS);
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        router.push("/login");
    }

    function handleNavigate(href: string) {
        router.push(href);
        setMobileSidebarOpen(false);
    }

    function handleProjectDragEnd(result: DropResult) {
        suppressProjectClickRef.current = true;
        window.setTimeout(() => {
            suppressProjectClickRef.current = false;
        }, 140);

        if (!result.destination || result.destination.index === result.source.index) {
            return;
        }

        const nextProjectIds = orderedProjectSummaries.map((summary) => summary.list.id);
        const [movedProjectId] = nextProjectIds.splice(result.source.index, 1);
        if (!movedProjectId) return;

        nextProjectIds.splice(result.destination.index, 0, movedProjectId);
        saveProjectOrder(nextProjectIds);
    }

    function renderProfileMenuContent() {
        return (
            <DropdownMenuContent align="end" className="w-72 rounded-2xl">
                <DropdownMenuItem asChild className="rounded-xl px-3 py-2">
                    <Link href="/progress">
                        <BarChart3 className="h-4 w-4" />
                        Progress
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl px-3 py-2">
                    <Link href="/community">
                        <Users className="h-4 w-4" />
                        Community
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl px-3 py-2">
                    <Link href="/tasks?view=done">
                        <CheckSquare2 className="h-4 w-4" />
                        Completed Tasks
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl px-3 py-2">
                    <Link href="/settings">
                        <Settings className="h-4 w-4" />
                        Settings
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Theme
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup value={activeTheme} onValueChange={(value) => setTheme(value)}>
                    <DropdownMenuRadioItem value="light" className="rounded-xl px-3 py-2">
                        <Sun className="h-4 w-4" />
                        Light
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark" className="rounded-xl px-3 py-2">
                        <Moon className="h-4 w-4" />
                        Dark
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="midnight" className="rounded-xl px-3 py-2">
                        <MoonStar className="h-4 w-4" />
                        Midnight
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="rounded-xl px-3 py-2" onClick={() => void handleLogout()}>
                    <LogOut className="h-4 w-4" />
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        );
    }

    function renderProjectLinks(options: { collapsed: boolean; mobile: boolean }) {
        const { collapsed, mobile } = options;

        if (collapsed) {
            return (
                <nav className="space-y-2">
                    {orderedProjectSummaries.slice(0, 8).map((summary) => {
                        const active = activeProjectId === summary.list.id;
                        const palette = getProjectColorClasses(summary.list.color_token);
                        const Icon = getProjectIcon(summary.list.icon_token);

                        return (
                            <button
                                key={summary.list.id}
                                type="button"
                                title={summary.list.name}
                                onClick={() => handleNavigate(`/projects/${summary.list.id}`)}
                                className={cn(
                                    "group mx-auto flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200",
                                    active
                                        ? "bg-sidebar-accent/85 shadow-[0_10px_24px_rgba(15,23,42,0.16)] ring-1 ring-sidebar-border/70"
                                        : "hover:bg-sidebar-accent/60",
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
                                        palette.soft,
                                        active ? cn("border", palette.border) : "opacity-80 group-hover:opacity-100 group-hover:scale-[1.04]",
                                    )}
                                >
                                    <Icon className={cn("h-4 w-4", palette.text, !active && "opacity-90")} />
                                </span>
                                <span className="sr-only">{summary.list.name}</span>
                            </button>
                        );
                    })}
                </nav>
            );
        }

        const content = (
            <nav className="space-y-1">
                {orderedProjectSummaries.map((summary, index) => {
                    const active = activeProjectId === summary.list.id;
                    const palette = getProjectColorClasses(summary.list.color_token);
                    const Icon = getProjectIcon(summary.list.icon_token);

                    return (
                        <Draggable key={summary.list.id} draggableId={summary.list.id} index={index}>
                            {(draggableProvided, snapshot) => (
                                <div
                                    ref={draggableProvided.innerRef}
                                    {...draggableProvided.draggableProps}
                                    {...draggableProvided.dragHandleProps}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Open or reorder ${summary.list.name}`}
                                    onClick={() => {
                                        if (suppressProjectClickRef.current) return;
                                        handleNavigate(`/projects/${summary.list.id}`);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key !== "Enter" && event.key !== " ") return;
                                        event.preventDefault();
                                        if (suppressProjectClickRef.current) return;
                                        handleNavigate(`/projects/${summary.list.id}`);
                                    }}
                                    style={draggableProvided.draggableProps.style}
                                    className={cn(
                                        "flex w-full cursor-grab items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors active:cursor-grabbing",
                                        active
                                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                            : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                                        snapshot.isDragging && "bg-sidebar-accent/80 shadow-sm",
                                    )}
                                >
                                    <span className={cn("pointer-events-none h-2.5 w-2.5 rounded-full", palette.accent)} />
                                    <Icon className={cn("pointer-events-none h-4 w-4 shrink-0", active ? palette.text : "text-muted-foreground")} />
                                    <span className="pointer-events-none min-w-0 flex-1 truncate">{summary.list.name}</span>
                                    <span className="pointer-events-none font-mono text-[11px] text-muted-foreground">
                                        {summary.incompleteCount}
                                    </span>
                                </div>
                            )}
                        </Draggable>
                    );
                })}
            </nav>
        );

        if (!mounted) {
            return (
                <nav className="space-y-1">
                    {orderedProjectSummaries.map((summary) => {
                        const active = activeProjectId === summary.list.id;
                        const palette = getProjectColorClasses(summary.list.color_token);
                        const Icon = getProjectIcon(summary.list.icon_token);

                        return (
                            <button
                                key={summary.list.id}
                                type="button"
                                onClick={() => handleNavigate(`/projects/${summary.list.id}`)}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                                    active
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                                )}
                            >
                                <span className={cn("h-2.5 w-2.5 rounded-full", palette.accent)} />
                                <Icon className={cn("h-4 w-4 shrink-0", active ? palette.text : "text-muted-foreground")} />
                                <span className="min-w-0 flex-1 truncate">{summary.list.name}</span>
                                <span className="font-mono text-[11px] text-muted-foreground">{summary.incompleteCount}</span>
                            </button>
                        );
                    })}
                </nav>
            );
        }

        return (
            <DragDropContext
                onDragStart={() => {
                    suppressProjectClickRef.current = true;
                }}
                onDragEnd={handleProjectDragEnd}
            >
                <Droppable droppableId={mobile ? "mobile-sidebar-projects" : "desktop-sidebar-projects"}>
                    {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps}>
                            {content}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        );
    }

    function renderSidebarContent(options: { collapsed: boolean; mobile: boolean; previewing?: boolean }) {
        const { collapsed, mobile, previewing = false } = options;

        return (
            <div className="flex h-full w-full flex-col bg-sidebar">
                <div className={cn("border-b border-sidebar-border", collapsed ? "px-2 py-4" : "px-4 py-4")}>
                    {collapsed ? (
                        <div className="flex flex-col items-center gap-4">
                            <Link
                                href="/home"
                                title="Stride home"
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-sidebar-border/80 bg-sidebar-accent/80 text-sm font-semibold tracking-[-0.05em] text-sidebar-foreground shadow-[0_10px_24px_rgba(15,23,42,0.16)] transition-transform duration-200 hover:-translate-y-px"
                            >
                                <span aria-hidden="true">S</span>
                                <span className="sr-only">Stride home</span>
                            </Link>

                            <button
                                type="button"
                                onClick={() => {
                                    onOpenQuickAdd();
                                    if (mobile) setMobileSidebarOpen(false);
                                }}
                                title="Quick add"
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_26px_rgba(15,23,42,0.2)] transition-[background-color,box-shadow,transform] duration-200 hover:bg-primary/94 motion-safe:hover:-translate-y-px"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="sr-only">Quick Add</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <Link href="/home" className="min-w-0 text-lg font-semibold tracking-[-0.03em] text-sidebar-foreground">
                                    Stride
                                </Link>

                                {mobile ? null : (
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => setCollapsedState(!desktopCollapsed)}
                                        title={previewing ? "Keep sidebar open" : "Collapse sidebar"}
                                        className={cn(
                                            "text-muted-foreground",
                                            previewing && "rounded-full border border-sidebar-border/70 hover:border-sidebar-border hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
                                        )}
                                    >
                                        {previewing ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                                        <span className="sr-only">{previewing ? "Keep sidebar open" : "Collapse sidebar"}</span>
                                    </Button>
                                )}
                            </div>

                            <Button
                                className="mt-4 w-full justify-start"
                                size="default"
                                onClick={() => {
                                    onOpenQuickAdd();
                                    if (mobile) setMobileSidebarOpen(false);
                                }}
                                title="Quick add"
                            >
                                <Plus className="h-4 w-4" />
                                Quick Add
                            </Button>
                        </>
                    )}
                </div>

                <div className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
                    <div className={cn("space-y-6", collapsed && "space-y-5")}>
                        <nav className="space-y-1">
                            {PRIMARY_ITEMS.map((item) => {
                                const active = item.href === "/projects"
                                    ? pathname === item.href || pathname.startsWith("/projects/")
                                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                                return (
                                    <button
                                        key={item.href}
                                        type="button"
                                        onClick={() => handleNavigate(item.href)}
                                        title={collapsed ? item.label : undefined}
                                        className={cn(
                                            "flex w-full items-center rounded-xl text-sm font-medium transition-colors",
                                            collapsed ? "mx-auto h-10 w-10 justify-center rounded-2xl px-0" : "gap-3 px-3 py-2.5",
                                            active
                                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                                : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                                        )}
                                    >
                                        <item.icon className="h-4.5 w-4.5 shrink-0" />
                                        {collapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
                                    </button>
                                );
                            })}
                        </nav>

                        {!collapsed ? (
                            <div className="space-y-2">
                                <div className="px-3">
                                    <p className="eyebrow">Views</p>
                                </div>
                                <nav className="space-y-1">
                                    {SMART_VIEW_ITEMS.map((item) => {
                                        const active = activeSmartView === item.value;
                                        const count = smartViewCounts[item.value];
                                        return (
                                            <button
                                                key={item.value}
                                                type="button"
                                                onClick={() => handleNavigate(item.href)}
                                                className={cn(
                                                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                                                    active
                                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                                        : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                                                )}
                                            >
                                                <span className="flex items-center gap-3">
                                                    <item.icon className="h-4 w-4" />
                                                    <span>{item.label}</span>
                                                </span>
                                                <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </nav>
                            </div>
                        ) : null}

                        <div className="space-y-2">
                            {!collapsed ? (
                                <div className="flex items-center justify-between px-3">
                                    <p className="eyebrow">Projects</p>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setProjectDialogOpen(true)}
                                            className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                                        >
                                            + New
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleNavigate("/projects")}
                                            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            Manage
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => setProjectDialogOpen(true)}
                                        title="New project"
                                        className="rounded-full text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span className="sr-only">New project</span>
                                    </Button>
                                </div>
                            )}
                            {renderProjectLinks({ collapsed, mobile })}
                        </div>
                    </div>
                </div>

                <div className={cn("border-t border-sidebar-border py-3", collapsed ? "px-2" : "px-3")}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "flex w-full items-center rounded-xl transition-colors hover:bg-sidebar-accent/70",
                                    collapsed ? "mx-auto h-11 w-11 justify-center rounded-full px-0" : "gap-3 px-3 py-2.5 text-left",
                                )}
                            >
                                <Avatar className={cn("border border-border/60", collapsed ? "h-9 w-9" : "h-10 w-10")}>
                                    <AvatarImage src={avatarUrl ?? ""} alt={profile?.username ?? "User"} />
                                    <AvatarFallback className="bg-primary/12 text-primary">
                                        {profile?.username?.slice(0, 1).toUpperCase() ?? "S"}
                                    </AvatarFallback>
                                </Avatar>
                                {collapsed ? <span className="sr-only">Open account menu</span> : (
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                            {profile?.username ?? "Profile"}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">Progress, settings, appearance</p>
                                    </div>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                        {renderProfileMenuContent()}
                    </DropdownMenu>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {desktopCollapsed ? (
                <>
                    <aside
                        onMouseEnter={handleDesktopSidebarMouseEnter}
                        onMouseLeave={handleDesktopSidebarMouseLeave}
                        className="fixed inset-y-0 left-0 z-30 hidden w-[4.25rem] overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex"
                    >
                        {renderSidebarContent({ collapsed: true, mobile: false })}
                    </aside>

                    <aside
                        onMouseEnter={handleDesktopSidebarMouseEnter}
                        onMouseLeave={handleDesktopSidebarMouseLeave}
                        className={cn(
                            "fixed inset-y-0 left-0 z-40 hidden w-72 overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex",
                            desktopPreviewOpen
                                ? "pointer-events-auto shadow-[0_22px_52px_rgba(15,23,42,0.2)]"
                                : "pointer-events-none shadow-none",
                        )}
                        style={{
                            clipPath: desktopPreviewOpen
                                ? "inset(0 0 0 0)"
                                : `inset(0 calc(100% - ${DESKTOP_SIDEBAR_COLLAPSED_WIDTH}) 0 0)`,
                            opacity: desktopPreviewOpen ? 1 : 0,
                            transition: [
                                `clip-path 320ms ${DESKTOP_SIDEBAR_PREVIEW_EASING}`,
                                "opacity 180ms ease-out",
                                `box-shadow 320ms ${DESKTOP_SIDEBAR_PREVIEW_EASING}`,
                            ].join(", "),
                            willChange: "clip-path, opacity, box-shadow",
                        }}
                    >
                        <div
                            className="h-full w-72"
                            style={{
                                opacity: desktopPreviewOpen ? 1 : 0.84,
                                transform: desktopPreviewOpen ? "translateX(0)" : "translateX(-8px)",
                                transition: [
                                    `transform 340ms ${DESKTOP_SIDEBAR_PREVIEW_EASING}`,
                                    "opacity 180ms ease-out",
                                ].join(", "),
                                willChange: "transform, opacity",
                            }}
                        >
                            {renderSidebarContent({ collapsed: false, mobile: false, previewing: true })}
                        </div>
                    </aside>
                </>
            ) : (
                <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex">
                    {renderSidebarContent({ collapsed: false, mobile: false })}
                </aside>
            )}

            <main className={cn("transition-[padding-left] duration-200", desktopCollapsed ? "lg:pl-[4.25rem]" : "lg:pl-72")}>
                {children}
            </main>

            {userId ? (
                <>
                    <div className="fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-30 lg:hidden">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setMobileSidebarOpen(true)}
                            className="rounded-full border-border/70 bg-card/95 shadow-[0_10px_24px_rgba(15,23,42,0.14)] backdrop-blur"
                        >
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Open navigation</span>
                        </Button>
                    </div>

                    <div className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-30 lg:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-card/95 shadow-[0_10px_24px_rgba(15,23,42,0.14)] backdrop-blur">
                                    <Avatar className="h-9 w-9 border border-border/60">
                                        <AvatarImage src={avatarUrl ?? ""} alt={profile?.username ?? "User"} />
                                        <AvatarFallback className="bg-primary/12 text-primary">
                                            {profile?.username?.slice(0, 1).toUpperCase() ?? "S"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="sr-only">Open account menu</span>
                                </button>
                            </DropdownMenuTrigger>
                            {renderProfileMenuContent()}
                        </DropdownMenu>
                    </div>

                    <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                        <SheetContent
                            side="left"
                            showCloseButton={false}
                            className="w-[86vw] max-w-[22rem] border-r border-sidebar-border bg-sidebar p-0"
                        >
                            {renderSidebarContent({ collapsed: false, mobile: true })}
                        </SheetContent>
                    </Sheet>
                </>
            ) : null}

            <QuickAddDialog
                open={quickAddOpen}
                defaults={quickAddDefaults}
                onOpenChange={onQuickAddOpenChange}
            />
            <ProjectDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen} />
        </div>
    );
}
