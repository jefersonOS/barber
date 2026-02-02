-- Enable pgcrypto if not already enabled
create extension if not exists pgcrypto;

-- 1. Conversations (Track phone <-> ID)
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade, -- Link to org for multi-tenant if needed later, nullable for now if purely phone-based first
  phone text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Inbound Messages (Idempotency)
create table if not exists inbound_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  provider text not null default 'evolution',
  provider_message_id text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_message_id) 
);

-- 3. Booking State (Persisted Context)
create table if not exists booking_state (
  conversation_id uuid primary key references conversations(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  last_question_key text,
  updated_at timestamptz not null default now()
);

-- 4. Bookings (Track status: HOLD -> CONFIRMED)
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  organization_id uuid references organizations(id), -- Denormalized for easier querying
  service_id uuid references services(id),
  professional_id uuid references profiles(id),
  client_name text,
  client_phone text,
  start_time timestamptz,
  end_time timestamptz,
  status text not null, -- HOLD | CONFIRMED | CANCELED | EXPIRED
  payload jsonb not null default '{}'::jsonb,
  hold_expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5. Payments (Stripe Integration)
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  stripe_session_id text not null unique,
  amount_cents int not null,
  currency text not null default 'brl',
  status text not null, -- PENDING | PAID | FAILED | EXPIRED
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS Policies (Simple for now, can be hardened)
alter table conversations enable row level security;
alter table inbound_messages enable row level security;
alter table booking_state enable row level security;
alter table bookings enable row level security;
alter table payments enable row level security;

-- Allow service_role to do everything (standard for server-side webhook operations)
create policy "Service role has full access to conversations" on conversations for all using (true);
create policy "Service role has full access to inbound_messages" on inbound_messages for all using (true);
create policy "Service role has full access to booking_state" on booking_state for all using (true);
create policy "Service role has full access to bookings" on bookings for all using (true);
create policy "Service role has full access to payments" on payments for all using (true);
