"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useHandleLogout from "@/lib/logout";
import Image from "next/image";

type QuestionsData = {
  [bankId: string]: {
    question_bank_name: string;
    question_bank_image?: string;
    subcategories: {
      [subId: string]: {
        subcategory_name: string;
        years: string[];
        total_years: number;
      };
    };
  };
};

const SavedQuestions: React.FC = () => {
  const [questionsData, setQuestionsData] = useState<QuestionsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const handlelogout = useHandleLogout()
  const [status, setStatus] = useState<number>(0)
  const [expandedSubs, setExpandedSubs] = useState<{ [key: string]: boolean }>({});


  useEffect(() => {
    if (status === 401) {
      handlelogout()
    }
  }, [status, handlelogout])

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch("/backend/api/SavedQuestions/getSummary/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        setStatus(res.status)
        const data = await res.json();

        if (!data || !data.data || !data.data.saved_questions) {
          setError("No saved questions found.");
          return;
        }
        setQuestionsData(data.data.saved_questions);
      } catch (error) {
        setError("Failed to load question banks.");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  const handleSubcategorySelect = (subId: string) => {
    router.push(`/dashboard/saved-questions/${subId}`);
  };

  const toggleSubcategory = (subId: string) => {
    setExpandedSubs(prev => ({
      ...prev,
      [subId]: !prev[subId],
    }));
  };


  if (loading) return <p className="text-center text-lg">Loading...</p>;
  if (error) return <p className="text-red-500 text-center">{error}</p>;
  if (!questionsData) return <p className="text-red-500 text-center">No data available</p>;

  return (
    <div className="p-8 ml-8 mr-8">
      <h2 className="text-2xl font-bold text-center mb-6">Question Banks</h2>

      {Object.entries(questionsData).map(([bankId, bank]) => (
        <div
          key={bankId}
          className="flex flex-col border rounded-lg shadow p-4 mb-6 bg-white w-full"
        >
          {bank.question_bank_image && <div className="w-full rounded-md overflow-hidden relative aspect-[3/1]">
            <Image
              src={`${process.env.NEXT_PUBLIC_API_URL}${bank.question_bank_image}`}
              alt={bank.question_bank_name ?? 'Question Bank Image'}
              fill
              className="object-contain"
              quality={100}
              priority
              sizes="100vw"
            />
          </div>}
          <div className="text-center mt-5 mb-5">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-800">
              {bank.question_bank_name}
            </h2>
          </div>

          <div className="space-y-2">
            {Object.entries(bank.subcategories).map(([subId, sub]) => (
              <div key={subId} className="bg-orange-100 rounded-md">
                <button
                  onClick={() => toggleSubcategory(subId)}
                  className="w-full flex justify-between items-center px-4 py-2 hover:bg-orange-200 transition font-medium"
                >
                  <div className="flex gap-2 items-center">
                    <span>{sub.subcategory_name || "Unnamed Subcategory"}</span>
                  </div>
                  <span className="text-xs font-semibold text-orange-700">{sub.total_years} years</span>
                  <span className="text-sm">{expandedSubs[subId] ? "▲" : "▼"}</span>
                </button>

                {expandedSubs[subId] && (
                  <div className="bg-orange-50 px-4 py-2 space-y-2">
                    {sub.years.map((year) => (
                      <div key={year} className="flex justify-between items-center bg-white p-2 rounded shadow-sm">
                        <span className="text-sm font-medium text-gray-700">{year}</span>
                        <button
                          onClick={() => router.push(`/dashboard/saved-questions/${subId}/${year}`)}
                          className="text-xs bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SavedQuestions;
