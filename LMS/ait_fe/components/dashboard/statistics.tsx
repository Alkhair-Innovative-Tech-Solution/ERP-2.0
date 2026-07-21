"use client";
import { useUser } from "../../../hooks/useUser";
import React, { useEffect, useState } from "react";
import useHandleLogout from "@/lib/logout";

import QuestionBankCard from "./questionbankcard";

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
        const res = await fetch("/backend/api/statsdetails/", {
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
            <h1 className="md:text-3xl text-xs w-full md:w-auto font-semibold mb-4 md:mb-0 md:pb-9">
        Check your progress, {user?.full_name} 👋
      </h1>
      <div className="w-full max-w-screen-xl">

        {/* Main Section */}
        {stats?.questionbanks?.map((qb: any) => (
          <div key={qb.question_bank_id} className="w-full mb-6">
            <QuestionBankCard key={qb.question_bank_id} qb={qb} />
          </div>
        ))}
      </div>
    </div>

  );

};


export default DashboardPage;
