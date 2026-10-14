-- Editing and deleting events (organizers: owners and admins).

-- Replaces an event's details, including its visibility. Dates and times are
-- local to the event's time zone, with optional times as in create_event.
create or replace function public.update_event(
  target_event_id uuid,
  event_name text,
  event_type text,
  event_start_date date,
  event_end_date date,
  event_timezone text,
  event_visibility text,
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
  org_ref uuid;
  ev public.events;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select e.organization_id into org_ref from public.events e where e.id = target_event_id;
  if org_ref is null or not public.is_org_admin(org_ref) then
    raise exception 'Only organizers can edit this event' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = event_timezone) then
    raise exception 'Unknown time zone' using errcode = '22023';
  end if;
  if ends_local <= starts_local then
    raise exception 'The event must end after it starts' using errcode = '22023';
  end if;
  if event_visibility is null or event_visibility not in ('public', 'private', 'hidden') then
    raise exception 'Visibility must be public, private or hidden' using errcode = '22023';
  end if;

  update public.events set
    name = trim(event_name),
    type_id = public.resolve_event_type(event_type),
    starts_at = starts_local at time zone event_timezone,
    ends_at = ends_local at time zone event_timezone,
    timezone = event_timezone,
    has_start_time = event_start_time is not null,
    has_end_time = event_end_time is not null,
    visibility = event_visibility,
    address = nullif(trim(event_address), ''),
    city = nullif(trim(event_city), ''),
    postal_code = nullif(upper(trim(event_postal_code)), ''),
    country = nullif(upper(trim(event_country)), ''),
    capacity = event_capacity,
    discord_url = nullif(trim(event_discord_url), ''),
    website_url = nullif(trim(event_website_url), '')
  where id = target_event_id
  returning * into ev;

  return ev;
end;
$$;

revoke execute on function public.update_event(uuid, text, text, date, date, text, text, time, time, text, text, text, text, integer, text, text) from public, anon;
grant execute on function public.update_event(uuid, text, text, date, date, text, text, time, time, text, text, text, text, integer, text, text) to authenticated;

-- Permanently deletes an event.
create or replace function public.delete_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_ref uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select e.organization_id into org_ref from public.events e where e.id = target_event_id;
  if org_ref is null or not public.is_org_admin(org_ref) then
    raise exception 'Only organizers can delete this event' using errcode = '42501';
  end if;

  delete from public.events where id = target_event_id;
end;
$$;

revoke execute on function public.delete_event(uuid) from public, anon;
grant execute on function public.delete_event(uuid) to authenticated;
