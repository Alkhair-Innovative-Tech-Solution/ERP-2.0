"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calender";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Calendar as CalendarIcon } from "lucide-react";
import { getApiBaseUrl, getClassrooms, getStudentFormOptions, getAllCampuses } from "@/lib/api";
import { toast } from "sonner";

// Minimal shape the parent needs to pass in — just enough to load + label the record.
export interface EditableStudent {
  id: number | string;
  name?: string;
}

export interface StudentEditFormProps {
  open: boolean;
  student: EditableStudent | null;
  /** Shared dropdown options (gender/religion/shift/...) already loaded by the page. */
  formOptions?: any;
  /** Campus list already loaded by the page (used for shift-availability). */
  campuses?: any[];
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save so the parent can refresh its list. */
  onSaved: () => void;
}

// Normalize an international phone to the local 11-digit Pakistani format.
// +923121234133 -> 03121234133, already 03xx -> keep as is.
const normalizePhone = (phone: string | null | undefined): string => {
  if (!phone) return "";
  let p = phone.toString().trim();
  p = p.replace(/[\s\-]/g, "");
  if (p.startsWith("+92")) return "0" + p.slice(3);
  if (p.startsWith("92") && p.length === 12) return "0" + p.slice(2);
  return p;
};

// Fields we validate + the friendly labels used in error messages.
const PHONE_FIELDS = ["phone_number", "emergency_contact", "father_contact", "mother_contact", "guardian_contact"];
const CNIC_FIELDS = ["student_cnic", "father_cnic", "guardian_cnic", "mother_cnic"];
const FIELD_LABELS: Record<string, string> = {
  name: "Full Name",
  student_cnic: "Student CNIC / B-Form",
  phone_number: "Student Phone",
  emergency_contact: "Emergency Contact",
  father_name: "Father Name",
  father_cnic: "Father CNIC",
  father_contact: "Father Contact",
  mother_name: "Mother Name",
  mother_cnic: "Mother CNIC",
  mother_contact: "Mother Contact",
  guardian_name: "Guardian Name",
  guardian_cnic: "Guardian CNIC",
  guardian_contact: "Guardian Contact",
  family_income: "Monthly Family Income",
  email: "Student Email",
};
const labelFor = (f: string) =>
  FIELD_LABELS[f] || f.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const PHONE_MSG = "Must be exactly 11 digits and start with 03 (e.g. 03121234567).";
const CNIC_MSG = "CNIC must be exactly 13 digits.";

/**
 * Self-contained Student edit dialog. The parent only controls visibility
 * (`open`) and passes the record to edit (`student`); this component fetches the
 * full record, owns all form state + validation + the PATCH, then calls
 * `onSaved()` so the parent can refresh. Keeps its OWN classroom list so it never
 * clobbers a shared list-page filter.
 */
