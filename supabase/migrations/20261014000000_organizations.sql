-- Organizations (clubs, leagues, bands...) and who belongs to them.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 500),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx on public.organization_members (user_id);

-- Signed-in users can read (rows filtered by the policies below); nobody
-- writes directly.
revoke all on public.organizations, public.organization_members from anon, authenticated;
grant select on public.organizations, public.organization_members to authenticated;

-- Row-level security: people only see organizations they belong to.
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "Members can view their organizations"
  on public.organizations for select to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id and m.user_id = (select auth.uid())
    )
  );

create policy "Users can view their own memberships"
  on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update/delete policies: changes go through the functions below,
-- so an organization is never created without its owner.

-- Creates an organization with the caller as its owner, and returns it.
create or replace function public.create_organization(org_name text, org_description text default null)
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

  insert into public.organizations (name, slug, description, created_by)
  values (trim(org_name), new_slug, nullif(trim(org_description), ''), uid)
  returning * into org;

  insert into public.organization_members (organization_id, user_id, role)
  values (org.id, uid, 'owner');

  return org;
end;
$$;

revoke execute on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
