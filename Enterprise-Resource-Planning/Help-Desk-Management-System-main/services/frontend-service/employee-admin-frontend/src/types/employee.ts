export interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    position: string;
    department: string;
    hireDate: string;
    salary: number;
    bankAccount: {
        accountNumber: string;
        bankName: string;
        routingNumber: string;
    };
    education: Array<{
        degree: string;
        institution: string;
        graduationYear: number;
    }>;
}