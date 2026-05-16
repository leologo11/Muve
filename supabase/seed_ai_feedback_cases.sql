-- Casos de prueba para entrenar el bot de cotizaciones MUVE
-- Ejecutar en Supabase SQL editor
-- Precios reales de mercado MUVE:
--   Auto:         precio base + km
--   Furgón:       $20.000 – $50.000
--   Camión 3/4:   $60.000 – $100.000
--   Camión Largo: $170.000 – $240.000

INSERT INTO ai_quote_feedback
  (items_text, free_text, distance_km, origin, destination,
   num_helpers, num_floors,
   ai_vehicle, ai_vehicle_name, ai_detected_type,
   ai_price, ai_two_trips, status, notes)
VALUES

-- ═══════════════════════════════════════════════════════
-- FURGÓN — $20.000 a $50.000
-- ═══════════════════════════════════════════════════════

(
  '2x Caja mediana, 1x TV hasta 50", 1x Microondas',
  '', 5, 'Providencia', 'Ñuñoa', 0, 0,
  'furgon', 'Furgón N400', 'flete',
  20000, false, 'approved',
  'Flete muy liviano, 5km — furgón bajo'
),
(
  '1x Cama 1 plaza, 3x Caja grande',
  '', 8, 'Ñuñoa', 'Providencia', 0, 0,
  'furgon', 'Furgón N400', 'flete',
  30000, false, 'approved',
  'Flete simple — cama + cajas, 8km'
),
(
  '1x Sofá 2 plazas, 1x TV hasta 50", 2x Caja mediana',
  '', 10, 'Maipú', 'Pudahuel', 0, 0,
  'furgon', 'Furgón N400', 'flete',
  35000, false, 'approved',
  'Flete living liviano, 10km'
),
(
  '1x Cama 1 plaza, 1x Cómoda, 1x Escritorio, 4x Caja grande',
  '', 12, 'La Florida', 'San Miguel', 0, 0,
  'furgon', 'Furgón N400', 'flete',
  40000, false, 'approved',
  'Flete pieza completa, 12km — ~4.5m3'
),
(
  '1x Cama 2 plazas, 1x Cómoda, 1x Mesa de noche, 5x Caja grande',
  '', 15, 'Quilicura', 'Huechuraba', 0, 0,
  'furgon', 'Furgón N400', 'flete',
  50000, false, 'approved',
  'Furgón lleno, 15km — precio máximo furgón'
),

-- ═══════════════════════════════════════════════════════
-- CAMIÓN 3/4 — $60.000 a $100.000
-- ═══════════════════════════════════════════════════════

(
  '1x Refrigerador, 1x Lavadora, 2x Caja grande',
  '', 8, 'Las Condes', 'Vitacura', 1, 0,
  'camion34', 'Camión 3/4', 'flete',
  60000, false, 'approved',
  'Flete artículos pesados, 8km — camión 3/4 bajo'
),
(
  '1x Cama Queen/King, 1x Clóset/Ropero, 1x Cómoda, 1x Refrigerador, 1x Lavadora',
  '', 10, 'Las Condes', 'Vitacura', 1, 0,
  'camion34', 'Camión 3/4', 'mudanza',
  70000, false, 'approved',
  'Mudanza depto 1D completo, ~8.4m3, 10km'
),
(
  '2x Cama 2 plazas, 1x Clóset/Ropero, 1x Sofá 2 plazas, 1x Refrigerador, 1x Lavadora, 5x Caja grande',
  '', 12, 'Santiago Centro', 'La Reina', 1, 0,
  'camion34', 'Camión 3/4', 'mudanza',
  80000, false, 'approved',
  'Mudanza depto 2D, ~12m3, 12km'
),
(
  '1x Cama Queen/King, 1x Clóset/Ropero, 1x Sofá 3 plazas, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 6x Caja grande',
  '', 18, 'Puente Alto', 'La Florida', 2, 0,
  'camion34', 'Camión 3/4', 'mudanza',
  90000, false, 'approved',
  'Mudanza depto 2D con cocina, ~14m3, 18km'
),
(
  '1x Cama Queen/King, 1x Cama 1 plaza, 1x Clóset/Ropero, 1x Cómoda, 1x Mesa de noche, 1x Sofá 2 plazas, 1x Mesa comedor, 4x Silla, 1x Refrigerador, 1x Lavadora, 8x Caja grande',
  '', 10, 'Conchalí', 'Huechuraba', 2, 0,
  'camion34', 'Camión 3/4', 'mudanza',
  100000, false, 'approved',
  'Camión 3/4 lleno completo, ~14m3, 10km — precio máximo camión 3/4'
),

