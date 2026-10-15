-- Brand colors for an organization's splash pages (its own and its events'),
-- set by the organization's owner. Null means Droplet's default colors.

alter table public.organizations
  add column splash_primary_color text check (splash_primary_color ~ '^#[0-9a-f]{6}$'),
  add column splash_secondary_color text check (splash_secondary_color ~ '^#[0-9a-f]{6}$');

-- Sets the splash colors (owner only). Pass null to go back to the default.
create or replace function public.set_splash_colors(org_id uuid, primary_color text, secondary_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid() and m.role = 'owner'
  ) then
    raise exception 'Only the owner can change splash page colors' using errcode = '42501';
  end if;

  update public.organizations
  set splash_primary_color = lower(nullif(trim(primary_color), '')),
      splash_secondary_color = lower(nullif(trim(secondary_color), ''))
  where id = org_id;
end;
$$;

revoke execute on function public.set_splash_colors(uuid, text, text) from public, anon;
grant execute on function public.set_splash_colors(uuid, text, text) to authenticated;

-- The public splash functions now include the colors.

create or replace function public.organization_splash(org_slug text)
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
      'logoPath', o.logo_path,
      'primaryColor', o.splash_primary_color,
      'secondaryColor', o.splash_secondary_color
    ),
    'html', o.splash_html,
    'updatedAt', o.splash_updated_at,
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

create or replace function public.event_splash(org_slug text, target_event_id uuid)
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
      'logoPath', o.logo_path,
      'primaryColor', o.splash_primary_color,
      'secondaryColor', o.splash_secondary_color
    ),
    'event', jsonb_build_object(
      'id', e.id,
      'name', e.name,
      'type', et.name,
      'startsAt', e.starts_at,
      'endsAt', e.ends_at,
      'timezone', e.timezone,
      'hasStartTime', e.has_start_time,
      'hasEndTime', e.has_end_time,
      'address', e.address,
      'city', e.city,
      'postalCode', e.postal_code,
      'country', e.country,
      'capacity', e.capacity,
      'websiteUrl', e.website_url,
      'discordUrl', e.discord_url
    ),
    'html', e.splash_html,
    'updatedAt', e.splash_updated_at,
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
  from public.events e
  join public.organizations o on o.id = e.organization_id
  join public.event_types et on et.id = e.type_id
  where e.id = target_event_id
    and o.slug = lower(org_slug)
    and e.visibility = 'public';
$$;
