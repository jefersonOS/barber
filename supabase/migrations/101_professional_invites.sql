-- Table: Professional Invites
create table professional_invites (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade not null,
  phone text not null,
  name text not null,
  token text unique not null,
  status text check (status in ('pending', 'accepted', 'expired')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Professional Invites
alter table professional_invites enable row level security;

-- Policy: Owners can view/create invites for their organization
create policy "Owners can view invites of their organization"
  on professional_invites for select
  using (
    organization_id in (
      select organization_id from profiles 
      where profiles.id = auth.uid() 
      and profiles.role = 'owner'
    )
  );

create policy "Owners can insert invites for their organization"
  on professional_invites for insert
  with check (
    organization_id in (
      select organization_id from profiles 
      where profiles.id = auth.uid() 
      and profiles.role = 'owner'
    )
  );

-- Policy: Public access (or at least check) by token is needed for the invite page?
-- The Invite Page will likely use a Server Action with admin rights to read the invite by token, 
-- creating a direct read policy for public might not be needed if we use admin client for validation.
-- But to be safe, let's allow read by token if we want client-side validation, 
-- though secure token handling suggests keeping it server-side.
-- We will stick to Owner policies. Public validation will be done via Server Action with Admin Privileges (bypassing RLS).
