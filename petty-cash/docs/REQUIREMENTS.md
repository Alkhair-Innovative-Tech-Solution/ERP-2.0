# Requirements List — NGO Petty Cash Management System

Based on Analysis & Planning Document (May 2026, Head of ICT)

---

## 1. Authentication & Role-Based Access

- [x] Login with credentials / JWT token
- [x] Role: Accounts Head (full access)
- [x] Role: Branch Manager (approve/view)
- [x] Role: Auditor (read-only)
- [x] Role: Finance Head — cross-branch authority
- [x] Role: Data Entry Operator — entry only, no approvals or fund access
- [x] Role + branch assignment per individual user
- [x] Per-user spending limit
- [x] Session timeout for shared computers
- [ ] Login activity log and failed attempt tracking
- [ ] Admin-triggered password reset
- [ ] Role: Program Officer — view spending by program only

## 2. Expense Entry

- [x] Select fund (branch petty cash)
- [x] Enter: amount, date, category
- [x] Validation: balance check and required fields
- [x] Save: balance deducted, log created
- [x] Description / narration field
- [x] Payee / vendor name field
- [x] Payment method — cash, transfer, or cheque
- [x] Program / project tag (STEAM, Roti Bank, Empower Her, etc.)
- [x] Donor fund tag — links expense to a specific grant
- [ ] Mandatory receipt attachment — photo or PDF
- [ ] Warn or block submission if receipt is missing above a threshold
- [x] Configurable approval threshold — expenses above this amount wait for review
- [x] Branch Manager or Finance Head reviews and approves before balance is deducted
- [x] Rejected expenses returned to entrant with mandatory reason
- [x] Amendment workflow: correct amount, category, or tag without full void
- [x] Amendment preserves original values in audit trail alongside corrected values

## 3. Void Expense

- [x] Select any non-voided expense to void
- [x] Reason for void is required
- [x] Marks is_void = True
- [x] Fund balance restored
- [x] Audit log with timestamp and user created
- [x] Block self-voiding — user cannot void their own entry
- [x] Time window restriction — void only allowed within configured days
- [x] Mandatory Branch Manager or Finance Head approval before void is finalised
- [x] Rejected void requests logged with reason and returned
- [x] Automatic notification to original entrant, Branch Manager, and Auditor on void

## 4. Replenishment

- [x] Add fund: enter date, amount, reference number
- [x] Validate: amount greater than zero, ref# present
- [x] Fund balance increased
- [x] Replenishment log saved with full audit trail
- [x] Replenishment request flow — branch initiates, Finance Head approves
- [x] Request captures: amount, justification, program allocation
- [x] Approval gate before any balance change occurs
- [ ] Transfer proof attachment — bank slip, cheque image, or transfer screenshot
- [ ] Donor fund source field — identifies which grant the money came from
- [x] Configurable minimum balance threshold per fund — triggers alert to Branch Manager
- [x] Maximum single replenishment amount
- [x] Maximum monthly replenishment limit per branch

## 5. Reports

- [x] Filter by: date range, fund, category
- [x] View: totals and expense list
- [x] Export: CSV or PDF
- [x] Filter by: branch / campus, program / project, donor fund, approval status, amount range
- [x] Combined multi-dimension filters in one query
- [x] Report templates by audience: Donor, Management, Audit, Branch, Program
- [x] Donor Report: grant amount, total spent, program breakdown, receipt bundle
- [x] Management Summary: cross-branch comparison, budget vs actual, top categories
- [x] Audit Trail Report: all transactions including voids, amendments, approval chain, timestamps
- [x] Branch Report: single branch, current period, replenishment history
- [x] Program Report: all expenses for one program across all branches
- [x] Budget vs actual tracking per fund and per program
- [x] Summary cards: total transactions, net amount, void count, pending count
- [ ] Projected fund exhaustion date based on current burn rate
- [ ] Report delivery: export emailed directly to recipient from system
- [ ] Report archive: all generated reports saved with metadata and delivery record
- [ ] Receipt bundle: expenses exported together with their attached supporting documents

## 6. Fund Management

- [x] Create fund with name and initial balance
- [x] View current available balance
- [x] Fund type: operational, program, donor-restricted, emergency, project
- [x] Branch / campus assignment
- [x] Fund start date and optional expiry date
- [ ] Annual or project budget allocation per fund
- [ ] Spending category restrictions — only allowed categories can be charged to restricted funds
- [x] Minimum balance alert threshold
- [ ] Maximum balance limit
- [x] Fund states: Active, Suspended, Archived
- [x] Auto-suspend when balance hits zero or expiry date passes (not yet)
- [x] Archive closed funds — history preserved, no new transactions
- [x] Fund transfer: move balance between funds with Finance Head approval
- [x] Consolidated dashboard: all branches and funds in one view with health indicators

## 7. Settings / Configuration

- [x] Manage users: add, edit, deactivate
- [x] Manage categories: add, rename, deactivate
- [x] Branch / campus management: create, edit, assign users
- [x] Role assignment and fund access scope per user
- [x] Per-user spending limit configuration
- [x] Expense approval threshold by role
- [x] Void approval toggle — make it always required regardless of amount
- [x] Replenishment approval threshold
- [x] Self-approval allowed / not allowed toggle
- [x] Maximum single expense amount hard limit
- [x] Void time window in days
- [x] Category hierarchy: parent categories with sub-categories (not yet)
- [ ] Category type: operational, program, capital
- [ ] Category-to-fund restrictions
- [ ] Per-category approval threshold
- [x] Low balance alert threshold per fund
- [x] Alert recipients by role
- [ ] Notification delivery: email, SMS, or WhatsApp
- [x] Alert frequency: instant or daily digest
- [x] Full settings change log: who changed what, old value, new value, timestamp
- [x] Fund Types read-only table in settings
- [ ] Login activity log and password reset by admin
- [ ] Session timeout duration configurable
- [ ] Accounting period close and archive
- [ ] Data export and backup

---

**Total Requirements: 90**  
**Implemented: ~65** (72%)  
**Not yet implemented: ~25** (28%)
