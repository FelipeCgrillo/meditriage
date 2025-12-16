-- FHIR Mapping Function
-- Transforms AI triage results into HL7 FHIR RiskAssessment resources

CREATE OR REPLACE FUNCTION map_to_fhir()
RETURNS TRIGGER AS $$
DECLARE
  fhir_resource JSONB;
  esi_display TEXT;
  esi_code TEXT;
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
        'rationale', NEW.ai_response->>'reasoning'
      )
    ),
    'note', jsonb_build_array(
      jsonb_build_object(
        'text', 'Critical signs: ' || (NEW.ai_response->>'critical_signs')
      ),
      jsonb_build_object(
        'text', 'Suggested specialty: ' || (NEW.ai_response->>'suggested_specialty')
      )
    ),
    'performedDateTime', NEW.created_at::text
  );

  -- Set the FHIR bundle
  NEW.fhir_bundle := fhir_resource;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate FHIR bundle
DROP TRIGGER IF EXISTS trigger_map_to_fhir ON clinical_records;
CREATE TRIGGER trigger_map_to_fhir
  BEFORE INSERT OR UPDATE ON clinical_records
  FOR EACH ROW
  EXECUTE FUNCTION map_to_fhir();

COMMENT ON FUNCTION map_to_fhir IS 'Automatically transforms AI triage results into HL7 FHIR RiskAssessment resources';
