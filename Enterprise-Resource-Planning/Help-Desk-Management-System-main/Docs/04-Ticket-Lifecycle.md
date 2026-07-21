# Ticket Lifecycle

## **Ticket Lifecycle, Chat System, and Workflow Control**

---

### **1. Purpose**

This document outlines the **end-to-end lifecycle of tickets**, the **real-time chat mechanism**, and the **rules governing communication, escalation, and accountability** in the Help Desk Management System.

---

### **2. Ticket Status Definitions**

The system uses the following status values:

* **Draft** - Ticket is being created, not yet submitted
* **Submitted** - Ticket has been submitted by requestor
* **Pending** - Ticket is waiting for initial review
* **Under_Review** - Moderator is reviewing the ticket
* **Assigned** - Ticket has been assigned to a Department Head
* **In_Progress** - Department Head has started working on the ticket
* **Waiting_Approval** - Ticket requires approval (Finance/CEO)
* **Approved** - Approval granted
* **Rejected** - Ticket rejected (end of lifecycle, cannot be reopened)
* **Resolved** - requestor has confirmed resolution
* **Closed** - Ticket is fully closed
* **Reopened** - Ticket has been reopened (requires Moderator approval)
* **Postponed** - Ticket temporarily paused

---

### **3. Conditional Status Flows**

The ticket lifecycle follows different paths based on conditions. Below are the main flows:

#### **3.1 Standard Flow (No Approval Required)**

```
Draft → Submitted → Pending → Under_Review → Assigned → In_Progress → Resolved → Closed
```

**Conditions:**
* Ticket does not require financial or executive approval
* Standard departmental request

**Transitions:**
1. requestor creates ticket (Draft)
2. requestor submits (Submitted)
3. System moves to Pending
4. Moderator reviews (Under_Review)
5. Moderator assigns to Department Head (Assigned)
6. Department Head starts work (In_Progress)
7. Department Head marks Completed → System moves to Resolved
8. requestor confirms → Moderator verifies → Closed

---

#### **3.2 Approval Flow (Requires Finance/CEO Approval)**

```
Draft → Submitted → Pending → Under_Review → Assigned → In_Progress → Waiting_Approval → Approved/Rejected → Resolved → Closed
```

**Conditions:**
* Ticket requires financial approval (e.g., cheque, procurement)
* Only Finance Assignee can request approval
* CEO/Finance can Approve or Reject

**Transitions:**
1. Follows standard flow until In_Progress
2. Finance Assignee marks `requires_approval=true` → Waiting_Approval
3. CEO/Finance reviews and either:
   - **Approved** → Resolved → Closed
   - **Rejected** → End of lifecycle (cannot be reopened)

**Note:** If Rejected, ticket status = Rejected (final state, end of lifecycle)

---

#### **3.3 Rejection Flow (Moderator Rejects Before Assignment)**

```
Draft → Submitted → Pending → Under_Review → Rejected (END)
```

**Conditions:**
* Moderator determines ticket is invalid, duplicate, or out of scope
* Rejection happens before assignment

**Transitions:**
1. Ticket reaches Under_Review
2. Moderator rejects with reason (optional if system-detected duplicate)
3. Status = Rejected (end of lifecycle, cannot be reopened)

---

#### **3.4 Postponement Flow**

```
Any Status → Postponed → (Restart) → Previous Status
```

**Conditions:**
* Moderator or Assignee requests postponement
* Reason is **required** (mandatory field)
* Can happen from any active status

**Transitions:**
1. Moderator/Assignee requests postpone with reason
2. Status = Postponed
3. System sends reminders every 3 days until ticket closed or restarted
4. When restarted, ticket returns to previous status
5. **Reminders stop immediately** when ticket is restarted

**Reminder Behavior:**
* Every 3 days until ticket closed
* Stops immediately when ticket restarted
* Stops when ticket closed

---

#### **3.5 Reopen Flow**

```
Closed → Reopened → (Moderator assigns) → Assigned → In_Progress → ...
```

**Conditions:**
* requestor or Moderator requests reopen
* **Always requires Moderator approval**
* **Maximum 2 reopens** per ticket (hard limit)
* Creates new version (Ticket v2) while retaining same ID

**Transitions:**
1. Closed ticket → Reopen request
2. Moderator reviews and approves
3. Status = Reopened
4. Version increments (e.g., version=2)
5. Only last involved participants (Moderator, requestor, Assignee) rejoin automatically
6. Moderator can manually add/remove participants
7. Old messages archived (new chat starts from zero)
8. Ticket continues from Assigned or In_Progress status

**Reopen Limits:**
* Maximum 2 reopens per ticket
* System automatically blocks additional reopen requests after 2

---

### **4. Status Transition Rules**

