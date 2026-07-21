'use client';

import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { Download, User, Scissors, Gamepad2, Cpu, Laptop, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentIDCardProps {
  studentData: {
    full_name: string;
    student_id: string;
    profile_image?: string;
  };
  courseData: {
    name: string;
    course_code: string;
    level: number;
    registration_date: string;
  };
}

const StudentIDCard: React.FC<StudentIDCardProps> = ({ studentData, courseData }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const downloadCard = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 4, // Ultra-high quality
        useCORS: true,
        backgroundColor: null,
      });
      const link = document.createElement('a');
      link.download = `AIT-ID-${studentData.full_name}-${courseData.course_code}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating ID card:', error);
    }
  };

  const isLevel2 = courseData.level >= 2;
  const enrollmentYear = new Date(courseData.registration_date).getFullYear() || 2026;
  const formattedID = `AIT-${enrollmentYear}-${courseData.course_code}-${studentData.student_id}`;

  return (
    <div className="flex flex-col items-center gap-8 p-4">
      {/* ID Card Wrapper */}
      <div 
        ref={cardRef}
        className={cn(
          "relative w-[380px] h-[580px] overflow-hidden rounded-[2.5rem] bg-white font-sans transition-all duration-500",
          isLevel2 ? "shadow-[0_20px_50px_rgba(42,159,144,0.3)]" : "shadow-xl border border-slate-100"
        )}
      >
        {/* BACKGROUND DECORATIONS - LEVEL 1 (Beginner) */}
        {!isLevel2 && (
          <>
            <div className="absolute top-0 right-[-20px] w-64 h-64 bg-[#e0f7f4] rounded-full opacity-60 blur-sm" />
            <div className="absolute bottom-[-10px] left-[-30px] w-56 h-56 bg-[#e0f7f4] rounded-full opacity-60 blur-sm" />
          </>
        )}

        {/* BACKGROUND DECORATIONS - LEVEL 2 (Advanced) */}
        {isLevel2 && (
          <>
            {/* Top Wave - More pronounced */}
            <div className="absolute top-0 left-0 right-0 h-40 bg-[#2a9f90]" 
              style={{ clipPath: 'ellipse(100% 70% at 50% 0%)' }} />
            <div className="absolute top-0 left-0 right-0 h-44 bg-[#2a9f90]/10" 
              style={{ clipPath: 'ellipse(110% 75% at 50% 0%)', transform: 'translateY(-15px)' }} />

            {/* Bottom Wave - More pronounced */}
            <div className="absolute bottom-0 left-0 right-0 h-48 bg-[#2a9f90]" 
              style={{ clipPath: 'ellipse(100% 70% at 50% 100%)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-52 bg-[#2a9f90]/10" 
              style={{ clipPath: 'ellipse(110% 75% at 50% 100%)', transform: 'translateY(15px)' }} />

            {/* Floating Icons */}
            <div className="absolute top-[130px] left-8 opacity-20 text-[#2a9f90] rotate-[-12deg]"><Scissors size={32} /></div>
            <div className="absolute top-[110px] right-10 opacity-20 text-[#2a9f90] rotate-[15deg]"><Gamepad2 size={38} /></div>
            <div className="absolute bottom-[110px] left-10 opacity-20 text-white rotate-[-15deg]"><Cpu size={36} /></div>
            <div className="absolute bottom-[90px] right-8 opacity-20 text-white rotate-[12deg]"><Laptop size={42} /></div>
          </>
        )}

        {/* CONTENT OVERLAY */}
        <div className="relative z-10 flex flex-col items-center h-full pt-10 px-10">
          
          {/* LOGO */}
          <div className="mb-8 scale-110">
            <div className="text-4xl font-black italic flex items-center tracking-tighter">
              <span className="text-[#1a3a3a]">A</span>
              <span className="text-[#2a9f90] ml-[-4px]">i</span>
              <span className="text-[#1a3a3a]">T</span>
            </div>
          </div>

          {/* PROFILE IMAGE */}
          <div className="relative flex justify-center items-center mb-8 mt-2">
            <div className={cn(
              "relative w-48 h-48 rounded-full flex items-center justify-center bg-slate-50 overflow-hidden shadow-2xl transition-all duration-500",
              isLevel2 ? "border-[12px] border-[#e2e8f0] ring-4 ring-black/5" : "border-4 border-white shadow-lg"
            )}>
              {studentData.profile_image ? (
                <img 
                  src={studentData.profile_image} 
                  alt={studentData.full_name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="bg-slate-100 w-full h-full flex items-center justify-center">
                   <User className="w-24 h-24 text-slate-300" />
                </div>
              )}
            </div>
          </div>

          {/* STUDENT TEXT INFO */}
          <div className="text-center w-full mt-2">
            <h2 className={cn(
              "text-3xl font-black uppercase tracking-tight mb-1",
              isLevel2 ? "text-[#1a3a3a]" : "text-[#102a2a]"
            )}>
              {studentData.full_name}
            </h2>
            <div className={cn(
              "text-[13px] font-black uppercase tracking-[0.25em] mb-2",
              isLevel2 ? "text-[#2a9f90]" : "text-[#2a9f90]"
            )}>
              level {courseData.level}
            </div>
            <p className="text-slate-500 font-bold text-sm leading-tight max-w-[220px] mx-auto">
              {courseData.name}
            </p>
          </div>

          {/* FOOTER - ID SECTION */}
          <div className="w-full mt-auto mb-12">
            <div className="flex items-center justify-between border-t border-slate-100/50 pt-5 mt-4">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.35em]">ID NO :</span>
              <span className={cn(
                "text-lg font-black tracking-widest",
                isLevel2 ? "text-[#102a2a]" : "text-[#1a3a3a]"
              )}>
                {formattedID}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* DOWNLOAD CTA */}
      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        <button
          onClick={downloadCard}
          className="w-full py-5 bg-[#2a9f90] hover:bg-[#238b7e] text-white rounded-[2rem] flex items-center justify-center gap-4 shadow-xl shadow-[#2a9f90]/30 active:scale-95 transition-all text-sm font-black uppercase tracking-[0.2em]"
        >
          <div className="p-2 bg-white/20 rounded-xl">
             <Download className="w-5 h-5" />
          </div>
          Download Card
        </button>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center px-4">
          Official {isLevel2 ? 'Advanced' : 'Beginner'} Tier Student Identity Card
        </p>
      </div>
    </div>
  );
};

export default StudentIDCard;
