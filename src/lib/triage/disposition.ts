/**
 * Política de derivación por nivel ESI (Brecha /goal PRD).
 *
 * Objetivo clínico, descongestionar urgencias derivando pacientes ESI 4-5 a
 * atención primaria al día siguiente y ESI 3 a APS el mismo día, mientras
 * ESI 1-2 sigue el flujo de urgencia hospitalaria.
 *
 * El mapeo es DETERMINISTA y depende SOLO del `esi_level`. No consulta reloj
 * ni red. Se aplica en el backend (`applyRuleEngineSafeguard`) para que la
 * disposición viaje junto con la clasificación al frontend y quede
 * persistida en `clinical_records`.
 */

export type Disposition =
    | 'emergency'
    | 'same_day_primary_care'
    | 'next_day_primary_care';

/**
 * Deriva la vía de atención a partir del nivel ESI validado.
 * Devuelve `null` cuando no hay `esi_level` (caso `needs_info` o error).
 */
export function dispositionFromEsi(esiLevel: number | null | undefined): Disposition | null {
    if (esiLevel === 1 || esiLevel === 2) return 'emergency';
    if (esiLevel === 3) return 'same_day_primary_care';
    if (esiLevel === 4 || esiLevel === 5) return 'next_day_primary_care';
    return null;
}

/** Texto de acción sugerida estandarizado por disposición (fuente única). */
export function suggestedActionForDisposition(disposition: Disposition): string {
    switch (disposition) {
        case 'emergency':
            return 'Acuda de inmediato a la urgencia hospitalaria más cercana. Si presenta riesgo vital, llame al 131.';
        case 'same_day_primary_care':
            return 'Diríjase HOY a su CESFAM para atención primaria de urgencia. No acuda a la urgencia hospitalaria salvo empeoramiento; en emergencia llame al 131.';
        case 'next_day_primary_care':
            return 'Agende una atención en su CESFAM para el día siguiente. No acuda a la urgencia hospitalaria salvo empeoramiento; en emergencia llame al 131.';
    }
}

/** Título breve para la tarjeta que ve el paciente. */
export function dispositionTitle(disposition: Disposition): string {
    switch (disposition) {
        case 'emergency':
            return 'Urgencia hospitalaria';
        case 'same_day_primary_care':
            return 'Atención primaria hoy';
        case 'next_day_primary_care':
            return 'Atención al día siguiente en CESFAM';
    }
}
