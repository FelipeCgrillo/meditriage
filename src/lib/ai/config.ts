/**
 * Configuración del modelo de lenguaje del estudio.
 *
 * El protocolo aprobado por el CEC (respuesta al oficio OBS-E-319-02,
 * observación 6) declara el modelo Claude Sonnet con identificador
 * `claude-sonnet-5`, con el compromiso de notificar al Comité cualquier
 * cambio. Por eso el valor por defecto queda fijo aquí y toda corrida
 * registra el identificador efectivo (ver protocol.ts).
 *
 * ANTHROPIC_MODEL permite sobrescribirlo por entorno, solo para desarrollo.
 * Un cambio de modelo en el entorno del estudio exige aviso previo al CEC.
 */
export const DEFAULT_ANTHROPIC_MODEL: string = 'claude-sonnet-5';

/**
 * Esfuerzo de razonamiento fijado para el estudio. Claude Sonnet 5 rechaza
 * los parámetros de muestreo (temperature, top_p, top_k), así que la
 * consistencia se controla con el esfuerzo fijo, el prompt congelado y el
 * motor de reglas determinista.
 *
 * Decisión: `medium` (antes `high`) para el análisis de unos 1.500 registros.
 * Reduce tiempo y costo por solicitud. El nivel crítico (ESI 1 y 2) no depende
 * del razonamiento del modelo: lo asegura el motor de reglas determinista, que
 * sobrescribe cualquier propuesta menos grave. Queda por justificar ante el CEC
 * y en la tesis, y por medir en la corrida de prueba contra `high`.
 */
export const ANTHROPIC_EFFORT = 'medium' as const;

/** Tope de tokens de salida por solicitud (respuesta estructurada acotada). */
export const ANTHROPIC_MAX_TOKENS = 16000;

/**
 * Resuelve el identificador del modelo en tiempo de ejecución.
 * Lee ANTHROPIC_MODEL si existe (sin espacios), si no devuelve el default.
 */
export function getAnthropicModelId(): string {
    const raw = process.env.ANTHROPIC_MODEL;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.length > 0) return trimmed;
    }
    return DEFAULT_ANTHROPIC_MODEL;
}

/** Verifica que la API key esté configurada. */
export function validateAIConfig(): boolean {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('ANTHROPIC_API_KEY is not configured');
        return false;
    }
    return true;
}
