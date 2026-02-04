-- Add deposit percentage columns
-- Services can have individual deposit percentages, organizations have a default

-- Add deposit percentage to services (nullable, per-service override)
ALTER TABLE services 
ADD COLUMN deposit_percentage INTEGER;

-- Add default deposit percentage to organizations (global setting, default 50%)
ALTER TABLE organizations 
ADD COLUMN default_deposit_percentage INTEGER DEFAULT 50;

-- Add check constraints to ensure valid percentages (0-100)
ALTER TABLE services 
ADD CONSTRAINT services_deposit_percentage_check 
CHECK (deposit_percentage IS NULL OR (deposit_percentage >= 0 AND deposit_percentage <= 100));

ALTER TABLE organizations 
ADD CONSTRAINT organizations_default_deposit_percentage_check 
CHECK (default_deposit_percentage >= 0 AND default_deposit_percentage <= 100);
