/**
 * Input validation and sanitization utilities
 */

/**
 * Sanitize user input text
 * Removes potentially harmful characters while preserving medical terminology
 */
export function sanitizeInput(input: string): string {
    return input
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/[<>]/g, ''); // Remove angle brackets
}

/**
 * Validate ESI level
 */
export function isValidESILevel(level: number): boolean {
    return Number.isInteger(level) && level >= 1 && level <= 5;
}

/**
 * Preprocess symptoms text for AI analysis
 * Standardizes common abbreviations and formatting
 */
export function preprocessSymptoms(symptoms: string): string {
    let processed = symptoms.trim();

    // Expand common abbreviations (Spanish medical terms)
    const abbreviations: Record<string, string> = {
        'Dx': 'diagnóstico',
        'Hx': 'historia',
        'Tx': 'tratamiento',
        'FR': 'frecuencia respiratoria',
        'FC': 'frecuencia cardíaca',
        'PA': 'presión arterial',
        'T°': 'temperatura',
    };

    Object.entries(abbreviations).forEach(([abbr, full]) => {
        const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
        processed = processed.replace(regex, full);
    });

    return processed;
}

/**
 * Extract numeric values from text (useful for vital signs)
 */
export function extractNumbers(text: string): number[] {
    const matches = text.match(/\d+/g);
    return matches ? matches.map(Number) : [];
}
