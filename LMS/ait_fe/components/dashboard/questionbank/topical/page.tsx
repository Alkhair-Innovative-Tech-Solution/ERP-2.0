"use client";
import { useUser } from "../../../../../hooks/useUser";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useHandleLogout from "../../../../lib/logout";
import { FaBookOpen, FaFolder } from "react-icons/fa";

export default function TopicalPage() {
  const handleLogout = useHandleLogout();
  const user = useUser((state) => state.user);
  const router = useRouter();
  const [data, setData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [openSubjects, setOpenSubjects] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const questionBankId = (localStorage.getItem("question-bank-id") ?? " ");

    const getTopicalData = async () => {
      if (!questionBankId) {
        setError("Question Bank ID is missing.");
        return;
      }

      try {
        const res = await fetch(`/backend/api/questionbank/topical/${questionBankId}/`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const data_api = await res.json();
        if (res.ok) {
          setData(data_api?.my_question_bank_data);
          setStatus(data_api.status);
        } else {
          throw new Error("Failed to fetch data");
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : "An unknown error occurred");
      }
    };

    getTopicalData();
  }, []);

  useEffect(() => {
    if (status === 401) {
      console.log("Unauthorized access, redirecting to login...");
      handleLogout();
    }
  }, [status, handleLogout]);

  const handlePushLogicMode = (questionbankid: string, topic: string, subject: string) => {
    const solve_t = {
      questionbankid: questionbankid,
      questionbank_name: data.name,
      subject: subject,
      topic: topic,
    };

    localStorage.setItem("solve-topical-dynamic", JSON.stringify(solve_t));

    const solve = {
      questionBankId: questionbankid,
      topic: topic,
      subject: subject
    }
    localStorage.removeItem("solve-topical");
    localStorage.setItem("solve-topical", JSON.stringify(solve));
    router.push("/dashboard/question-bank/topical/Test");
  };

  if (error) {
    return <div>{error}</div>;
  }
  const toggleSubject = (subject: string) => {
    setOpenSubjects((prev) => ({
      ...prev,
      [subject]: !prev[subject],
    }));
  };

  return (
    <div className="flex-1 md:p-6 p-4 lg:py-7 py-4 bg-gray-100 md:mr-0 w-full">
      {/* <h1 className="text-lg md:text-3xl w-full font-semibold mb-4 md:mb-0 md:pb-9">
        Welcome Back, {user?.full_name} 👋
      </h1> */}

      <div>
        {data?.image ? (
          <div className="w-full rounded-md overflow-hidden relative aspect-[4/2] sm:aspect-[3/1]">
            <Image
              src={`${process.env.NEXT_PUBLIC_API_URL}${data.image}`}
              alt={data.name ?? "Question Bank Image"}
              fill
              className="object-contain"
              quality={100}
              priority
              sizes="100vw"
            />
          </div>
        ) : (
          <div className="w-full h-[200px] sm:h-[300px] bg-gray-200 animate-pulse rounded-md" />
        )}

        <div className="text-center mt-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">{data.name}</h2>
          <p className="text-gray-500 text-sm mt-1">Total Questions: {data.question_count}</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center mt-5 gap-3 sm:space-x-6 text-white">
          <button
            className="bg-orange-600 rounded-3xl px-6 py-2 w-full sm:w-auto"
            onClick={() => router.push("/dashboard/question-bank/solve")}
          >
            Yearly
          </button>
          <button
            className="bg-orange-600 rounded-3xl px-6 py-2 w-full sm:w-auto"
            onClick={() => router.push("/dashboard/question-bank/topical")}
          >
            Topical
          </button>
        </div>
      </div>

      {data ? (
        <>
          {data?.subjects &&
            Object.keys(data.subjects).map((subject) => {
              const subjectData = data.subjects[subject];
              const totalQuestions = subjectData.total_questions || 0;
              const totalTopics = Object.keys(subjectData.topics || {}).length;
              const isOpen = openSubjects[subject] || false;

              return (
                <div key={subject}
                  className="bg-gray-100 shadow-md rounded-lg mt-5 border-2 border-white p-4 md:p-5"
                >
                  {/* Subject Header */}
                  <div
                    className="grid grid-cols-1 sm:grid-cols-3 items-center cursor-pointer gap-2 md:gap-4"
                    role="button"
                    onClick={() => toggleSubject(subject)}
                    onKeyDown={(e) => e.key === 'Enter' && toggleSubject(subject)}
                    aria-label={`Toggle subject: ${subject}`}
                  >
                    <h1 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center">
                      <span className="pr-2"><FaFolder /></span> {subject}
                    </h1>

                    <p className="text-gray-600 font-semibold text-center">{totalQuestions} Questions</p>

                    <div className="flex justify-end items-center">
                      <p className="text-gray-600 font-semibold">{totalTopics} Topics</p>
                      <span className="ml-2">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Topics */}
                  {isOpen && (
                    <div className="px-2 sm:px-4 py-4">
                      {subjectData.topics &&
                        Object.entries(subjectData.topics).map(([topic, total_questions]) => {
                          const total = total_questions as number;
                          return (
                            <div key={topic} className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4 py-2 border-b border-gray-200">
                              <h2 className="text-md font-semibold text-gray-800 flex items-center">
                                <span className="pr-2"><FaBookOpen /></span>{topic}
                              </h2>

                              <p className="text-gray-500 text-sm text-center sm:text-left">{total} Questions</p>

                              <div className="flex justify-end">
                                <button
                                  onClick={() => handlePushLogicMode(data.id, topic, subject)}
                                  className="bg-orange-600 text-white px-4 py-1 rounded-3xl"
                                >
                                  Start Practice
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
        </>
      ) : (
        <p>Unable to show your question bank</p>
      )}
    </div>
  );
}
