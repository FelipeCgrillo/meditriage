'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';
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

    // Usar ref para controlar el timeout y evitar race conditions
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const initializedRef = useRef(false);

    // Función para cargar el perfil del usuario
    const loadUserProfile = useCallback(async (userId: string, userEmail: string) => {
        console.log('[AuthProvider] Cargando perfil para:', userEmail);
        try {
            const { data: profileData, error } = await supabase
                .rpc('get_current_user_profile')
                .single();

            if (error) {
                console.error('[AuthProvider] Error al cargar perfil:', error.message);
                return null;
            }

            if (profileData) {
                const typedProfile = profileData as UserProfile;
                console.log('[AuthProvider] Perfil cargado:', typedProfile.role);
                return typedProfile;
            }

            console.warn('[AuthProvider] No se encontró perfil para el usuario');
            return null;
        } catch (err) {
            console.error('[AuthProvider] Error inesperado cargando perfil:', err);
            return null;
        }
    }, []);

    // Función para limpiar el timeout de seguridad
    const clearSafetyTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // Función para finalizar la carga
    const finishLoading = useCallback(() => {
        clearSafetyTimeout();
        setLoading(false);
        console.log('[AuthProvider] Carga finalizada');
    }, [clearSafetyTimeout]);

    useEffect(() => {
        // Evitar doble inicialización en React Strict Mode
        if (initializedRef.current) return;
        initializedRef.current = true;

        // Timeout de seguridad extendido a 10 segundos
        timeoutRef.current = setTimeout(() => {
            console.warn('[AuthProvider] Timeout de 10s alcanzado, forzando fin de carga');
            setLoading(false);
        }, 10000);

        async function initializeAuth() {
            try {
                console.log('[AuthProvider] Iniciando autenticación...');

                // Obtener sesión inicial
                const { data: { session: initialSession }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('[AuthProvider] Error obteniendo sesión:', error.message);
                    finishLoading();
                    return;
                }

                console.log('[AuthProvider] Sesión:', initialSession ? 'encontrada' : 'no existe');

                setSession(initialSession);
                setUser(initialSession?.user ?? null);

                // Si hay usuario, cargar el perfil
                if (initialSession?.user) {
                    const userProfile = await loadUserProfile(
                        initialSession.user.id,
                        initialSession.user.email || ''
                    );
                    setProfile(userProfile);
                }

                finishLoading();
            } catch (err) {
                console.error('[AuthProvider] Error en inicialización:', err);
                finishLoading();
            }
        }

        // Suscribirse a cambios de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                console.log('[AuthProvider] Cambio de estado:', event);

                setSession(newSession);
                setUser(newSession?.user ?? null);

                if (newSession?.user) {
                    const userProfile = await loadUserProfile(
                        newSession.user.id,
                        newSession.user.email || ''
                    );
                    setProfile(userProfile);
                } else {
                    setProfile(null);
                }

                // Si aún estamos cargando, finalizar
                finishLoading();
            }
        );

        // Iniciar carga de autenticación
        initializeAuth();

        // Cleanup
        return () => {
            clearSafetyTimeout();
            subscription.unsubscribe();
        };
    }, [loadUserProfile, finishLoading, clearSafetyTimeout]);

    return (
        <AuthContext.Provider value={{ user, profile, session, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
