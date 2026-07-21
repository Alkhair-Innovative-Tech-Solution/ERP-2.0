'use client'
import { FC, useState } from "react";

interface ReportModelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}

const QuestionReportModel: FC<ReportModelProps> = ({ isOpen, onClose, onSubmit }) => {
  const [comment, setComment] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex justify-center items-center bg-black z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h1 className="text-lg font-semibold mb-2">Report this question:</h1>
        <p className="text-sm mb-4">
          If you think there is an issue with the question or its option, you
          can report it here.
        </p>
        <textarea
          className="w-full border p-2 rounded-lg mb-4"
          placeholder="your comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        ></textarea>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="mr-2 bg-gray-300 px-4 py-2 rounded"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              onSubmit(comment);
              onClose();
            }} 
            className="mr-2 bg-orange-500 text-white px-4 py-2 rounded"

          >
            Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionReportModel;
