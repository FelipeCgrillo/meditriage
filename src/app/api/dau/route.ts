import { parseDAUJson } from '@/lib/dau/parser';
import { classifyBatch, DEFAULT_DAU_CONCURRENCY } from '@/lib/dau/classifyBatch';
import { summarizeDAU } from '@/lib/dau/summary';
import type { DAUBatchResponse } from '@/lib/dau/types';

export const runtime = 'edge';
// El lote puede tardar: una llamada al LLM por registro.
export const maxDuration = 300;

/**
 * POST /api/dau
 * Análisis retrospectivo batch de Datos de Atención de Urgencia (OE4 Vía B).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Recibe `{ records: DAURecord[] }` (o un arreglo directo). Para cada registro
 * SIMULA el chat del paciente: clasifica usando SOLO motivo de consulta +
 * síntomas relatados (texto libre) + sexo/edad. El `nurse_esi` es gold
 * standard y NUNCA entra al modelo. Devuelve `{ results, summary }` con
 * concordancia simple y matriz de confusión 5x5 (predicho vs enfermera).
 *
 * Robustez: ante body inválido → 400; sin API key → 503 explícito; cualquier
 * fallo individual de clasificación ya cae en el fallback seguro (needs_info).
 * ───────────────────────────────────────────────────────────────────────────
 */
export async function POST(req: Request): Promise<Response> {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return json({ error: 'Invalid JSON body' }, 400);
    }

    // El parser acepta tanto un arreglo directo como { records: [...] }.
    const { records, errors } = parseDAUJson(body);

    if (records.length === 0) {
        return json(
            {
                error: 'No se encontraron registros DAU válidos. Cada registro requiere chief_complaint / motivo_consulta.',
                parse_errors: errors,
            },
            400,
        );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('[dau] ANTHROPIC_API_KEY is not configured');
        return json(
            { error: 'El servicio de clasificación no está configurado (falta ANTHROPIC_API_KEY).' },
            503,
        );
    }

    const concurrency = parseConcurrency(req) ?? DEFAULT_DAU_CONCURRENCY;

    try {
        const results = await classifyBatch(records, concurrency);
        const summary = summarizeDAU(results);
        const payload: DAUBatchResponse = { results, summary };
        // Incluir errores de parseo como metadata no fatal.
        return json(errors.length > 0 ? { ...payload, parse_errors: errors } : payload, 200);
    } catch (error) {
        const e = error as { name?: string; message?: string } | null;
        console.error('[dau] batch classification error', { name: e?.name, message: e?.message });
        return json({ error: 'Fallo al procesar el lote DAU.' }, 500);
    }
}

/** Lee ?concurrency=N de la URL si viene; clamp a 1..10. */
function parseConcurrency(req: Request): number | null {
    try {
        const value = new URL(req.url).searchParams.get('concurrency');
        if (!value) return null;
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) return null;
        return Math.min(n, 10);
    } catch {
        return null;
    }
}

function json(data: unknown, status: number): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/** GET /api/dau — health check ligero que NO llama al modelo. */
export async function GET(): Promise<Response> {
    return json(
        {
            ok: true,
            ai_configured: Boolean(process.env.ANTHROPIC_API_KEY),
            default_concurrency: DEFAULT_DAU_CONCURRENCY,
        },
        200,
    );
}