-- ═══════════════════════════════════════════════════════
-- CAMIÓN LARGO — $170.000 a $240.000
-- Aplica cuando la carga supera un camión 3/4 (>15m3)
-- ═══════════════════════════════════════════════════════

(
  '2x Cama Queen/King, 2x Clóset/Ropero, 1x Cómoda, 1x Refrigerador, 1x Lavadora, 1x Sofá 2 plazas, 6x Caja grande',
  'casa 2-3 dormitorios con todo', 10, 'Maipú', 'Cerrillos', 2, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  170000, false, 'approved',
  'Camión largo, mudanza ~16m3, 10km — precio mínimo camión largo'
),
(
  '2x Cama Queen/King, 2x Clóset/Ropero, 2x Cómoda, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 1x Sofá 3 plazas, 1x Mesa comedor, 4x Silla, 8x Caja grande',
  '', 12, 'San Bernardo', 'El Bosque', 2, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  180000, false, 'approved',
  'Mudanza casa 3D mediana, ~20m3, 12km'
),
(
  '2x Cama Queen/King, 2x Clóset/Ropero, 2x Cómoda, 2x Mesa de noche, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 1x Sofá 3 plazas, 1x Mesa comedor, 6x Silla, 8x Caja grande',
  '', 15, 'Las Condes', 'Lo Barnechea', 2, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  195000, false, 'approved',
  'Mudanza casa 3D completa, ~24m3, 15km'
),
(
  '3x Cama Queen/King, 3x Clóset/Ropero, 2x Cómoda, 2x Mesa de noche, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 1x Sofá 3 plazas, 1x Mesa comedor, 6x Silla, 1x Escritorio, 10x Caja grande',
  '', 12, 'Vitacura', 'Pudahuel', 3, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  210000, false, 'approved',
  'Mudanza casa 3D grande, ~27m3, 12km'
),
(
  '3x Cama Queen/King, 3x Clóset/Ropero, 3x Cómoda, 2x Mesa de noche, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 2x Sofá 3 plazas, 1x Mesa comedor, 8x Silla, 1x Escritorio, 12x Caja grande',
  'casa 4 dormitorios con todo el contenido', 10, 'Providencia', 'Ñuñoa', 3, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  230000, false, 'approved',
  'Mudanza casa 4D, ~29m3, 10km'
),
(
  '3x Cama Queen/King, 3x Clóset/Ropero, 3x Cómoda, 2x Mesa de noche, 1x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 2x Sofá 3 plazas, 1x Mesa comedor, 8x Silla, 2x Escritorio, 1x Librero/Estante, 15x Caja grande',
  'casa 4 dormitorios completa, máxima capacidad', 20, 'La Florida', 'Puente Alto', 3, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  240000, false, 'approved',
  'Camión largo al máximo ~30m3, 20km — precio máximo'
),

-- ═══════════════════════════════════════════════════════
-- CASOS LÍMITE — requieren agente (>30m3)
-- ═══════════════════════════════════════════════════════

(
  '4x Cama Queen/King, 4x Clóset/Ropero, 3x Cómoda, 2x Refrigerador, 1x Lavadora, 1x Cocina/Horno, 2x Sofá 3 plazas, 1x Mesa comedor, 8x Silla, 2x Escritorio, 20x Caja grande',
  'casa muy grande 5 dormitorios, todo el contenido', 15, 'Las Condes', 'La Reina', 3, 0,
  'camionLargo', 'Camión Largo', 'mudanza',
  0, false, 'corrected',
  'AGENTE — mudanza >30m3, casa 5D. Precio acordado directamente con el cliente.'
),
(
  '3x Cama Queen/King, 4x Clóset/Ropero, 4x Cómoda, 2x Refrigerador, 2x Lavadora, 2x Cocina/Horno, 2x Sofá 3 plazas, 2x Mesa comedor, 10x Silla, 2x Escritorio, 25x Caja grande',
  'empresa completa / oficina grande', 20, 'Providencia', 'Vitacura', 3, 1,
  'camionLargo', 'Camión Largo', 'mudanza',
  0, false, 'corrected',
  'AGENTE — oficina/empresa grande >30m3. No calculable automáticamente.'
);
