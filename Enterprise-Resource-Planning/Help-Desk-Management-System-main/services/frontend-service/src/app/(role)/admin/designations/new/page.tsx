'use client';

import React from 'react';
import DesignationForm from '../../../../../components/admin/DesignationForm';
import { PageContainer } from '../../../../../components/layout/PageContainer';

const NewDesignationPage: React.FC = () => {
  return (
    <PageContainer>
      <DesignationForm />
    </PageContainer>
  );
};

export default NewDesignationPage;
