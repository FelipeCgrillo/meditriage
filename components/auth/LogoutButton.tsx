'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface LogoutButtonProps {
    variant?: 'default' | 'compact';
    redirectTo?: string;
}

export function LogoutButton({ variant = 'default', redirectTo = '/' }: LogoutButtonProps) {
    const router = useRouter();

    async function handleLogout() {
        await supabase.auth.signOut();
        router.push(redirectTo);
        router.refresh();
    }

    if (variant === 'compact') {
        return (
            <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 transition-colors"
                title="Cerrar sesión"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Salir</span>
            </button>
        );
    }

    return (
        <button
            onClick={handleLogout}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Cerrar Sesión</span>
        </button>
    );
}
