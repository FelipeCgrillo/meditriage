/**
 * Clinical Content Parser
 * 
 * Structured detection of missing clinical data in patient input.
 * Implements the FLAGS algorithm from OE2 (ESTRATEGIA_DESARROLLO_OE2.md)
 * 
 * @module lib/ai/clinical-parser
 */

// ============================================================
// Types & Interfaces
// ============================================================

/**
 * Clinical FLAG types according to OE2 Table 10
 * Each type represents a category of missing clinical data
 */
export type ClinicalFlagType =
    | 'VAGUEDAD_SEMANTICA'    // Input without specific clinical content
    | 'SIN_TEMPORALIDAD'      // Symptom without onset indication
    | 'SIN_LOCALIZACION'      // Symptom without anatomical location
    | 'SIN_SEVERIDAD'         // Symptom without intensity indication
    | 'SIN_CONTEXTO';         // Missing relevant medical history

/**
 * Priority levels for FLAGS (1 = highest priority)
 * Based on OE2 prioritization table
 */
export const FLAG_PRIORITIES: Record<ClinicalFlagType, number> = {
    'VAGUEDAD_SEMANTICA': 1,  // Must resolve first - can't proceed without symptoms
    'SIN_LOCALIZACION': 2,    // Critical for any classification
    'SIN_TEMPORALIDAD': 3,    // Determines acuity
    'SIN_SEVERIDAD': 4,       // Refines classification
    'SIN_CONTEXTO': 5,        // Clinical context (comorbidities)
};

/**
 * Represents a detected clinical data gap
 */
export interface ClinicalFlag {
    type: ClinicalFlagType;
    priority: number;
    suggestedQuestion: string;
    suggestedOptions: string[];
    reason: string;
}

/**
 * Result of parsing clinical content
 */
export interface ClinicalParseResult {
    hasSymptom: boolean;
    hasTemporality: boolean;
    hasLocation: boolean;
    hasSeverity: boolean;
    detectedFlags: ClinicalFlag[];
    isComplete: boolean;
    priorityFlag: ClinicalFlag | null;
    extractedData: {
        symptomKeywords: string[];
        temporalityKeywords: string[];
        locationKeywords: string[];
        severityKeywords: string[];
    };
}

// ============================================================
// Detection Patterns
// ============================================================

/**
 * Patterns to detect specific symptoms (not vague statements)
 */
const SYMPTOM_PATTERNS = {
    keywords: [
        // Pain-related
        'dolor', 'duele', 'molestia', 'punzada', 'ardor', 'quemazón',
        // Respiratory
        'tos', 'dificultad para respirar', 'ahogo', 'falta de aire', 'disnea',
        // Gastrointestinal
        'náusea', 'vómito', 'diarrea', 'estreñimiento', 'acidez',
        // Neurological
        'mareo', 'vértigo', 'desmayo', 'confusión', 'convulsión',
        // General
        'fiebre', 'calentura', 'escalofríos', 'debilidad', 'fatiga', 'cansancio',
        // Cardiac
        'palpitaciones', 'taquicardia', 'opresión',
        // Dermatological
        'sarpullido', 'picazón', 'urticaria', 'hinchazón',
        // Bleeding
        'sangrado', 'hemorragia', 'sangre',
    ],
    // Vague expressions that DON'T count as symptoms
    vagueExpressions: [
        'me siento mal', 'no me siento bien', 'algo anda mal',
        'ayuda', 'necesito ayuda', 'estoy mal',
        'tengo pena', 'estoy triste', 'me siento raro',
    ],
};

/**
 * Patterns to detect temporality (onset, duration)
 */
const TEMPORALITY_PATTERNS = {
    keywords: [
        // Time units
        'minutos', 'horas', 'días', 'semanas', 'meses',
        // Temporal references
        'hace', 'desde hace', 'empezó', 'comenzó', 'inicio',
        'ayer', 'hoy', 'anoche', 'esta mañana', 'esta tarde',
        'recién', 'ahora mismo', 'de repente', 'súbitamente',
        // Duration
        'llevo', 'durante', 'desde el', 'desde ayer', 'desde hoy',
    ],
    patterns: [
        /hace\s+\d+\s*(minutos?|horas?|días?|semanas?|meses?)/i,
        /desde\s+hace\s+\d+/i,
        /llevo\s+\d+\s*(minutos?|horas?|días?)/i,
        /comenzó?\s+(ayer|hoy|anoche|esta\s+mañana)/i,
    ],
};

/**
 * Patterns to detect anatomical location
 */
