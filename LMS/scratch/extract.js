const fs = require('fs');
const path = require('path');

const p = path.join('Lms_fe', 'app', '(dashboard)', 'admin', 'deposits', 'page.tsx');
let content = fs.readFileSync(p, 'utf8');

const startAdd = content.indexOf('{/* ── Admissions Provisioning Terminal ── */}');
const startReturn = content.indexOf('{/* ── Settlement Protocol Terminal (Refund) ── */}');

const endAddStr = `                </div>\n            )}`;
const endAdd = content.indexOf(endAddStr, startAdd) + endAddStr.length;

const endReturnStr = `            })()}`;
const endReturn = content.indexOf(endReturnStr, startReturn) + endReturnStr.length;

const addModalBlock = content.substring(startAdd, endAdd);
const returnModalBlock = content.substring(startReturn, endReturn);

// Create ProcessReturnModal
const returnModalComponent = `import { X, Loader2, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ReceiptCode } from '@/app/(dashboard)/admin/deposits/page';

interface ProcessReturnModalProps {
    showReturnModal: ReceiptCode | null;
    setShowReturnModal: (val: ReceiptCode | null) => void;
    handleProcessReturn: (e: React.FormEvent) => void;
    returnRemarks: string;
    setReturnRemarks: (val: string) => void;
    isSubmitting: boolean;
}

export function ProcessReturnModal({
    showReturnModal,
    setShowReturnModal,
    handleProcessReturn,
    returnRemarks,
    setReturnRemarks,
    isSubmitting
}: ProcessReturnModalProps) {
    if (!showReturnModal) return null;
    ${returnModalBlock.replace('{showReturnModal && (() => {', '').replace(/}\)\(\)\}$/, '')}
}`;

fs.writeFileSync(path.join('Lms_fe', 'components', 'features', 'deposits', 'ProcessReturnModal.tsx'), returnModalComponent, 'utf8');

// The add modal is very long, let's just dump it as is with proper wrapping
const addModalComponent = `import { X, Loader2, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProcessAdmissionModalProps {
    showAddModal: boolean;
    setShowAddModal: (val: boolean) => void;
    handleAddReceipt: (e: React.FormEvent) => void;
    formData: any;
    setFormData: (val: any) => void;
    courses: any[];
    isSubmitting: boolean;
    isEditMode: boolean;
    isCurrentTestNotRequired: boolean;
}

export function ProcessAdmissionModal({
    showAddModal,
    setShowAddModal,
    handleAddReceipt,
    formData,
    setFormData,
    courses,
    isSubmitting,
    isEditMode,
    isCurrentTestNotRequired
}: ProcessAdmissionModalProps) {
    if (!showAddModal) return null;
    return (
        <>
            ${addModalBlock.replace('{showAddModal && (', '').replace(/}\)$/, '')}
        </>
    );
}`;

fs.writeFileSync(path.join('Lms_fe', 'components', 'features', 'deposits', 'ProcessAdmissionModal.tsx'), addModalComponent, 'utf8');

// Replace in page.tsx
let newContent = content.replace(addModalBlock, `<ProcessAdmissionModal
                showAddModal={showAddModal}
                setShowAddModal={setShowAddModal}
                handleAddReceipt={handleAddReceipt}
                formData={formData}
                setFormData={setFormData}
                courses={courses}
                isSubmitting={isSubmitting}
                isEditMode={isEditMode}
                isCurrentTestNotRequired={isCurrentTestNotRequired}
            />`);

newContent = newContent.replace(returnModalBlock, `<ProcessReturnModal
                showReturnModal={showReturnModal}
                setShowReturnModal={setShowReturnModal}
                handleProcessReturn={handleProcessReturn}
                returnRemarks={returnRemarks}
                setReturnRemarks={setReturnRemarks}
                isSubmitting={isSubmitting}
            />`);

// add imports
newContent = newContent.replace("import { ApplicantSignalsTable } from '@/components/features/deposits/ApplicantSignalsTable';", "import { ApplicantSignalsTable } from '@/components/features/deposits/ApplicantSignalsTable';\nimport { ProcessAdmissionModal } from '@/components/features/deposits/ProcessAdmissionModal';\nimport { ProcessReturnModal } from '@/components/features/deposits/ProcessReturnModal';");

fs.writeFileSync(p, newContent, 'utf8');
