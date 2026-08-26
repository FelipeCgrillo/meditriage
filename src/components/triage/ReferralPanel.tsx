'use client';

/**
 * Panel de derivación de la pantalla final del paciente
 * (PRD D1, RF-06 a RF-28).
 *
 * Tres desenlaces posibles, según lo que resuelva /api/referral:
 *   - Centro concreto al que acudir (urgencia, o atención primaria hoy).
 *   - Cupos reservables (única vía agendable: atención al día siguiente).
 *   - Nada, y el paciente conserva la recomendación genérica.
 *
 * El componente NO decide quién puede agendar: eso lo resuelve el servidor
 * (RNF-03). Aquí solo se muestra lo que el servidor autorizó.
 */

import { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    CalendarClock,
    Check,
    Loader2,
    MapPin,
    ShieldCheck,
} from 'lucide-react';
import type { Disposition } from '@/lib/triage/disposition';
import type { AvailableSlot } from '@/lib/fhir/scheduling';
import { COMUNA_OPTIONS, usePatientLocation } from '@/lib/hooks/usePatientLocation';
import { isValidRut } from '@/lib/utils/rut';

interface ReferralCenter {
    id: string;
    name: string;
    address: string;
    comuna: string;
    distanceKm: number | null;
}

interface ReferralResponse {
    offerScheduling: boolean;
    noOfferReason: 'urgency_level' | 'no_location' | 'no_slots' | null;
    center: ReferralCenter | null;
    slots: AvailableSlot[];
}

interface Props {
    disposition: Disposition;
    anonymousCode: string;
}

