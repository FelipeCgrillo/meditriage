'use client';

import React, { useState } from 'react';
import { Button } from './ui/Button';

export interface DemographicData {
    gender: string | null;
    ageGroup: string | null;
}

interface ConsentScreenProps {
    onConsent: (demographics: DemographicData) => void;
}

export function ConsentScreen({ onConsent }: ConsentScreenProps) {
    const [hasConsented, setHasConsented] = useState(false);
    const [gender, setGender] = useState<string>('');
    const [ageGroup, setAgeGroup] = useState<string>('');

    const handleSubmit = () => {
        if (hasConsented) {
            onConsent({
                gender: gender || null,
                ageGroup: ageGroup || null,
            });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-medical-primary/10 to-medical-accent/10 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-medical-primary/10 rounded-full mb-4">
                        <svg className="w-10 h-10 text-medical-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Sistema de Auto-Triage
                    </h1>
                    <p className="text-medical-neutral text-lg">
                        CESFAM - Asistente de Clasificación de Urgencias
                    </p>
                </div>

                {/* Consent Information */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Información sobre el uso de sus datos
                    </h2>

                    <ul className="space-y-3 text-gray-700">
                        <li className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-medical-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Sus síntomas serán analizados por un asistente de inteligencia artificial para sugerir una clasificación de urgencia.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-medical-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Un profesional de enfermería validará y confirmará la clasificación antes de su atención.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-medical-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Sus datos serán almacenados de forma segura y solo accesibles por personal autorizado del CESFAM.</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-medical-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>El sistema NO reemplaza la evaluación médica profesional.</span>
                        </li>
                    </ul>
                </div>

                {/* Demographic Data Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Datos Demográficos
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Esta información ayuda a evaluar la equidad del sistema. Es voluntaria.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Gender Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Género
                            </label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-medical-primary bg-white text-gray-900"
                            >
                                <option value="">Seleccionar (opcional)</option>
                                <option value="M">Masculino</option>
                                <option value="F">Femenino</option>
                                <option value="Other">Otro</option>
                                <option value="Prefer not to say">Prefiero no decir</option>
                            </select>
                        </div>

                        {/* Age Group Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Grupo de Edad
                            </label>
                            <select
                                value={ageGroup}
                                onChange={(e) => setAgeGroup(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:border-medical-primary bg-white text-gray-900"
                            >
                                <option value="">Seleccionar (opcional)</option>
                                <option value="Pediatric">Pediátrico (0-17 años)</option>
                                <option value="Adult">Adulto (18-64 años)</option>
                                <option value="Geriatric">Geriátrico (65+ años)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Consent Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer mb-6 p-4 rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                        type="checkbox"
                        checked={hasConsented}
                        onChange={(e) => setHasConsented(e.target.checked)}
                        className="w-5 h-5 text-medical-primary rounded focus:ring-2 focus:ring-medical-primary mt-0.5"
                    />
                    <span className="text-gray-700 font-medium">
                        He leído y acepto el uso de mis datos médicos para el proceso de triaje asistido por IA
                    </span>
                </label>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!hasConsented}
                        className="flex-1"
                    >
                        Continuar con el Triaje
                    </Button>
                </div>

                {/* Footer Note */}
                <p className="text-xs text-gray-500 text-center mt-6">
                    Este sistema es parte de un proyecto de investigación de tesis de magíster.
                    Sus datos contribuirán al desarrollo de mejores herramientas de salud pública.
                </p>
            </div>
        </div>
    );
}
