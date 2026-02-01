-- Add price column to appointments to ensure historical data accuracy
alter table appointments 
add column price numeric(10, 2) default 0.00;

-- Optional: Update existing appointments with current service price (best effort)
update appointments
set price = services.price
from services
where appointments.service_id = services.id;
