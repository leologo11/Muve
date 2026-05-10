-- Parametro para descuento progresivo de carga parcial en fletes.
-- Si un articulo obliga a subir de camion por alto/largo/pesado,
-- el descuento parte en este porcentaje y baja hasta 0% al llenar el camion.

update vehicle_configs
set extras = jsonb_set(coalesce(extras, '{}'::jsonb), '{partial_discount_pct}', '30'::jsonb, true)
where coalesce(service_type, 'flete') = 'flete'
  and vehicle_type in ('camion34', 'camionLargo')
  and not (coalesce(extras, '{}'::jsonb) ? 'partial_discount_pct');
