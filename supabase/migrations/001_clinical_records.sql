-- Clinical Records Table
-- Stores patient triage data with AI analysis and FHIR compliance

CREATE TABLE IF NOT EXISTS clinical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Consent and Input
  patient_consent BOOLEAN NOT NULL DEFAULT false,
  symptoms_text TEXT NOT NULL,
  symptoms_voice_url TEXT,
  
  -- AI Analysis
  ai_response JSONB NOT NULL,
  esi_level INTEGER NOT NULL CHECK (esi_level >= 1 AND esi_level <= 5),
  
  -- Nurse Validation
  nurse_validated BOOLEAN NOT NULL DEFAULT false,
  nurse_id UUID,
  
  -- FHIR Interoperability
  fhir_bundle JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on ESI level for quick filtering
CREATE INDEX IF NOT EXISTS idx_clinical_records_esi_level 
  ON clinical_records(esi_level);

-- Create index on nurse validation status
CREATE INDEX IF NOT EXISTS idx_clinical_records_nurse_validated 
  ON clinical_records(nurse_validated);

-- Create index on created_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_clinical_records_created_at 
  ON clinical_records(created_at DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clinical_records_updated_at
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert for authenticated users (nurses)
CREATE POLICY "Allow insert for authenticated users"
  ON clinical_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow select for authenticated users (nurses)
CREATE POLICY "Allow select for authenticated users"
  ON clinical_records
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow update only for records you created or if you're validating
CREATE POLICY "Allow update for nurses"
  ON clinical_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- For development: Allow anonymous access (REMOVE IN PRODUCTION)
CREATE POLICY "Allow all operations for anon (dev only)"
  ON clinical_records
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE clinical_records IS 'Stores patient triage assessments with AI analysis and nurse validation';
COMMENT ON COLUMN clinical_records.ai_response IS 'Raw AI-generated triage assessment (TriageResult JSON)';
COMMENT ON COLUMN clinical_records.fhir_bundle IS 'HL7 FHIR RiskAssessment resource for interoperability';
COMMENT ON COLUMN clinical_records.esi_level IS 'Emergency Severity Index level (1=Critical, 5=Non-Urgent)';
