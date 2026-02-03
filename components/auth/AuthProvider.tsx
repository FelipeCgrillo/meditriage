'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface UserProfile {
    id: string;
    email: string;
    role: 'nurse' | 'researcher' | 'admin';
    full_name: string | null;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    session: Session | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    session: null,
    loading: true,
});

export function useAuth() {
    return useContext(AuthContext);
}

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        // Función simple para cargar perfil (sin bloquear)
        async function loadProfile(userId: string) {
            try {
                // Usar query directa en lugar de RPC para evitar problemas
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('id, email, role, full_name')
                    .eq('id', userId)
                    .maybeSingle(); // maybeSingle no lanza error si no hay resultados

                if (error) {
                    console.error('[AuthProvider] Error cargando perfil:', error.message);
                    return;
                }

                if (data && isMounted) {
                    console.log('[AuthProvider] Perfil cargado:', data.role);
                    setProfile(data as UserProfile);
                }
            } catch (err) {
                console.error('[AuthProvider] Error inesperado:', err);
            }
        }

        // Inicialización rápida
        async function init() {
            try {
                console.log('[AuthProvider] Iniciando...');
                const { data: { session: s } } = await supabase.auth.getSession();

                if (!isMounted) return;

                console.log('[AuthProvider] Sesión:', s ? 'existe' : 'no existe');
                setSession(s);
                setUser(s?.user ?? null);
                setLoading(false); // ← Terminar loading ANTES de cargar perfil

                // Cargar perfil en background (no bloquea la UI)
                if (s?.user) {
                    loadProfile(s.user.id);
                }
            } catch (err) {
                console.error('[AuthProvider] Error:', err);
                if (isMounted) setLoading(false);
            }
        }

        init();

        // Escuchar cambios de auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, newSession) => {
                console.log('[AuthProvider] Auth cambió:', event);

                if (!isMounted) return;

                setSession(newSession);
                setUser(newSession?.user ?? null);
                setLoading(false);

                if (newSession?.user) {
                    loadProfile(newSession.user.id);
                } else {
                    setProfile(null);
                }
            }
        );

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, session, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
