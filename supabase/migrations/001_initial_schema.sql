-- Tabla principal para registros clínicos de triage
CREATE TABLE IF NOT EXISTS clinical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_consent BOOLEAN NOT NULL DEFAULT false,
  symptoms_text TEXT NOT NULL,
  esi_level INTEGER NOT NULL CHECK (esi_level >= 1 AND esi_level <= 5),
  ai_reasoning TEXT,
  critical_signs TEXT[],
  suggested_specialty TEXT,
  confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
  nurse_validated BOOLEAN NOT NULL DEFAULT false,
  nurse_override_level INTEGER CHECK (nurse_override_level >= 1 AND nurse_override_level <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para mejorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_clinical_records_esi_level ON clinical_records(esi_level);
CREATE INDEX IF NOT EXISTS idx_clinical_records_nurse_validated ON clinical_records(nurse_validated);
CREATE INDEX IF NOT EXISTS idx_clinical_records_created_at ON clinical_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_records_pending_validation ON clinical_records(nurse_validated, created_at DESC) WHERE nurse_validated = false;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_clinical_records_updated_at
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Política básica para desarrollo
-- IMPORTANTE: En producción, implementar autenticación adecuada
ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserción (desarrollo)
CREATE POLICY "Allow insert for anon (dev only)"
  ON clinical_records
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Política para permitir lectura (desarrollo)
CREATE POLICY "Allow select for anon (dev only)"
  ON clinical_records
  FOR SELECT
  TO anon
  USING (true);

-- Política para permitir actualización (desarrollo)
CREATE POLICY "Allow update for anon (dev only)"
  ON clinical_records
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Comentarios para documentación
COMMENT ON TABLE clinical_records IS 'Registros de triage clínico asistido por IA';
COMMENT ON COLUMN clinical_records.esi_level IS 'Nivel ESI (1=Crítico, 5=No Urgente)';
COMMENT ON COLUMN clinical_records.nurse_validated IS 'Indica si la clasificación fue validada por enfermería';
COMMENT ON COLUMN clinical_records.nurse_override_level IS 'Nivel ESI asignado por enfermería si difiere del AI';

