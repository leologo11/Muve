-- Agrega columnas de dispositivo y fuente de tráfico a analytics_sessions
ALTER TABLE analytics_sessions ADD COLUMN IF NOT EXISTS device text;
ALTER TABLE analytics_sessions ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS analytics_sessions_device ON analytics_sessions(device);
CREATE INDEX IF NOT EXISTS analytics_sessions_source ON analytics_sessions(source);
