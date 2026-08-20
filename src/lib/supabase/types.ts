import type { TriageResult } from '../ai/schemas';

/**
 * Database schema types
 */
export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            clinical_records: {
                Row: ClinicalRecord;
                Insert: ClinicalRecordInsert;
                Update: ClinicalRecordUpdate;
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            [_ in never]: never;
        };
    };
}

/**
 * Clinical Record stored in database
 */
export interface ClinicalRecord {
    id: string;
    anonymous_code: string | null; // Human-readable code (ABC-123) for patient identification
    patient_consent: boolean;
    symptoms_text: string;
    symptoms_voice_url: string | null;
    ai_response: Json; // Using Json type for JSONB
    esi_level: number;
    nurse_validated: boolean;
    nurse_override_level: number | null; // Nurse's independent ESI classification
    nurse_id: string | null;
    fhir_bundle: Json | null; // Using Json type for JSONB
    created_at: string;
    updated_at: string;
    // Demographic fields for equity analysis (optional - may be null)
    patient_gender?: string | null;
    patient_age_group?: string | null;
    consent_eligible?: boolean | null;
    // Conversation history from AI follow-up questions
    conversation_history?: Json | null;
    // CMD estructurado auto-reportado (migración 009)
    cmd_features?: Json | null;
    // Vía de atención derivada del ESI (migración 011)
    disposition?: 'emergency' | 'same_day_primary_care' | 'next_day_primary_care' | null;
    // Tenant (migración 012). NOT NULL en DB: siempre presente en lecturas.
    organization_id: string;
}

/**
 * Insert type for clinical records
 */
export interface ClinicalRecordInsert {
    id?: string;
    anonymous_code?: string; // Generated anonymous patient code
    patient_consent: boolean;
    symptoms_text: string;
    symptoms_voice_url?: string | null;
    ai_response: Json;
    esi_level: number;
    nurse_validated?: boolean;
    nurse_id?: string | null;
    fhir_bundle?: Json | null;
    conversation_history?: Json | null;
    // CMD estructurado auto-reportado (migración 009)
    cmd_features?: Json | null;
    // Vía de atención derivada del ESI (migración 011)
    disposition?: 'emergency' | 'same_day_primary_care' | 'next_day_primary_care' | null;
    // Tenant (migración 012). NOT NULL en DB: obligatorio al insertar.
    organization_id: string;
}

/**
 * Update type for clinical records
 */
export interface ClinicalRecordUpdate {
    nurse_validated?: boolean;
    nurse_override_level?: number; // Nurse's independent ESI classification
    nurse_id?: string;
    esi_level?: number;
    updated_at?: string;
    ai_response?: Json;
    fhir_bundle?: Json;
}

/**
 * Organización / tenant (migración 012).
 *
 * Un CESFAM, hospital o servicio de salud. Todos los datos clínicos y de
 * usuarios se aislan por `organization_id`. El slug es el identificador
 * URL-safe que aparece en el link del paciente (/paciente?org=<slug>).
 */
export interface Organization {
    id: string;
    slug: string;
    name: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * User profile (migración 006 + extensión 012).
 *
 * `organization_id` es NULL solo para el admin de plataforma (rol `admin`
 * sin tenant asignado, que administra la instalación completa).
 */
export interface UserProfile {
    id: string;
    email: string;
    role: 'nurse' | 'researcher' | 'admin';
    full_name: string | null;
    organization_id: string | null;
    is_active: boolean;
    must_change_password: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * HL7 FHIR RiskAssessment Resource
 * Simplified version for interoperability
 */
export interface FHIRRiskAssessment {
    resourceType: 'RiskAssessment';
    id: string;
    status: 'final' | 'preliminary';
    method: {
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
    };
    prediction: Array<{
        outcome: {
            text: string;
        };
        qualitativeRisk: {
            coding: Array<{
                system: string;
                code: string;
                display: string;
            }>;
        };
        rationale: string;
    }>;
    note?: Array<{
        text: string;
    }>;
    performedDateTime: string;
}

/**
 * HL7 FHIR R4 Observation Resource (versión simplificada).
 *
 * Representa un hallazgo clínico AUTO-REPORTADO por el paciente (no una
 * medición instrumentada). Cada Observation lleva una nota "self-reported"
 * y su código en SNOMED CT (hallazgos) o LOINC (signos referidos).
 */
export interface FHIRObservation {
    resourceType: 'Observation';
    id: string;
    // 'preliminary' hasta que la enfermera valide; coherente con RiskAssessment.
    status: 'preliminary' | 'final';
    category?: Array<{
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
    }>;
    code: {
        coding: Array<{
            system: string;
            code: string;
            display: string;
        }>;
        text?: string;
    };
    valueBoolean?: boolean;
    valueString?: string;
    valueQuantity?: {
        value: number;
        unit: string;
        system: string;
        code: string;
    };
    note?: Array<{
        text: string;
    }>;
    effectiveDateTime: string;
}

/**
 * HL7 FHIR R4 Bundle (type: collection) que agrupa el RiskAssessment del
 * triage junto con las Observations auto-reportadas.
 */
export interface FHIRBundle {
    resourceType: 'Bundle';
    type: 'collection';
    timestamp: string;
    entry: Array<{
        resource: FHIRRiskAssessment | FHIRObservation;
    }>;
}
