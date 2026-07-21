'use client';
import React, { useState } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  reviewData: {
    totalQuestions: number;
    attempted: number;
    subjectTopics: { subject: string; topics: string[] }[];
    topicDetails: Record<string, { total: number; correct: number; attempted: number }>;
  } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ReviewModalSimulation: React.FC<ConfirmModalProps> = ({ isOpen, reviewData, onConfirm, onCancel }) => {
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  
  if (!isOpen || !reviewData) return null;


  // Toggle expand/collapse for subjects
  const toggleSubject = (subject: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subject]: !prev[subject],
    }));
  };

  // Calculate total correct answers (marks)
  const totalCorrect = Object.values(reviewData.topicDetails).reduce((acc, topic) => acc + topic.correct, 0);
  const totalMarksPercentage = (totalCorrect / reviewData.totalQuestions) * 100;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-md z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-[90vw] md:w-[85vw] border-t-4 border-blue-500 max-h-[85vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <h2 className="text-xl font-bold text-gray-800 text-center mb-4">Review Your Attempt</h2>

        {/* Progress Bar */}
        <div className="mb-4">
          <p className="text-gray-600 font-medium mb-1">
            Total Attempted Questions: {reviewData.attempted} / {reviewData.totalQuestions}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(reviewData.attempted / reviewData.totalQuestions) * 100}%` }}
            />
          </div>
        </div>

        {/* Total Marks */}
        <div className="mb-4">
          <p className="text-gray-600 font-medium mb-1">
            Total Marks: {totalCorrect} / {reviewData.totalQuestions}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${totalMarksPercentage}%` }}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-2">
          <h3 className="font-semibold text-gray-700">Subjects & Topics</h3>

          {reviewData.subjectTopics.map((subjectData, index) => {
            // Calculate total correct answers and total questions for each subject
            const subjectTotalCorrect = subjectData.topics.reduce(
              (acc, topic) => acc + (reviewData.topicDetails[`${subjectData.subject} - ${topic}`]?.correct || 0),
              0
            );
            const subjectTotalQuestions = subjectData.topics.reduce(
              (acc, topic) => acc + (reviewData.topicDetails[`${subjectData.subject} - ${topic}`]?.total || 0),
              0
            );

            return (
              <div key={index} className="mt-4 bg-gray-100 p-3 rounded-md">
                {/* Subject Header with Marks on Right & Toggle Button */}
                <div
                  className="flex flex-col md:flex-row justify-between items-center cursor-pointer"
                  onClick={() => toggleSubject(subjectData.subject)}
                >
                  <h4 className="text-md font-semibold text-gray-800">{subjectData.subject}</h4>

                  {/* Click to see breakdown - Centered on large screens */}
                  <p className="text-sm text-gray-500 italic hidden md:block">Click to see marks breakdown</p>

                  {/* Marks & Expand/Collapse Icon */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {subjectTotalCorrect} / {subjectTotalQuestions} Marks
                    </span>
                    <span className="text-gray-500">{expandedSubjects[subjectData.subject] ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Show breakdown text for small screens below subject */}
                <p className="text-sm text-gray-500 italic md:hidden mt-1">Click to see marks breakdown</p>

                {/* Expandable Topics Grid */}
                {expandedSubjects[subjectData.subject] && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {subjectData.topics.map((topic, idx) => {
                      const key = `${subjectData.subject} - ${topic}`;
                      const topicDetail = reviewData.topicDetails[key] || { total: 0, correct: 0, attempted: 0 };

                      return (
                        <div key={idx} className="text-sm p-3 bg-white rounded-md shadow-md border border-gray-200">
                          <p className="font-semibold text-gray-700">{topic}</p>
                          <p>Total Questions: <span className="font-semibold text-gray-900">{topicDetail.total}</span></p>
                          <p>Attempted:
                            <span className={`font-semibold ${topicDetail.attempted < topicDetail.total ? 'text-red-500' : 'text-gray-900'}`}>
                              {topicDetail.attempted}
                            </span>
                          </p>
                          <p>Correct:
                            <span className={`font-semibold ${topicDetail.correct < topicDetail.attempted ? 'text-orange-500' : 'text-gray-900'}`}>
                              {topicDetail.correct}
                            </span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <p className=" flex justify-center">Do you want to see Attempt Details?</p>
          <div className="p-4 flex justify-center space-x-4">
            <button
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-all"
              onClick={onCancel}
            >
              No
            </button>
            <button
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-all shadow-md"
              onClick={onConfirm}
            >
              Yes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewModalSimulation;
