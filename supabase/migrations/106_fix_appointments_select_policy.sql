-- Fix RLS policies for appointments to allow both authenticated users and webhooks

-- Drop all existing SELECT policies
DROP POLICY IF EXISTS "Users can view appointments of their organization" ON appointments;
DROP POLICY IF EXISTS "Allow webhook to read appointments" ON appointments;

-- Create unified SELECT policy that allows:
-- 1. Authenticated users to see appointments from their organization
-- 2. Unauthenticated (webhook) to see all appointments
CREATE POLICY "Allow users and webhooks to view appointments"
ON appointments FOR SELECT
USING (
    -- Allow if user is authenticated and belongs to the organization
    (auth.uid() IS NOT NULL AND organization_id IN (
        SELECT organization_id FROM profiles WHERE profiles.id = auth.uid()
    ))
    OR
    -- Allow unauthenticated access (for webhooks)
    auth.uid() IS NULL
);
