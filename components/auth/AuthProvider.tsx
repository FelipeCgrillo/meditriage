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
        let timeoutId: NodeJS.Timeout;

        // Get initial session
        async function getInitialSession() {
            try {
                console.log('[AuthProvider] Fetching initial session...');
                const { data: { session } } = await supabase.auth.getSession();
                console.log('[AuthProvider] Session fetched:', session ? 'exists' : 'none');

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    console.log('[AuthProvider] Fetching profile for user:', session.user.email);
                    try {
                        // Use RPC function instead of direct table query to bypass RLS issues
                        const { data: profileData, error } = await supabase
                            .rpc('get_current_user_profile')
                            .single();

                        if (error) {
                            console.error('[AuthProvider] Profile fetch error:', error);
                        } else if (profileData) {
                            const typedProfile = profileData as UserProfile;
                            console.log('[AuthProvider] Profile loaded successfully:', typedProfile.role);
                            setProfile(typedProfile);
                        } else {
                            console.warn('[AuthProvider] No profile data found');
                        }
                    } catch (profileError) {
                        // Profile table may not exist or RLS blocks access - continue without profile
                        console.warn('[AuthProvider] Could not fetch user profile:', profileError);
                    }
                } else {
                    console.log('[AuthProvider] No session user found');
                }
            } catch (err) {
                console.error('[AuthProvider] Auth session error:', err);
            } finally {
                console.log('[AuthProvider] Setting loading to false');
                setLoading(false);
            }
        }

        // Safety timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
            console.warn('[AuthProvider] Auth timeout reached after 5s, forcing loading state to false');
            setLoading(false);
        }, 5000);

        getInitialSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('[AuthProvider] Auth state changed:', event, session ? 'has session' : 'no session');
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    console.log('[AuthProvider] Auth change - fetching profile for:', session.user.email);
                    try {
                        // Use RPC function instead of direct table query to bypass RLS issues
                        const { data: profileData, error } = await supabase
                            .rpc('get_current_user_profile')
                            .single();

                        if (error) {
                            console.error('[AuthProvider] Profile fetch error on auth change:', error);
                        } else if (profileData) {
                            const typedProfile = profileData as UserProfile;
                            console.log('[AuthProvider] Profile loaded on auth change:', typedProfile.role);
                            setProfile(typedProfile);
                        }
                    } catch (profileError) {
                        console.warn('[AuthProvider] Could not fetch user profile on auth change:', profileError);
                    }
                } else {
                    console.log('[AuthProvider] Auth change - clearing profile');
                    setProfile(null);
                }

                // Clear the timeout since we're setting loading state
                clearTimeout(timeoutId);
                setLoading(false);
            }
        );

        return () => {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, session, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
