-- Migration: Add nurse_esi_level column for blind validation methodology
-- Purpose: Store nurse's independent ESI classification BEFORE seeing AI suggestion
-- Critical for thesis metrics: Cohen's Kappa, Sensitivity, Specificity
--
-- Date: 2025-12-21
-- Author: Database Administrator

-- Add nurse_esi_level column (nullable initially for backward compatibility)
ALTER TABLE clinical_records 
ADD COLUMN IF NOT EXISTS nurse_esi_level INTEGER CHECK (nurse_esi_level >= 1 AND nurse_esi_level <= 5);

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_clinical_records_nurse_esi_level 
  ON clinical_records(nurse_esi_level);

-- Update column comments for clarity
COMMENT ON COLUMN clinical_records.esi_level IS 'AI-generated ESI classification (1-5). This is the AI suggestion shown to the nurse.';
COMMENT ON COLUMN clinical_records.nurse_esi_level IS 'Nurse independent ESI classification (1-5) made BEFORE seeing AI suggestion. Critical for Kappa calculation.';
COMMENT ON COLUMN clinical_records.nurse_override_level IS 'Final ESI level if nurse changes opinion AFTER seeing AI suggestion. NULL means nurse agreed with their initial classification.';

-- Note: Column esi_level was NOT renamed to ai_esi_level to avoid breaking existing code
-- In practice: esi_level = AI suggestion, nurse_esi_level = nurse initial opinion

