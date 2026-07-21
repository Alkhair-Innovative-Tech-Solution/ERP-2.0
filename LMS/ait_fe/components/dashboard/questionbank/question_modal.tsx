import React from "react";

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalQuestions: number;
  onQuestionSelect: (questionIndex: number) => void;
  selectedAnswer: Map<number, string>; // Receive selectedAnswers from parent
}

const QuestionModal: React.FC<QuestionModalProps> = ({
  isOpen,
  onClose,
  totalQuestions,
  onQuestionSelect,
  selectedAnswer,
}) => {
  if (!isOpen) return null;

  const questionDots = Array.from(
    { length: totalQuestions },
    (_, index) => index 
  );

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-auto flex flex-col">
        <h2 className="text-xl font-semibold mb-4">All Questions:</h2>
        <div className="flex-grow overflow-y-auto grid grid-cols-10 gap-2 h-96">
          {questionDots.map((questionIndex) => (
            <button
              key={questionIndex}
              className={`border rounded-full w-12 h-12 flex items-center justify-center
                ${selectedAnswer.has(questionIndex) ? 'bg-blue-500 text-white' : 'text-red-500'}`}
              onClick={() => onQuestionSelect(questionIndex)}
            >
              {questionIndex + 1}
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionModal;
