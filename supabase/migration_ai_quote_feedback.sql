-- Migration: AI quote feedback table for self-improving pricing agent
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS ai_quote_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  items_text text NOT NULL DEFAULT '',
  items_json jsonb,
  free_text text DEFAULT '',
  distance_km numeric,
  origin text DEFAULT '',
  destination text DEFAULT '',
  num_helpers int DEFAULT 0,
  num_floors int DEFAULT 0,
  ai_vehicle text DEFAULT '',
  ai_vehicle_name text DEFAULT '',
  ai_detected_type text DEFAULT '',
  ai_price int DEFAULT 0,
  ai_two_trips boolean DEFAULT false,
  status text NOT NULL CHECK (status IN ('approved', 'corrected')),
  correct_price int,
  correct_vehicle text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Index for fast retrieval of recent examples
CREATE INDEX IF NOT EXISTS idx_ai_quote_feedback_created ON ai_quote_feedback(created_at DESC);

-- No RLS needed — backend uses service_role_key
