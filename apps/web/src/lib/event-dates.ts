// Formats event times in the event's own time zone.

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
};

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTIONS,
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

type EventTimes = {
  startsAt: string;
  endsAt: string;
  timezone: string;
  hasStartTime: boolean;
  hasEndTime: boolean;
};

// e.g. "Sat, Oct 3, 2026, 9:00 AM – Mon, Oct 5, 2026, 6:00 PM CDT", or just
// "Sat, Oct 3 – Mon, Oct 5, 2026" when no times were given.
export function formatEventRange({ startsAt, endsAt, timezone, hasStartTime, hasEndTime }: EventTimes) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (hasStartTime === hasEndTime) {
    const options = hasStartTime ? DATE_TIME_OPTIONS : DATE_OPTIONS;
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: timezone }).formatRange(start, end);
  }

  // Only one side has a time: format each side on its own.
  const format = (date: Date, withTime: boolean) =>
    new Intl.DateTimeFormat("en-US", { ...(withTime ? DATE_TIME_OPTIONS : DATE_OPTIONS), timeZone: timezone }).format(date);
  return `${format(start, hasStartTime)} – ${format(end, hasEndTime)}`;
}

// Month and day for a calendar-style badge, e.g. { month: "OCT", day: "3" }.
export function eventDateBadge(startsAt: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).formatToParts(new Date(startsAt));
  return {
    month: parts.find((p) => p.type === "month")?.value.toUpperCase() ?? "",
    day: parts.find((p) => p.type === "day")?.value ?? "",
  };
}

export type EventStatus = "upcoming" | "live" | "past";

export function eventStatus(startsAt: string, endsAt: string, now = Date.now()): EventStatus {
  if (now >= new Date(endsAt).getTime()) return "past";
  if (now >= new Date(startsAt).getTime()) return "live";
  return "upcoming";
}

// Splits events (sorted soonest first) into happening-now-or-upcoming and
// past (most recent first), tagging each with its status. Server-side only:
// call it on a per-request render.
export function groupEventsByTime<E extends { startsAt: string; endsAt: string }>(events: E[]) {
  const now = Date.now();
  const withStatus = events.map((event) => ({ event, status: eventStatus(event.startsAt, event.endsAt, now) }));
  return {
    current: withStatus.filter((e) => e.status !== "past"),
    past: withStatus.filter((e) => e.status === "past").reverse(),
  };
}
