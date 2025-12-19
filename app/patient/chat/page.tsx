'use client';

import { useState } from 'react';
import { ConsentScreen, DemographicData } from '@/components/ConsentScreen';
import { SymptomInput } from '@/components/SymptomInput';
import { SuccessScreen } from '@/components/SuccessScreen';
import { supabase } from '@/lib/supabase/client';
import { generateAnonymousCode } from '@/lib/utils/anonymousCode';
import type { TriageResult } from '@/lib/ai/schemas';

type FlowStep = 'consent' | 'input' | 'success';

interface ConversationMessage {
    role: 'patient' | 'ai';
    content: string;
}

export default function PacientePage() {
    const [currentStep, setCurrentStep] = useState<FlowStep>('consent');
    const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
    const [anonymousCode, setAnonymousCode] = useState<string>('');
    const [demographics, setDemographics] = useState<DemographicData | null>(null);

    const handleConsent = (demographicData: DemographicData) => {
        setDemographics(demographicData);
        setCurrentStep('input');
    };

    const handleTriageSuccess = async (result: TriageResult, symptoms: string, conversationHistory?: ConversationMessage[]) => {
        setTriageResult(result);

        // Generate anonymous patient code
        const patientCode = generateAnonymousCode();

        // Save to database with anonymous code and demographic data
        try {
            const { data, error } = await supabase
                .from('clinical_records')
                .insert({
                    patient_consent: true,
                    symptoms_text: symptoms,
                    ai_response: result as any,
                    esi_level: result.esi_level,
                    nurse_validated: false,
                    anonymous_code: patientCode,
                    patient_gender: demographics?.gender || null,
                    patient_age_group: demographics?.ageGroup || null,
                    conversation_history: conversationHistory || null,
                } as any)
                .select('anonymous_code')
                .single();

            if (error) {
                console.error('Error saving to database:', error);
                setAnonymousCode(patientCode);
            } else {
                setAnonymousCode(data?.anonymous_code || patientCode);
            }
        } catch (error) {
            console.error('Database error:', error);
            setAnonymousCode(patientCode);
        }

        setCurrentStep('success');
    };

    const handleReset = () => {
        setCurrentStep('consent');
        setTriageResult(null);
        setAnonymousCode('');
        setDemographics(null);
    };

    return (
        <main>
            {currentStep === 'consent' && <ConsentScreen onConsent={handleConsent} />}
            {currentStep === 'input' && <SymptomInput onSuccess={handleTriageSuccess} />}
            {currentStep === 'success' && (
                <SuccessScreen
                    anonymousCode={anonymousCode}
                    onReset={handleReset}
                />
            )}
        </main>
    );
}
