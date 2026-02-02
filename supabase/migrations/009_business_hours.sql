-- Create business_hours table
create table business_hours (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references organizations(id) on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0 = Sunday, 1 = Monday, ...
  start_time time without time zone default '09:00:00',
  end_time time without time zone default '18:00:00',
  is_closed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (organization_id, day_of_week)
);

-- RLS Policies
alter table business_hours enable row level security;

create policy "Users can view business hours of their organization"
  on business_hours for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = business_hours.organization_id
    )
  );

create policy "Users can update business hours of their organization"
  on business_hours for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = business_hours.organization_id
    )
  );

create policy "Users can insert business hours for their organization"
  on business_hours for insert
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.organization_id = business_hours.organization_id
    )
  );

-- Function to initialize default hours for a new org (optional, but good practice)
-- Trigger to auto-create default hours? Maybe later. For now, we handle it in application logic or default empty.
