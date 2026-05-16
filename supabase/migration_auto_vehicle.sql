-- Migration: add Auto vehicle config for micro-deliveries
-- Run in Supabase SQL Editor

-- 1. Drop the existing check constraint that doesn't include 'auto'
ALTER TABLE vehicle_configs
  DROP CONSTRAINT IF EXISTS vehicle_configs_vehicle_type_check;

-- 2. Add new constraint that includes 'auto'
ALTER TABLE vehicle_configs
  ADD CONSTRAINT vehicle_configs_vehicle_type_check
  CHECK (vehicle_type IN ('auto', 'furgon', 'camion34', 'camionLargo'));

-- 3. Insert the auto vehicle config
INSERT INTO vehicle_configs (vehicle_type, service_type, name, description, base_price, km_tiers, extras, active, sort_order)
VALUES (
  'auto',
  'flete',
  'Auto',
  'Para envíos muy pequeños: sobres, cajas chicas, microondas, documentos, flores',
  5000,
  '[{"max_km": 999, "price_per_km": 800}]'::jsonb,
  '{"helper": 0, "floor": 0, "packing": 0}'::jsonb,
  true,
  0
)
ON CONFLICT DO NOTHING;