const LOCATION_PATTERNS = {
    keywords: [
        // Head/Neck
        'cabeza', 'cuello', 'garganta', 'oído', 'ojos', 'nariz', 'boca', 'dientes',
        // Torso
        'pecho', 'tórax', 'espalda', 'abdomen', 'estómago', 'vientre', 'costillas',
        // Extremities
        'brazo', 'brazos', 'pierna', 'piernas', 'mano', 'manos', 'pie', 'pies',
        'rodilla', 'tobillo', 'muñeca', 'codo', 'hombro', 'cadera',
        // Internal
        'corazón', 'pulmón', 'riñón', 'hígado',
        // General body parts
        'cuerpo', 'todo el cuerpo',
    ],
};

/**
 * Patterns to detect severity/intensity
 */
const SEVERITY_PATTERNS = {
    keywords: [
        // Intensity descriptors
        'leve', 'moderado', 'fuerte', 'intenso', 'severo', 'insoportable',
        'mucho', 'poco', 'muy', 'bastante', 'terrible', 'horrible',
        // Numeric scale
        'escala', 'del 1 al 10',
    ],
    patterns: [
        /dolor\s+(leve|moderado|fuerte|intenso|severo)/i,
        /\d+\s*(de\s*10|sobre\s*10|\/10)/i,
        /(muy|bastante|poco)\s+(fuerte|intenso|leve)/i,
    ],
};

// ============================================================
// Question Bank (Based on OE2 Tables 11-15)
// ============================================================

const QUESTION_BANK: Record<ClinicalFlagType, { question: string; options: string[]; reason: string }> = {
    'VAGUEDAD_SEMANTICA': {
        question: '¿Puede describir qué síntomas específicos está sintiendo en este momento?',
        options: ['Dolor', 'Mareos', 'Náuseas', 'Fiebre', 'Dificultad para respirar', 'Otro'],
        reason: 'El input no contiene síntomas físicos específicos',
    },
    'SIN_LOCALIZACION': {
        question: '¿En qué parte del cuerpo siente el síntoma?',
        options: ['Pecho', 'Cabeza', 'Abdomen', 'Espalda', 'Extremidades', 'Otro'],
        reason: 'No se especificó la ubicación anatómica del síntoma',
    },
    'SIN_TEMPORALIDAD': {
        question: '¿Desde cuándo comenzó este síntoma?',
        options: ['Menos de 1 hora', 'Entre 1-6 horas', 'Entre 6-24 horas', 'Más de 1 día', 'Más de 1 semana'],
        reason: 'No se indicó cuándo comenzó el síntoma',
    },
    'SIN_SEVERIDAD': {
        question: 'En una escala del 1 al 10, ¿qué tan intenso es su síntoma?',
        options: ['1-3 (Leve)', '4-6 (Moderado)', '7-8 (Intenso)', '9-10 (Insoportable)'],
        reason: 'No se indicó la intensidad del síntoma',
    },
    'SIN_CONTEXTO': {
        question: '¿Tiene alguna condición médica previa que debamos saber?',
        options: ['Diabetes', 'Hipertensión', 'Problemas cardíacos', 'Ninguna', 'Otra'],
        reason: 'No se mencionaron antecedentes médicos relevantes',
    },
};

// ============================================================
// Detection Functions
// ============================================================

/**
 * Normalize text for pattern matching
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents for matching
        .trim();
}

/**
 * Check if text contains any vague expressions
 */
function isVagueInput(text: string): boolean {
    const normalized = normalizeText(text);
    return SYMPTOM_PATTERNS.vagueExpressions.some(expr =>
        normalized.includes(normalizeText(expr))
    );
}

/**
 * Detect if text contains specific symptoms
 */
export function detectSymptom(text: string): { found: boolean; keywords: string[] } {
    const normalized = normalizeText(text);

    // First check if it's a vague expression
    if (isVagueInput(text)) {
        return { found: false, keywords: [] };
    }

    const found: string[] = [];
    for (const keyword of SYMPTOM_PATTERNS.keywords) {
        if (normalized.includes(normalizeText(keyword))) {
            found.push(keyword);
        }
    }

    return { found: found.length > 0, keywords: found };
}

/**
 * Detect if text contains temporality information
 */
export function detectTemporality(text: string): { found: boolean; keywords: string[] } {
    const normalized = normalizeText(text);
    const found: string[] = [];

    // Check keywords
    for (const keyword of TEMPORALITY_PATTERNS.keywords) {
        if (normalized.includes(normalizeText(keyword))) {
            found.push(keyword);
        }
    }

    // Check patterns
    for (const pattern of TEMPORALITY_PATTERNS.patterns) {
        if (pattern.test(text)) {
            const match = text.match(pattern);
            if (match) found.push(match[0]);
        }
    }

    return { found: found.length > 0, keywords: Array.from(new Set(found)) };
}

