'use client';

import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { Download, RefreshCw, User, GraduationCap, Award, Layout, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const FONT_OPTIONS = [
  { value: 'Great Vibes', label: 'Great Vibes (Cursive)' },
  { value: 'Georgia', label: 'Georgia (Serif)' },
  { value: 'Typographica', label: 'Typographica (Display)' },
  { value: 'Montserrat', label: 'Montserrat (Sans)' },
];

function fitText(el: SVGTextElement | null, maxWidth: number, baseSize: number) {
  if (!el) return baseSize;
  el.setAttribute('font-size', String(baseSize));
  let size = baseSize;
  while (el.getComputedTextLength() > maxWidth && size > 12) {
    size -= 1;
    el.setAttribute('font-size', String(size));
  }
  return size;
}

export default function CertificateGeneratorPage() {
  const [formData, setFormData] = useState({
    name: 'Ali Hassan',
    studentId: 'AIT25-GC11-0371',
    courseName: 'Web Development',
    duration: 'Four-Month',
    date: '',
    signer: 'Mr. Saad Sheikh',
    title: 'CEO AIT',
    branch: 'Power House',
    fontFamily: 'Great Vibes',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const titleEl = svg.getElementById('t-title-line') as SVGTextElement | null;
    const nameEl = svg.getElementById('t-name') as SVGTextElement | null;
    const courseEl = svg.getElementById('t-course') as SVGTextElement | null;
    const signerEl = svg.getElementById('t-signer') as SVGTextElement | null;
    fitText(titleEl, 1400, 82);
    fitText(nameEl, 1020, 56);
    fitText(courseEl, 1060, 34);
    fitText(signerEl, 600, 40);
  }, [formData]);

  const embedImages = useCallback(async (svg: SVGSVGElement): Promise<void> => {
    const images = Array.from(svg.querySelectorAll('image'));
    await Promise.all(images.map(async (img) => {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href');
      if (!href || href.startsWith('data:')) return;
      try {
        const resp = await fetch(href);
        const blob = await resp.blob();
        const dataUri = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        img.setAttribute('href', dataUri);
        img.removeAttribute('xlink:href');
      } catch {
        console.warn('Failed to embed image for export:', href);
      }
    }));
  }, []);

  const toCanvas = useCallback(async (scale: number): Promise<HTMLCanvasElement> => {
    const svg = svgRef.current;
    if (!svg) throw new Error('SVG element not found');
    const clone = svg.cloneNode(true) as SVGSVGElement;
    await embedImages(clone);
    const W = 1600, H = 1131;
    clone.setAttribute('width', String(W * scale));
    clone.setAttribute('height', String(H * scale));
    clone.removeAttribute('style');
    clone.removeAttribute('class');
    const xml = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ece9e1';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [embedImages]);

  const downloadPNG = useCallback(async () => {
    try {
      setIsGenerating(true);
      toast.loading('Rendering certificate...', { id: 'cert-gen' });
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 500));
      const canvas = await toCanvas(2.5);
      canvas.toBlob(blob => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${formData.name.replace(/\s+/g, '_')}_certificate.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, 'image/png');
      toast.success('Certificate exported as PNG!', { id: 'cert-gen' });
    } catch (e) {
      console.error(e);
      toast.error('Export failed.', { id: 'cert-gen' });
    } finally {
      setIsGenerating(false);
    }
  }, [toCanvas, formData.name]);

  const downloadPDF = useCallback(async () => {
    try {
      setIsGenerating(true);
      toast.loading('Generating PDF...', { id: 'cert-gen' });
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 500));
      const canvas = await toCanvas(2.5);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210);
      pdf.save(`${formData.name.replace(/\s+/g, '_')}_certificate.pdf`);
      toast.success('Certificate exported as PDF!', { id: 'cert-gen' });
    } catch (e) {
      console.error(e);
      toast.error('Export failed.', { id: 'cert-gen' });
    } finally {
      setIsGenerating(false);
    }
  }, [toCanvas, formData.name]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const branchSuffix = formData.branch.trim() ? ` â€” ${formData.branch.trim()}` : '';
  const dateLine = formData.date.trim() ? `Date: ${formData.date.trim()}` : '';

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
        @font-face { font-family: 'Typographica'; src: url('/fonts/TypoGraphica Regular.ttf') format('truetype'); }
        @font-face { font-family: 'Montserrat'; src: url('/fonts/Montserrat-Regular.ttf') format('truetype'); }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="w-7 h-7 text-brand-teal" />
            Credential Architect
          </h1>
          <p className="text-sm text-slate-400 font-bold mt-1">Design and synthesize official institutional completion certificates for validated scholars.</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={downloadPNG}
            disabled={isGenerating}
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-14 px-8 font-black shadow-lg flex gap-3 uppercase text-[11px] tracking-widest group border-none"
          >
            {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" />}
            PNG
          </Button>
          <Button
            onClick={downloadPDF}
            disabled={isGenerating}
            className="bg-brand-teal hover:bg-brand-dark text-white rounded-2xl h-14 px-8 font-black shadow-lg shadow-brand-teal/20 flex gap-3 uppercase text-[11px] tracking-widest group border-none"
          >
            {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" />}
            Export PDF Credential
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4 space-y-8">
          <div className="premium-card p-8 bg-white border-none shadow-premium relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Award size={80} className="text-brand-teal" />
            </div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
              <Layout className="w-5 h-5 text-brand-teal" /> Credential Logic
            </h2>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Recipient Name</label>
                <div className="relative">
                  <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all uppercase tracking-tight shadow-inner" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Student ID</label>
                  <Input value={formData.studentId} onChange={e => setFormData(p => ({ ...p, studentId: e.target.value }))}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all font-mono shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Duration</label>
                  <Input value={formData.duration} onChange={e => setFormData(p => ({ ...p, duration: e.target.value }))}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all shadow-inner" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Course Name</label>
                <div className="relative">
                  <GraduationCap className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <Input value={formData.courseName} onChange={e => setFormData(p => ({ ...p, courseName: e.target.value }))}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all uppercase tracking-tight shadow-inner" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Branch</label>
                <Input value={formData.branch} onChange={e => setFormData(p => ({ ...p, branch: e.target.value }))}
                  placeholder="e.g. Power House"
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all shadow-inner" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Course Start Date <span className="font-normal normal-case tracking-normal">(optional)</span></label>
                <Input value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                  placeholder="e.g. June 2026"
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all shadow-inner" />
              </div>

              <div className="border-t border-slate-100 pt-5 space-y-5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authority</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Signatory</label>
                    <Input value={formData.signer} onChange={e => setFormData(p => ({ ...p, signer: e.target.value }))}
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all shadow-inner" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Title</label>
                    <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all shadow-inner" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Name Font</label>
                <select
                  value={formData.fontFamily}
                  onChange={e => setFormData(p => ({ ...p, fontFamily: e.target.value }))}
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-brand-teal/10 focus:border-brand-teal transition-all shadow-inner"
                >
                  {FONT_OPTIONS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="premium-card p-8 bg-brand-teal/5 border border-brand-teal/10 rounded-3xl flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-brand-teal flex items-center justify-center text-white shadow-lg shadow-brand-teal/20">
              <ShieldCheck size={28} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-brand-teal uppercase tracking-widest leading-none">Authority Active</p>
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight mt-1.5 leading-tight">Credential synthesize protocols are verified against institutional assets.</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 premium-card p-6 md:p-12 min-h-[800px] flex items-center justify-center bg-slate-50/50 border-none shadow-premium relative overflow-hidden" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, #e2e8f0 1.5px, transparent 0)',
          backgroundSize: '48px 48px',
        }}>
          <div className="absolute top-0 left-0 w-24 h-24 border-t-4 border-l-4 border-brand-teal/20 rounded-tl-[40px] m-10" />
          <div className="absolute bottom-0 right-0 w-24 h-24 border-b-4 border-r-4 border-brand-teal/20 rounded-br-[40px] m-10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-teal/5 rounded-full blur-[120px] pointer-events-none" />

          <div className="relative z-10 transition-all duration-700 hover:scale-[1.03] w-full max-w-[900px]">
            <svg
              ref={svgRef}
              id="cert-svg"
              viewBox="0 0 1600 1131"
              className="w-full h-auto rounded-2xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)]"
              style={{ display: 'block' }}
            >
              <style>
                {`.ink{stroke:#2f4a56;fill:none}
                  .serif{font-family:Georgia,'Times New Roman',serif}
                  .title{font-family:Georgia,'Times New Roman',serif;font-weight:700;fill:#2f4a56}
                  .body{font-family:Georgia,'Times New Roman',serif;fill:#33454d}
                  .small{font-family:Georgia,'Times New Roman',serif;fill:#33454d}`}
              </style>

              <rect x="0" y="0" width="1600" height="1131" fill="#ece9e1" />
              <rect x="46" y="46" width="1508" height="1039" className="ink" strokeWidth="2.4" />
              <rect x="58" y="58" width="1484" height="1015" className="ink" strokeWidth="1.2" />

              <defs>
                <g id="corner" className="ink" strokeWidth="2.1" strokeLinecap="round">
                  <path d="M70 46 C 150 46 196 44 230 22 C 246 12 240 -2 226 6 C 214 13 220 30 238 28" />
                  <path d="M46 70 C 46 150 44 196 22 230 C 12 246 -2 240 6 226 C 13 214 30 220 28 238" />
                  <path d="M96 96 C 168 110 206 150 214 214" />
                  <path d="M96 96 C 110 168 150 206 214 214" />
                  <circle cx="96" cy="96" r="3.4" fill="#2f4a56" stroke="none" />
                  <circle cx="238" cy="28" r="2.6" fill="#2f4a56" stroke="none" />
                  <circle cx="28" cy="238" r="2.6" fill="#2f4a56" stroke="none" />
                </g>
              </defs>
              <use href="#corner" x="0" y="0" />
              <use href="#corner" transform="translate(1600,0) scale(-1,1)" />
              <use href="#corner" transform="translate(0,1131) scale(1,-1)" />
              <use href="#corner" transform="translate(1600,1131) scale(-1,-1)" />

              <line x1="640" y1="52" x2="960" y2="52" stroke="#3a9d92" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
              <line x1="640" y1="1079" x2="960" y2="1079" stroke="#3a9d92" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />

              <image href={`${baseUrl}/IAK_Logo.png`} x="90" y="80" width="240" height="140" preserveAspectRatio="xMidYMid meet" />
              <image href={`${baseUrl}/AIT_Logo_Day.png`} x="1020" y="80" width="160" height="160" preserveAspectRatio="xMidYMid meet" />

              <text id="t-title-line" x="800" y="330" textAnchor="middle" className="title" fontSize="82" letterSpacing="2">
                <tspan>CERTIFICATE </tspan><tspan fill="#3a9d92">OF</tspan><tspan> COMPLETION</tspan>
              </text>

              <text x="800" y="430" textAnchor="middle" className="body" fontSize="46" fontStyle="italic">This is to certify that</text>

              <line x1="540" y1="470" x2="1060" y2="470" stroke="#3a9d92" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />

              <text
                id="t-name"
                x="800"
                y="590"
                textAnchor="middle"
                className="body"
                fontSize="56"
                fontWeight="700"
                fontFamily={formData.fontFamily}
              >
                {formData.name || 'Recipient Name'}
              </text>

              <line x1="250" y1="660" x2="1350" y2="660" stroke="#3a9d92" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />

              <text id="t-id" x="520" y="730" className="body" fontSize="34">
                {`Holding Student ID: ${formData.studentId}`}
              </text>
              <text id="t-line2" x="520" y="788" className="body" fontSize="34">
                {`Has completed a ${formData.duration} Certificate in`}
              </text>
              <text id="t-course" x="800" y="846" textAnchor="middle" className="body" fontSize="34">
                {`${formData.courseName} at AIT${branchSuffix}`}
              </text>

              <g className="ink" strokeWidth="2" strokeLinecap="round" transform="translate(800,905)">
                <line x1="-300" y1="0" x2="-70" y2="0" />
                <line x1="300" y1="0" x2="70" y2="0" />
                <path d="M-70 0 C -50 -16 -20 -16 0 -2 C 20 -16 50 -16 70 0 C 50 16 20 16 0 2 C -20 16 -50 16 -70 0 Z" />
                <path d="M0 -22 C -10 -34 10 -34 0 -22" />
                <path d="M0 22 C -10 34 10 34 0 22" />
                <path d="M-70 0 l-22 -8 M-70 0 l-22 8" />
                <path d="M70 0 l22 -8 M70 0 l22 8" />
                <circle cx="0" cy="0" r="3.4" fill="#2f4a56" stroke="none" />
              </g>

              <text id="t-signer" x="800" y="980" textAnchor="middle" className="body" fontSize="40" fontWeight="700">
                {formData.signer || ' '}
              </text>
              <text id="t-title" x="800" y="1018" textAnchor="middle" className="serif" fontSize="24" fontWeight="700" letterSpacing="1.5" fill="#cf6a2a">
                {formData.title}
              </text>
              <line x1="660" y1="1060" x2="940" y2="1060" stroke="#3a9d92" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />

              <text id="t-date" x="110" y="1050" className="small" fontSize="22" fill="#5b6c73">
                {dateLine}
              </text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
