-- 1. Secure clinical_records RLS policy for anonymous users
DROP POLICY IF EXISTS "Allow all operations for anon (dev only)" ON clinical_records;
DROP POLICY IF EXISTS "Allow insert for anon" ON clinical_records;

-- Create policy allowing patients (anon users) to ONLY insert their records
-- with strict integrity checks to prevent spam/garbage insertions
CREATE POLICY "Allow insert for anon"
  ON clinical_records
  FOR INSERT
  TO anon
  WITH CHECK (
    patient_consent = true
    AND symptoms_text IS NOT NULL
    AND length(symptoms_text) >= 3
    AND ai_response IS NOT NULL
    AND esi_level >= 1 AND esi_level <= 5
  );

-- 2. Update map_to_fhir function to be null-safe and robust
CREATE OR REPLACE FUNCTION map_to_fhir()
RETURNS TRIGGER AS $$
DECLARE
  fhir_resource JSONB;
  esi_display TEXT;
  esi_code TEXT;
  reasoning_text TEXT;
  critical_signs_text TEXT;
  suggested_specialty_text TEXT;
BEGIN
  -- Map ESI level to FHIR qualitative risk coding
  CASE NEW.esi_level
    WHEN 1 THEN
      esi_code := 'LA6752-5';
      esi_display := 'High risk';
    WHEN 2 THEN
      esi_code := 'LA6752-5';
      esi_display := 'High risk';
    WHEN 3 THEN
      esi_code := 'LA6751-7';
      esi_display := 'Moderate risk';
    WHEN 4 THEN
      esi_code := 'LA6748-3';
      esi_display := 'Low risk';
    WHEN 5 THEN
      esi_code := 'LA6748-3';
      esi_display := 'Low risk';
    ELSE
      esi_code := 'LA6751-7';
      esi_display := 'Moderate risk';
  END CASE;

  -- Safe extraction of JSON parameters
  IF NEW.ai_response IS NOT NULL AND jsonb_typeof(NEW.ai_response) = 'object' THEN
    reasoning_text := COALESCE(NEW.ai_response->>'reasoning', '');
    critical_signs_text := COALESCE(NEW.ai_response->>'critical_signs', 'None');
    suggested_specialty_text := COALESCE(NEW.ai_response->>'suggested_specialty', 'General');
  ELSE
    reasoning_text := 'No reasoning provided';
    critical_signs_text := 'None';
    suggested_specialty_text := 'General';
  END IF;

  -- Build FHIR RiskAssessment resource
  fhir_resource := jsonb_build_object(
    'resourceType', 'RiskAssessment',
    'id', NEW.id::text,
    'status', CASE WHEN NEW.nurse_validated THEN 'final' ELSE 'preliminary' END,
    'method', jsonb_build_object(
      'coding', jsonb_build_array(
        jsonb_build_object(
          'system', 'http://cesfam.cl/triage-methods',
          'code', 'ESI-AI',
          'display', 'Emergency Severity Index - AI Assisted'
        )
      )
    ),
    'prediction', jsonb_build_array(
      jsonb_build_object(
        'outcome', jsonb_build_object(
          'text', 'ESI Level ' || NEW.esi_level::text
        ),
        'qualitativeRisk', jsonb_build_object(
          'coding', jsonb_build_array(
            jsonb_build_object(
              'system', 'http://loinc.org',
              'code', esi_code,
              'display', esi_display
            )
          )
        ),
        'rationale', reasoning_text
      )
    ),
    'note', jsonb_build_array(
      jsonb_build_object(
        'text', 'Critical signs: ' || critical_signs_text
      ),
      jsonb_build_object(
        'text', 'Suggested specialty: ' || suggested_specialty_text
      )
    ),
    'performedDateTime', NEW.created_at::text
  );

  -- Set the FHIR bundle
  NEW.fhir_bundle := fhir_resource;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
