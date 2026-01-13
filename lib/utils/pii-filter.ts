/**
 * PII (Personally Identifiable Information) Filter
 * 
 * Sanitizes patient input before sending to AI to comply with:
 * - Ley 19.628 (Chile) - Personal Data Protection
 * - HIPAA principles - Minimum necessary standard
 * 
 * @module lib/utils/pii-filter
 */

/**
 * Regex patterns for Chilean PII detection
 */
const PII_PATTERNS = {
    // Chilean RUT: 12.345.678-9 or 12345678-9 or 12.345.678-K
    rut: /\b\d{1,2}[.\s]?\d{3}[.\s]?\d{3}[-\s]?[\dkK]\b/gi,

    // Phone numbers: +56 9 1234 5678, 9 1234 5678, 912345678
    phone: /(?:\+?56\s?)?(?:9\s?\d{4}\s?\d{4}|\d{2}\s?\d{3}\s?\d{4})/g,

    // Email addresses
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

    // Chilean addresses: patterns with "calle", "av.", "pasaje", etc.
    address: /(?:calle|av\.?|avenida|pasaje|pje\.?|villa|población|pobl\.?)\s+[a-záéíóúñ\s]+\s*#?\s*\d+/gi,

    // Specific location references with numbers
    addressNumber: /(?:número|nro\.?|n°|#)\s*\d+/gi,

    // Common Chilean first names followed by last names pattern
    // This is conservative to avoid false positives
    fullName: /\b(?:mi nombre es|me llamo|soy)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3}/gi,

    // Credit card numbers (16 digits with optional spaces/dashes)
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,

    // Dates of birth patterns
    birthDate: /(?:nací el|nacido el|fecha de nacimiento|f\.?\s*nac\.?)\s*:?\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/gi,
};

/**
 * Replacement tokens for sanitized content
 */
const REPLACEMENTS: Record<keyof typeof PII_PATTERNS, string> = {
    rut: '[RUT_OCULTO]',
    phone: '[TELEFONO_OCULTO]',
    email: '[EMAIL_OCULTO]',
    address: '[DIRECCION_OCULTA]',
    addressNumber: '[NUMERO_OCULTO]',
    fullName: '[NOMBRE_OCULTO]',
    creditCard: '[TARJETA_OCULTA]',
    birthDate: '[FECHA_NAC_OCULTA]',
};

/**
 * Sanitizes text by removing personally identifiable information
 * 
 * @param text - Raw text input from patient
 * @returns Sanitized text with PII replaced by tokens
 * 
 * @example
 * ```ts
 * sanitizeForAI("Me duele el pecho, soy Juan Pérez, RUT 12.345.678-9")
 * // Returns: "Me duele el pecho, [NOMBRE_OCULTO], [RUT_OCULTO]"
 * ```
 */
export function sanitizeForAI(text: string): string {
    if (!text || typeof text !== 'string') {
        return '';
    }

    let sanitized = text;

    // Apply each pattern replacement
    for (const [key, pattern] of Object.entries(PII_PATTERNS)) {
        const replacement = REPLACEMENTS[key as keyof typeof PII_PATTERNS];
        sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized;
}

/**
 * Checks if text contains any PII patterns
 * 
 * @param text - Text to check
 * @returns true if PII is detected
 */
export function containsPII(text: string): boolean {
    if (!text || typeof text !== 'string') {
        return false;
    }

    for (const pattern of Object.values(PII_PATTERNS)) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
            return true;
        }
    }

    return false;
}

/**
 * Returns a report of detected PII types (for logging/auditing)
 * 
 * @param text - Text to analyze
 * @returns Array of PII types detected
 */
export function detectPIITypes(text: string): string[] {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const detected: string[] = [];

    for (const [key, pattern] of Object.entries(PII_PATTERNS)) {
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
            detected.push(key);
        }
    }

    return detected;
}

/**
 * Sanitization result with metadata
 */
export interface SanitizationResult {
    sanitizedText: string;
    hasPII: boolean;
    detectedTypes: string[];
    originalLength: number;
    sanitizedLength: number;
}

/**
 * Performs full sanitization with detailed result
 * 
 * @param text - Raw text to sanitize
 * @returns Sanitization result with metadata
 */
export function sanitizeWithReport(text: string): SanitizationResult {
    const detectedTypes = detectPIITypes(text);
    const sanitizedText = sanitizeForAI(text);

    return {
        sanitizedText,
        hasPII: detectedTypes.length > 0,
        detectedTypes,
        originalLength: text?.length ?? 0,
        sanitizedLength: sanitizedText.length,
    };
}
