"use client";
import { useUser } from "../../../../../../../hooks/useUser";
import MDCAT from "@/assets/MDCATBanner.png";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useTime } from "../../../../../../../hooks/useTime";

export default function ModeComponent() {
  const user = useUser((state) => state.user)
  
  const router = useRouter();

  const handleTimeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const timeInMInutes = parseInt(event.target.value)
    useTime.getState().setTime(timeInMInutes * 60)
  }

  return (
    <div className="flex-1 md:p-6 p-4 lg:py-7 py-4 bg-gray-100 md:mr-0 mx-auto">
      {/* <h1 className="md:text-3xl text-xs w-full md:w-auto font-semibold mb-4 md:mb-0 md:pb-9">
        Welcome Back, {user?.full_name} 👋
      </h1> */}
      <div>
        <Image src={MDCAT} alt="MDCAT" className="w-full " />
        <div className="flex justify-center items-center mt-3 space-x-6 text-white">
          <h1 className="px-6 py-2 text-3xl font-bold text-gray-800">
            Choose Mode
          </h1>
        </div>

        {/* Cards */}
        <div className="flex flex-col md:flex-row justify-center items-center mt-6 space-y-4 md:space-y-0 md:space-x-8">
          {/* Practice Mode Card */}
          <div className="w-full max-w-xs h-96 bg-[#D9D9D9] rounded-lg shadow-md p-6 border-2 border-white ">
            <div className="flex items-center justify-center mb-4">
              <div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  fill="red"
                  className="bi bi-calculator"
                  viewBox="0 0 16 16"
                >
                  <path fillRule='evenodd' d="M12 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z" />
                  <path fillRule='evenodd' d="M4 2.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm3-6a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm3-6a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5z" />
                </svg>
              </div>
            </div>
            <h2 className="text-center text-xl font-semibold mb-2">
              Practice Mode
            </h2>
            <p className="text-gray-500 text-center mb-4">
              Practice mode is suitable for improving accuracy and time spent on
              each part.
            </p>
            <div className="text-center mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose the time limit:
              </label>
              <select className="w-full p-2 border rounded-md" onChange={handleTimeChange} >
                <option>32 mins</option>
                <option>40 mins</option>
                <option>60 mins</option>
              </select>
            </div>
            <div className="text-center">
              <button
                onClick={() =>
                  router.push("/dashboard/question-bank/topical/Test")
                }
                className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700"
              >
                Start Solving
              </button>
            </div>
          </div>

          {/* Simulation Test Mode Card */}
          <div className="w-full max-w-xs h-96 bg-[#D9D9D9] rounded-lg shadow-md p-6 border-2 border-white">
            <div className="flex items-center justify-center mb-4">
              <div className=" p-2 ">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  fill="red"
                  className="bi bi-clipboard-minus"
                  viewBox="0 0 16 16"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.5 9.5A.5.5 0 0 1 6 9h4a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5"
                  />
                  <path fillRule="evenodd" d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z" />
                  <path fillRule="evenodd" d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-center text-xl font-semibold mb-2">
              Simulation Test Mode
            </h2>
            <p className="text-gray-500 text-center mb-4">
              Simulation test mode is the best option for experiencing the real
              test on computer.
            </p>
            <p className="text-gray-600 text-center mb-4">
              Test information: <br /> Full parts (32 minutes - 4 parts - 40
              questions)
            </p>
            <div className="text-center">
              <button
                onClick={() =>
                  router.push("/dashboard/question-bank/topical/Test")
                }
                className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700"
              >
                Start Solving
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
