'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Award, CheckCircle, Calendar, GraduationCap, Sparkles, FileText } from 'lucide-react';
import { certificateAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function StudentCertificatesPage() {
    const [certificates, setCertificates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const user = getStoredUser();

    useEffect(() => {
        fetchCertificates();
    }, []);

    const fetchCertificates = async () => {
        try {
            setLoading(true);
            if (!user?.id) {
                setCertificates([]);
                return;
            }
            const data = await certificateAPI.getAll(user.id);
            const sortedData = (Array.isArray(data) ? data : []).sort((a: any, b: any) =>
                new Date(b.issued_date).getTime() - new Date(a.issued_date).getTime()
            );
            setCertificates(sortedData);
        } catch (error: any) {
            console.error('Error fetching certificates:', error);
            if (error.response?.status !== 404) {
                toast.error('Failed to load certificates');
            }
            setCertificates([]);
        } finally {
            setLoading(false);
        }
    };

    const [isDownloading, setIsDownloading] = useState<string | null>(null);

    const latestCertificate = certificates.length > 0 ? certificates[0] : null;

    const handleDownload = async (certificateId: string, certificateNumber: string) => {
        try {
            setIsDownloading(certificateId);
            const token = localStorage.getItem('lms_token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const response = await fetch(
                `${apiUrl}/api/certifications/certifications/${certificateId}/download/`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${certificateNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Certificate downloaded!');
        } catch (err) {
            toast.error('Could not download PDF. Please try again.');
        } finally {
            setIsDownloading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50/50">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-[2rem] border-4 border-slate-100 animate-spin border-t-brand-teal shadow-xl shadow-brand-teal/10" />
                        <div className="absolute inset-0 flex items-center justify-center text-brand-teal">
                            <Award className="w-8 h-8 animate-pulse" />
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Loading certificates...</p>
                </div>
            </div>
        );
    }

    const currentCert = latestCertificate;

    return (
        <div className="min-h-screen bg-slate-50/30 p-10 font-sans text-slate-900 max-w-[1600px] mx-auto no-print">
            <div className="mb-12 no-print">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    <Award className="w-7 h-7 text-brand-teal" />
                    My Certificates
                </h1>
                <p className="text-sm text-slate-400 font-bold mt-1">View and download all your earned certificates in one place.</p>
            </div>

            {certificates.length === 0 ? (
                <div className="bg-white rounded-[3rem] p-20 text-center shadow-2xl shadow-slate-200/40 border border-slate-100 flex flex-col items-center max-w-3xl mx-auto no-print">
                    <div className="w-40 h-40 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-10 relative shadow-inner group">
                        <GraduationCap className="w-20 h-20 text-slate-200 group-hover:text-brand-teal transition-colors duration-700" />
                        <div className="absolute -top-4 -right-4 w-12 h-12 bg-brand-teal rounded-2xl flex items-center justify-center shadow-xl shadow-brand-teal/20 group-hover:rotate-12 transition-transform">
                            <Award className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">No Certificates Yet</h2>
                    <p className="text-slate-400 mb-10 px-12 font-medium text-lg leading-relaxed">
                        Finish your courses to earn certificates and showcase your skills.
                    </p>
                    <button
                        onClick={() => router.push('/student/my-courses')}
                        className="bg-brand-dark text-white px-12 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-brand-teal transition-all shadow-2xl shadow-brand-dark/20 active:scale-95 flex items-center gap-3 border border-white/5"
                    >
                        View My Courses <CheckCircle className="w-6 h-6" />
                    </button>
                </div>
            ) : (
                <div className="space-y-12">

                    {currentCert && (
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-brand-dark to-brand-teal rounded-[3rem] opacity-5 blur-[100px] group-hover:opacity-10 transition-opacity no-print"></div>
                            <div className="bg-white rounded-[3rem] p-10 lg:p-14 shadow-2xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden z-10 flex flex-col xl:flex-row gap-12 items-center">

                                {/* Certificate Info Card */}
                                <div className="w-full xl:w-2/3">
                                    <div className="bg-gradient-to-br from-slate-50 to-white rounded-[2rem] p-8 lg:p-12 border border-slate-100">
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="w-16 h-16 bg-brand-teal/10 rounded-2xl flex items-center justify-center">
                                                <Award className="w-8 h-8 text-brand-teal" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-brand-teal uppercase tracking-[0.3em]">Official Certificate</p>
                                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{currentCert.course_title || currentCert.course_name || 'Course Completion'}</h2>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Student</p>
                                                <p className="text-sm font-black text-slate-900">{user?.full_name || 'Student'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Course Code</p>
                                                <p className="text-sm font-black text-slate-900">{currentCert.course_code || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Grade</p>
                                                <p className="text-sm font-black text-slate-900">{currentCert.grade ? `${currentCert.grade}%` : 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Issued</p>
                                                <p className="text-sm font-black text-slate-900">{currentCert.issued_date ? formatDate(currentCert.issued_date) : 'N/A'}</p>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap gap-4">
                                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-black text-slate-600 uppercase tracking-widest">
                                                <Calendar className="w-4 h-4 text-brand-teal" />
                                                Cert No: {currentCert.certificate_number || currentCert.certificate_id || 'N/A'}
                                            </div>
                                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100 text-xs font-black text-emerald-600 uppercase tracking-widest">
                                                <CheckCircle className="w-4 h-4" />
                                                Verified
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Panel */}
                                <div className="w-full xl:w-1/3 flex flex-col justify-center space-y-6 no-print">
                                    <div className="space-y-4">
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Download Certificate</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed">
                                            Your official certificate is ready. Download the PDF to keep a permanent record.
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => handleDownload(currentCert.id, currentCert.certificate_number || currentCert.certificate_id || 'certificate')}
                                        disabled={isDownloading === currentCert.id}
                                        className="w-full bg-brand-dark text-white px-8 py-5 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.2em] cursor-pointer hover:bg-brand-teal transition-all flex items-center justify-center gap-4 shadow-2xl shadow-brand-dark/20 active:scale-95 group/btn border border-white/5 disabled:opacity-50"
                                    >
                                        {isDownloading === currentCert.id ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Download className="w-6 h-6 text-brand-orange group-hover/btn:scale-110 transition-transform" />
                                        )}
                                        {isDownloading === currentCert.id ? 'Downloading...' : 'Download PDF'}
                                    </button>

                                    <div className="bg-teal-500/5 border border-teal-500/10 rounded-2xl p-5">
                                        <p className="text-[11px] text-teal-600/70 font-bold uppercase tracking-widest text-center leading-relaxed">
                                            Official AIT Digital Record <br />
                                            <span className="text-[9px] opacity-60">Verified & Cryptographically Signed</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="no-print pb-20">
                        <div className="flex items-center justify-between mb-12">
                            <h3 className="text-3xl font-black text-slate-900 flex items-center gap-5 tracking-tight">
                                <div className="w-12 h-12 rounded-2xl bg-brand-teal/10 flex items-center justify-center text-brand-teal shadow-inner">
                                    <Award className="w-6 h-6" />
                                </div>
                                All Certificates
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {certificates.map((cert) => (
                                <div key={cert.id} className="group bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/30 border border-slate-50 hover:shadow-2xl hover:shadow-slate-300/40 hover:-translate-y-2 transition-all duration-500 relative overflow-hidden flex flex-col">
                                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-dark to-brand-teal scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left"></div>
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Sparkles className="w-6 h-6 text-brand-teal animate-pulse" />
                                    </div>

                                    <div className="flex items-start justify-between mb-8">
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-brand-dark group-hover:text-brand-teal transition-all duration-500 shadow-inner group-hover:rotate-12">
                                            <Award className="w-8 h-8" />
                                        </div>
                                        <span className="bg-slate-50 text-slate-400 text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-slate-100 group-hover:bg-brand-teal/10 group-hover:text-brand-teal group-hover:border-brand-teal/20 transition-all">
                                            <CheckCircle className="w-3.5 h-3.5" /> Issued
                                        </span>
                                    </div>

                                    <h4 className="text-2xl font-black text-slate-900 mb-4 line-clamp-2 min-h-[64px] group-hover:text-brand-teal transition-colors tracking-tight leading-tight">
                                        {cert.course_title || cert.course_name || 'Course Completion'}
                                    </h4>

                                    {cert.course_code && (
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                                            Code: {cert.course_code}
                                        </p>
                                    )}

                                    <div className="space-y-4 mt-auto pt-8 border-t border-slate-50">
                                        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                                            <div className="flex items-center gap-2.5 text-slate-400">
                                                <Calendar className="w-4 h-4 text-brand-teal" />
                                                <span>{formatDate(cert.issued_date)}</span>
                                            </div>
                                            <div className="flex items-center gap-2.5 text-slate-400">
                                                <FileText className="w-4 h-4 text-brand-orange" />
                                                <span className="font-mono">{(cert.certificate_number || cert.certificate_id || '').slice(0, 8)}</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleDownload(cert.id, cert.certificate_number || cert.certificate_id || 'certificate')}
                                            disabled={isDownloading === cert.id}
                                            className="w-full mt-4 bg-slate-50 text-slate-500 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-dark hover:text-white transition-all flex items-center justify-center gap-3 group/download shadow-sm hover:shadow-xl hover:shadow-brand-dark/20 disabled:opacity-50"
                                        >
                                            {isDownloading === cert.id ? (
                                                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4 text-brand-orange group-hover/download:animate-bounce" />
                                            )}
                                            {isDownloading === cert.id ? 'Downloading...' : 'Download PDF'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
