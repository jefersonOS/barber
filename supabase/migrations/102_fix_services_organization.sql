-- Fix: Update services to correct organization_id
-- Current issue: Services belong to 9ef25704-3bad-4dea-84a1-dac5cd27b31e
-- But WhatsApp instance is connected to 9cf2270d-3bad-4dea-84a1-dac5cd27b31e

UPDATE services
SET organization_id = '9cf2270d-3bad-4dea-84a1-dac5cd27b31e'
WHERE organization_id = '9ef25704-3bad-4dea-84a1-dac5cd27b31e';

-- Verify the update
SELECT id, name, organization_id, price 
FROM services 
WHERE organization_id = '9cf2270d-3bad-4dea-84a1-dac5cd27b31e';
