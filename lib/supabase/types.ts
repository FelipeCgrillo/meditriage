import type { TriageResult } from '../ai/schemas';

/**
 * AI Response structure stored in ai_response JSONB field
 */
export interface AIResponse {
    reasoning?: string;
    critical_signs?: string[];
    suggested_specialty?: string;
    confidence?: number;
    esi_level?: number;
}

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
    esi_level: number; // AI-generated ESI classification (what the AI suggested)
    nurse_validated: boolean;
    nurse_esi_level: number | null; // Nurse's independent ESI classification BEFORE seeing AI (critical for Kappa)
    nurse_override_level: number | null; // Final ESI level if nurse changes opinion AFTER seeing AI
    feedback_enfermero: string | null; // Nurse's textual feedback on ESI classification (critical thesis requirement)
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
}

/**
 * Update type for clinical records
 */
export interface ClinicalRecordUpdate {
    nurse_validated?: boolean;
    nurse_esi_level?: number | null; // Nurse's independent ESI classification BEFORE seeing AI
    nurse_override_level?: number | null; // Final ESI level if nurse changes opinion AFTER seeing AI
    feedback_enfermero?: string | null; // Nurse's textual feedback on ESI classification
    nurse_id?: string;
    esi_level?: number;
    updated_at?: string;
    ai_response?: Json;
    fhir_bundle?: Json;
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
