import { useState, useEffect } from "react";
import Image from "next/image";
import { FaThumbsUp, FaThumbsDown } from "react-icons/fa";
import { IoCloseCircle, IoRefreshCircle } from "react-icons/io5";

interface Option {
  id: string;
  text: string;
  image: string;
  option_text: string;
  is_correct: boolean;
}

interface QuestionData {
  question_text: string;
  image?: string;
  options: Option[];
  why_correct_option: {
    why_correct_option_text: string;
    image: string;
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
  const [showAnswers, setShowAnswers] = useState<boolean>(false);
  const [canceledOptions, setCanceledOptions] = useState<Set<string>>(new Set());
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedOption(selectedAnswer);
    setShowAnswers(!!selectedAnswer);
  }, [selectedAnswer, resetState]);

  const handleOptionSelect = (optionId: string) => {
    if (!canceledOptions.has(optionId)) {
      setSelectedOption(optionId);
      setShowAnswers(true);
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
      if (decodedUrl.includes("/uploads/http")) {
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

  const handleNext = () => {
    setShowAnswers(false);
    onNext();
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="w-full max-w-4xl flex-grow overflow-auto mx-auto min-h-[80vh]">
        {/* Question */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Question {currentQuestionIndex + 1}:
          </h2>
          <p className="text-lg">{questionData.question_text}</p>
          {getImageSrc(questionData.image) ? (
            <div className="w-full max-w-full overflow-auto my-4 border rounded-lg bg-white p-2 cursor-zoom-in">
              <Image
                src={getImageSrc(questionData.image)!}
                alt="Question"
                width={800}
                height={600}
                className="max-w-full w-full sm:w-auto h-auto object-contain"
                priority
                quality={100}
                onClick={() => setFullscreenImage(getImageSrc(questionData.image)!)}
              />
            </div>
          ) : null}
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {questionData.options.map((option) => (
            <div key={option.id} className="relative flex flex-col">

              {/* Main Button: Option Text + Image */}
              <button
                className={`border border-gray-300 rounded-lg p-4 text-left 
        hover:bg-blue-200 transition duration-200 ease-in-out w-full
        ${canceledOptions.has(option.id) ? "bg-gray-300 text-gray-500 line-through cursor-not-allowed" : ""}
        ${showAnswers ? (option.is_correct ? "bg-green-400" : "bg-red-400") : ""}`}
                onClick={() => handleOptionSelect(option.id)}
                disabled={showAnswers || canceledOptions.has(option.id)}
              >
                <div className="flex flex-col">
                  <span className="font-bold mb-4">{option.option_text}</span>
                  {getImageSrc(option.image) && (
                    <div className="w-full overflow-auto my-4 border rounded-lg bg-white p-2">
                      <Image
                        src={getImageSrc(option.image)!}
                        alt={`Option ${option.text}`}
                        width={800}
                        height={600}
                        className="max-w-full w-full sm:w-auto h-auto object-contain"
                        priority
                        quality={100}
                      />
                    </div>
                  )}
                </div>
              </button>

              {/* Expand Button - centered below */}
              {getImageSrc(option.image) && (
                <div className="flex justify-center mt-2">
                  <button
                    className="text-xs text-blue-600 underline"
                    onClick={() => setFullscreenImage(getImageSrc(option.image)!)}
                  >
                    🔍 Expand
                  </button>
                </div>
              )}

              {/* Cancel/Uncancel Button - right middle absolute */}
              <button
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xl"
                onClick={() => toggleCancelOption(option.id)}
              >
                {canceledOptions.has(option.id) ? (
                  <IoRefreshCircle className="text-green-500" />
                ) : (
                  <IoCloseCircle className="text-red-500" />
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Explanation */}
        {showAnswers && (
          <div className="bg-white shadow-lg rounded-lg p-6 mt-4">
            <h3 className="text-lg font-semibold mb-4">Explanation:</h3>
            <div>
              {selectedOption &&
                questionData.options.find((option) => option.id === selectedOption)
                ?
                <div className="flex flex-col">

                  <p className="font-bold mb-4">{questionData.why_correct_option.why_correct_option_text}</p>
                  {getImageSrc(questionData.why_correct_option.image) && (
                    <div className="w-full max-w-full overflow-auto my-4 border rounded-lg bg-white p-2 cursor-zoom-in">
                      <Image
                        src={getImageSrc(questionData.why_correct_option.image)!}
                        alt={`Option`}
                        width={800} // high resolution base width
                        height={600} // adjusts based on aspect ratio
                        className="max-w-full w-full sm:w-auto h-auto object-contain"
                        priority
                        quality={100}
                        onClick={() => setFullscreenImage(getImageSrc(questionData.why_correct_option.image))}

                      />

                    </div>
                  )}</div>
                : questionData.why_incorrect_option.why_incorrect_option_text}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 w-11/12 p-4 flex justify-between">
        <button
          className={`text-white rounded-lg p-3 ${currentQuestionIndex === 0
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-orange-500"
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
            onClick={handleNext}
          >
            Exit
          </button>
        ) : (
          <button
            className="bg-orange-500 text-white rounded-lg p-3"
            onClick={handleNext}
          >
            Next &raquo;&raquo;
          </button>
        )}
      </div>
      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center cursor-zoom-out"
          onClick={() => setFullscreenImage(null)}
        >
          <img
            key={fullscreenImage} // 👈 Force React to treat each image as unique
            src={fullscreenImage}
            alt="Full View"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

    </div>
  );
};

export default QuestionComponent;
