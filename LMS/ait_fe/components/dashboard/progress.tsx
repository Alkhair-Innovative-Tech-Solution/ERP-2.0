import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const Progress = ({ yearStats }: { yearStats: any[] }) => {
  const labels = yearStats.map((item) => item.year);
  const attempts = yearStats.map((item) => item.attempts);
  const correct = yearStats.map((item) => item.correct);

  const data = {
    labels,
    datasets: [
      {
        label: "Attempts",
        data: attempts,
        backgroundColor: "#5A67D8",
        borderRadius: 8,
        barThickness: 24,
        hoverBackgroundColor: "#434190",
      },
      {
        label: "Correct",
        data: correct,
        backgroundColor: "#48BB78",
        borderRadius: 8,
        barThickness: 24,
        hoverBackgroundColor: "#2F855A",
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          boxWidth: 12,
          padding: 16,
        },
      },
      title: {
        display: true,
        text: "Year-wise Progress",
        font: {
          size: 18,
          weight: "bold",
        },
        padding: {
          top: 10,
          bottom: 20,
        },
        color: "#2D3748",
      },
      tooltip: {
        callbacks: {
          label: function (tooltipItem) {
            return `${tooltipItem.dataset.label}: ${tooltipItem.raw}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 5,
          color: "#4A5568",
        },
        grid: {
          color: "#E2E8F0",
        },
      },
      x: {
        ticks: {
          color: "#4A5568",
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 transition-transform transform hover:scale-[1.01] hover:shadow-xl duration-300 ease-in-out">
      <div className="relative h-[250px] sm:h-[300px] md:h-[350px] lg:h-[400px]">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

export default Progress;
