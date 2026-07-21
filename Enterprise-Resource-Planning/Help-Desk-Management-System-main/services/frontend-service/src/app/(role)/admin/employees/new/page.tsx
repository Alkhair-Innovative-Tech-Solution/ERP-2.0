import React from 'react';
import EmployeeForm from '../../../../../components/admin/EmployeeForm';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card';
import { THEME } from '../../../../../lib/theme';
import { PageContainer } from '../../../../../components/layout/PageContainer';

const NewEmployeePage = () => {
  return (
    <PageContainer>
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardHeader className="p-4 md:p-6 lg:p-8">
          <CardTitle className="text-2xl font-bold" style={{ color: THEME.colors.primary }}>
            Create Employee
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 lg:p-8">
          <EmployeeForm />
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default NewEmployeePage;
