import React from 'react';

interface StudentIDCardProps {
  id: string;
  student: {
    full_name: string;
    student_id: string;
    image?: string;
  };
  course?: {
    name: string;
    level?: string | number;
  };
}

const StudentIDCard = React.forwardRef<HTMLDivElement, StudentIDCardProps>(({ student, course }, ref) => {
  // Use the high-fidelity base64 background extracted from the reference HTML
  const backgroundBase64 = "data:image/bmp;base64,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";

  return (
    <div 
      ref={ref}
      id="student-id-card"
      className="relative w-[380px] h-[600px] bg-white overflow-hidden shadow-2xl font-sans text-slate-900 select-none border border-slate-200"
      style={{ 
        minWidth: '380px', 
        minHeight: '600px',
        width: '380px',
        height: '600px',
        backgroundImage: `url(${backgroundBase64})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* ── PROFILE PICTURE (Positioned to match canvas offset) ── */}
      <div className="absolute top-[125px] left-1/2 -translate-x-1/2 flex items-center justify-center">
         <div className="relative w-[210px] h-[210px] rounded-full border-[8px] border-white/95 bg-white overflow-hidden shadow-lg flex items-center justify-center">
            {student.image ? (
                <img src={student.image} alt="Student" className="w-full h-full object-cover" crossOrigin="anonymous" />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-50 text-[#3AA39F] opacity-40">
                   <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
            )}
        </div>
      </div>

      {/* ── STUDENT NAME (Heavy Uppercase - Exactly at y=410) ── */}
      <div className="absolute top-[395px] w-full text-center px-6">
        <h2 className="text-[38px] font-[1000] text-[#1c1917] uppercase leading-none tracking-tighter drop-shadow-sm whitespace-nowrap overflow-hidden">
          {student.full_name}
        </h2>
      </div>

      {/* ── COURSE DETAILS (Vertical layout centered at y=455) ── */}
      <div className="absolute top-[455px] w-full text-center flex flex-col items-center">
          <p className="text-[17px] font-black uppercase tracking-[0.2em] text-[#3aa39f] mb-1">
              LEVEL {course?.level || 1}
          </p>
          <p className="text-[19px] font-black text-[#1c1917] leading-tight max-w-[320px] uppercase">
              {course?.name || 'Academy Specialization'}
          </p>
      </div>

      {/* ── ID NUMBER (Bottom Section - Aligned with AiT Branding) ── */}
      <div className="absolute bottom-[45px] w-full flex justify-center items-center gap-2">
          <span className="text-[15px] font-black text-[#3aa39f] uppercase tracking-widest">ID NO :</span>
          <span className="text-[16px] font-bold text-slate-800 tracking-[0.2em]">
            {student.student_id ? student.student_id : '0001'}
          </span>
      </div>

      {/* ── BRANDING LOGS (Reconstructed AiT from reference) ── */}
      <div className="absolute top-10 w-full flex justify-center scale-90">
         <div className="flex items-center gap-1">
            <div className="relative">
                <span className="text-[42px] font-black text-[#1c1917]">A</span>
                <span className="absolute top-[22px] left-[42%] w-[6px] h-[6px] bg-[#3AA39F] rounded-full ring-1 ring-white"></span>
            </div>
            <div className="relative flex flex-col items-center">
                <span className="text-[42px] font-black text-[#3AA39F]">i</span>
                <span className="absolute top-[8px] w-full h-[4px] bg-[#1c1917] rounded-full"></span>
            </div>
            <span className="text-[42px] font-black text-[#1c1917]">T</span>
         </div>
      </div>
    </div>
  );
});

StudentIDCard.displayName = 'StudentIDCard';

export default StudentIDCard;

