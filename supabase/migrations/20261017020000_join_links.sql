-- Join links: shareable links (and QR codes) that let anyone who signs in
-- join an organization as a booster, member or subscriber. Unlike email
-- invitations, they aren't tied to one person. At most one active link per
-- role; resetting or turning one off stops the old link working at once.

create table public.organization_join_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role text not null check (role in ('booster', 'member', 'subscriber')),
  token text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index organization_join_links_one_active
  on public.organization_join_links (organization_id, role) where revoked_at is null;

revoke all on public.organization_join_links from anon, authenticated;
grant select on public.organization_join_links to authenticated;
alter table public.organization_join_links enable row level security;

create policy "Organizers can view their organization's join links"
  on public.organization_join_links for select to authenticated
  using (public.is_org_admin(organization_id));

-- Creates the join link for a role, replacing any active one (the old link
-- stops working). Owners and admins only.
create or replace function public.create_join_link(org_id uuid, link_role text)
returns public.organization_join_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.organization_join_links;
begin
  if link_role not in ('booster', 'member', 'subscriber')
     or not public.can_manage_role(public.org_role(org_id), link_role) then
    raise exception 'You can''t create a join link for that role' using errcode = '42501';
  end if;

  update public.organization_join_links set revoked_at = now()
  where organization_id = org_id and role = link_role and revoked_at is null;

  insert into public.organization_join_links (organization_id, role, token, created_by)
  values (
    org_id,
    link_role,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    auth.uid()
  )
  returning * into link;

  return link;
end;
$$;

revoke execute on function public.create_join_link(uuid, text) from public, anon;
grant execute on function public.create_join_link(uuid, text) to authenticated;

-- Turns a join link off.
create or replace function public.revoke_join_link(link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.organization_join_links;
begin
  select * into link from public.organization_join_links where id = link_id;
  if link.id is null or not public.can_manage_role(public.org_role(link.organization_id), link.role) then
    raise exception 'You can''t turn off this join link' using errcode = '42501';
  end if;

  update public.organization_join_links set revoked_at = now() where id = link_id and revoked_at is null;
end;
$$;

revoke execute on function public.revoke_join_link(uuid) from public, anon;
grant execute on function public.revoke_join_link(uuid) to authenticated;

-- What a join link shows, for anyone holding it.
create or replace function public.join_link_details(link_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'organization', jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'logoPath', o.logo_path),
    'role', l.role,
    'status', case when l.revoked_at is null then 'active' else 'inactive' end
  )
  from public.organization_join_links l
  join public.organizations o on o.id = l.organization_id
  where l.token = link_token;
$$;

revoke execute on function public.join_link_details(text) from public;
grant execute on function public.join_link_details(text) to anon, authenticated;

-- Joins through a join link as the signed-in user, or raises their role if
-- the link's is higher (never lowers it). Returns the organization's id.
create or replace function public.accept_join_link(link_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  link public.organization_join_links;
  existing_role text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into link from public.organization_join_links where token = link_token;
  if link.id is null then
    raise exception 'No such join link' using errcode = 'P0002';
  end if;
  if link.revoked_at is not null then
    raise exception 'This join link has been turned off' using errcode = '22023';
  end if;

  select m.role into existing_role from public.organization_members m
  where m.organization_id = link.organization_id and m.user_id = uid;

  if existing_role is null then
    insert into public.organization_members (organization_id, user_id, role)
    values (link.organization_id, uid, link.role);
  elsif public.role_rank(link.role) > public.role_rank(existing_role) then
    update public.organization_members set role = link.role
    where organization_id = link.organization_id and user_id = uid;
  end if;

  return link.organization_id;
end;
$$;

revoke execute on function public.accept_join_link(text) from public, anon;
grant execute on function public.accept_join_link(text) to authenticated;
