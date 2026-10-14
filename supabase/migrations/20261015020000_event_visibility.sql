-- Event visibility, chosen when an event is created:
--   public:  the organization's members can see it and sign up.
--   private: members can see it; signing up is by invitation only.
--   hidden:  only organizers (owners and admins) can see it. For events
--            still being planned.

alter table public.events
  add column visibility text not null default 'public'
    check (visibility in ('public', 'private', 'hidden'));

-- Members see public and private events; organizers also see hidden ones.
drop policy "Organization members can view events" on public.events;

create policy "Members can view events; organizers also see hidden ones"
  on public.events for select to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = events.organization_id
        and m.user_id = (select auth.uid())
        and (events.visibility <> 'hidden' or m.role in ('owner', 'admin'))
    )
  );

drop function public.create_event(uuid, text, text, date, date, text, time, time, text, text, text, text, integer, text, text);

create function public.create_event(
  org_id uuid,
  event_name text,
  event_type text,
  event_start_date date,
  event_end_date date,
  event_timezone text,
  event_visibility text default 'public',
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
  if event_visibility is null or event_visibility not in ('public', 'private', 'hidden') then
    raise exception 'Visibility must be public, private or hidden' using errcode = '22023';
  end if;

  insert into public.events (
    organization_id, name, type_id, starts_at, ends_at, timezone, has_start_time, has_end_time, visibility,
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
    event_visibility,
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

revoke execute on function public.create_event(uuid, text, text, date, date, text, text, time, time, text, text, text, text, integer, text, text) from public, anon;
grant execute on function public.create_event(uuid, text, text, date, date, text, text, time, time, text, text, text, text, integer, text, text) to authenticated;
