-- Organization details: type, location, links and logo.

-- Types: a starter list, plus custom ones people add when creating an
-- organization. Custom types join the list for everyone.
create table public.organization_types (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 40),
  is_preset boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index organization_types_name_key on public.organization_types (lower(name));

insert into public.organization_types (name, is_preset) values
  ('Esports club', true),
  ('Sports club', true),
  ('School club', true),
  ('Band', true),
  ('League', true),
  ('Community group', true),
  ('Charity or nonprofit', true),
  ('Business', true);

revoke all on public.organization_types from anon, authenticated;
grant select on public.organization_types to authenticated;
alter table public.organization_types enable row level security;

create policy "Signed-in users can view organization types"
  on public.organization_types for select to authenticated
  using (true);

-- New organization columns.
alter table public.organizations
  add column type_id bigint references public.organization_types (id),
  add column zipcode text check (zipcode ~ '^[0-9]{5}(-[0-9]{4})?$'),
  add column address text check (char_length(address) <= 200),
  add column discord_url text check (
    discord_url ~* '^https://(www\.)?(discord\.gg|discord\.com/invite|discordapp\.com/invite)/[A-Za-z0-9-]+/?$'
  ),
  add column website_url text check (website_url ~* '^https?://[^\s]+$' and char_length(website_url) <= 300),
  add column logo_path text;

-- Organizations created before types existed get "Community group".
update public.organizations
set type_id = (select id from public.organization_types where name = 'Community group')
where type_id is null;

alter table public.organizations alter column type_id set not null;

-- True when the signed-in user is an owner or admin of the organization.
create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

revoke execute on function public.is_org_admin(uuid) from public, anon;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- Replace create_organization with a version that takes the new details.
drop function public.create_organization(text, text);

create function public.create_organization(
  org_name text,
  org_type text,
  org_description text default null,
  org_zipcode text default null,
  org_address text default null,
  org_discord_url text default null,
  org_website_url text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean_type text := regexp_replace(trim(coalesce(org_type, '')), '\s+', ' ', 'g');
  type_ref bigint;
  base_slug text;
  new_slug text;
  org public.organizations;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if char_length(clean_type) < 2 or char_length(clean_type) > 40 then
    raise exception 'Type must be 2 to 40 characters' using errcode = '22023';
  end if;

  -- Use the existing type with this name, or add it as a custom type.
  select t.id into type_ref from public.organization_types t where lower(t.name) = lower(clean_type);
  if type_ref is null then
    insert into public.organization_types (name, created_by)
    values (clean_type, uid)
    on conflict ((lower(name))) do nothing
    returning id into type_ref;
    if type_ref is null then
      select t.id into type_ref from public.organization_types t where lower(t.name) = lower(clean_type);
    end if;
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
    name, slug, description, created_by, type_id, zipcode, address, discord_url, website_url
  )
  values (
    trim(org_name),
    new_slug,
    nullif(trim(org_description), ''),
    uid,
    type_ref,
    nullif(trim(org_zipcode), ''),
    nullif(trim(org_address), ''),
    nullif(trim(org_discord_url), ''),
    nullif(trim(org_website_url), '')
  )
  returning * into org;

  insert into public.organization_members (organization_id, user_id, role)
  values (org.id, uid, 'owner');

  return org;
end;
$$;

revoke execute on function public.create_organization(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text, text, text) to authenticated;

-- Points an organization at a newly uploaded logo (owners and admins only).
-- Returns the previous logo's path so the caller can delete that file.
create function public.set_organization_logo(org_id uuid, new_logo_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_path text;
begin
  if not public.is_org_admin(org_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if new_logo_path is not null and new_logo_path not like org_id::text || '/%' then
    raise exception 'Logo must be stored in the organization''s folder' using errcode = '22023';
  end if;

  select o.logo_path into old_path from public.organizations o where o.id = org_id;
  update public.organizations set logo_path = new_logo_path where id = org_id;
  return old_path;
end;
$$;

revoke execute on function public.set_organization_logo(uuid, text) from public, anon;
grant execute on function public.set_organization_logo(uuid, text) to authenticated;

-- Logo storage: a public bucket (logos show on public pages), files under
-- "<organization id>/", writable only by that organization's owners and admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organization-logos', 'organization-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "Org admins can upload logos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'organization-logos'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "Org admins can see their logo files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'organization-logos'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "Org admins can delete logos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'organization-logos'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );
