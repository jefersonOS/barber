-- Allow organization owners and admins to update their organization
create policy "Allow update for organization owners and admins"
  on organizations for update
  to authenticated
  using (
    id in (
      select organization_id 
      from profiles 
      where profiles.id = auth.uid() 
      and profiles.role in ('owner', 'admin')
    )
  )
  with check (
    id in (
      select organization_id 
      from profiles 
      where profiles.id = auth.uid() 
      and profiles.role in ('owner', 'admin')
    )
  );
