# Stakeholders & Roles

## **Help Desk Management System — Stakeholders & Roles**

### **1. Purpose of This Document**

This document defines all **stakeholders, their roles, authorities, and responsibilities** within the **Help Desk Management System (HDMS)**.  
 It ensures clarity in decision-making, communication flow, and operational accountability during both development and implementation phases.

---

### **2. Stakeholder Groups Overview**

| Group | Type | Function |
| ----- | ----- | ----- |
| **Project Sponsor / CEO** | Executive | Strategic oversight and top-level ticket approval. |
| **Project Manager** | Management | Oversees project planning, sprint management, and stakeholder coordination. |
| **Helpdesk Administrator (Admin)** | Technical | System-level user and configuration management. |
| **Moderator (Helpdesk Officer)** | Operational | Workflow management, ticket validation, and progress control. |
| **Assignees (Department Heads / Leads)** | Operational | Departmental execution of assigned tasks. |
| **requestors (Principals / Staff)** | Functional | Initiate and track service requests. |

---

### **3. Detailed Role Definitions**

---

## **🧍‍♂️ requestor**

*(Principals, Department Heads, or Authorized Staff Members)*

#### **Purpose:**

Initiate, collaborate, and finalize internal service or maintenance requests within their department or across departments.

#### **Core Responsibilities:**

* Create and submit new tickets for departmental issues or needs.

* Edit or cancel drafts **before final submission only** (cannot edit after submission).

* Attach relevant documents, images, or forms.

* Monitor ticket status through dashboards or email notifications.

* Mark requests as *resolved* once satisfied with the outcome.

* Provide closure feedback for quality and satisfaction tracking.

#### **Enhanced Collaboration Features:**

* Participate in **real-time ticket chat** with connected users (Moderator, Assignee, and Sub-ticket participants).

* Request the Moderator (via chat) to:

  * Add other departments if the issue spans multiple areas.

  * **Note:** requestor cannot request sub-tickets directly. Only Assignee can request sub-tickets via chat.

* Stay informed through notifications about:

  * Priority or time changes.

  * Ticket postponement or restarts.

  * Moderator or Assignee comments.

#### **Access & Visibility:**

* Can view and track **only self-created or linked tickets**.

* Access to limited **personal analytics**, such as resolution time and number of requests.

#### **Key Value:**

Makes the requestor an *active participant* in the lifecycle rather than a passive initiator — improving engagement and faster resolutions.

---

## **🧭 Moderator**

*(Helpdesk Officer or Core System Operator)*

#### **Purpose:**

Serve as the **workflow controller**, ensuring all tickets are valid, properly categorized, and routed to the right department efficiently.

#### **Core Responsibilities:**

* Review and validate all incoming tickets.

* Correct ticket categories, priority levels, and department mappings if necessary.

* Approve, reject, or return tickets for clarification.

* **Rejected tickets** mark the end of lifecycle (cannot be reopened).

* Assign tickets to the appropriate department (Assignee).

* **ONLY Moderator can create sub-tickets** while maintaining parent-child relationships.

* Monitor ticket aging and remind departments about pending work.

* Verify closure and ensure resolution quality before final approval.

#### **Enhanced Capabilities:**

* **Load-based assignment:** View department workloads and employee availability before assigning new tasks.

* **Dynamic control:** Adjust priority levels or custom SLAs (ticket completion times) based on urgency or staff availability.

* **Ticket postponement:** Temporarily pause a ticket with a **required reason**; system sends auto-reminders every 3 days for follow-up until ticket is closed or restarted.

* **Real-time moderation:**

  * Add or remove chat participants as needed.

  * Merge sub-tickets back into the parent for final resolution.

  * Track dependencies between departments.

* **Undo capability:** Can undo actions (reject, assign, postpone) within **15 minutes** of performing the action.

* **Communication:** Maintain open dialogue with both requestors and Assignees to resolve delays or missing details.

#### **Access & Visibility:**

* Full visibility of all tickets across departments.

* Can see **full chat history** for all tickets (unlike new participants who only see messages after their join time).

* Cannot alter system configuration or user permissions (Admin-only domain).

#### **Key Value:**

Acts as a **traffic controller and quality gatekeeper**, ensuring fairness, accountability, and balanced workloads across the organization.

---

## **🧩 Assignee**

*(Department Head or Authorized Team Lead)*

#### **Purpose:**

Execute and oversee ticket resolution for their respective department.

#### **Core Responsibilities:**

* View and manage tickets assigned to their department.

