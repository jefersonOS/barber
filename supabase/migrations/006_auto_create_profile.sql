-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, organization_id, full_name, role)
  values (
    new.id,
    (new.raw_user_meta_data->>'organization_id')::uuid,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'professional')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on insert
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
