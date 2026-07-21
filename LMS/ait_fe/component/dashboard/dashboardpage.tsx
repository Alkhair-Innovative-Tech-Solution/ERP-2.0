"use client";
import Progress from "./progress";
import QuestionBankProgress from "./questionbankprogress"; // Import the QuestionBankProgress component
import { useUser } from "../../../hooks/useUser";
import React, { useEffect, useState } from "react";
import {
  FaBullseye,        // For accuracy
  FaQuestionCircle,  // For total questions
  FaHourglassHalf,   // For remaining questions
  FaBookmark,        // For saved questions
} from "react-icons/fa"; 
import useHandleLogout from "@/lib/logout";
import SubjectStats from "./subjectstats";
import OverallProgress from "./radarComponenet";

const DashboardPage = () => {
  const [isClient, setIsClient] = useState(false);
  const user = useUser((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number>(0);
  const handlelogout = useHandleLogout();
  useEffect(() => {
    const getData = async () => {
      try {
        const res = await fetch("/backend/api/stats/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();

        setStats(data.data);
        setStatus(data.status);
      } catch (error) {
        console.error("Error fetching courses:", error);
        setError("Failed to load courses. Please try again later.");
        setStats([]); // Set courses to an empty array on error
      } finally {
        setLoading(false);
      }
    };

    getData();
  }, []); // Empty dependency array to run only once

  useEffect(() => {
    if (status === 401) {
      handlelogout();
    }
  });


  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null; // or a loading spinner
  }

  if (loading) return <div className="p-4 text-center">Loading stats...</div>;
  if (!stats) return <div className="p-4 text-center">No stats available.</div>;
  if (error) return <div className="p-4 text-center">Oops Something Went Wrong...</div>;

  return (
    <div className="flex-1 px-4 py-6 md:p-6 lg:py-8 bg-gray-100 max-w-screen-xl mx-auto">
      <div className="w-full">
        {/* Greeting */}
        <h1 className="text-lg md:text-3xl font-semibold mb-6">
          Welcome Back, {user?.full_name} 👋
        </h1>

        {/* Main Section */}
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Left (Stats & Question Banks) */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                title={stats?.overall?.accuracy_percentage + "%"}
                subtitle="Accuracy"
                icon={<FaBullseye />}
              />

              <StatCard
                title={String(
                  (stats?.overall?.total_questions_in_purchased_qb || 0) -
                  (stats?.overall?.total_attempts || 0)
                )}
                subtitle="Remaining Questions"
                icon={<FaHourglassHalf />}
              />

              <StatCard
                title={stats?.overall?.total_questions_in_purchased_qb}
                subtitle="Total Questions"
                icon={<FaQuestionCircle />}
              />

              <StatCard
                title={stats?.overall?.total_saved_questions}
                subtitle="Saved Questions"
                icon={<FaBookmark />}
              />

            </div>

            {/* Question Banks */}
            <div>
              <QuestionBankProgress stats={stats?.questionbank_stats || []} />
            </div>

            {/* Subject Stats */}
            <div>
              <SubjectStats stats={stats?.subject_stats || []} />
            </div>
          </div>

          {/* Right (Progress) */}
          <div className="lg:w-1/3 w-full">
            <Progress yearStats={stats?.year_stats || []} />
          </div>
        </div>

        <br />
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">

          <OverallProgress stats={stats?.year_stats || []} type='Yearly' />
          <OverallProgress stats={stats?.subject_stats || []} type='Subjective' />
        </div>
      </div>
    </div>
  );

};

const StatCard = ({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) => (
  <div className="bg-white border border-gray-200 shadow-md rounded-xl p-4 flex items-center gap-4 transition-transform transform hover:scale-105 duration-200 ease-in-out">
    <div className="text-3xl text-orange-600">{icon}</div>
    <div>
      <div className="text-xl font-bold text-gray-800">{title}</div>
      <div className="text-sm text-gray-500">{subtitle}</div>
    </div>
  </div>
);


export default DashboardPage;
