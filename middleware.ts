import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session if expired
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Define protected routes and their required roles
    const protectedRoutes: Record<string, string[]> = {
        '/nurse': ['nurse', 'admin'],
        '/resultados': ['researcher', 'admin'],
    };

    // Check if the current path is protected
    const matchedRoute = Object.keys(protectedRoutes).find(route =>
        pathname.startsWith(route)
    );

    if (matchedRoute) {
        // User not authenticated - redirect to appropriate login
        if (!user) {
            const loginPath = matchedRoute === '/nurse'
                ? '/login/nurse'
                : '/login/resultados';

            const url = request.nextUrl.clone();
            url.pathname = loginPath;
            url.searchParams.set('redirect', pathname);
            return NextResponse.redirect(url);
        }

        // Get user's role from profile
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const allowedRoles = protectedRoutes[matchedRoute];

        if (!profile || !allowedRoles.includes(profile.role)) {
            // User doesn't have the required role
            const url = request.nextUrl.clone();
            url.pathname = '/unauthorized';
            return NextResponse.redirect(url);
        }
    }

    // Redirect authenticated users away from login pages
    if (user && pathname.startsWith('/login')) {
        const url = request.nextUrl.clone();

        // Get user's role to redirect to appropriate dashboard
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile) {
            if (profile.role === 'nurse' || profile.role === 'admin') {
                url.pathname = '/nurse';
            } else if (profile.role === 'researcher') {
                url.pathname = '/resultados';
            } else {
                url.pathname = '/';
            }
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public routes (/, /paciente, /api, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|api|paciente|propuesta-piloto|$).*)',
    ],
};
