-- An optional Instagram link for organizations, stored as a full profile URL
-- (https://www.instagram.com/<handle>/). Shown on organization and splash pages.

alter table public.organizations
  add column instagram_url text check (
    instagram_url ~* '^https://(www\.)?instagram\.com/[A-Za-z0-9._]{1,30}/?$'
  );

-- create_organization and update_organization gain an Instagram parameter.
-- The old versions are dropped first so there's exactly one of each.

drop function public.create_organization(text, text, text, text, text, text, text);

create function public.create_organization(
  org_name text,
  org_type text,
  org_description text default null,
  org_zipcode text default null,
  org_address text default null,
  org_discord_url text default null,
  org_website_url text default null,
  org_instagram_url text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  base_slug text;
  new_slug text;
  org public.organizations;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(trim(org_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'org';
  end if;
  base_slug := left(base_slug, 60);
  new_slug := base_slug;

  -- Add a short random suffix if the slug is already taken.
  while exists (select 1 from public.organizations o where o.slug = new_slug) loop
    new_slug := base_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.organizations (
    name, slug, description, created_by, type_id, zipcode, address, discord_url, website_url, instagram_url
  )
  values (
    trim(org_name),
    new_slug,
    nullif(trim(org_description), ''),
    uid,
    public.resolve_organization_type(org_type),
    nullif(trim(org_zipcode), ''),
    nullif(trim(org_address), ''),
    nullif(trim(org_discord_url), ''),
    nullif(trim(org_website_url), ''),
    nullif(trim(org_instagram_url), '')
  )
  returning * into org;

  insert into public.organization_members (organization_id, user_id, role)
  values (org.id, uid, 'owner');

  return org;
end;
$$;

revoke execute on function public.create_organization(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text, text, text, text) to authenticated;

drop function public.update_organization(uuid, text, text, text, text, text, text, text);

create function public.update_organization(
  org_id uuid,
  org_name text,
  org_type text,
  org_description text default null,
  org_zipcode text default null,
  org_address text default null,
  org_discord_url text default null,
  org_website_url text default null,
  org_instagram_url text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.is_org_admin(org_id) then
    raise exception 'Only owners and admins can edit this organization' using errcode = '42501';
  end if;

  update public.organizations set
    name = trim(org_name),
    type_id = public.resolve_organization_type(org_type),
    description = nullif(trim(org_description), ''),
    zipcode = nullif(trim(org_zipcode), ''),
    address = nullif(trim(org_address), ''),
    discord_url = nullif(trim(org_discord_url), ''),
    website_url = nullif(trim(org_website_url), ''),
    instagram_url = nullif(trim(org_instagram_url), '')
  where id = org_id
  returning * into org;

  return org;
end;
$$;

revoke execute on function public.update_organization(uuid, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_organization(uuid, text, text, text, text, text, text, text, text) to authenticated;

-- The organization's public splash page now includes its Instagram link.
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
      'instagramUrl', o.instagram_url,
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
