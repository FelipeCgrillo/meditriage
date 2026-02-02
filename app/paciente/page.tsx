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

    const handleTriageComplete = async (messages: Message[], finalSymptoms: string, demographics: DemographicData, triageData?: TriageResult) => {
        try {
            console.log('[PacientePage] handleTriageComplete called', {
                messagesCount: messages.length,
                finalSymptoms: finalSymptoms.substring(0, 50),
                demographics,
                triageData: triageData ? 'provided' : 'not provided'
            });

            // Convert messages to conversation history format
            const conversationHistory: ConversationMessage[] = messages.map(msg => ({
                role: msg.role === 'user' ? 'patient' : 'ai',
                content: msg.content
            }));

            let result: TriageResult;

            // If triageData is provided, use it directly; otherwise call API
            if (triageData && triageData.esi_level) {
                console.log('[PacientePage] Using provided triage result');
                result = triageData;
            } else {
                // Call triage API with the final conversation to get classification
                console.log('[PacientePage] Calling API for triage result');
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

                if (data.success && data.data && data.data.esi_level) {
                    result = data.data as TriageResult;
                } else {
                    throw new Error('Respuesta inválida del servidor');
                }
            }

            setTriageResult(result);

            // Generate anonymous patient code
            const patientCode = generateAnonymousCode();

            // Save to database with anonymous code and demographic data
            // Wrap in try/catch with timeout to prevent hanging
            console.log('[PacientePage] Saving to database...');
            try {
                const insertPromise = supabase
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

                // Add 10 second timeout
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Database timeout')), 10000)
                );

                const { data: dbData, error } = await Promise.race([
                    insertPromise,
                    timeoutPromise
                ]) as any;

                if (error) {
                    console.error('[PacientePage] Error saving to database:', error);
                    setAnonymousCode(patientCode);
                } else {
                    console.log('[PacientePage] Saved successfully:', dbData);
                    setAnonymousCode(dbData?.anonymous_code || patientCode);
                }
            } catch (dbError) {
                console.error('[PacientePage] Database exception:', dbError);
                setAnonymousCode(patientCode);
            }

            // Always proceed to success screen
            console.log('[PacientePage] Proceeding to success screen');
            setCurrentStep('success');
        } catch (error) {
            console.error('[PacientePage] Error completing triage:', error);
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
