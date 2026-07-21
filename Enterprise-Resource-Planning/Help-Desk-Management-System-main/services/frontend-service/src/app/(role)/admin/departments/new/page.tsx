'use client';

import React from 'react';
import DepartmentForm from '../../../../../components/admin/DepartmentForm';
import { PageContainer } from '../../../../../components/layout/PageContainer';

const NewDepartmentPage: React.FC = () => {
  return (
    <PageContainer fluid className="max-w-4xl mx-auto">
      <DepartmentForm />
    </PageContainer>
  );
};

export default NewDepartmentPage;
