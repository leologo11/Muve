-- Migración v2: Precios de vehículos actualizados
-- Ejecutar en Supabase → SQL Editor
-- Idempotente: se puede correr múltiples veces sin problema.

-- ─── FLETES ────────────────────────────────────────────────────────────────────

-- Furgón N400: 6 m³ cap. Los primeros 3 m³ van incluidos en la tarifa base.
-- Carga: cajas, colchón, electrodomésticos pequeños, muebles livianos.
UPDATE vehicle_configs SET
  name        = 'Furgón',
  description = 'Cajas, colchón, electrodomésticos y muebles pequeños. Hasta 6 m³.',
  base_price  = 20000,
  km_tiers    = '[{"max_km":40,"price_per_km":700},{"max_km":100,"price_per_km":600},{"max_km":300,"price_per_km":500},{"max_km":9999,"price_per_km":400}]',
  extras      = '{"driver_help":0,"helper":10000,"floor":4500,"packing":12000,"included_m3":3,"extra_m3":6000,"partial_discount_pct":25}',
  updated_at  = now()
WHERE service_type = 'flete' AND vehicle_type = 'furgon';

-- Camión 3/4: 15 m³ cap. Los primeros 6 m³ van incluidos en la tarifa base.
-- Carga: cama, nevera, sofá, closet, mudanza mediana (1-2 dormitorios).
UPDATE vehicle_configs SET
  name        = 'Camión 3/4',
  description = 'Cama, nevera, sofá, closet y mudanza mediana. Hasta 15 m³.',
  base_price  = 40000,
  km_tiers    = '[{"max_km":40,"price_per_km":1000},{"max_km":100,"price_per_km":800},{"max_km":300,"price_per_km":600},{"max_km":9999,"price_per_km":450}]',
  extras      = '{"driver_help":0,"helper":10000,"floor":5000,"packing":18000,"included_m3":6,"extra_m3":8500,"partial_discount_pct":30}',
  updated_at  = now()
WHERE service_type = 'flete' AND vehicle_type = 'camion34';

-- Camión largo: 30 m³ cap. Los primeros 10 m³ van incluidos en la tarifa base.
-- Carga: mudanza completa de depto o casa de 2-3 dormitorios.
UPDATE vehicle_configs SET
  name        = 'Camión Largo',
  description = 'Mudanza completa de depto o casa de 2-3 dormitorios. Hasta 30 m³.',
  base_price  = 80000,
  km_tiers    = '[{"max_km":60,"price_per_km":1400},{"max_km":200,"price_per_km":1100},{"max_km":500,"price_per_km":800},{"max_km":9999,"price_per_km":600}]',
  extras      = '{"driver_help":0,"helper":10000,"floor":6000,"packing":25000,"included_m3":10,"extra_m3":10000,"partial_discount_pct":35}',
  updated_at  = now()
WHERE service_type = 'flete' AND vehicle_type = 'camionLargo';

-- ─── MUDANZAS ──────────────────────────────────────────────────────────────────
-- Mudanza = servicio completo por camión. Sin extra por m³ adicional.
-- Chofer ayuda $20.000, ayudante $10.000 c/u.

-- Furgón mudanza: studio o 1D pequeño (hasta 6 m³)
UPDATE vehicle_configs SET
  name        = 'Furgón',
  description = 'Mudanza studio o 1 dormitorio pequeño. Cajas, colchón, muebles livianos. Hasta 6 m³.',
  base_price  = 35000,
  km_tiers    = '[{"max_km":40,"price_per_km":700},{"max_km":100,"price_per_km":600},{"max_km":300,"price_per_km":500},{"max_km":9999,"price_per_km":400}]',
  extras      = '{"driver_help":20000,"helper":10000,"floor":4500,"packing":12000,"extra_m3":0,"partial_discount_pct":0}',
  updated_at  = now()
WHERE service_type = 'mudanza' AND vehicle_type = 'furgon';

-- Camión 3/4 mudanza: depto familiar (1-2D, hasta 15 m³)
UPDATE vehicle_configs SET
  name        = 'Camión 3/4',
  description = 'Mudanza familiar. Cama, nevera, sofá y mobiliario completo. Hasta 15 m³.',
  base_price  = 65000,
  km_tiers    = '[{"max_km":40,"price_per_km":1000},{"max_km":100,"price_per_km":800},{"max_km":300,"price_per_km":600},{"max_km":9999,"price_per_km":450}]',
  extras      = '{"driver_help":20000,"helper":10000,"floor":5000,"packing":18000,"extra_m3":0,"partial_discount_pct":0}',
  updated_at  = now()
WHERE service_type = 'mudanza' AND vehicle_type = 'camion34';

-- Camión largo mudanza: casa grande o mudanza a regiones (hasta 30 m³)
UPDATE vehicle_configs SET
  name        = 'Camión Largo',
  description = 'Mudanza casa grande o traslado a regiones. Depto o casa de 2-3 dormitorios. Hasta 30 m³.',
  base_price  = 120000,
  km_tiers    = '[{"max_km":60,"price_per_km":1400},{"max_km":200,"price_per_km":1100},{"max_km":500,"price_per_km":800},{"max_km":9999,"price_per_km":600}]',
  extras      = '{"driver_help":20000,"helper":10000,"floor":6000,"packing":25000,"extra_m3":0,"partial_discount_pct":0}',
  updated_at  = now()
WHERE service_type = 'mudanza' AND vehicle_type = 'camionLargo';
