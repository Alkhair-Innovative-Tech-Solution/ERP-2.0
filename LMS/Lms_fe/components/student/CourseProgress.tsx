"use client";

import React from "react";

interface LessonProgress {
  lesson_id: string;
  title: string;
  is_completed: boolean;
  total_content: number;
  completed_content: number;
}

interface ModuleProgress {
  module_id: string;
  title: string;
  completion_percentage: number;
  total_lessons: number;
  completed_lessons: number;
  lessons: LessonProgress[];
}

interface CourseProgressData {
  course_id: string;
  student_id: string;
  course_name: string;
  total_modules: number;
  completed_modules: number;
  total_lessons: number;
  completed_lessons: number;
  total_content_items: number;
  completed_content_items: number;
  completion_percentage: number;
  modules: ModuleProgress[];
}

interface CourseProgressProps {
  data: CourseProgressData;
  compact?: boolean;
}

function CircularProgress({ percentage }: { percentage: number }) {
  const radius = 54;
  const stroke = 8;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = (pct: number) => {
    if (pct >= 80) return "#16a34a";
    if (pct >= 50) return "#2563eb";
    if (pct >= 25) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle
          stroke="#e5e7eb"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={getColor(percentage)}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + " " + circumference}
          style={{ strokeDashoffset, transition: "stroke-dashoffset 0.5s ease" }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <span className="absolute text-xl font-bold text-gray-800">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}

function ModuleAccordion({ module }: { module: ModuleProgress }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              module.completion_percentage >= 100
                ? "bg-green-500"
                : module.completion_percentage > 0
                ? "bg-blue-500"
                : "bg-gray-300"
            }`}
          />
          <span className="font-medium text-gray-800">{module.title}</span>
          <span className="text-sm text-gray-500">
            {module.completed_lessons}/{module.total_lessons} lessons
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">
            {Math.round(module.completion_percentage)}%
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="p-4 space-y-2">
          {module.lessons.map((lesson) => (
            <div
              key={lesson.lesson_id}
              className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100"
            >
              <div className="flex items-center gap-3">
                {lesson.is_completed ? (
                  <svg
                    className="w-5 h-5 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                )}
                <span
                  className={`text-sm ${
                    lesson.is_completed
                      ? "text-gray-500 line-through"
                      : "text-gray-800"
                  }`}
                >
                  {lesson.title}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {lesson.completed_content}/{lesson.total_content}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CourseProgress({ data, compact = false }: CourseProgressProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 relative">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="15.91549430918954"
              fill="transparent"
              stroke="#e5e7eb"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.91549430918954"
              fill="transparent"
              stroke="#2563eb"
              strokeWidth="3"
              strokeDasharray={`${data.completion_percentage} ${100 - data.completion_percentage}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
            {Math.round(data.completion_percentage)}%
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">{data.course_name}</p>
          <p className="text-xs text-gray-500">
            {data.completed_lessons}/{data.total_lessons} lessons completed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Course Progress
            </h3>
            <p className="text-sm text-gray-500 mt-1">{data.course_name}</p>
          </div>
          <CircularProgress percentage={data.completion_percentage} />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {data.completed_modules}/{data.total_modules}
            </p>
            <p className="text-xs text-gray-500">Modules</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {data.completed_lessons}/{data.total_lessons}
            </p>
            <p className="text-xs text-gray-500">Lessons</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {data.completed_content_items}/{data.total_content_items}
            </p>
            <p className="text-xs text-gray-500">Activities</p>
          </div>
        </div>
      </div>

      {/* Module Breakdown */}
      {data.modules && data.modules.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3">
            Module Breakdown
          </h4>
          <div className="space-y-3">
            {data.modules.map((module) => (
              <ModuleAccordion key={module.module_id} module={module} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
