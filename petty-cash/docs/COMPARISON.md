# Standard Petty Cash Software vs Current System — Comparison

> Comparison against industry-standard NGO petty cash management practices.
> Based on: Analysis & Planning Document (May 2026) and current system review.

---

## 1. Authentication & Access Control

| Feature | Standard NGO Practice | Current System | Status |
|---------|----------------------|----------------|--------|
| Role-based access (at least 4 roles) | Finance Head, Accounts Head, Branch Manager, Auditor, Data Entry | 5 roles implemented | ✅ |
| Branch-scoped user access | Users restricted to assigned branch | Implemented via `get_user_branch` | ✅ |
| Per-user spending limit | Each user has configurable max entry amount | Implemented via `spending_limit` field | ✅ |
| Session timeout | Auto-logout after inactivity | Configurable via `session_timeout_minutes` setting | ✅ |
| Login audit log & failed attempt tracking | Track last login, failed attempts, IP | Partial — AuditLog exists, login tracking not yet complete | ⚠️ |
| Admin password reset | Admin can reset any user's password | Not implemented | ❌ |
| 2FA / MFA | Two-factor authentication for financial roles | Not implemented | ❌ |

## 2. Expense Entry

| Feature | Standard NGO Practice | Current System | Status |
|---------|----------------------|----------------|--------|
| Description / narration | Required text field explaining expense | Implemented as `narration` field | ✅ |
| Payee / vendor name | Who received payment | Implemented as `payee` + `vendor_name` | ✅ |
| Payment method | Cash, bank transfer, cheque, card | Implemented as `payment_method` | ✅ |
| Program / project tag | Links expense to specific program | Implemented as `program_tag` | ✅ |
| Donor fund tag | Links expense to specific grant/donor | Implemented as `donor_fund_tag` | ✅ |
| Receipt attachment | Mandatory photo/PDF of receipt | Partially — model has `receipt` field, enforce on frontend optional | ⚠️ |
| Approval threshold | Expenses above threshold need manager review | Implemented — configurable via settings | ✅ |
| Auto-approve below threshold | Small expenses save immediately | Implemented | ✅ |
| Reject with reason | Rejected expenses returned with mandatory reason | Implemented | ✅ |
| Amendment workflow | Correct without void+re-enter | Implemented — amend amount/category/description | ✅ |
| Draft / submit state | Save as draft, submit for review later | Not implemented | ❌ |
| Category approval threshold | Different thresholds per category | Not implemented | ❌ |

## 3. Void / Cancellation

| Feature | Standard NGO Practice | Current System | Status |
|---------|----------------------|----------------|--------|
| Self-void prevention | User cannot void own expense | Implemented via `self_void_blocked` setting | ✅ |
| Void time window | Void only within X days of transaction | Configurable via `void_time_window_days` | ✅ |
| Void requires approval | Manager must approve before void takes effect | Implemented via ApprovalRequest flow | ✅ |
| Void notification | Notify entrant, manager, auditor on void | Implemented via Notification model | ✅ |
| Mandatory void reason | Reason required before void | Implemented | ✅ |
| Fund balance restoration | Balance restored on void | Implemented | ✅ |
| Void audit trail | Timestamp, user, reason logged | Implemented via AuditLog | ✅ |

## 4. Replenishment

| Feature | Standard NGO Practice | Current System | Status |
|---------|----------------------|----------------|--------|
| Request & approval flow | Branch requests → Finance Head approves | Implemented via ReplenishmentRequest | ✅ |
| Justification required | Reason for replenishment required | Implemented as `reason` field | ✅ |
| Transfer proof attachment | Bank slip / cheque image required | Not implemented — `transfer_proof` model field exists but frontend missing | ⚠️ |
| Donor fund source tracking | Which grant is the source | Not implemented | ❌ |
| Configurable max single replenishment | Hard cap per transaction | Implemented via `max_replenishment_per_transaction` | ✅ |
| Configurable max monthly replenishment | Monthly cap per fund | Implemented via `max_replenishment_per_month` | ✅ |
| Low-balance auto-alert | Alert when balance below threshold | Implemented with configurable threshold + role-based recipients | ✅ |
| Replenishment history | Complete log with approval chain | Implemented | ✅ |

## 5. Reports

