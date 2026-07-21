"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { useSignIn } from "@/hooks/user-signed-in";
import { motion } from "framer-motion";
import { Sparkles, UserPlus, Phone, Mail, Key, BookOpen, GraduationCap, Calendar, AlertCircle, X, Search, MapPin, Briefcase, Users, ShieldCheck, Signature, Languages, Building2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Navbar from "@/components/mainComponent/Navbar";
import Footer from "@/components/mainComponent/Footer"

interface FormInput {
  full_name: string,
  phone: string,
  email: string,
  cnic: string,
  role: string,
  course: string,
  password: any,
  confirm_password: any,
  date_of_birth: string,
  code?: string,
  receipt_code: string,
  // New Fields
  gender: string,
  whatsapp_number: string,
  father_guardian_name: string,
  guardian_contact: string,
  relationship_to_student: string,
  last_qualification: string,
  full_address: string,
  study_work_status: string,
  study_work_details: string,
  studied_at_idara: boolean,
  studying_at_idara: boolean,
  language_course: string,
  is_terms_agreed: boolean,
  signature: string,
}

const RegisterPage = () => {
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>("");
  const [filteredCourses, setFilteredCourses] = useState<any[]>([]);
  const [errorModel, setErrorModel] = useState<string | any>(null);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [sessions, setSessions] = useState<any[]>([]);
  // 🔹 Multi-Tenancy: Organization and Campus selectors
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [campuses, setCampuses] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedCampusId, setSelectedCampusId] = useState<string>("");
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingCampuses, setLoadingCampuses] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [formData, setFormData] = useState<FormInput>({
    full_name: "",
    phone: "",
    email: "",
    cnic: "",
    role: "student",
    course: "",
    password: "",
    confirm_password: "",
    date_of_birth: "",
    receipt_code: "",
    gender: "",
    whatsapp_number: "",
    father_guardian_name: "",
    guardian_contact: "",
    relationship_to_student: "",
    last_qualification: "",
    full_address: "",
    study_work_status: "",
    study_work_details: "",
    studied_at_idara: false,
    studying_at_idara: false,
    language_course: "",
    is_terms_agreed: false,
    signature: "",
  });
  const [rjxErrors, setRJXErrors] = useState<{ [key: string]: string }>({});
  const [showPopup, setShowPopup] = useState(false);
  // inside RegisterPage()
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [showLmsRedirectModal, setShowLmsRedirectModal] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [testRequired, setTestRequired] = useState<boolean>(true);
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [lookupReference, setLookupReference] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);


  const handleEnroll = () => {
    setShowPopup(true);
    setTimeout(() => {
      setShowPopup(false);
      window.location.href = '/courses';
    }, 5000);
  };

  const handleLookup = async () => {
    if (!lookupReference) return;
    setIsLookingUp(true);
    try {
      const isEmail = lookupReference.includes("@");
      const body = isEmail
        ? { email: lookupReference }
        : { seq_id: lookupReference };
      const res = await fetch("/api/admission/lead/lookup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      console.log("🔍 Lookup Response:", res.status);
      const data = await res.json();
      console.log("📦 Lookup Data:", data);

      if (res.ok) {
        setLeadId(data.id);
        setFormData(prev => ({
          ...prev,
          full_name: data.name || prev.full_name,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          course: data.course_id || prev.course,
          gender: data.gender || prev.gender,
          whatsapp_number: data.whatsapp_number || prev.whatsapp_number,
          father_guardian_name: data.father_guardian_name || prev.father_guardian_name,
          guardian_contact: data.guardian_contact || prev.guardian_contact,
          relationship_to_student: data.relationship_to_student || prev.relationship_to_student,
          last_qualification: data.last_qualification || prev.last_qualification,
          full_address: data.full_address || prev.full_address,
          study_work_status: data.study_work_status || prev.study_work_status,
          study_work_details: data.study_work_details || prev.study_work_details,
          studied_at_idara: data.studied_at_idara !== undefined ? data.studied_at_idara : prev.studied_at_idara,
          studying_at_idara: data.studying_at_idara !== undefined ? data.studying_at_idara : prev.studying_at_idara,
          signature: data.signature || prev.signature,
          is_terms_agreed: data.is_terms_agreed !== undefined ? data.is_terms_agreed : prev.is_terms_agreed,
          date_of_birth: data.date_of_birth || prev.date_of_birth,
        }));

        // 🔹 Auto-select Specialization based on Course
        if (courses.length > 0 && data.course_id) {
          const matchedCourse = courses.find((c: any) => String(c.id) === String(data.course_id));
          if (matchedCourse) {
            // Handle if specialization is object or ID
            const specId = typeof matchedCourse.specialization === 'object'
              ? matchedCourse.specialization.id
              : matchedCourse.specialization;

            console.log("✅ Auto-selecting specialization:", specId);
            setSelectedSpecialization(specId);
          } else {
            console.warn("⚠️ Course not found in list:", data.course_id);
          }
        }

        setTestRequired(data.test_required);
        setShowLookupModal(false);

        // 🔹 Check if mandatory profile data is missing in the fetched record
        const isProfileIncomplete = !data.gender || !data.whatsapp_number || !data.date_of_birth || !data.signature;

        if (data.passed || !data.test_required) {
          if (isProfileIncomplete) {
             // If profile is incomplete, stay on Step 1 but with the fetched data
             // OR go to Step 3 but ensure the completion block is welcoming.
             // We'll go to Step 3 because they passed the test, but our new UI will handle the missing fields.
             setCurrentStep(3);
             window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
             setCurrentStep(3);
             window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        } else {
          // If not passed, check if test is required
          if (!data.test_required) {
            setCurrentStep(3);
          } else {
            setErrorModel("Found your registration, but you haven't passed the entrance test yet. Please complete the test first.");
            window.location.href = `/register/entrance-test?lead_id=${data.id}`;
          }
        }
      } else {
        console.warn("⚠️ API Error, setting error model:", data.error);
        setErrorModel(data.error || "Could not find registration. Please check your reference number.");
      }
    } catch (err) {
      console.error("🚨 Network/Parse Error:", err);
      setErrorModel("Network error. Please try again.");
    } finally {
      setIsLookingUp(false);
    }
  };



  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
          }
        });
      },
      { threshold: 0.1 }
    );

    const currentBanner = bannerRef.current;
    if (currentBanner) {
      observer.observe(currentBanner);
      return () => observer.unobserve(currentBanner);
    }
  }, []);

  // 🔹 Multi-Tenancy: Fetch organizations on load
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        setLoadingOrgs(true);
        const res = await fetch("/proxy/get?url=/api/orgs/organizations/");
        const data = await res.json();
        const orgList = data.data || data || [];
        setOrganizations(Array.isArray(orgList) ? orgList : []);
        
        // Auto-select first org if only one exists
        if (orgList.length === 1) {
          setSelectedOrgId(orgList[0].id);
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
      } finally {
        setLoadingOrgs(false);
      }
    };
    fetchOrgs();
  }, []);

  // 🔹 Multi-Tenancy: Fetch campuses when organization changes
  useEffect(() => {
    if (!selectedOrgId) {
      setCampuses([]);
      setSelectedCampusId("");
      return;
    }
    
    const fetchCampuses = async () => {
      try {
        setLoadingCampuses(true);
        const res = await fetch(`/proxy/get?url=/api/orgs/campuses/?organization_id=${selectedOrgId}`);
        const data = await res.json();
        const campusList = data.data || data || [];
        setCampuses(Array.isArray(campusList) ? campusList : []);
        setSelectedCampusId(""); // Reset campus when org changes
      } catch (error) {
        console.error("Error fetching campuses:", error);
      } finally {
        setLoadingCampuses(false);
      }
    };
    fetchCampuses();
  }, [selectedOrgId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 🔹 Multi-Tenancy: Get org_id from localStorage
        const orgId = localStorage.getItem('selected_org_id') || '';
        const orgParam = orgId ? `&org_id=${orgId}` : '';
        const [batchRes, branchesRes, specializationsResponse, coursesOriginalResponse] = await Promise.all([
          fetch(`/proxy/get?url=/api/courses/batches/all${orgParam}`),
          fetch(`/proxy/get?url=/api/courses/branches/${orgParam ? '?' + orgParam.slice(1) : ''}`),
          fetch(`/proxy/get?url=/api/courses/specialization/all${orgParam}`),
          fetch(`/proxy/get?url=/api/courses/courses/${orgParam}`),
        ]);

        const batchData = await batchRes.json();
        const branchesData = await branchesRes.json();
        const specializationsData = await specializationsResponse.json();
        let coursesData = await coursesOriginalResponse.json();

        // Handle direct array or wrapped data from Ninja API (Mirroring Courses page logic)
        const batchList = Array.isArray(batchData) ? batchData : (batchData.data || batchData.results || []);
        const branchList = Array.isArray(branchesData) ? branchesData : (branchesData.data || branchesData.results || []);
        const specList = Array.isArray(specializationsData) ? specializationsData : (specializationsData.data || specializationsData.results || []);
        let courseList = Array.isArray(coursesData) ? coursesData : (coursesData.data || coursesData.results || []);

        // Fallback for courses if initial fetch is empty
        if (courseList.length === 0) {
          console.warn("⚠️ Course list empty, trying fallback /api/courses/courses/");
          const fallbackRes = await fetch(`/proxy/get?url=/api/courses/courses/${orgParam}`);
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            courseList = Array.isArray(fallbackData) ? fallbackData : (fallbackData.data || fallbackData.results || []);
          }
        }

        const filteredSpecializations = specList.filter((spec: any) => spec.active === true && spec.name !== "General IQ Test");

        console.log("📥 Data Loaded (Normalized):", {
          specsCount: filteredSpecializations.length,
          coursesCount: courseList.length,
        });

        setBatches(batchList);
        setBranches(branchList);
        setSpecializations(filteredSpecializations);
        setCourses(courseList);

        localStorage.setItem("specializations", JSON.stringify(filteredSpecializations));
        localStorage.setItem("courses", JSON.stringify(courseList));

      } catch (error) {
        console.error("🚨 Error fetching course and specialization data:", error);
      }
    };

    fetchData();

    return () => {
      // Optional: Clear cache on unload
      window.addEventListener("beforeunload", () => {
        localStorage.removeItem("specializations");
        localStorage.removeItem("courses");
      });
    };
  }, []);


  useEffect(() => {
    // Clear potentially corrupt legacy cache on load
    localStorage.removeItem("courses");
    localStorage.removeItem("specializations");
  }, []);

  useEffect(() => {
    if (courses.length > 0) {
      console.log("📊 Data Audit:", {
        totalCourses: courses.length,
        availableSpecIds: specializations.map(s => String(s.id)),
        firstCourseSpec: courses[0]?.specialization,
        selectedSpec: selectedSpecialization
      });
    }

    if (selectedSpecialization && courses.length > 0) {
      console.log("🔍 Filtering logic triggered for:", selectedSpecialization);

      const filtered = courses.filter((course) => {
        const courseSpecId = typeof course.specialization === 'object'
          ? course.specialization?.id
          : course.specialization;

        const isMatch = String(courseSpecId).toLowerCase() === String(selectedSpecialization).toLowerCase();
        
        // --- STRICT ADMISSION FILTERING ---
        // Only show courses that are explicitly 'open' for admission
        const isAdmissionOpen = String(course.admission_status || '').toLowerCase() === 'open';
        
        return isMatch && isAdmissionOpen;
      });

      console.log(`✨ Match found: ${filtered.length} courses`);

      if (filtered.length === 0 && courses.length > 0) {
        console.warn("⚠️ No open courses found for this specialization.");
        setFilteredCourses([]); 
      } else {
        setFilteredCourses(filtered);
      }
    } else {
      setFilteredCourses([]);
    }
  }, [selectedSpecialization, courses, specializations]);

  useEffect(() => {
    const checkTestRequirement = async () => {
      if (formData.course) {
        try {
          const res = await fetch("/api/admission/check-requirement/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ course_id: formData.course }),
          });
          const data = await res.json();
          setTestRequired(data.test_required !== false);
        } catch (err) {
          console.error("Error checking test requirement:", err);
        }
      }
    };
    checkTestRequirement();
  }, [formData.course]);

  useEffect(() => {
    if (!formData.course) {
      setSessions([]);
      setSelectedSession("");
      setBranchId("");
      return;
    }
    const fetchSessions = async () => {
      setLoadingSessions(true);
      try {
        const res = await fetch(`/proxy/get?url=/api/courses/courses/${formData.course}/sessions/`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setSessions(list);
        setSelectedSession("");
      } catch (err) {
        console.error("Error fetching sessions:", err);
        setSessions([]);
      } finally {
        setLoadingSessions(false);
      }
    };
    fetchSessions();
  }, [formData.course]);


  const handleChange = (e: any) => {
    let { name, value, type, checked } = e.target;
    
    // Numeric only fields
    if (name === "phone" || name === "cnic" || name === "whatsapp_number" || name === "guardian_contact") {
      value = value.replace(/\D/g, "");
    }
    
    // Email lowercase only (as per user request)
    if (name === "email") {
      value = value.toLowerCase();
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const getValidationErrors = (step: number = 3): { [key: string]: string } => {
    let newErrors: { [key: string]: string } = {};

    // --- Step 1 / General Validation ---
    
    // Full Name Validation
    if (!formData.full_name || formData.full_name.trim().length < 3) {
      newErrors.full_name = "Full Name must be at least 3 characters long.";
    } else if (!formData.full_name.match(/^[a-zA-Z\s]+$/)) {
      newErrors.full_name = "Full Name must contain only letters.";
    }

    // Phone Validation (Exactly 11 digits)
    if (!formData.phone) {
      newErrors.phone = "Phone Number is required.";
    } else if (!formData.phone.match(/^\d{11}$/)) {
      newErrors.phone = "Phone Number must be exactly 11 digits.";
    }

    // Email Validation (Lowercase only regex)
    if (!formData.email) {
      newErrors.email = "Email is required.";
    } else if (/[A-Z]/.test(formData.email)) {
      newErrors.email = "Email must be in all lowercase letters.";
    } else if (!formData.email.match(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/)) {
      newErrors.email = "Invalid email format.";
    }
    
    // Step 1 specific fields
    if (step === 1) {
      if (!formData.course) newErrors.course = "Please select a course.";
      if (!formData.gender) newErrors.gender = "Gender is required.";
      if (!formData.whatsapp_number || !formData.whatsapp_number.match(/^\d{11}$/)) {
         newErrors.whatsapp_number = "WhatsApp must be 11 digits.";
      }

      // Date of Birth Validation
      if (!formData.date_of_birth) {
        newErrors.date_of_birth = "Date of Birth is required.";
      } else {
        const dob = new Date(formData.date_of_birth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        let monthDiff = today.getMonth() - dob.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        if (age < 5 || age > 100) {
          newErrors.date_of_birth = "Please enter a valid age (5-100 years).";
        }
      }

      if (!formData.is_terms_agreed) newErrors.is_terms_agreed = "You must agree to the Terms & Conditions.";
      if (!formData.signature) newErrors.signature = "Signature is required.";
    }

    // Step 3 specific fields (including missing profile details)
    if (step === 3) {
      // Re-validate profile fields ONLY if they are empty (for resumed registrations)
      if (!formData.gender) newErrors.gender = "Gender is required.";
      if (!formData.date_of_birth) newErrors.date_of_birth = "Date of Birth is required.";
      if (!formData.whatsapp_number || !formData.whatsapp_number.match(/^\d{11}$/)) {
        newErrors.whatsapp_number = "WhatsApp must be 11 digits.";
      }
      if (!formData.is_terms_agreed) newErrors.is_terms_agreed = "You must agree to the Terms & Conditions.";
      if (!formData.signature) newErrors.signature = "Signature is required.";
    }

    // --- Step 3 specific Validation ---
    if (step === 3) {
      // CNIC Validation (Exactly 13 digits)
      if (!formData.cnic) {
        newErrors.cnic = "CNIC is required.";
      } else if (!formData.cnic.match(/^\d{13}$/)) {
        newErrors.cnic = "CNIC must be exactly 13 digits.";
      }

      // Password Validation
      if (!formData.password) {
        newErrors.password = "Password is required.";
      } else if (formData.password.length < 4) {
        newErrors.password = "Password must be at least 4 characters long.";
      } else if (formData.password.length > 16) {
        newErrors.password = "Password must be less than or equal to 16 characters long.";
      }

      // Confirm Password Validation
      if (!formData.confirm_password) {
        newErrors.confirm_password = "Please confirm your password.";
      } else if (formData.password !== formData.confirm_password) {
        newErrors.confirm_password = "Passwords do not match.";
      }
    }

    setRJXErrors(newErrors);
    return newErrors;
  };

  useEffect(() => {
    // Handle redirect back from entrance test or direct enrollment from course details
    const searchParams = new URLSearchParams(window.location.search);
    const leadParam = searchParams.get("lead_id");
    const phaseParam = searchParams.get("phase");

    // Check for direct enrollment parameters
    const courseIdParam = searchParams.get("course_id");
    const specializationIdParam = searchParams.get("specialization_id");
    const branchIdParam = searchParams.get("branch_id");

    if (branchIdParam) {
      setBranchId(branchIdParam);
    }

    if (leadParam) {
      setLeadId(leadParam);
      // If we came back from test with phase 3, set it
      if (phaseParam === "3") {
        setCurrentStep(3);

        // Fetch lead details to refill lost state
        fetch(`/api/admission/lead/${leadParam}/status`)
          .then(res => res.json())
          .then(data => {
            if (data.email) {
              setFormData(prev => ({
                ...prev,
                full_name: data.name || "",
                email: data.email || "",
                phone: data.phone || "",
                course: data.course_id || ""
              }));

              // Try to find spec
              if (courses.length > 0) {
                const c = courses.find(c => c.id === data.course_id);
                if (c) setSelectedSpecialization(c.specialization);
              }
            }
          })
          .catch(err => console.error("Error fetching lead status:", err));
      }
    } else if (courseIdParam || specializationIdParam) {
      // Handle auto-fill from courses details
      if (specializationIdParam) {
        setSelectedSpecialization(specializationIdParam);
      }

      if (courseIdParam) {
        setFormData(prev => ({
          ...prev,
          course: courseIdParam
        }));
      }
    }
  }, [courses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentStep === 1) {
      // Phase 1: Basic Info
      const errorsFound = getValidationErrors(1);
      
      if (sessions.length > 0 && !selectedSession) {
        errorsFound.session = "Please select a session / time slot.";
      }

      if (Object.keys(errorsFound).length > 0) {
        setRJXErrors(errorsFound);
        return;
      }
      try {
        // 🔹 Multi-Tenancy: Get org_id from localStorage
        // 🔹 Multi-Tenancy: Use selected org/campus from form
        const orgId = selectedOrgId || localStorage.getItem('selected_org_id') || '';
        const campusId = selectedCampusId || localStorage.getItem('selected_campus_id') || '';
        
        const res = await fetch("/api/admission/lead/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            course_id: formData.course,
            gender: formData.gender,
            whatsapp_number: formData.whatsapp_number,
            father_guardian_name: formData.father_guardian_name,
            guardian_contact: formData.guardian_contact,
            relationship_to_student: formData.relationship_to_student,
            last_qualification: formData.last_qualification,
            full_address: formData.full_address,
            study_work_status: formData.study_work_status,
            study_work_details: formData.study_work_details,
            studied_at_idara: formData.studied_at_idara,
            studying_at_idara: formData.studying_at_idara,
            language_course: formData.language_course,
            is_terms_agreed: formData.is_terms_agreed,
            signature: formData.signature,
            ...(branchId ? { branch: branchId } : {}),
            ...(selectedSession ? { scheduled_class_id: selectedSession } : {}),
            // 🔹 Multi-Tenancy: Include organization_id and campus_id
            ...(orgId ? { organization_id: orgId } : {}),
            ...(campusId ? { campus_id: campusId } : {})
          }),
        });

        const payload = await res.json();
        if (res.ok && payload.lead_id) {
          setLeadId(payload.lead_id);
          setTestRequired(payload.test_required !== false);

          if (payload.test_required === false) {
            // Skip test, go directly to phase 3 (final registration/payment)
            setCurrentStep(3);
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            // Redirect to test page
            window.location.href = `/register/entrance-test?lead_id=${payload.lead_id}&test_id=${payload.test_id}`;
          }
        } else {
          // Enhanced error parsing for DRF format
          let errorMessage = "Failed to create lead";
          if (payload.email) {
            errorMessage = payload.email[0];
          } else if (payload.phone) {
            errorMessage = payload.phone[0];
          } else if (payload.error) {
            errorMessage = payload.error;
          } else if (payload.message) {
            errorMessage = payload.message;
          } else if (typeof payload === 'object') {
            // Try to find first error in object
            const firstKey = Object.keys(payload)[0];
            if (firstKey && Array.isArray(payload[firstKey])) {
              errorMessage = `${firstKey}: ${payload[firstKey][0]}`;
            }
          }
          setErrorModel(`⚠️ ${errorMessage}`);
        }
      } catch (err) {
        console.error(err);
        setErrorModel("⚠️ Network error, try again");
      }
      return;
    }


    if (currentStep === 3) {
      // Phase 3: Final Registration with Receipt Code Verification
      const errorsFound = getValidationErrors();

      // Specifically check for receipt_code
      if (!formData.receipt_code) {
        errorsFound.receipt_code = "Deposit Slip Code is required.";
      }

      setRJXErrors(errorsFound);

      if (Object.keys(errorsFound).length > 0) {
        return;
      }

      setVerifying(true);
      try {
        // 🔹 Multi-Tenancy: Get org_id and campus_id
        const orgId = selectedOrgId || localStorage.getItem('selected_org_id') || '';
        const campusId = selectedCampusId || localStorage.getItem('selected_campus_id') || '';
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/students/verify-receipt-code/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receipt_code: formData.receipt_code,
            email: formData.email,
            full_name: formData.full_name,
            phone: formData.phone,
            cnic: formData.cnic,
            password: formData.password,
            date_of_birth: formData.date_of_birth,
            // New Registration Fields
            gender: formData.gender,
            whatsapp_number: formData.whatsapp_number,
            father_guardian_name: formData.father_guardian_name,
            guardian_contact: formData.guardian_contact,
            relationship_to_student: formData.relationship_to_student,
            last_qualification: formData.last_qualification,
            full_address: formData.full_address,
            study_work_status: formData.study_work_status,
            study_work_details: formData.study_work_details,
            studied_at_idara: formData.studied_at_idara,
            studying_at_idara: formData.studying_at_idara,
            signature: formData.signature,
            is_terms_agreed: formData.is_terms_agreed,
            // 🔹 Multi-Tenancy: Include organization_id and campus_id
            ...(orgId ? { organization_id: orgId } : {}),
            ...(campusId ? { campus_id: campusId } : {})
          }),
        });

        const payload = await res.json();

        if (res.ok && payload.verified) {
          // Success! Show redirect modal
          setShowLmsRedirectModal(true);
        } else {
          // Verification failed or other error
          setErrorModel(`⚠️ ${payload.detail || payload.message || "Invalid Deposit Slip Code or details. Please check with Admin."}`);
        }
      } catch (err) {
        console.error(err);
        setErrorModel("⚠️ Network error, please try again later.");
      } finally {
        setVerifying(false);
      }
      return;
    }
  };


  useEffect(() => {
    // if (!showOtpModal) return;
    // setOtp("");
    // setOtpError(null);

    // // setIsButtonDisabled(true); // button disable
    // // if (otp.length === 6) {
    // //   setIsButtonDisabled(false);
    // // } else {
    // //   setIsButtonDisabled(true);
    // // }

    // setTimeLeft(600);
    // const interval = setInterval(() => {
    //   setTimeLeft(t => {
    //     if (t <= 1) {
    //       clearInterval(interval);
    //       return 0;
    //     }
    //     return t - 1;
    //   });
    // }, 1000);
    // return () => clearInterval(interval);
  }, [showOtpModal]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // const handleResendOtp = async () => {
  //   setResending(true);
  //   try {
  //     const res = await fetch(
  //       `/api/auth/signup?url=/backend/user/register/init`,
  //       {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify(formData),
  //       }
  //     );
  //     const body = await res.json();
  //     if (body.status === 200) {
  //       setOtpError(null);
  //       setTimeLeft(600);
  //     } else {
  //       setOtpError(body.message || "Failed to resend code");
  //     }
  //   } catch {
  //     setOtpError("Network error");
  //   } finally {
  //     setResending(false);
  //   }
  // };

  // const handleVerifyOtp = async () => {
  //   setVerifying(true);
  //   setOtpError(null);

  //   try {
  //     // build the query string for email & code
  //     formData.code = otp;
  //     const res = await fetch(
  //       `/api/auth/signup?url=/backend/user/register/verify`,
  //       {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify(formData),
  //       }
  //     );
  //     const payload = await res.json();

  //     if (payload.status === 400 || payload.status === 404) {
  //       setOtpError(payload.message || "Invalid or expired code.");
  //     } else if (payload.status === 200 && payload.user) {
  //       // success — proxy already set tokens for us
  //       useUser.getState().setUser(payload.user);
  //       useSignIn.getState().setSignedIn(true);
  //       window.location.href = "/dashboard";
  //     } else {
  //       setOtpError("⚠️ Something went wrong, try again");
  //     }
  //   } catch (err) {
  //     console.error(err);
  //     setOtpError("⚠️ Network error, try again");
  //   }
  // };


  return (
    <div className="">
      <Navbar />
      <div className="min-h-screen relative">
        {/* OTP Modal */}
        <AnimatePresence>
        </AnimatePresence>


        <AnimatePresence>
          {showPopup && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-Black/50 backdrop-blur-sm"
            >
              <div className="bg-cream dark:bg-Blue p-8 rounded-2xl shadow-2xl max-w-md mx-4 text-center transform hover:scale-105 transition-transform duration-300">
                <h3 className="text-2xl font-[400] text-SeaGrean dark:text-Orange mb-4">
                  Coming Soon!
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  We&apos;re working hard to bring you the best you deserve!
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 5 }}
                    className="h-full bg-SeaGrean dark:bg-Orange"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* Resume Registration Modal */}
        <AnimatePresence>
          {showLookupModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-Black/50 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 50 }}
                className="bg-white dark:bg-Blue p-8 rounded-3xl shadow-2xl max-w-md w-full relative"
              >
                <button
                  onClick={() => setShowLookupModal(false)}
                  className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-SeaGrean/10 rounded-full mb-4">
                    <Search className="w-8 h-8 text-SeaGrean" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Resume Registration</h3>
                      <p className="text-gray-500 dark:text-gray-400">Enter your Reference Number or Email to continue where you left off.</p>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Reference Number or Email (e.g. 1001 or email@example.com)"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-Black/50 border border-gray-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-SeaGrean outline-none transition-all dark:text-white"
                      value={lookupReference}
                      onChange={(e) => setLookupReference(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={handleLookup}
                    disabled={isLookingUp}
                    className="w-full py-4 bg-SeaGrean text-white rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center disabled:opacity-50"
                  >
                    {isLookingUp ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Find My Registration"
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LMS Redirect Success Modal */}
        <AnimatePresence>
          {showLmsRedirectModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-Black/50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 50 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="bg-cream dark:bg-Blue p-8 rounded-2xl shadow-2xl max-w-md mx-4 text-center"
              >
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-SeaGrean to-teal-500 dark:from-Orange dark:to-orange-600 rounded-full mb-4 animate-bounce">
                    <GraduationCap className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-3xl font-bold text-SeaGrean dark:text-Orange mb-2">
                    🎉 Registration Successful!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-lg">
                    Welcome to Al Khair IT Institute!
                  </p>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="bg-SeaGrean/10 dark:bg-Orange/10 p-4 rounded-xl">
                    <p className="text-gray-700 dark:text-gray-200">
                      Your account has been created successfully. You can now access your LMS dashboard to view course materials, schedules, and more!
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      // Redirect to LMS on port 3001
                      console.log("🚀 Redirecting to LMS at http://localhost:3001");
                      window.location.href = "http://localhost:3001";
                    }}
                    className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-SeaGrean to-teal-500 dark:from-Orange dark:to-orange-600 text-white hover:shadow-lg transform hover:scale-105 transition-all font-bold text-lg"
                  >
                    Go to LMS Dashboard 🚀
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Banner Section */}
        <div className="relative h-[450px] overflow-hidden bg-Black">
          <div className="absolute inset-0 bg-tech-pattern bg-cover bg-center opacity-20"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-Black/80 via-Black/60 to-Black"></div>

          <div
            ref={bannerRef}
            className="relative z-10 flex flex-col items-center justify-center h-full px-4 transition-all duration-1000 transform opacity-0 translate-y-10"
          >
            <Sparkles className="w-16 h-16 mb-6 text-SeaGrean animate-float" />
            <h1 className="text-4xl sm:text-5xl md:text-6xl px-4 text-center font-[400] text-cream mb-6 bg-gradient-to-r from-SeaGrean to-cream bg-clip-text text-transparent animate-pulse">
              Join Our Community
            </h1>
            <div className="w-24 h-1 bg-Orange mb-8"></div>
            <p className="text-xl md:text-2xl text-cream/80 max-w-3xl text-center">
              Start your learning journey with us today
            </p>
          </div>
        </div>

        {/* Registration Form Section */}
        <section className="relative -mt-20 pb-16 bg-transparent z-10">
          <div className="max-w-6xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-Blue/20 p-8 rounded-3xl shadow-lg 
              transition-all duration-500 group hover:shadow-2xl 
              border-2 border-transparent hover:border-SeaGrean dark:hover:border-Orange
              backdrop-blur-lg max-w-3xl mx-auto"
            >
              <motion.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-[400] mb-8 text-SeaGrean dark:text-cream hover:text-Blue dark:hover:text-Orange transition-colors duration-300 text-center"
              >
                Register for a Course
              </motion.h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Display validation errors at the top of the form */}
                {Object.keys(rjxErrors).length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 p-4 rounded-xl">
                    <h4 className="text-red-600 dark:text-red-400 font-medium mb-2">Please fix the following errors:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {Object.values(rjxErrors).map((error, index) => (
                        <li key={index} className="text-red-500 dark:text-red-400 text-sm">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentStep === 1 && (
                  <div className="flex justify-between items-center mb-4">
                    <a
                      href="https://lms.iak.ngo/login"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-SeaGrean dark:text-Orange hover:underline flex items-center gap-1"
                    >
                      LMS Login
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowLookupModal(true)}
                      className="text-sm font-medium text-SeaGrean dark:text-Orange hover:underline flex items-center gap-1"
                    >
                      <Search className="w-4 h-4" />
                      Already passed the test? Resume Registration
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  {currentStep === 1 && (
                    <>
                      {/* Full Name Input */}
                      <div className="relative">
                        <UserPlus className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                        <input
                          type="text"
                          name="full_name"
                          placeholder="Full Name"
                          value={formData.full_name}
                          onChange={handleChange}
                          className={`w-full pl-12 pr-4 py-3 rounded-2xl border-2 ${rjxErrors.full_name ? 'border-red-500 dark:border-red-500' : 'border-gray-200 dark:border-Blue/40'
                            } dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                          transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange`}
                          required
                        />
                        {rjxErrors.full_name && (
                          <p className="text-red-500 text-xs mt-1">{rjxErrors.full_name}</p>
                        )}
                      </div>

                      {/* Phone Input */}
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                        <input
                          type="text"
                          name="phone"
                          placeholder="Phone Number"
                          value={formData.phone || ''}
                          onChange={handleChange}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                          dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                          transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                          required
                          inputMode="numeric"
                          pattern="\d*"
                        />
                      </div>

                      {/* Email Input */}
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                        <input
                          type="email"
                          name="email"
                          placeholder="Email Address"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                          dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                          transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                          required
                        />
                      </div>


                      {/* 🔹 Multi-Tenancy: Organization Select */}
                      {organizations.length > 0 && (
                        <div className="relative">
                          <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                          <select
                            value={selectedOrgId}
                            onChange={(e) => setSelectedOrgId(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                            dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                            transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange appearance-none"
                            required
                          >
                            <option value="">-- Select an Organization --</option>
                            {organizations.map((org: any) => (
                              <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* 🔹 Multi-Tenancy: Campus Select */}
                      {selectedOrgId && campuses.length > 0 && (
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                          <select
                            value={selectedCampusId}
                            onChange={(e) => setSelectedCampusId(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                            dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                            transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange appearance-none"
                          >
                            <option value="">-- Select a Campus (Optional) --</option>
                            {campuses.map((campus: any) => (
                              <option key={campus.id} value={campus.id}>{campus.campus_name} ({campus.campus_code})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Specialization Select */}
                      <div className="relative">
                        <BookOpen className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                        <select
                          value={selectedSpecialization}
                          onChange={(e) => setSelectedSpecialization(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                          dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                          transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange appearance-none"
                          required
                        >
                          <option value="">-- Select a Specialization --</option>
                          {specializations.map((spec) => (
                            <option key={spec.id} value={spec.id}>{spec.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Course Select */}
                      {selectedSpecialization && (
                        <div className="relative">
                          <GraduationCap className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                          <select
                            name="course"
                            value={formData.course}
                            onChange={handleChange}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                            dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                            transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange appearance-none"
                            required
                          >
                            <option value="">-- Select a Course --</option>
                            {filteredCourses.length > 0 ? (
                              filteredCourses.map((course) => {
                                const status = String(course.admission_status || '').toLowerCase();
                                const label = status === 'open' ? course.name : `${course.name} (${status.replace('_', ' ')})`;
                                return <option key={course.id} value={course.id}>{label}</option>;
                              })
                            ) : (
                              <option value="" disabled>No courses available for this selection</option>
                            )}
                          </select>
                        </div>
                      )}

                      {/* Session / Time Slot Select */}
                      {formData.course && (
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                          <select
                            value={selectedSession}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedSession(val);
                              const s = sessions.find(s => s.id === val);
                              if (s?.branch_id) setBranchId(s.branch_id);
                            }}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40
                            dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent
                            transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange appearance-none"
                            required
                          >
                            <option value="">-- Select a Session / Time Slot --</option>
                            {sessions
                              .filter((s: any) => {
                                // --- CRITICAL ADMISSION & CAPACITY CHECKS ---
                                // 1. Must be Active and have at least 1 Seat available
                                if (!s.active || Number(s.seats_available || 0) <= 0) return false;
                                
                                const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
                                
                                // 2. Must be within the Admission Window (on or after open date)
                                if (s.admission_open_date && todayStr < s.admission_open_date) return false;
                                
                                // 3. Must be BEFORE the Course Start Date (registration closes when classes begin)
                                if (s.course_start_date && todayStr >= s.course_start_date) return false;
                                
                                return true;
                              })
                              .map((session: any) => (
                                <option key={session.id} value={session.id}>
                                  {session.label || session.section_name}
                                  {session.branch_name ? ` | ${session.branch_name}` : ''}
                                  ({session.seats_available} seats remaining)
                                </option>
                              ))}
                            {sessions.filter((s: any) => {
                                if (!s.active || Number(s.seats_available || 0) <= 0) return false;
                                const todayStr = new Date().toLocaleDateString('en-CA');
                                if (s.admission_open_date && todayStr < s.admission_open_date) return false;
                                if (s.course_start_date && todayStr >= s.course_start_date) return false;
                                return true;
                            }).length === 0 && (
                              <option value="" disabled className="text-red-500 font-bold">
                                ⚠️ ALL ADMISSIONS FULL / CLOSED FOR THIS COURSE
                              </option>
                            )}
                          </select>
                          {rjxErrors.session && (
                            <p className="text-red-500 text-xs mt-1">{rjxErrors.session}</p>
                          )}
                          {branchId && selectedSession && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              Branch: {sessions.find(s => s.id === selectedSession)?.branch_name || 'Selected'}
                            </p>
                          )}
                        </div>
                      )}

                      {/* --- Added Fields Start --- */}
                      <div className="pt-6 border-t border-gray-100 dark:border-white/5 space-y-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-cream flex items-center gap-2">
                          <UserPlus className="w-5 h-5 text-SeaGrean" />
                          Personal & Guardian Details
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Gender Select */}
                          <div className="relative">
                            <Users className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                            <select
                              name="gender"
                              value={formData.gender}
                              onChange={handleChange}
                              className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                              dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                              transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange appearance-none"
                              required
                            >
                              <option value="">-- Gender --</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </select>
                          </div>

                          {/* Date of Birth (In Personal Info) */}
                          <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                            <input
                              type="date"
                              name="date_of_birth"
                              placeholder="Date of Birth"
                              value={formData.date_of_birth}
                              onChange={handleChange}
                              max={new Date().toISOString().split('T')[0]}
                              className={`w-full pl-12 pr-4 py-3 rounded-2xl border-2 ${rjxErrors.date_of_birth ? 'border-red-500' : 'border-gray-200'} dark:border-Blue/40 
                              dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                              transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange`}
                              required
                            />
                            {rjxErrors.date_of_birth && (
                              <p className="text-red-500 text-xs mt-1">{rjxErrors.date_of_birth}</p>
                            )}
                          </div>

                          {/* WhatsApp Number */}
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                            <input
                              type="text"
                              name="whatsapp_number"
                              placeholder="WhatsApp Number"
                              value={formData.whatsapp_number}
                              onChange={handleChange}
                              className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                              dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                              transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                              required
                              inputMode="numeric"
                              pattern="\d*"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Father/Guardian Name */}
                          <div className="relative">
                            <Users className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                            <input
                              type="text"
                              name="father_guardian_name"
                              placeholder="Father/Guardian Name"
                              value={formData.father_guardian_name}
                              onChange={handleChange}
                              className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                              dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                              transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                              required
                            />
                          </div>

                          {/* Relationship */}
                          <div className="relative">
                            <Users className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                            <input
                              type="text"
                              name="relationship_to_student"
                              placeholder="Relationship (e.g. Father)"
                              value={formData.relationship_to_student}
                              onChange={handleChange}
                              className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                              dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                              transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                              required
                            />
                          </div>
                        </div>

                        {/* Guardian Contact */}
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                          <input
                            type="text"
                            name="guardian_contact"
                            placeholder="Guardian Contact Number"
                            value={formData.guardian_contact}
                            onChange={handleChange}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                            dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                            transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                            required
                            inputMode="numeric"
                            pattern="\d*"
                          />
                        </div>

                        {/* Full Address */}
                        <div className="relative">
                          <MapPin className="absolute left-4 top-4 h-5 w-5 text-SeaGrean dark:text-Orange" />
                          <textarea
                            name="full_address"
                            placeholder="Full Residential Address"
                            value={formData.full_address}
                            onChange={handleChange}
                            rows={2}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                            dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                            transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                            required
                          />
                        </div>

                        <h3 className="text-lg font-medium text-gray-900 dark:text-cream flex items-center gap-2 pt-4">
                          <GraduationCap className="w-5 h-5 text-SeaGrean" />
                          Education & Work History
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Qualification */}
                          <div className="relative">
                            <BookOpen className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                            <select
                              name="last_qualification"
                              value={formData.last_qualification}
                              onChange={handleChange}
                              className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                              dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                              transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange appearance-none"
                              required
                            >
                              <option value="">-- Last Qualification --</option>
                              <option value="matric">Matric / O-Level</option>
                              <option value="intermediate">Intermediate / A-Level</option>
                              <option value="bachelor">Bachelor&apos;s</option>
                              <option value="master">Master&apos;s</option>
                              <option value="other">Other</option>
                            </select>
                          </div>

                          {/* Study/Work Status */}
                          <div className="relative">
                            <Briefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                            <select
                              name="study_work_status"
                              value={formData.study_work_status}
                              onChange={handleChange}
                              className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                              dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                              transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange appearance-none"
                              required
                            >
                              <option value="">-- Currently Studying/Working? --</option>
                              <option value="studying">Studying</option>
                              <option value="working">Working</option>
                              <option value="both">Both</option>
                              <option value="none">Neither</option>
                            </select>
                          </div>
                        </div>

                        {/* Study/Work Details */}
                        <div className="relative">
                          <Briefcase className="absolute left-4 top-4 h-5 w-5 text-SeaGrean dark:text-Orange" />
                          <textarea
                            name="study_work_details"
                            placeholder="Details of current study or work"
                            value={formData.study_work_details}
                            onChange={handleChange}
                            rows={2}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                            dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                            transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                          />
                        </div>

                        {/* Idara History */}
                        <div className="space-y-3 bg-gray-50 dark:bg-white/5 p-4 rounded-2xl">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              name="studied_at_idara"
                              checked={formData.studied_at_idara}
                              onChange={handleChange}
                              className="w-5 h-5 rounded border-gray-300 text-SeaGrean focus:ring-SeaGrean"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Have you ever studied at Idara Al-Khair?</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              name="studying_at_idara"
                              checked={formData.studying_at_idara}
                              onChange={handleChange}
                              className="w-5 h-5 rounded border-gray-300 text-SeaGrean focus:ring-SeaGrean"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Are you currently studying at Idara Al-Khair?</span>
                          </label>
                        </div>

                        {/* Terms & Signature */}
                        <div className="pt-4 space-y-4">
                          <div className="relative">
                            <Signature className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                            <input
                              type="text"
                              name="signature"
                              placeholder="Signature (Type your full name)"
                              value={formData.signature}
                              onChange={handleChange}
                              className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                              dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                              transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                              required
                            />
                          </div>

                          <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="pt-1">
                              <input
                                type="checkbox"
                                name="is_terms_agreed"
                                checked={formData.is_terms_agreed}
                                onChange={handleChange}
                                className="w-5 h-5 rounded border-gray-300 text-SeaGrean focus:ring-SeaGrean"
                                required
                              />
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              I agree to the <Link href="/terms" className="text-SeaGrean hover:underline">Terms & Conditions</Link> and certify that all provided information is accurate.
                            </span>
                          </label>
                        </div>
                      </div>
                      {/* --- Added Fields End --- */}

                      {!testRequired && formData.course && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-2xl overflow-hidden"
                        >
                          <p className="text-green-700 dark:text-green-300 text-sm">
                             ✨ <strong>Direct Admission:</strong> No entrance test needed. Go straight to deposit and registration.
                          </p>
                        </motion.div>
                      )}
                    </>
                  )}

                  {currentStep === 3 && (
                    <>
                      {!testRequired && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 p-6 rounded-2xl mb-6">
                          <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                            <AlertCircle className="w-6 h-6" />
                            Direct Admission: Next Steps
                          </h3>
                          <div className="text-left space-y-2 text-sm text-blue-800 dark:text-blue-200">
                             <p className="font-bold">📝 Follow these steps (check your email for details):</p>
                            <ol className="list-decimal list-inside space-y-1 ml-2">
                              <li>Pay the security deposit at our office or bank account</li>
                              <li>Obtain the deposit slip with a unique <strong>Receipt Code</strong></li>
                              <li>Enter that code below along with your details to create your LMS account</li>
                            </ol>
                             <p className="mt-3 bg-blue-100/50 dark:bg-blue-900/30 p-2 rounded-lg text-xs italic">
                               * These instructions have been emailed to you.
                             </p>
                          </div>
                        </div>
                      )}

                      {/* Dynamic Profile Completion (Shows if data is missing or validation failed in Step 3) */}
                      {(Object.keys(rjxErrors).some(k => ['gender', 'whatsapp_number', 'date_of_birth', 'signature', 'is_terms_agreed'].includes(k)) || 
                        !formData.gender || !formData.whatsapp_number || !formData.date_of_birth || !formData.signature) && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-800 p-6 rounded-[32px] space-y-6 mb-8 animate-in slide-in-from-top-4 duration-500">
                          <h4 className="text-amber-800 dark:text-amber-300 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                             <AlertCircle className="w-5 h-5" /> Complete Missing Profile Details
                          </h4>
                           <p className="text-[11px] text-amber-700/60 dark:text-amber-400/60 uppercase font-bold tracking-tight">Some details are missing from your saved registration. Please fill them in to continue.</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {!formData.gender && (
                               <div className="relative">
                                 <Users className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-amber-600" />
                                 <select 
                                   name="gender" 
                                   value={formData.gender} 
                                   onChange={handleChange} 
                                   className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-amber-200 bg-white dark:bg-Black/50 focus:ring-2 focus:ring-amber-500 appearance-none text-sm font-bold uppercase"
                                 >
                                    <option value="">-- Gender --</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                 </select>
                               </div>
                             )}

                             {!formData.whatsapp_number && (
                               <div className="relative">
                                 <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-amber-600" />
                                 <input 
                                   type="text" 
                                   name="whatsapp_number" 
                                   placeholder="WhatsApp Number" 
                                   value={formData.whatsapp_number} 
                                   onChange={handleChange} 
                                   className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-amber-200 bg-white dark:bg-Black/50 focus:ring-2 focus:ring-amber-500 text-sm font-bold uppercase"
                                 />
                               </div>
                             )}

                             {!formData.date_of_birth && (
                               <div className="relative md:col-span-2">
                                 <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-amber-600" />
                                 <input 
                                   type="date" 
                                   name="date_of_birth" 
                                   value={formData.date_of_birth} 
                                   onChange={handleChange} 
                                   className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-amber-200 bg-white dark:bg-Black/50 focus:ring-2 focus:ring-amber-500 text-sm font-bold uppercase"
                                 />
                               </div>
                             )}

                             {!formData.signature && (
                               <div className="relative md:col-span-2">
                                 <Signature className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-amber-600" />
                                 <input 
                                   type="text" 
                                   name="signature" 
                                   placeholder="Final Signature (Type Full Name)" 
                                   value={formData.signature} 
                                   onChange={handleChange} 
                                   className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-amber-200 bg-white dark:bg-Black/50 focus:ring-2 focus:ring-amber-500 text-sm font-bold uppercase"
                                 />
                               </div>
                             )}

                             {!formData.is_terms_agreed && (
                               <label className="flex items-start gap-3 cursor-pointer group md:col-span-2 p-4 bg-white/50 rounded-2xl border border-amber-100 mt-2">
                                 <div className="pt-1">
                                   <input
                                     type="checkbox"
                                     name="is_terms_agreed"
                                     checked={formData.is_terms_agreed}
                                     onChange={handleChange}
                                     className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                                     required
                                   />
                                 </div>
                                 <span className="text-xs text-amber-800 font-black uppercase tracking-tight"> I agree to the <Link href="/terms" className="underline">Terms & Conditions</Link>.</span>
                               </label>
                             )}
                          </div>
                        </div>
                      )}

                      {/* Deposit Slip Code Input */}
                      <div className="relative">
                        <UserPlus className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                        <input
                          type="text"
                          name="receipt_code"
                          placeholder="Deposit Slip Code (e.g. 12345)"
                          value={formData.receipt_code}
                          onChange={handleChange}
                          className={`w-full pl-12 pr-4 py-3 rounded-2xl border-2 ${rjxErrors.receipt_code ? 'border-red-500' : 'border-gray-200'} dark:border-Blue/40 
                          dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                          transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange`}
                          required
                        />
                        {rjxErrors.receipt_code && (
                          <p className="text-red-500 text-xs mt-1">{rjxErrors.receipt_code}</p>
                        )}
                      </div>

                      {/* CNIC Input */}
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                        <input
                          type="text"
                          name="cnic"
                          placeholder="CNIC Number"
                          value={formData.cnic || ""}
                          onChange={handleChange}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                          dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                          transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                          required
                          inputMode="numeric"
                          pattern="\d*"
                        />
                      </div>

                      {/* Password Input */}
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                        <input
                          type="password"
                          name="password"
                          placeholder="Password"
                          value={formData.password}
                          onChange={handleChange}
                          className={`w-full pl-12 pr-4 py-3 rounded-2xl border-2 ${rjxErrors.password ? 'border-red-500' : 'border-gray-200'} dark:border-Blue/40 
                          dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                          transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange`}
                          required
                        />
                        {rjxErrors.password && (
                          <p className="text-red-500 text-xs mt-1">{rjxErrors.password}</p>
                        )}
                      </div>

                      {/* Confirm Password Input */}
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-SeaGrean dark:text-Orange" />
                        <input
                          type="password"
                          name="confirm_password"
                          placeholder="Confirm Password"
                          value={formData.confirm_password}
                          onChange={handleChange}
                          className={`w-full pl-12 pr-4 py-3 rounded-2xl border-2 ${rjxErrors.confirm_password ? 'border-red-500' : 'border-gray-200'} dark:border-Blue/40 
                          dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                          transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange`}
                          required
                        />
                        {rjxErrors.confirm_password && (
                          <p className="text-red-500 text-xs mt-1">{rjxErrors.confirm_password}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 rounded-2xl relative overflow-hidden group
                  transform hover:scale-[1.02] active:scale-95 transition-all duration-300"
                >
                  <span className="absolute inset-0 bg-SeaGrean dark:bg-Orange transition-all duration-300 
                  transform origin-left group-hover:scale-x-100 scale-x-0"></span>
                  <span className="relative flex items-center justify-center text-SeaGrean group-hover:text-cream dark:text-cream font-medium">
                    <UserPlus className="mr-2 h-5 w-5" />
                    {currentStep === 1
                      ? (testRequired ? "Start Entrance Test" : "Direct Admission / Registration")
                      : "Complete Registration"
                    }
                  </span>
                </button>
              </form>
            </motion.div>
          </div>
        </section>
      </div >
      <AnimatePresence>
        {errorModel && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-Black/50 backdrop-blur-sm"
          >
            <div className="bg-cream dark:bg-Blue p-8 rounded-2xl shadow-2xl max-w-md mx-4 text-center transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-2xl font-[400] text-SeaGrean dark:text-Orange mb-4">
                Error
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {errorModel}
              </p>
              <button
                onClick={() => setErrorModel(null)}
                className="px-4 py-2 bg-SeaGrean dark:bg-Orange text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer />
    </div >


  );
}

export default RegisterPage;

