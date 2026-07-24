# Newton AMS — Dashboard Charts & Analytics Roadmap

## Currently Live

| Chart | Data Source | Model |
|-------|-------------|-------|
| Grade Distribution | Student Service | `Student.current_grade` |
| Gender Distribution | Student Service | `Student.gender` |
| Mother Tongue | Student Service | `Student.mother_tongue` |
| Religion | Student Service | `Student.religion` |
| Enrollment Trend | Student Service | `Student.created_at` |
| Age Distribution | Student Service | `Student.date_of_birth` |
| Weekly Attendance | Attendance Service | `StudentAttendance` |
| Zakat Status | Student Service | `Student.zakat_status` |
| House Ownership | Student Service | `Student.house_owned` |

---

## Ready to Build (Data Already Exists)

### Academic / Results
| Chart | Type | Model / Fields |
|-------|------|----------------|
| Pass / Fail Rate per Class | Bar | `Result.pass_status`, `classroom` |
| Grade Breakdown (A+→F) | Pie | `Result.grade` |
| Exam-wise Avg % (Monthly/Mid/Final) | Line | `Result.exam_type`, `Result.percentage` |
| Subject-wise Weak Areas | Horizontal Bar | `SubjectMark.subject_name`, avg `obtained_marks` |

### Attendance
| Chart | Type | Model / Fields |
|-------|------|----------------|
| Staff Attendance Today | KPI Cards | `StaffAttendance.status` |
| Class-wise Attendance % (monthly) | Bar | `StudentAttendance.status`, `classroom` |
| Monthly Attendance Heatmap | Heatmap | `StudentAttendance.date`, `status` |

### Fees
| Chart | Type | Model / Fields |
|-------|------|----------------|
| Collection Summary (Collected vs Outstanding) | KPI + Donut | `StudentFee.paid_amount`, `remaining_amount` |
| Monthly Fee Collection Trend | Line | `Payment.payment_date`, `amount` |
| Fee Status Breakdown (Paid/Partial/Unpaid) | Pie | `StudentFee.status` |

### Support Desk
| Chart | Type | Model / Fields |
|-------|------|----------------|
| Open Issues by Category | Pie | `RequestComplaint.category` |
| Issue Resolution Rate | Bar/Funnel | `RequestComplaint.status` |
| Pending by Priority | Stacked Bar | `RequestComplaint.priority` |

### Students — Social
| Chart | Type | Model / Fields |
|-------|------|----------------|
| Special Needs Count | KPI Badge | `Student.special_needs_disability` |
| Siblings Distribution | Bar (0/1/2/3+) | `Student.siblings_count` |
| Guardian Profession Breakdown | Pie | `Student.guardian_profession` |

### Staff
| Chart | Type | Model / Fields |
|-------|------|----------------|
| Teacher Count by Level | Bar | `Teacher` + `Level` |
| Coordinator → Teacher Ratio | KPI | `assigned_teachers` M2M count |

---

## Future (Needs New Fields / Tracking)

| Feature | What to Add | Model to Extend |
|---------|-------------|-----------------|
| Student Retention Rate | `dropout_date`, `dropout_reason` fields | `Student` |
| Promotion Rate per Class | Already has Promotion model — just aggregate | `Result` + Promotions |
| Fee Defaulter Aging | `months_overdue` computed field | `StudentFee` |
| Teacher Punctuality Score | Aggregate `late_minutes` per teacher monthly | `StaffAttendance` |
| Scholarship / Discount Tracking | `fee_discount`, `discount_reason` fields | `Student` or `StudentFee` |
| Staff Turnover Rate | `deactivated_at` timestamp on Teacher | `Teacher` |
| Year-over-Year Exam Comparison | Already has `academic_year` — just group by | `Result` |
| Parent Engagement Score | Track fee payment timeliness | `Payment` |
| Biometric Compliance % | Staff with ZKTeco mapping vs without | `ZKTecoEmployeeMapping` |

---

## Priority Order (Recommended)

```
1. Fee Collection Summary     → highest value for admin, data 100% ready
2. Pass/Fail Rate by Class    → teachers + principal daily use
3. Staff Attendance Today     → quick health check for principal
4. Open Support Issues        → prevents issues getting lost
5. Monthly Attendance Heatmap → deep dive for coordinators
```

---

## Service → Port Map (for API endpoints)

| Service | Port | Relevant APIs |
|---------|------|---------------|
| Student Service | 8001 | `/api/students/` |
| Result Service | 8003 | `/api/result/` |
| Attendance Service | 8006 | `/api/attendance/staff/`, `/api/attendance/` |
| Fees Service | 8004 | `/api/fees/` |
| Support Service | 8007 | `/api/requests/` |
| Staff Service | 8002 | `/api/teachers/`, `/api/coordinator/` |
