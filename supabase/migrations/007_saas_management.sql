-- Add subscription fields to organizations
alter table organizations 
add column subscription_status text check (subscription_status in ('active', 'trial', 'past_due', 'cancelled')) default 'trial',
add column subscription_plan text default 'pro',
add column trial_ends_at timestamp with time zone default timezone('utc'::text, now() + interval '7 days');

-- Create a secure function to check if a user is a super admin
-- For simplicity, checking a specific email or metadata. 
-- Ideally, you'd have a separate 'platform_admins' table.
-- Here let's enforce a policy that ONLY specific users can see ALL orgs.

-- For now, let's create a policy that allows reading ALL organizations if the user has a specific claim (to be set manually in DB)
-- OR just make a new role 'super_admin' in profiles?
-- Let's stick to the simplest: Add 'is_super_admin' to profiles.

alter table profiles add column is_super_admin boolean default false;

-- RLS: Allow Super Admins to SELECT ALL Organizations
create policy "Super Admins can view all organizations"
  on organizations for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_super_admin = true
    )
  );

-- RLS: Allow Super Admins to UPDATE ALL Organizations (e.g. deactivate)
create policy "Super Admins can update all organizations"
  on organizations for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_super_admin = true
    )
  );
