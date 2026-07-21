'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';

const INACTIVITY_LIMIT = 3 * 60 * 1000; // 3 minutes in milliseconds

export const SessionTimeout = () => {
    const router = useRouter();
    const pathname = usePathname();
    const { logout, user } = useAuthStore();
    const lastActivityRef = useRef<number>(Date.now());
    const [isClient, setIsClient] = useState(false);

    // Only run on client
    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;

        // Skip timeout check for login page or public paths
        const publicPaths = ['/login', '/register', '/forgot-password'];
        if (publicPaths.some(path => pathname?.startsWith(path))) {
            return;
        }

        // Only enforce timeout if user is logged in (conceptually)
        // We check 'user' or just rely on the fact we are on a protected route via middleware

        const updateActivity = () => {
            lastActivityRef.current = Date.now();
        };

        // Events to track activity
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

        // Add event listeners
        events.forEach(event => {
            window.addEventListener(event, updateActivity);
        });

        // Check for inactivity periodically
        const intervalId = setInterval(() => {
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivityRef.current;

            if (timeSinceLastActivity > INACTIVITY_LIMIT) {
                handleLogout();
            }
        }, 1000); // Check every second

        const handleLogout = () => {
            // 1. Clear local storage / state
            logout();

            // 2. Clear cookies explicitly (redundancy for middleware)
            document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

            // 3. Redirect to login
            router.push('/login');
        };

        return () => {
            // Cleanup
            events.forEach(event => {
                window.removeEventListener(event, updateActivity);
            });
            clearInterval(intervalId);
        };
    }, [isClient, pathname, logout, router]);

    return null; // This component renders nothing
};
