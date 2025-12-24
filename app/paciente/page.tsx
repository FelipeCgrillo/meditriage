'use client';

import { useState } from 'react';
import { TriageChat, Message, DemographicData } from '@/components/triage/TriageChat';
import { SuccessScreen } from '@/components/SuccessScreen';
import { supabase } from '@/lib/supabase/client';
import { generateAnonymousCode } from '@/lib/utils/anonymousCode';
import type { TriageResult } from '@/lib/ai/schemas';

type FlowStep = 'input' | 'success';

interface ConversationMessage {
    role: 'patient' | 'ai';
    content: string;
}

export default function PacientePage() {
    const [currentStep, setCurrentStep] = useState<FlowStep>('input');
    const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
    const [anonymousCode, setAnonymousCode] = useState<string>('');

    const handleTriageComplete = async (messages: Message[], finalSymptoms: string, demographics: DemographicData) => {
        try {
            // Convert messages to conversation history format
            const conversationHistory: ConversationMessage[] = messages.map(msg => ({
                role: msg.role === 'user' ? 'patient' : 'ai',
                content: msg.content
            }));

            // Call triage API with the final conversation to get classification
            const response = await fetch('/api/triage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    symptoms: finalSymptoms,
                    messages: messages
                }),
            });

            if (!response.ok) {
                throw new Error('Error al procesar la clasificación final');
            }

            const data = await response.json();

            if (data.success && data.data) {
                const result = data.data as TriageResult;
                setTriageResult(result);

                // Generate anonymous patient code
                const patientCode = generateAnonymousCode();

                // Save to database with anonymous code and demographic data
                const { data: dbData, error } = await supabase
                    .from('clinical_records')
                    .insert({
                        patient_consent: true,
                        symptoms_text: finalSymptoms,
                        ai_response: result as any,
                        esi_level: result.esi_level,
                        nurse_validated: false,
                        anonymous_code: patientCode,
                        patient_gender: demographics.gender || null,
                        patient_age_group: demographics.ageGroup || null,
                        conversation_history: conversationHistory,
                    } as any)
                    .select('anonymous_code')
                    .single();

                if (error) {
                    console.error('Error saving to database:', error);
                    setAnonymousCode(patientCode);
                } else {
                    setAnonymousCode(dbData?.anonymous_code || patientCode);
                }

                setCurrentStep('success');
            } else {
                throw new Error('Respuesta inválida del servidor');
            }
        } catch (error) {
            console.error('Error completing triage:', error);
            // Optionally show error to user
            alert('Ocurrió un error al completar la clasificación. Por favor, intente nuevamente.');
        }
    };

    const handleReset = () => {
        setCurrentStep('input');
        setTriageResult(null);
        setAnonymousCode('');
    };

    return (
        <main>
            {currentStep === 'input' && <TriageChat onComplete={handleTriageComplete} />}
            {currentStep === 'success' && (
                <SuccessScreen
                    anonymousCode={anonymousCode}
                    onReset={handleReset}
                />
            )}
        </main>
    );
}
