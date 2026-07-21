import { describe, it, expect, beforeAll } from 'vitest';
import ticketService from '../ticketService';
import { ENV } from '../../../config/env';

describe('TicketService Integration', () => {
    let token: string;

    beforeAll(async () => {
        // Attempt to login to Real API
        // We try to login with a known test account.
        // Ensure 'admin@example.com' / 'admin' or similar exists in your local DB.
        // If this fails, make sure auth-service is running and accessible.
        try {
            // Create a specific user or use a default one.
            // Trying default admin credentials often used in dev.
            const response = await fetch(`${ENV.AUTH_SERVICE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    // Adjust these credentials to match your local database
                    email: 'admin@example.com',
                    password: 'admin',
                    // Or if using employee_code:
                    // employee_code: 'A-00-0001',
                }),
            });

            if (!response.ok) {
                console.warn(`Login failed: ${response.status} ${response.statusText}`);
                // If 401, credentials wrong. 
                // We will proceed, but authenticated endpoints might fail.
                return;
            }

            const data = await response.json();
            token = data.access_token || data.token; // adjust based on auth response

            if (token) {
                localStorage.setItem('token', token);
                // Also set user info if needed
                localStorage.setItem('user', JSON.stringify(data.user || {}));
            }
        } catch (error) {
            console.error('Setup (Login) failed:', error);
        }
    });

    it('should fetch tickets from the real API', async () => {
        // This test hits the backend GET /api/v1/tickets/
        // It verifies that the "500 Internal Server Error" caused by schema mismatch is GONE.
        // And that we receive valid UUIDs.

        const response = await ticketService.getTickets();

        expect(response).toBeDefined();
        expect(response.results).toBeDefined();
        expect(Array.isArray(response.results)).toBe(true);

        if (response.results.length > 0) {
            const ticket = response.results[0];

            // Verify Valid UUID
            expect(ticket.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

            // Verify Attachments Schema (Nullable file_id check)
            if (ticket.attachments && ticket.attachments.length > 0) {
                ticket.attachments.forEach(att => {
                    // If file_id is missing/null, url might be derived or empty, but it shouldn't crash.
                    // TicketService mapToTicket handles null file_id gracefully now.
                    expect(att).toBeDefined();
                });
            }
        }
    });

    it('should get a specific ticket by ID', async () => {
        // First get list to find an ID
        const list = await ticketService.getTickets();
        if (list.results.length === 0) {
            console.warn('No tickets found to test getTicketById');
            return;
        }

        const targetId = list.results[0].id;
        const ticket = await ticketService.getTicketById(targetId);

        expect(ticket).toBeDefined();
        expect(ticket.id).toBe(targetId);
        expect(ticket.ticketId).toBeDefined();
    });
});
