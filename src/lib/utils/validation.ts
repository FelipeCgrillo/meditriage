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

/**
 * Tolerant JSON extractor for LLM responses.
 *
 * LLMs sometimes wrap JSON in markdown fences or prepend a stray sentence
 * even when the system prompt forbids it. This finds the first balanced
 * JSON object substring and parses it; returns null if nothing parseable
 * is present. Never throws.
 */
export function extractJSON<T = unknown>(raw: string): T | null {
    if (!raw || typeof raw !== 'string') return null;

    const tryParse = (s: string): T | null => {
        try {
            return JSON.parse(s) as T;
        } catch {
            return null;
        }
    };

    // Fast path: already valid JSON.
    const direct = tryParse(raw.trim());
    if (direct !== null) return direct;

    // Strip a markdown fence if present (```json ... ``` or ``` ... ```).
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence) {
        const fromFence = tryParse(fence[1].trim());
        if (fromFence !== null) return fromFence;
    }

    // Scan for the first balanced { ... } object, respecting strings.
    const start = raw.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < raw.length; i++) {
        const ch = raw[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\') {
            escape = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) {
                return tryParse(raw.slice(start, i + 1));
            }
        }
    }

    return null;
}

/**
 * Unifies color classes for ESI levels based on Tailwind configurations
 */
export function getESIColor(level: number): string {
    const colors: Record<number, string> = {
        1: 'bg-esi-1 text-white',
        2: 'bg-esi-2 text-white',
        3: 'bg-esi-3 text-slate-900',
        4: 'bg-esi-4 text-white',
        5: 'bg-esi-5 text-white',
    };
    return colors[level] || 'bg-slate-200 text-slate-600';
}
