import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// This route uses the service role key to create users
// IMPORTANT: Only accessible server-side, never expose service role key to client

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
    try {
        // Validate service role key exists
        if (!supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Service role key not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { email, password, role, fullName } = body;

        // Validate required fields
        if (!email || !password || !role) {
            return NextResponse.json(
                { error: 'Email, password, and role are required' },
                { status: 400 }
            );
        }

        // Validate role
        const validRoles = ['nurse', 'researcher', 'admin'];
        if (!validRoles.includes(role)) {
            return NextResponse.json(
                { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate password length
        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        // Create admin client with service role key
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email
        });

        if (authError) {
            console.error('Auth error:', authError);
            return NextResponse.json(
                { error: authError.message },
                { status: 400 }
            );
        }

        if (!authData.user) {
            return NextResponse.json(
                { error: 'Failed to create user' },
                { status: 500 }
            );
        }

        // Create user profile with role
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert({
                id: authData.user.id,
                email: email,
                role: role,
                full_name: fullName || null,
            });

        if (profileError) {
            console.error('Profile error:', profileError);
            // Try to delete the auth user if profile creation failed
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return NextResponse.json(
                { error: `User created but profile failed: ${profileError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            user: {
                id: authData.user.id,
                email: authData.user.email,
                role: role,
                fullName: fullName,
            }
        });

    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET - List all users (for admin panel)
export async function GET() {
    try {
        if (!supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Service role key not configured' },
                { status: 500 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Get all user profiles
        const { data: profiles, error } = await supabaseAdmin
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ users: profiles });

    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE - Delete a user
export async function DELETE(request: NextRequest) {
    try {
        if (!supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Service role key not configured' },
                { status: 500 }
            );
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('id');

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Delete user from auth (profile will cascade delete due to foreign key)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
