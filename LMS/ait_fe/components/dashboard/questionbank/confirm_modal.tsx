'use client';
import React, { useState } from "react";
import Image from "next/image";
import { FaThumbsUp, FaThumbsDown } from "react-icons/fa";

interface ConfirmModalProps {
  isOpen: boolean;
  reviewData: {
    totalQuestions: number;
    attempted: number;
    subjectTopics: { subject: string; topics: string[] }[];
    details: {
      question_id: number;
      question_text: string;
      selected_answer_id: string | null;
      selected_answer: string | null;
      correct_answer: string | null;
      isCorrect: boolean;
      subject: string;
      topic: string;
    }[];
  } | null;
  onCancel: () => void;
  questionsData: any[];
}

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

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, reviewData, onCancel, questionsData }) => {
  const [topicIndex, setTopicIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  
  if (!isOpen || !reviewData) return null;


  const topics = reviewData.subjectTopics.flatMap(subject =>
    subject.topics.map(topic => ({ subject: subject.subject, topic }))
  );

  const currentTopic = topics[topicIndex];
  const questionsInTopic = reviewData.details.filter(q => q.topic === currentTopic.topic);
  const currentReview = questionsInTopic[questionIndex];
  const questionData = questionsData.find(q => q.id === currentReview?.question_id);

  const goToNextQuestion = () => {
    if (questionIndex < questionsInTopic.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else if (topicIndex < topics.length - 1) {
      setTopicIndex(topicIndex + 1);
      setQuestionIndex(0);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-md z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[90vw] md:w-[85vw] max-h-[90vh] h-[85vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-orange-600">Detailed Review</h2>

        {/* Topic Navigation */}
        <div className="flex justify-between mb-4">
          <button
            className={`px-4 py-2 rounded-md ${topicIndex === 0 ? 'bg-gray-300' : 'bg-orange-500 text-white'}`}
            disabled={topicIndex === 0}
            onClick={() => { setTopicIndex(topicIndex - 1); setQuestionIndex(0); }}
          >
            ⬅ Previous Topic
          </button>
          <h3 className="text-lg font-semibold text-orange-700">{currentTopic.subject} - {currentTopic.topic}</h3>
          <button
            className={`px-4 py-2 rounded-md ${topicIndex === topics.length - 1 ? 'bg-gray-300' : 'bg-orange-500 text-white'}`}
            disabled={topicIndex === topics.length - 1}
            onClick={() => { setTopicIndex(topicIndex + 1); setQuestionIndex(0); }}
          >
            Next Topic ➡
          </button>
        </div>

        {/* Question Display */}
        {questionData && (
          <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
            <h4 className="text-xl font-semibold mb-4">
              Question {questionIndex + 1}:
            </h4>
            <p className="text-lg mb-4">{questionData.question_text}</p>
            {getImageSrc(questionData.image) && (
              <div className="mb-6">
                <Image
                  src={getImageSrc(questionData.image)!}
                  alt="Question"
                  width={500}
                  height={300}
                  style={{ objectFit: "contain" }}
                />
              </div>
            )}

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {questionData.options.map((option: any) => {
                const isSelected = option.id === currentReview.selected_answer_id;
                const isCorrect = option.is_correct;

                return (
                  <div key={option.id} className="relative flex flex-col">
                    <div
                      className={`border border-gray-300 rounded-lg p-4 text-left transition duration-200 ease-in-out flex justify-between w-full
                        ${!currentReview.selected_answer_id ? "bg-gray-200 text-gray-500" : ""}
                        ${isSelected ? (isCorrect ? "bg-green-400" : "bg-orange-400") : ""}
                        ${!isSelected && isCorrect ? "bg-green-200" : ""}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold mb-4">{option.option_text}</span>
                        {getImageSrc(option.image) && (
                          <Image
                            src={getImageSrc(option.image)!}
                            alt="Option"
                            width={500}
                            height={300}
                            style={{ objectFit: "contain" }}
                          />
                        )}
                      </div>
                      {isSelected && (
                        <div className="ml-2 mr-4 flex items-center">
                          {isCorrect ? <FaThumbsUp className="text-white" /> : <FaThumbsDown className="text-white" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Explanation */}
            <div className="bg-white shadow-lg rounded-lg p-6 mt-4">
              <h3 className="text-lg font-semibold mb-4">Explanation:</h3>
              <div>
                {questionData.why_correct_option 
                  ? <div className="flex flex-col">

                    <p className="font-bold mb-4">{questionData.why_correct_option.why_correct_option_text}</p>
                    {getImageSrc(questionData.why_correct_option.image) && (
                      <Image
                        src={getImageSrc(questionData.why_correct_option.image)!}
                        alt="Option"
                        width={500}
                        height={300}
                        style={{ objectFit: "contain" }}
                      />
                    )}</div>
                  : "No explanation available"}
              </div>
            </div>
          </div>
        )}

        {/* Question Navigation */}
        <div className="flex justify-between mt-4">
          <button
            className={`px-4 py-2 rounded-md ${topicIndex === 0 && questionIndex === 0 ? 'bg-gray-300' : 'bg-green-500 text-white'
              }`}
            disabled={topicIndex === 0 && questionIndex === 0}
            onClick={() => {
              if (questionIndex > 0) {
                setQuestionIndex(questionIndex - 1);
              } else if (topicIndex > 0) {
                const newTopicIndex = topicIndex - 1;
                const newTopic = topics[newTopicIndex];
                const prevTopicQuestions = reviewData.details.filter(q => q.topic === newTopic.topic);
                setTopicIndex(newTopicIndex);
                setQuestionIndex(prevTopicQuestions.length - 1);
              }
            }}
          >
            ⬅ Previous Question
          </button>

          <button
            className={`px-4 py-2 rounded-md ${topicIndex === topics.length - 1 && questionIndex === questionsInTopic.length - 1 ? 'bg-gray-300' : 'bg-green-500 text-white'}`}
            onClick={goToNextQuestion}
          >
            Next Question ➡
          </button>
        </div>

        {/* Exit Button */}
        <div className="flex justify-center mt-6">
          <button className="px-5 py-2 bg-orange-500 text-white rounded-md" onClick={onCancel}>Exit</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
