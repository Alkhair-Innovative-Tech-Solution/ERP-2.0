import React from "react";

const SubjectStats = ({ stats }: { stats: any[] }) => {
  if (!stats?.length) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-gray-500 text-center">
        No subject data available.
      </div>
    );
  }

  const getBarColor = (percent: number) => {
    if (percent >= 80) return "bg-green-500";
    if (percent >= 50) return "bg-yellow-400";
    return "bg-orange-400";
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg transition-shadow hover:shadow-xl">
      <h2 className="text-xl font-bold text-gray-800 mb-2">📚 Subject Performance</h2>
      <ul className="space-y-4">
        {stats.map((item) => {
          const percent = item.total > 0 ? (item.correct / item.total) * 100 : 0;

          return (
            <li
              key={item.subject}
              className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-gray-700">{item.subject}</span>
                <span className="text-sm text-gray-600">
                  {item.correct} / {item.total} ({percent.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getBarColor(percent)}`}
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SubjectStats;
