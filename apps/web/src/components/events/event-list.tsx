import Link from "next/link";
import type { DropletEvent } from "@droplet/shared";
import { VisibilityBadge } from "@/components/events/visibility";
import { CalendarIcon, MapPinIcon } from "@/components/icons";
import { eventDateBadge, formatEventRange, groupEventsByTime, type EventStatus } from "@/lib/event-dates";

// An organization's events: happening now and upcoming first, then past.
export function EventList({ events, emptyAction }: { events: DropletEvent[]; emptyAction?: React.ReactNode }) {
  const { current, past } = groupEventsByTime(events);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-field border-2 border-dashed border-line px-6 py-8 text-center">
        <div className="dr-icon-circle bg-droplet-tint text-droplet">
          <CalendarIcon size={22} />
        </div>
        <p className="font-bold">No events yet</p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {current.length > 0 ? (
        <EventRows events={current} />
      ) : (
        <p className="text-sm text-subtle">No upcoming events.</p>
      )}
      {past.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold tracking-[0.04em] text-subtle uppercase">Past events</h3>
          <EventRows events={past} />
        </div>
      )}
    </div>
  );
}

function EventRows({ events }: { events: { event: DropletEvent; status: EventStatus }[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {events.map(({ event, status }) => {
        const badge = eventDateBadge(event.startsAt, event.timezone);
        return (
          <li key={event.id}>
            <Link
              href={`/events/${event.id}`}
              className={`flex items-center gap-3.5 rounded-field border-2 border-line-soft p-3 transition-colors hover:border-droplet-tint-border hover:bg-hover ${status === "past" ? "opacity-70" : ""}`}
            >
              <div className="flex w-12 shrink-0 flex-col items-center rounded-field bg-droplet-tint py-1.5 text-droplet">
                <span className="text-[10.5px] font-bold tracking-[0.06em]">{badge.month}</span>
                <span className="font-display text-xl leading-none font-bold">{badge.day}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold">
                  <span className="truncate">{event.name}</span>
                  {event.visibility !== "public" && <VisibilityBadge visibility={event.visibility} />}
                  {status === "live" && (
                    <span className="dr-badge shrink-0 bg-coral-tint text-[#b8321f]">
                      <span className="dr-live-dot bg-coral" />
                      Live
                    </span>
                  )}
                </p>
                <p className="truncate text-[12.5px] text-muted">
                  {event.type} · {formatEventRange(event)}
                </p>
                {event.city && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-subtle">
                    <MapPinIcon size={12} className="shrink-0" />
                    {event.city}
                  </p>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
