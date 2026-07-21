"use client"

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ArrowRightIcon, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const TechLinesBackground: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const slideDuration = 20000;
  const textAnimationDuration = 5000;

  const items = useMemo(() => [
    {
      image: "/assets/mainPics/banner1.jpg",
      title: "Free & Verified Tech Courses",
      description:
        "Empowering students through AI, Computer Science, and Software Engineering—100% free, fully certified by the Al‑Khair Institute. Join now to gain in-demand skills and a recognized certificate.",
    },
    {
      image: "/assets/mainPics/banner2.jpg",
      title: "Master AI & Software Development",
      description:
        "Dive into cutting-edge AI and software engineering courses. Learn practical skills with hands-on projects and get certified to stand out in the tech industry.",
    },
    {
      image: "/assets/mainPics/banner3.jpg",
      title: "Build Your Tech Career",
      description:
        "Our programs are designed to prepare you for real-world challenges. Get expert guidance, industry-relevant skills, and a certificate to boost your career.",
    },
  ], []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex: number) => (prevIndex + 1) % items.length);
  }, [items.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prevIndex: number) =>
      prevIndex === 0 ? items.length - 1 : prevIndex - 1
    );
  }, [items.length]);

  useEffect(() => {
    const interval = setInterval(nextSlide, slideDuration);
    return () => clearInterval(interval);
  }, [nextSlide]);

  useEffect(() => {
    const fullText = items[currentIndex]?.description || "";
    setDisplayedText("");

    let index = 0;
    const interval = setInterval(() => {
      if (index < fullText.length) {
        setDisplayedText(fullText.substring(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, textAnimationDuration / fullText.length);

    return () => clearInterval(interval);
  }, [items, currentIndex]);

  return (
    <div
      className="relative w-full h-[100vh] sm:h-[100vh] overflow-hidden bg-cover bg-center transition-all duration-1000"
      style={{ backgroundImage: `url('${items[currentIndex].image}')` }}
    >
      <div className="absolute inset-0 bg-black/50 pointer-events-none"></div>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5 sm:px-10 z-10">
        <div className="max-w-4xl animate-in slide-in-from-bottom duration-1000">
          <h2 className="text-4xl sm:text-5xl md:text-6xl mx-auto px-5 font-[400] text-cream mb-6 bg-gradient-to-r from-SeaGrean to-cream bg-clip-text text-transparent animate-pulse h-fit overflow-visible pb-2">
            {items[currentIndex].title}
          </h2>
          <p className="text-[clamp(1rem,2.5vw,1.5rem)] text-gray-300 mb-8">
            {displayedText}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <Link href="/courses">
              <Button
                className="relative overflow-hidden rounded-full bg-SeaGrean dark:bg-Orange text-cream 
                text-sm sm:text-lg px-6 sm:px-8 py-3 sm:py-5 min-w-[150px] max-w-[300px] w-full 
                transition-all duration-300 transform hover:scale-[1.02]
                before:absolute before:inset-0 before:bg-cream/20 dark:before:bg-Orange/20 
                before:origin-left before:scale-x-0 hover:before:scale-x-100 
                before:transition-transform before:duration-500"
              >
                <span className="relative z-10">Explore Courses</span>
              </Button>
            </Link>

            <a href="https://lms.iak.ngo">
              <Button
                className="relative overflow-hidden rounded-full bg-transparent border-2 border-SeaGrean dark:border-Orange 
                  text-cream text-sm sm:text-lg px-6 sm:px-8 py-3 sm:py-5 min-w-[150px] max-w-[300px] w-full 
                  transition-all duration-300 transform hover:scale-[1.02]
                  before:absolute before:inset-0 before:bg-SeaGrean dark:before:bg-Orange
                  before:translate-x-[-100%] hover:before:translate-x-0 before:transition-transform before:duration-500
                  hover:border-transparent hover:glow-SeaGrean/30 dark:hover:glow-Orange/30"
              >
                <span className="relative z-10 flex items-center">
                  Go to LMS
                  <ArrowRightIcon className="ml-2 sm:ml-3 h-4 sm:h-5 w-4 sm:w-5 animate-bounce" />
                </span>
              </Button>
            </a>
          </div>
        </div>
      </div>

      <button
        onClick={prevSlide}
        className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 bg-SeaGrean/20 hover:bg-SeaGrean p-3 sm:p-4 rounded-full z-30"
      >
        <ChevronLeft className="h-5 sm:h-6 w-5 sm:w-6 text-cream" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 bg-SeaGrean/20 hover:bg-SeaGrean p-3 sm:p-4 rounded-full z-30"
      >
        <ChevronRight className="h-5 sm:h-6 w-5 sm:w-6 text-cream" />
      </button>
    </div>
  );
};

export default TechLinesBackground;
