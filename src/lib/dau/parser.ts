import type { DAURecord, DAUAgeGroup, DAUSex, ESILevel } from '@/lib/dau/types';

/**
 * Parser de registros DAU retrospectivos desde JSON o CSV.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * RESTRICCIÓN METODOLÓGICA (no negociable):
 *   El parser SOLO extrae los campos que pueden entrar al modelo
 *   (chief_complaint + reported_symptoms + sex/age) más el gold standard
 *   (nurse_esi). Cualquier columna de signos vitales instrumentados del DAU
 *   (PA, FC, FR, temperatura, SatO2, dolor medido) se IGNORA por completo: ni
 *   siquiera se lee a una estructura intermedia, para que sea imposible
 *   inyectarla al CMD aguas abajo.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Resultado de parsear un archivo: registros válidos + errores por fila. */
export interface DAUParseResult {
    records: DAURecord[];
    /** Errores no fatales: filas descartadas con su motivo. */
    errors: DAUParseError[];
}

export interface DAUParseError {
    /** Índice de fila (1-based, sin contar cabecera en CSV). */
    row: number;
    reason: string;
}

/**
 * Diccionario de alias de cabeceras en español/inglés → campo canónico de
 * DAURecord. Las claves se normalizan (minúsculas, sin acentos, sin espacios
 * ni guiones) antes de buscar aquí.
 */
const HEADER_ALIASES: Record<string, keyof DAURecord> = {
    // record_id
    record_id: 'record_id',
    recordid: 'record_id',
    id: 'record_id',
    folio: 'record_id',
    codigo: 'record_id',
    nro: 'record_id',
    numero: 'record_id',
    // age_years
    age_years: 'age_years',
    ageyears: 'age_years',
    age: 'age_years',
    edad: 'age_years',
    edad_anios: 'age_years',
    edad_anos: 'age_years',
    anios: 'age_years',
    // age_group
    age_group: 'age_group',
    agegroup: 'age_group',
    grupo_etario: 'age_group',
    grupoetario: 'age_group',
    rango_etario: 'age_group',
    // sex
    sex: 'sex',
    sexo: 'sex',
    genero: 'sex',
    gender: 'sex',
    // admission_datetime
    admission_datetime: 'admission_datetime',
    admissiondatetime: 'admission_datetime',
    fecha_ingreso: 'admission_datetime',
    fechaingreso: 'admission_datetime',
    fecha: 'admission_datetime',
    fecha_hora: 'admission_datetime',
    ingreso: 'admission_datetime',
    // chief_complaint
    chief_complaint: 'chief_complaint',
    chiefcomplaint: 'chief_complaint',
    motivo_consulta: 'chief_complaint',
    motivoconsulta: 'chief_complaint',
    motivo: 'chief_complaint',
    motivo_de_consulta: 'chief_complaint',
    queja_principal: 'chief_complaint',
    // reported_symptoms
    reported_symptoms: 'reported_symptoms',
    reportedsymptoms: 'reported_symptoms',
    sintomas: 'reported_symptoms',
    sintomas_relatados: 'reported_symptoms',
    sintomatologia: 'reported_symptoms',
    antecedentes: 'reported_symptoms',
    relato: 'reported_symptoms',
    descripcion: 'reported_symptoms',
    // nurse_esi
    nurse_esi: 'nurse_esi',
    nurseesi: 'nurse_esi',
    esi_enfermera: 'nurse_esi',
    esienfermera: 'nurse_esi',
    esi: 'nurse_esi',
    categoria: 'nurse_esi',
    categoria_esi: 'nurse_esi',
    triage: 'nurse_esi',
    nivel_triage: 'nurse_esi',
    c1_c5: 'nurse_esi',
};

/** Normaliza una cabecera: minúsculas, sin acentos, sin separadores. */
function normalizeHeader(raw: string): string {
    return raw
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[\s\-.]+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

/** Mapea sexo en español/inglés a DAUSex. Devuelve null si no reconoce. */
function coerceSex(value: string | null | undefined): DAUSex | null {
    if (value == null) return null;
    const v = value.trim().toLowerCase();
    if (v === '') return null;
    if (['m', 'masculino', 'male', 'hombre', 'h', 'varon'].includes(v)) return 'M';
    if (['f', 'femenino', 'female', 'mujer'].includes(v)) return 'F';
    if (['o', 'other', 'otro', 'x', 'no_binario', 'nb'].includes(v)) return 'Other';
    return null;
}

/** Mapea grupo etario textual a DAUAgeGroup. Devuelve null si no reconoce. */
function coerceAgeGroup(value: string | null | undefined): DAUAgeGroup | null {
    if (value == null) return null;
    const v = value.trim().toLowerCase();
    if (v === '') return null;
    if (['pediatric', 'pediatrico', 'pediatría', 'pediatria', 'niño', 'nino', 'infantil'].includes(v))
        return 'Pediatric';
    if (['adult', 'adulto'].includes(v)) return 'Adult';
    if (['geriatric', 'geriatrico', 'geriátrico', 'anciano', 'adulto_mayor', 'mayor'].includes(v))
        return 'Geriatric';
    return null;
}

/** Deriva el grupo etario a partir de la edad en años. */
export function ageGroupFromYears(age: number): DAUAgeGroup {
    if (age < 18) return 'Pediatric';
    if (age >= 65) return 'Geriatric';
    return 'Adult';
}

/** Coerciona un valor a ESILevel (1..5) o null. Acepta "C3", "3", etc. */
function coerceEsi(value: unknown): ESILevel | null {
    if (value == null) return null;
    const s = String(value).trim().toLowerCase().replace(/^c/, '');
    if (s === '') return null;
    const n = Number(s);
    if (!Number.isInteger(n) || n < 1 || n > 5) return null;
    return n as ESILevel;
}

/** Coerciona la edad a número positivo o null. */
function coerceAge(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 130) return null;
    return n;
}

