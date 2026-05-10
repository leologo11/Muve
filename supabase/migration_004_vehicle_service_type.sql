-- Separar precios de Fletes y Mudanzas en vehicle_configs.
-- Ejecutar en Supabase SQL Editor. Es idempotente.

alter table vehicle_configs
  add column if not exists service_type text not null default 'flete';

update vehicle_configs
set service_type = 'flete'
where service_type is null;

drop index if exists vehicle_configs_vehicle_type_idx;

create unique index if not exists vehicle_configs_service_vehicle_idx
  on vehicle_configs (service_type, vehicle_type);

-- Asegura que los precios existentes queden como Fletes.
update vehicle_configs
set service_type = 'flete'
where service_type not in ('flete', 'mudanza');

-- Crea la seccion de Mudanzas copiando la estructura de Fletes, pero:
-- 1) sube el precio base del camion,
-- 2) deja el m3 adicional en 0 porque mudanza se cobra como camion completo.
insert into vehicle_configs (
  service_type,
  vehicle_type,
  name,
  description,
  base_price,
  km_tiers,
  extras,
  active,
  only_regions,
  sort_order
)
select
  'mudanza',
  vehicle_type,
  name,
  case vehicle_type
    when 'furgon' then 'Mudanza pequena o studio. Servicio por camion completo, no por m3 adicional.'
    when 'camion34' then 'Mudanza familiar. Cama, nevera, sofa y mobiliario principal. Camion completo.'
    when 'camionLargo' then 'Mudanza completa o a regiones. Camion largo completo.'
    else 'Mudanza por camion completo.'
  end,
  case vehicle_type
    when 'furgon' then greatest(base_price, 30000)
    when 'camion34' then greatest(base_price, 55000)
    when 'camionLargo' then greatest(base_price, 110000)
    else round(base_price * 1.35)
  end,
  km_tiers,
  jsonb_set(
    jsonb_set(coalesce(extras, '{}'::jsonb), '{extra_m3}', '0'::jsonb, true),
    '{included_m3}', '0'::jsonb, true
  ),
  active,
  only_regions,
  sort_order
from vehicle_configs
where service_type = 'flete'
on conflict (service_type, vehicle_type) do nothing;
