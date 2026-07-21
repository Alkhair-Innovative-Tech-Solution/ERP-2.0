'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Calendar, Clock, Upload, Download, CheckCircle, AlertCircle, X, Sparkles } from 'lucide-react';
import { assignmentAPI, submissionAPI, getFileUrl } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { formatDateTime, cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AssignmentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const user = getStoredUser();
  const [assignment, setAssignment] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submissionText, setSubmissionText] = useState('');

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const assignmentData = await assignmentAPI.getById(id as string);
      setAssignment(assignmentData);

      // Fetch existing submission if any
      if (user) {
        const submissions = await submissionAPI.getAll(id as string, user.id);
        const submissionsList = Array.isArray(submissions) ? submissions : (submissions.results || []);
        if (submissionsList.length > 0) {
          setSubmission(submissionsList[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
      toast.error('Failed to load assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile && !submissionText.trim()) {
      toast.error('Please upload a file or provide submission text');
      return;
    }

    try {
      setSubmitting(true);
      await submissionAPI.submit(id as string, selectedFile, submissionText);
      toast.success('Assignment submitted successfully!');
      setShowSubmitModal(false);
      setSelectedFile(null);
      setSubmissionText('');
      fetchData(); // Refresh to show submission
    } catch (error: any) {
      console.error('Error submitting assignment:', error);
      const errorMessage = error.response?.data?.error || 'Failed to submit assignment';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const isOverdue = assignment?.due_date && new Date(assignment.due_date) < new Date();
  const isSubmitted = !!submission;
  const canSubmit = !isSubmitted && !isOverdue;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Loading details...</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="ui-card text-center py-20 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-slate-300" />
        </div>
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Assignment missing</h2>
        <p className="text-slate-500 mt-2 font-medium">This resource might have been archived or moved.</p>
        <button 
          onClick={() => router.push('/student/assignments')} 
          className="btn-primary mt-8 !px-10 h-14"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 pb-20">
      
      <div className="space-y-4">
        <button
          onClick={() => router.push('/student/assignments')}
          className="group flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-brand-teal transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          Back to Assignments
        </button>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <FileText className="w-7 h-7 text-brand-teal" />
              {assignment.title}
            </h1>
            <p className="text-sm text-slate-400 font-bold mt-1">Assignment details and submission</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weightage</p>
              <p className="text-xl font-black text-slate-900">{assignment.total_marks || 100} MARKS</p>
            </div>
            <div className="w-px h-10 bg-slate-100 mx-2" />
            <div className={cn(
              "px-6 py-3 rounded-2xl border-2 flex flex-col items-center justify-center min-w-[140px]",
              isOverdue ? "bg-red-50 border-red-100 text-red-600" : 
              isSubmitted ? "bg-teal-50 border-teal-100 text-teal-600" : 
              "bg-white border-slate-100 text-slate-900 shadow-sm"
            )}>
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">Status</span>
              <span className="text-xs font-black uppercase tracking-widest">
                {isOverdue ? 'Lapsed' : isSubmitted ? 'Confirmed' : 'Pending'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-8">
          {/* Assignment Details */}
          <div className="ui-card p-8 lg:p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-1.5 h-6 bg-brand-teal rounded-full" />
              <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">Assignment Details</h3>
            </div>
            
            <div className="prose prose-slate max-w-none">
              <p className="text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                {assignment.description}
              </p>
            </div>

            {assignment.instructions && (
              <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-brand-teal" />
                  Technical Instructions
                </h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed whitespace-pre-wrap">
                  {assignment.instructions}
                </p>
              </div>
            )}

            {assignment.attachment_url && (
              <div className="mt-10 pt-10 border-t border-slate-50">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-1">Course Materials</h4>

                {(assignment.attachment_url.toLowerCase().endsWith('.mp4') ||
                  assignment.attachment_url.toLowerCase().endsWith('.webm')) ? (
                    <div className="rounded-[2.5rem] overflow-hidden border-8 border-slate-100 bg-slate-900 aspect-video mb-6 shadow-2xl group relative">
                      <video
                        src={getFileUrl(assignment.attachment_url)}
                        controls
                        className="w-full h-full"
                      />
                    </div>
                  ) : null}

                  <a
                    href={getFileUrl(assignment.attachment_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-5 bg-white border-2 border-slate-100 rounded-3xl group hover:border-brand-teal/20 hover:shadow-xl hover:shadow-brand-teal/5 transition-all"
                  >
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-brand-teal/10 transition-colors">
                      <Download className="w-6 h-6 text-slate-400 group-hover:text-brand-teal transition-all group-hover:scale-110" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 font-black tracking-tight text-lg">Download Materials</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Syllabus & References Included</p>
                    </div>
                  </a>
              </div>
            )}
          </div>

          {/* Submission Section */}
          {!isSubmitted ? (
            <div className="ui-card p-8 lg:p-10 border-l-4 border-brand-orange bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
               
               <div className="relative">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-1.5 h-6 bg-brand-orange rounded-full" />
                    <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">Submit Assignment</h3>
                 </div>

                 <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="space-y-1 text-center md:text-left">
                       <p className="text-sm font-black text-slate-900">Ready to submit?</p>
                       <p className="text-xs text-slate-400 font-medium">Make sure you've checked everything before uploading.</p>
                    </div>
                    <button
                      onClick={() => setShowSubmitModal(true)}
                      disabled={!canSubmit}
                      className="btn-primary !bg-slate-900 hover:!bg-black flex items-center gap-3 !px-8 h-14"
                    >
                      <Upload className="w-4.5 h-4.5 text-brand-teal" />
                      <span className="font-black uppercase tracking-widest">Upload Now</span>
                    </button>
                 </div>
               </div>
            </div>
          ) : (
            <div className="ui-card p-8 lg:p-10 border-l-4 border-emerald-500 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 overflow-hidden relative">
               <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50" />
               
               <div className="relative space-y-10">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                       <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">Submitted</h3>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                       <CheckCircle className="w-3.5 h-3.5" /> Complete
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Submitted On</p>
                          <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                             <Clock className="w-4 h-4 text-emerald-500" />
                             {formatDateTime(submission.submitted_at)}
                          </p>
                       </div>
                       
                       {submission.submitted_file_url && (
                          <div className="space-y-3">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Submitted File</p>
                             <a
                               href={submission.submitted_file_url}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="inline-flex items-center gap-3 px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-600 hover:border-emerald-200 hover:text-emerald-700 transition-all font-bold text-xs"
                             >
                               <Download className="w-4 h-4" />
                               Download File
                             </a>
                          </div>
                       )}
                    </div>

                    <div className="space-y-6">
                       {submission.grade !== null && (
                          <div className="p-6 bg-slate-900 rounded-[2rem] text-white flex items-center justify-between shadow-2xl shadow-slate-900/20 group hover:scale-[1.02] transition-transform">
                             <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Grade Received</p>
                                <div className="flex items-baseline gap-1">
                                   <span className="text-3xl font-black text-brand-teal">{submission.grade}</span>
                                   <span className="text-slate-500 text-sm font-bold">/ {assignment.total_marks}</span>
                                </div>
                             </div>
                             <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-brand-teal/30 transition-colors">
                                <span className="text-2xl font-black text-brand-teal">
                                   {Math.round((submission.grade / assignment.total_marks) * 100)}%
                                </span>
                             </div>
                          </div>
                       )}

                       {submission.status && (
                          <div className="space-y-1">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                             <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                {submission.status}
                             </span>
                          </div>
                       )}
                    </div>
                 </div>

                 {submission.submission_text && (
                   <div className="space-y-2">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Additional Notes</p>
                     <p className="text-sm text-slate-500 font-medium leading-relaxed bg-slate-50/50 p-6 rounded-3xl border border-slate-50">
                       {submission.submission_text}
                     </p>
                   </div>
                 )}

                 {submission.feedback && (
                   <div className="p-8 bg-brand-teal/5 rounded-[2.5rem] border border-brand-teal/10 relative group">
                     <div className="absolute top-6 left-6 w-3 h-3 bg-brand-teal rounded-full animate-pulse" />
                     <div className="pl-6 space-y-3">
                        <h4 className="text-[10px] font-black text-brand-teal uppercase tracking-[0.3em]">Instructor Feedback</h4>
                        <p className="text-slate-700 text-sm font-semibold leading-relaxed italic">
                          "{submission.feedback}"
                        </p>
                     </div>
                   </div>
                 )}
               </div>
            </div>
          )}
        </div>

        {/* â”€â”€ Sidebar â”€â”€ */}
        <div className="lg:col-span-4 space-y-6">
          <div className="ui-card p-6 bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 border-b-4 border-slate-100 border">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 px-1">Assignment Info</h3>
            
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Deadline</span>
                 </div>
                 <span className="text-xs font-black text-slate-900">{formatDateTime(assignment.due_date)}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-2xl">
                 <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Type</span>
                 </div>
                 <span className="text-xs font-black text-slate-900 uppercase tracking-widest">{assignment.assignment_type || 'CORE'}</span>
              </div>
            </div>
          </div>

          <div className="ui-card p-8 bg-slate-900 rounded-[2.5rem] border-none relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/10 rounded-full blur-3xl opacity-50" />
             <div className="relative space-y-4">
                <Sparkles className="w-8 h-8 text-brand-teal mb-2" />
                <h4 className="text-lg font-black text-white leading-tight tracking-tight">Submit Your Work.</h4>
                <p className="text-xs text-slate-400 font-medium leading-relaxed uppercase tracking-wider">
                   Upload your assignment to complete this task.
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Submit Modal â”€â”€ */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[0_30px_100px_rgba(0,0,0,0.2)] scrollbar-hide border border-slate-200 scale-in-center animate-in zoom-in-95 duration-300">
            <div className="p-10 lg:p-12">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                   <div className="w-1.5 h-8 bg-brand-teal rounded-full" />
                   <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Submit Assignment</h2>
                </div>
                <button
                  onClick={() => {
                    setShowSubmitModal(false);
                    setSelectedFile(null);
                    setSubmissionText('');
                  }}
                  className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400 hover:text-slate-900 group"
                >
                  <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                </button>
              </div>

              <div className="space-y-10">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">
                    Assignment File <span className="text-brand-orange ml-1">*</span>
                  </label>
                  <div className={cn(
                    "relative border-4 border-dashed rounded-[2.5rem] p-12 text-center transition-all duration-300 group",
                    selectedFile ? "bg-teal-50/50 border-brand-teal/30" : "bg-slate-50 border-slate-200 hover:bg-slate-100/50 hover:border-brand-teal/20"
                  )}>
                    <input
                      type="file"
                      id="file-upload"
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip,.mp4,.webm,.ppt,.pptx,.xls,.xlsx"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer block space-y-6">
                      <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                         <Upload className={cn("w-10 h-10 transition-colors", selectedFile ? "text-brand-teal" : "text-slate-300")} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-base font-black text-slate-900 uppercase tracking-tight text-center">
                          {selectedFile ? selectedFile.name : 'Upload File'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] text-center">
                           Click or drag to upload
                        </p>
                      </div>
                      <div className="pt-2">
                         <span className="text-[9px] font-black text-slate-400 bg-white px-4 py-1.5 rounded-full border border-slate-200 uppercase tracking-widest">
                           PDF, DOC, ZIP (Max 10MB)
                         </span>
                      </div>
                    </label>
                  </div>
                  {selectedFile && (
                    <div className="flex items-center gap-3 px-6 py-3 bg-brand-teal/5 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                      <FileText className="w-4 h-4 text-brand-teal" />
                      <span className="text-[11px] font-black text-slate-700 truncate">{selectedFile.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold ml-auto uppercase tracking-widest">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">
                    Your Notes (Optional)
                  </label>
                  <textarea
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    placeholder="Add any notes about your submission here..."
                    className="w-full h-40 resize-none bg-slate-50 border-2 border-transparent rounded-[2rem] focus:outline-none focus:bg-white focus:border-brand-teal/20 focus:ring-4 focus:ring-brand-teal/5 transition-all p-6 text-sm font-medium text-slate-600 placeholder:text-slate-300"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <button
                    onClick={handleSubmit}
                    disabled={!selectedFile || submitting}
                    className="btn-primary !py-6 flex-1 flex items-center justify-center gap-4 group"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="animate-spin w-5 h-5" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                        <span className="font-black uppercase tracking-[0.2em]">Submit</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowSubmitModal(false);
                      setSelectedFile(null);
                      setSubmissionText('');
                    }}
                    className="flex-1 px-8 py-6 rounded-3xl border-2 border-slate-100 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 transition-all"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

