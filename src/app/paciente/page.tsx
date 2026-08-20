'use client';

import { Suspense } from 'react';
import TriageChatLegacy from '@/components/triage/TriageChatLegacy';

export default function PacientePage() {
    return (
        <main>
            <Suspense fallback={null}>
                <TriageChatLegacy />
            </Suspense>
        </main>
    );
}
