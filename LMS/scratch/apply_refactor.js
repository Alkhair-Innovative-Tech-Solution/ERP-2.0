const fs = require('fs');
const path = require('path');

const p = path.join('Lms_fe', 'app', '(dashboard)', 'admin', 'deposits', 'page.tsx');
let content = fs.readFileSync(p, 'utf8');

// 1. Add Imports
content = content.replace(
    "import { Badge } from '@/components/ui/badge';",
    `import { Badge } from '@/components/ui/badge';
import { DepositStatsRow } from '@/components/features/deposits/DepositStatsRow';
import { TransactionRegistryTable } from '@/components/features/deposits/TransactionRegistryTable';
import { ApplicantSignalsTable } from '@/components/features/deposits/ApplicantSignalsTable';
import { ProcessAdmissionModal } from '@/components/features/deposits/ProcessAdmissionModal';
import { ProcessReturnModal } from '@/components/features/deposits/ProcessReturnModal';`
);

// 2. Export interfaces
content = content.replace("interface ReceiptCode {", "export interface ReceiptCode {");
content = content.replace("interface EntranceLead {", "export interface EntranceLead {");

// 3. Replace Stats Row
const statsStart = content.indexOf('{/* ── Intelligence Row ── */}');
const statsEnd = content.indexOf('{/* ── Control Console ── */}');
if (statsStart !== -1 && statsEnd !== -1) {
    const replacement = `{/* ── Intelligence Row ── */}
            <DepositStatsRow 
                totalReceipts={receipts.length}
                awaitingRefunds={receipts.filter(c => !c.is_returned).length}
                qualifiedLeads={leads.filter(l => l.status === 'passed').length}
            />

            `;
    content = content.substring(0, statsStart) + replacement + content.substring(statsEnd);
}

// 4. Replace Main Data Matrix
const matrixStart = content.indexOf('{/* ── Main Data Matrix ── */}');
const matrixEnd = content.indexOf('{/* ── Admissions Provisioning Terminal ── */}');
if (matrixStart !== -1 && matrixEnd !== -1) {
    const replacement = `{/* ── Main Data Matrix ── */}
                <div className="premium-card overflow-hidden border-none shadow-premium bg-white">
                    {activeTab === 'receipts' ? (
                        <TransactionRegistryTable
                            filteredReceipts={filteredReceipts}
                            showArchived={showArchived}
                            getCourseName={getCourseName}
                            handleOpenEdit={handleOpenEdit}
                            handleRestoreDeposit={handleRestoreDeposit}
                            handleDeleteDeposit={handleDeleteDeposit}
                            setShowReturnModal={setShowReturnModal}
                        />
                    ) : (
                        <ApplicantSignalsTable
                            filteredLeads={filteredLeads}
                            getCourseName={getCourseName}
                            prefillFromLead={prefillFromLead}
                        />
                    )}
                </div>
            </div>

            `;
    content = content.substring(0, matrixStart) + replacement + content.substring(matrixEnd);
}

// 5. Replace Modals
const modalStart = content.indexOf('{/* ── Admissions Provisioning Terminal ── */}');
const endOfFile = content.lastIndexOf('</div>\n    );\n}');

if (modalStart !== -1 && endOfFile !== -1) {
    const replacement = `{/* ── Admissions Provisioning Terminal ── */}
            <ProcessAdmissionModal
                showAddModal={showAddModal}
                setShowAddModal={setShowAddModal}
                handleAddReceipt={handleAddReceipt}
                formData={formData}
                setFormData={setFormData}
                courses={courses}
                isSubmitting={isSubmitting}
                isEditMode={isEditMode}
                isCurrentTestNotRequired={isCurrentTestNotRequired}
            />

            {/* ── Settlement Protocol Terminal (Refund) ── */}
            <ProcessReturnModal
                showReturnModal={showReturnModal}
                setShowReturnModal={setShowReturnModal}
                handleProcessReturn={handleProcessReturn}
                returnRemarks={returnRemarks}
                setReturnRemarks={setReturnRemarks}
                isSubmitting={isSubmitting}
            />

        `;
    content = content.substring(0, modalStart) + replacement + content.substring(endOfFile);
}

fs.writeFileSync(p, content, 'utf8');
console.log("Refactoring applied successfully.");
