"use client";

import { useEffect, useState, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    CheckCircle2,
    AlertCircle,
    FileText,
    Calendar,
    Award,
    ChevronLeft
} from "lucide-react";
import Navbar from "@/components/mainComponent/Navbar";
import Footer from "@/components/mainComponent/Footer";

function ResultDetailContent({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id: attemptId } = use(params);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchResult() {
            try {
                const res = await fetch(`/proxy/get_auth?url=/api/tests/result/${attemptId}/`);
                const data = await res.json();

                if (res.ok && data.data) {
                    setResult(data.data);
                } else {
                    setError(data.error || "Failed to load result details.");
                }
            } catch (err) {
                setError("Network error. Please try again.");
            } finally {
                setLoading(false);
            }
        }
        fetchResult();
    }, [attemptId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-Black">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-SeaGrean mx-auto"></div>
            </div>
        );
    }

    if (error || !result) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-cream dark:bg-Black p-4">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Error Loading Result</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">{error || "Data not available."}</p>
                <button
                    onClick={() => router.push("/test")}
                    className="px-6 py-2 bg-SeaGrean text-white rounded-xl"
                >
                    Back to Portal
                </button>
            </div>
        );
    }

    const isPassed = result.is_passed || result.status === 'PASSED';

    return (
        <div className="min-h-screen bg-cream dark:bg-Black">
            <Navbar />
            <main className="max-w-4xl mx-auto px-4 py-12">
                <button
                    onClick={() => router.push("/test")}
                    className="flex items-center text-SeaGrean hover:underline mb-8 font-medium"
                >
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Back to Assessments
                </button>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-Blue/20 rounded-3xl shadow-xl overflow-hidden border border-gray-100"
                >
                    {/* Header Section */}
                    <div className={`p-8 text-center ${isPassed ? 'bg-SeaGrean/5' : 'bg-red-50'}`}>
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isPassed ? 'bg-SeaGrean/20' : 'bg-red-100'}`}>
                            {isPassed ? (
                                <Award className="w-10 h-10 text-SeaGrean" />
                            ) : (
                                <FileText className="w-10 h-10 text-red-500" />
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-Blue dark:text-white mb-2">
                            {result.test_title} Result
                        </h1>
                        <p className={`text-lg font-bold ${isPassed ? 'text-SeaGrean' : 'text-red-500'}`}>
                            {isPassed ? "PASSED" : "COMPLETED"}
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 border-b dark:border-white/10">
                        <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-2xl text-center">
                            <p className="text-sm text-gray-500 uppercase tracking-widest mb-1">Score</p>
                            <p className="text-4xl font-black text-Blue dark:text-white">{result.score}</p>
                            <p className="text-xs text-gray-400 mt-1">out of {result.total_marks}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-2xl text-center">
                            <p className="text-sm text-gray-500 uppercase tracking-widest mb-1">Percentage</p>
                            <p className="text-4xl font-black text-SeaGrean">{result.percentage}%</p>
                            <p className="text-xs text-gray-400 mt-1">Passing: {result.passing_marks || '50'}%</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-white/5 p-6 rounded-2xl text-center">
                            <p className="text-sm text-gray-500 uppercase tracking-widest mb-1">Status</p>
                            <p className={`text-2xl font-bold mt-2 ${isPassed ? 'text-SeaGrean' : 'text-Orange'}`}>
                                {isPassed ? "Qualified" : "Completed"}
                            </p>
                        </div>
                    </div>

                    {/* Details Section */}
                    <div className="p-8 space-y-6">
                        <h3 className="text-xl font-bold text-Blue dark:text-white">Assessment Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-xs text-gray-500">Date Attempted</p>
                                    <p className="text-sm font-medium dark:text-white">
                                        {result.start_time ? new Date(result.start_time).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
                                <CheckCircle2 className="w-5 h-5 text-SeaGrean" />
                                <div>
                                    <p className="text-xs text-gray-500">Enrollment Status</p>
                                    <p className="text-sm font-medium dark:text-white">
                                        {result.enrollment_status || 'Under Review'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 p-6 bg-Blue text-white rounded-2xl flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-lg">Next Steps</h4>
                                <p className="text-blue-100 text-sm">
                                    {isPassed
                                        ? "Your enrollment is being processed. You will receive an email shortly."
                                        : "Please wait for further instructions from our administration team."}
                                </p>
                            </div>
                            <ChevronRight className="w-8 h-8 opacity-50" />
                        </div>
                    </div>
                </motion.div>
            </main>
            <Footer />
        </div>
    );
}

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div>Loading result...</div>}>
            <ResultDetailContent params={params} />
        </Suspense>
    );
}
