'use client';

import { useState } from 'react';
import Navbar from '@/components/mainComponent/Navbar';
import Footer from '@/components/mainComponent/Footer';
import { CheckCircle, XCircle, Search, Award } from 'lucide-react';

interface CertificateResult {
  valid: boolean;
  certificate?: {
    certificate_number: string;
    student_name: string;
    course_name: string;
    issued_date: string;
    grade?: string;
  };
  message?: string;
}

export default function VerifyCertificatePage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CertificateResult | null>(null);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!code.trim()) {
      setError('Please enter a verification code');
      return;
    }
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/certifications/certifications/verify/?verification_code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (res.ok && data.verified) {
        const cert = data.certificate || data;
        setResult({
          valid: true,
          certificate: {
            certificate_number: cert.certificate_number || code,
            student_name: cert.student_name || 'N/A',
            course_name: cert.course_title || cert.course_name || 'N/A',
            issued_date: cert.issued_date || cert.created_at || '',
            grade: cert.grade,
          },
        });
      } else {
        setResult({ valid: false, message: data.error || data.message || 'Certificate not found or invalid.' });
      }
    } catch {
      setResult({ valid: false, message: 'Could not connect to verification server. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-lg w-full">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-50 rounded-2xl mb-4">
              <Award className="w-8 h-8 text-teal-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Certificate Verification</h1>
            <p className="text-gray-500 mt-2">
              Enter the verification code printed on the certificate to confirm its authenticity.
            </p>
          </div>

          {/* Search Box */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Verification Code
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="e.g. AIT-2024-0001"
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <button
                onClick={handleVerify}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>

          {/* Result */}
          {result && (
            <div className={`mt-6 rounded-2xl border p-6 ${result.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {result.valid ? (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-7 h-7 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-green-800 text-lg">Certificate is Authentic</p>
                      <p className="text-green-600 text-sm">This certificate has been verified as genuine.</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 space-y-3 border border-green-100">
                    <Row label="Certificate No." value={result.certificate!.certificate_number} />
                    <Row label="Student Name" value={result.certificate!.student_name} />
                    <Row label="Course" value={result.certificate!.course_name} />
                    {result.certificate!.issued_date && (
                      <Row
                        label="Issue Date"
                        value={new Date(result.certificate!.issued_date).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      />
                    )}
                    {result.certificate!.grade && (
                      <Row label="Grade" value={result.certificate!.grade} />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <XCircle className="w-7 h-7 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-red-800 text-lg">Certificate Not Found</p>
                    <p className="text-red-600 text-sm mt-1">{result.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            Al Khair Institute of Technology &bull; Certificate Verification Portal
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="text-gray-900 font-semibold">{value}</span>
    </div>
  );
}
