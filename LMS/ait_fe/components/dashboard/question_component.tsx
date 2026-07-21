import { useState, useEffect } from "react";
import Image from "next/image";
import { IoCloseCircle, IoRefreshCircle } from "react-icons/io5";

interface Option {
  id: string;
  text: string;
  image: string
  option_text: string;
  is_correct: boolean;
}

interface QuestionData {
  question_text: string;
  image?: string;
  options: Option[];
  why_correct_option: {
    why_correct_option_text: string;
  };
  why_incorrect_option: {
    why_incorrect_option_text: string;
  };
}

interface QuestionComponentProps {
  key: number;
  questionData: QuestionData;
  currentQuestionIndex: number;
  totalQuestions: number;
  onNext: () => void;
  onPrevious: () => void;
  resetState: boolean;
  selectedAnswer: any;
  onAnswerSelection: any;
}

const QuestionComponent: React.FC<QuestionComponentProps> = ({
  questionData,
  currentQuestionIndex,
  totalQuestions,
  onNext,
  onPrevious,
  resetState,
  selectedAnswer,
  onAnswerSelection,
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [canceledOptions, setCanceledOptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedOption(selectedAnswer);
  }, [selectedAnswer, resetState]);

  const handleOptionSelect = (optionId: string) => {
    if (!canceledOptions.has(optionId)) {
      setSelectedOption(optionId);
      onAnswerSelection(currentQuestionIndex, optionId);
    }
  };

  const toggleCancelOption = (optionId: string) => {
    setCanceledOptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(optionId)) {
        newSet.delete(optionId);
      } else {
        newSet.add(optionId);
      }
      return newSet;
    });
  };

  const getImageSrc = (imagePath?: string): string | null => {
    if (!imagePath || imagePath === "/uploads/nan") return null;

    try {
      const decodedUrl = decodeURIComponent(imagePath).trim();

      // Handle cases like "/uploads/http:/www..." -> extract the actual URL
      if (decodedUrl.includes("/uploads/http") || decodedUrl.includes("/uploads/www")) {
        return null;
      }
      // Return valid API-based or direct image URLs
      return decodedUrl.startsWith("/")
        ? `${process.env.NEXT_PUBLIC_API_URL}${decodedUrl}`
        : decodedUrl;
    } catch (error) {
      return null; // If decoding fails, return null
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="mx-auto w-full min-w-[400px] max-w-4xl flex-grow overflow-auto">
        {/* Question */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Question {currentQuestionIndex + 1}:
          </h2>
          <p className="text-lg">{questionData.question_text}</p>
          {getImageSrc(questionData.image) ? (
            <div className="w-full max-w-full overflow-auto my-4 border rounded-lg bg-white p-2">
              <Image
                src={getImageSrc(questionData.image)!}
                alt="Question"
                width={800} // high resolution base width
                height={600} // adjusts based on aspect ratio
                className="max-w-full w-full sm:w-auto h-auto object-contain"
                priority
                quality={100}
              />
            </div>
          ) : null}
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {questionData.options.map((option) => (
            <div key={option.id} className="relative flex flex-col">
              <div className="flex justify-between items-start">
                <button
                  className={`border border-gray-300 rounded-lg p-4 text-left 
          hover:bg-blue-200 transition duration-200 ease-in-out w-full
          ${canceledOptions.has(option.id) ? "bg-gray-300 text-gray-500 line-through cursor-not-allowed" : ""}
          ${selectedOption === option.id ? "bg-blue-300" : ""}`}
                  onClick={() => handleOptionSelect(option.id)}
                  disabled={canceledOptions.has(option.id)}
                >
                  <div className="flex flex-col">
                    <span className="font-bold mb-2">{option.option_text}</span>
                    {getImageSrc(option.image) && (
                      <div className="w-full max-w-full overflow-auto my-4 border rounded-lg bg-white p-2">
                        <Image
                          src={getImageSrc(option.image)!}
                          alt={`Option ${option.text}`}
                          width={800} // high resolution base width
                          height={600} // adjusts based on aspect ratio
                          className="max-w-full w-full sm:w-auto h-auto object-contain"
                          priority
                          quality={100}
                        />
                      </div>
                    )}
                  </div>
                </button>
                {/* Cancel/Uncancel Button */}
                <button
                  className="ml-2 h-full flex items-center text-xl"
                  onClick={() => toggleCancelOption(option.id)}
                >
                  {canceledOptions.has(option.id) ? (
                    <IoRefreshCircle className="text-green-500" />
                  ) : (
                    <IoCloseCircle className="text-red-500" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 w-11/12 p-4 flex justify-between">
        <button
          className={`text-white rounded-lg p-3 ${currentQuestionIndex === 0
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-red-500"
            }`}
          onClick={onPrevious}
          disabled={currentQuestionIndex === 0}
        >
          &laquo;&laquo; Previous
        </button>
        <div>
          {currentQuestionIndex + 1}/{totalQuestions}
        </div>
        {currentQuestionIndex === totalQuestions - 1 ? (
          <button
            className="bg-green-500 text-white rounded-lg p-3"
            onClick={onNext}
          >
            Submit
          </button>
        ) : (
          <button
            className="bg-red-500 text-white rounded-lg p-3"
            onClick={onNext}
          >
            Next &raquo;&raquo;
          </button>
        )}
      </div>
    </div>
  );
};

export default QuestionComponent;