| From Status | To Status | Who Can Perform | Conditions |
| ----- | ----- | ----- | ----- |
| Draft | Submitted | requestor | Before submission only (cannot edit after) |
| Submitted | Pending | System | Automatic |
| Pending | Under_Review | Moderator | - |
| Under_Review | Assigned | Moderator | Only Moderator can assign |
| Under_Review | Rejected | Moderator | End of lifecycle |
| Assigned | In_Progress | Department Head | - |
| In_Progress | Waiting_Approval | Finance Assignee | Only Finance can request approval |
| In_Progress | Completed | Department Head | - |
| Waiting_Approval | Approved | CEO/Finance | - |
| Waiting_Approval | Rejected | CEO/Finance | End of lifecycle |
| Approved | Resolved | System | Automatic after approval |
| Completed | Resolved | requestor | requestor confirms |
| Resolved | Closed | Moderator | After verification |
| Any Active | Postponed | Moderator | Reason required |
| Postponed | Previous Status | Moderator/Assignee | Restart |
| Closed | Reopened | Moderator | Requires approval, max 2 times |

---

### **5. Auto-Close Behavior**

**Timing:**
* 3 days after ticket reaches Resolved status (configurable, default 3 days)
* If requestor doesn't confirm within 3 days, system auto-closes

**Reminder:**
* Reminder sent **2 days before** auto-close (i.e., on day 1 if auto-close is day 3)
* Final reminder to requestor and Moderator

**Process:**
1. Assignee marks Completed
2. Ticket status = Resolved
3. requestor receives notification
4. If no response after 3 days → Auto-close
5. Moderator verifies automatically
6. Status = Closed

---

### **6. Draft Handling**

**Creation:**
* requestor can save drafts before submission
* Drafts are not visible to Moderator

**Expiration:**
* Drafts are **soft-deleted** (marked as `is_deleted=True`) after 7 days
* **Not hard deleted** - data retained in DB, hidden from UI
* Celery task runs daily to mark expired drafts as deleted

**Editing:**
* requestor can edit drafts **only before submission**
* Cannot edit after submission

---

### **7. Real-Time Chat System**

| Feature | Description |
| ----- | ----- |
| **Participants** | requestor, Moderator, Assignee(s), and Sub-ticket members. |
| **Visibility Rules** | Only linked users can view chat. Admin has read-only audit access. |
| **Technology** | Implemented using Django Channels WebSocket for instant updates. |
| **Moderator Controls** | Can add/remove users, create sub-tickets directly from chat. |
| **Sub-ticket Handling** | When a new sub-ticket is created, its users auto-join the parent ticket chat. |
| **Chat Visibility** | New participants see messages **after their join timestamp only**. Admin and Moderator can see **full chat history**. |
| **Audit Logs** | Every join, leave, or message event is stored for accountability. |
| **Attachments** | Support for document/image uploads. |
| **Notifications** | Real-time alerts for new messages, mentions, or Moderator actions. |

---

### **8. Postponement & Reminder Workflow**

* The moderator can postpone tickets with a **required reason** (mandatory field).

* Every postponed ticket triggers automatic reminders **every 3 days**.

* Reminders continue until:
  * Ticket is closed, OR
  * Ticket is restarted (reminders stop immediately)

* Moderator receives escalation notification if unresolved after multiple reminders.

* Tickets can be **restarted** or **reprioritized** at any time.

---

### **9. Ticket Priority Model**

| Priority Level | Response Expectation | Example Use Case |
| ----- | ----- | ----- |
| **High** | 24 hours | System outage, procurement delays |
| **Medium** | 3 days | Routine maintenance, IT support |
| **Low** | 5–7 days | General admin requests |

---

### **10. Closure & Quality Verification**

* **Assignee → Marks Completed**

* **requestor → Confirms Resolution** (or auto-close after 3 days)

* **Moderator → Finalizes & Closes Ticket**  
   Each closed ticket contributes to satisfaction analytics and performance dashboards.

---

### **11. Accountability & Conflict Prevention**

* **Moderator ≠ Admin:** Workflow vs configuration separation.

* **Assignee closes, Moderator verifies:** prevents self-approval bias.

* **requestor confirmation mandatory:** ensures satisfaction-based closure.

* **All actions logged:** guarantees transparency and traceability.

* **Soft Delete Policy:** All deletions are soft deletes (marked as deleted, hidden from UI, retained in DB).

---

### **12. Undo Capability**

* Moderator can undo actions (reject, assign, postpone) within **15 minutes** of performing the action.

* System fully restores previous state (status, priority, assignee, participants, SLA, chat connections).

* Audit log shows both events: original action and undo action.

---

### **13. Parent-Child Ticket Closure**

* When **all sub-tickets are closed**, parent ticket automatically becomes "Ready for Closure."

* Moderator can **manually force-close parent** before all children are done.

