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

        // Función para cargar perfil - AHORA retorna Promise para poder esperar
        async function loadProfile(userId: string): Promise<UserProfile | null> {
            try {
                console.log('[AuthProvider] Cargando perfil para:', userId);
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('id, email, role, full_name')
                    .eq('id', userId)
                    .maybeSingle();

                if (error) {
                    console.error('[AuthProvider] Error cargando perfil:', error.message);
                    return null;
                }

                if (data && isMounted) {
                    console.log('[AuthProvider] Perfil cargado:', data.role);
                    setProfile(data as UserProfile);
                    return data as UserProfile;
                }

                console.warn('[AuthProvider] No se encontró perfil para el usuario');
                return null;
            } catch (err) {
                console.error('[AuthProvider] Error inesperado:', err);
                return null;
            }
        }

        // Inicialización - AHORA espera al perfil antes de marcar loading=false
        async function init() {
            try {
                console.log('[AuthProvider] Iniciando...');
                const { data: { session: s } } = await supabase.auth.getSession();

                if (!isMounted) return;

                console.log('[AuthProvider] Sesión:', s ? 'existe' : 'no existe');
                setSession(s);
                setUser(s?.user ?? null);

                // ✅ CORRECCIÓN: Esperar a que el perfil se cargue ANTES de terminar loading
                if (s?.user) {
                    await loadProfile(s.user.id);
                }

                // Solo marcar loading=false DESPUÉS de que el perfil esté listo
                if (isMounted) {
                    setLoading(false);
                    console.log('[AuthProvider] Inicialización completa');
                }
            } catch (err) {
                console.error('[AuthProvider] Error:', err);
                if (isMounted) setLoading(false);
            }
        }

        init();

        // Escuchar cambios de auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                console.log('[AuthProvider] Auth cambió:', event);

                if (!isMounted) return;

                setSession(newSession);
                setUser(newSession?.user ?? null);

                if (newSession?.user) {
                    // ✅ CORRECCIÓN: Esperar perfil antes de terminar loading
                    await loadProfile(newSession.user.id);
                } else {
                    setProfile(null);
                }

                if (isMounted) {
                    setLoading(false);
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
