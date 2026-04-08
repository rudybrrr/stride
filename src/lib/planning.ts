import {
  addDays,
  differenceInMinutes,
  format,
  isValid,
  parseISO,
  setHours,
  startOfDay,
  startOfWeek,
} from "date-fns";

export type PlannerView = "month" | "week";

export const WEEK_STARTS_ON = 1 as const;
export const PLANNER_DAY_START_HOUR = 7;
export const PLANNER_DAY_END_HOUR = 22;
export const PLANNER_HOUR_ROW_HEIGHT = 56;

function parsePlannerDate(raw: string | null | undefined) {
  if (!raw) return startOfDay(new Date());

  const parsed = parseISO(raw);
  return isValid(parsed) ? startOfDay(parsed) : startOfDay(new Date());
}

export function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function getWeekDays(anchorDate: Date) {
  const start = startOfWeek(anchorDate, { weekStartsOn: WEEK_STARTS_ON });
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function getPlannerHours(
  startHour = PLANNER_DAY_START_HOUR,
  endHour = PLANNER_DAY_END_HOUR,
) {
  return Array.from({ length: Math.max(0, endHour - startHour) }, (_, index) => startHour + index);
}

export function formatPlannerHourLabel(hour: number) {
  return format(setHours(startOfDay(new Date()), hour), "HH:mm");
}

export function getPlannerRangeLabel(view: PlannerView, anchorDate: Date) {
  if (view === "month") {
    return format(anchorDate, "MMMM yyyy");
  }

  const start = startOfWeek(anchorDate, { weekStartsOn: WEEK_STARTS_ON });
  const end = addDays(start, 6);
  return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
}

export function combineDateAndTime(dateKey: string, time: string) {
  const baseDate = parsePlannerDate(dateKey);
  const [hoursString = "09", minutesString = "00"] = time.split(":");
  const hours = Number.parseInt(hoursString, 10);
  const minutes = Number.parseInt(minutesString, 10);

  baseDate.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return baseDate;
}

export function getPlannerDayMinuteRange(
  startHour = PLANNER_DAY_START_HOUR,
  endHour = PLANNER_DAY_END_HOUR,
) {
  return Math.max(0, endHour - startHour) * 60;
}

export function getPlannerMinutesFromDate(
  value: string | Date,
  startHour = PLANNER_DAY_START_HOUR,
) {
  const date = value instanceof Date ? value : new Date(value);
  return (date.getHours() - startHour) * 60 + date.getMinutes();
}

export function getDurationMinutes(startIso: string, endIso: string) {
  return Math.max(1, differenceInMinutes(new Date(endIso), new Date(startIso)));
}

export function formatBlockTimeRange(startIso: string, endIso: string) {
  return `${format(new Date(startIso), "h:mm a")} - ${format(new Date(endIso), "h:mm a")}`;
}

export function formatMinutesCompact(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  }

  return `${minutes}m`;
}
