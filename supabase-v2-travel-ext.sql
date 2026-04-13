-- v2 Phase B: Travel date extensions
ALTER TABLE travel_items
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS price_tier INTEGER,
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS couple_notes TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
