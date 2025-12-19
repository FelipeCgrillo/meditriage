'use client';

import { ChatInterface } from '@/components/ChatInterface';

export default function PacientePage() {
    const handleReset = () => {
        // Reset is handled internally by ChatInterface
        window.location.reload();
    };

    return (
        <main>
            <ChatInterface onReset={handleReset} />
        </main>
    );
}