| Feature | Standard NGO Practice | Current System | Status |
|---------|----------------------|----------------|--------|
| Multi-dimension filters | Branch, program, donor, category, date, status, amount | Implemented (9 filter dimensions) | ✅ |
| Report templates by audience | Different reports for different roles | Implemented (5 template types) | ✅ |
| Budget vs actual tracking | Compare spending against allocation | Implemented in dashboard + reports | ✅ |
| Cross-branch comparison | Finance Head sees all branches | Implemented — Finance Head dashboard | ✅ |
| Receipt bundle export | Expenses + receipts as one package | Not implemented | ❌ |
| Automated report delivery | Scheduled email of reports | Not implemented | ❌ |
| Report archive | Saved reports with metadata | Not implemented | ❌ |
| Summery cards | High-level KPIs at a glance | Implemented (transactions, net amount, void, pending) | ✅ |
| Transaction-level drilldown | Click through to individual transactions | Implemented in results table | ✅ |

## 6. Fund Management

| Feature | Standard NGO Practice | Current System | Status |
|---------|----------------------|----------------|--------|
| Fund types | Operational, program, donor, emergency, project | Implemented via FundType model | ✅ |
| Branch assignment | Fund tied to a branch | Implemented via `branch` FK on CashFund | ✅ |
| Fund lifecycle | Active, Suspended, Archived | Implemented via `status` field | ✅ |
| Fund transfer between branches | Approved transfer process | Implemented via FundTransfer workflow | ✅ |
| Consolidated dashboard | All branches in one view | Implemented — cross_branch_balances endpoint | ✅ |
| Budget allocation per fund | Annual/project budget attached to fund | Partially — MonthlyBudget is separate from CashFund | ⚠️ |
| Spending category restrictions | Restricted funds limited to allowed categories | Not implemented | ❌ |
| Maximum balance cap | Hard upper limit on fund balance | Not implemented | ❌ |
| Fund health indicators | Burn rate, projected exhaustion | Not implemented | ❌ |

## 7. Settings & Controls

| Feature | Standard NGO Practice | Current System | Status |
|---------|----------------------|----------------|--------|
| Configurable approval thresholds | Expense, void, replenishment thresholds in settings | Implemented via SystemSetting model | ✅ |
| Alert configuration | Low balance, threshold alerts configurable | Implemented (threshold, recipients, frequency) | ✅ |
| Settings audit log | Every config change logged | Implemented via AuditLog with action='settings_change' | ✅ |
| Category hierarchy | Parent/sub-category structure | Not implemented | ❌ |
| Category-to-fund restrictions | Which categories can use which funds | Not implemented | ❌ |
| Branch management in settings | Add/edit/assign branches | Implemented | ✅ |
| User management | Add/edit/deactivate/role/branch/limit | Implemented | ✅ |
| Fund types management | View fund types in settings | Implemented (read-only table) | ✅ |
| Report branding | NGO logo, name, letterhead | Not implemented | ❌ |

## 8. Notifications & Alerts

| Feature | Standard NGO Practice | Current System | Status |
|---------|----------------------|----------------|--------|
| In-app notifications | Bell icon, badge count, dropdown | Implemented | ✅ |
| Notification types | approval_pending, low_balance, replenishment_request, etc. | Implemented (7+ types) | ✅ |
| Mark as read | User can mark notifications read | Implemented | ✅ |
| Mark all read | Bulk action | Implemented | ✅ |
| Auto-poll | Poll for new notifications every 30s | Implemented | ✅ |
| Email notifications | Email delivery of alerts | Not implemented | ❌ |
| SMS / WhatsApp alerts | Mobile delivery | Not implemented | ❌ |

---

## Overall Assessment

| Category | Standard Coverage | Current Coverage | Gap |
|----------|-----------------|-----------------|-----|
| Auth & Access Control | 7 features | 4.5 features | 36% gap |
| Expense Entry | 11 features | 9 features | 18% gap |
| Void / Cancellation | 7 features | 7 features | 0% gap ✅ |
| Replenishment | 8 features | 6 features | 25% gap |
| Reports | 9 features | 7 features | 22% gap |
| Fund Management | 10 features | 6.5 features | 35% gap |
| Settings & Controls | 9 features | 7 features | 22% gap |
| Notifications & Alerts | 7 features | 5 features | 29% gap |
| **TOTAL** | **68 features** | **52 features** | **~24% gap** |

## Priority Gaps to Close (Top 10)

1. Receipt attachment mandatory enforcement
2. Receipt bundle export with reports
3. Donor fund source tracking on replenishments
4. Budget allocation per fund (not just per branch per month)
5. Spending category restrictions on restricted funds
6. Login audit log & admin password reset
7. Automated report delivery (email)
8. Category hierarchy (parent/sub-categories)
9. Fund health indicators (burn rate, projected exhaustion)
10. Draft/submit state for expenses

---

*Comparison date: June 2026*
