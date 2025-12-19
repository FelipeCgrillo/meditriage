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
        // Get initial session
        async function getInitialSession() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    try {
                        const { data: profileData, error } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();

                        if (!error && profileData) {
                            setProfile(profileData as UserProfile);
                        }
                    } catch (profileError) {
                        // Profile table may not exist or RLS blocks access - continue without profile
                        console.warn('Could not fetch user profile:', profileError);
                    }
                }
            } catch (err) {
                console.error('Auth session error:', err);
            } finally {
                setLoading(false);
            }
        }

        getInitialSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    try {
                        const { data: profileData, error } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();

                        if (!error && profileData) {
                            setProfile(profileData as UserProfile);
                        }
                    } catch (profileError) {
                        console.warn('Could not fetch user profile on auth change:', profileError);
                    }
                } else {
                    setProfile(null);
                }

                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, session, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
