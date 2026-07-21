'use client';

import React from 'react';
import InstitutionForm from '../../../../../components/admin/InstitutionForm';
import { PageContainer } from '../../../../../components/layout/PageContainer';

const NewInstitutionPage: React.FC = () => {
    return (
        <PageContainer fluid className="max-w-4xl mx-auto">
            <InstitutionForm />
        </PageContainer>
    );
};

export default NewInstitutionPage;
