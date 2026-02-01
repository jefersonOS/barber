-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: Organizations (Tenants)
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  whatsapp_instance_id text,
  settings jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: Profiles (Users linked to Auth and Organizations)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  full_name text,
  phone text,
  role text check (role in ('owner', 'admin', 'professional')) not null default 'professional',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Organizations
alter table organizations enable row level security;

-- Policies for Organizations
-- Public can view basic info (if needed for booking page)?? No, usually only by slug.
-- For now, allow read if user belongs to org.
create policy "Users can view their own organization"
  on organizations for select
  using (
    id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );

-- Table: Services
create table services (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  description text,
  duration_min integer not null,
  price numeric(10, 2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Services
alter table services enable row level security;
create policy "Users can view services of their organization"
  on services for select
  using (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );

-- Table: Appointments
create table appointments (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade not null,
  professional_id uuid references profiles(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  client_name text not null,
  client_phone text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  status text check (status in ('pending', 'confirmed', 'cancelled', 'completed')) default 'pending',
  payment_status text check (payment_status in ('pending', 'paid')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Appointments
alter table appointments enable row level security;
create policy "Users can view appointments of their organization"
  on appointments for select
  using (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );

-- Table: Conversation Logs (WhatsApp)
create table conversation_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade not null,
  client_phone text not null,
  message_content text not null,
  sender text check (sender in ('user', 'ai')) not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Conversation Logs
alter table conversation_logs enable row level security;
create policy "Users can view logs of their organization"
  on conversation_logs for select
  using (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );
