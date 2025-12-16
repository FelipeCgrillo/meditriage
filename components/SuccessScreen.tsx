'use client';

import React, { useEffect } from 'react';
import { Button } from './ui/Button';

interface SuccessScreenProps {
    anonymousCode: string;
    onReset: () => void;
}

export function SuccessScreen({ anonymousCode, onReset }: SuccessScreenProps) {
    useEffect(() => {
        // Auto-reset after 30 seconds (increased for time to note the code)
        const timer = setTimeout(() => {
            onReset();
        }, 30000);

        return () => clearTimeout(timer);
    }, [onReset]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12 text-center">
                {/* Success Icon */}
                <div className="inline-flex items-center justify-center w-24 h-24 bg-medical-success/10 rounded-full mb-6">
                    <svg className="w-12 h-12 text-medical-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                {/* Success Message */}
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    ¡Registro Exitoso!
                </h1>

                <p className="text-xl text-gray-700 mb-8">
                    Sus síntomas han sido analizados correctamente
                </p>

                {/* Anonymous Code Display - PROMINENT */}
                <div className="bg-yellow-50 border-4 border-yellow-400 rounded-2xl p-8 mb-8 shadow-lg">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                        <h2 className="text-xl font-bold text-yellow-900">
                            Su Código de Identificación
                        </h2>
                    </div>

                    <div className="text-5xl md:text-6xl font-mono font-bold text-yellow-800 tracking-widest py-4">
                        {anonymousCode || '---'}
                    </div>

                    <p className="text-yellow-700 mt-4 text-lg font-medium">
                        📋 Muestre este código al personal de enfermería
                    </p>
                    <p className="text-yellow-600 text-sm mt-2">
                        Recuerde o anote este código para que puedan identificarlo
                    </p>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-medical-primary/10 rounded-full mb-3">
                        <svg className="w-6 h-6 text-medical-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Próximos Pasos
                    </h2>

                    <p className="text-gray-700 mb-4">
                        Devuelva la tablet y diga su código al personal de enfermería
                    </p>

                    <div className="bg-white rounded-lg p-3">
                        <p className="text-gray-800 text-sm">
                            El personal revisará su clasificación y le llamará según el orden de prioridad
                        </p>
                    </div>
                </div>

                {/* Manual Reset Button */}
                <Button
                    variant="secondary"
                    onClick={onReset}
                    className="mx-auto"
                >
                    Iniciar Nuevo Registro
                </Button>

                {/* Auto-reset countdown */}
                <p className="text-xs text-gray-500 mt-6">
                    Esta pantalla se reiniciará automáticamente en 30 segundos
                </p>
            </div>
        </div>
    );
}

