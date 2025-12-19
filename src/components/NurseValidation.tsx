'use client';

import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import type { ClinicalRecord } from '@/lib/supabase/types';
import type { TriageResult } from '@/lib/ai/schemas';
import { supabase } from '@/lib/supabase/client';
import { LogoutButton } from './auth/LogoutButton';
import { useAuth } from './auth/AuthProvider';

interface NurseValidationProps {
    onClose?: () => void;
}

// Helper to safely cast Json to TriageResult
function getTriageResult(record: ClinicalRecord): TriageResult {
    return record.ai_response as unknown as TriageResult;
}

// Conversation message structure
interface ConversationMessage {
    role: 'patient' | 'ai';
    content: string;
}

// Helper to parse conversation history from JSON
function getConversationHistory(record: ClinicalRecord): ConversationMessage[] | null {
    if (!record.conversation_history) return null;
    return record.conversation_history as unknown as ConversationMessage[];
}

export function NurseValidation({ onClose }: NurseValidationProps) {
    const [records, setRecords] = useState<ClinicalRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState<ClinicalRecord | null>(null);
    const { profile } = useAuth();

    // NEW: Blind validation states
    const [isRevealed, setIsRevealed] = useState(false);
    const [nurseEstimation, setNurseEstimation] = useState<number | null>(null);

    useEffect(() => {
        fetchPendingRecords();
    }, []);

    const fetchPendingRecords = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('clinical_records')
                .select('*')
                .eq('nurse_validated', false)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRecords(data || []);
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // NEW: Handle nurse classification (blind validation)
    const handleNurseClassification = async () => {
        if (!nurseEstimation || !selectedRecord) {
            alert('Debe seleccionar un nivel ESI primero');
            return;
        }

        try {
            // Save nurse's classification to database
            const { error } = await supabase
                .from('clinical_records')
                .update({
                    nurse_override_level: nurseEstimation,
                    nurse_validated: true,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', selectedRecord.id);

            if (error) throw error;

            // Reveal AI classification
            setIsRevealed(true);
        } catch (error) {
            console.error('Error saving nurse classification:', error);
            alert('Error al guardar la clasificación');
        }
    };

    // Reset states when changing record
    const handleSelectRecord = (record: ClinicalRecord) => {
        setSelectedRecord(record);
        setIsRevealed(false);
        setNurseEstimation(null);
    };

    const handleBackToList = async () => {
        await fetchPendingRecords(); // Refresh list
        setSelectedRecord(null);
        setIsRevealed(false);
        setNurseEstimation(null);
    };

    const getESIColor = (level: number): string => {
        const colors: Record<number, string> = {
            1: 'bg-esi-1 text-white',
            2: 'bg-esi-2 text-white',
            3: 'bg-esi-3 text-gray-900',
            4: 'bg-esi-4 text-white',
            5: 'bg-esi-5 text-white',
        };
        return colors[level] || 'bg-gray-500 text-white';
    };

    const getESILabel = (level: number): string => {
        const labels: Record<number, string> = {
            1: 'Nivel 1 - Crítico',
            2: 'Nivel 2 - Emergencia',
            3: 'Nivel 3 - Urgente',
            4: 'Nivel 4 - Menos Urgente',
            5: 'Nivel 5 - No Urgente',
        };
        return labels[level] || 'Desconocido';
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-medical-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600">Cargando registros...</p>
                </div>
            </div>
        );
    }

    if (selectedRecord) {
        const aiLevel = getTriageResult(selectedRecord).esi_level;
        const aiResult = getTriageResult(selectedRecord);
        const hasMatch = nurseEstimation === aiLevel;

        return (
            <div className="min-h-screen bg-gray-100 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-lg p-8">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Validación de Triaje</h2>
                            <Button variant="secondary" onClick={handleBackToList}>
                                ← Volver
                            </Button>
                        </div>

                        {/* Anonymous Code - PROMINENT */}
                        <div className="mb-6 p-3 sm:p-4 bg-yellow-50 border-4 border-yellow-400 rounded-xl shadow-md">
                            <div className="flex items-center justify-center gap-2 sm:gap-3">
                                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                </svg>
                                <div className="text-center">
                                    <p className="text-xs sm:text-sm font-medium text-yellow-800 mb-1">Código del Paciente</p>
                                    <p className="text-2xl sm:text-4xl font-mono font-bold text-yellow-900 tracking-widest">
                                        {selectedRecord.anonymous_code || 'Sin código'}
                                    </p>
                                </div>
                            </div>
                            <p className="text-center text-yellow-700 text-xs sm:text-sm mt-2">
                                ⚠️ Confirme este código con el paciente antes de validar
                            </p>
                        </div>

                        {/* Symptoms - Always Visible */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Síntomas del Paciente
                            </label>
                            <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                                <p className="text-gray-800 whitespace-pre-wrap">{selectedRecord.symptoms_text}</p>
                            </div>
                        </div>

                        {/* Conversation History - Show AI follow-up questions and patient responses */}
                        {(() => {
                            const conversationHistory = getConversationHistory(selectedRecord);
                            if (!conversationHistory || conversationHistory.length === 0) return null;

                            return (
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        📝 Historial de Conversación con IA
                                    </label>
                                    <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200 space-y-3">
                                        <p className="text-xs text-purple-600 mb-2">
                                            La IA solicitó información adicional para una clasificación más precisa:
                                        </p>
                                        {conversationHistory.map((msg, idx) => (
                                            <div
                                                key={idx}
                                                className={`p-3 rounded-lg ${msg.role === 'patient'
                                                        ? 'bg-blue-100 border border-blue-300 ml-4'
                                                        : 'bg-yellow-100 border border-yellow-300 mr-4'
                                                    }`}
                                            >
                                                <p className="text-xs font-semibold text-gray-600 mb-1">
                                                    {msg.role === 'patient' ? '👤 Paciente' : '🤖 Pregunta IA'}
                                                </p>
                                                <p className="text-gray-800">{msg.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Timestamp */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Fecha y Hora
                            </label>
                            <p className="text-gray-600">
                                {new Date(selectedRecord.created_at).toLocaleString('es-CL')}
                            </p>
                        </div>

                        {/* Nurse Classification Input - Only shown if not yet classified */}
                        {!isRevealed && (
                            <div className="mb-8 p-6 bg-blue-50 border-2 border-blue-300 rounded-lg">
                                <h3 className="text-lg font-bold text-blue-900 mb-4">
                                    📋 Su Clasificación ESI
                                </h3>
                                <p className="text-sm text-blue-700 mb-4">
                                    Basándose <strong>únicamente</strong> en los síntomas del paciente,
                                    seleccione el nivel ESI que usted considera apropiado:
                                </p>

                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => setNurseEstimation(level)}
                                            className={`p-3 sm:p-4 rounded-lg font-bold text-base sm:text-lg transition-all ${nurseEstimation === level
                                                ? getESIColor(level) + ' ring-4 ring-offset-2 ring-blue-500 scale-105'
                                                : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-blue-400'
                                                }`}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>

                                {nurseEstimation && (
                                    <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                                        <p className="text-sm text-gray-700">
                                            <strong>Seleccionado:</strong> {getESILabel(nurseEstimation)}
                                        </p>
                                    </div>
                                )}

                                <Button
                                    variant="primary"
                                    onClick={handleNurseClassification}
                                    disabled={!nurseEstimation}
                                    className="w-full mt-4"
                                >
                                    {nurseEstimation
                                        ? '✓ Registrar y Comparar con IA'
                                        : '⚠ Seleccione un nivel ESI primero'}
                                </Button>
                            </div>
                        )}

                        {/* AI Classification - Blurred until revealed */}
                        <div className={`${!isRevealed ? 'filter blur-lg pointer-events-none select-none' : ''} transition-all duration-500`}>
                            {/* ESI Level */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Clasificación ESI Sugerida por IA
                                </label>
                                <div className={`inline-block px-6 py-3 rounded-lg font-bold text-lg ${getESIColor(aiLevel)}`}>
                                    {getESILabel(aiLevel)}
                                </div>
                            </div>

                            {/* Critical Signs */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Signos Críticos Identificados
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {aiResult.critical_signs.map((sign: string, idx: number) => (
                                        <span
                                            key={idx}
                                            className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium"
                                        >
                                            {sign}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Clinical Reasoning */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Razonamiento Clínico
                                </label>
                                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                    <p className="text-gray-800 leading-relaxed">{aiResult.reasoning}</p>
                                </div>
                            </div>

                            {/* Suggested Specialty */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Especialidad Sugerida
                                </label>
                                <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-lg inline-block">
                                    <p className="text-green-800 font-medium">{aiResult.suggested_specialty}</p>
                                </div>
                            </div>
                        </div>

                        {/* Comparison Message - Only shown after classification */}
                        {isRevealed && nurseEstimation && (
                            <div className={`p-6 rounded-lg border-2 mb-6 ${hasMatch
                                ? 'bg-green-50 border-green-300'
                                : 'bg-yellow-50 border-yellow-300'
                                }`}>
                                {hasMatch ? (
                                    <>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-3xl">✅</span>
                                            <h3 className="text-lg font-bold text-green-900">Coincidencia Total</h3>
                                        </div>
                                        <p className="text-green-800">
                                            Su clasificación <strong>coincide</strong> con la evaluación de la IA.
                                            Ambos clasificaron como <strong>ESI Nivel {aiLevel}</strong>.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-3xl">⚠️</span>
                                            <h3 className="text-lg font-bold text-yellow-900">Discrepancia Detectada</h3>
                                        </div>
                                        <p className="text-yellow-800 mb-3">
                                            Existe una diferencia en la clasificación:
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                            <div className="bg-white p-3 rounded-lg border border-yellow-300">
                                                <p className="text-xs text-gray-600 mb-1">Su Clasificación:</p>
                                                <p className="font-bold text-yellow-900">ESI Nivel {nurseEstimation}</p>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border border-yellow-300">
                                                <p className="text-xs text-gray-600 mb-1">Clasificación IA:</p>
                                                <p className="font-bold text-yellow-900">ESI Nivel {aiLevel}</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-yellow-700 mt-3">
                                            💡 Su clasificación (ESI {nurseEstimation}) será la registrada en el sistema.
                                        </p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Placeholder blur message */}
                        {!isRevealed && (
                            <div className="text-center py-8 text-gray-500">
                                <svg className="w-16 h-16 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                                <p className="font-medium">Resultado de IA oculto</p>
                                <p className="text-sm mt-1">Clasifique primero para ver la evaluación de la IA</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-2xl shadow-lg p-8">
                    {/* Header with user info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                                Dashboard de Enfermería
                            </h1>
                            <p className="text-gray-600 text-sm sm:text-base">
                                Registros pendientes de validación: <span className="font-bold text-medical-primary">{records.length}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            {profile && (
                                <span className="text-sm text-gray-600">
                                    👤 {profile.full_name || profile.email}
                                </span>
                            )}
                            <LogoutButton redirectTo="/login/nurse" />
                        </div>
                    </div>

                    {/* Records List */}
                    {records.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-gray-500 text-lg">No hay registros pendientes de validación</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {records.map((record) => (
                                <div
                                    key={record.id}
                                    className="border border-gray-200 rounded-lg p-4 sm:p-6 hover:shadow-md transition-shadow cursor-pointer hover:border-medical-primary"
                                    onClick={() => handleSelectRecord(record)}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
                                        {/* Anonymous Code - PROMINENT */}
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <div className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono font-bold text-lg sm:text-xl bg-yellow-100 text-yellow-900 border-2 border-yellow-400">
                                                {record.anonymous_code || '---'}
                                            </div>
                                            <div className="px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                                                📋 Pendiente
                                            </div>
                                        </div>
                                        <span className="text-xs sm:text-sm text-gray-500">
                                            {new Date(record.created_at).toLocaleString('es-CL')}
                                        </span>
                                    </div>
                                    <p className="text-gray-700 text-sm sm:text-base line-clamp-2 mb-2 sm:mb-3">
                                        {record.symptoms_text}
                                    </p>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                                            <span>Especialidad:</span>
                                            <span className="font-medium text-medical-primary">
                                                {getTriageResult(record).suggested_specialty}
                                            </span>
                                        </div>
                                        <span className="text-xs text-medical-primary font-medium">
                                            Toca para validar →
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Refresh Button */}
                    <div className="mt-6 text-center">
                        <Button variant="secondary" onClick={fetchPendingRecords}>
                            🔄 Actualizar Lista
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
