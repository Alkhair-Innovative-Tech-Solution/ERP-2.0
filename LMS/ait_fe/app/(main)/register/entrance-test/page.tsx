"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, AlertCircle, CheckCircle2, Timer, ChevronRight, ChevronLeft, GraduationCap } from 'lucide-react';
import Navbar from "@/components/mainComponent/Navbar";
import Footer from "@/components/mainComponent/Footer";

function EntranceTestContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const leadId = searchParams.get("lead_id");

    const [questions, setQuestions] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<'START' | 'TESTING' | 'SUBMITTING' | 'RESULT'>('START');
    const [result, setResult] = useState<{ status: string, score: number, message?: string } | null>(null);
    const [timeLeft, setTimeLeft] = useState(600); // 10 minutes

    useEffect(() => {
        if (!leadId) {
            setError("Invalid session. Please start registration again.");
            setLoading(false);
            return;
        }

        const fetchQuestions = async () => {
            try {
                const res = await fetch(`/api/admission/entrance-test/${leadId}/`);
                const data = await res.json();
                if (res.ok) {
                    setQuestions(data.questions_data || []);
                } else {
                    setError(data.error || "Failed to load test questions.");
                }
            } catch (err) {
                setError("Network error. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchQuestions();
    }, [leadId]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (testStatus === 'TESTING' && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (timeLeft === 0 && testStatus === 'TESTING') {
            handleSubmit();
        }
        return () => clearInterval(timer);
    }, [testStatus, timeLeft]);

    const handleOptionSelect = (questionId: string, optionId: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    };

    const handleSubmit = async () => {
        setTestStatus('SUBMITTING');
        try {
            const questionAttempts = questions.map(q => {
                const selectedOptionId = answers[q.id];
                const selectedOption = q.options.find((opt: any) => opt.id === selectedOptionId);
                return {
                    question_id: q.id,
                    selected_option: selectedOptionId,
                    is_correct: selectedOption ? selectedOption.is_correct : false
                };
            });

            const res = await fetch(`/api/admission/entrance-test/${leadId}/submit/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question_attempts: questionAttempts })
            });

            const data = await res.json();
            if (res.ok) {
                setResult(data);
                setTestStatus('RESULT');
            } else {
                setError(data.error || "Failed to submit test.");
                setTestStatus('TESTING');
            }
        } catch (err) {
            setError("Submission failed. Check your connection.");
            setTestStatus('TESTING');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-cream dark:bg-Black">
                <div className="loader w-12 h-12 border-4 border-SeaGrean border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-600 dark:text-gray-300">Loading your entrance test...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-cream dark:bg-Black px-4">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Oops! Something went wrong</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">{error}</p>
                <button
                    onClick={() => window.location.href = '/register'}
                    className="px-6 py-3 bg-SeaGrean text-white rounded-xl hover:opacity-90 transition-all"
                >
                    Return to Registration
                </button>
            </div>
        );
    }

    if (testStatus === 'START') {
        return (
            <div className="min-h-screen bg-cream dark:bg-Black">
                <Navbar />
                <main className="max-w-4xl mx-auto px-4 py-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-Blue/20 p-8 rounded-3xl shadow-xl border border-SeaGrean/20"
                    >
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="p-3 bg-SeaGrean/10 rounded-2xl">
                                <BookOpen className="w-8 h-8 text-SeaGrean dark:text-Orange" />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Skill Assessment</h1>
                        </div>

                        <div className="space-y-4 text-gray-600 dark:text-gray-300 mb-8">
                            <p className="text-lg">This test checks your knowledge for the course you selected.</p>
                            <ul className="list-disc list-inside space-y-2">
                                <li>Total Questions: <span className="font-semibold text-SeaGrean">{questions.length}</span></li>
                                <li>Time Limit: <span className="font-semibold text-SeaGrean">10 Minutes</span></li>
                                <li>Each question has 4 choices. Pick the best one.</li>
                                <li>You cannot go back after you submit.</li>
                            </ul>
                        </div>

                        <button
                            onClick={() => setTestStatus('TESTING')}
                            className="w-full py-4 bg-SeaGrean dark:bg-Orange text-white text-xl font-bold rounded-2xl hover:scale-[1.02] transition-all shadow-lg"
                        >
                            Start Test
                        </button>
                    </motion.div>
                </main>
                <Footer />
            </div>
        );
    }

    if (testStatus === 'RESULT') {
        const isPassed = result?.passed || result?.status === 'PASSED';

        return (
            <div className="min-h-screen bg-cream dark:bg-Black">
                <Navbar />
                <main className="max-w-2xl mx-auto px-4 py-12">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-10 rounded-3xl shadow-2xl text-center ${isPassed ? 'bg-green-50 dark:bg-green-900/10 border-2 border-green-500/30' : 'bg-red-50 dark:bg-red-900/10 border-2 border-red-500/30'
                            }`}
                    >
                        {isPassed ? (
                            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6 animate-bounce" />
                        ) : (
                            <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
                        )}

                        <h2 className="text-4xl font-bold mb-4 text-gray-800 dark:text-white">
                            {isPassed ? 'Congratulations!' : 'Almost There!'}
                        </h2>
                        <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
                            {isPassed
                                ? 'You have successfully passed the entrance assessment.'
                                : 'Unfortunately, you did not meet the passing criteria this time.'}
                        </p>

                        {/* Score Card */}
                        <div className="bg-white dark:bg-Black/40 p-6 rounded-2xl mb-6 inline-block">
                            <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Your Score</p>
                            <p className="text-5xl font-black text-SeaGrean dark:text-Orange">{result?.score || result?.correct_count || 0}</p>
                            <p className="text-sm text-gray-400 mt-1">
                                out of {result?.total_marks || result?.total_questions || 0} marks
                            </p>
                            {result?.percentage != null && (
                                <p className="text-sm text-gray-500 mt-2 font-semibold">
                                    {result.correct_count || 0} / {result.total_questions || 0} correct &middot; {result.percentage}%
                                </p>
                            )}
                        </div>

                        {isPassed && (
                            <>
                                {result?.enrollment_id && (
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-400 p-4 rounded-2xl mb-4">
                                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                            Enrollment ID: {result.enrollment_id}
                                        </p>
                                    </div>
                                )}
                                <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 p-6 rounded-2xl mb-6">
                                    <div className="flex items-center justify-center gap-2 mb-3">
                                        <AlertCircle className="w-6 h-6 text-blue-600" />
                                        <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                                            What's Next
                                        </h3>
                                    </div>
                                    <div className="text-left space-y-2 text-sm text-blue-800 dark:text-blue-200">
                                        <p className="font-bold">📝 Follow these steps (check your email for details):</p>
                                        <ol className="list-decimal list-inside space-y-1 ml-2">
                                            <li>Pay the security deposit at our office</li>
                                            <li>Receive deposit slip with code from admin</li>
                                            <li>Enter your deposit slip code to verify</li>
                                            <li>Your LMS account will be created automatically</li>
                                        </ol>
                                        <p className="mt-3 bg-blue-100/50 dark:bg-blue-900/30 p-2 rounded-lg text-xs italic">
                                            * A copy of these instructions has been sent to your registered email address.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push(`/register?lead_id=${leadId}&phase=3`)}
                                    className="w-full py-4 bg-SeaGrean dark:bg-Orange text-white text-xl font-bold rounded-2xl hover:shadow-xl transition-all flex items-center justify-center"
                                >
                                    Continue to Registration
                                    <ChevronRight className="ml-2 w-6 h-6" />
                                </button>
                            </>
                        )}

                        {!isPassed && (
                            <div className="space-y-4">
                                <p className="text-gray-500">You can try again later, or contact our support team for help.</p>
                                <button
                                    onClick={() => router.push('/')}
                                    className="px-8 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-xl hover:opacity-90"
                                >
                                    Back to Home
                                </button>
                            </div>
                        )}
                    </motion.div>
                </main>
                <Footer />
            </div>
        );
    }

    const currentQuestion = questions[currentIndex];

    return (
        <div className="min-h-screen bg-cream dark:bg-Black flex flex-col">
            <header className="bg-white dark:bg-Blue/40 border-b dark:border-white/10 p-4 sticky top-0 z-50 backdrop-blur-md">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <GraduationCap className="w-8 h-8 text-SeaGrean" />
                        <span className="font-bold text-xl text-gray-800 dark:text-white hidden sm:inline">Skill Test</span>
                    </div>

                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2 bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-full">
                            <Timer className={`w-5 h-5 ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-SeaGrean'}`} />
                            <span className={`font-mono font-bold text-lg ${timeLeft < 60 ? 'text-red-500' : 'text-gray-700 dark:text-white'}`}>
                                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                            </span>
                        </div>
                    </div>

                    <div className="text-sm font-medium text-gray-500">
                        Question {currentIndex + 1} of {questions.length}
                    </div>
                </div>
            </header>

            <main className="flex-grow max-w-4xl mx-auto w-full px-4 py-8">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="bg-white dark:bg-Blue/20 p-8 rounded-3xl shadow-xl border border-transparent hover:border-SeaGrean/20 transition-all h-full flex flex-col"
                    >
                        <div className="mb-8">
                            <span className="inline-block px-3 py-1 bg-SeaGrean/10 text-SeaGrean rounded-full text-xs font-bold mb-4 uppercase tracking-widest">
                                Question {currentIndex + 1}
                            </span>
                            <h3 className="text-2xl font-semibold text-gray-800 dark:text-white leading-snug">
                                {currentQuestion.question_text}
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 flex-grow">
                            {currentQuestion.options.map((option: any) => (
                                <button
                                    key={option.id}
                                    onClick={() => handleOptionSelect(currentQuestion.id, option.id)}
                                    className={`p-6 text-left rounded-2xl border-2 transition-all group flex items-start space-x-4
                    ${answers[currentQuestion.id] === option.id
                                            ? 'border-SeaGrean bg-SeaGrean/5 shadow-md'
                                            : 'border-gray-100 dark:border-white/5 hover:border-SeaGrean/50 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                >
                                    <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mt-1 transition-colors
                    ${answers[currentQuestion.id] === option.id
                                            ? 'border-SeaGrean bg-SeaGrean'
                                            : 'border-gray-300 dark:border-white/20'}`}>
                                        {answers[currentQuestion.id] === option.id && <div className="w-2 h-2 bg-white rounded-full m-auto mt-[5px]" />}
                                    </div>
                                    <span className={`text-lg transition-colors ${answers[currentQuestion.id] === option.id ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                        {option.option_text}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-6 border-t dark:border-white/10 mt-auto">
                            <button
                                disabled={currentIndex === 0}
                                onClick={() => setCurrentIndex(prev => prev - 1)}
                                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all
                  ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600'}`}
                            >
                                <ChevronLeft className="w-5 h-5" />
                                <span>Previous</span>
                            </button>

                            {currentIndex === questions.length - 1 ? (
                                <button
                                    onClick={handleSubmit}
                                    disabled={testStatus === 'SUBMITTING'}
                                    className="px-10 py-3 bg-red-500 text-white rounded-xl font-bold hover:shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center"
                                >
                                    {testStatus === 'SUBMITTING' ? 'Submitting...' : 'Finish Test'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setCurrentIndex(prev => prev + 1)}
                                    className="px-10 py-3 bg-SeaGrean text-white rounded-xl font-bold hover:shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center"
                                >
                                    Next
                                    <ChevronRight className="ml-2 w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </main>

            <div className="max-w-4xl mx-auto w-full px-4 pb-8">
                <div className="flex space-x-2 overflow-x-auto pb-4 scrollbar-hide justify-center">
                    {questions.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={`w-10 h-10 rounded-xl flex-shrink-0 transition-all font-bold text-sm
                ${currentIndex === i ? 'bg-SeaGrean text-white scale-110 shadow-lg' :
                                    answers[questions[i].id] ? 'bg-SeaGrean/20 text-SeaGrean' : 'bg-gray-100 dark:bg-white/5 text-gray-500'}`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function EntranceTestPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <EntranceTestContent />
        </Suspense>
    );
}
