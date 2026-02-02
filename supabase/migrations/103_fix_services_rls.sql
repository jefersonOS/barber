-- Allow anonymous (webhook) access to read services
-- This is needed for the WhatsApp bot to list services
DROP POLICY IF EXISTS "Users can view services of their organization" ON services;

CREATE POLICY "Allow read services for organization"
  ON services FOR SELECT
  USING (true); -- Allow all reads (services are not sensitive data)

-- Alternative: If you want to restrict by organization_id in the future:
-- USING (organization_id = current_setting('request.jwt.claims', true)::json->>'organization_id');
