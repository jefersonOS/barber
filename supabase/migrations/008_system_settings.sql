-- Create system settings table
create table if not exists system_settings (
  key text primary key,
  value text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table system_settings enable row level security;

-- Policies
-- Only Super Admins can insert/update/delete
create policy "Super Admins can manage system settings"
  on system_settings
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_super_admin = true
    )
  );

-- Only Super Admins can select (for now, maybe public settings later?)
create policy "Super Admins can view system settings"
  on system_settings for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_super_admin = true
    )
  );