export function StudentEditForm({
  open,
  student,
  formOptions: formOptionsProp,
  campuses: campusesProp = [],
  onOpenChange,
  onSaved,
}: StudentEditFormProps) {
  // Dropdown data: use what the parent passed, else fetch it once so the
  // component works standalone on any page (e.g. the coordinator student list).
  const [internalFormOptions, setInternalFormOptions] = useState<any>(null);
  const [internalCampuses, setInternalCampuses] = useState<any[]>([]);
  const formOptions = formOptionsProp ?? internalFormOptions;
  const campuses = campusesProp && campusesProp.length ? campusesProp : internalCampuses;

  useEffect(() => {
    if (!formOptionsProp) {
      getStudentFormOptions().then(setInternalFormOptions).catch(() => {});
    }
    if (!campusesProp || !campusesProp.length) {
      getAllCampuses()
        .then((d: any) => setInternalCampuses(Array.isArray(d) ? d : d?.results || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [editFormData, setEditFormData] = useState<any>({});
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);
  // Per-field validation messages shown inline under each field.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Update a form field and clear any error currently shown for it.
  const updateField = (field: string, value: any) => {
    setEditFormData((prev: any) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Client-side checks mirroring the backend rules, so the user gets instant,
  // specific feedback instead of a bare 400.
  const validateClientSide = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!editFormData.name || String(editFormData.name).trim().length < 2) {
      errs.name = "Name is required (at least 2 characters).";
    }
    PHONE_FIELDS.forEach((f) => {
      const v = (editFormData[f] ?? "").toString().replace(/\D/g, "");
      if (v && (v.length !== 11 || !v.startsWith("03"))) errs[f] = PHONE_MSG;
    });
    CNIC_FIELDS.forEach((f) => {
      const v = (editFormData[f] ?? "").toString().replace(/\D/g, "");
      if (v && v.length !== 13) errs[f] = CNIC_MSG;
    });
    if (editFormData.family_income !== "" && editFormData.family_income != null) {
      const n = Number(String(editFormData.family_income).replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0) errs.family_income = "Enter a valid amount.";
      else if (Math.floor(Math.abs(n)).toString().length > 8)
        errs.family_income = "Amount is too large (max 8 digits, up to 99,999,999).";
    }
    return errs;
  };

  // Load the full student record whenever the dialog opens for a student.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!open || !student) return;
      try {
        const baseForRead = getApiBaseUrl();
        const cleanBaseForRead = baseForRead.endsWith("/") ? baseForRead.slice(0, -1) : baseForRead;
        const response = await fetch(`${cleanBaseForRead}/api/students/${student.id}/`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.error("Error fetching student data:", response.statusText);
          toast.error("Error loading student data");
          return;
        }

        const studentData = await response.json();
        // Load full data; UI hides specific fields (grade/section/GR/shift/is_draft).
        const formData = {
          name: studentData.name || "",
          gender: studentData.gender || "",
          dob: studentData.dob || "",
          place_of_birth: studentData.place_of_birth || "",
          religion: studentData.religion || "",
          mother_tongue: studentData.mother_tongue || "",
          emergency_contact: normalizePhone(studentData.emergency_contact),
          father_name: studentData.father_name || "",
          father_cnic: studentData.father_cnic ? studentData.father_cnic.replace(/\D/g, "") : "",
          father_contact: normalizePhone(studentData.father_contact),
          father_profession: studentData.father_profession || "",
          address: studentData.address || "",
          guardian_name: studentData.guardian_name || "",
          guardian_cnic: studentData.guardian_cnic ? String(studentData.guardian_cnic).replace(/\D/g, "") : "",
          guardian_contact: normalizePhone(studentData.guardian_contact),
          guardian_relation: studentData.guardian_relation || "",
          current_grade: studentData.current_grade || "",
          section: studentData.section || "",
          last_class_passed: studentData.last_class_passed || "",
          last_school_name: studentData.last_school_name || "",
          last_class_result: studentData.last_class_result || "",
          from_year: studentData.from_year || "",
          to_year: studentData.to_year || "",
          siblings_count: studentData.siblings_count || "",
          father_status: studentData.father_status || "",
          sibling_in_alkhair: studentData.sibling_in_alkhair || "",
          gr_no: studentData.gr_no || "",
          enrollment_year: studentData.enrollment_year || "",
          shift: studentData.shift || "",
          is_draft: studentData.is_draft ? "true" : "false",
          is_active: studentData.is_active !== undefined ? studentData.is_active : true,
          classroom: studentData.classroom || studentData.classroom_id || "",
          photo: studentData.photo || null,
          email: studentData.email || "",
          student_cnic: studentData.student_cnic ? String(studentData.student_cnic).replace(/\D/g, "") : "",
          nationality: studentData.nationality || "",
          blood_group: studentData.blood_group || "",
          phone_number: normalizePhone(studentData.phone_number),
          mother_name: studentData.mother_name || "",
          mother_contact: normalizePhone(studentData.mother_contact),
          mother_profession: studentData.mother_profession || "",
          mother_status: studentData.mother_status || "",
          zakat_status: studentData.zakat_status || "",
          family_income: studentData.family_income ?? "",
          house_owned: studentData.house_owned || "",
          campus: typeof studentData.campus === "object" ? studentData.campus?.id : studentData.campus,
        };

        // Fetch classrooms for this student's campus + shift (own state, never the page's).
        if (studentData.campus) {
          const campusId = typeof studentData.campus === "object" ? studentData.campus.id : studentData.campus;
          const studentShift = studentData.shift || "";
          try {
            const classroomsData: any = await getClassrooms(undefined, undefined, campusId, studentShift);
            const classroomsList: any[] = Array.isArray(classroomsData)
              ? classroomsData
              : Array.isArray(classroomsData?.results)
                ? classroomsData.results
                : [];
            if (!cancelled) setClassrooms(classroomsList);
          } catch (error) {
            console.error("Error fetching classrooms:", error);
            if (!cancelled) setClassrooms([]);
          }
        }

        if (!cancelled) setEditFormData(formData);
      } catch (error) {
        console.error("Error fetching student data:", error);
        toast.error("Error loading student data");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student?.id]);

  const handleClose = () => {
    onOpenChange(false);
    setEditFormData({});
    setFieldErrors({});
  };

  const handleDobSelect = (date: Date | undefined) => {
    if (date) {
      const iso = date.toISOString().slice(0, 10);
      setEditFormData((prev: any) => ({ ...prev, dob: iso }));
    }
    setShowDobPicker(false);
  };

  const handleDeletePhoto = async () => {
    if (!student) return;

    // Photo not uploaded yet (a File) — just clear it locally.
    if (editFormData.photo && editFormData.photo instanceof File) {
      setEditFormData((prev: any) => ({ ...prev, photo: null }));
      return;
    }

    try {
      const baseForUpdate = getApiBaseUrl();
      const cleanBaseForUpdate = baseForUpdate.endsWith("/") ? baseForUpdate.slice(0, -1) : baseForUpdate;
      const resp = await fetch(`${cleanBaseForUpdate}/api/students/${student.id}/delete-photo/`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
        },
      });

      if (resp.ok) {
        setEditFormData((prev: any) => ({ ...prev, photo: null }));
        toast.success(" Photo deleted");
      } else {
        const text = await resp.text();
        console.error("Failed to delete photo:", resp.status, text);
        toast.error(`Error deleting photo: ${resp.status} - ${text}`);
      }
    } catch (err) {
      console.error("Error deleting photo:", err);
      toast.error("Error deleting photo");
    }
  };

  const handleEditSubmit = async () => {
    if (!student) return;

    // Validate on the client first — instant, specific feedback (no round-trip).
    const clientErrors = validateClientSide();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      toast.error("Please fix the highlighted fields", {
        description: (
          <ul className="mt-1 list-disc pl-4 text-xs opacity-90 space-y-0.5">
            {Object.entries(clientErrors).map(([f, m]) => (
              <li key={f}>
                <span className="font-semibold">{labelFor(f)}:</span> {m}
              </li>
            ))}
          </ul>
        ),
      });
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      // Upload a new photo first if present.
      let photoUrl = editFormData.photo;
      if (editFormData.photo && editFormData.photo instanceof File) {
        const photoForm = new FormData();
        photoForm.append("photo", editFormData.photo);

        const baseForUpdate = getApiBaseUrl();
        const cleanBaseForUpdate = baseForUpdate.endsWith("/") ? baseForUpdate.slice(0, -1) : baseForUpdate;

        try {
          const photoResponse = await fetch(`${cleanBaseForUpdate}/api/students/${student.id}/upload-photo/`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
            },
            body: photoForm,
          });

          if (photoResponse.ok) {
            const photoData = await photoResponse.json();
            photoUrl = photoData.photo_url;
            setEditFormData((prev: any) => ({ ...prev, photo: photoUrl }));
          }
        } catch (error) {
          console.error("Error uploading photo:", error);
        }
      }

      // Send all provided values EXCEPT excluded fields (classroom IS allowed).
      // Academic Information is view-only in the edit form — never modify grade,
      // section, enrollment year, shift or classroom from here.
      const excludeKeys = new Set([
        "current_grade",
        "section",
        "enrollment_year",
        "classroom",
        "shift",
        "gr_no",
        "is_draft",
        "photo",
        "_alumni",
      ]);
      const updateData: any = {};

      if (editFormData._alumni) {
        updateData.classroom = null;
        updateData.current_grade = "Alumni";
        updateData.section = null;
        updateData.is_active = false;
      }
      Object.keys(editFormData).forEach((key) => {
        if (excludeKeys.has(key)) return;
        if (key === "classroom") {
          updateData[key] = editFormData[key] !== undefined ? editFormData[key] || null : undefined;
        } else if (editFormData[key] !== "" && editFormData[key] !== null && editFormData[key] !== undefined) {
          updateData[key] = editFormData[key];
        }
      });

      // Numeric fields.
      if (updateData.from_year) updateData.from_year = parseInt(updateData.from_year);
      if (updateData.to_year) updateData.to_year = parseInt(updateData.to_year);
      if (updateData.enrollment_year) updateData.enrollment_year = parseInt(updateData.enrollment_year);
      if (updateData.siblings_count) updateData.siblings_count = parseInt(updateData.siblings_count);

      // Phone fields back to international format for the backend.
      const phoneFields = ["phone_number", "emergency_contact", "father_contact", "mother_contact", "guardian_contact"];
      phoneFields.forEach((field) => {
        if (editFormData[field] && typeof editFormData[field] === "string") {
          let p = editFormData[field].trim();
          if (p.startsWith("0")) {
            updateData[field] = "+92" + p.slice(1);
          } else if (p.startsWith("+92")) {
            updateData[field] = p;
          } else if (p && !p.startsWith("+")) {
            updateData[field] = "+92" + p;
          }
        }
      });

      const baseForUpdate = getApiBaseUrl();
      const cleanBaseForUpdate = baseForUpdate.endsWith("/") ? baseForUpdate.slice(0, -1) : baseForUpdate;
      const response = await fetch(`${cleanBaseForUpdate}/api/students/${student.id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("sis_access_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast.success("Student Updated", {
          description: `Student ${editFormData.name || student.name} has been updated successfully!`,
        });
        onOpenChange(false);
        setEditFormData({});
        onSaved();
      } else {
        const errorText = await response.text();
        const mapped: Record<string, string> = {};
        const summary: string[] = [];

        try {
          const errorData = JSON.parse(errorText);
          // The API wraps errors as { success:false, error:{ message, details:{field:[msg]} } }.
          // Raw DRF responses are a plain { field:[msg] } dict — support both shapes.
          let fieldDict: any = errorData;
          let topMessage = "";
          if (errorData && errorData.error && typeof errorData.error === "object") {
            fieldDict = errorData.error.details || {};
            topMessage = errorData.error.message || "";
          }
          if (fieldDict && typeof fieldDict === "object") {
            Object.entries(fieldDict).forEach(([field, val]) => {
              let msg = Array.isArray(val) ? val.join(" ") : String(val);

              // Duplicate CNIC / email come back as a non_field "unique set" error.
              if (field === "non_field_errors" || field === "detail") {
                if (/unique set/i.test(msg) && /student_cnic/i.test(msg)) {
                  mapped.student_cnic = "This CNIC is already registered to another student.";
                  summary.push(`${labelFor("student_cnic")}: already registered to another student.`);
                } else if (/unique set/i.test(msg) && /email/i.test(msg)) {
                  mapped.email = "This email is already registered to another student.";
                  summary.push(`${labelFor("email")}: already registered to another student.`);
                } else {
                  summary.push(msg);
                }
                return;
              }

              // Make the phone-number library's generic message concrete.
              if (PHONE_FIELDS.includes(field) && /not valid|invalid/i.test(msg)) {
                msg = PHONE_MSG;
              }
              mapped[field] = msg;
              summary.push(`${labelFor(field)}: ${msg}`);
            });
          }
          if (summary.length === 0 && topMessage) summary.push(topMessage);
        } catch (e) {
          summary.push(errorText || `Error updating student: ${response.status}`);
        }

        if (Object.keys(mapped).length > 0) setFieldErrors(mapped);

        toast.error("Update Failed", {
          description: (
            <ul className="mt-1 list-disc pl-4 text-xs opacity-90 space-y-0.5">
              {(summary.length ? summary : [`Error updating student: ${response.status}`]).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ),
        });
      }
    } catch (error: any) {
      toast.error("Error", {
        description: error?.message || "Error updating student",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto px-4 sm:px-6 py-6 rounded-3xl hide-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold transition-all duration-150 ease-in-out transform hover:shadow-lg active:scale-95 active:shadow-md" style={{ color: "#274c77" }}>
            Edit Student - {student?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm sm:text-base">
          {/* Personal Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Personal Information</h3>

            {/* Photo Upload */}
            <div className="mb-6">
              <Label htmlFor="photo">Profile Photo</Label>
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                {editFormData.photo ? (
                  <div className="relative">
                    <img
                      src={typeof editFormData.photo === "string" ? editFormData.photo : URL.createObjectURL(editFormData.photo)}
                      alt="Student photo"
                      className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={async () => {
                        if (editFormData.photo && editFormData.photo instanceof File) {
                          setEditFormData((prev: any) => ({ ...prev, photo: null }));
                          return;
                        }
                        await handleDeletePhoto();
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ) : (
                  <div className="w-24 h-24 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
                    <User className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setEditFormData({ ...editFormData, photo: file });
                      }
                    }}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-gray-500">Upload a profile photo (JPG, PNG)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={editFormData.name || ""}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Enter full name"
                  className={fieldErrors.name ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select value={editFormData.gender || ""} onValueChange={(value) => setEditFormData({ ...editFormData, gender: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {formOptions?.gender ? (
                      formOptions.gender.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dob">Date of Birth</Label>
                <Popover open={showDobPicker} onOpenChange={setShowDobPicker}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full h-10 justify-start text-left font-normal ${!editFormData.dob ? "text-muted-foreground" : ""}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editFormData.dob ? new Date(editFormData.dob).toLocaleDateString() : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editFormData.dob ? new Date(editFormData.dob) : undefined}
                      onSelect={handleDobSelect}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="place_of_birth">Place of Birth</Label>
                <Input
                  id="place_of_birth"
                  value={editFormData.place_of_birth || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, place_of_birth: e.target.value })}
                  placeholder="Enter place of birth"
                />
              </div>
              <div>
                <Label htmlFor="religion">Religion</Label>
                <Select value={editFormData.religion || ""} onValueChange={(value) => setEditFormData({ ...editFormData, religion: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select religion" />
                  </SelectTrigger>
                  <SelectContent>
                    {formOptions?.religion?.map((opt: any) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="mother_tongue">Mother Tongue</Label>
                <Select value={editFormData.mother_tongue || ""} onValueChange={(value) => setEditFormData({ ...editFormData, mother_tongue: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mother tongue" />
                  </SelectTrigger>
                  <SelectContent>
                    {formOptions?.mother_tongue?.map((opt: any) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="student_cnic">Student B-Form / CNIC</Label>
                <Input
                  id="student_cnic"
                  type="text"
                  maxLength={13}
                  value={editFormData.student_cnic || ""}
                  onChange={(e) => updateField("student_cnic", e.target.value.replace(/\D/g, "").slice(0, 13))}
                  placeholder="Enter 13-digit CNIC / B-Form"
                  className={fieldErrors.student_cnic ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {fieldErrors.student_cnic && <p className="mt-1 text-xs text-red-600">{fieldErrors.student_cnic}</p>}
              </div>
              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Select value={editFormData.nationality || ""} onValueChange={(value) => setEditFormData({ ...editFormData, nationality: value })}>
                  <SelectTrigger aria-label="Nationality">
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    {formOptions?.nationality?.map((opt: any) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="blood_group">Blood Group</Label>
                <Select value={editFormData.blood_group || ""} onValueChange={(value) => setEditFormData({ ...editFormData, blood_group: value })}>
                  <SelectTrigger aria-label="Blood Group">
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    {formOptions?.blood_group?.map((opt: any) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="phone_number">Student Phone</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  maxLength={11}
                  value={editFormData.phone_number || ""}
                  onChange={(e) => updateField("phone_number", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="Enter student phone (11 digits)"
                  className={fieldErrors.phone_number ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {fieldErrors.phone_number && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone_number}</p>}
              </div>
              <div>
                <Label htmlFor="emergency_contact">Emergency Contact</Label>
                <Input
                  id="emergency_contact"
                  type="tel"
                  maxLength={11}
                  value={editFormData.emergency_contact || ""}
                  onChange={(e) => updateField("emergency_contact", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="Enter emergency contact (11 digits)"
                  className={fieldErrors.emergency_contact ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {fieldErrors.emergency_contact ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.emergency_contact}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">Must be exactly 11 digits and make sure start with 03</p>
                )}
              </div>
              <div>
                <Label htmlFor="email">Student Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editFormData.email || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  placeholder="Enter student email"
                />
                <p className="mt-1 text-xs text-gray-500">Optional. Can be used for login.</p>
              </div>
              <div>
                <Label htmlFor="special_needs_disability">Special Needs / Disability</Label>
                <Select value={editFormData.special_needs_disability || "none"} onValueChange={(value) => setEditFormData({ ...editFormData, special_needs_disability: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {formOptions?.special_needs ? (
                      formOptions.special_needs.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="physical">Physical Disability</SelectItem>
                        <SelectItem value="visual">Visual Impairment</SelectItem>
                        <SelectItem value="hearing">Hearing Impairment</SelectItem>
                        <SelectItem value="learning">Learning Disability</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="is_active">Student Status</Label>
                  <Select
                    value={editFormData.is_active !== undefined ? (editFormData.is_active ? "true" : "false") : "true"}
                    onValueChange={(value) => setEditFormData({ ...editFormData, is_active: value === "true" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive (Left)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address">Permanent Address</Label>
                <Textarea
                  id="address"
                  value={editFormData.address || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  placeholder="Enter permanent address"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </div>

          {/* Father Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Father Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="father_name">Father Name</Label>
                <Input
                  id="father_name"
                  value={editFormData.father_name || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, father_name: e.target.value })}
                  placeholder="Enter father name"
                />
              </div>
              <div>
                <Label htmlFor="father_cnic">Father CNIC</Label>
                <Input
                  id="father_cnic"
                  type="text"
                  maxLength={13}
                  value={editFormData.father_cnic || ""}
                  onChange={(e) => updateField("father_cnic", e.target.value.replace(/\D/g, "").slice(0, 13))}
                  placeholder="Enter father CNIC (13 digits)"
                  className={fieldErrors.father_cnic ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {fieldErrors.father_cnic ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.father_cnic}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">Must be exactly 13 digits</p>
                )}
              </div>
              <div>
                <Label htmlFor="father_contact">Father Contact</Label>
                <Input
                  id="father_contact"
                  type="tel"
                  maxLength={11}
                  value={editFormData.father_contact || ""}
                  onChange={(e) => updateField("father_contact", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="Enter father contact (11 digits)"
                  className={fieldErrors.father_contact ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {fieldErrors.father_contact ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.father_contact}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">Must be exactly 11 digits and make sure start with 03</p>
                )}
              </div>
              <div>
                <Label htmlFor="father_profession">Father Profession</Label>
                <Input
                  id="father_profession"
                  value={editFormData.father_profession || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, father_profession: e.target.value })}
                  placeholder="Enter father profession"
                />
              </div>
              <div>
                <Label htmlFor="father_status">Father Status</Label>
                <Select value={editFormData.father_status || ""} onValueChange={(value) => setEditFormData({ ...editFormData, father_status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select father status" />
                  </SelectTrigger>
                  <SelectContent>
                    {formOptions?.father_status ? (
                      formOptions.father_status.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="alive">Alive</SelectItem>
                        <SelectItem value="dead">Dead</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Mother Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Mother Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mother_name">Mother Name</Label>
                <Input
                  id="mother_name"
                  value={editFormData.mother_name || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, mother_name: e.target.value })}
                  placeholder="Enter mother name"
                />
              </div>
              <div>
                <Label htmlFor="mother_contact">Mother Contact</Label>
                <Input
                  id="mother_contact"
                  type="tel"
                  maxLength={11}
                  value={editFormData.mother_contact || ""}
                  onChange={(e) => updateField("mother_contact", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="Enter mother contact (11 digits)"
                  className={fieldErrors.mother_contact ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {fieldErrors.mother_contact && <p className="mt-1 text-xs text-red-600">{fieldErrors.mother_contact}</p>}
              </div>
            </div>
          </div>

          {/* Guardian Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Guardian Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guardian_name">Guardian Name</Label>
                <Input
                  id="guardian_name"
                  value={editFormData.guardian_name || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, guardian_name: e.target.value })}
                  placeholder="Enter guardian name"
                />
              </div>
              <div>
                <Label htmlFor="guardian_relation">Relation</Label>
                <Input
                  id="guardian_relation"
                  value={editFormData.guardian_relation || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, guardian_relation: e.target.value })}
                  placeholder="e.g. Uncle"
                />
              </div>
              <div>
                <Label htmlFor="guardian_contact">Guardian Contact</Label>
                <Input
                  id="guardian_contact"
                  type="tel"
                  maxLength={11}
                  value={editFormData.guardian_contact || ""}
                  onChange={(e) => updateField("guardian_contact", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="Enter guardian contact (11 digits)"
                  className={fieldErrors.guardian_contact ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {fieldErrors.guardian_contact && <p className="mt-1 text-xs text-red-600">{fieldErrors.guardian_contact}</p>}
              </div>
              <div>
                <Label htmlFor="guardian_cnic">Guardian CNIC</Label>
                <Input
                  id="guardian_cnic"
                  type="text"
                  maxLength={13}
                  value={editFormData.guardian_cnic || ""}
                  onChange={(e) => updateField("guardian_cnic", e.target.value.replace(/\D/g, "").slice(0, 13))}
                  placeholder="Enter guardian CNIC (13 digits)"
                  className={fieldErrors.guardian_cnic ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {fieldErrors.guardian_cnic && <p className="mt-1 text-xs text-red-600">{fieldErrors.guardian_cnic}</p>}
              </div>
            </div>
          </div>

          {/* Family & Financial Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Family &amp; Financial Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="family_income">Monthly Family Income</Label>
                <Input
                  id="family_income"
                  type="number"
                  min="0"
                  value={editFormData.family_income ?? ""}
                  onChange={(e) => updateField("family_income", e.target.value)}
                  placeholder="Enter monthly family income"
                  className={fieldErrors.family_income ? "border-red-400 focus-visible:ring-red-400" : ""}
                />
                {fieldErrors.family_income && <p className="mt-1 text-xs text-red-600">{fieldErrors.family_income}</p>}
              </div>
              <div>
                <Label htmlFor="zakat_status">Zakat Status</Label>
                <Select value={editFormData.zakat_status || ""} onValueChange={(value) => setEditFormData({ ...editFormData, zakat_status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select zakat status" />
                  </SelectTrigger>
                  <SelectContent>
                    {formOptions?.zakat_status ? (
                      formOptions.zakat_status.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="applicable">Applicable</SelectItem>
                        <SelectItem value="not_applicable">Not Applicable</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="house_owned">House Owned</Label>
                <Select value={editFormData.house_owned || ""} onValueChange={(value) => setEditFormData({ ...editFormData, house_owned: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select house ownership" />
                  </SelectTrigger>
                  <SelectContent>
                    {formOptions?.house_owned ? (
                      formOptions.house_owned.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-[#e4ecf5] shadow-inner">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "#274c77" }}>Academic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="current_grade">Current Grade</Label>
                <Input
                  id="current_grade"
                  value={editFormData.current_grade || ""}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                  placeholder="Current grade"
                />
              </div>
              <div>
                <Label htmlFor="section">Current Section</Label>
                <Input
                  id="section"
                  value={editFormData.section || ""}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                  placeholder="Current section"
                />
              </div>
              <div>
                <Label htmlFor="enrollment_year">Enrollment Year</Label>
                <Input
                  id="enrollment_year"
                  type="number"
                  value={editFormData.enrollment_year || ""}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                  placeholder="Enrollment year"
                />
              </div>
              <div>
                <Label htmlFor="shift">Shift</Label>
                <Select value={editFormData.shift || ""} disabled onValueChange={(value) => setEditFormData({ ...editFormData, shift: value })}>
                  <SelectTrigger className="bg-gray-100 cursor-not-allowed">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const campus = campuses.find((c) => String(c.id) === String(editFormData.campus));
                      const shiftAvailable = campus?.shift_available || "both";

                      const options = formOptions?.shift || [
                        { value: "morning", label: "Morning" },
                        { value: "afternoon", label: "Afternoon" },
                      ];

                      if (shiftAvailable === "both") {
                        return options.map((opt: any) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ));
                      } else {
                        return options
                          .filter((opt: any) => opt.value === shiftAvailable)
                          .map((opt: any) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ));
                      }
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="classroom">Classroom</Label>
                <Select
                  value={editFormData._alumni ? "alumni" : editFormData.classroom ? String(editFormData.classroom) : "none"}
                  disabled
                  onValueChange={(value) => {
                    if (value === "alumni") {
                      setEditFormData({ ...editFormData, classroom: null, _alumni: true });
                    } else if (value === "none") {
                      setEditFormData({ ...editFormData, classroom: null, _alumni: false });
                    } else {
                      setEditFormData({ ...editFormData, classroom: parseInt(value), _alumni: false });
                    }
                  }}
                >
                  <SelectTrigger className="bg-gray-100 cursor-not-allowed">
                    <SelectValue placeholder="Select classroom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Classroom</SelectItem>
                    <SelectItem value="alumni">Alumni</SelectItem>
                    {classrooms.map((classroom: any) => (
                      <SelectItem key={classroom.id} value={String(classroom.id)}>
                        {classroom.grade?.name || classroom.grade_name || "N/A"} - {classroom.section || "N/A"} ({classroom.shift || "N/A"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the correct classroom for this student. This will automatically update the student's class assignment.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-6 transition-all duration-150">
          <Button onClick={handleClose} variant="outline" className="px-6 w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={handleEditSubmit}
            disabled={isSubmitting}
            className="px-6 w-full sm:w-auto"
            style={{ backgroundColor: "#6096ba" }}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </>
            ) : (
              "Update Student"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StudentEditForm;
