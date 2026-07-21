'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/Button';
import { useRouter } from 'next/navigation';
import { createBranch } from '../../services/branchService';
import { fetchInstitutions } from '../../services/institutionService';

const BranchForm: React.FC = () => {
    const router = useRouter();
    const [institutions, setInstitutions] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        institution_code: '',
        branch_code: '',
        branch_name: '',
        status: 'active',
        address: '',
        city: '',
        contact_number: '',
        email: '',
        branch_head_name: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadInsts = async () => {
            const result = await fetchInstitutions();
            if (result.data) setInstitutions(result.data);
        };
        loadInsts();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        const result = await createBranch(formData);
        if (result.error) {
            setError(result.error);
            setIsLoading(false);
        } else {
            alert('Branch created successfully!');
            router.push('/admin/branches');
        }
    };

    return (
        <Card className="bg-white rounded-2xl shadow-xl border-0">
            <CardHeader className="p-8 pb-4">
                <CardTitle className="text-2xl font-bold">New Branch / Campus</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-4">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">Institution *</label>
                            <select
                                required
                                className="w-full px-4 py-2 border rounded-xl"
                                value={formData.institution_code}
                                onChange={e => setFormData({ ...formData, institution_code: e.target.value })}
                            >
                                <option value="">Select Institution</option>
                                {institutions.map(inst => (
                                    <option key={inst.inst_code} value={inst.inst_code}>{inst.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Branch Code * (e.g., C01)</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 border rounded-xl"
                                value={formData.branch_code}
                                onChange={e => setFormData({ ...formData, branch_code: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Branch Name *</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 border rounded-xl"
                                value={formData.branch_name}
                                onChange={e => setFormData({ ...formData, branch_name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Branch Head Name</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2 border rounded-xl"
                                value={formData.branch_head_name}
                                onChange={e => setFormData({ ...formData, branch_head_name: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">Contact Email</label>
                            <input
                                type="email"
                                className="w-full px-4 py-2 border rounded-xl"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Contact Number</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2 border rounded-xl"
                                value={formData.contact_number}
                                onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
                            />
                        </div>
                    </div>

                    {error && <p className="text-red-600 text-sm">{error}</p>}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                        <Button variant="primary" type="submit" disabled={isLoading}>
                            {isLoading ? 'Creating...' : 'Create Branch'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};

export default BranchForm;
