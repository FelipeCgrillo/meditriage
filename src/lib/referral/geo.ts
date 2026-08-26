/**
 * Cálculo de proximidad para la derivación (PRD D1, RF-06 a RF-11).
 *
 * Módulo PURO: sin red, sin reloj, sin dependencias de React. La ubicación del
 * paciente entra como parámetro y nunca se persiste desde aquí.
 *
 * Dos modos, en orden de preferencia:
 *   1. COORDENADAS, cuando el paciente autorizó la geolocalización del
 *      navegador. Se ordena por distancia real.
 *   2. COMUNA declarada, cuando no autorizó o el navegador no la expone. Se
 *      priorizan los centros de la misma comuna.
 *
 * LIMITACIÓN DECLARADA (PRD, sección 9): la distancia en línea recta no
 * representa el tiempo real de traslado. Un centro al otro lado de un río o de
 * una autopista puede quedar primero pese a ser menos accesible. Se acepta en
 * D1 y se revisa si la métrica de asistencia lo justifica.
 */

/** Tipo de centro, alineado con el CHECK de `care_centers.center_type`. */
export type CenterType = 'emergency_hospital' | 'cesfam' | 'partner_clinic';

/** Centro tal como lo necesita el cálculo de proximidad. */
export interface CareCenter {
    id: string;
    name: string;
    center_type: CenterType;
    address: string;
    comuna: string;
    latitude: number;
    longitude: number;
    fhir_endpoint_id?: string | null;
}

/** Ubicación del paciente. Ambos campos son opcionales e independientes. */
export interface PatientLocation {
    latitude?: number | null;
    longitude?: number | null;
    comuna?: string | null;
}

/** Centro con la distancia calculada, cuando se pudo calcular. */
export interface RankedCenter extends CareCenter {
    /** Distancia en kilómetros, o null si se ordenó solo por comuna. */
    distanceKm: number | null;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/**
 * Distancia en línea recta entre dos puntos, en kilómetros (fórmula del
 * haversine). Determinista y sin efectos secundarios.
 */
export function haversineKm(
    aLat: number,
    aLon: number,
    bLat: number,
    bLon: number,
): number {
    const dLat = toRadians(bLat - aLat);
    const dLon = toRadians(bLon - aLon);
    const lat1 = toRadians(aLat);
    const lat2 = toRadians(bLat);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Normaliza una comuna para comparar sin tildes, mayúsculas ni espacios. */
export function normalizeComuna(value: string | null | undefined): string {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

/** True cuando la ubicación permite calcular distancias reales. */
export function hasCoordinates(location: PatientLocation | null | undefined): boolean {
    return (
        typeof location?.latitude === 'number' &&
        Number.isFinite(location.latitude) &&
        typeof location?.longitude === 'number' &&
        Number.isFinite(location.longitude)
    );
}

/** True cuando hay al menos una señal de ubicación utilizable. */
export function hasUsableLocation(location: PatientLocation | null | undefined): boolean {
    return hasCoordinates(location) || normalizeComuna(location?.comuna).length > 0;
}

/**
 * Ordena los centros por cercanía al paciente.
 *
 * Con coordenadas ordena por distancia ascendente (RF-07, CA-04). Sin
 * coordenadas pero con comuna, primero los de la misma comuna (RF-09). Sin
 * ninguna señal devuelve la lista tal cual, para que quien llame decida qué
 * hacer; nunca lanza.
 *
 * El orden es ESTABLE: ante empate se conserva el orden de entrada, de modo
 * que la misma consulta produzca siempre el mismo resultado.
 */
export function rankCentersByProximity(
    centers: CareCenter[],
    location: PatientLocation | null | undefined,
): RankedCenter[] {
    const usesCoords = hasCoordinates(location);
    const patientComuna = normalizeComuna(location?.comuna);

    const decorated = centers.map((center, index) => {
        const distanceKm = usesCoords
            ? haversineKm(
                  location!.latitude as number,
                  location!.longitude as number,
                  center.latitude,
                  center.longitude,
              )
            : null;
        const sameComuna =
            patientComuna.length > 0 && normalizeComuna(center.comuna) === patientComuna;
        return { center, index, distanceKm, sameComuna };
    });

    decorated.sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) {
            if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
            return a.index - b.index;
        }
        if (a.sameComuna !== b.sameComuna) return a.sameComuna ? -1 : 1;
        return a.index - b.index;
    });

    return decorated.map(({ center, distanceKm }) => ({ ...center, distanceKm }));
}

/**
 * Centro más cercano de un tipo dado, o null si no hay ninguno activo de ese
 * tipo. Se usa para la derivación urgente (RF-12) y para la de atención
 * primaria del mismo día (RF-15).
 */
export function nearestCenterOfType(
    centers: CareCenter[],
    location: PatientLocation | null | undefined,
    type: CenterType,
): RankedCenter | null {
    const ofType = centers.filter((c) => c.center_type === type);
    if (ofType.length === 0) return null;
    return rankCentersByProximity(ofType, location)[0] ?? null;
}
