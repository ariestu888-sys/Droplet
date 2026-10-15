-- Organization roles, invitations, and member management.
--
-- Roles, most to least access:
--   owner      overall ownership; the only one who can make or remove admins
--              and set splash colors
--   admin      edits the organization's pages and events; manages members
--              below admin
--   booster    a volunteer helper (no extra rights yet)
--   member     takes part in activities; sees public and private events
--   subscriber watches for updates; sees public events only
-- Owners and admins are "organizers" (see is_org_admin).

alter table public.organization_members drop constraint organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'booster', 'member', 'subscriber'));

-- Events: hidden ones only for organizers, private ones not for subscribers.
drop policy "Members can view events; organizers also see hidden ones" on public.events;

create policy "Members see events their role allows"
  on public.events for select to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = events.organization_id
        and m.user_id = (select auth.uid())
        and case events.visibility
              when 'public' then true
              when 'private' then m.role in ('owner', 'admin', 'booster', 'member')
              else m.role in ('owner', 'admin')
            end
    )
  );

-- The signed-in user's role in an organization, or null.
create or replace function public.org_role(org_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.organization_members m
  where m.organization_id = org_id and m.user_id = auth.uid();
$$;

revoke execute on function public.org_role(uuid) from public, anon;
grant execute on function public.org_role(uuid) to authenticated;

-- Whether someone with `actor_role` may give or take away `target_role`:
-- owners manage everyone but the owner; admins manage roles below admin.
create or replace function public.can_manage_role(actor_role text, target_role text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when target_role = 'owner' then false
    when actor_role = 'owner' then true
    when actor_role = 'admin' then target_role in ('booster', 'member', 'subscriber')
    else false
  end;
$$;

-- Invitations ---------------------------------------------------------------

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  role text not null check (role in ('admin', 'booster', 'member', 'subscriber')),
  -- Secret, unguessable: whoever holds the link can see the invite.
  token text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);

create index organization_invitations_org_idx on public.organization_invitations (organization_id, created_at desc);

revoke all on public.organization_invitations from anon, authenticated;
grant select on public.organization_invitations to authenticated;
alter table public.organization_invitations enable row level security;

create policy "Organizers can view their organization's invitations"
  on public.organization_invitations for select to authenticated
  using (public.is_org_admin(organization_id));

-- Invites someone by email with a role. Replaces any pending invite for the
-- same email. Returns the invitation, including its token.
create or replace function public.create_invitation(org_id uuid, invite_email text, invite_role text)
returns public.organization_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text := public.org_role(org_id);
  clean_email text := lower(trim(invite_email));
  inv public.organization_invitations;
begin
  if actor is null or not public.can_manage_role(actor, invite_role) then
    raise exception 'You can''t invite people with that role' using errcode = '42501';
  end if;

  update public.organization_invitations
  set revoked_at = now()
  where organization_id = org_id and email = clean_email and accepted_at is null and revoked_at is null;

  insert into public.organization_invitations (organization_id, email, role, token, invited_by)
  values (
    org_id,
    clean_email,
    invite_role,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    auth.uid()
  )
  returning * into inv;

  return inv;
end;
$$;

revoke execute on function public.create_invitation(uuid, text, text) from public, anon;
grant execute on function public.create_invitation(uuid, text, text) to authenticated;

-- Cancels a pending invitation.
create or replace function public.revoke_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.organization_invitations;
begin
  select * into inv from public.organization_invitations where id = invitation_id;
  if inv.id is null or not public.can_manage_role(public.org_role(inv.organization_id), inv.role) then
    raise exception 'You can''t cancel this invitation' using errcode = '42501';
  end if;

  update public.organization_invitations set revoked_at = now()
  where id = invitation_id and accepted_at is null and revoked_at is null;
end;
$$;

revoke execute on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;

-- What an invite link shows, for anyone holding its token.
create or replace function public.invitation_details(invite_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'organization', jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'logoPath', o.logo_path),
    'email', i.email,
    'role', i.role,
    'expiresAt', i.expires_at,
    'status', case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at < now() then 'expired'
      else 'pending'
    end
  )
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token = invite_token;
$$;

revoke execute on function public.invitation_details(text) from public;
grant execute on function public.invitation_details(text) to anon, authenticated;

