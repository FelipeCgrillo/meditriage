import type { DAURecord, DAUAgeGroup, DAUOutcome, DAUSex, ESILevel } from '@/lib/dau/types';

/**
 * Parser de registros DAU retrospectivos desde JSON o CSV.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * RESTRICCIÓN METODOLÓGICA (no negociable):
 *   El parser SOLO extrae los campos que pueden entrar al modelo
 *   (chief_complaint + reported_symptoms + sex/age) más el gold standard
 *   (tens_esi) y el destino al egreso (outcome). Cualquier columna de signos vitales instrumentados del DAU
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
    /** Advertencias: filas conservadas con algún dato no reconocido. */
    warnings?: DAUParseError[];
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
/** Campo canónico de entrada: los de DAURecord más la hora de ingreso (solo para derivar la franja). */
type CanonicalField = keyof DAURecord | 'admission_time';

const HEADER_ALIASES: Record<string, CanonicalField> = {
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
    // hora de ingreso (se reduce a franja horaria y se descarta)
    admission_time: 'admission_time',
    hora_ingreso: 'admission_time',
    horaingreso: 'admission_time',
    horingresoadm: 'admission_time',
    hora_ingreso_adm: 'admission_time',
    horaingresoadm: 'admission_time',
    hora: 'admission_time',
    // chief_complaint
    chief_complaint: 'chief_complaint',
    chiefcomplaint: 'chief_complaint',
    motivo_consulta: 'chief_complaint',
    motivoconsulta: 'chief_complaint',
    motivo: 'chief_complaint',
    motivo_de_consulta: 'chief_complaint',
    queja_principal: 'chief_complaint',
    motivoconsultaadm: 'chief_complaint',
    motivo_consulta_adm: 'chief_complaint',
    motivo_admision: 'chief_complaint',
    // reported_symptoms
    reported_symptoms: 'reported_symptoms',
    reportedsymptoms: 'reported_symptoms',
    sintomas: 'reported_symptoms',
    sintomas_relatados: 'reported_symptoms',
    sintomatologia: 'reported_symptoms',
    antecedentes: 'reported_symptoms',
    relato: 'reported_symptoms',
    descripcion: 'reported_symptoms',
    // tens_esi (comparador; se aceptan los alias antiguos de "enfermera")
    tens_esi: 'tens_esi',
    tensesi: 'tens_esi',
    esi_tens: 'tens_esi',
    categoria_tens: 'tens_esi',
    nurse_esi: 'tens_esi',
    nurseesi: 'tens_esi',
    esi_enfermera: 'tens_esi',
    esienfermera: 'tens_esi',
    esi: 'tens_esi',
    categoria: 'tens_esi',
    categoria_esi: 'tens_esi',
    categorizacion: 'tens_esi',
    triage: 'tens_esi',
    nivel_triage: 'tens_esi',
    c1_c5: 'tens_esi',
    // outcome (destino al egreso; criterio de referencia)
    outcome: 'outcome',
    destino: 'outcome',
    destino_egreso: 'outcome',
    destino_al_egreso: 'outcome',
    egreso: 'outcome',
    desenlace: 'outcome',
    tipo_egreso: 'outcome',
    condicion_egreso: 'outcome',
    // age_band (tramo quinquenal)
    age_band: 'age_band',
    tramo_etario: 'age_band',
    tramo_edad: 'age_band',
    tramo: 'age_band',
    edad_quinquenal: 'age_band',
    // period (mes y año)
    period: 'period',
    periodo: 'period',
    mes: 'period',
    mes_anio: 'period',
    mes_ano: 'period',
    // time_band (franja horaria)
    time_band: 'time_band',
    franja: 'time_band',
    franja_horaria: 'time_band',
    turno: 'time_band',
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

/**
 * Normaliza el destino al egreso a las categorías del protocolo. El orden de
 * las comprobaciones importa: lo más grave se evalúa primero, y "alta
 * voluntaria" o "fuga" se clasifican como "otro" antes de evaluar "alta".
 */
export function coerceOutcome(value: unknown): DAUOutcome | null {
    if (value == null) return null;
    const v = String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (v === '') return null;
    if (/fallec|defunc|muert|obito/.test(v)) return 'fallecimiento';
    if (/\b(upc|uci|uti)\b|intensiv|paciente critico|cuidados intermedios/.test(v)) return 'upc';
    if (/trasl|mayor complejidad|otro (centro|hospital)/.test(v)) return 'traslado';
    if (/hospitaliz|ingreso a (sala|servicio|piso)|\bsala\b|pabellon|cirugia de urgencia/.test(v)) return 'hospitalizacion';
    if (/fuga|abandon|voluntari|rechaz|se retira/.test(v)) return 'otro';
    if (/\balta\b|domicilio|\bcasa\b|ambulator|cesfam|\baps\b|policlin|control/.test(v)) return 'alta';
    return null;
}

/**
 * Interpreta un tramo etario quinquenal ("40-44", "40 a 44", "80+", "80 y
 * más") y devuelve sus límites. Devuelve null si el texto no es un tramo.
 */
export function parseAgeBand(value: unknown): { lower: number; upper: number | null } | null {
    if (value == null) return null;
    const v = String(value).trim().toLowerCase();
    let m = v.match(/^(\d{1,3})\s*(?:-|–|a)\s*(\d{1,3})(?:\s*a(?:ñ|n)os)?$/);
    if (m) return { lower: Number(m[1]), upper: Number(m[2]) };
    m = v.match(/^(\d{1,3})\s*(?:\+|y m[aá]s|o m[aá]s|\+ a(?:ñ|n)os)$/);
    if (m) return { lower: Number(m[1]), upper: null };
    return null;
}

/**
 * Grupo etario a partir de un tramo quinquenal. Regla explícita para los
 * tramos que cruzan un corte: 15-19 se asigna a adulto (el estudio incluye
 * población general y la mayoría de ese tramo en urgencia general es mayor
 * de edad) y 65-69 a geriátrico.
 */
export function ageGroupFromBand(band: { lower: number; upper: number | null }): DAUAgeGroup {
    if (band.upper != null && band.upper < 15) return 'Pediatric';
    if (band.lower >= 65) return 'Geriatric';
    return 'Adult';
}

/** Deriva el grupo etario a partir de la edad en años. */
export function ageGroupFromYears(age: number): DAUAgeGroup {
    if (age < 18) return 'Pediatric';
    if (age >= 65) return 'Geriatric';
    return 'Adult';
}

/** Coerciona un valor a ESILevel (1..5) o null. Acepta "C3", "3", "C3 - Urgencia", "ESI 2". */
function coerceEsi(value: unknown): ESILevel | null {
    if (value == null) return null;
    const s = String(value).trim().toLowerCase();
    const m = s.match(/^(?:c|esi|nivel)?\s*([1-5])(?![0-9])/);
    if (!m) return null;
    return Number(m[1]) as ESILevel;
}

/**
 * Reduce una fecha de ingreso a mes y año (AAAA-MM). Acepta dd-mm-aa,
 * dd-mm-aaaa, dd/mm/aaaa y aaaa-mm-dd, con o sin hora. La fecha exacta se
 * descarta (minimización comprometida con el CEC).
 */
export function periodFromDate(value: unknown): string | null {
    if (value == null) return null;
    const v = String(value).trim();
    let m = v.match(/^(\d{4})-(\d{1,2})-\d{1,2}/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
    m = v.match(/^\d{1,2}[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
    if (m) {
        const year = m[2].length === 2 ? `20${m[2]}` : m[2];
        const month = Number(m[1]);
        if (month < 1 || month > 12) return null;
        return `${year}-${String(month).padStart(2, '0')}`;
    }
    return null;
}

/** Franjas horarias de 6 horas usadas en el estudio. */
export function timeBandFromTime(value: unknown): string | null {
    if (value == null) return null;
    const m = String(value).match(/(?:^|\s|T)(\d{1,2}):\d{2}/);
    if (!m) return null;
    const h = Number(m[1]);
    if (h < 0 || h > 23) return null;
    if (h < 6) return '00-06';
    if (h < 12) return '06-12';
    if (h < 18) return '12-18';
    return '18-24';
}

/** Tramo quinquenal a partir de la edad en años (80 y más, abierto). */
export function ageBandFromYears(age: number): string {
    if (age >= 80) return '80+';
    const lower = Math.floor(age / 5) * 5;
    return `${lower}-${lower + 4}`;
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
    obj: Partial<Record<CanonicalField, unknown>>,
    fallbackId: string,
): { record: DAURecord } | { error: string } {
    const chiefComplaint = coerceText(obj.chief_complaint);
    if (!chiefComplaint) {
        return { error: 'falta chief_complaint / motivo_consulta' };
    }

    const recordId = coerceText(obj.record_id) ?? fallbackId;
    // La columna "edad" puede traer años o un tramo quinquenal.
    let ageBandText = coerceText(obj.age_band);
    if (!ageBandText && parseAgeBand(obj.age_years)) ageBandText = coerceText(obj.age_years);
    const ageYears = coerceAge(obj.age_years);
    if (!ageBandText && ageYears != null) ageBandText = ageBandFromYears(ageYears);
    const band = parseAgeBand(ageBandText);
    let ageGroup = coerceAgeGroup(obj.age_group as string | null | undefined);
    if (!ageGroup && band) ageGroup = ageGroupFromBand(band);
    if (!ageGroup && ageYears != null) {
        ageGroup = ageGroupFromYears(ageYears);
    }
    const outcomeRaw = coerceText(obj.outcome);

    const record: DAURecord = {
        record_id: recordId,
        age_years: ageYears,
        age_group: ageGroup,
        sex: coerceSex(obj.sex as string | null | undefined),
        // La fecha y hora exactas se reducen a mes y franja y NO se conservan.
        admission_datetime: null,
        chief_complaint: chiefComplaint,
        reported_symptoms: coerceText(obj.reported_symptoms),
        tens_esi: coerceEsi(obj.tens_esi),
        outcome: coerceOutcome(outcomeRaw),
        outcome_raw: outcomeRaw,
        age_band: ageBandText,
        period: coerceText(obj.period) ?? periodFromDate(obj.admission_datetime),
        time_band:
            coerceText(obj.time_band) ??
            timeBandFromTime(obj.admission_time) ??
            timeBandFromTime(obj.admission_datetime),
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
    const warnings: DAUParseError[] = [];

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
        const mapped: Partial<Record<CanonicalField, unknown>> = {};
        for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
            const canonical = HEADER_ALIASES[normalizeHeader(key)];
            if (canonical) mapped[canonical] = value;
        }
        const result = buildRecord(mapped, `rec_${row}`);
        if ('error' in result) {
            errors.push({ row, reason: result.error });
        } else {
            records.push(result.record);
            if (result.record.outcome_raw && !result.record.outcome) {
                warnings.push({ row, reason: `destino no reconocido: "${result.record.outcome_raw}" (registro conservado sin desenlace)` });
            }
        }
    });

    return { records, errors, warnings };
}

/**
 * Tokeniza una sola línea CSV respetando comillas dobles y comas internas.
 * Soporta comillas escapadas como "".
 */
/** Detecta el separador por la cabecera: tabulación, punto y coma o coma. */
export function detectDelimiter(headerLine: string): '\t' | ';' | ',' {
    const counts = {
        '\t': (headerLine.match(/\t/g) ?? []).length,
        ';': (headerLine.match(/;/g) ?? []).length,
        ',': (headerLine.match(/,/g) ?? []).length,
    };
    if (counts['\t'] > 0 && counts['\t'] >= counts[';'] && counts['\t'] >= counts[',']) return '\t';
    if (counts[';'] > 0 && counts[';'] >= counts[',']) return ';';
    return ',';
}

function splitCsvLine(line: string, delimiter: string = ','): string[] {
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
        } else if (ch === delimiter) {
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
    const warnings: DAUParseError[] = [];

    const lines = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter((l) => l.trim().length > 0);

    if (lines.length === 0) {
        errors.push({ row: 0, reason: 'CSV vacío' });
        return { records, errors };
    }

    const delimiter = detectDelimiter(lines[0]);
    const headerCells = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
    const columnMap: (CanonicalField | null)[] = headerCells.map((h) => HEADER_ALIASES[h] ?? null);

    if (!columnMap.includes('chief_complaint')) {
        errors.push({
            row: 0,
            reason: 'No se encontró columna de motivo de consulta (chief_complaint/motivo_consulta)',
        });
        return { records, errors };
    }

    for (let i = 1; i < lines.length; i++) {
        const row = i; // 1-based sin contar cabecera
        const cells = splitCsvLine(lines[i], delimiter);
        const mapped: Partial<Record<CanonicalField, unknown>> = {};
        columnMap.forEach((canonical, idx) => {
            if (canonical) mapped[canonical] = cells[idx];
        });
        const result = buildRecord(mapped, `rec_${row}`);
        if ('error' in result) {
            errors.push({ row, reason: result.error });
        } else {
            records.push(result.record);
            if (result.record.outcome_raw && !result.record.outcome) {
                warnings.push({ row, reason: `destino no reconocido: "${result.record.outcome_raw}" (registro conservado sin desenlace)` });
            }
        }
    }

    return { records, errors, warnings };
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
