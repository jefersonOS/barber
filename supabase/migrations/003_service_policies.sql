-- Allow organization members to insert services
create policy "Allow insert for organization members"
  on services for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );

-- Allow organization members to update services
create policy "Allow update for organization members"
  on services for update
  to authenticated
  using (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );

-- Allow organization members to delete services
create policy "Allow delete for organization members"
  on services for delete
  to authenticated
  using (
    organization_id in (
      select organization_id from profiles where profiles.id = auth.uid()
    )
  );
