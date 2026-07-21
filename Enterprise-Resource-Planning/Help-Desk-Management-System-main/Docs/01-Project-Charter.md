# Project Charter

## **Help Desk Management System — Project Charter**

### **1. System Overview**

The **Help Desk Management System** for **Idara Al-Khair** facilitates internal request management across multiple departments.  
 It enables structured ticket handling, centralized user management (integrated with the SMS system), and transparent progress tracking with analytics and departmental accountability.

The system supports **role-based access control** and promotes efficient request resolution through clear ticket lifecycles and moderation workflows.  
 Phase 1 will launch for **seven pilot departments**:

* Development

* Finance & Accounts

* Procurement

* Basic Maintenance

* IT

* Architecture

* Administration

---

### **2. Project Goal**

"To establish a centralized, role-based internal Helpdesk System integrated with Idara's SMS platform, allowing selected employees to manage departmental requests, track progress, and improve inter-departmental coordination."

---

### **3. Project Scope**

**Inclusions (Phase 1 / MVP):**

* Integration with SMS user authentication (Employee Code + Password).

* Internal access for employees, moderators, admins, and department heads.

* Real-time ticket chat, ticket lifecycle management, and analytics.

**Exclusions (Phase 1):**

* No external/public access.

* No integration with external vendors or third-party tools yet.

---

### **4. Success Criteria**

* 100% of the seven pilot departments onboarded successfully.

* All tickets routed through the Moderator workflow.

* Ticket closure verification functional and auditable.

* Minimum **50% of authorized employees** logging in and submitting/approving requests within the first month.

---

### **5. Stakeholders Overview**

| Role | Description | Key Authority |
| ----- | ----- | ----- |
| **Project Sponsor / CEO** | Strategic oversight and high-level approval. | Final approver for high-value tickets. |
| **Project Manager** | Oversees development and rollout phases. | Coordinates between developers, admin, and sponsor. |
| **Helpdesk Admin** | Manages system, roles, and access control. | Full configuration and monitoring rights. |
| **Moderator (Helpdesk Officer)** | Operational workflow manager. | Controls ticket flow, approvals, and quality checks. |
| **Assignees (Department Heads)** | Department-level executors of tasks. | Manage progress, team updates, and completion. |
| **requestors (Principals / Heads / Employees)** | Initiators and collaborators. | Raise tickets and confirm resolution. |

---

### **6. Resources**

**Human Resources:**

* 2 developers (1 senior PM/dev, 1 junior full-stack developer)

**Technology Stack:**

* **Frontend:** Next.js 15 + Tailwind CSS + TypeScript

* **Backend:** Django 5 + Django Ninja

* **Database:** PostgreSQL

* **Authentication:** Centralized SMS user table

* **DevOps:** Cursor AI-assisted environment with GitHub + Vercel/Railway for staging

**Timeline:**

* MVP Launch: 1 Month

---

## **PROJECT GOALS — *Help Desk Management System (HDMS) for Idara Al-Khair***

###  **Primary Objective**

To develop an **internal help desk management system** that centralizes all organizational requests, automates approval hierarchies, and enables transparent tracking across departments — eliminating the reliance on informal communication channels such as WhatsApp and improving overall operational efficiency.

---

###  **Key Goals**

1. **Streamline Approval Workflow:**  
    Replace the current manual approval process (e.g., cheque or procurement requests sent directly to the CEO) with an automated, hierarchical ticket system that routes requests through relevant departments and approvers.

2. **Enable End-to-End Ticket Management:**  
    Allow staff from all departments (Media, Design, Marketing, Accounts, HR, IT, Admin, etc.) to **submit, track, and resolve** requests efficiently through categorized tickets.

3. **Introduce Linked/Sub-Tickets Functionality:**  
    Support **interconnected tickets**, where a primary ticket (e.g., IT request) can trigger **sub-tickets** (e.g., Accounts approval, Procurement action), enabling multi-department collaboration within a single workflow. **Note:** Only Moderator can create sub-tickets; Assignees can request them via chat.

4. **Centralize Communication:**  
    Build an in-system **comment and discussion section** to connect all involved stakeholders (from requestor to approver to CEO) within the same ticket — ensuring transparency and accountability.

5. **Implement Analytics & Insights:**  
    Provide an **analytics dashboard** showing:

   * Department-wise ticket volumes and resolution rates

   * Bottlenecks and delays

   * Staff performance metrics

   * requestor satisfaction scores

6. **Establish a Foundation for AI Automation:**  
    Lay the groundwork for future integrations like:

   * AI-based ticket categorization

   * SLA tracking

   * Automated escalation

   * Voice-based ticket submission

   * AI orchestrator for smart workflow suggestions

**7. Centralized Employee Access Integration:**

