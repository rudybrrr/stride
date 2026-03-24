"use client";

import { addDays, format, isValid, nextMonday, parseISO } from "date-fns";
import { CalendarDays, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

type PopoverAlign = "start" | "center" | "end";
type SmallScreenCalendarPlacement = "inline" | "left";

interface TaskDueDateMenuProps {
    value?: string | null;
    onChange: (value: string) => void;
    allowClear?: boolean;
    onClose?: () => void;
    smallScreenCalendarPlacement?: SmallScreenCalendarPlacement;
}

interface TaskDueDatePickerProps {
    id?: string;
    value?: string | null;
    onChange: (value: string) => void;
    placeholder?: string;
    allowClear?: boolean;
    disabled?: boolean;
    popoverAlign?: PopoverAlign;
    smallScreenCalendarPlacement?: SmallScreenCalendarPlacement;
    className?: string;
}

function getSelectedDate(value?: string | null) {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
}

export function TaskDueDateMenu({
    value = null,
    onChange,
    allowClear = false,
    onClose,
    smallScreenCalendarPlacement = "inline",
}: TaskDueDateMenuProps) {
    const selectedDate = useMemo(() => getSelectedDate(value), [value]);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [displayMonth, setDisplayMonth] = useState<Date>(selectedDate ?? new Date());
    const closeTimerRef = useRef<number | null>(null);
    const currentValue = value ?? "";
    const presets = useMemo(() => {
        const today = new Date();
        const tomorrow = addDays(today, 1);
        const nextWeek = nextMonday(today);

        return [
            {
                label: "Today",
                caption: format(today, "EEE, MMM d"),
                value: format(today, "yyyy-MM-dd"),
            },
            {
                label: "Tomorrow",
                caption: format(tomorrow, "EEE, MMM d"),
                value: format(tomorrow, "yyyy-MM-dd"),
            },
            {
                label: "Next week",
                caption: format(nextWeek, "EEE, MMM d"),
                value: format(nextWeek, "yyyy-MM-dd"),
            },
            ...(allowClear
                ? [{ label: "No date", caption: "Clear due date", value: "" }]
                : []),
        ];
    }, [allowClear]);

    useEffect(() => {
        if (!calendarOpen) return;
        setDisplayMonth(selectedDate ?? new Date());
    }, [calendarOpen, selectedDate]);

    useEffect(() => {
        return () => {
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current);
            }
        };
    }, []);

    function clearCloseTimer() {
        if (closeTimerRef.current === null) return;
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
    }

    function openCalendar() {
        clearCloseTimer();
        setCalendarOpen(true);
    }

    function queueCalendarClose() {
        clearCloseTimer();
        closeTimerRef.current = window.setTimeout(() => {
            setCalendarOpen(false);
            closeTimerRef.current = null;
        }, 140);
    }

    function apply(nextValue: string) {
        onChange(nextValue);
        clearCloseTimer();
        setCalendarOpen(false);
        onClose?.();
    }

    function renderCalendar() {
        return (
            <Calendar
                mode="single"
                selected={selectedDate}
                month={displayMonth}
                onMonthChange={setDisplayMonth}
                onSelect={(date) => {
                    if (!date) return;
                    apply(format(date, "yyyy-MM-dd"));
                }}
                className="rounded-lg bg-transparent p-0 [--cell-size:2.55rem]"
                classNames={{
                    month_caption: "flex h-9 items-center justify-center px-10 text-sm",
                    weekday: "flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
                    week: "mt-1 flex w-full",
                    day: "group/day relative aspect-square flex-1 p-0.5 text-center select-none",
                }}
            />
        );
    }

    return (
        <div
            className="relative w-[16.5rem]"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={queueCalendarClose}
            onBlurCapture={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                clearCloseTimer();
                setCalendarOpen(false);
            }}
        >
            <div className="space-y-1">
                {presets.map((option) => {
                    const active = currentValue === option.value;

                    return (
                        <button
                            key={option.label}
                            type="button"
                            onClick={() => apply(option.value)}
                            className={cn(
                                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors",
                                active
                                    ? "bg-accent text-accent-foreground"
                                    : "text-foreground hover:bg-secondary",
                            )}
                        >
                            <div className="min-w-0">
                                <div className="text-sm font-medium">{option.label}</div>
                                <div className="text-xs text-muted-foreground">{option.caption}</div>
                            </div>
                            {active ? (
                                <span className="h-2 w-2 rounded-full bg-primary" />
                            ) : null}
                        </button>
                    );
                })}

                <div
                    className="relative"
                    onMouseEnter={openCalendar}
                    onFocusCapture={openCalendar}
                >
                    <button
                        type="button"
                        onClick={openCalendar}
                        className={cn(
                            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors",
                            calendarOpen
                                ? "bg-accent text-accent-foreground"
                                : "text-foreground hover:bg-secondary",
                        )}
                    >
                        <div>
                            <div className="text-sm font-medium">Pick date...</div>
                            <div className="text-xs text-muted-foreground">Choose any day from the calendar</div>
                        </div>
                        <ChevronRight className="h-4 w-4" />
                        </button>
                </div>
            </div>

            {calendarOpen ? (
                <>
                    {smallScreenCalendarPlacement === "inline" ? (
                        <div className="mt-2 rounded-xl border border-border bg-popover p-2.5 text-popover-foreground shadow-[0_18px_36px_rgba(17,18,15,0.16)] lg:hidden">
                            {renderCalendar()}
                        </div>
                    ) : (
                        <div className="absolute top-0 right-full z-10 rounded-xl border border-border bg-popover p-2.5 text-popover-foreground shadow-[0_18px_36px_rgba(17,18,15,0.16)] origin-right motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-right-1 lg:hidden">
                            {renderCalendar()}
                        </div>
                    )}

                    <div className="absolute top-0 left-full z-10 hidden rounded-xl border border-border bg-popover p-2.5 text-popover-foreground shadow-[0_18px_36px_rgba(17,18,15,0.16)] origin-left motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-left-1 lg:block">
                        {renderCalendar()}
                    </div>
                </>
            ) : null}
        </div>
    );
}

export function TaskDueDatePicker({
    id,
    value = "",
    onChange,
    placeholder = "Choose date",
    allowClear = false,
    disabled = false,
    popoverAlign = "start",
    smallScreenCalendarPlacement = "inline",
    className,
}: TaskDueDatePickerProps) {
    const [open, setOpen] = useState(false);
    const selectedDate = useMemo(() => getSelectedDate(value), [value]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    id={id}
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "border-input focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-11 w-full items-center justify-between gap-3 rounded-lg border bg-card px-3.5 text-left text-sm outline-none transition-[color,box-shadow,border-color,background-color] focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                        className,
                    )}
                >
                    <span className="inline-flex min-w-0 items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className={cn("truncate", selectedDate ? "text-foreground" : "text-muted-foreground")}>
                            {selectedDate ? format(selectedDate, "dd MMM yyyy") : placeholder}
                        </span>
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent align={popoverAlign} className="w-auto rounded-xl border border-border p-2.5">
                <TaskDueDateMenu
                    value={value}
                    onChange={onChange}
                    allowClear={allowClear}
                    onClose={() => setOpen(false)}
                    smallScreenCalendarPlacement={smallScreenCalendarPlacement}
                />
            </PopoverContent>
        </Popover>
    );
}
