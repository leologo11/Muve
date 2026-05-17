-- Casos de prueba para entrenar el bot de cotizaciones MUVE
-- Ejecutar en Supabase SQL editor
-- TODOS los casos están a 4km — el servidor ajusta el km real automáticamente
-- Estos precios representan el COSTO DE LA CARGA (sin km)
-- Rangos reales de mercado MUVE:
--   Furgón:       $20.000 – $50.000 (carga sola, sin km)
--   Camión 3/4:   $60.000 – $100.000 (carga sola, sin km)
--   Camión Largo: $170.000 – $240.000 (carga sola, sin km)

INSERT INTO ai_quote_feedback
  (items_text, free_text, distance_km, origin, destination,
   num_helpers, num_floors,
   ai_vehicle, ai_vehicle_name, ai_detected_type,
   ai_price, ai_two_trips, status, notes)
VALUES

-- ═══════════════════════════════════════════════════════
-- FURGÓN — $20.000 a $50.000 (carga)
-- ═══════════════════════════════════════════════════════

(
  '2x Caja mediana, 1x TV hasta 50", 1x Microondas',
  '', 4, 'Santiago', 'Santiago', 0, 0,
  'furgon', 'Furgón N400', 'flete',
  20000, false, 'approved',
  'Flete muy liviano — furgón precio mínimo'
),
(
  '1x Cama 1 plaza, 3x Caja grande',
  '', 4, 'Santiago', 'Santiago', 0, 0,
  'furgon', 'Furgón N400', 'flete',
  28000, false, 'approved',
  'Flete simple — cama + cajas'
),
(
  '1x Sofá 2 plazas, 1x TV hasta 50", 2x Caja mediana',
  '', 4, 'Santiago', 'Santiago', 0, 0,
  'furgon', 'Furgón N400', 'flete',
  33000, false, 'approved',
  'Flete living liviano'
),
(
  '1x Cama 1 plaza, 1x Cómoda, 1x Escritorio, 4x Caja grande',
  '', 4, 'Santiago', 'Santiago', 0, 0,
  'furgon', 'Furgón N400', 'flete',
  38000, false, 'approved',
  'Flete pieza completa — ~4.5m3'
),
(
  '1x Cama 2 plazas, 1x Cómoda, 1x Mesa de noche, 5x Caja grande',
  '', 4, 'Santiago', 'Santiago', 0, 0,
  'furgon', 'Furgón N400', 'flete',
  48000, false, 'approved',
  'Furgón lleno — precio máximo furgón'
),

-- ═══════════════════════════════════════════════════════
-- CAMIÓN 3/4 — $60.000 a $100.000 (carga)
-- ═══════════════════════════════════════════════════════

(
  '1x Refrigerador, 1x Lavadora, 2x Caja grande',
  '', 4, 'Santiago', 'Santiago', 1, 0,
  'camion34', 'Camión 3/4', 'flete',
  60000, false, 'approved',
  'Flete artículos pesados — camión 3/4 precio mínimo'
),
(
  '1x Cama Queen/King, 1x Clóset/Ropero, 1x Cómoda, 1x Refrigerador, 1x Lavadora',
  '', 4, 'Santiago', 'Santiago', 1, 0,
  'camion34', 'Camión 3/4', 'mudanza',
  68000, false, 'approved',
  'Mudanza depto 1D completo — ~8.4m3'
),
(
  '2x Cama 2 plazas, 1x Clóset/Ropero, 1x Sofá 2 plazas, 1x Refrigerador, 1x Lavadora, 5x Caja grande',
  '', 4, 'Santiago', 'Santiago', 1, 0,
  'camion34', 'Camión 3/4', 'mudanza',
  78000, false, 'approved',
  'Mudanza depto 2D — ~12m3'
),
(
  '1x Cama Queen/King, 1x Clóset/Ropero, 1x Sofá 3 plazas, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 6x Caja grande',
  '', 4, 'Santiago', 'Santiago', 2, 0,
  'camion34', 'Camión 3/4', 'mudanza',
  88000, false, 'approved',
  'Mudanza depto 2D con cocina — ~14m3'
),
(
  '1x Cama Queen/King, 1x Cama 1 plaza, 1x Clóset/Ropero, 1x Cómoda, 1x Mesa de noche, 1x Sofá 2 plazas, 1x Mesa comedor, 4x Silla, 1x Refrigerador, 1x Lavadora, 8x Caja grande',
  '', 4, 'Santiago', 'Santiago', 2, 0,
  'camion34', 'Camión 3/4', 'mudanza',
  98000, false, 'approved',
  'Camión 3/4 lleno completo — ~14m3, precio máximo'
),