* If parent closed manually → **all child tickets force-closed simultaneously**.

* Parent ticket progress = (closed sub-tickets / total sub-tickets).

---

### **14. Status Flow Diagrams**

#### **Standard Flow Diagram**

```
stateDiagram-v2
    [*] --> Draft
    Draft --> Submitted : requestor submits
    Submitted --> Pending : System
    Pending --> Under_Review : Moderator reviews
    Under_Review --> Assigned : Moderator assigns
    Assigned --> In_Progress : Department Head starts
    In_Progress --> Completed : Department Head marks done
    Completed --> Resolved : requestor confirms (or auto after 3 days)
    Resolved --> Closed : Moderator verifies
    Closed --> Reopened : Reopen request (max 2x, requires Moderator approval)
    Reopened --> Assigned : Moderator reassigns
```

#### **Approval Flow Diagram**

```
stateDiagram-v2
    [*] --> Draft
    Draft --> Submitted
    Submitted --> Pending
    Pending --> Under_Review
    Under_Review --> Assigned
    Assigned --> In_Progress
    In_Progress --> Waiting_Approval : Finance requests approval
    Waiting_Approval --> Approved : CEO/Finance approves
    Waiting_Approval --> Rejected : CEO/Finance rejects (END)
    Approved --> Resolved
    Resolved --> Closed
```

#### **Postponement Flow Diagram**

```
stateDiagram-v2
    [*] --> Any_Active_Status
    Any_Active_Status --> Postponed : Moderator/Assignee with reason
    Postponed --> Previous_Status : Restart
    Postponed --> Closed : If closed while postponed
```

---

### **15. State Machine Implementation (django-fsm)**

**Library:** `django-fsm` (Django Finite State Machine)

**Purpose:**
* Enforce valid status transitions at model level
* Prevent invalid state changes
* Track state history
* Validate transitions based on business rules

**Implementation:**
* Ticket model uses `FSMField` for status field
* Transition methods decorated with `@transition` decorator
* State machine validates transitions before allowing changes
* Invalid transitions raise exceptions (caught and returned as 422 errors)

**Benefits:**
* Type-safe status transitions
* Business rule enforcement at model level
* Clear state transition documentation
* Prevents invalid status changes programmatically

**Example Implementation:**
```python
from django_fsm import FSMField, transition

class Ticket(models.Model):
    status = FSMField(default='draft')
    version = models.IntegerField(default=1)  # For optimistic locking
    
    @transition(field=status, source='draft', target='submitted')
    def submit(self):
        # Business logic here
        self.version += 1
        pass
```

**Version Field for Optimistic Locking:**
* All ticket models include `version` field (IntegerField)
* Version auto-incremented on each save
* Client must send current version with update requests
* Server validates version matches before allowing status transition
* If version mismatch → 409 Conflict error
* Prevents concurrent update conflicts

---

### **16. Transaction Boundaries for Status Transitions**

**Critical Operations (Always Use Transactions):**
* Status transitions (wrapped in `@transaction.atomic`)
* Sub-ticket creation (parent-child relationships)
* Approval workflows (multiple model updates)
* Reassignment (removing old, adding new assignee)

**Implementation:**
```python
from django.db import transaction

@transaction.atomic
def transition_ticket_status(ticket_id, new_status, version):
    ticket = Ticket.objects.select_for_update().get(id=ticket_id)
    if ticket.version != version:
        raise ConflictError("Version mismatch")
    ticket.status = new_status
    ticket.version += 1
    ticket.save()
    # Additional operations...
```

**Rollback Handling:**
* Exceptions trigger automatic rollback
* Error messages returned to client
* Audit logs record failed attempts
* No partial updates on failure

---

### **17. Key Business Rules Summary**

1. **Reopen Limit:** Maximum 2 times (hard limit, not configurable)

2. **Auto-Close:** 3 days with configurable option (default 3 days), reminder sent 2 days before

3. **Draft Expiration:** Soft-deleted after 7 days (not hard deleted)

4. **requestor Edit:** Can only edit before submission (cannot edit after)

5. **Rejected Status:** End of lifecycle (cannot be reopened, final state)

6. **Postponement Reason:** Required (mandatory field)

7. **Undo Limit:** 15 minutes time window

8. **Reopen Permission:** Always requires Moderator approval

9. **Finance Approval:** Only Finance Assignee can request approval

10. **Soft Delete:** All deletions are soft deletes (marked as deleted, hidden from UI, retained in DB)

11. **Parent Closure:** Moderator can force-close parent and all children simultaneously

12. **Chat Visibility:** New participants see messages after join timestamp; Admin/Moderator see full history

13. **State Machine:** django-fsm enforces valid status transitions

14. **Optimistic Locking:** Version field prevents concurrent update conflicts

15. **Transactions:** All status transitions wrapped in atomic transactions




