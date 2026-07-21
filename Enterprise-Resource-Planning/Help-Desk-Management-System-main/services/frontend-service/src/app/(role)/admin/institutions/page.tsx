'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { AnalyticsCard } from '../../../../components/common/AnalyticsCard';
import { THEME } from '../../../../lib/theme';
import { fetchInstitutions, Institution } from '../../../../services/institutionService';
import {
    Building2,
    Plus,
    Search,
    Eye,
    Briefcase,
    MapPin,
    Globe
} from 'lucide-react';
import { PageContainer } from '../../../../components/layout/PageContainer';

const InstitutionsListPage: React.FC = () => {
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadInstitutions();
    }, []);

    const loadInstitutions = async () => {
        setIsLoading(true);
        const result = await fetchInstitutions();
        if (result.error) {
            setError(result.error);
        } else {
            setInstitutions(result.data || []);
        }
        setIsLoading(false);
    };

    const filteredInstitutions = useMemo(() => {
        return institutions.filter(inst =>
            inst.name.toLowerCase().includes(search.toLowerCase()) ||
            inst.inst_code.toLowerCase().includes(search.toLowerCase())
        );
    }, [institutions, search]);

    return (
        <PageContainer className="space-y-6">
            {/* Page Header */}
            <Card className="bg-white rounded-2xl shadow-xl border-0">
                <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2" style={{ color: THEME.colors.primary }}>
                                Institution Management
                            </h1>
                            <p style={{ color: THEME.colors.gray }}>
                                Define and manage top-level entities (Schools, Hospitals, etc.)
                            </p>
                        </div>
                        <Link href="/admin/institutions/new">
                            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                                Add Institution
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="bg-white rounded-2xl shadow-xl border-0">
                <CardHeader className="p-8 pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold">Institutions List</CardTitle>
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-4">
                    {isLoading ? (
                        <div className="text-center py-12">Loading...</div>
                    ) : (
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b text-left text-gray-500">
                                    <th className="pb-4 font-semibold">Code</th>
                                    <th className="pb-4 font-semibold">Name</th>
                                    <th className="pb-4 font-semibold">Type</th>
                                    <th className="pb-4 font-semibold">City</th>
                                    <th className="pb-4 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredInstitutions.map((inst) => (
                                    <tr key={inst.inst_code} className="hover:bg-gray-50">
                                        <td className="py-4 font-medium text-blue-600">{inst.inst_code}</td>
                                        <td className="py-4 font-semibold">{inst.name}</td>
                                        <td className="py-4">
                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs capitalize">
                                                {inst.inst_type}
                                            </span>
                                        </td>
                                        <td className="py-4 text-gray-600">{inst.city || '—'}</td>
                                        <td className="py-4">
                                            <Button variant="outline" size="sm">Edit</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>
        </PageContainer>
    );
};

export default InstitutionsListPage;
