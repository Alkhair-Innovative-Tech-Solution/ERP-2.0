# HDMS Sprint Tasks - Phase 1 Completion

**Created:** December 17, 2025  
**Sprint Goal:** Complete core HDMS MVP with polished UI and real-time features

---

## 🎯 Sprint Objectives

1. **Chat UI/UX** - Make chat user-friendly and responsive across all roles
2. **WebSocket** - Implement real-time chat and notifications
3. **File Service** - Route all attachments through file-service
4. **UI Polish** - Fix bugs and improve overall experience

---

## 📋 Task Breakdown

### Epic 1: Chat UI/UX Improvements

#### Task 1.1: Unified Chat Component
**Priority:** 🔴 HIGH  
**Estimated Time:** 4-6 hours

**Current State:**
- Different ticket detail pages show chat in different positions (right panel vs bottom)
- Inconsistent chat styling across roles
- Not fully responsive

**What to do:**
- [x] Create a unified `TicketChat` component in `frontend-service/src/components/tickets/`
- [x] Support both "side panel" (desktop) and "bottom section" (mobile) layouts
- [x] Consistent styling regardless of which role is viewing
- [x] Props: `ticketId`, `layout?: 'side' | 'bottom' | 'auto'`
- [x] Message input with send button
- [x] Message list with sender info, timestamp
- [x] Auto-scroll to latest message
- [x] Mobile-responsive design

**Files to modify:**
- `frontend-service/src/components/tickets/TicketChat.tsx` (Completed as `UnifiedChatPanel.tsx`)
- All role-specific ticket detail pages to use unified component

---

#### Task 1.2: Chat Message UI
**Priority:** 🔴 HIGH  
**Estimated Time:** 2-3 hours

**What to do:**
- [x] Design attractive message bubbles
- [x] Differentiate sent vs received messages
- [x] Show sender name, avatar/initials, timestamp
- [x] Support message grouping (same sender, close timestamps)
- [x] Handle long messages gracefully
- [x] Loading state while fetching messages

**Files to create/modify:**
- `frontend-service/src/components/tickets/ChatMessage.tsx` (Completed)
- `frontend-service/src/components/tickets/ChatMessageList.tsx` (Completed)

---

#### Task 1.3: Chat Input Component
**Priority:** 🔴 HIGH  
**Estimated Time:** 2 hours

**What to do:**
- [x] Text input with placeholder
- [x] Send button (enabled only when message is not empty)
- [x] Keyboard shortcut: Enter to send, Shift+Enter for newline
- [x] Auto-resize textarea for multi-line messages
- [x] Disabled state while sending
- [x] Attachment button (connect to file-service later)

**Files to create:**
- `frontend-service/src/components/tickets/ChatInput.tsx` (NEW)

---

#### Task 1.4: Integrate Chat in All Role Views
**Priority:** 🔴 HIGH  
**Estimated Time:** 3-4 hours

**What to do:**
- [x] Update Requestor ticket detail to use unified chat
- [x] Update Moderator ticket detail to use unified chat
- [x] Update Assignee ticket detail to use unified chat
- [x] Update Admin ticket detail to use unified chat
- [x] Ensure consistent layout and positioning

**Files to modify:**
- `frontend-service/src/app/(role)/[role]/tickets/[id]/page.tsx`
- Role-specific ticket detail pages

---

### Epic 2: WebSocket Implementation

#### Task 2.1: Django Channels Setup
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 2-3 hours

**What to do:**
- [x] Verify Django Channels is installed in communication-service
- [x] Configure ASGI application
- [x] Set up Redis channel layer
- [x] Create routing configuration

**Files to modify:**
- `communication-service/src/core/asgi.py`
- `communication-service/src/core/settings.py`
- `communication-service/src/apps/chat/routing.py`

---

#### Task 2.2: Chat WebSocket Consumer
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 4-5 hours

**What to do:**
- [x] Create `ChatConsumer` for WebSocket connections
- [x] Handle connection authentication (JWT validation)
- [x] Join ticket chat room on connect
- [x] Receive messages and broadcast to room
- [x] Handle disconnection gracefully
- [x] Store messages in database

