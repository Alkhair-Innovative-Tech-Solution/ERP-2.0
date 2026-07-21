'use client';
import React from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  totalQuestions: number;
  attemptedQuestions: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const ReviewModal: React.FC<ConfirmModalProps> = ({ isOpen, totalQuestions, attemptedQuestions, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  // Calculate progress percentage
  const progress = (attemptedQuestions / totalQuestions) * 100;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-md z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-[90vw] md:w-[400px] border-t-4 border-blue-500">
        
        {/* Header */}
        <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Confirm Your Attempt</h2>
        
        {/* Progress Bar */}
        <div className="mb-4">
          <p className="text-gray-600 font-medium mb-1">
          Total Attempted Questions: {attemptedQuestions} / {totalQuestions}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Confirmation Text */}
        <p className="text-gray-700 text-center mt-4">
          Are you sure you want to finish the test?
        </p>

        {/* Buttons */}
        <div className="flex justify-center space-x-4 mt-6">
          <button 
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-all"
            onClick={onCancel}
          >
            No
          </button>
          <button 
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-red-600 transition-all shadow-md"
            onClick={onConfirm}
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
