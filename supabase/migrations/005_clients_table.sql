-- Table: Clients
create table clients (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Clients
alter table clients enable row level security;

create policy "Users can view clients of their organization"
  on clients for select
  using (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );

create policy "Users can insert clients for their organization"
  on clients for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );

create policy "Users can update clients of their organization"
  on clients for update
  to authenticated
  using (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );

create policy "Users can delete clients of their organization"
  on clients for delete
  to authenticated
  using (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );
