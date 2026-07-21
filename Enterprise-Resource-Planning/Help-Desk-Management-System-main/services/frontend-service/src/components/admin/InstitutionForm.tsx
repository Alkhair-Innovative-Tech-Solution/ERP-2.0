'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/Button';
import { useRouter } from 'next/navigation';
import { createInstitution } from '../../services/institutionService';

const InstitutionForm: React.FC = () => {
    const router = useRouter();
    const [formData, setFormData] = useState({
        inst_code: '',
        name: '',
        inst_type: 'educational',
        address: '',
        city: '',
        contact_number: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        const result = await createInstitution(formData);
        if (result.error) {
            setError(result.error);
            setIsLoading(false);
        } else {
            alert('Institution created successfully!');
            router.push('/admin/institutions');
        }
    };

    return (
        <Card className="bg-white rounded-2xl shadow-xl border-0">
            <CardHeader className="p-8 pb-4">
                <CardTitle className="text-2xl font-bold">New Institution</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-4">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">Code * (e.g., AIT01)</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 border rounded-xl"
                                value={formData.inst_code}
                                onChange={e => setFormData({ ...formData, inst_code: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Name *</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 border rounded-xl"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Type *</label>
                            <select
                                className="w-full px-4 py-2 border rounded-xl"
                                value={formData.inst_type}
                                onChange={e => setFormData({ ...formData, inst_type: e.target.value })}
                            >
                                <option value="educational">Educational</option>
                                <option value="healthcare">Healthcare</option>
                                <option value="social_welfare">Social Welfare</option>
                                <option value="administrative">Administrative</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">City</label>
                            <input
                                type="text"
                                className="w-full px-4 py-2 border rounded-xl"
                                value={formData.city}
                                onChange={e => setFormData({ ...formData, city: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Address</label>
                        <textarea
                            className="w-full px-4 py-2 border rounded-xl"
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>

                    {error && <p className="text-red-600 text-sm">{error}</p>}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                        <Button variant="primary" type="submit" disabled={isLoading}>
                            {isLoading ? 'Creating...' : 'Create Institution'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};

export default InstitutionForm;
