# AI Ticket Intake — Design Document

**Status:** Planned  
**Last Updated:** 2026-04-12

---

## Overview

Two parallel options for ticket creation:
1. **AI Chat Agent** — Conversational, zero-friction, recommended default
2. **Classic Form** — Simplified 3-field form for power users

Both options feed into the same ticket creation API.

---

## Option 1 — AI Chat Agent

### Flow

```
User: "mera laptop on nahi ho raha"
AI:   "Kab se ye masla hai? Koi error message aa raha hai?"
User: "kal se, sirf black screen hai"
AI:   "Samajh gaya. Ticket tayyar hai:"

[Ticket Preview]
  Subject:     Laptop not starting — black screen
  Department:  IT
  Category:    Hardware Issue
  Priority:    Medium
  Description: Laptop not turning on since yesterday.
               Black screen with no error message.

[+ Add Attachments]   ← Optional, shown after preview
[Edit]  [Submit]
```

### Conversation Rules
- Max **3-4 questions** — no interrogation
- If user gives enough info in first message → skip follow-up questions
- Always show ticket preview before submission
- User can edit any field in preview before submitting
- Moderator can override all AI-suggested fields during review

### Language Support
- **Roman Urdu** — primary (fully supported)
- **Karachi-specific jargon** — trained in system prompt
  - "hang ho gaya", "net nahi chal raha", "scene kya hai", "light chali gayi"
  - "AC kharab hai", "printer jam hai", "koi file nahi khul rahi"
  - Natural Urdu-English code-switching
- **English** — fully supported

### Attachments (Option A)
Shown **after ticket preview**, before submission:
```
[+ Add Attachments]  (Optional)
Supported: PDF, DOCX, JPG, PNG, MP4 — Max 250MB per file
```
User cannot attach files mid-conversation — only at the end.

---

## Option 2 — Classic Form (Simplified)

### Fields (3 only)
| Field | Required | Notes |
|-------|----------|-------|
| Subject | Yes | Min 10 chars |
| Description | Yes | Min 20 chars |
| Attachments | No | Max 250MB/file |

**Removed from form:**
- ~~Department~~ → Moderator assigns during review
- ~~Category~~ → Moderator assigns during review
- ~~Priority~~ → Moderator assigns during review

---

## AI Fields on Ticket Model (Add Now)

These nullable fields must be added to the Ticket model immediately:

```python
# AI-suggested values (set by AI intake agent)
ai_suggested_department  = models.CharField(max_length=100, null=True, blank=True)
ai_suggested_category    = models.CharField(max_length=100, null=True, blank=True)
ai_suggested_priority    = models.CharField(max_length=20, null=True, blank=True)
ai_suggested_subject     = models.TextField(null=True, blank=True)
ai_suggested_description = models.TextField(null=True, blank=True)
ai_intake_used           = models.BooleanField(default=False)
```

When Moderator overrides AI suggestion → logged in AuditLog:
`"Priority overridden by [Moderator]: medium → high"`

---

## Backend — AI Intake Endpoint

```
POST /api/v1/ai/ticket-intake
Body: {
  session_id: "uuid",
  message: "user ka message",
  conversation_history: [...]
}

Response: {
  type: "question" | "draft",
  message: "AI ka next question",   // if type=question
  draft: { subject, department,     // if type=draft
           category, priority,
           description }
}
```

Conversation history **Redis mein store** hogi `session_id` ke saath.
API stateless hai — context tumhare pass hai, AI ke pass nahi.

---

## AI Model — Gemini 2.0 Flash

| Setting | Value |
|---------|-------|
| Model | `gemini-2.0-flash-exp` |
| Provider | Google AI |
| Cost | Free tier |
| Rate Limit | 15 RPM, 1M tokens/day |

### API Key Rotation

```python
# settings mein
GEMINI_API_KEYS = [
    env("GEMINI_API_KEY_1"),
    env("GEMINI_API_KEY_2"),
    env("GEMINI_API_KEY_3"),
]

# On 429 response → rotate to next key
# Current key index stored in Redis
# Context (conversation history) stored separately in Redis — unaffected by key rotation
```

### Long-Term (Product/SaaS)
Each customer configures their own Gemini API key via Admin settings.
Removes ToS risk, removes rate limit dependency on our keys.

---

## Moderator Role — AI Override

Moderator during ticket review can override any AI-suggested field:
- Department
- Category
- Priority
- Subject (edit)
- Description (edit)

All overrides logged in AuditLog with before/after values.

---

## System Prompt (Draft)

```
You are a helpful help desk assistant for an organization.
Your job is to understand the user's problem and create a 
proper support ticket.

Rules:
- Ask maximum 3 follow-up questions
- If enough info provided, skip to ticket draft directly
- Respond in the same language the user writes in
  (Roman Urdu, English, or mixed — match their style)
- Understand Karachi workplace jargon naturally
- Determine department, category, and priority yourself
  (never ask user for these)
- Always show ticket preview before finalizing
- Keep responses short and conversational
```

---

## What Stays the Same

- Ticket creation API (`POST /api/v1/tickets`) — unchanged
- File upload flow — unchanged (file-service)
- Moderator review workflow — unchanged
- FSM transitions — unchanged
