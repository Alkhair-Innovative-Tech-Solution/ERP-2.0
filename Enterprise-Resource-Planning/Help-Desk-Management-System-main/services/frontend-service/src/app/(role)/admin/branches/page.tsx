'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import { THEME } from '../../../../lib/theme';
import { fetchBranches, Branch } from '../../../../services/branchService';
import {
    MapPin,
    Plus,
    Search,
    School,
    Building,
    User
} from 'lucide-react';
import { PageContainer } from '../../../../components/layout/PageContainer';

const BranchesListPage: React.FC = () => {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadBranches();
    }, []);

    const loadBranches = async () => {
        setIsLoading(true);
        const result = await fetchBranches();
        if (!result.error) {
            setBranches(result.data || []);
        }
        setIsLoading(false);
    };

    const filteredBranches = useMemo(() => {
        return branches.filter(b =>
            b.branch_name.toLowerCase().includes(search.toLowerCase()) ||
            b.branch_code.toLowerCase().includes(search.toLowerCase()) ||
            b.institution_code.toLowerCase().includes(search.toLowerCase())
        );
    }, [branches, search]);

    return (
        <PageContainer className="space-y-6">
            {/* Page Header */}
            <Card className="bg-white rounded-2xl shadow-xl border-0">
                <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2" style={{ color: THEME.colors.primary }}>
                                Branch Management
                            </h1>
                            <p style={{ color: THEME.colors.gray }}>
                                Manage physical locations and campuses under institutions
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Link href="/admin/branches/new">
                                <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                                    Add Branch
                                </Button>
                            </Link>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="bg-white rounded-2xl shadow-xl border-0">
                <CardHeader className="p-8 pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold">Branches List</CardTitle>
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search branches..."
                                className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-4">
                    {isLoading ? (
                        <div className="text-center py-12">Loading branches...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredBranches.map((br) => (
                                <Card key={br.branch_code} className="hover:shadow-lg transition-all border-l-4 border-l-blue-500">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-bold text-lg text-gray-900">{br.branch_name}</h3>
                                                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{br.branch_code}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${br.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {br.status}
                                            </span>
                                        </div>

                                        <div className="space-y-2 mb-6">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <School className="w-4 h-4 text-gray-400" />
                                                <span>Inst: <span className="font-medium">{br.institution_code}</span></span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <span>Head: {br.branch_head_name || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <MapPin className="w-4 h-4 text-gray-400" />
                                                <span className="truncate">{br.city || 'No Address'}</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 border-t pt-4">
                                            <Button variant="outline" size="sm">Manage Depts</Button>
                                            <Button variant="primary" size="sm">Edit</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </PageContainer>
    );
};

export default BranchesListPage;
