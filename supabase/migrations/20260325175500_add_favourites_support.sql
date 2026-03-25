-- Add is_favourite column to updates and scan_summaries
ALTER TABLE updates ADD COLUMN IF NOT EXISTS is_favourite BOOLEAN DEFAULT false;
ALTER TABLE scan_summaries ADD COLUMN IF NOT EXISTS is_favourite BOOLEAN DEFAULT false;

-- Add index for performance in Favourites view
CREATE INDEX IF NOT EXISTS idx_updates_is_favourite ON updates(is_favourite) WHERE is_favourite = true;
CREATE INDEX IF NOT EXISTS idx_scan_summaries_is_favourite ON scan_summaries(is_favourite) WHERE is_favourite = true;
