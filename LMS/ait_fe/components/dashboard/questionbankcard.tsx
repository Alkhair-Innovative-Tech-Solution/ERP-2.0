// New component to display each Question Bank's stats
import React from "react";
import OverallProgress from "./radarComponenet";
import SubjectStats from "./subjectstats";
import SubCategoryStats from "./subcategorystats"; // Optional: make one if needed
import {
  FaBullseye,        // For accuracy
  FaQuestionCircle,  // For total questions
  FaHourglassHalf,   // For remaining questions
} from "react-icons/fa"; 

const QuestionBankCard = ({ qb }: { qb: any }) => {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 space-y-4 border border-gray-200">
      <h2 className="text-2xl font-semibold text-orange-600">
        {qb.question_bank_name}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<FaQuestionCircle />}
          title={String(qb.total_questions)} subtitle="Total Questions" />
        <StatCard icon={<FaHourglassHalf />}
          title={String(qb.total_attempts)} subtitle="Attempted" />
        <StatCard icon={<FaBullseye />}
          title={String(qb.correct_attempts)} subtitle="Correct" />
        <StatCard icon={<FaBullseye />}
          title={qb.accuracy_percentage + "%"}
          subtitle="Accuracy"
        />
      </div>

      {qb.yearly_stats && qb.yearly_stats.length > 0 && (
        <div>
          <h3 className="text-md font-semibold text-gray-700 mb-2">
            Yearly Performance
          </h3>
          <OverallProgress stats={qb.yearly_stats} type="Yearly" />
        </div>
      )}

      {qb.subject_stats && qb.subject_stats.length > 0 && (
        <div>
          <h3 className="text-md font-semibold text-gray-700 mb-2">
            Subject Breakdown
          </h3>
          <SubjectStats stats={qb.subject_stats} />
        </div>
      )}

      {qb.subcategory_stats && qb.subcategory_stats.length > 0 && (
        <div>
          <h3 className="text-md font-semibold text-gray-700 mb-2">
            Topics / Subcategories
          </h3>
          <SubCategoryStats stats={qb.subcategory_stats} />
        </div>
      )}
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

export default QuestionBankCard;