-- How much each role can see and do, for comparing roles.
create or replace function public.role_rank(r text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case r when 'owner' then 5 when 'admin' then 4 when 'booster' then 3 when 'member' then 2 when 'subscriber' then 1 else 0 end;
$$;

-- Accepts an invitation as the signed-in user, whose email must match.
-- Joins the organization, or raises the person's role if the invite's is
-- higher (never lowers it). Returns the organization's id.
create or replace function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  inv public.organization_invitations;
  existing_role text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into inv from public.organization_invitations where token = invite_token for update;
  if inv.id is null then
    raise exception 'No such invitation' using errcode = 'P0002';
  end if;
  if inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at < now() then
    raise exception 'This invitation is no longer valid' using errcode = '22023';
  end if;

  select lower(u.email) into user_email from auth.users u where u.id = uid;
  if user_email is distinct from inv.email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  select m.role into existing_role from public.organization_members m
  where m.organization_id = inv.organization_id and m.user_id = uid;

  if existing_role is null then
    insert into public.organization_members (organization_id, user_id, role)
    values (inv.organization_id, uid, inv.role);
  elsif public.role_rank(inv.role) > public.role_rank(existing_role) then
    update public.organization_members set role = inv.role
    where organization_id = inv.organization_id and user_id = uid;
  end if;

  update public.organization_invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  return inv.organization_id;
end;
$$;

revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- Members ---------------------------------------------------------------------

-- An organization's members with names and emails (organizers only).
create or replace function public.list_organization_members(org_id uuid)
returns table (user_id uuid, full_name text, email text, role text, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin(org_id) then
    raise exception 'Only organizers can see the member list' using errcode = '42501';
  end if;

  return query
  select m.user_id,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         u.email::text,
         m.role,
         m.created_at
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = org_id
  order by public.role_rank(m.role) desc, m.created_at;
end;
$$;

revoke execute on function public.list_organization_members(uuid) from public, anon;
grant execute on function public.list_organization_members(uuid) to authenticated;

-- Changes a member's role. Owners can change anyone but themselves to any
-- role but owner; admins can move people between booster, member and subscriber.
create or replace function public.set_member_role(org_id uuid, target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text := public.org_role(org_id);
  target_role text;
begin
  select m.role into target_role from public.organization_members m
  where m.organization_id = org_id and m.user_id = target_user;

  if target_role is null then
    raise exception 'That person isn''t in this organization' using errcode = 'P0002';
  end if;
  if target_user = auth.uid() then
    raise exception 'You can''t change your own role' using errcode = '42501';
  end if;
  if actor is null
     or not public.can_manage_role(actor, target_role)
     or not public.can_manage_role(actor, new_role) then
    raise exception 'You can''t give or take away that role' using errcode = '42501';
  end if;

  update public.organization_members set role = new_role
  where organization_id = org_id and user_id = target_user;
end;
$$;

revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;

-- Removes someone from an organization (same rules as changing their role).
create or replace function public.remove_member(org_id uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text := public.org_role(org_id);
  target_role text;
begin
  select m.role into target_role from public.organization_members m
  where m.organization_id = org_id and m.user_id = target_user;

  if target_role is null then
    raise exception 'That person isn''t in this organization' using errcode = 'P0002';
  end if;
  if target_user = auth.uid() then
    raise exception 'Use leave to remove yourself' using errcode = '42501';
  end if;
  if actor is null or not public.can_manage_role(actor, target_role) then
    raise exception 'You can''t remove that person' using errcode = '42501';
  end if;

  delete from public.organization_members where organization_id = org_id and user_id = target_user;
end;
$$;

revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- Leaves an organization. The owner can't leave.
create or replace function public.leave_organization(org_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text := public.org_role(org_id);
begin
  if actor is null then
    raise exception 'You aren''t in this organization' using errcode = 'P0002';
  end if;
  if actor = 'owner' then
    raise exception 'The owner can''t leave their organization' using errcode = '42501';
  end if;

  delete from public.organization_members where organization_id = org_id and user_id = auth.uid();
end;
$$;

revoke execute on function public.leave_organization(uuid) from public, anon;
grant execute on function public.leave_organization(uuid) to authenticated;

-- Subscribes the signed-in user to an organization's updates. People already
-- in the organization keep their role. Returns the user's role afterwards.
create or replace function public.subscribe_to_organization(org_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing_role text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = org_id) then
    raise exception 'No such organization' using errcode = 'P0002';
  end if;

  select m.role into existing_role from public.organization_members m
  where m.organization_id = org_id and m.user_id = uid;
  if existing_role is not null then
    return existing_role;
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (org_id, uid, 'subscriber');
  return 'subscriber';
end;
$$;

revoke execute on function public.subscribe_to_organization(uuid) from public, anon;
grant execute on function public.subscribe_to_organization(uuid) to authenticated;
