alter table packages
  add column if not exists delivery_meta jsonb not null default '{}'::jsonb;
