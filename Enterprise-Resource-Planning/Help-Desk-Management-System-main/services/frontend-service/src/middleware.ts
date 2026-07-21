import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Exclude public paths (and API routes if needed, though usually better to protect APIS at backend)
    // We exclude /login, /register, /forgot-password, static files, and explicit auth API calls
    const publicPaths = ['/login', '/register', '/forgot-password', '/favicon.ico'];
    if (
        publicPaths.some((path) => pathname.startsWith(path)) ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.startsWith('/api/auth') // Allow auth API endpoints
    ) {
        return NextResponse.next();
    }

    // 2. Auth Check
    const token = request.cookies.get('auth_token')?.value;
    const role = request.cookies.get('user_role')?.value;

    // If no token, redirect to login
    if (!token) {
        const loginUrl = new URL('/login', request.url);
        // loginUrl.searchParams.set('from', pathname); // Optional: remember where they were
        return NextResponse.redirect(loginUrl);
    }

    // 3. RBAC (Role-Based Access Control)
    // Redirect to /login if role doesn't match the path
    // This effectively blocks access without showing an "Unauthorized" page,
    // making it appear as if the user is simply not logged in for that resource.

    const userRole = role?.toLowerCase();

    if (pathname.startsWith('/admin') && userRole !== 'admin') {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (pathname.startsWith('/moderator') && userRole !== 'moderator') {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (pathname.startsWith('/assignee') && userRole !== 'assignee') {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (pathname.startsWith('/requestor') && userRole !== 'requestor') {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 4. Role-Based Home Redirection (Optional UX improvement)
    // If user hits root '/', redirect to their specific dashboard
    if (pathname === '/') {
        if (role) {
            return NextResponse.redirect(new URL(`/${role.toLowerCase()}/dashboard`, request.url));
        }
    }

    return NextResponse.next();
}

// Configure which paths the middleware runs on
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
