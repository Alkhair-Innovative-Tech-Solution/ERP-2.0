"use client";
import React, { useState } from "react";
import {
  FaHome,
  FaBook,
  FaChartBar,
  FaDatabase,
  FaBookOpen,
  FaBars,
} from "react-icons/fa";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const user = useUser((state) => state.user);
  const dashboardUrl = user ? `/dashboard/${user.id}` : "/dashboard";

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div>
      {/* Mobile Header with Hamburger Menu */}
      <div className="flex bg-white  items-center justify-between max-w-full p-4 md:hidden">
        <div className="text-2xl font-semibold text-red-600">
          <Image
            src="/assets/dashboardpics/logo.png"
            alt="prepdummy"
            className="h-12 w-auto object-contain"
            width={48}
            height={48}
          />
          {/* <span className="">prepdummy</span> */}
        </div>
        <button onClick={toggleSidebar} className="text-2xl focus:outline-none">
          <FaBars size={24} /> {/* Increased size */}
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-white shadow-md transform ${isOpen ? "translate-x-0" : "-translate-x-full"
          } transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:h-full z-50`}
      >
        <div className="p-6 text-2xl font-semibold text-red-600 flex items-center justify-between">
          <Image
            src="/assets/dashboardpics/logo.png"
            alt="prepdummy"
            className="h-20 w-auto object-contain"
            width={80}
            height={80}
          />
          {/* <span className="hidden md:block">prepdummy</span> */}
          <button className="px-6" onClick={() => router.push("/")}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              className="bi bi-box-arrow-left"
              viewBox="0 0 16 16"
            >
              <path
                fillRule="evenodd"
                d="M6 12.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-8a.5.5 0 0 0-.5.5v2a.5.5 0 0 1-1 0v-2A1.5 1.5 0 0 1 6.5 2h8A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 5 12.5v-2a.5.5 0 0 1 1 0z"
              />
              <path
                fillRule="evenodd"
                d="M.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L1.707 7.5H10.5a.5.5 0 0 1 0 1H1.707l2.147 2.146a.5.5 0 0 1-.708.708z"
              />
            </svg>
          </button>
        </div>
        <nav className="mt-6 px-5 space-y-4">
          <a
            href={dashboardUrl}
            className="flex items-center p-2 hover:bg-gray-100"
          >
            <FaHome size={20} className="mr-3" /> Home
          </a>
          <a
            href="/dashboard/courses"
            className="flex items-center p-2 hover:bg-gray-100"
          >
            <FaBook size={20} className="mr-3" /> Courses
          </a>
          <a
            href="/dashboard/question-bank"
            className="flex items-center p-2 hover:bg-gray-100"
          >
            <FaBookOpen size={20} className="mr-3" /> Question Banks
          </a>
          <a href="/dashboard/saved-questions" className="flex items-center p-2 hover:bg-gray-100">
            <FaDatabase size={20} className="mr-3" /> Saved Questions
          </a>
          <a
            href="/dashboard/statistics"
            className="flex items-center p-2 hover:bg-gray-100"
          >
            <FaChartBar size={20} className="mr-3" /> Statistics
          </a>
        </nav>
      </div>

      {/* Overlay for Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black opacity-50 z-40 md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}
    </div>
  );
};

export default Sidebar;
