-- Add anonymous_code column to clinical_records table
-- This provides a human-readable code for patient identification without personal data
-- Format: ABC-123 (easy to communicate verbally)

ALTER TABLE clinical_records 
ADD COLUMN IF NOT EXISTS anonymous_code VARCHAR(7);

-- Create unique index for quick lookups and to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinical_records_anonymous_code 
ON clinical_records(anonymous_code) 
WHERE anonymous_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN clinical_records.anonymous_code IS 'Human-readable code (ABC-123) for anonymous patient identification during triage validation';
