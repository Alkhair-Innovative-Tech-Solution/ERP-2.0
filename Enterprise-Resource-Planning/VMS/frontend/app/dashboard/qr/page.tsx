"use client";
import { useState } from "react";
import { QrCode, Printer, UserPlus, Download, Info } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PURPOSE_OPTIONS, PurposeType } from "@/lib/types";
import { formatCNICInput, cleanPhone } from "@/lib/utils";

export default function QRPage() {
  const [visitorForm, setVisitorForm] = useState({
    full_name: "",
    cnic: "",
    phone: "",
    email: "",
    company: "",
    host_name: "",
    purpose: "" as PurposeType | "",
    purpose_other: "",
  });
  const [generatedCard, setGeneratedCard] = useState<typeof visitorForm & { visitingId: string; date: string } | null>(null);

  // Permanent QR code - always the same checkin URL
  const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";
  const CHECKIN_URL = `${BASE_URL}/checkin`;

  const generateVisitingId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const random = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `VID-${random}`;
  };

  const handleGenerateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorForm.full_name) return;
    if (!visitorForm.host_name) { alert("Host/Meeting person is required"); return; }
    if (!visitorForm.purpose) { alert("Purpose of visit is required"); return; }
    
    setGeneratedCard({
      ...visitorForm,
      visitingId: generateVisitingId(),
      date: new Date().toISOString(),
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Create a canvas from the card and download
    const cardElement = document.getElementById('visitor-card');
    if (!cardElement) return;
    
    // Simple print dialog for now
    window.print();
  };

  const getPurposeLabel = (purpose: PurposeType) => {
    return PURPOSE_OPTIONS.find(p => p.value === purpose)?.label || purpose;
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900" style={{ fontFamily: "var(--font-display)" }}>
          QR Code & Visitor ID Cards
        </h1>
        <p className="text-ink-400 text-sm mt-0.5">
          Permanent QR code for check-in and professional visitor ID card generator
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Permanent QR Code */}
        <div className="card p-6 text-center">
          <h2 className="text-lg font-semibold text-ink-900 mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Permanent Check-in QR
          </h2>
          
          <div className="bg-white rounded-xl p-4 shadow-lg border-2 border-jade-300 inline-block mb-4">
            <QRCodeSVG
              value={CHECKIN_URL}
              size={180}
              level="H"
              includeMargin={true}
              fgColor="#0f0e0c"
            />
          </div>

          <div className="bg-jade-50 border border-jade-200 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-jade-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-jade-800">✓ Permanent QR Code</p>
                <p className="text-xs text-jade-600 mt-1">Never expires • Print & display at reception</p>
              </div>
            </div>
          </div>

          <div className="bg-ink-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-ink-400 mb-1">Check-in URL</p>
            <p className="text-xs font-mono text-ink-600">{CHECKIN_URL}</p>
          </div>

          <button 
            onClick={() => window.open(CHECKIN_URL, '_blank')} 
            className="btn-secondary w-full justify-center"
          >
            <QrCode className="w-4 h-4" />
            Open Check-in Page
          </button>
        </div>

        {/* Visitor Card Form */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-ink-900 mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Generate Visitor Card
          </h2>

          <form onSubmit={handleGenerateCard} className="space-y-3">
            <div>
              <label className="label">Full Name *</label>
              <input
                type="text"
                value={visitorForm.full_name}
                onChange={(e) => setVisitorForm({ ...visitorForm, full_name: e.target.value })}
                className="input"
                placeholder="Visitor's full name"
                required
              />
            </div>
            
            <div>
              <label className="label">CNIC</label>
              <input
                type="text"
                value={visitorForm.cnic}
                onChange={(e) => setVisitorForm({ ...visitorForm, cnic: formatCNICInput(e.target.value) })}
                className="input"
                placeholder="42201-1234567-1"
                maxLength={15}
              />
            </div>

            <div>
              <label className="label">Phone</label>
              <input
                type="text"
                value={visitorForm.phone}
                onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                className="input"
                placeholder="0300-1234567"
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={visitorForm.email}
                onChange={(e) => setVisitorForm({ ...visitorForm, email: e.target.value.toLowerCase() })}
                className="input"
                placeholder="visitor@example.com"
              />
            </div>

            <div>
              <label className="label">Company</label>
              <input
                type="text"
                value={visitorForm.company}
                onChange={(e) => setVisitorForm({ ...visitorForm, company: e.target.value })}
                className="input"
                placeholder="Company name"
              />
            </div>

            <div>
              <label className="label">Visiting / Host *</label>
              <input
                type="text"
                value={visitorForm.host_name}
                onChange={(e) => setVisitorForm({ ...visitorForm, host_name: e.target.value })}
                className="input"
                placeholder="Person they're visiting"
                required
              />
            </div>

            <div>
              <label className="label">Purpose *</label>
              <select
                value={visitorForm.purpose}
                onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value as PurposeType, purpose_other: "" })}
                className="input"
                required
              >
                <option value="">Select purpose...</option>
                {PURPOSE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {visitorForm.purpose === "other" && (
              <div>
                <label className="label">Specify Purpose *</label>
                <input
                  type="text"
                  value={visitorForm.purpose_other}
                  onChange={(e) => setVisitorForm({ ...visitorForm, purpose_other: e.target.value })}
                  className="input"
                  placeholder="Please describe the purpose"
                  required
                />
              </div>
            )}

            <button type="submit" className="btn-primary w-full justify-center">
              <UserPlus className="w-4 h-4" />
              Generate Visitor Card
            </button>
          </form>
        </div>

        {/* Visitor Card Preview */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-ink-900 mb-4" style={{ fontFamily: "var(--font-display)" }}>
            Card Preview
          </h2>

          {!generatedCard ? (
            <div className="flex items-center justify-center h-96 text-ink-400">
              <div className="text-center">
                <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Fill the form to generate visitor card</p>
              </div>
            </div>
          ) : (
            <div>
              {/* Visitor Card */}
              <div 
                id="visitor-card" 
                className="bg-white rounded-xl overflow-hidden shadow-xl border-2 border-ink-900 mb-4"
                style={{ width: "380px", margin: "0 auto" }}
              >
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-ink-900 to-ink-700 text-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium opacity-80 uppercase tracking-wider">Visitor</p>
                      <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>ID CARD</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg">
                      <QRCodeSVG
                        value={`${BASE_URL}/verify/${generatedCard.visitingId}`}
                        size={60}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Visiting ID */}
                  <div className="bg-ink-50 rounded-lg p-3 text-center border border-ink-200">
                    <p className="text-xs text-ink-500 uppercase mb-1">Visiting ID</p>
                    <p className="text-2xl font-bold font-mono tracking-wider text-ink-900">{generatedCard.visitingId}</p>
                  </div>

                  {/* Visitor Details */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-ink-500 uppercase w-20 flex-shrink-0">Name</span>
                      <span className="text-sm font-bold text-ink-900">{generatedCard.full_name}</span>
                    </div>

                    {generatedCard.company && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-ink-500 uppercase w-20 flex-shrink-0">Company</span>
                        <span className="text-sm font-semibold text-ink-900">{generatedCard.company}</span>
                      </div>
                    )}

                    {generatedCard.cnic && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-ink-500 uppercase w-20 flex-shrink-0">CNIC</span>
                        <span className="text-sm font-mono text-ink-900">{generatedCard.cnic}</span>
                      </div>
                    )}

                    {generatedCard.phone && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-ink-500 uppercase w-20 flex-shrink-0">Phone</span>
                        <span className="text-sm text-ink-900">{generatedCard.phone}</span>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-ink-500 uppercase w-20 flex-shrink-0">Visiting</span>
                      <span className="text-sm font-semibold text-ink-900">{generatedCard.host_name}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-ink-500 uppercase w-20 flex-shrink-0">Purpose</span>
                      <span className="text-sm text-ink-900">
                        {generatedCard.purpose === "other" 
                          ? generatedCard.purpose_other 
                          : generatedCard.purpose 
                            ? getPurposeLabel(generatedCard.purpose) 
                            : "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="pt-3 border-t border-ink-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-500">Date:</span>
                      <span className="font-semibold text-ink-900">
                        {new Date(generatedCard.date).toLocaleDateString('en-PK', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-ink-500">Time:</span>
                      <span className="font-semibold text-ink-900">
                        {new Date(generatedCard.date).toLocaleTimeString('en-PK', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-ink-50 p-3 text-center border-t border-ink-200">
                  <p className="text-xs font-semibold text-rose-600">⚠ Must be worn visibly at all times</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={handlePrint} className="btn-secondary flex-1 justify-center">
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button onClick={handleDownload} className="btn-secondary flex-1 justify-center">
                  <Download className="w-4 h-4" />
                  Save
                </button>
                <button 
                  onClick={() => { setGeneratedCard(null); setVisitorForm({ full_name: "", cnic: "", phone: "", email: "", company: "", host_name: "", purpose: "", purpose_other: "" }); }} 
                  className="btn-primary flex-1 justify-center"
                >
                  <UserPlus className="w-4 h-4" />
                  New
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="mt-6 card p-6">
        <p className="text-xs font-semibold text-ink-600 mb-3 uppercase tracking-wide">How It Works</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: "1", title: "Scan QR", desc: "Visitor scans permanent QR code at reception" },
            { step: "2", title: "Fill Details", desc: "Enters personal info and purpose of visit" },
            { step: "3", title: "Get ID Card", desc: "Receptionist generates and prints visitor card" },
            { step: "4", title: "Entry", desc: "Visitor wears card and is allowed entry" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-full bg-jade-100 text-jade-700 text-sm flex items-center justify-center flex-shrink-0 font-bold">
                {item.step}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                <p className="text-xs text-ink-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #visitor-card, #visitor-card * {
            visibility: visible;
          }
          #visitor-card {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            max-width: 380px;
          }
        }
      `}</style>
    </div>
  );
}
