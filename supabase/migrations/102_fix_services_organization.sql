-- Insert services for organization 9cf2270d-3bad-4dea-84a1-dac5cd27b31e
INSERT INTO services (organization_id, name, description, duration_min, price) VALUES
('9cf2270d-3bad-4dea-84a1-dac5cd27b31e', 'Barba', 'ajehe sua barba', 30, 20.00),
('9cf2270d-3bad-4dea-84a1-dac5cd27b31e', 'Sobrancelha', 'deua sua sobrancelha impecável', 20, 20.00),
('9cf2270d-3bad-4dea-84a1-dac5cd27b31e', 'Corte de Cabelo', 'Corte de cabelo com a mais alta perfeição', 30, 80.00),
('9cf2270d-3bad-4dea-84a1-dac5cd27b31e', 'Hidratação', 'Hidrate seu cabelo', 90, 60.00);

-- Verify insertion
SELECT id, name, organization_id, price FROM services 
WHERE organization_id = '9cf2270d-3bad-4dea-84a1-dac5cd27b31e';