/**
 * Detect if text contains anatomical location
 */
export function detectLocation(text: string): { found: boolean; keywords: string[] } {
    const normalized = normalizeText(text);
    const found: string[] = [];

    for (const keyword of LOCATION_PATTERNS.keywords) {
        if (normalized.includes(normalizeText(keyword))) {
            found.push(keyword);
        }
    }

    return { found: found.length > 0, keywords: found };
}

/**
 * Detect if text contains severity indicators
 */
export function detectSeverity(text: string): { found: boolean; keywords: string[] } {
    const normalized = normalizeText(text);
    const found: string[] = [];

    // Check keywords
    for (const keyword of SEVERITY_PATTERNS.keywords) {
        if (normalized.includes(normalizeText(keyword))) {
            found.push(keyword);
        }
    }

    // Check patterns
    for (const pattern of SEVERITY_PATTERNS.patterns) {
        if (pattern.test(text)) {
            const match = text.match(pattern);
            if (match) found.push(match[0]);
        }
    }

    return { found: found.length > 0, keywords: Array.from(new Set(found)) };
}

/**
 * Create a ClinicalFlag object for a given type
 */
function createFlag(type: ClinicalFlagType): ClinicalFlag {
    const bank = QUESTION_BANK[type];
    return {
        type,
        priority: FLAG_PRIORITIES[type],
        suggestedQuestion: bank.question,
        suggestedOptions: bank.options,
        reason: bank.reason,
    };
}

/**
 * Get the highest priority flag from a list
 */
export function getPriorityFlag(flags: ClinicalFlag[]): ClinicalFlag | null {
    if (flags.length === 0) return null;
    return flags.reduce((min, flag) =>
        flag.priority < min.priority ? flag : min
    );
}

// ============================================================
// Main Parser Function
// ============================================================

/**
 * Parse clinical content and detect missing data (FLAGS)
 * 
 * Implements the algorithm from OE2 (lines 367-395):
 * 1. Check for specific symptom
 * 2. Check for temporality
 * 3. Check for location
 * 4. Check for severity
 * 5. Generate FLAGS for missing data
 * 6. Return priority FLAG for follow-up question
 * 
 * @param text - Sanitized patient input
 * @returns ClinicalParseResult with detected FLAGS
 */
export function parseClinicalContent(text: string): ClinicalParseResult {
    // Run all detections
    const symptomResult = detectSymptom(text);
    const temporalityResult = detectTemporality(text);
    const locationResult = detectLocation(text);
    const severityResult = detectSeverity(text);

    const detectedFlags: ClinicalFlag[] = [];

    // Step 1: Check for vagueness (no specific symptom)
    if (!symptomResult.found) {
        detectedFlags.push(createFlag('VAGUEDAD_SEMANTICA'));
    } else {
        // Only check other flags if we have a symptom

        // Step 2: Check for location
        if (!locationResult.found) {
            detectedFlags.push(createFlag('SIN_LOCALIZACION'));
        }

        // Step 3: Check for temporality
        if (!temporalityResult.found) {
            detectedFlags.push(createFlag('SIN_TEMPORALIDAD'));
        }

        // Step 4: Check for severity
        if (!severityResult.found) {
            detectedFlags.push(createFlag('SIN_SEVERIDAD'));
        }
    }

    // Sort flags by priority
    detectedFlags.sort((a, b) => a.priority - b.priority);

    // Determine if data is complete (no critical flags)
    // We consider complete if we have symptom + location + temporality
    const isComplete = symptomResult.found &&
        locationResult.found &&
        temporalityResult.found;

    return {
        hasSymptom: symptomResult.found,
        hasTemporality: temporalityResult.found,
        hasLocation: locationResult.found,
        hasSeverity: severityResult.found,
        detectedFlags,
        isComplete,
        priorityFlag: getPriorityFlag(detectedFlags),
        extractedData: {
            symptomKeywords: symptomResult.keywords,
            temporalityKeywords: temporalityResult.keywords,
            locationKeywords: locationResult.keywords,
            severityKeywords: severityResult.keywords,
        },
    };
}

/**
 * Get a summary string of detected FLAGS for logging/debugging
 */
export function getFlagsSummary(result: ClinicalParseResult): string {
    if (result.isComplete) {
        return 'Datos clínicos completos';
    }

    const flagNames = result.detectedFlags.map(f => f.type).join(', ');
    return `FLAGS detectados: ${flagNames}`;
}
