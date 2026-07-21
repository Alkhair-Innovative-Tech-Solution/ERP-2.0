"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Timer,
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    ChevronLeft,
    GraduationCap,
    BookOpen,
} from "lucide-react";
import Navbar from "@/components/mainComponent/Navbar";
import Footer from "@/components/mainComponent/Footer";

function TestExecutionContent({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id: testId } = use(params);

    const [questions, setQuestions] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<
        "START" | "TESTING" | "SUBMITTING" | "RESULT"
    >("START");
    const [result, setResult] = useState<{
        status: string;
        score: number;
        message?: string;
    } | null>(null);
    const [timeLeft, setTimeLeft] = useState(600); // 10 minutes default

    useEffect(() => {
        async function fetchTestData() {
            try {
                const res = await fetch(`/proxy/get_auth?url=/api/tests/start/`);
                const data = await res.json();

                // Note: The backend 'start' endpoint likely needs an attempt_id or similar.
                // If the API structure matches the entrance test, we might need a different approach.
                // For now, mirroring the logic from start-test view.

                if (res.ok && data.data) {
                    setQuestions(data.data.questions || []);
                    setTimeLeft((data.data.duration || 10) * 60);
                    setLoading(false);
                } else {
                    setError(data.error || "Failed to load test data.");
                    setLoading(false);
                }
            } catch (err) {
                setError("Network error. Please try again.");
                setLoading(false);
            }
        }
        fetchTestData();
    }, [testId]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (testStatus === "TESTING" && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
        } else if (timeLeft === 0 && testStatus === "TESTING") {
            handleSubmit();
        }
        return () => clearInterval(timer);
    }, [testStatus, timeLeft]);

    const handleOptionSelect = (questionId: string, optionId: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    };

    const handleSubmit = async () => {
        setTestStatus("SUBMITTING");
        try {
            const payload = {
                attempt_id: testId, // Assuming testId is the attempt_id
                answers: answers,
            };

            const res = await fetch(`/api/admission/submit-test/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (res.ok) {
                setResult(data);
                setTestStatus("RESULT");
            } else {
                setError(data.error || "Failed to submit test.");
                setTestStatus("TESTING");
            }
        } catch (err) {
            setError("Submission failed. Check your connection.");
            setTestStatus("TESTING");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-cream dark:bg-Black">
                <div className="loader w-12 h-12 border-4 border-SeaGrean border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-600 dark:text-gray-300">
                    Preparing your assessment...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-cream dark:bg-Black px-4">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    Oops! Something went wrong
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
                    {error}
                </p>
                <button
                    onClick={() => router.push("/test")}
                    className="px-6 py-3 bg-SeaGrean text-white rounded-xl hover:opacity-90 transition-all"
                >
                    Return to Portal
                </button>
            </div>
        );
    }

    if (testStatus === "START") {
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
                            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                                Ready to Begin?
                            </h1>
                        </div>

                        <div className="space-y-4 text-gray-600 dark:text-gray-300 mb-8">
                            <p className="text-lg">
                                Please ensure you have a stable internet connection and are in a
                                quiet environment.
                            </p>
                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    Total Questions:{" "}
                                    <span className="font-semibold text-SeaGrean">
                                        {questions.length}
                                    </span>
                                </li>
                                <li>
                                    Duration:{" "}
                                    <span className="font-semibold text-SeaGrean">
                                        {Math.round(timeLeft / 60)} Minutes
                                    </span>
                                </li>
                                <li>Once started, the timer cannot be paused.</li>
                                <li>Do not refresh or close the browser window.</li>
                            </ul>
                        </div>

                        <button
                            onClick={() => setTestStatus("TESTING")}
                            className="w-full py-4 bg-SeaGrean dark:bg-Orange text-white text-xl font-bold rounded-2xl hover:scale-[1.02] transition-all shadow-lg"
                        >
                            Start My Assessment Now
                        </button>
                    </motion.div>
                </main>
                <Footer />
            </div>
        );
    }

    if (testStatus === "RESULT") {
        const isPassed = result?.status === "PASSED" || (result as any)?.passed;
        return (
            <div className="min-h-screen bg-cream dark:bg-Black">
                <Navbar />
                <main className="max-w-2xl mx-auto px-4 py-12">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-10 rounded-3xl shadow-2xl text-center ${isPassed
                            ? "bg-green-50 dark:bg-green-900/10 border-2 border-green-500/30"
                            : "bg-red-50 dark:bg-red-900/10 border-2 border-red-500/30"
                            }`}
                    >
                        {isPassed ? (
                            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6 animate-bounce" />
                        ) : (
                            <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
                        )}

                        <h2 className="text-4xl font-bold mb-4 text-gray-800 dark:text-white">
                            {isPassed ? "Assessment Passed!" : "Assessment Completed"}
                        </h2>
                        <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
                            {isPassed
                                ? "Great job! You have qualified for the next steps."
                                : "Thank you for completing the assessment. We will review your results."}
                        </p>

                        <div className="bg-white dark:bg-Black/40 p-6 rounded-2xl mb-8 inline-block">
                            <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">
                                Your Score
                            </p>
                            <p className="text-5xl font-black text-SeaGrean dark:text-Orange">
                                {result?.score}%
                            </p>
                        </div>

                        <button
                            onClick={() => router.push("/test")}
                            className="w-full py-4 bg-SeaGrean dark:bg-Orange text-white text-xl font-bold rounded-2xl hover:shadow-xl transition-all flex items-center justify-center"
                        >
                            Back to Portal
                            <ChevronRight className="ml-2 w-6 h-6" />
                        </button>
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
                        <span className="font-bold text-xl text-gray-800 dark:text-white hidden sm:inline">
                            Skill Assessment
                        </span>
                    </div>

                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2 bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-full">
                            <Timer
                                className={`w-5 h-5 ${timeLeft < 60 ? "text-red-500 animate-pulse" : "text-SeaGrean"
                                    }`}
                            />
                            <span
                                className={`font-mono font-bold text-lg ${timeLeft < 60
                                    ? "text-red-500"
                                    : "text-gray-700 dark:text-white"
                                    }`}
                            >
                                {Math.floor(timeLeft / 60)}:
                                {String(timeLeft % 60).padStart(2, "0")}
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
                    {currentQuestion && (
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
                                {["a", "b", "c", "d"].map((key) => {
                                    const optionText = currentQuestion[`option_${key}`];
                                    if (!optionText) return null;
                                    const optionId = key.toUpperCase();

                                    return (
                                        <button
                                            key={optionId}
                                            onClick={() =>
                                                handleOptionSelect(currentQuestion.id, optionId)
                                            }
                                            className={`p-6 text-left rounded-2xl border-2 transition-all group flex items-start space-x-4
                        ${answers[currentQuestion.id] === optionId
                                                    ? "border-SeaGrean bg-SeaGrean/5 shadow-md"
                                                    : "border-gray-100 dark:border-white/5 hover:border-SeaGrean/50 hover:bg-gray-50 dark:hover:bg-white/5"
                                                }`}
                                        >
                                            <div
                                                className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mt-1 transition-colors
                        ${answers[currentQuestion.id] === optionId
                                                        ? "border-SeaGrean bg-SeaGrean"
                                                        : "border-gray-300 dark:border-white/20"
                                                    }`}
                                            >
                                                {answers[currentQuestion.id] === optionId && (
                                                    <div className="w-2 h-2 bg-white rounded-full m-auto mt-[5px]" />
                                                )}
                                            </div>
                                            <span
                                                className={`text-lg transition-colors ${answers[currentQuestion.id] === optionId
                                                    ? "font-bold text-gray-900 dark:text-white"
                                                    : "text-gray-600 dark:text-gray-300"
                                                    }`}
                                            >
                                                {optionText}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex items-center justify-between pt-6 border-t dark:border-white/10 mt-auto">
                                <button
                                    disabled={currentIndex === 0}
                                    onClick={() => setCurrentIndex((prev) => prev - 1)}
                                    className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all
                    ${currentIndex === 0
                                            ? "opacity-30 cursor-not-allowed"
                                            : "hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600"
                                        }`}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                    <span>Previous</span>
                                </button>

                                {currentIndex === questions.length - 1 ? (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={testStatus === "SUBMITTING"}
                                        className="px-10 py-3 bg-red-500 text-white rounded-xl font-bold hover:shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center"
                                    >
                                        {testStatus === "SUBMITTING"
                                            ? "Submitting..."
                                            : "Finish Assessment"}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setCurrentIndex((prev) => prev + 1)}
                                        className="px-10 py-3 bg-SeaGrean text-white rounded-xl font-bold hover:shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center"
                                    >
                                        Next
                                        <ChevronRight className="ml-2 w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <div className="max-w-4xl mx-auto w-full px-4 pb-8">
                <div className="flex space-x-2 overflow-x-auto pb-4 scrollbar-hide justify-center">
                    {questions.map((q, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={`w-10 h-10 rounded-xl flex-shrink-0 transition-all font-bold text-sm
                ${currentIndex === i
                                    ? "bg-SeaGrean text-white scale-110 shadow-lg"
                                    : answers[questions[i].id]
                                        ? "bg-SeaGrean/20 text-SeaGrean"
                                        : "bg-gray-100 dark:bg-white/5 text-gray-500"
                                }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default function TestExecutionPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TestExecutionContent params={params} />
        </Suspense>
    );
}
