"use client";

import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import React from "react";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const OverallProgress = ({ stats, type }: { stats: any[], type: string }) => {
  const safeStats = Array.isArray(stats) ? stats : [];
  if (safeStats.length === 0) {
    return (
      <div className="text-center text-gray-600 p-6 bg-white rounded-xl shadow-md">
        No overall stats data available for ({type}).
      </div>
    );
  }

  // Extract labels and scores dynamically from passed stats
  const labels = safeStats.map((item) => item.name ?? item.subject ?? item.year);
  const values = safeStats.map((item) => {
    const percentage =
      item.total && item.correct ? (item.correct / item.total) * 10 : 0;
    return Number(percentage.toFixed(2));
  });

  const data = {
    labels,
    datasets: [
      {
        label: "Progress Score (0-10)",
        data: values,
        backgroundColor: "rgba(72, 191, 145, 0.2)",
        borderColor: "rgba(72, 191, 145, 1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(72, 191, 145, 1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(72, 191, 145, 1)",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        max: 10,
        angleLines: { color: "#d1d5db" },
        grid: { color: "#e5e7eb" },
        ticks: {
          stepSize: 2,
          color: "#6b7280",
          backdropColor: "#f9fafb",
        },
        pointLabels: {
          color: "#374151",
          font: { size: 13 },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "#374151",
        titleColor: "#fff",
        bodyColor: "#fff",
        padding: 10,
        borderWidth: 1,
        borderColor: "#48bb78",
      },
    },
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
        Overall {type} Progress Radar Chart
      </h2>
      <div className="flex justify-center items-center h-[360px]">
        <div className="w-full max-w-3xl h-full">
          <Radar data={data} options={options} />
        </div>
      </div>
    </div>
  );
};

export default OverallProgress;
