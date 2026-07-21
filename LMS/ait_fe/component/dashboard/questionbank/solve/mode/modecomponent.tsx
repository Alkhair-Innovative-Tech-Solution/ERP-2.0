"use client";
import { useUser } from "../../../../../../hooks/useUser";
import MDCAT from "@/assets/NEW BANNER.png";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useTime } from "../../../../../../hooks/useTime";

export default function ModeComponent() {
  const user = useUser((state) => state.user);
  const router = useRouter();
  const timeStore = useTime.getState();

  // Default time state for Practice Mode
  const [testTime, setTestTime] = useState(180);
  const [practiceTime, setPracticeTime] = useState(32 * 60); // Default to 32 minutes
  const [dataB, setDataB] = useState<any>(null);


  useEffect(() => {
    const d = localStorage.getItem('solve-yearly-dynamic');
    const qb = d ? JSON.parse(d) : null;
    setDataB(qb);
  }, []); // 👈 prevents infinite loop

  useEffect(() => {
    timeStore.setTime(practiceTime); // Ensure the selected time is stored
  }, [practiceTime, timeStore]); // Runs whenever practiceTime changes


  useEffect(() => {

    setTestTime(JSON.parse(localStorage.getItem("test-duration") ?? "180"))
  }, []); // Runs whenever practiceTime changes

  return (
    <div className="flex-1 md:p-6 p-4 lg:py-7 py-4 bg-[#fefefe] md:mr-0 mx-auto">
      {/* <h1 className="md:text-3xl text-xs w-full md:w-auto font-semibold mb-4 md:mb-0 md:pb-9 text-[#010000]">
        Welcome Back, {user?.full_name} 👋
      </h1> */}

      <div>
        <div className="w-full rounded-md overflow-hidden relative aspect-[3/1]">

          <Image src={dataB ? `${process.env.NEXT_PUBLIC_API_URL}${dataB.qb_image}` : MDCAT}
            alt="MDCAT"
            className="w-full rounded-lg shadow-md object-contain"
            fill
            quality={100}
            priority
            sizes="100vw"
          />
        </div>
        <div className="flex justify-center items-center mt-3 space-x-6 text-[#010000]">
          <h1 className="px-6 py-2 text-3xl font-bold">
            Choose Mode
          </h1>
        </div>

        {/* Cards */}
        <div className="flex flex-col md:flex-row justify-center items-center mt-6 space-y-4 md:space-y-0 md:space-x-8">

          {/* Practice Mode Card */}
          <div className="w-full max-w-xs h-60 bg-[#D9D9D9] rounded-lg shadow-md p-6 border-2 border-[#f29d38] flex flex-col justify-between">
            <div>
              <h2 className="text-center text-xl font-semibold mb-2 text-[#010000]">
                Practice Mode
              </h2>
              <p className="text-gray-600 text-center">
                Improve accuracy and Try to complete correctly.
              </p>
            </div>

            <div className="mt-4">
              <button
                onClick={() => router.push("/dashboard/question-bank/solve/mode/practice")}
                className="w-full bg-[#ff6601] text-white py-2 px-4 rounded-lg hover:bg-[#f29d38] transition"
              >
                Start Solving
              </button>
            </div>
          </div>

          {/* Simulation Test Mode Card */}
          <div className="w-full max-w-xs h-60 bg-[#D9D9D9] rounded-lg shadow-md p-6 border-2 border-[#f29d38] flex flex-col justify-between">
            <div>
              <h2 className="text-center text-xl font-semibold mb-2 text-[#010000]">
                Simulation Test Mode
              </h2>
              <p className="text-gray-600 text-center">
                Experience a real-time test environment.
              </p>
              <p className="text-gray-600 text-center">
                Test Duration: <span className="text-red-600">{testTime}</span> min
              </p>
            </div>

            <div className="mt-4">
              <button
                onClick={() => {
                  timeStore.setTime(testTime * 60);
                  router.push("/dashboard/question-bank/solve/mode/simulation");
                }}
                className="w-full bg-[#010000] text-white py-2 px-4 rounded-lg hover:bg-[#ff6601] transition"
              >
                Start Simulation
              </button>
            </div>
          </div>


        </div>
      </div>
    </div>

  );

}
