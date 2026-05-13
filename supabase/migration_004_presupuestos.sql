CREATE TABLE IF NOT EXISTS presupuestos (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code                text        UNIQUE NOT NULL,
  date                date        NOT NULL DEFAULT CURRENT_DATE,
  valid_days          int         DEFAULT 7,
  client_name         text,
  client_phone        text,
  client_email        text,
  origin_address      text,
  destination_address text,
  distance_km         numeric,
  show_km             boolean     DEFAULT false,
  items               jsonb       DEFAULT '[]'::jsonb,
  subtotal            numeric     DEFAULT 0,
  discount            numeric     DEFAULT 0,
  include_iva         boolean     DEFAULT false,
  iva_amount          numeric     DEFAULT 0,
  total               numeric     DEFAULT 0,
  notes               text,
  status              text        DEFAULT 'draft',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presupuestos_created ON presupuestos(created_at DESC);
CREATE INDEX IF NOT EXISTS presupuestos_status  ON presupuestos(status);
