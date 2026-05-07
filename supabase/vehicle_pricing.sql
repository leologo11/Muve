-- Ejecuta este archivo en Supabase SQL Editor (después del schema.sql principal)
-- Es idempotente: se puede correr múltiples veces sin duplicar datos.

-- Tabla de configuración de precios por vehículo
create table if not exists vehicle_configs (
  id uuid primary key default gen_random_uuid(),
  vehicle_type text not null,
  name text not null,
  description text not null default '',
  base_price numeric not null default 0,
  km_tiers jsonb not null default '[{"max_km":50,"price_per_km":1000},{"max_km":150,"price_per_km":800},{"max_km":400,"price_per_km":600},{"max_km":9999,"price_per_km":400}]',
  extras jsonb not null default '{"driver_help":20000,"helper":15000,"floor":5000,"packing":15000}',
  active boolean not null default true,
  only_regions boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice único para evitar duplicados al re-correr el script
-- (ALTER TABLE ADD CONSTRAINT IF NOT EXISTS no es válido en PostgreSQL)
create unique index if not exists vehicle_configs_vehicle_type_idx on vehicle_configs (vehicle_type);

alter table vehicle_configs enable row level security;

-- Elimina duplicados dejando el registro más antiguo (por si el script se corrió varias veces antes del constraint)
delete from vehicle_configs a using vehicle_configs b
  where a.created_at > b.created_at and a.vehicle_type = b.vehicle_type;

-- Upsert: inserta o actualiza los 3 vehículos base
insert into vehicle_configs (vehicle_type, name, description, base_price, km_tiers, extras, active, only_regions, sort_order)
values
(
  'furgon', 'Furgón',
  'Ideal para cajas, muebles pequeños y cargas de poco volumen. Carga máxima ~1 ton.',
  20000,
  '[{"max_km":50,"price_per_km":1000},{"max_km":150,"price_per_km":800},{"max_km":400,"price_per_km":600},{"max_km":9999,"price_per_km":400}]',
  '{"driver_help":20000,"helper":15000,"floor":5000,"packing":15000}',
  true, false, 1
),
(
  'camion34', 'Camión 3/4',
  'Recomendado para mudanzas familiares. Nevera, cama, sofá y más. Carga máxima ~3 ton.',
  35000,
  '[{"max_km":50,"price_per_km":1000},{"max_km":150,"price_per_km":800},{"max_km":400,"price_per_km":600},{"max_km":9999,"price_per_km":400}]',
  '{"driver_help":20000,"helper":15000,"floor":5000,"packing":15000}',
  true, false, 2
),
(
  'camionLargo', 'Camión Largo',
  'Para mudanzas completas a regiones desde Santiago. Solo disponible para trayectos de más de 100 km.',
  80000,
  '[{"max_km":200,"price_per_km":700},{"max_km":500,"price_per_km":550},{"max_km":9999,"price_per_km":400}]',
  '{"driver_help":20000,"helper":15000,"floor":6000,"packing":20000}',
  true, true, 3
)
on conflict (vehicle_type) do update set
  name        = excluded.name,
  description = excluded.description,
  base_price  = excluded.base_price,
  km_tiers    = excluded.km_tiers,
  extras      = excluded.extras,
  sort_order  = excluded.sort_order,
  updated_at  = now();

-- Columna vehicles en app_users (array de { type, plate } para drivers)
alter table app_users add column if not exists vehicles jsonb default '[]';

-- Nuevas columnas en quotes (idempotentes)
alter table quotes add column if not exists vehicle_type text;
alter table quotes add column if not exists distance_km numeric;
alter table quotes add column if not exists origin_address text;
alter table quotes add column if not exists origin_coords jsonb;
alter table quotes add column if not exists destination_address text;
alter table quotes add column if not exists destination_coords jsonb;
alter table quotes add column if not exists driver_helps boolean default false;
alter table quotes add column if not exists num_helpers integer default 0;
alter table quotes add column if not exists num_floors integer default 0;
alter table quotes add column if not exists needs_packing boolean default false;
alter table quotes add column if not exists is_conserjeria boolean default false;
alter table quotes add column if not exists items_description text;
alter table quotes add column if not exists price_min numeric;
alter table quotes add column if not exists price_max numeric;
