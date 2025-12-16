-- Add nurse_override_level column to clinical_records table
-- This column stores the nurse's independent ESI classification for blind validation

ALTER TABLE clinical_records 
ADD COLUMN IF NOT EXISTS nurse_override_level INTEGER CHECK (nurse_override_level >= 1 AND nurse_override_level <= 5);

-- Add index for filtering by nurse override level
CREATE INDEX IF NOT EXISTS idx_clinical_records_nurse_override_level 
  ON clinical_records(nurse_override_level);

-- Add comment to document the column purpose
COMMENT ON COLUMN clinical_records.nurse_override_level IS 'Nurse independent ESI classification (1-5) for blind validation methodology';
