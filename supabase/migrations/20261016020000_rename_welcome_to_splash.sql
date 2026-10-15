-- Rename "welcome page" database objects to "splash page", to match the
-- product's name for it. Existing content is kept.

-- Columns: renamed in place (their data and check constraints carry over).
alter table public.organizations rename column welcome_html to splash_html;
alter table public.organizations rename column welcome_updated_at to splash_updated_at;

-- Functions refer to those columns in their bodies, so they're recreated
-- under their new names, and the old ones removed.

drop function public.set_welcome_html(uuid, text);

-- Replaces an organization's splash page HTML (owners and admins).
create or replace function public.set_splash_html(org_id uuid, html text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin(org_id) then
    raise exception 'Only organizers can edit the splash page' using errcode = '42501';
  end if;

  update public.organizations
  set splash_html = nullif(trim(html), ''), splash_updated_at = now()
  where id = org_id;
end;
$$;

revoke execute on function public.set_splash_html(uuid, text) from public, anon;
grant execute on function public.set_splash_html(uuid, text) to authenticated;

drop function public.organization_welcome(text);

-- Everything the public splash page shows, for anyone (signed in or not).
-- Only public, upcoming events are included; private and hidden ones never are.
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
      'logoPath', o.logo_path
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

revoke execute on function public.organization_splash(text) from public;
grant execute on function public.organization_splash(text) to anon, authenticated;
