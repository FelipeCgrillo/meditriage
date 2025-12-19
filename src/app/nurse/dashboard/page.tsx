'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Activity, Eye, EyeOff, CheckCircle, AlertTriangle, LogOut, RefreshCw, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ClinicalRecord } from '@/lib/supabase/types';
import type { TriageResult } from '@/lib/ai/schemas';

export default function NurseDashboard() {
    const { profile } = useAuth();
    const [records, setRecords] = useState<ClinicalRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [validationState, setValidationState] = useState<Record<string, number | null>>({});
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('clinical_records')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setRecords(data);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchRecords();

        // Realtime subscription
        const channel = supabase
            .channel('clinical_records_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'clinical_records' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setRecords((prev) => [payload.new as ClinicalRecord, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setRecords((prev) =>
                            prev.map((r) => (r.id === payload.new.id ? (payload.new as ClinicalRecord) : r))
                        );
                    } else if (payload.eventType === 'DELETE') {
                        setRecords((prev) => prev.filter((r) => r.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchRecords]);

    const handleValidate = async (recordId: string) => {
        const level = validationState[recordId];
        if (!level) return;

        setIsSubmitting(recordId);
        const { error } = await supabase
            .from('clinical_records')
            .update({
                nurse_override_level: level,
                nurse_validated: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', recordId);

        if (error) {
            console.error('Error validating record:', error);
            alert('Error al validar el registro');
        }
        setIsSubmitting(null);
    };

    const getESIColor = (level: number) => {
        const colors: Record<number, string> = {
            1: 'bg-red-600 text-white',
            2: 'bg-orange-500 text-white',
            3: 'bg-yellow-400 text-slate-900',
            4: 'bg-emerald-500 text-white',
            5: 'bg-blue-500 text-white',
        };
        return colors[level] || 'bg-slate-200 text-slate-600';
    };

    if (isLoading && records.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-medical-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium">Cargando registros clínicos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* Top Bar */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-medical-primary rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                            <Activity className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Dashboard de Enfermería</h1>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Validación Ciega Protocolo ESI</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:block text-right">
                            <p className="text-sm font-bold text-slate-700">{profile?.full_name || 'Enfermero/a'}</p>
                            <p className="text-xs text-slate-400 capitalize">{profile?.role || 'Personal de Salud'}</p>
                        </div>
                        <button
                            onClick={() => supabase.auth.signOut()}
                            className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-all"
                            title="Cerrar Sesión"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-sm font-medium text-slate-500 mb-1">Total Pacientes</p>
                        <p className="text-3xl font-black text-slate-900">{records.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-sm font-medium text-slate-500 mb-1">Pendientes de Validar</p>
                        <p className="text-3xl font-black text-medical-primary">{records.filter(r => !r.nurse_validated).length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-sm font-medium text-emerald-600 mb-1">Validados</p>
                        <p className="text-3xl font-black text-emerald-500">{records.filter(r => r.nurse_validated).length}</p>
                    </div>
                </div>

                {/* Table Container */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Paciente / Código</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Síntomas Declarados</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Clasificación IA</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Validación Enfermería</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records.map((record) => {
                                    const aiResult = record.ai_response as unknown as TriageResult;
                                    const isPending = !record.nurse_validated;
                                    const hasMatch = record.nurse_override_level === record.esi_level;

                                    return (
                                        <tr key={record.id} className={`group hover:bg-slate-50 transition-colors ${isPending ? 'bg-blue-50/30' : ''}`}>
                                            <td className="px-6 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-mono font-bold text-lg text-slate-900">
                                                        {record.anonymous_code || '---'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {new Date(record.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 max-w-xs">
                                                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed" title={record.symptoms_text}>
                                                    {record.symptoms_text}
                                                </p>
                                            </td>
                                            <td className="px-6 py-6">
                                                {isPending ? (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 w-fit">
                                                        <EyeOff className="w-4 h-4 text-slate-400" />
                                                        <span className="text-xs font-bold text-slate-400 italic">Cegado</span>
                                                    </div>
                                                ) : (
                                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit font-bold text-xs ${getESIColor(record.esi_level)}`}>
                                                        <Activity className="w-4 h-4" />
                                                        ESI {record.esi_level}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-6">
                                                {isPending ? (
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={validationState[record.id] || ''}
                                                            onChange={(e) => setValidationState(prev => ({ ...prev, [record.id]: Number(e.target.value) }))}
                                                            className="text-sm font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-medical-primary/20 focus:border-medical-primary transition-all"
                                                        >
                                                            <option value="">Seleccionar ESI...</option>
                                                            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>Nivel {v}</option>)}
                                                        </select>
                                                        <Button
                                                            disabled={!validationState[record.id] || isSubmitting === record.id}
                                                            onClick={() => handleValidate(record.id)}
                                                            className="rounded-xl shadow-md px-4 py-2"
                                                        >
                                                            {isSubmitting === record.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit font-bold text-xs ${getESIColor(record.nurse_override_level as number)}`}>
                                                            <CheckCircle className="w-4 h-4" />
                                                            ESI {record.nurse_override_level}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-medium italic">Validado por Usted</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-6 text-right">
                                                {!isPending && (
                                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                                        {hasMatch ? (
                                                            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100 font-bold text-[10px] uppercase tracking-wider">
                                                                <CheckCircle className="w-3.5 h-3.5" />
                                                                Coincidencia
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-100 font-bold text-[10px] uppercase tracking-wider">
                                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                                Discrepancia
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {isPending && (
                                                    <div className="text-slate-300 group-hover:text-medical-primary transition-colors">
                                                        <ChevronRight className="w-5 h-5 ml-auto" />
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
