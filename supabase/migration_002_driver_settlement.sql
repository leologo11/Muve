alter table routes
  add column if not exists driver_settlement jsonb not null
  default '{"status":"pending","mode":"proportional_delivered","baseAmount":0,"adjustment":0}'::jsonb;
