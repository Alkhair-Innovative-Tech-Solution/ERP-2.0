import { THEME } from '../lib/theme';

export interface Institution {
    id?: string;
    inst_id: string;
    inst_code: string;
    name: string;
    inst_type: string;
    address?: string | null;
    city?: string | null;
    contact_number?: string | null;
}

export const fetchInstitutions = async () => {
    try {
        const res = await fetch('/api/employees/institutions');
        if (!res.ok) throw new Error('Failed to fetch institutions');
        const data = await res.json();
        return { data, error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
};

export const createInstitution = async (payload: Partial<Institution>) => {
    try {
        const res = await fetch('/api/employees/institutions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create institution');
        const data = await res.json();
        return { data, error: null };
    } catch (err: any) {
        return { data: null, error: err.message };
    }
};
