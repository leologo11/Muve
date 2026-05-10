-- Separar pisos de retiro y entrega en cotizaciones.
-- Ejecutar en Supabase SQL Editor. Es idempotente.

alter table quotes
  add column if not exists origin_floors integer not null default 0,
  add column if not exists destination_floors integer not null default 0;

-- Compatibilidad con cotizaciones antiguas: si solo existia num_floors,
-- lo dejamos en retiro para no perder el cobro historico.
update quotes
set origin_floors = coalesce(nullif(origin_floors, 0), coalesce(num_floors, 0)),
    destination_floors = coalesce(destination_floors, 0)
where coalesce(num_floors, 0) > 0
  and coalesce(origin_floors, 0) = 0
  and coalesce(destination_floors, 0) = 0;
