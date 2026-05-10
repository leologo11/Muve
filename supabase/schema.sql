-- MUVE Supabase schema
-- Ejecuta este archivo en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rut text,
  address text,
  contact_person text,
  contact_email text,
  contact_phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'driver', 'company', 'customer')),
  company_id uuid references companies(id) on delete set null,
  active boolean not null default true,
  phone text,
  vehicle text,
  license_plate text,
  company_name text,
  rut text,
  location jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tariffs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  default_price numeric not null default 3500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tariff_items (
  id uuid primary key default gen_random_uuid(),
  tariff_id uuid not null references tariffs(id) on delete cascade,
  commune text not null,
  price numeric not null default 0,
  zone text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  quote_code text not null unique,
  share_token text unique,
  service_type text not null default 'flete' check (service_type in ('flete', 'mudanza', 'paqueteria')),
  origin text not null default '',
  destination text not null default '',
  move_size text not null default '',
  status text not null default 'draft' check (status in ('draft', 'sent', 'submitted', 'approved', 'rejected')),
  tariff_id uuid references tariffs(id) on delete set null,
  client_company text not null default '',
  contact_person text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  delivery_date timestamptz,
  admin_notes text not null default '',
  client_notes text not null default '',
  driver_id uuid references app_users(id) on delete set null,
  converted_route_id uuid,
  vehicle_type text,
  distance_km numeric,
  origin_address text,
  origin_coords jsonb,
  destination_address text,
  destination_coords jsonb,
  driver_helps boolean default false,
  num_helpers integer default 0,
  num_floors integer default 0,
  origin_floors integer default 0,
  destination_floors integer default 0,
  needs_packing boolean default false,
  is_conserjeria boolean default false,
  items_description text,
  price_min numeric,
  price_max numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  customer_name text not null default '',
  customer_last_name text not null default '',
  customer_phone text not null default '',
  address text not null,
  commune text not null default '',
  price numeric not null default 0,
  lat double precision,
  lng double precision,
  note text not null default '',
  created_at timestamptz not null default now()
);

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

create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  route_code text not null unique,
  name text,
  date timestamptz not null default now(),
  driver_id uuid references app_users(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  tariff_id uuid references tariffs(id) on delete set null,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'completed', 'cancelled')),
  client_company jsonb not null default '{}'::jsonb,
  invoice jsonb not null default '{}'::jsonb,
  driver_payout numeric,
  driver_settlement jsonb not null default '{"status":"pending","mode":"proportional_delivered","baseAmount":0,"adjustment":0}'::jsonb,
  start_point jsonb not null default '{}'::jsonb,
  distance_km numeric,
  share_token text unique,
  stats jsonb not null default '{"total":0,"delivered":0,"failed":0,"pending":0,"totalAmount":0,"collectedAmount":0}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table quotes
  drop constraint if exists quotes_converted_route_id_fkey;

alter table quotes
  add constraint quotes_converted_route_id_fkey
  foreign key (converted_route_id) references routes(id) on delete set null;

create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  tracking_id text not null unique,
  company_id uuid references companies(id) on delete set null,
  route_id uuid references routes(id) on delete set null,
  customer_name text not null,
  customer_last_name text,
  customer_phone text,
  address text not null,
  commune text,
  apt_floor text,
  zone text,
  price numeric not null default 0,
  lat double precision,
  lng double precision,
  stop_order integer not null default 0,
  status text not null default 'pendiente' check (status in ('pendiente', 'entregado', 'no-entregado', 'devuelto', 'eliminado')),
  fail_reason text,
  note text,
  photo_url text,
  photo_public_id text,
  photo_uploaded_at timestamptz,
  photo2_url text,
  photo2_public_id text,
  photo2_uploaded_at timestamptz,
  ai_flags text[] not null default '{}',
  history jsonb not null default '[]'::jsonb,
  delivered_at timestamptz,
  delivered_by uuid references app_users(id) on delete set null,
  delivery_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null default 0,
  color text not null default '#5c35cc',
  source text not null default 'custom' check (source in ('commune', 'custom')),
  polygon jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists price_configs (
  id uuid primary key default gen_random_uuid(),
  commune text not null unique,
  price numeric not null default 0,
  zone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists api_credentials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_id text not null unique,
  secret_hash text not null,
  prefix text not null,
  revoked boolean not null default false,
  created_by uuid references app_users(id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_created_at on quotes(created_at desc);
create index if not exists idx_quotes_status on quotes(status);
create index if not exists idx_quotes_service_type on quotes(service_type);
create index if not exists idx_quote_items_quote_id on quote_items(quote_id);
create index if not exists idx_routes_date on routes(date desc);
create index if not exists idx_routes_status on routes(status);
create index if not exists idx_packages_route_id on packages(route_id);
create index if not exists idx_packages_status on packages(status);

alter table companies enable row level security;
alter table app_users enable row level security;
alter table tariffs enable row level security;
alter table tariff_items enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table routes enable row level security;
alter table packages enable row level security;
alter table zones enable row level security;
alter table price_configs enable row level security;
alter table api_credentials enable row level security;

-- El backend usa SUPABASE_SERVICE_ROLE_KEY, que omite RLS.
-- No creamos policies publicas por seguridad.