/** Normaliza un valor de texto libre: trim, vacío → null. */
function coerceText(value: unknown): string | null {
    if (value == null) return null;
    const s = String(value).trim();
    return s.length > 0 ? s : null;
}

/**
 * Construye un DAURecord a partir de un objeto plano (de JSON o de una fila
 * CSV ya mapeada a campos canónicos). Devuelve el record o un motivo de error.
 * Si falta age_group pero hay age_years, lo deriva.
 */
function buildRecord(
    obj: Partial<Record<keyof DAURecord, unknown>>,
    fallbackId: string,
): { record: DAURecord } | { error: string } {
    const chiefComplaint = coerceText(obj.chief_complaint);
    if (!chiefComplaint) {
        return { error: 'falta chief_complaint / motivo_consulta' };
    }

    const recordId = coerceText(obj.record_id) ?? fallbackId;
    const ageYears = coerceAge(obj.age_years);
    let ageGroup = coerceAgeGroup(obj.age_group as string | null | undefined);
    if (!ageGroup && ageYears != null) {
        ageGroup = ageGroupFromYears(ageYears);
    }

    const record: DAURecord = {
        record_id: recordId,
        age_years: ageYears,
        age_group: ageGroup,
        sex: coerceSex(obj.sex as string | null | undefined),
        admission_datetime: coerceText(obj.admission_datetime),
        chief_complaint: chiefComplaint,
        reported_symptoms: coerceText(obj.reported_symptoms),
        nurse_esi: coerceEsi(obj.nurse_esi),
    };
    return { record };
}

/**
 * Parsea un arreglo JSON de registros DAU. Tolera claves en español o inglés
 * usando el mismo diccionario de alias que el CSV. Descarta filas sin
 * chief_complaint registrando el error.
 */
export function parseDAUJson(input: unknown): DAUParseResult {
    const records: DAURecord[] = [];
    const errors: DAUParseError[] = [];

    // Aceptar tanto un arreglo directo como { records: [...] }.
    const arr = Array.isArray(input)
        ? input
        : input && typeof input === 'object' && Array.isArray((input as { records?: unknown }).records)
          ? (input as { records: unknown[] }).records
          : null;

    if (!arr) {
        errors.push({ row: 0, reason: 'El JSON no es un arreglo ni { records: [...] }' });
        return { records, errors };
    }

    arr.forEach((item, index) => {
        const row = index + 1;
        if (!item || typeof item !== 'object') {
            errors.push({ row, reason: 'fila no es un objeto' });
            return;
        }
        // Remapear claves del objeto JSON vía alias.
        const mapped: Partial<Record<keyof DAURecord, unknown>> = {};
        for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
            const canonical = HEADER_ALIASES[normalizeHeader(key)];
            if (canonical) mapped[canonical] = value;
        }
        const result = buildRecord(mapped, `rec_${row}`);
        if ('error' in result) {
            errors.push({ row, reason: result.error });
        } else {
            records.push(result.record);
        }
    });

    return { records, errors };
}

/**
 * Tokeniza una sola línea CSV respetando comillas dobles y comas internas.
 * Soporta comillas escapadas como "".
 */
function splitCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cur += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',' || ch === ';') {
            out.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    out.push(cur);
    return out;
}

/**
 * Parsea CSV tolerante con alias de cabeceras en español. Detecta delimitador
 * coma o punto y coma. Descarta filas sin chief_complaint registrando el
 * error. Las columnas no reconocidas (incl. signos vitales instrumentados) se
 * ignoran silenciosamente.
 */
export function parseDAUCsv(text: string): DAUParseResult {
    const records: DAURecord[] = [];
    const errors: DAUParseError[] = [];

    const lines = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter((l) => l.trim().length > 0);

    if (lines.length === 0) {
        errors.push({ row: 0, reason: 'CSV vacío' });
        return { records, errors };
    }

    const headerCells = splitCsvLine(lines[0]).map(normalizeHeader);
    const columnMap: (keyof DAURecord | null)[] = headerCells.map((h) => HEADER_ALIASES[h] ?? null);

    if (!columnMap.includes('chief_complaint')) {
        errors.push({
            row: 0,
            reason: 'No se encontró columna de motivo de consulta (chief_complaint/motivo_consulta)',
        });
        return { records, errors };
    }

    for (let i = 1; i < lines.length; i++) {
        const row = i; // 1-based sin contar cabecera
        const cells = splitCsvLine(lines[i]);
        const mapped: Partial<Record<keyof DAURecord, unknown>> = {};
        columnMap.forEach((canonical, idx) => {
            if (canonical) mapped[canonical] = cells[idx];
        });
        const result = buildRecord(mapped, `rec_${row}`);
        if ('error' in result) {
            errors.push({ row, reason: result.error });
        } else {
            records.push(result.record);
        }
    }

    return { records, errors };
}

/**
 * Punto de entrada agnóstico: detecta si el contenido es JSON o CSV y delega.
 * Útil para la UI, que recibe un archivo cargado sin tipo fiable.
 */
export function parseDAUFile(content: string): DAUParseResult {
    const trimmed = content.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
            return parseDAUJson(JSON.parse(trimmed));
        } catch (e) {
            return {
                records: [],
                errors: [{ row: 0, reason: `JSON inválido: ${(e as Error).message}` }],
            };
        }
    }
    return parseDAUCsv(content);
}
