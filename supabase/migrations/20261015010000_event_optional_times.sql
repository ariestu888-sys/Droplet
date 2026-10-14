-- Event start and end times become optional: an event can be given just
-- dates. Without a start time it starts at the beginning of its first day;
-- without an end time it runs to the end of its last day.

alter table public.events
  add column has_start_time boolean not null default true,
  add column has_end_time boolean not null default true;

drop function public.create_event(uuid, text, text, timestamp, timestamp, text, text, text, text, text, integer, text, text);

create function public.create_event(
  org_id uuid,
  event_name text,
  event_type text,
  event_start_date date,
  event_end_date date,
  event_timezone text,
  event_start_time time default null,
  event_end_time time default null,
  event_address text default null,
  event_city text default null,
  event_postal_code text default null,
  event_country text default null,
  event_capacity integer default null,
  event_discord_url text default null,
  event_website_url text default null
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  starts_local timestamp := event_start_date + coalesce(event_start_time, time '00:00');
  ends_local timestamp := event_end_date + coalesce(event_end_time, time '23:59:59');
  ev public.events;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.is_org_admin(org_id) then
    raise exception 'Only owners and admins can create events' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = event_timezone) then
    raise exception 'Unknown time zone' using errcode = '22023';
  end if;
  if ends_local <= starts_local then
    raise exception 'The event must end after it starts' using errcode = '22023';
  end if;

  insert into public.events (
    organization_id, name, type_id, starts_at, ends_at, timezone, has_start_time, has_end_time,
    address, city, postal_code, country, capacity, discord_url, website_url, created_by
  )
  values (
    org_id,
    trim(event_name),
    public.resolve_event_type(event_type),
    starts_local at time zone event_timezone,
    ends_local at time zone event_timezone,
    event_timezone,
    event_start_time is not null,
    event_end_time is not null,
    nullif(trim(event_address), ''),
    nullif(trim(event_city), ''),
    nullif(upper(trim(event_postal_code)), ''),
    nullif(upper(trim(event_country)), ''),
    event_capacity,
    nullif(trim(event_discord_url), ''),
    nullif(trim(event_website_url), ''),
    auth.uid()
  )
  returning * into ev;

  return ev;
end;
$$;

revoke execute on function public.create_event(uuid, text, text, date, date, text, time, time, text, text, text, text, integer, text, text) from public, anon;
grant execute on function public.create_event(uuid, text, text, date, date, text, time, time, text, text, text, text, integer, text, text) to authenticated;
