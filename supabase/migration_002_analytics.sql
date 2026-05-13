-- Analytics de funnel del cotizador público
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   text         UNIQUE NOT NULL,
  service_type text,
  max_step     int          DEFAULT 1 NOT NULL,
  submitted    boolean      DEFAULT false NOT NULL,
  created_at   timestamptz  DEFAULT now(),
  updated_at   timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_sessions_created ON analytics_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_sessions_service ON analytics_sessions(service_type);