Integrate the Help Desk Management System (HDMS) with the existing School Management System (SMS) to ensure a unified employee database. This will allow authorized users (e.g., teachers, coordinators, principals) to access the help desk using their existing employee credentials, ensuring consistency and reducing duplicate data management.

8. To create a unified, real-time collaborative Help Desk platform for internal communication, enabling connected departmental users to resolve issues efficiently without external tools like WhatsApp.

---

### **🕐 Short-Term (1-Month MVP) Focus**

* Build the **core ticketing system** with multi-department workflows

* Enable **basic approval hierarchy** and **commenting**

* Deploy an **admin dashboard** for the CEO and department heads to view real-time updates

* Ensure the system is stable and ready for internal rollout

---

##  **PROJECT SCOPE — *Help Desk Management System (HDMS) MVP (1-Month Phase)***

###  **In Scope (MVP Phase)**

The MVP will focus on designing, developing, and deploying the **core internal ticketing system** for the following departments:

* **Development**

* **Finance & Accounts**

* **Procurement**

* **Basic Maintenance**

* **IT**

* **Architecture**

* **Administration**

Each department will be able to:

1. **Submit new requests/tickets** related to their operations.

2. **Assign and escalate** tickets within the organizational hierarchy.

3. **Collaborate** through an internal **comment/chat system** within each ticket.

4. **Request sub-tickets via Moderator** for cross-department dependencies (e.g., IT → Accounts → CEO approval). **Note:** Only Moderator can create sub-tickets; Assignees can request them.

5. **Track ticket progress** using real-time status updates (Draft → Submitted → Pending → Under_Review → Assigned → In_Progress → Waiting_Approval → Approved/Rejected → Resolved → Closed).

6. **Generate summaries or reports** viewable by department heads and the CEO.

---

### **🧩 System Features Included in MVP**

| Feature | Description |
| ----- | ----- |
| **Role-based Authentication** | Secure login for staff, department heads, and the CEO. |
| **Ticket Creation & Categorization** | Each department can log requests with category, urgency, and attachments. |
| **Sub-Ticket Linking** | Moderator creates sub-tickets; Departments can request via Assignee. |
| **Approval Workflow** | Department heads and CEO can approve/reject with comments. |
| **Comments & Mentions** | Collaborative ticket discussions replacing WhatsApp threads. |
| **Basic Dashboard** | CEO and department heads can view ticket counts, pending approvals, and progress summaries. |
| **Notifications** | Real-time email or system alerts for ticket updates. |
| **Department Analytics (Basic)** | Ticket volume, average resolution time, and status distribution. |

| Centralized Employee Authentication | Integration with SMS database for shared employee profiles (Employee Code + Password). |
| :---- | :---- |

| Role Authorization Control | Helpdesk Admin can grant or revoke HDMS access to selected SMS employees. |
| :---- | :---- |

| Unified User Data Model | Shared employee data (name, department, designation, contact) synced from SMS to HDMS. |
| :---- | :---- |

Include real-time chat (WebSocket/Socket.IO) between connected users.

Include load-based ticket assignment visibility for Moderators.

Include ticket postponing, restarting, and SLA reminder automation.

Include dynamic sub-ticket creation and participant management (Moderator-controlled).

---

### **🚫 Out of Scope (for MVP, but Planned Later)**

These will be part of **Phase 2** or later versions:

* AI-powered ticket classification and priority tagging

* SLA tracking and automated escalation

* Voice-based ticket interaction

* requestor satisfaction surveys

* Organization-wide analytics dashboard

* Mobile application version

---

### **⚙️ Technical Scope**

* **Frontend:** Next.js 15 (with Tailwind CSS for UI speed and consistency)

* **Backend:** Django 5 + Django Ninja

* **Database:** PostgreSQL (for relational workflows and reporting)

* **Deployment:** Internal server or cloud (to be confirmed)

* **Collaboration:** GitHub + Cursor AI for pair-building and version control

---

## **PROJECT SUCCESS CRITERIA — *Help Desk Management System (HDMS) MVP***

### **Purpose**

The success of the HDMS MVP will be evaluated based on **how effectively it reduces manual workload**, **improves communication flow**, and **establishes measurable visibility** across departments — replacing unstructured processes (like WhatsApp approvals) with a transparent, data-driven workflow.

---

 **1. Functional Success Criteria**