* **Assign internal team members/employees** to tickets for acknowledgment and tracking. **Note:** Team members are system users assigned to departments by Admin. All ticket updates must be done by Department Head only (employees don't update tickets).

* Communicate updates and status changes (In Progress → Completed).

* Provide completion notes or attach proofs of work (documents, receipts, reports).

* Notify the Moderator of dependencies or resource issues.

* Close their departmental tasks upon completion.

* **Create internal task breakdown** for employees (separate from system sub-tickets - this is for department-level task management).

#### **Enhanced Capabilities:**

* Participate in **real-time chat** with Moderator and requestor.

* **Request Moderator to create linked sub-tickets** for other departments if the task extends beyond their scope. **Note:** Assignee cannot create sub-tickets directly; must request via chat with `request_subticket` flag.

* Monitor **departmental metrics** (active tickets, pending count, completion rate).

* Escalate issues internally for faster turnaround.

#### **Access & Visibility:**

* Limited to tickets of their own department.

* Cannot modify or access cross-department data.

#### **Key Value:**

Empowers department heads with visibility and coordination tools while maintaining accountability for departmental performance.

---

## **⚙️ Admin**

*(Helpdesk Administrator / Super Admin)*

#### **Purpose:**

Govern overall system structure, access control, and configuration management.

#### **Core Responsibilities:**

* Create, modify, or remove user accounts via integration with SMS.

* **Assign employees to departments** under their respective department heads.

* Assign appropriate roles (requestor, Moderator, Assignee).

* Configure departments, categories, SLA durations, and notifications.

* Manage ticket categories and departmental mapping.

* Reassign or deactivate users when necessary.

* **All deletions are soft deletes** (marked as deleted, hidden from UI, retained in DB).

* Maintain logs and ensure data compliance.

#### **Enhanced Capabilities:**

* Audit all chat threads (read-only).

* **Can see full chat history** for all tickets (like Moderator).

* Manage system-level reminders and SLA policy.

* Supervise Moderator actions (add/remove users, postponement patterns).

* Generate reports for top management and analyze ticket patterns.

* Maintain integration with SMS employee records.

#### **Access & Visibility:**

* Full system-wide access with configuration privileges.

* Does not participate in ticket workflow unless intervention is required.

#### **Key Value:**

Maintains overall stability and integrity of the Help Desk ecosystem, ensuring consistent policy enforcement.

---

## **🧑‍💼 Project Manager**

*(Technical + Managerial Role)*

#### **Purpose:**

Oversee the entire project's progress — from design, sprint planning, and development to adoption monitoring and post-launch feedback.

#### **Core Responsibilities:**

* Manage timeline, sprint priorities, and team workload.

* Supervise both backend and frontend development.

* Ensure all MVP features meet functional and adoption success criteria.

* Coordinate between the Admin, Developers, and CEO for final sign-offs.

* Monitor system usage analytics and report adoption metrics.

#### **Access & Visibility:**

* Management dashboard and analytics only.

* No operational interaction with the helpdesk ticket system.

---

## **🏢 Project Sponsor / CEO**

#### **Purpose:**

Provide executive oversight and approve major, cross-departmental, or financial tickets.

#### **Core Responsibilities:**

* Approve or monitor high-level tickets linked to finance, procurement, or strategic decisions.

* Review organizational efficiency reports generated by Admin.

* Define escalation and approval policies for departments.

* Set performance standards for resolution timelines.

#### **Access & Visibility:**

* Dashboard access for strategic summaries and analytics.

* Direct interaction only with high-priority tickets assigned to or escalated by the Moderator.

---

## **🔑 Role Boundaries Summary**

| Role | System Access | Operational Authority | Configuration Rights |
| ----- | ----- | ----- | ----- |
| requestor | Own Tickets Only | Create & Resolve | ❌ |
| Moderator | All Tickets | Manage Workflows | ❌ |
| Assignee | Department Tickets | Execute Tasks | ❌ |
| Admin | All System Data | Supervise & Configure | ✅ |
| Project Manager | Analytics Only | Monitor & Coordinate | ❌ |
| CEO | High-Level Reports | Strategic Oversight | ❌ |

---

## **Key Business Rules Summary**

### **Sub-Ticket Creation:**
* **ONLY Moderator** can create sub-tickets
* **Assignee** can request sub-tickets via chat with `request_subticket` flag
* **requestor** cannot request sub-tickets

### **Ticket Editing:**
* **requestor** can only edit tickets **before submission** (cannot edit after submission)

### **Team Members/Employees:**
* System users assigned to departments by **Admin**
* Department Head assigns them to tickets for acknowledgment/tracking
* **All ticket updates must be done by Department Head only** (employees don't update tickets)
* Department Head can create **internal task breakdown** for employees (separate from system sub-tickets)

### **Deletions:**
* **All deletions are soft deletes** (marked as deleted, hidden from UI, retained in DB)
* Applies to drafts, tickets, and all entities

### **Rejected Status:**
* **Rejected tickets** mark the end of lifecycle (cannot be reopened, final state)

### **Postponement:**
* **Reason is required** (mandatory field)
* Reminders sent every 3 days until ticket closed
* Reminders stop immediately when ticket is restarted

### **Undo:**
* Moderator can undo actions within **15 minutes** of performing the action

### **Chat Visibility:**
* New participants see messages **after their join timestamp only**
* **Admin and Moderator** can see full chat history

### **Auto-Close:**
* 3 days with configurable option (default 3 days)
* Reminder sent **2 days before** auto-close (i.e., on day 1 if auto-close is day 3)

### **Reopen:**
* Limit: **2 times maximum**
* Always requires **Moderator approval**




