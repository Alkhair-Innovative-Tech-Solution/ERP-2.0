'use client';

import React, { useState, useRef } from 'react';
import { Download, Image as ImageIcon, Upload, RefreshCw, Layers, FileDown, ShieldCheck, Camera, Sparkles, ChevronRight, X, Layout, CreditCard } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function IDCardGeneratorPage() {
  const [formData, setFormData] = useState({
    name: 'Ahmed Ali',
    level: 'LEVEL 1',
    specialization: 'Digital Marketing',
    idNo: '0000',
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBgPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadCard = async () => {
    if (!cardRef.current) return;

    try {
      setIsGenerating(true);
      toast.loading('Synthesizing high-fidelity ID asset...', { id: 'generating' });

      const canvas = await html2canvas(cardRef.current, {
        scale: 4, // High Resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [380, 600]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, 380, 600);
      pdf.save(`AIT-ID-${formData.name.replace(/\s+/g, '-')}.pdf`);
      
      toast.success('Identity document exported successfully!', { id: 'generating' });
    } catch (error) {
      toast.error('Synthesis failed. Check terminal logs.', { id: 'generating' });
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      
      {/* â”€â”€ Header Section â”€â”€ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                  <CreditCard className="w-7 h-7 text-brand-teal" />
                  ID Card Generator
              </h1>
              <p className="text-sm text-slate-400 font-bold mt-1">Generate high-fidelity institutional identity documents for validated scholars.</p>
          </div>
          <Button 
              onClick={downloadCard} 
              disabled={isGenerating}
              className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-14 px-8 font-black shadow-lg shadow-brand-teal/20 flex gap-3 uppercase text-[11px] tracking-widest group border-none"
          >
              {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5 group-hover:translate-y-1 transition-transform" />}
              Export PDF Registry
          </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* â”€â”€ Configuration Terminal (Left) â”€â”€ */}
        <div className="lg:col-span-4 space-y-8">
            <div className="premium-card p-8 bg-white border-none shadow-premium relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <CreditCard size={80} className="text-brand-teal" />
                </div>
                
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                    <Layout className="w-5 h-5 text-brand-teal" /> Card Architecture
                </h2>

                <div className="space-y-6">
                    {/* Background Layer */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Base Layer (Background)</label>
                        <div className="relative group/upload">
                            <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" id="bg-upload" />
                            <label
                                htmlFor="bg-upload"
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-white hover:border-brand-teal/30 transition-all shadow-inner group/label"
                            >
                                <span className="text-xs font-black text-slate-600 flex items-center gap-3 uppercase tracking-tight">
                                    <ImageIcon className="w-4 h-4 text-slate-300 group-hover/label:text-brand-teal transition-colors" />
                                    {bgPreview ? 'Identity Background Set' : 'Upload Global BG'}
                                </span>
                                {bgPreview && <div className="w-2 h-2 rounded-full bg-brand-teal shadow-[0_0_8px_rgba(23,208,222,0.5)]" />}
                            </label>
                        </div>
                    </div>

                    <div className="h-px bg-slate-50 my-6" />

                    {/* Scholar Logic */}
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Scholar Identity</label>
                            <input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/40 transition-all uppercase tracking-tight shadow-inner"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Curriculum Level</label>
                                <input
                                    value={formData.level}
                                    onChange={(e) => setFormData({ ...formData, level: e.target.value.toUpperCase() })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/40 transition-all uppercase tracking-widest shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Unique Index (ID NO)</label>
                                <input
                                    value={formData.idNo}
                                    onChange={(e) => setFormData({ ...formData, idNo: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-700 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/40 transition-all uppercase tracking-tighter shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Specialization Vector</label>
                            <input
                                value={formData.specialization}
                                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/5 focus:border-brand-teal/40 transition-all uppercase tracking-tight shadow-inner"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Scholar Visualization (Photo)</label>
                            <div className="relative group/upload">
                                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" id="photo-upload" />
                                <label
                                    htmlFor="photo-upload"
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-white hover:border-brand-teal/30 transition-all shadow-inner group/label"
                                >
                                    <span className="text-xs font-black text-slate-600 flex items-center gap-3 uppercase tracking-tight">
                                        <Camera className="w-4 h-4 text-slate-300 group-hover/label:text-brand-teal transition-colors" />
                                        {photoPreview ? 'Facial Scan Captured' : 'Upload Portrait'}
                                    </span>
                                    {photoPreview && <div className="w-2 h-2 rounded-full bg-brand-teal shadow-[0_0_8px_rgba(23,208,222,0.5)]" />}
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 flex flex-col gap-4">
                        <Button
                            onClick={() => toast.success('Institutional preview updated.')}
                            className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl active:scale-95 border-none"
                        >
                            Sync Artifact Preview
                        </Button>
                    </div>
                </div>
            </div>

            <div className="premium-card p-8 bg-brand-teal/5 border border-brand-teal/10 rounded-3xl flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-brand-teal flex items-center justify-center text-white shadow-lg shadow-brand-teal/20">
                    <ShieldCheck size={28} />
                </div>
                <div>
                    <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest">Protocol Verified</p>
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight mt-1 leading-tight">Artifacts generated are compliant with institutional standards.</p>
                </div>
            </div>
        </div>

        {/* â”€â”€ High-Fidelity Preview Container (Right) â”€â”€ */}
        <div className="lg:col-span-8 premium-card p-12 min-h-[800px] flex items-center justify-center bg-slate-50/50 border-none shadow-premium relative overflow-hidden" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, #e2e8f0 1.5px, transparent 0)',
          backgroundSize: '48px 48px'
        }}>
          {/* Decorative Corner Elements */}
          <div className="absolute top-0 left-0 w-24 h-24 border-t-4 border-l-4 border-brand-teal/20 rounded-tl-[40px] m-10" />
          <div className="absolute bottom-0 right-0 w-24 h-24 border-b-4 border-r-4 border-brand-teal/20 rounded-br-[40px] m-10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-teal/5 rounded-full blur-[120px] pointer-events-none" />

          <div className="relative z-10 transition-all duration-700 hover:scale-[1.03]">
            {/* â”€â”€ The Physical ID Card Architecture â”€â”€ */}
            <div
              ref={cardRef}
              className="relative overflow-hidden bg-white w-[380px] h-[600px] rounded-[36px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] ring-1 ring-slate-100"
            >
              {/* Institutional Foundation (Background) */}
              <img
                src={bgPreview || "/ait-card-bg.png"}
                alt="Card Foundation"
                className="absolute inset-0 w-full h-full object-cover z-0"
              />

              {/* Scholar Visualization Ring */}
              <div
                className="absolute z-10 w-[268px] h-[268px] rounded-full overflow-hidden bg-[#41a396] flex flex-col items-center justify-center transform -translate-x-1/2 ring-[12px] ring-white/10"
                style={{
                  top: '140px',
                  left: '60%', 
                }}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Scholar Portrait" className="w-full h-full object-cover scale-[1.02]" />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 opacity-20">
                      <Sparkles size={60} className="text-white" />
                      <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Capture Facial Node</span>
                  </div>
                )}
              </div>

              {/* Cryptographic Data Cluster (Text Section) */}
              <div className="absolute z-20 w-full text-left px-[40px]" style={{ bottom: '50px' }}>
                <h2 className="text-[28px] font-black text-[#1e293b] leading-[1.1] uppercase tracking-tighter mb-[8px] w-[300px] drop-shadow-sm">
                  {formData.name || 'AHMED ALI'}
                </h2>
                <div className="flex items-center gap-2 mb-[6px]">
                    <div className="h-1 w-6 bg-[#41a396] rounded-full" />
                    <p className="text-[14px] font-black text-[#41a396] uppercase tracking-widest leading-none">
                      {formData.level || 'LEVEL_01'}
                    </p>
                </div>
                <p className="text-[13px] font-extrabold text-[#41a396] uppercase tracking-tight mb-[24px] leading-[1.3] w-[280px] opacity-90">
                  {formData.specialization || 'STRUCTURAL_SYSTEMS_INITIATIVE'}
                </p>
                <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                    <div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Index Node</p>
                        <p className="text-[16px] font-black text-[#1e293b] uppercase tracking-tighter">
                          {formData.idNo || '0000_VOID'}
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                        <ImageIcon size={18} className="text-slate-200" />
                    </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
