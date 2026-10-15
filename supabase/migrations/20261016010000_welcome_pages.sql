-- Public welcome pages for organizations: custom HTML (sanitized by the API
-- before it's saved), upcoming public events, and a sponsors footer.

alter table public.organizations
  add column welcome_html text check (char_length(welcome_html) <= 100000),
  add column welcome_updated_at timestamptz;

-- Replaces an organization's welcome HTML (owners and admins).
create or replace function public.set_welcome_html(org_id uuid, html text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin(org_id) then
    raise exception 'Only organizers can edit the welcome page' using errcode = '42501';
  end if;

  update public.organizations
  set welcome_html = nullif(trim(html), ''), welcome_updated_at = now()
  where id = org_id;
end;
$$;

revoke execute on function public.set_welcome_html(uuid, text) from public, anon;
grant execute on function public.set_welcome_html(uuid, text) to authenticated;

-- Sponsors, shown in the welcome page footer.
create table public.organization_sponsors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  website_url text check (website_url ~* '^https?://[^\s]+$' and char_length(website_url) <= 300),
  -- Stored in the organization-logos bucket under "<organization id>/sponsors/".
  logo_path text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index organization_sponsors_org_idx on public.organization_sponsors (organization_id, position, created_at);

revoke all on public.organization_sponsors from anon, authenticated;
grant select, insert, update, delete on public.organization_sponsors to authenticated;
alter table public.organization_sponsors enable row level security;

create policy "Members can view sponsors"
  on public.organization_sponsors for select to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_sponsors.organization_id and m.user_id = (select auth.uid())
    )
  );

create policy "Organizers can add sponsors"
  on public.organization_sponsors for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy "Organizers can edit sponsors"
  on public.organization_sponsors for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "Organizers can remove sponsors"
  on public.organization_sponsors for delete to authenticated
  using (public.is_org_admin(organization_id));

-- Everything the public welcome page shows, for anyone (signed in or not).
-- Only public, upcoming events are included; private and hidden ones never are.
create or replace function public.organization_welcome(org_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'organization', jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'slug', o.slug,
      'type', t.name,
      'description', o.description,
      'address', o.address,
      'zipcode', o.zipcode,
      'websiteUrl', o.website_url,
      'discordUrl', o.discord_url,
      'logoPath', o.logo_path
    ),
    'html', o.welcome_html,
    'updatedAt', o.welcome_updated_at,
    'upcomingEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'type', et.name,
        'startsAt', e.starts_at,
        'endsAt', e.ends_at,
        'timezone', e.timezone,
        'hasStartTime', e.has_start_time,
        'hasEndTime', e.has_end_time,
        'city', e.city,
        'country', e.country
      ) order by e.starts_at)
      from (
        select * from public.events ev
        where ev.organization_id = o.id and ev.visibility = 'public' and ev.ends_at > now()
        order by ev.starts_at
        limit 20
      ) e
      join public.event_types et on et.id = e.type_id
    ), '[]'::jsonb),
    'sponsors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'websiteUrl', s.website_url,
        'logoPath', s.logo_path
      ) order by s.position, s.created_at)
      from public.organization_sponsors s
      where s.organization_id = o.id
    ), '[]'::jsonb)
  )
  from public.organizations o
  join public.organization_types t on t.id = o.type_id
  where o.slug = lower(org_slug);
$$;

revoke execute on function public.organization_welcome(text) from public;
grant execute on function public.organization_welcome(text) to anon, authenticated;
