-- Events, run by an organization.

-- Types: a starter list, plus custom ones people add. Custom types join the
-- list for everyone.
create table public.event_types (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 40),
  is_preset boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index event_types_name_key on public.event_types (lower(name));

insert into public.event_types (name, is_preset) values
  ('Tournament', true),
  ('Match', true),
  ('Competition', true),
  ('Concert', true),
  ('Meetup', true),
  ('Practice', true),
  ('Workshop', true),
  ('Fundraiser', true);

revoke all on public.event_types from anon, authenticated;
grant select on public.event_types to authenticated;
alter table public.event_types enable row level security;

create policy "Signed-in users can view event types"
  on public.event_types for select to authenticated
  using (true);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  type_id bigint not null references public.event_types (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- IANA time zone the event happens in, e.g. America/Chicago.
  timezone text not null check (char_length(timezone) between 1 and 64),
  address text check (char_length(address) <= 200),
  city text check (char_length(city) <= 100),
  postal_code text check (postal_code ~ '^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$'),
  country text check (country ~ '^[A-Z]{2}$'),
  capacity integer check (capacity between 1 and 1000000),
  discord_url text check (
    discord_url ~* '^https://(www\.)?(discord\.gg|discord\.com/invite|discordapp\.com/invite)/[A-Za-z0-9-]+/?$'
  ),
  website_url text check (website_url ~* '^https?://[^\s]+$' and char_length(website_url) <= 300),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index events_organization_id_starts_at_idx on public.events (organization_id, starts_at);

revoke all on public.events from anon, authenticated;
grant select on public.events to authenticated;
alter table public.events enable row level security;

-- Members of the organization can see its events.
create policy "Organization members can view events"
  on public.events for select to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = events.organization_id and m.user_id = (select auth.uid())
    )
  );

-- Returns the id of the event type with this name, adding it as a custom
-- type if it's new.
create or replace function public.resolve_event_type(type_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_type text := regexp_replace(trim(coalesce(type_name, '')), '\s+', ' ', 'g');
  type_ref bigint;
begin
  if char_length(clean_type) < 2 or char_length(clean_type) > 40 then
    raise exception 'Type must be 2 to 40 characters' using errcode = '22023';
  end if;

  select t.id into type_ref from public.event_types t where lower(t.name) = lower(clean_type);
  if type_ref is null then
    insert into public.event_types (name, created_by)
    values (clean_type, auth.uid())
    on conflict ((lower(name))) do nothing
    returning id into type_ref;
    if type_ref is null then
      select t.id into type_ref from public.event_types t where lower(t.name) = lower(clean_type);
    end if;
  end if;

  return type_ref;
end;
$$;

revoke execute on function public.resolve_event_type(text) from public, anon, authenticated;

-- Creates an event for an organization (owners and admins only). Start and
-- end are local times in the event's time zone.
create or replace function public.create_event(
  org_id uuid,
  event_name text,
  event_type text,
  starts_local timestamp,
  ends_local timestamp,
  event_timezone text,
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
    organization_id, name, type_id, starts_at, ends_at, timezone,
    address, city, postal_code, country, capacity, discord_url, website_url, created_by
  )
  values (
    org_id,
    trim(event_name),
    public.resolve_event_type(event_type),
    starts_local at time zone event_timezone,
    ends_local at time zone event_timezone,
    event_timezone,
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

revoke execute on function public.create_event(uuid, text, text, timestamp, timestamp, text, text, text, text, text, integer, text, text) from public, anon;
grant execute on function public.create_event(uuid, text, text, timestamp, timestamp, text, text, text, text, text, integer, text, text) to authenticated;
