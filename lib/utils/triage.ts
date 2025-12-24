import { Database, AIResponse } from "@/lib/supabase/types";

type TriageRecord = Database["public"]["Tables"]["clinical_records"]["Row"];

/**
 * Extrae los campos del ai_response JSONB
 */
export function extractAIResponse(record: TriageRecord): {
  reasoning: string | null;
  criticalSigns: string[] | null;
  suggestedSpecialty: string | null;
  confidence: number | null;
} {
  if (!record.ai_response || typeof record.ai_response !== "object" || Array.isArray(record.ai_response)) {
    return {
      reasoning: null,
      criticalSigns: null,
      suggestedSpecialty: null,
      confidence: null,
    };
  }

  const aiResponse = record.ai_response as unknown as AIResponse;

  return {
    reasoning: aiResponse.reasoning || null,
    criticalSigns: aiResponse.critical_signs || null,
    suggestedSpecialty: aiResponse.suggested_specialty || null,
    confidence: aiResponse.confidence || null,
  };
}

