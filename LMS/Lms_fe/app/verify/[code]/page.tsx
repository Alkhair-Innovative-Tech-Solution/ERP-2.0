'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Award, Download, Calendar, User, BookOpen, RefreshCw } from 'lucide-react';
import { certificateAPI } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

function VerifyCertificateContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const exportTemplateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    verifyCertificate();
  }, [params.code, searchParams]);

  const verifyCertificate = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const verificationCode = params.code as string;
      const studentId = searchParams.get('student_id');
      const courseCode = searchParams.get('course_code');
      
      let result;
      if (verificationCode) {
        result = await certificateAPI.verify(verificationCode);
      } else if (studentId && courseCode) {
        result = await certificateAPI.verify(undefined, parseInt(studentId), courseCode);
      } else {
        setError('Please provide a verification code or student ID + course code');
        return;
      }
      
      if (result.verified) {
        setVerificationResult(result.certificate);
      } else {
        setError(result.error || 'Certificate not found');
      }
    } catch (error: any) {
      console.error('Error verifying certificate:', error);
      setError(error.response?.data?.error || 'Failed to verify certificate');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!exportTemplateRef.current) return;
    
    try {
        setIsGenerating(true);
        toast.loading('Preparing official PDF...', { id: 'verify-pdf' });
        
        const canvas = await html2canvas(exportTemplateRef.current, {
            scale: 4,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [800, 566]
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, 800, 566);
        pdf.save(`AIT-Official-${verificationResult.certificate_number}.pdf`);
        
        toast.success('Official PDF downloaded!', { id: 'verify-pdf' });
    } catch (error) {
        toast.error('Export failed');
        console.error(error);
    } finally {
        setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying certificate...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {error ? (
          <div className="moodle-card text-center py-12">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        ) : verificationResult ? (
          <div className="moodle-card">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Certificate Verified</h1>
              <p className="text-gray-600">This certificate is authentic and valid</p>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Award className="w-8 h-8 text-primary-600" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{verificationResult.course_title}</h2>
                    <p className="text-sm text-gray-600">{verificationResult.course_code}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Student Name</p>
                    <p className="font-semibold text-gray-900">{verificationResult.student_name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Institution</p>
                    <p className="font-semibold text-gray-900">{verificationResult.institution_name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Issued Date</p>
                    <p className="font-semibold text-gray-900">
                      {formatDate(verificationResult.issued_date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Grade</p>
                    <p className="font-semibold text-gray-900">{verificationResult.grade}%</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Certificate Number:</span>
                    <span className="font-mono text-gray-900">{verificationResult.certificate_number}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Verification Code:</span>
                    <span className="font-mono text-gray-900">{verificationResult.verification_code}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <button
                  disabled={isGenerating}
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  {isGenerating ? 'Generating Official PDF...' : 'Download Official Certificate PDF'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Hidden Official Template */}
      <div className="fixed -left-[10000px] top-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <style jsx global>{`
            @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
            .font-script { font-family: 'Great Vibes', cursive; }
        `}</style>
        
        <div 
            ref={exportTemplateRef}
            className="relative bg-white w-[800px] h-[566px] overflow-hidden"
        >
            <img src="/certificate-bg.png" alt="BG" className="absolute inset-0 w-full h-full object-cover z-0" />
            
            <div className="relative z-10 w-full h-full">
                {/* Student Name */}
                <div className="absolute top-[280px] w-full text-center">
                    <h2 className="font-script text-[60px] text-[#c4843b] leading-none px-12 truncate">
                        {verificationResult?.student_name}
                    </h2>
                </div>

                {/* Student ID */}
                <div className="absolute top-[382px] left-[520px] text-left">
                    <span className="text-[16px] font-black text-[#2e4d58] uppercase tracking-tight">
                        {verificationResult?.certificate_number}
                    </span>
                </div>

                {/* Course Details */}
                <div className="absolute top-[468px] w-full text-center px-[100px]">
                    <p className="text-[18px] font-black text-[#2e4d58] uppercase tracking-wide leading-tight">
                        {verificationResult?.course_title}
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyCertificatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading verification...</p>
        </div>
      </div>
    }>
      <VerifyCertificateContent />
    </Suspense>
  );
}