**Files to create/modify:**
- `communication-service/src/apps/chat/consumers.py`
- `communication-service/src/apps/chat/routing.py`

---

#### Task 2.3: Frontend WebSocket Client
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 3-4 hours

**What to do:**
- [x] Create WebSocket client service
- [x] Connect to chat WebSocket on ticket detail page
- [x] Send messages via WebSocket
- [x] Receive messages and update UI in real-time
- [x] Reconnection logic on disconnect
- [x] Handle connection errors

**Files to create:**
- `frontend-service/src/services/socket/chatSocket.ts`
- Update `TicketChat.tsx` to use WebSocket

---

#### Task 2.4: Notification WebSocket (Optional in this sprint)
**Priority:** 🟢 LOW  
**Estimated Time:** 3-4 hours

**What to do:**
- [ ] Create `NotificationConsumer`
- [ ] Push notifications on ticket updates
- [ ] Frontend notification popup/toast
- [ ] Update notification count in header

---

### Epic 3: File Service Integration

#### Task 3.1: File Upload API
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 2-3 hours

**What to do:**
- [x] Verify file-service upload endpoint works
- [x] Create frontend API client for file-service
- [x] Handle multipart/form-data uploads
- [x] Return file key/URL after upload

**Files to modify:**
- `frontend-service/src/services/api/fileService.ts` (NEW)
- `file-service/src/apps/files/api.py`

---

#### Task 3.2: Remove Attachments from Ticket Service
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 2 hours

**What to do:**
- [x] Remove file upload code from ticket-service
- [x] Store only file_key (UUID) references in tickets
- [x] Update ticket schemas to use file_key instead of file path

**Files to modify:**
- `ticket-service/src/apps/tickets/api.py`
- `ticket-service/src/apps/tickets/schemas.py`

---

#### Task 3.3: Chat Attachment Support
**Priority:** 🟢 LOW  
**Estimated Time:** 2-3 hours

**What to do:**
- [x] Add attachment button to chat input
- [x] Upload attachment via file-service
- [x] Display attachment in chat message
- [x] Download attachment from file-service

---

### Epic 4: UI Polish

#### Task 4.1: Fix Known UI Bugs
**Priority:** 🔴 HIGH  
**Estimated Time:** 2-4 hours (depends on bug list)

**What to do:**
- [ ] Identify and list all known UI bugs
- [ ] Fix each bug systematically
- [ ] Test fixes across roles

---

#### Task 4.2: Loading States
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 2 hours

**What to do:**
- [ ] Add loading skeletons for ticket lists
- [ ] Add loading states for ticket detail
- [ ] Add loading indicator for chat messages
- [ ] Add button loading states

---

#### Task 4.3: Error Handling
**Priority:** 🟡 MEDIUM  
**Estimated Time:** 2 hours

**What to do:**
- [ ] Add error boundaries
- [ ] User-friendly error messages
- [ ] Retry buttons for failed requests
- [ ] Toast notifications for actions

---

## 📆 Suggested Sprint Order

**Day 1-2:** Epic 1 (Chat UI/UX)
- Task 1.1: Unified Chat Component
- Task 1.2: Chat Message UI
- Task 1.3: Chat Input Component
- Task 1.4: Integrate Chat in All Role Views

**Day 3-4:** Epic 2 (WebSocket)
- Task 2.1: Django Channels Setup
- Task 2.2: Chat WebSocket Consumer
- Task 2.3: Frontend WebSocket Client

**Day 5:** Epic 3 (File Service)
- Task 3.1: File Upload API
- Task 3.2: Remove Attachments from Ticket Service

**Day 6:** Epic 4 (UI Polish)
- Task 4.1: Fix Known UI Bugs
- Task 4.2: Loading States
- Task 4.3: Error Handling

---

## ✅ Definition of Done

- [ ] Chat UI works consistently across all roles
- [ ] Chat is responsive on desktop and mobile
- [ ] WebSocket chat delivers messages in real-time
- [ ] File uploads go through file-service
- [ ] No critical UI bugs
- [ ] Core ticket workflow is polished and user-friendly

---

**Questions to Clarify:**
1. Do you have a list of specific UI bugs to fix?
2. What screen sizes should we prioritize for responsive design?
3. Any specific design preferences for the chat UI?
