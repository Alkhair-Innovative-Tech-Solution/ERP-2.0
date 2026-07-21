'use client';

import { BookOpen, User, Calendar, ArrowRight, MapPin } from 'lucide-react';
import Image from 'next/image';
import { formatDate } from '@/lib/utils';

interface BranchInfo {
  id: string;
  code: string;
  name: string;
}

interface SessionInfo {
  id: string;
  days: string[];
  start_time: string;
  end_time: string;
  room_name?: string;
  teacher_name?: string;
  branch_name?: string;
  branch_code?: string;
}

interface CourseCardProps {
  id: string;
  course_code: string;
  title: string;
  description?: string;
  thumbnail?: string;
  instructor?: string;
  category?: string;
  level?: string;
  is_enrolled?: boolean;
  progress?: number;
  enrollment_date?: string;
  branches?: BranchInfo[];
  sessions_count?: number;
  onClick?: () => void;
}

export default function CourseCard({
  id,
  course_code,
  title,
  description,
  thumbnail,
  instructor,
  category,
  level,
  is_enrolled,
  progress,
  enrollment_date,
  branches,
  sessions_count,
  onClick,
}: CourseCardProps) {
  return (
    <div
      onClick={onClick}
      className="moodle-card cursor-pointer group hover:scale-[1.02] transition-transform"
    >
      {/* Thumbnail */}
      <div className="relative w-full h-48 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg mb-4 overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-16 h-16 text-white opacity-50" />
          </div>
        )}
        {level && (
          <span className="absolute top-3 right-3 px-2 py-1 bg-white/90 backdrop-blur-sm rounded text-xs font-semibold text-primary-600">
            {level}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Course Code & Title */}
        <div>
          <p className="text-xs font-semibold text-primary-600 mb-1">{course_code}</p>
          <h3 className="text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors">
            {title}
          </h3>
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
        )}

        {/* Branch tags */}
        {branches && branches.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {branches.map((b) => (
              <span key={b.id} className="flex items-center gap-1 bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full text-[10px] font-medium">
                <MapPin className="w-2.5 h-2.5" />
                <code className="bg-primary-100 px-1 rounded text-[8px] font-mono font-bold">{b.code}</code>
                {b.name}
              </span>
            ))}
          </div>
        )}

        {/* Session count */}
        {sessions_count != null && sessions_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-primary-600 font-semibold">
            <Calendar className="w-3.5 h-3.5" />
            <span>{sessions_count} Session{sessions_count > 1 ? 's' : ''} Available</span>
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {instructor && (
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span className="truncate">{instructor}</span>
            </div>
          )}
          {enrollment_date && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>Enrolled {formatDate(enrollment_date)}</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {is_enrolled && progress !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Progress</span>
              <span className="font-semibold text-primary-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action button */}
        <button 
          className="w-full moodle-button flex items-center justify-center gap-2 mt-4"
          onClick={(e) => {
            if (onClick) {
              e.stopPropagation();
              onClick();
            }
          }}
        >
          {is_enrolled ? 'Continue Learning' : 'View Course'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