| \# | Criteria | Measurement Indicator | Target |
| ----- | ----- | ----- | ----- |
| 1 | **Centralized Employee Access Working** | Users from SMS can log in using their employee code and password | 100% of authorized employees can log in successfully |
| 2 | **Ticket Lifecycle Functionality** | Ability to create, assign, and close tickets within departments | 95% of tested workflows operate without errors |
| 3 | **Cross-Department Linking (Sub-Tickets)** | Parent-subticket logic works between departments (e.g., IT → Accounts → CEO) | Successfully tested in all pilot departments |
| 4 | **Approval Workflow Automation** | CEO and Dept Heads can approve/reject within the system | Manual WhatsApp approvals reduced by at least **70%** |
| 5 | **Real-Time Updates & Notifications** | Comments, status changes, and approvals trigger immediate system alerts | Notifications appear <3 seconds after the event |
| 6 | **Dashboard Visibility** | Department heads and the CEO can view ticket counts and statuses | Real-time summary visible in the dashboard |
| 7 | **Data Sync with SMS** | Employee data and department roles sync properly | 100% sync accuracy during integration test |

* 100% of tickets processed through the real-time chat system (no external communication required).

* SLA reminder automation tested successfully (3-day loop).

* Department workload balancing is successfully reflected in the assignment dashboard.

* Chat activity logs are fully functional and auditable.

---

###  **2. Performance & Usability Criteria**

| \# | Criteria | Measurement Indicator | Target |
| ----- | ----- | ----- | ----- |
| 1 | **System Load Speed** | Dashboard/ticket load time | < 2 seconds per page |
| 2 | **Error Rate** | Bugs reported post-deployment | < 3 major issues after 1 week of usage |
| 3 | **User Adoption Rate** | Percentage of target departments using HDMS after launch | 80% adoption within the first 2 weeks |
| 4 | **Support Requests Decline** | Reduction in repeated "status check" queries to the CEO/Admin | 60% fewer manual follow-ups within the first month |
| 5 | **Uptime Reliability** | System stability during office hours | 99% uptime during the testing phase |

---

###  **3. Organizational & Strategic Criteria**

| \# | Criteria | Measurement Indicator | Target |
| ----- | ----- | ----- | ----- |
| 1 | **CEO Satisfaction** | The CEO approves the system as reliable for request management | Verbal/feedback approval post-MVP demo |
| 2 | **Department Engagement** | Active ticket usage per department | At least 5 tickets per department during testing |
| 3 | **Visibility Improvement** | Departments can track request progress | 100% of departments confirm visibility through the dashboard |
| 4 | **Future Scalability Readiness** | Backend structure allows for AI & analytics modules | Architecture reviewed and validated by the technical lead |

---

###  **4. MVP Evaluation Checklist (at Project Close)**

At the end of the 1-month sprint, success will be declared if:

* The integrated login via SMS works flawlessly

* Each pilot department can raise and resolve tickets independently

* The CEO can approve requests from within the platform

* The system replaces at least 60–70% of WhatsApp-based approval traffic

* Core metrics (speed, uptime, and adoption) meet targets

---

## **PROJECT DELIVERABLES — *Help Desk Management System (MVP)***

The deliverables represent the tangible system components to be developed, tested, and deployed during the 1-month MVP phase.

### **System Deliverables**

| Category | Deliverable | Description |
| ----- | ----- | ----- |
| **1. Authentication Module** | Centralized Employee Login | Integration with the existing SMS system for shared employee credentials. |
|  | Role & Access Control | HDMS Admin can authorize SMS employees for access to the help desk. |
| **2. Ticketing System** | Ticket Creation & Tracking | Department-wise request creation with status updates. |
|  | Linked/Sub-Tickets | Support multi-department workflows under a single parent ticket. (Moderator-controlled creation) |
|  | Commenting System | Discussion area for all users involved in a ticket. |
|  | File Attachments | Upload supporting documents or proofs with tickets. |
| **3. Workflow Automation** | Approval Hierarchy | Configurable approval routes (Department Head → CEO → Accounts). |
|  | Ticket States & Transitions | Defined states: *Draft, Submitted, Pending, Under_Review, Assigned, In_Progress, Waiting_Approval, Approved/Rejected, Resolved, Closed*. |
| **4. Dashboard & Analytics** | Department Dashboard | Each department sees its open, pending, and resolved tickets. |
|  | CEO/Management Dashboard | Organization-level ticket overview and insights. |
| **5. Notification System** | Real-Time Alerts | Notify users on ticket updates, approvals, or assignments. |
| **6. Integration Layer** | SMS Integration API | Synchronize employee and department data between SMS and HDMS. |
|  | Centralized User Directory | Unified storage for employees across systems. |
| **7. Deployment Setup** | Cloud or Internal Deployment | Stable version hosted for Idara Al-Khair's internal use. |
| **8. Documentation (Basic)** | API & Module Documentation | Technical documentation for internal maintenance. |

---

### **Expected MVP Output**

At the end of 1 month, Idara Al-Khair will have a **fully functional internal Help Desk Management System (HDMS)** capable of:

* Handling multi-department requests

* Managing interlinked ticket workflows

* Operating with shared employee data from SMS

* Providing a management dashboard for real-time operational insight




