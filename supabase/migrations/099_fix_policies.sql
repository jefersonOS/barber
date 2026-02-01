-- 1. Organizations: Allow creation
drop policy if exists "Enable insert for authenticated users only" on organizations;
create policy "Enable insert for authenticated users only"
  on organizations for insert
  to authenticated
  with check (true);

-- 2. Profiles: Allow creation and reading own profile
drop policy if exists "Enable insert for authenticated users only" on profiles;
create policy "Enable insert for authenticated users only"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Enable select for users own profile" on profiles;
create policy "Enable select for users own profile"
  on profiles for select
  using (auth.uid() = id);

-- 3. Services: Allow CRUD for organization members
drop policy if exists "Allow insert for organization members" on services;
create policy "Allow insert for organization members"
  on services for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );

drop policy if exists "Allow update for organization members" on services;
create policy "Allow update for organization members"
  on services for update
  to authenticated
  using (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );

drop policy if exists "Allow delete for organization members" on services;
create policy "Allow delete for organization members"
  on services for delete
  to authenticated
  using (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );
