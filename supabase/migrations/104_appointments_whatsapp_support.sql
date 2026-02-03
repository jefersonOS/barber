-- Add fields to appointments table for WhatsApp booking support
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS stripe_session_id text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointments_conversation_id ON appointments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_appointments_stripe_session_id ON appointments(stripe_session_id);

-- Update RLS policy to allow webhook access (for Stripe webhook)
DROP POLICY IF EXISTS "Allow webhook to update appointments" ON appointments;
CREATE POLICY "Allow webhook to update appointments"
ON appointments FOR UPDATE
USING (true);

-- Allow webhook to read appointments for confirmation message
DROP POLICY IF EXISTS "Allow webhook to read appointments" ON appointments;
CREATE POLICY "Allow webhook to read appointments"
ON appointments FOR SELECT
USING (true);
