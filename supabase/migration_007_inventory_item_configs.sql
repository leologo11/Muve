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
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into inventory_item_configs (item_key, name, icon, category, volume_m3, min_vehicle_type, required_helpers, sort_order)
values
('cama1p', 'Cama 1 plaza', '🛏️', 'Dormitorio', 1.5, 'furgon', 0, 10),
('cama2p', 'Cama 2 plazas', '🛏️', 'Dormitorio', 2.0, 'camion34', 1, 20),
('camaQueen', 'Cama Queen/King', '🛏️', 'Dormitorio', 2.8, 'camion34', 1, 30),
('closet', 'Closet/Ropero', '🪞', 'Dormitorio', 2.5, 'camion34', 1, 40),
('comoda', 'Comoda', '🗄️', 'Dormitorio', 0.8, 'furgon', 0, 50),
('mesaNoche', 'Mesa de noche', '🪑', 'Dormitorio', 0.3, 'furgon', 0, 60),
('sofa2p', 'Sofa 2 plazas', '🛋️', 'Living', 2.0, 'furgon', 1, 70),
('sofa3p', 'Sofa 3 plazas', '🛋️', 'Living', 3.2, 'camion34', 1, 80),
('tvSmall', 'TV hasta 50"', '📺', 'Living', 0.3, 'furgon', 0, 90),
('tvLarge', 'TV 55" o mas', '📺', 'Living', 0.6, 'furgon', 0, 100),
('mesaComedor', 'Mesa comedor', '🍽️', 'Comedor', 1.2, 'furgon', 0, 110),
('silla', 'Silla (x1)', '🪑', 'Comedor', 0.3, 'furgon', 0, 120),
('nevera', 'Refrigerador', '🧊', 'Cocina', 1.5, 'camion34', 1, 130),
('cocina', 'Cocina/Horno', '🍳', 'Cocina', 1.0, 'camion34', 1, 140),
('microondas', 'Microondas', '📦', 'Cocina', 0.1, 'furgon', 0, 150),
('lavadora', 'Lavadora', '🫧', 'Electrodomesticos', 0.8, 'furgon', 1, 160),
('secadora', 'Secadora', '🌀', 'Electrodomesticos', 0.8, 'furgon', 1, 170),
('escritorio', 'Escritorio', '💻', 'Oficina', 0.8, 'furgon', 0, 180),
('librero', 'Librero/Estante', '📚', 'Oficina', 1.0, 'furgon', 0, 190),
('cajaP', 'Caja pequena', '📦', 'Cajas', 0.08, 'furgon', 0, 200),
('cajaM', 'Caja mediana', '📦', 'Cajas', 0.18, 'furgon', 0, 210),
('cajaG', 'Caja grande', '📦', 'Cajas', 0.35, 'furgon', 0, 220)
on conflict (item_key) do update set
  name = excluded.name,
  icon = excluded.icon,
  category = excluded.category,
  volume_m3 = excluded.volume_m3,
  min_vehicle_type = excluded.min_vehicle_type,
  required_helpers = excluded.required_helpers,
  sort_order = excluded.sort_order,
  updated_at = now();
