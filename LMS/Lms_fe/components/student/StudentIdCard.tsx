'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import html2canvas from 'html2canvas';
import { userAPI } from '@/lib/api';

interface StudentData {
  name: string;
  father_name: string;
  student_id: string;
  level: string;
  specialization: string;
  batch: string;
  whatsapp: string;
  cnic: string;
  photo_url: string;
  status: string;
}

interface StudentIdCardProps {
    showDownloadButton?: boolean;
}

const StudentIdCard = forwardRef<any, StudentIdCardProps>(({ showDownloadButton = true }, ref) => {
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
      download: handleDownload
  }));

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const data = await userAPI.getStudentIdCard();
        setStudent(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch student data');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, []);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: null,
      });

      const link = document.createElement('a');
      link.download = `AIT-ID-${student?.student_id || 'student'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#3aa39f]"></div>
    </div>
  );
  
  if (error) return (
    <div className="p-8 text-center bg-red-50 text-red-600 rounded-2xl border border-red-100 italic font-medium">
      {error}
    </div>
  );
  
  if (!student) return <div className="p-8 text-center text-slate-400">No student identity data found</div>;

  const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      {/* ── CARD CONTAINER ── */}
      <div 
        ref={cardRef}
        className="relative shadow-2xl overflow-hidden bg-white"
        style={{
          width: '320px',
          height: '480px',
          backgroundImage: 'url(/ait-card-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* STUDENT PHOTO / INITIALS */}
        <div 
           className="absolute top-[100px] left-1/2 -translate-x-1/2 flex items-center justify-center border-4 border-white shadow-xl overflow-hidden"
           style={{
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              backgroundColor: student.photo_url ? 'transparent' : '#3aa39f',
           }}
        >
          {student.photo_url ? (
            <img 
               src={student.photo_url} 
               alt="Student" 
               className="w-full h-full object-cover" 
               crossOrigin="anonymous" 
            />
          ) : (
            <span className="text-white text-5xl font-black uppercase tracking-tighter">
                {initials}
            </span>
          )}
        </div>

        {/* STUDENT NAME */}
        <div 
          className="absolute bottom-[138px] left-[20px] w-[280px]"
          style={{
            color: '#1c1917',
            fontWeight: '900',
            fontSize: '18px',
            textAlign: 'left',
            lineHeight: '1.2',
            textTransform: 'uppercase'
          }}
        >
          {student.name}
        </div>

        {/* LEVEL */}
        <div 
          className="absolute bottom-[112px] left-[20px]"
          style={{
            color: '#3aa39f',
            fontSize: '13px',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}
        >
          {student.level}
        </div>

        {/* SPECIALIZATION */}
        <div 
          className="absolute bottom-[88px] left-[20px] w-[280px] truncate"
          style={{
            color: '#3aa39f',
            fontSize: '12px',
            fontWeight: '900',
            textTransform: 'uppercase'
          }}
        >
          {student.specialization || 'Academy Specialization'}
        </div>

        {/* ID NUMBER */}
        <div 
          className="absolute bottom-[62px] left-[20px]"
          style={{
            color: '#1c1917',
            fontSize: '14px',
            fontWeight: '900',
            letterSpacing: '0.05em'
          }}
        >
          ID NO: {student.student_id}
        </div>
      </div>

      {/* DOWNLOAD BUTTON */}
      {showDownloadButton && (
          <button 
            onClick={handleDownload}
            className="px-8 py-4 bg-[#3aa39f] hover:bg-[#2e827f] text-white font-black rounded-2xl transition-all shadow-xl shadow-[#3aa39f]/20 hover:scale-[1.03] active:scale-95 flex items-center gap-3 uppercase tracking-widest text-[11px]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Download Physical ID Card (High-Res)
          </button>
      )}
    </div>
  );
});

StudentIdCard.displayName = 'StudentIdCard';

export default StudentIdCard;
