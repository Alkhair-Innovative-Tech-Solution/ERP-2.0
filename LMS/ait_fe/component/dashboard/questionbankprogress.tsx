import React from "react";

const QuestionBankProgress = ({ stats }: { stats: any[] }) => {
  if (!stats?.length) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-gray-500 text-center">
        No data available.
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
      <h2 className="text-xl font-bold text-gray-800">📚 Question Bank Progress</h2>
      <h4 className="text-sm text-gray-600 mb-2">Attempted Questions record</h4>

      <ul className="space-y-6">
        {stats.map((bank) => {
          const total = bank.total_questions_attempted || 0;
          const correct = bank.correct_questions_attempted || 0;
          const percent = total > 0 ? (correct / total) * 100 : 0;

          return (
            <li
              key={bank.question_bank_id}
              className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
            >
              {/* Main Question Bank Progress */}
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-lg text-orange-800">{bank.question_bank_name}</span>
                <span className="text-sm text-gray-600">
                  {correct} / {total} ({percent.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full ${getBarColor(percent)}`}
                  style={{ width: `${percent}%` }}
                ></div>
              </div>

              {/* Subcategory Stats */}
              {bank.subcategories?.length > 0 && (
                <ul className="mt-2 space-y-2 pl-2 border-l-4 border-red-200">
                  {bank.subcategories.map((sub: any) => {
                    const subTotal = sub.total_questions_attempted
                    || 0;
                    const subCorrect = sub.correct_questions_attempted
                    || 0;
                    const subPercent = subTotal > 0 ? (subCorrect / subTotal) * 100 : 0;

                    return (
                      <li key={sub.subcategory_id}>
                        <div className="flex justify-between items-center text-sm text-gray-700">
                          <span>{sub.subcategory_name}</span>
                          <span>
                            {subCorrect} / {subTotal} ({subPercent.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${getBarColor(subPercent)}`}
                            style={{ width: `${subPercent}%` }}
                          ></div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default QuestionBankProgress;
