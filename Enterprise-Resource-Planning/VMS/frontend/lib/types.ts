export interface Visitor {
  id: string;
  full_name: string;
  cnic: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  photo: string | null;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  visit_count?: number;
  created_at: string;
}

export interface Host {
  id: string;
  name: string;
  department: string | null;
  employee_id: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

export interface Employee {
  id: string;
  name: string;
  department: string;
  designation: string;
  employee_id: string;
  phone: string | null;
  email: string;
  is_active: boolean;
}

export type VisitStatus =
  | "scheduled"
  | "pending_approval"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "rejected";

export type EntryType = "receptionist" | "qr_self" | "scheduled";

export type PurposeType =
  | "interview"
  | "meeting"
  | "delivery"
  | "contractor"
  | "official"
  | "vip"
  | "internal"
  | "other";

export const PURPOSE_OPTIONS: { value: PurposeType; label: string }[] = [
  { value: "interview", label: "Interview" },
  { value: "meeting", label: "Meeting" },
  { value: "delivery", label: "Delivery/Courier" },
  { value: "contractor", label: "Contractor/Worker" },
  { value: "official", label: "Official Visit" },
  { value: "vip", label: "VIP/Client/Donor" },
  { value: "internal", label: "Internal Visit (Own Campus/College/Hospital)" },
  { value: "other", label: "Other" },
];

export interface Visit {
  id: string;
  visitor_name: string;
  visitor_cnic: string | null;
  visitor_phone: string | null;
  visitor_company: string | null;
  visitor_photo: string | null;
  visitor_is_blacklisted: boolean;
  host_name: string | null;
  host_type: "host" | "employee" | "manual" | null;
  host_name_manual?: string | null;
  purpose: PurposeType | null;
  purpose_display: string;
  purpose_other: string | null;
  status: VisitStatus;
  entry_type: EntryType;
  scheduled_at: string | null;
  visiting_id: string | null;
  checked_in_at: string | null;
  expected_checkout_at: string | null;
  checked_out_at: string | null;
  is_returning: boolean;
  is_overnight: boolean;
  is_late: boolean;
  card_expired: boolean;
  duration_minutes: number | null;
  late_minutes: number | null;
  created_at: string;
}

export interface DashboardStats {
  today: {
    total: number;
    checked_in: number;
    checked_out: number;
    scheduled: number;
    pending_approval: number;
  };
  currently_inside: number;
  pending_approval: number;
  most_visited: Visitor[];
  last_7_days: { date: string; count: number }[];
}

// Extended visit detail (from visit_detail endpoint)
export interface VisitDetail extends Visit {
  visitor: import("./types").Visitor;
  host: import("./types").Host | null;
  notes: string | null;
  approved_by: number | null;
  interview_position: string | null;
  contractor_company: string | null;
  delivery_company: string | null;
  official_department: string | null;
  official_rank: string | null;
  vip_category: string | null;
}
