"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowRightIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";
import Image from "next/image";
interface CarouselProps {
  items: {
    image: string;
    title: string;
    description: string;
  }[];
  autoPlayInterval?: number;
}

export default function Carousel({
  items,
  autoPlayInterval = 5000,
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const nextSlide = useCallback(() => {
    setCurrentIndex((current) => (current + 1) % items.length);
  }, [items.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((current) => (current - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(nextSlide, autoPlayInterval);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide, autoPlayInterval]);

  const newLocal = (
    <ChevronRight className="h-4 w-4 sm:h-8 sm:w-8 text-SeaGrean dark:text-cream font-semibold animate-pulse" />
  );
  return (
    <div
      className="carousel"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      <div
        className="carousel-inner"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {items.map((item, index) => (
          <div key={index} className="carousel-item">
            <div className="relative w-full h-[600px]">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-Black/80 via-Black/50 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center text-center px-20">
                <div className="max-w-3xl animate-in slide-in-from-bottom duration-1000">
                  <h2
                    className="text-4xl sm:text-5xl md:text-6xl mx-auto
                   px-5 font-[400] text-cream mb-6 bg-gradient-to-r from-SeaGrean to-cream bg-clip-text text-transparent animate-pulse"
                  >
                    {item.title}
                  </h2>
                  <p
                    className="text-xl mx-10 sm:text-2xl
                   text-gray-300 mb-10"
                  >
                    {item.description}
                  </p>
                  <div className="flex items-center justify-center gap-6 ">
                    <Link href="/register">
                      <Button
                        className="relative overflow-hidden rounded-full bg-SeaGrean dark:bg-Orange text-cream 
                          text-sm sm:text-lg px-6 sm:px-8 py-4 sm:py-6 w-full sm:w-auto 
                          transition-all duration-300 transform hover:scale-[1.02]
                          before:absolute before:inset-0 before:bg-SeaGrean/20 dark:before:bg-Orange/20 
                          before:translate-x-[-100%] hover:before:translate-x-0 before:transition-transform before:duration-500
                          hover:border-transparent hover:glow-SeaGrean/30 dark:hover:ring-2 dark:hover:ring-Orange/50"
                      >
                        <span className="relative z-10">How to Register</span>
                      </Button>
                    </Link>

                    <Link href="/register">
                      <Button
                        className="relative overflow-hidden rounded-full bg-transparent border-2 border-SeaGrean dark:border-Orange 
                                  text-cream text-sm sm:text-lg px-6 sm:px-8 py-4 sm:py-6 w-full sm:w-auto 
                                  transition-all duration-300 transform hover:scale-[1.02]
                                  before:absolute before:inset-0 before:bg-SeaGrean dark:before:bg-Orange
                                  before:translate-x-[-100%] hover:before:translate-x-0 before:transition-transform before:duration-500
                                  hover:border-transparent hover:glow-SeaGrean/30 dark:hover:glow-Orange/30" >
                        <span className="relative z-10 flex items-center">
                          Enroll Now
                          <ArrowRightIcon className="ml-2 sm:ml-3 h-4 sm:h-5 w-4 sm:w-5 animate-bounce" />
                        </span>
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={prevSlide}
        className="carousel-button carousel-button-prev rounded-full bg-SeaGrean/20 hover:bg-SeaGrean 
          transition-all duration-500 transform hover:scale-110 hover:shadow-lg hover:shadow-SeaGrean/50"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-4 w-4 sm:h-8 sm:w-8 text-SeaGrean dark:text-cream font-semibold animate-pulse" />
      </button>

      <button
        onClick={nextSlide}
        className="carousel-button carousel-button-next rounded-full bg-SeaGrean/20 hover:bg-SeaGrean 
          transition-all duration-500 transform hover:scale-110 hover:shadow-lg hover:shadow-SeaGrean/50"
        aria-label="Next slide"
      >
        {newLocal}
      </button>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex space-x-3">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 rounded-full transition-all duration-500 transform hover:scale-125
                      ${index === currentIndex
                ? "bg-SeaGrean w-12 animate-pulse"
                : "bg-cream/30 w-6 hover:bg-cream/50"
              }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
