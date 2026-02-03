-- Add INSERT policy for WhatsApp bookings (unauthenticated)
DROP POLICY IF EXISTS "Allow webhook to insert appointments" ON appointments;
CREATE POLICY "Allow webhook to insert appointments"
ON appointments FOR INSERT
WITH CHECK (true);
