-- Configurar m3 incluidos gratis para Fletes.
-- Ejecutar en Supabase SQL Editor. Es idempotente.

update vehicle_configs
set extras = jsonb_set(coalesce(extras, '{}'::jsonb), '{included_m3}', '3'::jsonb, true)
where coalesce(service_type, 'flete') = 'flete'
  and not (coalesce(extras, '{}'::jsonb) ? 'included_m3');

-- En mudanzas se mantiene en 0 porque el servicio se cobra como camion completo.
update vehicle_configs
set extras = jsonb_set(coalesce(extras, '{}'::jsonb), '{included_m3}', '0'::jsonb, true)
where service_type = 'mudanza'
  and not (coalesce(extras, '{}'::jsonb) ? 'included_m3');
