-- Migration: Add demographic columns for algorithmic equity analysis
-- This migration adds columns needed for bias/equity analysis in the clinical validation study

-- Add patient gender (optional - may be null for existing records)
ALTER TABLE clinical_records 
ADD COLUMN IF NOT EXISTS patient_gender TEXT;

-- Add patient age group (optional - may be null for existing records)
ALTER TABLE clinical_records 
ADD COLUMN IF NOT EXISTS patient_age_group TEXT;

-- Add consent eligibility flag (defaults to true for existing records)
ALTER TABLE clinical_records 
ADD COLUMN IF NOT EXISTS consent_eligible BOOLEAN DEFAULT true;

-- Add check constraints for valid values
ALTER TABLE clinical_records 
ADD CONSTRAINT check_patient_gender 
CHECK (patient_gender IS NULL OR patient_gender IN ('M', 'F', 'Other', 'Prefer not to say'));

ALTER TABLE clinical_records 
ADD CONSTRAINT check_patient_age_group 
CHECK (patient_age_group IS NULL OR patient_age_group IN ('Pediatric', 'Adult', 'Geriatric'));

-- Create indexes for demographic analysis queries
CREATE INDEX IF NOT EXISTS idx_clinical_records_gender 
ON clinical_records(patient_gender);

CREATE INDEX IF NOT EXISTS idx_clinical_records_age_group 
ON clinical_records(patient_age_group);

CREATE INDEX IF NOT EXISTS idx_clinical_records_consent_eligible 
ON clinical_records(consent_eligible);

-- Comments for documentation
COMMENT ON COLUMN clinical_records.patient_gender IS 'Patient gender for equity analysis (M, F, Other, Prefer not to say)';
COMMENT ON COLUMN clinical_records.patient_age_group IS 'Patient age group for demographic analysis (Pediatric, Adult, Geriatric)';
COMMENT ON COLUMN clinical_records.consent_eligible IS 'Whether the patient provided valid consent for study inclusion';
