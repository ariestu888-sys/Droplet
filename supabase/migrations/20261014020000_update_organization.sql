-- Editing organizations (owners and admins only).

-- Returns the id of the type with this name, adding it as a custom type if
-- it's new. Shared by create and update.
create or replace function public.resolve_organization_type(type_name text)
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

  select t.id into type_ref from public.organization_types t where lower(t.name) = lower(clean_type);
  if type_ref is null then
    insert into public.organization_types (name, created_by)
    values (clean_type, auth.uid())
    on conflict ((lower(name))) do nothing
    returning id into type_ref;
    if type_ref is null then
      select t.id into type_ref from public.organization_types t where lower(t.name) = lower(clean_type);
    end if;
  end if;

  return type_ref;
end;
$$;

revoke execute on function public.resolve_organization_type(text) from public, anon, authenticated;

-- Replaces an organization's editable details. Blank optional values clear
-- the field. The slug stays the same so links keep working.
create or replace function public.update_organization(
  org_id uuid,
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
    website_url = nullif(trim(org_website_url), '')
  where id = org_id
  returning * into org;

  return org;
end;
$$;

revoke execute on function public.update_organization(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_organization(uuid, text, text, text, text, text, text, text) to authenticated;
