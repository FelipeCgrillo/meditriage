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

// Helper para agregar timeout a una promesa
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => {
            console.warn(`[AuthProvider] Timeout de ${ms}ms alcanzado`);
            resolve(fallback);
        }, ms))
    ]);
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        // Función para cargar perfil con timeout de 3 segundos
        async function loadProfile(userId: string): Promise<UserProfile | null> {
            console.log('[AuthProvider] Cargando perfil para:', userId);

            const fetchProfile = async (): Promise<UserProfile | null> => {
                try {
                    const { data, error } = await supabase
                        .from('user_profiles')
                        .select('id, email, role, full_name')
                        .eq('id', userId)
                        .maybeSingle();

                    if (error) {
                        console.error('[AuthProvider] Error cargando perfil:', error.message);
                        return null;
                    }

                    if (data) {
                        console.log('[AuthProvider] Perfil cargado:', data.role);
                        return data as UserProfile;
                    }

                    console.warn('[AuthProvider] No se encontró perfil');
                    return null;
                } catch (err) {
                    console.error('[AuthProvider] Error inesperado:', err);
                    return null;
                }
            };

            // Timeout de 3 segundos para la carga del perfil
            const profileData = await withTimeout(fetchProfile(), 3000, null);

            if (profileData && isMounted) {
                setProfile(profileData);
            }

            return profileData;
        }

        async function init() {
            try {
                console.log('[AuthProvider] Iniciando...');
                const { data: { session: s } } = await supabase.auth.getSession();

                if (!isMounted) return;

                console.log('[AuthProvider] Sesión:', s ? 'existe' : 'no existe');
                setSession(s);
                setUser(s?.user ?? null);

                // Intentar cargar perfil (con timeout, no bloquea indefinidamente)
                if (s?.user) {
                    await loadProfile(s.user.id);
                }

                if (isMounted) {
                    setLoading(false);
                    console.log('[AuthProvider] ✅ Inicialización completa');
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
