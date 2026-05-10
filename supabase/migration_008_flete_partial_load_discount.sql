-- Parametros para descuento de carga parcial en fletes.
-- Aplica cuando un articulo obliga a subir de camion por alto/largo/pesado,
-- pero el volumen total sigue siendo bajo.

update vehicle_configs
set extras = jsonb_set(
  jsonb_set(coalesce(extras, '{}'::jsonb), '{partial_discount_pct}', '20'::jsonb, true),
  '{partial_discount_max_m3}', '4'::jsonb, true
)
where coalesce(service_type, 'flete') = 'flete'
  and vehicle_type in ('camion34', 'camionLargo')
  and not (coalesce(extras, '{}'::jsonb) ? 'partial_discount_pct');
