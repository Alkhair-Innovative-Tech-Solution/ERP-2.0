"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TestItem = {
  id: string;
  course: string;
  test: string;
  attempt_number: number;
  status: string;
  test_attempted: boolean;
  user: string;
  created_at: string;
};

type CourseWithTests = {
  course_id: string;
  course_name: string;
  tests: TestItem[];
};

export default function TestPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestItem | null>(null);
  const [courses, setCourses] = useState<CourseWithTests[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/verify");
        const data = await res.json();
        if (!data.authenticated) {
          router.push("/register");
        }
      } catch {
        router.push("/register");
      }
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    async function getTest() {
      try {
        const res = await fetch("/proxy/get_auth?url=/api/tests/my-tests/");
        const json = await res.json();
        console.log("fetched test data:", json);

        if (Array.isArray(json.data)) {
          setCourses(json.data);
        } else {
          setCourses([]);
          console.error("Received invalid data format:", json.data);
        }
      } catch (err) {
        console.error("Failed to fetch test data:", err);
        router.push("/");
      }
    }
    getTest();
  }, [router]);

  const openModal = (test: TestItem) => {
    setSelectedTest(test);
    setIsModalOpen(true);
  };

  const beginTest = () => {
    if (selectedTest) {
      router.push(`/test/${selectedTest.id}`);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-cream p-6 text-Black">
      {/* Top Banner */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="w-full max-w-2xl bg-Blue text-cream p-4 rounded-xl shadow-lg mb-8"
      >
        <h1 className="text-2xl font-bold">Welcome to Your Assessment Portal</h1>
        <p className="mt-2">
          Track your progress and complete your evaluations here.
        </p>
      </motion.div>

      {/* Course Cards */}
      <div className="w-full max-w-2xl space-y-6">
        {courses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center p-8 bg-Blue/5 rounded-xl"
          >
            <p className="text-xl text-Blue">No assessments found for your account.</p>
          </motion.div>
        ) : (
          courses.map((course) => (
            <motion.div
              key={course.course_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100"
            >
              <div className="bg-Blue text-cream p-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold">{course.course_name}</h2>
                <GraduationCap className="w-6 h-6 opacity-50" />
              </div>

              <div className="p-6">
                {course.tests.map((test, index) => (
                  <div key={test.id} className={`${index !== 0 ? 'mt-6 pt-6 border-t border-gray-200' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-SeaGrean/10 flex items-center justify-center">
                          <span className="text-2xl">📝</span>
                        </div>
                        <div>
                          <h3 className="font-medium text-lg text-Blue">{test.test}</h3>
                          <p className="text-sm text-Black/60">Status: <span className={test.test_attempted ? "text-SeaGrean font-bold" : "text-Orange font-bold"}>{test.test_attempted ? "Attempted" : "Pending"}</span></p>
                        </div>
                      </div>

                      {test.test_attempted && (
                        <div className="text-right">
                          <div className="text-xs text-gray-400 uppercase">Score</div>
                          <div className="text-2xl font-black text-SeaGrean">{test.status === 'PASSED' ? 'PASS' : test.status}</div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center gap-2 text-sm text-Black/70">
                        <span className="w-5 h-5 rounded-full bg-SeaGrean/10 text-SeaGrean flex items-center justify-center text-xs">✓</span>
                        <span>Evaluation of skills</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-Black/70">
                        <span className="w-5 h-5 rounded-full bg-Orange/10 text-Orange flex items-center justify-center text-xs text-[10px]">Attempt</span>
                        <span>Attempts: {test.attempt_number}</span>
                      </div>
                    </div>

                    {test.test_attempted ? (
                      <div className="flex gap-3">
                        <button
                          disabled
                          className="flex-1 py-3 bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          Already Attempted
                        </button>
                        <button
                          onClick={() => router.push(`/test/result/${test.id}`)}
                          className="px-6 py-3 border-2 border-SeaGrean text-SeaGrean rounded-lg font-medium hover:bg-SeaGrean/5 transition-colors"
                        >
                          View Details
                        </button>
                      </div>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => openModal(test)}
                        className="w-full py-3 bg-SeaGrean text-white rounded-lg font-bold hover:bg-SeaGrean/90 transition-colors shadow-md flex items-center justify-center gap-2"
                      >
                        Start Assessment <span>→</span>
                      </motion.button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && selectedTest && (
          <motion.div
            className="fixed inset-0 bg-Black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-cream text-Black rounded-2xl p-8 shadow-2xl max-w-lg w-full relative"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute -top-4 -right-4 bg-Orange text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-Orange/90 transition-colors shadow-lg"
              >
                ×
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-SeaGrean/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-SeaGrean" />
                </div>
                <h2 className="text-2xl font-bold text-Blue mb-2">Ready to Begin?</h2>
                <p className="text-Black/70">Review the guidelines for <b>{selectedTest.test}</b></p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100">
                  <span className="text-2xl">📖</span>
                  <p className="text-sm">Read all questions thoroughly before answering.</p>
                </div>
                <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100">
                  <span className="text-2xl">⏱️</span>
                  <p className="text-sm">Manage your time wisely. Once started, the timer cannot be paused.</p>
                </div>
              </div>

              <motion.button
                onClick={beginTest}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 text-xl font-bold rounded-xl bg-SeaGrean text-white shadow-xl hover:bg-SeaGrean/90 transition-all flex items-center justify-center gap-2"
              >
                Begin Assessment 🚀
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
