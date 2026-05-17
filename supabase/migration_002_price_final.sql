-- migration_002_price_final.sql
-- Agrega columna price_final a la tabla quotes
-- Ejecutar en Supabase SQL Editor

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS price_final integer;
