-- Allow authenticated users to create organizations
create policy "Enable insert for authenticated users only"
  on organizations for insert
  to authenticated
  with check (true);

-- Allow authenticated users to create their own profile
create policy "Enable insert for authenticated users only"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Allow authenticated users to select their own profile (to check if they have one)
create policy "Enable select for users own profile"
  on profiles for select
  using (auth.uid() = id);