-- ═══════════════════════════════════════════════════════
-- CAMIÓN LARGO — $170.000 a $240.000 (carga)
-- Aplica cuando la carga supera un camión 3/4 (>15m3)
-- ═══════════════════════════════════════════════════════

(
  '2x Cama Queen/King, 2x Clóset/Ropero, 1x Cómoda, 1x Refrigerador, 1x Lavadora, 1x Sofá 2 plazas, 6x Caja grande',
  'casa 2-3 dormitorios con todo', 4, 'Santiago', 'Santiago', 2, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  170000, false, 'approved',
  'Camión largo — mudanza ~16m3, precio mínimo'
),
(
  '2x Cama Queen/King, 2x Clóset/Ropero, 2x Cómoda, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 1x Sofá 3 plazas, 1x Mesa comedor, 4x Silla, 8x Caja grande',
  '', 4, 'Santiago', 'Santiago', 2, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  182000, false, 'approved',
  'Mudanza casa 3D mediana — ~20m3'
),
(
  '2x Cama Queen/King, 2x Clóset/Ropero, 2x Cómoda, 2x Mesa de noche, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 1x Sofá 3 plazas, 1x Mesa comedor, 6x Silla, 8x Caja grande',
  '', 4, 'Santiago', 'Santiago', 2, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  195000, false, 'approved',
  'Mudanza casa 3D completa — ~24m3'
),
(
  '3x Cama Queen/King, 3x Clóset/Ropero, 2x Cómoda, 2x Mesa de noche, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 1x Sofá 3 plazas, 1x Mesa comedor, 6x Silla, 1x Escritorio, 10x Caja grande',
  '', 4, 'Santiago', 'Santiago', 3, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  210000, false, 'approved',
  'Mudanza casa 3D grande — ~27m3'
),
(
  '3x Cama Queen/King, 3x Clóset/Ropero, 3x Cómoda, 2x Mesa de noche, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 2x Sofá 3 plazas, 1x Mesa comedor, 8x Silla, 1x Escritorio, 12x Caja grande',
  'casa 4 dormitorios con todo el contenido', 4, 'Santiago', 'Santiago', 3, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  228000, false, 'approved',
  'Mudanza casa 4D — ~29m3'
),
(
  '3x Cama Queen/King, 3x Clóset/Ropero, 3x Cómoda, 2x Mesa de noche, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 2x Sofá 3 plazas, 1x Mesa comedor, 8x Silla, 2x Escritorio, 1x Librero/Estante, 15x Caja grande',
  'casa 4 dormitorios completa al máximo', 4, 'Santiago', 'Santiago', 3, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  240000, false, 'approved',
  'Camión largo al máximo — ~30m3, precio máximo'
),

-- ═══════════════════════════════════════════════════════
-- CASOS LÍMITE — requieren agente (>30m3)
-- ═══════════════════════════════════════════════════════

(
  '4x Cama Queen/King, 4x Clóset/Ropero, 3x Cómoda, 2x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 2x Sofá 3 plazas, 1x Mesa comedor, 8x Silla, 2x Escritorio, 20x Caja grande',
  'casa muy grande 5 dormitorios, todo el contenido', 4, 'Santiago', 'Santiago', 3, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  0, false, 'corrected',
  'AGENTE — mudanza >30m3, casa 5D. Precio acordado directamente con el cliente.'
),
(
  '3x Cama Queen/King, 4x Clóset/Ropero, 4x Cómoda, 2x Refrigerador, 2x Lavadora, 2x Cocina/Horno, 2x Sofá 3 plazas, 2x Mesa comedor, 10x Silla, 2x Escritorio, 25x Caja grande',
  'oficina o empresa grande', 4, 'Santiago', 'Santiago', 3, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  0, false, 'corrected',
  'AGENTE — traslado >30m3. No calculable automáticamente.'
);
