import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client with service_role key to bypass RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

interface ClinicalRecordInput {
    patient_consent: boolean;
    symptoms_text: string;
    ai_response: any;
    esi_level: number;
    anonymous_code: string;
    patient_gender?: string | null;
    patient_age_group?: string | null;
    conversation_history?: any;
}

/**
 * POST /api/clinical-records
 * Create a new clinical record (server-side to bypass RLS)
 */
export async function POST(request: NextRequest) {
    try {
        const body: ClinicalRecordInput = await request.json();

        // Validate required fields
        if (!body.symptoms_text || !body.ai_response || !body.esi_level || !body.anonymous_code) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Insert clinical record using admin client (bypasses RLS)
        const { data, error } = await supabaseAdmin
            .from('clinical_records')
            .insert({
                patient_consent: body.patient_consent ?? true,
                symptoms_text: body.symptoms_text,
                ai_response: body.ai_response,
                esi_level: body.esi_level,
                nurse_validated: false,
                anonymous_code: body.anonymous_code,
                patient_gender: body.patient_gender || null,
                patient_age_group: body.patient_age_group || null,
                conversation_history: body.conversation_history || null,
            })
            .select('id, anonymous_code')
            .single();

        if (error) {
            console.error('[ClinicalRecords API] Insert error:', error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        console.log('[ClinicalRecords API] Record created:', data.id);
        return NextResponse.json({
            success: true,
            data: {
                id: data.id,
                anonymous_code: data.anonymous_code,
            },
        });

    } catch (error) {
        console.error('[ClinicalRecords API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
