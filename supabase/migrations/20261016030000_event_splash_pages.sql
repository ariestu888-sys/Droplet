-- Splash pages for individual events: public pages with organizer-written
-- content (sanitized by the API before it's saved). Only events with public
-- visibility have a visible splash page; private and hidden ones never do.

alter table public.events
  add column splash_html text check (char_length(splash_html) <= 100000),
  add column splash_updated_at timestamptz;

-- Replaces an event's splash page HTML (organizers: owners and admins).
create or replace function public.set_event_splash_html(target_event_id uuid, html text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_ref uuid;
begin
  select e.organization_id into org_ref from public.events e where e.id = target_event_id;
  if org_ref is null or not public.is_org_admin(org_ref) then
    raise exception 'Only organizers can edit this event''s splash page' using errcode = '42501';
  end if;

  update public.events
  set splash_html = nullif(trim(html), ''), splash_updated_at = now()
  where id = target_event_id;
end;
$$;

revoke execute on function public.set_event_splash_html(uuid, text) from public, anon;
grant execute on function public.set_event_splash_html(uuid, text) to authenticated;

-- Everything an event's public splash page shows, for anyone (signed in or
-- not). Returns null unless the event is public and belongs to the
-- organization with this slug.
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
      'logoPath', o.logo_path
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

revoke execute on function public.event_splash(text, uuid) from public;
grant execute on function public.event_splash(text, uuid) to anon, authenticated;
