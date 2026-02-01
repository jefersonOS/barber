-- DEBUG: Temporarily disable RLS on organizations to rule out permission issues
alter table organizations disable row level security;

-- Verify if policies exist (run this query to see output in Supabase results)
select * from pg_policies where tablename = 'organizations';