function formatSlot(iso: string): string {
    try {
        return new Date(iso).toLocaleString('es-CL', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

function formatDistance(km: number | null): string | null {
    if (km === null) return null;
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export default function ReferralPanel({ disposition, anonymousCode }: Props) {
    const { location, requestGeolocation, setComuna, skip } = usePatientLocation();
    const [referral, setReferral] = useState<ReferralResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [resolved, setResolved] = useState(false);

    const needsComuna =
        location.status === 'denied' ||
        location.status === 'unsupported' ||
        location.status === 'unavailable';
    const hasLocation = location.status === 'granted' || Boolean(location.comuna);

    const fetchReferral = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    disposition,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    comuna: location.comuna,
                }),
            });
            const json = (await res.json()) as ReferralResponse;
            setReferral(json);

            // Traza del desenlace (RF-34/RF-36). No bloquea la pantalla: si
            // falla, el paciente igual ve su derivación.
            void fetch('/api/referral/trace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    anonymous_code: anonymousCode,
                    referral_offered: json.offerScheduling,
                    no_offer_reason: json.noOfferReason,
                    comuna: location.comuna,
                }),
            }).catch(() => undefined);
        } catch {
            // RNF-02: el fallo del agendamiento no rompe la pantalla final.
            setReferral({
                offerScheduling: false,
                noOfferReason: null,
                center: null,
                slots: [],
            });
        } finally {
            setLoading(false);
            setResolved(true);
        }
    }, [disposition, location.latitude, location.longitude, location.comuna, anonymousCode]);

    useEffect(() => {
        if (hasLocation && !resolved && !loading) fetchReferral();
    }, [hasLocation, resolved, loading, fetchReferral]);

    // ── Paso 1: pedir ubicación ────────────────────────────────────────────
    if (!hasLocation && !resolved) {
        return (
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 text-left space-y-4">
                <div className="flex items-start gap-3">
                    <MapPin className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                        <p className="font-bold text-slate-900">¿Dónde se encuentra?</p>
                        <p className="text-sm text-slate-600 leading-relaxed mt-1">
                            Lo usamos solo para mostrarle el centro más cercano. No guardamos su
                            ubicación exacta.
                        </p>
                    </div>
                </div>

                {!needsComuna ? (
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={requestGeolocation}
                            disabled={location.status === 'requesting'}
                            className="w-full py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {location.status === 'requesting' ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Obteniendo ubicación…
                                </>
                            ) : (
                                'Usar mi ubicación'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={skip}
                            className="w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                        >
                            Prefiero elegir mi comuna
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">Elija su comuna:</p>
                        <div className="flex flex-wrap gap-2">
                            {COMUNA_OPTIONS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setComuna(c)}
                                    className="px-4 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setResolved(true)}
                            className="w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                        >
                            Prefiero no indicarlo
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                <span className="text-sm text-slate-600">Buscando centros cercanos…</span>
            </div>
        );
    }

    // ── Paso 2a: centro concreto al que acudir (RF-12, RF-15) ──────────────
    if (referral?.center) {
        const urgent = disposition === 'emergency';
        return (
            <div
                className={`rounded-2xl border-2 p-5 text-left space-y-3 ${
                    urgent ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'
                }`}
            >
                <p
                    className={`text-xs font-black uppercase tracking-wider ${
                        urgent ? 'text-red-900' : 'text-amber-900'
                    }`}
                >
                    {urgent ? 'Acuda de inmediato a' : 'Acuda hoy a'}
                </p>
                <p className={`text-lg font-bold ${urgent ? 'text-red-900' : 'text-amber-900'}`}>
                    {referral.center.name}
                </p>
                <p className={`text-sm ${urgent ? 'text-red-800' : 'text-amber-800'}`}>
                    {referral.center.address}, {referral.center.comuna}
                    {formatDistance(referral.center.distanceKm) &&
                        ` · a ${formatDistance(referral.center.distanceKm)}`}
                </p>
                <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${referral.center.name} ${referral.center.address} ${referral.center.comuna}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 text-sm font-bold underline ${
                        urgent ? 'text-red-900' : 'text-amber-900'
                    }`}
                >
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    Cómo llegar
                </a>
                {urgent && (
                    <p className="text-sm font-bold text-red-900 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                        Si presenta riesgo vital, llame al 131.
                    </p>
                )}
            </div>
        );
    }

    // ── Paso 2b: cupos reservables (RF-17 a RF-25) ─────────────────────────
    if (referral?.offerScheduling && referral.slots.length > 0) {
        return (
            <BookingFlow
                slots={referral.slots}
                anonymousCode={anonymousCode}
                disposition={disposition}
                onSlotsStale={fetchReferral}
            />
        );
    }

    // ── Paso 2c: sin cupos u sin ubicación (RF-10, RF-20) ──────────────────
    if (referral?.noOfferReason === 'no_slots') {
        return (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
                <p className="text-sm text-slate-700 leading-relaxed">
                    No hay horas disponibles en los centros cercanos en este momento. Acuda a su
                    CESFAM para solicitar una hora.
                </p>
            </div>
        );
    }

    return null;
}

// ──────────────────────────────────────────────────────────────────────────

function BookingFlow({
    slots,
    anonymousCode,
    disposition,
    onSlotsStale,
}: {
    slots: AvailableSlot[];
    anonymousCode: string;
    disposition: Disposition;
    onSlotsStale: () => void;
}) {
    const [selected, setSelected] = useState<AvailableSlot | null>(null);
    const [consented, setConsented] = useState(false);
    const [name, setName] = useState('');
    const [rut, setRut] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmed, setConfirmed] = useState<{ start: string } | null>(null);

    async function submitBooking(e: React.FormEvent) {
        e.preventDefault();
        if (!selected) return;
        setError(null);

        // RF-29: se valida en cliente para dar respuesta inmediata; el
        // servidor vuelve a validar porque el cliente no es de fiar.
        if (!isValidRut(rut)) {
            setError('El RUT ingresado no es válido. Revise el número y el dígito verificador.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/referral/booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slot_id: selected.slotId,
                    anonymous_code: anonymousCode,
                    disposition,
                    patient_name: name,
                    rut,
                    phone: phone || null,
                    consent_accepted: true,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json?.message ?? 'No fue posible completar la reserva.');
                // RF-24 / CA-11: el cupo lo tomó otra persona; se refresca la lista.
                if (json?.error === 'slot_taken') {
                    setSelected(null);
                    setConsented(false);
                    onSlotsStale();
                }
                return;
            }
            setConfirmed({ start: json.start });
        } catch {
            setError('No fue posible completar la reserva en este momento.');
        } finally {
            setSubmitting(false);
        }
    }

    // ── Confirmación (RF-23) ───────────────────────────────────────────────
    if (confirmed && selected) {
        return (
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 text-left space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                    <Check className="w-4 h-4" aria-hidden="true" />
                    Hora reservada
                </p>
                <p className="text-lg font-bold text-emerald-900">{selected.centerName}</p>
                <p className="text-sm text-emerald-800">
                    {selected.centerAddress}, {selected.centerComuna}
                </p>
                <p className="text-sm font-semibold text-emerald-900">
                    {formatSlot(confirmed.start)}
                </p>
                <p className="text-sm text-emerald-800">
                    Presente su código <span className="font-mono font-bold">{anonymousCode}</span> al
                    llegar.
                </p>
            </div>
        );
    }

    // ── Consentimiento y datos (RF-26 a RF-28) ─────────────────────────────
    if (selected) {
        return (
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 text-left space-y-4">
                <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Hora elegida
                    </p>
                    <p className="font-bold text-slate-900 mt-1">{selected.centerName}</p>
                    <p className="text-sm text-slate-600">{formatSlot(selected.start)}</p>
                </div>

                {!consented ? (
                    <div className="space-y-3">
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex gap-3">
                            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="text-sm text-slate-700 leading-relaxed">
                                <p className="font-semibold text-slate-900 mb-1">
                                    Para reservar necesitamos sus datos
                                </p>
                                <p>
                                    Su nombre, RUT y teléfono se compartirán con{' '}
                                    <span className="font-semibold">{selected.centerName}</span> con el
                                    único fin de registrar esta hora. Lo que conversó en este chat{' '}
                                    <span className="font-semibold">no</span> se comparte con el centro.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setConsented(true)}
                            className="w-full py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                        >
                            Acepto y quiero reservar
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelected(null)}
                            className="w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
                        >
                            No, gracias
                        </button>
                    </div>
                ) : (
                    <form onSubmit={submitBooking} className="space-y-3">
                        {error && (
                            <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                                {error}
                            </div>
                        )}
                        <div>
                            <label htmlFor="booking-name" className="block text-sm font-medium text-slate-700 mb-1">
                                Nombre completo
                            </label>
                            <input
                                id="booking-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                minLength={2}
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="booking-rut" className="block text-sm font-medium text-slate-700 mb-1">
                                RUT
                            </label>
                            <input
                                id="booking-rut"
                                value={rut}
                                onChange={(e) => setRut(e.target.value)}
                                required
                                placeholder="12.345.678-5"
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="booking-phone" className="block text-sm font-medium text-slate-700 mb-1">
                                Teléfono (opcional)
                            </label>
                            <input
                                id="booking-phone"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                inputMode="tel"
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Reservando…
                                </>
                            ) : (
                                'Confirmar reserva'
                            )}
                        </button>
                    </form>
                )}
            </div>
        );
    }

    // ── Lista de cupos (RF-18, RF-19) ──────────────────────────────────────
    return (
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 text-left space-y-3">
            <div className="flex items-start gap-3">
                <CalendarClock className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                    <p className="font-bold text-slate-900">Horas disponibles cerca suyo</p>
                    <p className="text-sm text-slate-600 mt-1">
                        Puede reservar una ahora, o acudir a su CESFAM si prefiere.
                    </p>
                </div>
            </div>
            <ul className="space-y-2">
                {slots.map((slot) => (
                    <li key={slot.slotId}>
                        <button
                            type="button"
                            onClick={() => setSelected(slot)}
                            className="w-full text-left rounded-xl border border-slate-200 px-4 py-3 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
                        >
                            <p className="font-semibold text-slate-900">{slot.centerName}</p>
                            <p className="text-sm text-slate-600">
                                {slot.centerAddress}, {slot.centerComuna}
                                {formatDistance(slot.distanceKm) &&
                                    ` · a ${formatDistance(slot.distanceKm)}`}
                            </p>
                            <p className="text-sm font-medium text-emerald-700 mt-0.5">
                                {formatSlot(slot.start)}
                            </p>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
