'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/Button';
import { useRouter } from 'next/navigation';

type Education = {
  id: string;
  degree: string;
  institute: string;
  passingYear: string;
};

type Experience = {
  id: string;
  employer: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  responsibilities: string;
};

const newEducation = (): Education => ({
  id: String(Date.now() + Math.random()),
  degree: '',
  institute: '',
  passingYear: '',
});

const newExperience = (): Experience => ({
  id: String(Date.now() + Math.random()),
  employer: '',
  jobTitle: '',
  startDate: '',
  endDate: '',
  responsibilities: '',
});

const EmployeeForm: React.FC = () => {
  const router = useRouter();

  // Personal
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [cnic, setCnic] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [nationality, setNationality] = useState('');
  const [religion, setReligion] = useState('');

  // Dropdown data
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [filteredDesignations, setFilteredDesignations] = useState<any[]>([]);

  // Contact
  const [personalEmail, setPersonalEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Employment
  const [institution, setInstitution] = useState('');
  const [branch, setBranch] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [shift, setShift] = useState('morning');

  // Bank
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Provided by org
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPhone, setOrgPhone] = useState('');

  // Education & Experience
  const [education, setEducation] = useState<Education[]>([newEducation()]);
  const [experience, setExperience] = useState<Experience[]>([newExperience()]);

  // Resume
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // Error handling
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /* ------------------------------------------------------------------ */
  /* Fetch departments & designations                                   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const [instRes, branchRes, deptRes, desigRes] = await Promise.all([
          fetch('/api/employees/institutions'),
          fetch('/api/employees/branches'),
          fetch('/api/employees/departments'),
          fetch('/api/employees/designations')
        ]);

        const [insts, brs, depts, desigs] = await Promise.all([
          instRes.json(), branchRes.json(), deptRes.json(), desigRes.json()
        ]);

        setInstitutions(insts);
        setBranches(brs);
        setDepartments(depts);
        setDesignations(desigs);
      } catch (err) {
        console.error('Failed to fetch HRMS base data:', err);
      }
    };

    fetchBaseData();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Filter designations when department changes                         */
  /* ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ */
  /* Hierarchy Filtering Logic                                          */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (institution) {
      setFilteredBranches(branches.filter(b => b.institution_code === institution));
    } else {
      setFilteredBranches([]);
    }
  }, [institution, branches]);

  useEffect(() => {
    if (department) {
      const filtered = designations.filter(
        (d) => d.department__dept_code === department
      );
      setFilteredDesignations(filtered);
    } else {
      setFilteredDesignations([]);
    }
  }, [department, designations]);

  /* ------------------------------------------------------------------ */
  /* Input Formatting Helpers                                           */
  /* ------------------------------------------------------------------ */
  const formatCNIC = (value: string) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');
    // Limit to 13 digits
    const limited = cleaned.substring(0, 13);
    // Format as XXXXX-XXXXXXX-X
    if (limited.length > 12) {
      return `${limited.slice(0, 5)}-${limited.slice(5, 12)}-${limited.slice(12)}`;
    } else if (limited.length > 5) {
      return `${limited.slice(0, 5)}-${limited.slice(5)}`;
    }
    return limited;
  };

  const formatPhone = (value: string) => {
    // Remove all non-digits and + sign
    let cleaned = value.replace(/[^\d+]/g, '');
    // Limit to reasonable phone length (e.g., +92-XXX-XXXXXXX = 15 chars)
    return cleaned.substring(0, 15);
  };

  const handleCNICChange = (value: string) => {
    const formatted = formatCNIC(value);
    setCnic(formatted);
    clearFieldError('cnic');
  };

  const handleMobileChange = (value: string) => {
    const formatted = formatPhone(value);
    setMobile(formatted);
    clearFieldError('mobile');
  };

  const handleEmergencyPhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setEmergencyPhone(formatted);
  };

  const handleOrgPhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setOrgPhone(formatted);
  };

  const handleAccountNumberChange = (value: string) => {
    // Only allow numbers for account number
    const cleaned = value.replace(/\D/g, '');
    setAccountNumber(cleaned.substring(0, 25)); // Limit to 25 digits
    clearFieldError('accountNumber');
  };

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */
  const addEducation = () => setEducation((prev) => [...prev, newEducation()]);
  const removeEducation = (id: string) =>
    setEducation((prev) => prev.filter((e) => e.id !== id));

  const addExperience = () =>
    setExperience((prev) => [...prev, newExperience()]);
  const removeExperience = (id: string) =>
    setExperience((prev) => prev.filter((e) => e.id !== id));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setResumeFile(file);
  };

  const clearFieldError = (fieldName: string) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  };

  const validate = () => {
    if (!fullName.trim()) return 'Full name is required';
    if (!personalEmail.trim()) return 'Personal email is required';
    if (!mobile.trim()) return 'Mobile number is required';
    if (!residentialAddress.trim()) return 'Residential address is required';
    if (!bankName.trim() || !accountNumber.trim())
      return 'Bank information is required';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setFieldErrors({});
    setGeneralError('');

    const err = validate();
    if (err) {
      setGeneralError(err);
      return;
    }

    setIsLoading(true);

    const payload = {
      fullName,
      dob,
      cnic,
      gender,
      nationality,
      religion,
      personalEmail,
      mobile,
      emergencyPhone,
      residentialAddress,
      permanentAddress,
      city,
      state,
      institutionCode: institution,
      branchCode: branch,
      departmentCode: department,
      designationCode: designation,
      dateOfJoining: dateOfJoining || new Date().toISOString().slice(0, 10),
      employmentType,
      shift,
      bankName,
      accountNumber,
      orgEmail,
      orgPhone,
      education,
      experience,
    };

    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle field-level errors
        if (data.field_errors) {
          setFieldErrors(data.field_errors);
          setGeneralError(data.error || 'Please fix the validation errors below');
        } else {
          setGeneralError(data.error || 'Failed to create employee');
        }
        setIsLoading(false);
        return;
      }

      // Success!
      alert(
        `✅ Employee created successfully!\n\nEmployee ID: ${data.employee_id}\nEmployee Code: ${data.employee_code}`
      );
      router.push('/admin/employees');

    } catch (error) {
      console.error('Error:', error);
      setGeneralError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Helper to get field error class                                    */
  /* ------------------------------------------------------------------ */
  const getFieldClass = (fieldName: string) => {
    const baseClass = "w-full px-4 py-2 border rounded-lg";
    return fieldErrors[fieldName]
      ? `${baseClass} border-red-500 focus:border-red-500 focus:ring-red-500`
      : baseClass;
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Back
          </Button>
          <h2 className="text-2xl font-bold">Create Employee</h2>
        </div>
      </div>

      {/* General Error Display */}
      {generalError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <span className="text-red-600 font-semibold">⚠️ {generalError}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name *</label>
              <input
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  clearFieldError('fullName');
                }}
                className={getFieldClass('fullName')}
                required
                disabled={isLoading}
              />
              {fieldErrors.fullName && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.fullName[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => {
                  setDob(e.target.value);
                  clearFieldError('dob');
                }}
                className={getFieldClass('dob')}
                disabled={isLoading}
              />
              {fieldErrors.dob && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.dob[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">CNIC (13 digits)</label>
              <input
                value={cnic}
                onChange={(e) => handleCNICChange(e.target.value)}
                placeholder="12345-1234567-1"
                className={getFieldClass('cnic')}
                disabled={isLoading}
                maxLength={15}
              />
              {fieldErrors.cnic && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.cnic[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className={getFieldClass('gender')}
                disabled={isLoading}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nationality</label>
              <input
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className={getFieldClass('nationality')}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Religion</label>
              <input
                value={religion}
                onChange={(e) => setReligion(e.target.value)}
                className={getFieldClass('religion')}
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Personal Email *</label>
                <input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => {
                    setPersonalEmail(e.target.value);
                    clearFieldError('personalEmail');
                  }}
                  className={getFieldClass('personalEmail')}
                  required
                  disabled={isLoading}
                />
                {fieldErrors.personalEmail && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.personalEmail[0]}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mobile Number *</label>
                <input
                  value={mobile}
                  onChange={(e) => handleMobileChange(e.target.value)}
                  placeholder="+92-XXX-XXXXXXX"
                  className={getFieldClass('mobile')}
                  required
                  disabled={isLoading}
                />
                {fieldErrors.mobile && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.mobile[0]}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Emergency Phone</label>
                <input
                  value={emergencyPhone}
                  onChange={(e) => handleEmergencyPhoneChange(e.target.value)}
                  className={getFieldClass('emergencyPhone')}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Residential Address *</label>
              <input
                value={residentialAddress}
                onChange={(e) => {
                  setResidentialAddress(e.target.value);
                  clearFieldError('residentialAddress');
                }}
                className={getFieldClass('residentialAddress')}
                required
                disabled={isLoading}
              />
              {fieldErrors.residentialAddress && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.residentialAddress[0]}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Permanent Address</label>
                <input
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  className={getFieldClass('permanentAddress')}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={getFieldClass('city')}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={getFieldClass('state')}
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employment Details */}
        <Card>
          <CardHeader>
            <CardTitle>Employment Details (Hierarchy)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Institution *</label>
                <select
                  value={institution}
                  onChange={(e) => {
                    setInstitution(e.target.value);
                    setBranch(''); // Reset child
                    clearFieldError('institutionCode');
                  }}
                  className={getFieldClass('institutionCode')}
                  required
                  disabled={isLoading}
                >
                  <option value="">Select Institution</option>
                  {institutions.map((inst) => (
                    <option key={inst.inst_code} value={inst.inst_code}>
                      {inst.inst_code} - {inst.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Branch / Campus *</label>
                <select
                  value={branch}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    clearFieldError('branchCode');
                  }}
                  className={getFieldClass('branchCode')}
                  required
                  disabled={!institution || isLoading}
                >
                  <option value="">Select Branch</option>
                  {filteredBranches.map((br) => (
                    <option key={br.branch_code} value={br.branch_code}>
                      {br.branch_code} - {br.branch_name}
                    </option>
                  ))}
                </select>
                {!institution && (
                  <p className="text-sm text-gray-500 mt-1">Select institution first</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Department *</label>
                <select
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setDesignation(''); // Reset child
                    clearFieldError('department');
                  }}
                  className={getFieldClass('department')}
                  required
                  disabled={isLoading}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.dept_code} value={dept.dept_code}>
                      {dept.dept_code} - {dept.dept_name}
                    </option>
                  ))}
                </select>
                {fieldErrors.department && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.department[0]}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Designation *</label>
                <select
                  value={designation}
                  onChange={(e) => {
                    setDesignation(e.target.value);
                    clearFieldError('designation');
                  }}
                  className={getFieldClass('designation')}
                  required
                  disabled={!department || isLoading}
                >
                  <option value="">Select Designation</option>
                  {filteredDesignations.map((desig) => (
                    <option key={desig.position_code} value={desig.position_code}>
                      {desig.position_code} - {desig.position_name}
                    </option>
                  ))}
                </select>
                {!department && (
                  <p className="text-sm text-gray-500 mt-1">Select department first</p>
                )}
                {fieldErrors.designation && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.designation[0]}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Date of Joining</label>
                <input
                  type="date"
                  value={dateOfJoining}
                  onChange={(e) => {
                    setDateOfJoining(e.target.value);
                    clearFieldError('dateOfJoining');
                  }}
                  className={getFieldClass('dateOfJoining')}
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Shift</label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={isLoading}
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="both">Both (Morning + Afternoon)</option>
                  <option value="night">Night</option>
                  <option value="general">General/Office</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Employment Type</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={isLoading}
                >
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                  <option>Intern</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Information */}
        <Card>
          <CardHeader>
            <CardTitle>Bank Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Bank Name *</label>
                <input
                  value={bankName}
                  onChange={(e) => {
                    setBankName(e.target.value);
                    clearFieldError('bankName');
                  }}
                  className={getFieldClass('bankName')}
                  required
                  disabled={isLoading}
                />
                {fieldErrors.bankName && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.bankName[0]}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Account Number * (Numbers only)</label>
                <input
                  value={accountNumber}
                  onChange={(e) => handleAccountNumberChange(e.target.value)}
                  className={getFieldClass('accountNumber')}
                  required
                  disabled={isLoading}
                  placeholder="Enter numbers only"
                />
                {fieldErrors.accountNumber && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.accountNumber[0]}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provided By Organization */}
        <Card>
          <CardHeader>
            <CardTitle>Provided By Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className=" text-sm font-medium mb-1">Phone Number</label>
                <input
                  value={orgPhone}
                  onChange={(e) => handleOrgPhoneChange(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Educational History */}
        <Card>
          <CardHeader>
            <CardTitle>Educational History</CardTitle>
          </CardHeader>
          <CardContent>
            {education.map((edu, idx) => (
              <div key={edu.id} className="border p-5 rounded-lg mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Degree/Certificate</label>
                    <input
                      value={edu.degree}
                      onChange={(e) =>
                        setEducation((prev) =>
                          prev.map((p) => (p.id === edu.id ? { ...p, degree: e.target.value } : p))
                        )
                      }
                      className="w-full px-4 py-2 border rounded-lg"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Institute Name</label>
                    <input
                      value={edu.institute}
                      onChange={(e) =>
                        setEducation((prev) =>
                          prev.map((p) => (p.id === edu.id ? { ...p, institute: e.target.value } : p))
                        )
                      }
                      className="w-full px-4 py-2 border rounded-lg"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Passing Year</label>
                    <input
                      value={edu.passingYear}
                      onChange={(e) =>
                        setEducation((prev) =>
                          prev.map((p) => (p.id === edu.id ? { ...p, passingYear: e.target.value } : p))
                        )
                      }
                      className="w-full px-4 py-2 border rounded-lg"
                      disabled={isLoading}
                      maxLength={4}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  {education.length > 1 && (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => removeEducation(edu.id)}
                      disabled={isLoading}
                    >
                      Remove
                    </Button>
                  )}
                  {idx === education.length - 1 && (
                    <Button type="button" onClick={addEducation} disabled={isLoading}>
                      Add Education
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Work Experience */}
        <Card>
          <CardHeader>
            <CardTitle>Work Experience</CardTitle>
          </CardHeader>
          <CardContent>
            {experience.map((exp, idx) => (
              <div key={exp.id} className="border p-5 rounded-lg mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Employer</label>
                    <input
                      value={exp.employer}
                      onChange={(e) =>
                        setExperience((prev) =>
                          prev.map((p) => (p.id === exp.id ? { ...p, employer: e.target.value } : p))
                        )
                      }
                      className="w-full px-4 py-2 border rounded-lg"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Job Title</label>
                    <input
                      value={exp.jobTitle}
                      onChange={(e) =>
                        setExperience((prev) =>
                          prev.map((p) => (p.id === exp.id ? { ...p, jobTitle: e.target.value } : p))
                        )
                      }
                      className="w-full px-4 py-2 border rounded-lg"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Start Date</label>
                    <input
                      type="date"
                      value={exp.startDate}
                      onChange={(e) =>
                        setExperience((prev) =>
                          prev.map((p) => (p.id === exp.id ? { ...p, startDate: e.target.value } : p))
                        )
                      }
                      className="w-full px-4 py-2 border rounded-lg"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm mb-1">End Date</label>
                    <input
                      type="date"
                      value={exp.endDate}
                      onChange={(e) =>
                        setExperience((prev) =>
                          prev.map((p) => (p.id === exp.id ? { ...p, endDate: e.target.value } : p))
                        )
                      }
                      className="w-full px-4 py-2 border rounded-lg"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1">Key Responsibilities</label>
                    <textarea
                      value={exp.responsibilities}
                      onChange={(e) =>
                        setExperience((prev) =>
                          prev.map((p) => (p.id === exp.id ? { ...p, responsibilities: e.target.value } : p))
                        )
                      }
                      rows={4}
                      className="w-full px-4 py-2 border rounded-lg"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  {experience.length > 1 && (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => removeExperience(exp.id)}
                      disabled={isLoading}
                    >
                      Remove
                    </Button>
                  )}
                  {idx === experience.length - 1 && (
                    <Button type="button" onClick={addExperience} disabled={isLoading}>
                      Add Experience
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Resume */}
        <Card>
          <CardHeader>
            <CardTitle>Resume</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={isLoading}
            />
          </CardContent>
        </Card>

        {/* Submit / Cancel */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push('/admin/employees')}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Employee'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EmployeeForm;
