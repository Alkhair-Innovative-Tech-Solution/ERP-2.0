# Frontend Requirements Document - HDMS (Help Desk Management System)

**Version:** 1.0  
**Last Updated:** December 2025  
**Status:** Active Development

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design System Integration (IAK)](#design-system-integration-iak)
3. [Current Implementation Status](#current-implementation-status)
4. [Role-Based Pages Breakdown](#role-based-pages-breakdown)
5. [Page-by-Page Specifications](#page-by-page-specifications)
6. [Component Requirements](#component-requirements)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Technical Specifications](#technical-specifications)

---

## Executive Summary

This document provides a comprehensive guide for building the HDMS frontend based on:
- **Business requirements** from project documentation (Docs folder)
- **IAK Design System** for consistent UI/UX across all IAK products
- **Current implementation status** and what remains to be built
- **Role-based user journeys** (requestor, Moderator, Assignee, Admin)

**Key Goals:**
- Create a unified, professional UI that feels like part of the IAK family
- Implement all required pages and workflows for each role
- Ensure responsive design (mobile-first approach)
- Maintain consistency with IAK Design System colors, components, and patterns

---

## Design System Integration (IAK)

### Core Design Principles

The HDMS frontend **MUST** follow the IAK Design System principles:

1. **Clarity First**: Most important information at the top (KPIs, key stats)
2. **Consistency**: Same colors, paddings, fonts across SMS, HDMS, and future systems
3. **Data-First Dashboards**: Top area = KPIs/trends/filters, Below = detailed tables/cards
4. **Responsive by Default**: Mobile → single column, Tablet → 2 columns, Desktop → 3-4 columns
5. **Accessible and Readable**: Good contrast, 14-16px base text, clear labels

### Color System

All pages **MUST** use the IAK color palette:

#### Primary/Brand Colors
- `#365486` - Primary blue (main actions, buttons)
- `#274c77` - Deep blue (headers, sidebar text, table headers)
- `#6096ba` - Accent blue (highlights, active states)

**Usage:**
- Primary buttons: `bg-[#365486]` or `bg-primary`
- Table headers: `bg-[#274c77]` with white text
- Active sidebar items: `bg-[#6096ba]` with `text-[#e7ecef]`
- Sidebar borders: `border-r-[3px] border-[#1c3f67]`

#### Background Colors
- Page background: `bg-[#e7ecef]` (very light gray)
- Card surfaces: `bg-white` or `bg-card`
- Input containers: `bg-slate-50` or `bg-white`

#### Semantic Colors
- **Success**: `#34d399`, `#22c55e`, `#10b981` (for "Active", "Resolved", positive states)
- **Warning**: `#fbbf24`, `#facc15` (for "Pending", "At Risk" states)
- **Danger**: `#e53935`, `#f87171`, `#ef4444` (for "Rejected", delete actions, errors)

#### Chart Colors
Use chart tokens (`chart-1` through `chart-6`) for all analytics:
- `chart-1`: `#fbbf24`
- `chart-2`: `#60a5fa`
- `chart-3`: `#a78bfa`
- `chart-4`: `#34d399`
- `chart-5`: `#f87171`
- `chart-6`: `#60a5fa`

### Typography

- **Font Family**: Geist Sans (`--font-geist-sans`)
- **Base Text**: `text-sm` to `text-base`, `font-normal`, `text-slate-800`
- **Page Titles**: `text-3xl` to `text-4xl` `font-bold` (desktop), `text-2xl` (mobile)
- **Section Titles**: `text-base` to `text-lg` `font-semibold`
- **Field Labels**: `text-[11px]` uppercase, `tracking-wide`, `text-slate-500`

### Layout Patterns

#### Root Layout Structure
```
┌─────────────────────────────────────┐
│ Root Layout (bg-[#e7ecef])          │
├──────────┬──────────────────────────┤
│ Sidebar  │ Main Content Area        │
│ (Fixed)  │ (flex-1, py-8)           │
│          │ ┌──────────────────────┐ │
│          │ │ max-w-7xl mx-auto    │ │
│          │ │ px-4 sm:px-6         │ │
│          │ │ [Page Content]       │ │
│          │ └──────────────────────┘ │
└──────────┴──────────────────────────┘
```

#### Dashboard Template Structure
1. **Header/Hero Section**
   - Background: `bg-gradient-to-br from-slate-50 to-blue-50`
   - Card: `shadow-2xl border-0 bg-white`
   - Contains: Title, subtitle, meta info

2. **KPI Row**
   - Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
   - Uses `KpiCard` components

3. **Filters/Controls Row**
   - Search and filter dropdowns
   - Date range pickers if needed

4. **Main Content Grid**
   - `grid-cols-1 lg:grid-cols-2` or `lg:grid-cols-3`
   - Gaps: `gap-4 sm:gap-6 lg:gap-8`

5. **Detailed Tables/Data**
   - `DataTable` components
   - Pagination controls

### Component Standards

**Always use shared components from:**
- `src/components/ui` - Base UI components (Button, Input, Card, etc.)
- `src/components/common` - Shared functional components
- `src/components/charts` - Analytics visualizations

**Never create custom styles for:**
- Buttons (use `Button` variants)
- Cards (use `Card` structure)
- Inputs (use `Input` component)
- Tables (use `DataTable` or `Table` primitives)

---

## Current Implementation Status

### ✅ Completed Components & Pages

#### Authentication Pages
- ✅ Login page (`app/(auth)/login/page.tsx`)
- ✅ Register page (`app/(auth)/register/page.tsx`)
- ✅ Forgot Password page (`app/(auth)/forgot-password/page.tsx`)

#### Layout Components
- ✅ Root Layout (`app/layout.tsx`)
- ✅ Role-based Layout (`app/(role)/[role]/layout.tsx`)
- ✅ Sidebar (`components/layout/Sidebar.tsx`) - **Following IAK design**
- ✅ Navbar (`components/layout/Navbar.tsx`)
- ✅ RoleGuard (`components/layout/RoleGuard.tsx`)
- ✅ PageWrapper (`components/layout/PageWrapper.tsx`)

#### Dashboard Components
- ✅ requestorDashboard (`components/dashboards/requestorDashboard.tsx`)
- ✅ ModeratorDashboard (`components/dashboards/ModeratorDashboard.tsx`)
- ✅ AssigneeDashboard (`components/dashboards/AssigneeDashboard.tsx`)
- ✅ AdminDashboard (`components/dashboards/AdminDashboard.tsx`)
- ✅ DashboardContainer (`components/dashboards/DashboardContainer.tsx`)

#### UI Components
- ✅ Button (`components/ui/Button.tsx`)
- ✅ Input (`components/ui/Input.tsx`)
- ✅ Select (`components/ui/Select.tsx`)
- ✅ TextArea (`components/ui/TextArea.tsx`)
- ✅ Card (`components/ui/card.tsx`)
- ✅ Modal (`components/ui/Modal.tsx`)
- ✅ Toast (`components/ui/Toast.tsx`)
- ✅ DataTable (`components/ui/DataTable.tsx`)
- ✅ SkeletonLoader (`components/ui/SkeletonLoader.tsx`)

#### Common Components
- ✅ PriorityBadge (`components/common/PriorityBadge.tsx`)
- ✅ StatusTag (`components/common/StatusTag.tsx`)
- ✅ StatusBadge (`components/common/StatusBadge.tsx`)
- ✅ ActionButtons (`components/common/ActionButtons.tsx`)
- ✅ AnalyticsCard (`components/common/AnalyticsCard.tsx`)
- ✅ TicketTimeline (`components/common/TicketTimeline.tsx`)
- ✅ TicketChat (`components/common/TicketChat.tsx`)

#### Chart Components
- ✅ TicketVolumeChart (`components/charts/TicketVolumeChart.tsx`)
- ✅ DepartmentLoadChart (`components/charts/DepartmentLoadChart.tsx`)
- ✅ PriorityTrendChart (`components/charts/PriorityTrendChart.tsx`)

#### Modal Components
- ✅ AssignTicketModal (`components/modals/AssignTicketModal.tsx`)
- ✅ ConfirmModal (`components/modals/ConfirmModal.tsx`)
- ✅ ReassignModal (`components/modals/ReassignModal.tsx`)
- ✅ SplitTicketModal (`components/modals/SplitTicketModal.tsx`)

#### Profile & Notifications
- ✅ DynamicProfile (`components/profile/DynamicProfile.tsx`)
- ✅ DynamicNotifications (`components/notifications/DynamicNotifications.tsx`)
- ✅ NotificationCard (`components/notifications/NotificationCard.tsx`)

#### Page Structure (Routes Exist)
- ✅ Dashboard pages (`[role]/dashboard/page.tsx`)
- ✅ Requests/Tasks pages (`[role]/requests/page.tsx`, `assignee/tasks/page.tsx`)
- ✅ New Request page (`[role]/new-request/page.tsx`)
- ✅ Request Detail page (`[role]/request-detail/[id]/page.tsx`)
- ✅ Profile page (`[role]/profile/page.tsx`)
- ✅ Notifications page (`[role]/notifications/page.tsx`)
- ✅ Admin pages (users, analytics, reports, settings)
- ✅ Moderator pages (review, assigned, reassign, create-subtickets, ticket-pool)
- ✅ Assignee pages (tasks, task-detail, reports)

### ⚠️ Partially Implemented (Need Completion/Refinement)

1. **Page Content Implementation**
   - Most pages exist but may need full content implementation
   - Need to verify all pages have complete functionality per requirements

2. **Real-time Features**
   - WebSocket integration may need completion
   - Real-time chat functionality needs verification
   - Live notifications need testing

3. **Form Validation**
   - Client-side validation schemas need verification
   - Error handling and display patterns

4. **API Integration**
   - All API service files need verification
   - Error handling and loading states

### ❌ Missing/Needs Implementation

1. **Business Rules UI Implementation**
   - Draft expiration handling (7-day soft delete)
   - Undo functionality for Moderator (15-minute window)
   - Reopen limit enforcement (max 2 times)
   - Postponement reason requirement (mandatory)
   - Sub-ticket creation (Moderator only)
   - Finance approval workflow UI

2. **Advanced Features**
   - SLA tracking and breach alerts
   - Auto-close countdown (3 days with reminder on day 1)
   - Postponement reminders (every 3 days)
   - Load-based assignment visibility for Moderators
   - Department workload balancing display

3. **File Upload UI**
   - File upload with progress indicator
   - Multiple file support
   - File type validation feedback
   - Virus scan status display
   - File preview/download

4. **Search & Filtering**
   - Advanced search functionality
   - Multi-filter support
   - Saved filters (if required)

5. **Analytics & Reporting**
   - Comprehensive analytics dashboards
   - Report generation and export
   - Custom date range selection

6. **Accessibility Features**
   - Keyboard navigation
   - Screen reader support
   - Focus management
   - ARIA labels

---

## Role-Based Pages Breakdown

### Overview: What Each User Sees

#### **requestor** (Principals, Department Heads, Staff)
- **Dashboard**: Personal ticket overview, statistics
- **My Requests**: List of created tickets (all statuses)
- **New Request**: Create new ticket form
- **Request Detail**: View ticket details, chat, attachments
- **Notifications**: Real-time notifications
- **Profile**: User profile management

#### **Moderator** (Helpdesk Officer)
- **Dashboard**: System-wide ticket overview, workload distribution
- **Ticket Pool**: All tickets awaiting review/assignment
- **Review**: Review and validate incoming tickets
- **Assigned**: Tickets assigned by moderator (tracking)
- **Reassign**: Reassign tickets to different departments
- **Create Subtickets**: Split tickets into sub-tickets
- **Notifications**: Real-time notifications
- **Profile**: User profile management

#### **Assignee** (Department Head)
- **Dashboard**: Department-specific ticket overview
- **My Tasks**: Assigned tickets for their department
- **Task Detail**: Detailed view with chat, updates, completion
- **Reports**: Department performance reports
- **Notifications**: Real-time notifications
- **Profile**: User profile management

#### **Admin** (Helpdesk Administrator)
- **Dashboard**: System-wide analytics and KPIs
- **Users**: User management (import, grant access, deactivate)
- **Analytics**: Comprehensive system analytics
- **Reports**: System reports and audit logs
- **Settings**: System configuration (departments, categories, SLA templates)
- **Notifications**: Real-time notifications
- **Profile**: User profile management

---

## Page-by-Page Specifications

### Authentication Pages

#### 1. Login Page (`/login`)

**Design:**
- Centered card layout on `bg-[#e7ecef]` background
- Card: White background, rounded corners, shadow
- IAK logo/header at top

**Content:**
- Form fields:
  - Employee Code (Input)
  - Password (Input, type password)
  - Remember Me checkbox (optional)
- Submit button: Primary blue (`bg-[#365486]`)
- Links:
  - "Forgot Password?" → `/forgot-password`
  - "Register" → `/register` (if registration open)

**States:**
- Loading: Show spinner on submit button
- Error: Display error message below form
- Success: Redirect to role-specific dashboard

**Business Rules:**
- Rate limit: 10 requests/minute
- Show appropriate error messages for invalid credentials
- JWT token stored in localStorage/cookies

---

### requestor Pages

#### 1. requestor Dashboard (`/requestor/dashboard`)

**Layout Structure:**
```
┌─────────────────────────────────────────┐
│ Header Card (Gradient Background)       │
│ Welcome, [User Name]                    │
│ Quick stats summary                     │
└─────────────────────────────────────────┘
┌──────┬──────┬──────┬──────┐
│ KPI  │ KPI  │ KPI  │ KPI  │
│ Card │ Card │ Card │ Card │
└──────┴──────┴──────┴──────┘
┌─────────────────────────────────────────┐
│ My Recent Requests                      │
│ (Table/List of 5-10 most recent)        │
└─────────────────────────────────────────┘
┌──────────────┬──────────────┐
│ Priority     │ Status       │
│ Distribution │ Distribution │
│ (Chart)      │ (Chart)      │
└──────────────┴──────────────┘
```

**KPI Cards:**
1. **Total Requests**
   - Value: Total tickets created
   - Trend: Up/down indicator
   - Icon: FileText

2. **Open Tickets**
   - Value: Tickets in progress/pending
   - Color: Warning (yellow) if > 5
   - Icon: AlertCircle

3. **Resolved This Month**
   - Value: Count of resolved tickets
   - Trend: Monthly comparison
   - Icon: CheckCircle

4. **Average Resolution Time**
   - Value: Days (e.g., "3.2 days")
   - Trend: Better/worse than previous month
   - Icon: Clock

**Content:**
- Recent Requests Table:
  - Columns: ID, Title, Status, Priority, Department, Created Date, Actions
  - Clickable rows → navigate to detail page
  - Status badges with appropriate colors
  - Priority badges (High=red, Medium=yellow, Low=green)

- Charts:
  - Priority Distribution (Pie/Donut chart using chart colors)
  - Status Distribution (Bar chart)
  - Resolution Time Trend (Line chart over last 30 days)

**Actions:**
- "New Request" button (top-right) → `/requestor/new-request`
- Quick filters: All, Open, Resolved, Drafts

---

#### 2. My Requests (`/requestor/requests`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Page Header                             │
│ "My Requests"                           │
│ [New Request Button]                    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Search & Filter Bar                     │
│ [Search Input] [Status Filter]          │
│ [Priority Filter] [Date Range]          │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Requests Table (DataTable)              │
│ ID | Title | Status | Priority | Date  │
│ ... | ... | ... | ... | ...            │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Pagination Controls                     │
└─────────────────────────────────────────┘
```

**Table Columns:**
1. **Ticket ID** - Clickable, links to detail
2. **Title** - Truncated if long, tooltip on hover
3. **Status** - StatusBadge component
   - Draft (gray)
   - Submitted (blue)
   - Pending (yellow)
   - In Progress (blue)
   - Resolved (green)
   - Closed (dark gray)
   - Rejected (red)
4. **Priority** - PriorityBadge component
5. **Department** - Department name
6. **Created Date** - Formatted (e.g., "2 days ago")
7. **Actions** - View button (primary blue)

**Filters:**
- **Status**: Dropdown (All, Draft, Submitted, Pending, In Progress, Resolved, Closed, Rejected)
- **Priority**: Dropdown (All, High, Medium, Low)
- **Department**: Dropdown (All departments user can request)
- **Date Range**: Date picker (Last 7 days, Last 30 days, Custom range)

**Search:**
- Full-text search across: Title, Description, Ticket ID

**Mobile View:**
- Each row becomes a card
- Stack fields vertically
- Actions at bottom of card

---

#### 3. New Request (`/requestor/new-request`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Page Header                             │
│ "Create New Request"                    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Form Card                               │
│                                         │
│ Basic Information Section               │
│ ┌───────────────────────────────────┐  │
│ │ Title * (Input)                   │  │
│ │ Description * (TextArea)          │  │
│ │ Department * (Select)             │  │
│ │ Category * (Select)               │  │
│ │ Priority * (Select)               │  │
│ └───────────────────────────────────┘  │
│                                         │
│ Attachments Section                     │
│ ┌───────────────────────────────────┐  │
│ │ File Upload Area                  │  │
│ │ [Drop files or click to upload]   │  │
│ │ File list with preview            │  │
│ │ Max: 250MB per file, 100MB total  │  │
│ └───────────────────────────────────┘  │
│                                         │
│ Action Buttons                          │
│ [Save as Draft] [Submit Request]        │
└─────────────────────────────────────────┘
```

**Form Fields:**
1. **Title** (Required)
   - Input: Max 200 characters
   - Validation: Required, min 10 characters

2. **Description** (Required)
   - TextArea: Min 20 characters
   - Rich text? (Markdown support optional)
   - Character counter

3. **Department** (Required)
   - Select dropdown
   - Options from available departments
   - Disabled if user has no access

4. **Category** (Required)
   - Select dropdown
   - Depends on selected department
   - Categories loaded dynamically

5. **Priority** (Required)
   - Select: High, Medium, Low
   - Each option has color-coded badge preview

**File Upload:**
- Drag-and-drop zone
- Click to browse files
- File type validation:
  - Documents: PDF, TXT, DOCX, XLSX
  - Images: JPG, PNG, GIF (converted to WebP)
  - Videos: MP4, MOV, MKV, AVI (transcoded to MP4)
- File size limits:
  - Frontend validation: 250MB per file (show error immediately)
  - Server limit: 500MB (will reject if exceeds)
  - Total per ticket: 100MB
- Upload progress indicator
- File list with:
  - File name
  - File size
  - Upload status (Uploading, Processing, Ready, Error)
  - Remove button

**Actions:**
- **Save as Draft**: 
  - Saves ticket with `is_draft=true`
  - No notification to moderator
  - Can be edited later
  - Auto-deleted after 7 days (soft delete)

- **Submit Request**:
  - Validates all required fields
  - Uploads files
  - Creates ticket with status `Submitted`
  - Notifies moderator
  - Redirects to ticket detail page

**Business Rules:**
- requestor can only edit **before submission**
- After submission, editing disabled (show message)
- Maximum 10 open tickets per requestor (warning shown if exceeded)
- Drafts visible only to requestor

**Validation Messages:**
- Field-level errors below each input
- Summary error at top if form submission fails
- Clear, user-friendly messages

---

#### 4. Request Detail (`/requestor/request-detail/[id]`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Header Card                             │
│ Ticket #12345 - [Title]                 │
│ Status Badge | Priority Badge           │
│ Created: [Date] | Last Updated: [Date]  │
└─────────────────────────────────────────┘
┌──────────────┬──────────────┐
│ Ticket Info  │ Participants │
│ Card         │ Card         │
│              │              │
│ - Department │ - requestor  │
│ - Category   │ - Moderator  │
│ - Assignee   │ - Assignee   │
│ - SLA        │ (if assigned)│
│ - Due Date   │              │
└──────────────┴──────────────┘
┌─────────────────────────────────────────┐
│ Description Card                        │
│ [Full description text]                 │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Attachments Card                        │
│ [File list with download buttons]       │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Timeline Card                           │
│ [Status change history]                 │
│ - Created on [date] by [user]           │
│ - Submitted on [date]                   │
│ - Assigned to [dept] on [date]          │
│ - Status changed to In Progress         │
│ ...                                     │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Chat Section                            │
│ ┌───────────────────────────────────┐  │
│ │ Message History                   │  │
│ │ [Scrollable message list]         │  │
│ │                                   │  │
│ │ User: Message text...             │  │
│ │ Moderator: Response...            │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ Message Input                     │  │
│ │ [Text area] [Send] [Attach]       │  │
│ └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Action Buttons (Context-aware)          │
│ [Edit] (if Draft)                       │
│ [Resolve] (if Completed)                │
│ [Request Reopen] (if Closed)            │
│ [Cancel] (if Draft)                     │
└─────────────────────────────────────────┘
```

**Ticket Info Section:**
- **Status**: Large status badge with appropriate color
- **Priority**: Priority badge
- **Department**: Department name with icon
- **Category**: Category name
- **Assignee**: Name and avatar (if assigned)
- **SLA**: Time remaining (e.g., "2 days remaining")
  - Color: Green (>50% remaining), Yellow (25-50%), Red (<25% or breached)
- **Due Date**: Formatted date
- **Created**: Relative time (e.g., "3 days ago")
- **Last Updated**: Relative time

**Participants Card:**
- List of all participants:
  - requestor (always visible)
  - Moderator (if ticket reviewed)
  - Assignee/Department Head (if assigned)
  - Sub-ticket participants (if exists)
- Show avatars, names, roles
- Join timestamp for each participant

**Description Card:**
- Full description text
- Preserve formatting (line breaks, etc.)
- Expandable if very long

**Attachments Card:**
- List of all attachments:
  - File icon
  - File name (truncated if long)
  - File size
  - Upload date
  - Download button
  - Virus scan status (if processing)
- Group by: Ticket attachments vs Chat attachments

**Timeline Card:**
- Chronological list of events:
  - Ticket created
  - Status changes
  - Assignments
  - Comments (important ones)
  - Approvals/rejections
  - Reopens
- Each event shows:
  - Icon
  - Event description
  - User who performed action
  - Timestamp
  - Additional details (reason, comment, etc.)

**Chat Section:**
- Real-time chat interface
- Messages grouped by date
- Each message shows:
  - Sender avatar and name
  - Message text
  - Timestamp
  - Mentions highlighted
  - Attachments (if any)
- Message input:
  - Text area (auto-resize)
  - Send button
  - Attach file button
  - Mention support (@username)
- Typing indicators
- New message notification (if scrolled up)

**Action Buttons (Context-aware):**
- **Edit**: Only shown if status is `Draft`
  - Opens edit modal or navigates to edit page
- **Resolve**: Shown when status is `Completed`
  - Opens confirmation modal
  - Options: "Mark as Resolved" or "Request Rework"
- **Request Reopen**: Shown when status is `Closed`
  - Opens modal with reason required
  - Max 2 reopens (disable if limit reached)
  - Requires Moderator approval
- **Cancel**: Only shown if status is `Draft`
  - Soft deletes the ticket

**Business Rules:**
- requestor can only see messages after their join timestamp
- Admin/Moderator can see full chat history
- requestor cannot edit after submission
- Reopen limit: Maximum 2 times (show error if exceeded)
- Auto-close countdown visible if ticket is `Resolved` (e.g., "Will auto-close in 2 days")

---

#### 5. Notifications (`/requestor/notifications`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Page Header                             │
│ "Notifications"                         │
│ [Mark All as Read]                      │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Filter Tabs                             │
│ [All] [Unread] [Read]                   │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Notification List                       │
│ ┌───────────────────────────────────┐  │
│ │ Notification Card (Unread)        │  │
│ │ Icon | Title | Message | Time     │  │
│ │ [Mark as Read] [View]             │  │
│ └───────────────────────────────────┘  │
│ ...                                     │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Pagination                              │
└─────────────────────────────────────────┘
```

**Notification Types:**
1. **Ticket Created** - Confirmation of ticket submission
2. **Ticket Assigned** - Ticket assigned to department
3. **Status Changed** - Status update notification
4. **New Message** - New chat message in ticket
5. **Mention** - User mentioned in chat
6. **Approval Request** - Approval requested (if relevant)
7. **Ticket Resolved** - Ticket marked as completed
8. **Reopen Request** - Reopen request status update
9. **Postponement** - Ticket postponed notification
10. **SLA Reminder** - SLA breach or reminder

**Notification Card:**
- **Unread**: Bold text, blue dot indicator, lighter background
- **Read**: Normal text, no indicator, white background
- Shows:
  - Notification icon (type-specific)
  - Title (bold)
  - Message/preview (truncated)
  - Relative time (e.g., "2 hours ago")
  - Action buttons: "Mark as Read", "View Ticket"
- Clickable: Opens ticket detail page

**Actions:**
- Mark individual notification as read
- Mark all as read
- Filter by type (optional)
- Delete notification (optional)

---

### Moderator Pages

#### 1. Moderator Dashboard (`/moderator/dashboard`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Header Card                             │
│ Helpdesk Overview                       │
│ System-wide statistics                  │
└─────────────────────────────────────────┘
┌──────┬──────┬──────┬──────┬──────┐
│ KPI  │ KPI  │ KPI  │ KPI  │ KPI  │
│ Card │ Card │ Card │ Card │ Card │
└──────┴──────┴──────┴──────┴──────┘
┌─────────────────────────────────────────┐
│ Department Workload Distribution        │
│ [Chart showing ticket counts per dept]  │
└─────────────────────────────────────────┘
┌──────────────┬──────────────┐
│ Tickets      │ SLA Alerts   │
│ Requiring    │ (Red badges) │
│ Attention    │              │
│ [List]       │ [List]       │
└──────────────┴──────────────┘
┌─────────────────────────────────────────┐
│ Recent Activity                         │
│ [Timeline of recent actions]            │
└─────────────────────────────────────────┘
```

**KPI Cards:**
1. **Pending Review** - Tickets awaiting review
2. **Total Active Tickets** - All non-closed tickets
3. **Tickets Assigned Today** - Count of today's assignments
4. **Average Resolution Time** - System-wide average
5. **SLA Breaches** - Tickets with breached SLA (red if >0)

**Department Workload Chart:**
- Bar chart showing active tickets per department
- Color-coded by load (green=low, yellow=medium, red=high)
- Clickable: Navigate to department details

**Tickets Requiring Attention:**
- List of tickets needing action:
  - Pending review > 24 hours
  - Postponed tickets needing restart
  - Reopen requests pending approval
  - SLA breaches

**SLA Alerts:**
- List of tickets with:
  - Breached SLA (red)
  - Approaching SLA (yellow, <25% remaining)
- Show: Ticket ID, Title, Department, Time Overdue/Remaining

---

#### 2. Ticket Pool (`/moderator/ticket-pool`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Page Header                             │
│ "Ticket Pool"                           │
│ [View: All | Pending | Under Review]    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Filters & Search                        │
│ [Search] [Status] [Priority] [Dept]     │
│ [Date Range]                            │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Tickets Table                           │
│ ID | Title | requestor | Status | ...   │
│ [Bulk Actions Dropdown]                 │
└─────────────────────────────────────────┘
```

**Table Columns:**
1. **Checkbox** - For bulk selection
2. **Ticket ID** - Clickable
3. **Title** - Truncated
4. **requestor** - Name and avatar
5. **Department** - Department name
6. **Status** - Status badge
7. **Priority** - Priority badge
8. **Created Date** - Relative time
9. **SLA** - Time remaining (color-coded)
10. **Actions** - Dropdown:
    - Review
    - Assign
    - Reject
    - Postpone
    - View Detail

**Bulk Actions:**
- Assign to Department (bulk)
- Change Priority (bulk)
- Postpone (bulk)
- Export Selected

**Filter Options:**
- Status: All, Pending, Under Review, Assigned, Postponed
- Priority: All, High, Medium, Low
- Department: All departments
- Date Range: Created date filter
- SLA Status: All, Breached, Approaching, Normal

---

#### 3. Review Ticket (`/moderator/review`)

**Layout:**
Similar to Ticket Detail page but with **Moderator Actions** section:

```
┌─────────────────────────────────────────┐
│ Moderator Actions Card                  │
│ ┌───────────────────────────────────┐  │
│ │ Action Selection                  │  │
│ │ ○ Approve & Assign                │  │
│ │ ○ Reject                          │  │
│ │ ○ Request Clarification           │  │
│ └───────────────────────────────────┘  │
│                                         │
│ [Assign to Department Dropdown]         │
│ [Priority Override Dropdown]            │
│ [SLA Override Date Picker]              │
│ [Reason/Comment TextArea]               │
│                                         │
│ [Submit Action] [Undo Last Action]      │
└─────────────────────────────────────────┘
```

**Action Options:**
1. **Approve & Assign**
   - Select department (required)
   - Select assignee/department head (auto-filled, can override)
   - Priority (pre-filled, can override)
   - SLA due date (auto-calculated, can override)
   - Reason (optional comment)
   - Submit → Creates assignment, status → `Assigned`

2. **Reject**
   - Reason (required)
   - Submit → Status → `Rejected` (end of lifecycle)
   - Shows warning: "This action cannot be undone. Ticket will be permanently closed."

3. **Request Clarification**
   - Reason/Comment (required)
   - Submit → Status stays `Under_Review`, notifies requestor

**Additional Features:**
- **Load-Based Assignment**: Shows department workload before assignment
  - Active tickets count per department
  - Team member availability
  - Capacity indicators

- **Undo Last Action**: 
  - Only available within 15 minutes
  - Shows countdown timer
  - Fully restores previous state

- **Create Sub-Tickets**: 
  - Button to split ticket
  - Opens SplitTicketModal
  - Only Moderator can create sub-tickets

**Business Rules:**
- Rejection is final (cannot be reopened)
- Undo available only within 15 minutes
- Must see department workload before assignment
- Can override priority and SLA during assignment

---

#### 4. Create Subtickets (`/moderator/create-subtickets`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Page Header                             │
│ "Create Sub-Tickets"                    │
│ Parent Ticket: #12345 - [Title]         │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Parent Ticket Info                      │
│ [Summary card]                          │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Sub-Ticket Form                         │
│ ┌───────────────────────────────────┐  │
│ │ Sub-Ticket 1                      │  │
│ │ Title *                           │  │
│ │ Description *                     │  │
│ │ Department *                      │  │
│ │ Assignee *                        │  │
│ │ Priority *                        │  │
│ │ [Remove]                          │  │
│ └───────────────────────────────────┘  │
│                                         │
│ [+ Add Another Sub-Ticket]              │
│                                         │
│ [Cancel] [Create Sub-Tickets]           │
└─────────────────────────────────────────┘
```

**Form:**
- Can create multiple sub-tickets at once
- Each sub-ticket requires:
  - Title
  - Description
  - Department (different from parent)
  - Assignee (department head)
  - Priority
  - SLA (optional override)
- Dynamic form: Add/remove sub-ticket forms
- Validation: All required fields, no duplicate departments

**Business Rules:**
- Only Moderator can create sub-tickets
- Sub-tickets automatically join parent ticket chat
- Parent ticket progress = (closed sub-tickets / total sub-tickets)
- Sub-tickets are child-level only (no nesting)

---

#### 5. Reassign (`/moderator/reassign`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Page Header                             │
│ "Reassign Tickets"                      │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Current Assignment Info                 │
│ Ticket #12345                           │
│ Currently Assigned to: [Dept Name]      │
│ Assigned on: [Date]                     │
│ Status: In Progress                     │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Reassignment Form                       │
│ New Department * (Select)               │
│ New Assignee * (Select)                 │
│ Reason * (TextArea, required)           │
│                                         │
│ [Cancel] [Confirm Reassignment]         │
└─────────────────────────────────────────┘
```

**Process:**
1. Select ticket to reassign (from list or direct link)
2. Show current assignment details
3. Select new department and assignee
4. Enter reason (required)
5. Confirm → Removes old assignee access, assigns to new department, notifies all participants

**Business Rules:**
- Reason is required
- Old assignee loses access immediately
- All participants notified
- Audit log created

---

### Assignee Pages

#### 1. Assignee Dashboard (`/assignee/dashboard`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Header Card                             │
│ [Department Name] Dashboard             │
│ Department Head: [Name]                 │
└─────────────────────────────────────────┘
┌──────┬──────┬──────┬──────┐
│ KPI  │ KPI  │ KPI  │ KPI  │
│ Card │ Card │ Card │ Card │
└──────┴──────┴──────┴──────┘
┌─────────────────────────────────────────┐
│ My Active Tasks                         │
│ [Table of assigned tickets]             │
└─────────────────────────────────────────┘
┌──────────────┬──────────────┐
│ Department   │ Performance  │
│ Workload     │ Metrics      │
│ (Chart)      │ (Chart)      │
└──────────────┴──────────────┘
```

**KPI Cards:**
1. **Active Tasks** - Tickets in progress
2. **Pending Tasks** - Assigned but not started
3. **Completed This Month** - Count of completed tickets
4. **Average Resolution Time** - Department average

**Active Tasks Table:**
- Columns: ID, Title, Priority, Status, Created, SLA, Actions
- Quick actions: Start Work, Update Progress, Mark Complete

---

#### 2. My Tasks (`/assignee/tasks`)

**Layout:**
Similar to requestor's "My Requests" but for assigned tickets

**Table Columns:**
1. Ticket ID
2. Title
3. requestor
4. Priority
5. Status
6. Created Date
7. SLA
8. Actions

**Quick Actions:**
- **Acknowledge**: Confirm receipt of assignment
- **Start Work**: Change status to `In_Progress`
- **Update Progress**: Add progress notes
- **Mark Complete**: Submit for requestor verification
- **Request Sub-Ticket**: Request moderator to create sub-ticket (via chat)
- **Request Postponement**: Request postpone with reason

**Filters:**
- Status: All, Assigned, In Progress, Completed, Postponed
- Priority: All, High, Medium, Low
- SLA Status: All, Breached, Approaching, Normal

---

#### 3. Task Detail (`/assignee/task-detail/[id]`)

**Layout:**
Similar to requestor's Request Detail but with **Assignee Actions**:

```
┌─────────────────────────────────────────┐
│ Assignee Actions Card                   │
│ ┌───────────────────────────────────┐  │
│ │ Progress Update                   │  │
│ │ Progress %: [0-100]               │  │
│ │ Progress Notes: [TextArea]        │  │
│ │ [Add File]                        │  │
│ │ [Save Progress]                   │  │
│ └───────────────────────────────────┘  │
│                                         │
│ Quick Actions:                          │
│ [Start Work] [Update Status]            │
│ [Mark Complete] [Request Sub-Ticket]    │
│ [Request Approval] (Finance only)       │
│ [Request Postponement]                  │
└─────────────────────────────────────────┘
```

**Actions:**
1. **Acknowledge**: Confirm assignment receipt
2. **Start Work**: Status → `In_Progress`
3. **Update Progress**: Add progress percentage and notes
4. **Mark Complete**: 
   - Status → `Completed`
   - Add completion notes (required)
   - Attach proof files (optional)
   - Notifies requestor to verify
5. **Request Sub-Ticket**: 
   - Opens chat interface
   - Flag message as `request_subticket`
   - Describes need for other department
   - Only Assignee can request (not requestor)
6. **Request Approval** (Finance Assignee only):
   - Creates approval request
   - Status → `Waiting_Approval`
   - Notifies CEO/Finance approver
7. **Request Postponement**:
   - Opens modal with reason (required)
   - Sends request to Moderator

**Business Rules:**
- Only Department Head can update tickets (team members are for acknowledgment only)
- Completion requires notes
- Sub-ticket request must be via chat (not direct creation)
- Finance approval only for Finance department assignees

---

### Admin Pages

#### 1. Admin Dashboard (`/admin/dashboard`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Header Card                             │
│ System Overview                         │
│ HDMS Administration                     │
└─────────────────────────────────────────┘
┌──────┬──────┬──────┬──────┬──────┐
│ KPI  │ KPI  │ KPI  │ KPI  │ KPI  │
│ Card │ Card │ Card │ Card │ Card │
└──────┴──────┴──────┴──────┴──────┘
┌─────────────────────────────────────────┐
│ System-Wide Analytics                   │
│ [Multiple charts and metrics]           │
└─────────────────────────────────────────┘
┌──────────────┬──────────────┐
│ Recent Users │ System       │
│ Activity     │ Alerts       │
│ [Table]      │ [List]       │
└──────────────┴──────────────┘
```

**KPI Cards:**
1. **Total Users** - Active users count
2. **Total Tickets** - All-time ticket count
3. **Active Tickets** - Currently open tickets
4. **Departments** - Total departments
5. **System Uptime** - Availability percentage

**Analytics:**
- Ticket volume trends (last 30 days, 6 months, 1 year)
- Department performance comparison
- User activity metrics
- Resolution time trends
- SLA compliance rate

---

#### 2. Users Management (`/admin/users`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Page Header                             │
│ "User Management"                       │
│ [Import from SMS] [Add User]            │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Search & Filters                        │
│ [Search] [Role] [Department] [Status]   │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Users Table                             │
│ Employee Code | Name | Role | Dept | ...│
└─────────────────────────────────────────┘
```

**Table Columns:**
1. Employee Code
2. Name
3. Email
4. Role (Badge)
5. Department
6. Status (Active/Inactive)
7. Last Login
8. Actions (Edit, Deactivate, Grant Access, Revoke Access)

**Actions:**
- **Import from SMS**: 
  - Modal with employee code input
  - Fetches user from SMS system
  - Creates HDMS user record
  - Sets initial role
- **Grant HDMS Access**: Enable helpdesk access for SMS user
- **Revoke Access**: Disable helpdesk access (soft delete)
- **Assign Role**: Change user role (requestor, Moderator, Assignee, Admin)
- **Assign to Department**: Add user to department
- **Deactivate**: Mark user as inactive (soft delete)

**Business Rules:**
- All deletions are soft deletes
- User data synced from SMS
- Admin can see all users across departments

---

#### 3. Settings (`/admin/settings`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Page Header                             │
│ "System Settings"                       │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Settings Tabs                           │
│ [Departments] [Categories] [SLA]        │
│ [Integrations] [Notifications]          │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Tab Content Area                        │
│ [Form based on selected tab]            │
└─────────────────────────────────────────┘
```

**Tabs:**
1. **Departments**
   - List of departments
   - Add/Edit/Delete departments
   - Assign department heads
   - Configure categories per department

2. **Categories**
   - Manage ticket categories
   - Assign to departments
   - Set default priorities per category

3. **SLA Templates**
   - Create/edit SLA templates
   - Set due_delta by priority
   - Default SLAs per category

4. **Integrations**
   - SMS integration settings
   - API keys and endpoints
   - Sync configuration

5. **Notifications**
   - Email notification settings
   - Reminder intervals
   - Auto-close settings (default 3 days)

---

#### 4. Analytics (`/admin/analytics`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Page Header                             │
│ "System Analytics"                      │
│ [Date Range Picker] [Export Report]     │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Key Metrics Summary                     │
│ [KPI Cards Row]                         │
└─────────────────────────────────────────┘
┌──────────────┬──────────────┐
│ Ticket       │ Department   │
│ Volume Chart │ Performance  │
│ (Line)       │ (Bar)        │
└──────────────┴──────────────┘
┌──────────────┬──────────────┐
│ Resolution   │ Priority     │
│ Time Trends  │ Distribution │
│ (Line)       │ (Pie)        │
└──────────────┴──────────────┘
┌─────────────────────────────────────────┐
│ Detailed Reports                        │
│ [Exportable tables]                     │
└─────────────────────────────────────────┘
```

**Charts:**
- Ticket volume over time (line chart)
- Department workload comparison (bar chart)
- Resolution time trends (line chart)
- Priority distribution (pie/donut chart)
- Status distribution (stacked bar chart)
- SLA compliance rate (gauge chart)

**Reports:**
- Department performance report
- User activity report
- Ticket category analysis
- Time-to-resolution analysis

---

#### 5. Reports (`/admin/reports`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Page Header                             │
│ "Reports & Audit Logs"                  │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Report Generator                        │
│ Report Type: [Select]                   │
│ Date Range: [From] [To]                 │
│ Filters: [User] [Department] [Status]   │
│ Format: [CSV] [JSON] [PDF]              │
│ [Generate Report]                       │
└─────────────────────────────────────────┘
┌──────────────────────────