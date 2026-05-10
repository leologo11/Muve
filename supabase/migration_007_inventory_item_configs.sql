-- Catalogo editable de articulos para el cotizador de fletes/mudanzas.
-- Ejecutar en Supabase SQL Editor. Es idempotente.

create table if not exists inventory_item_configs (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  name text not null,
  icon text not null default '📦',
  category text not null default 'Otros',
  volume_m3 numeric not null default 0,
  min_vehicle_type text not null default 'furgon' check (min_vehicle_type in ('furgon', 'camion34', 'camionLargo')),
  required_helpers integer not null default 0,
  is_heavy boolean not null default false,
  is_fragile boolean not null default false,
  is_long boolean not null default false,
  is_tall boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inventory_item_configs add column if not exists is_heavy boolean not null default false;
alter table inventory_item_configs add column if not exists is_fragile boolean not null default false;
alter table inventory_item_configs add column if not exists is_long boolean not null default false;
alter table inventory_item_configs add column if not exists is_tall boolean not null default false;

insert into inventory_item_configs (item_key, name, icon, category, volume_m3, min_vehicle_type, required_helpers, is_heavy, is_fragile, is_long, is_tall, sort_order)
values
('cama1p', 'Cama 1 plaza', '🛏️', 'Dormitorio', 1.5, 'furgon', 0, false, false, true, false, 10),
('cama2p', 'Cama 2 plazas', '🛏️', 'Dormitorio', 2.0, 'camion34', 1, true, false, true, false, 20),
('camaQueen', 'Cama Queen/King', '🛏️', 'Dormitorio', 2.8, 'camion34', 1, true, false, true, false, 30),
('closet', 'Closet/Ropero', '🪞', 'Dormitorio', 2.5, 'camion34', 1, true, false, false, true, 40),
('comoda', 'Comoda', '🗄️', 'Dormitorio', 0.8, 'furgon', 0, false, false, false, false, 50),
('mesaNoche', 'Mesa de noche', '🪑', 'Dormitorio', 0.3, 'furgon', 0, false, false, false, false, 60),
('sofa2p', 'Sofa 2 plazas', '🛋️', 'Living', 2.0, 'furgon', 1, true, false, true, false, 70),
('sofa3p', 'Sofa 3 plazas', '🛋️', 'Living', 3.2, 'camion34', 1, true, false, true, false, 80),
('tvSmall', 'TV hasta 50"', '📺', 'Living', 0.3, 'furgon', 0, false, true, false, false, 90),
('tvLarge', 'TV 55" o mas', '📺', 'Living', 0.6, 'furgon', 0, false, true, false, false, 100),
('mesaComedor', 'Mesa comedor', '🍽️', 'Comedor', 1.2, 'furgon', 0, false, false, false, false, 110),
('silla', 'Silla (x1)', '🪑', 'Comedor', 0.3, 'furgon', 0, false, false, false, false, 120),
('nevera', 'Refrigerador', '🧊', 'Cocina', 1.5, 'camion34', 1, true, false, false, true, 130),
('cocina', 'Cocina/Horno', '🍳', 'Cocina', 1.0, 'camion34', 1, true, false, false, true, 140),
('microondas', 'Microondas', '📦', 'Cocina', 0.1, 'furgon', 0, false, false, false, false, 150),
('lavadora', 'Lavadora', '🫧', 'Electrodomesticos', 0.8, 'furgon', 1, true, false, false, false, 160),
('secadora', 'Secadora', '🌀', 'Electrodomesticos', 0.8, 'furgon', 1, true, false, false, false, 170),
('escritorio', 'Escritorio', '💻', 'Oficina', 0.8, 'furgon', 0, false, false, false, false, 180),
('librero', 'Librero/Estante', '📚', 'Oficina', 1.0, 'furgon', 0, false, false, false, true, 190),
('cajaP', 'Caja pequena', '📦', 'Cajas', 0.08, 'furgon', 0, false, false, false, false, 200),
('cajaM', 'Caja mediana', '📦', 'Cajas', 0.18, 'furgon', 0, false, false, false, false, 210),
('cajaG', 'Caja grande', '📦', 'Cajas', 0.35, 'furgon', 0, false, false, false, false, 220)
on conflict (item_key) do update set
  name = excluded.name,
  icon = excluded.icon,
  category = excluded.category,
  volume_m3 = excluded.volume_m3,
  min_vehicle_type = excluded.min_vehicle_type,
  required_helpers = excluded.required_helpers,
  is_heavy = excluded.is_heavy,
  is_fragile = excluded.is_fragile,
  is_long = excluded.is_long,
  is_tall = excluded.is_tall,
  sort_order = excluded.sort_order,
  updated_at = now();
