-- Migration: make packages independent of routes, add company_id, add history
-- Run this in Supabase SQL Editor

-- 1. Make route_id nullable (packages can exist without a route)
ALTER TABLE packages ALTER COLUMN route_id DROP NOT NULL;

-- 2. Change cascade delete to SET NULL (deleting a route must NOT delete packages)
ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_route_id_fkey;
ALTER TABLE packages
  ADD CONSTRAINT packages_route_id_fkey
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL;

-- 3. Add company_id (proveedor — mandatory going forward but nullable for existing rows)
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

-- 4. Add history log
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_packages_company_id ON packages(company_id);
CREATE INDEX IF NOT EXISTS idx_packages_route_id_null ON packages(route_id) WHERE route_id IS NULL;
