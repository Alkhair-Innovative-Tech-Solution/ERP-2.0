"use client";
import { useUser } from "../../../../../hooks/useUser";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useHandleLogout from "../../../../lib/logout";
import { FaCalendar, FaFolder } from "react-icons/fa";

export default function SolveQuestion() {
  const handleLogout = useHandleLogout();
  const user = useUser((state) => state.user);
  const router = useRouter();
  const [data, setData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);

  useEffect(() => {
    const getYearlyData = async () => {
      const questionBankId = localStorage.getItem("question-bank-id") ?? "";

      if (!questionBankId) {
        setError("Question Bank ID is missing.");
        return;
      }

      try {
        const res = await fetch(`/backend/api/questionbank/yearly/${questionBankId}/`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data_api = await res.json();
        if (res.ok) {
          setData(data_api?.my_question_bank_data);
          setStatus(data_api.status);
        } else {
          throw new Error('Failed to fetch data');
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      }
    };

    getYearlyData();
  }, []);

  useEffect(() => {
    if (status === 401) {
      console.log("Unauthorized access, redirecting to login...");
      handleLogout();
    }
  }, [status, handleLogout]);

  const [expandedSubcategory, setExpandedSubcategory] = useState<string | null>(null);

  const toggleSubcategory = (subcategoryId: string) => {
    setExpandedSubcategory((prev) => (prev === subcategoryId ? null : subcategoryId));
  };

  const handlePushLogicMode = (subcategory: any, year: string) => {
    const solve_y = {
      category_name: data.category,
      questionbank_name: data.name,
      subcategory_name: subcategory.name,
      qb_image: data.image,
      year: year
    };

    localStorage.removeItem("solve-yearly-dynamic");
    localStorage.setItem("solve-yearly-dynamic", JSON.stringify(solve_y));
    const solve = {
      subcategoryid: subcategory.id,
      year: year
    };
    localStorage.removeItem("solve-yearly");
    localStorage.setItem("solve-yearly", JSON.stringify(solve));
    router.push("/dashboard/question-bank/solve/mode");
  };

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="flex-1 p-4 md:p-6 lg:py-7 bg-gray-100 w-full">
      {/* <h1 className="text-xs md:text-3xl font-semibold mb-4 md:mb-0 md:pb-9">
        Give these a shot, {user?.full_name} 👋
      </h1> */}

      <div>
        {data?.image ? (
          <div className="w-full rounded-md overflow-hidden relative aspect-[4/1]">
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
          <div className="w-full h-[200px] md:h-[400px] bg-gray-200 animate-pulse rounded-md" />
        )}

        <div className="text-center mt-3">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-800">
            {data.name} ({data.category})
          </h2>
          <p className="text-gray-500 text-sm mt-1">Total Questions: {data.question_count}</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center mt-5 gap-3 sm:gap-6 text-white">
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

      {Array.isArray(data.subcategories) && data.subcategories.length > 0 ? (
        data.subcategories.map((subcategory: any) => {
          const totalQuestions = Object.values(subcategory.years).reduce(
            (acc: number, yearData: any) => acc + (yearData.total_questions || 0),
            0
          );
          const totalYears = Object.keys(subcategory.years).length;

          return (
            <div
              key={subcategory.id}
              className="bg-gray-100 shadow-md rounded-lg mt-5 border-2 border-white p-4 md:p-5"
            >
              <div
                onClick={() => toggleSubcategory(subcategory.id)}
                className="grid grid-cols-1 sm:grid-cols-3 items-center cursor-pointer gap-2 md:gap-4"
                onKeyDown={(e) => e.key === 'Enter' && toggleSubcategory(subcategory.id)}
              >
                <h1 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center">
                  <span className="pr-2"><FaFolder /></span> {subcategory.name}
                </h1>
                <p className="text-gray-600 font-semibold text-center">{totalQuestions} Questions</p>
                <div className="flex justify-end items-center">
                  <p className="text-gray-600 font-semibold">{totalYears} Years</p>
                  <span className="text-gray-600">{expandedSubcategory === subcategory.id ? "▲" : "▼"}</span>
                </div>
              </div>

              {expandedSubcategory === subcategory.id && (
                <div className="mt-3">
                  {Object.keys(subcategory.years).map((year) => (
                    <div
                      key={year}
                      className="grid grid-cols-1 sm:grid-cols-4 gap-2 md:gap-4 py-2 border-b border-gray-200">
                      <h2 className="text-md md:text-lg flex font-semibold text-gray-800">
                        <span className="flex items-center pr-2"><FaCalendar /></span> {year}
                      </h2>
                      <p className="text-gray-500 text-sm text-center sm:text-left">
                        {subcategory.years[year].total_questions} Questions
                      </p>
                      <p className="text-gray-500 text-sm text-center sm:text-left">
                        {subcategory.years[year].attempts ?? 0} Attempts
                      </p>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handlePushLogicMode(subcategory, year)}
                          className="bg-orange-600 text-white px-4 py-1 rounded-3xl"
                        >
                          Start Test
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="text-center text-gray-500">Loading . . . .</div>
      )}
    </div>
  );
};
