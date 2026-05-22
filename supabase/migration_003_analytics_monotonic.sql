-- Migration 003: analytics_sessions monotonic trigger
-- Garantiza que max_step nunca baje y submitted nunca revierta de true a false.
-- Esto resuelve la race condition cuando múltiples eventos llegan concurrentes:
-- el trigger es atómico a nivel DB, no hay window entre read y write.
--
-- Ejecutar en Supabase → SQL Editor

CREATE OR REPLACE FUNCTION analytics_sessions_monotonic()
RETURNS TRIGGER AS $$
BEGIN
  -- max_step solo avanza, nunca retrocede
  NEW.max_step = GREATEST(NEW.max_step, OLD.max_step);

  -- submitted nunca vuelve de true a false
  IF OLD.submitted = TRUE THEN
    NEW.submitted = TRUE;
  END IF;

  -- device y source solo se setean la primera vez (en el landing)
  -- si ya estaban guardados, se preservan
  NEW.device = COALESCE(OLD.device, NEW.device);
  NEW.source = COALESCE(OLD.source, NEW.source);

  -- service_type: usar el nuevo si viene, sino preservar el anterior
  NEW.service_type = COALESCE(NEW.service_type, OLD.service_type);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS analytics_sessions_monotonic_trigger ON analytics_sessions;

CREATE TRIGGER analytics_sessions_monotonic_trigger
  BEFORE UPDATE ON analytics_sessions
  FOR EACH ROW EXECUTE FUNCTION analytics_sessions_monotonic();
