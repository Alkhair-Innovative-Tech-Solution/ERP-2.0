"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiArrowRight, FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function Specializations() {
  const fallbackImage =
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa";
  const [specializations, setSpecializations] = useState<any>([]);

  // Sorting logic
  const sortedSpecializations = [...specializations].sort((a, b) => {
    if (
      a.name.toLowerCase() === "language" &&
      b.name.toLowerCase() === "language"
    )
      return 0;
    if (a.name.toLowerCase() === "language") return 1;
    if (b.name.toLowerCase() === "language") return -1;
    return a.active === b.active ? 0 : a.active ? -1 : 1;
  });

  // Separate into active and inactive
  const activeSpecializations = sortedSpecializations.filter(
    (spec) => spec.active
  );
  const inactiveSpecializations = sortedSpecializations.filter(
    (spec) => !spec.active
  );

  // Find language specialization
  const languageSpecialization = activeSpecializations.find(
    (spec) => spec.name.toLowerCase() === "language"
  );

  // Remove language from active if found
  const finalActiveSpecializations = languageSpecialization
    ? activeSpecializations.filter(
      (spec) => spec.name.toLowerCase() !== "language"
    )
    : activeSpecializations;

  // Final ordered specializations with language at end of active section
  const finalSortedSpecializations = [
    ...finalActiveSpecializations,
    ...(languageSpecialization ? [languageSpecialization] : []),
    ...inactiveSpecializations,
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(1);
  const autoSlideRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch data
  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch fresh data from API
        const [specRes, courseRes] = await Promise.all([
          fetch("/proxy/get?url=/api/courses/specialization/all"),
          fetch("/proxy/get?url=/api/courses/courses/"),
        ]);

        const specData = await specRes.json();
        const courseData = await courseRes.json();

        // Ninja API returns direct array, handle properly
        const specList = Array.isArray(specData) ? specData : (specData.data || []);
        const courseList = Array.isArray(courseData) ? courseData : (courseData.data || []);

        const filteredSpecializations = specList.filter(
          (spec: any) => spec.active === true
        );

        setSpecializations(filteredSpecializations);

        // Update cache
        localStorage.setItem("specializations", JSON.stringify(specList));
        localStorage.setItem("courses", JSON.stringify(courseList));

        console.log("✅ Fetched from API and updated cache");
      } catch (error) {
        console.error("❌ Failed to fetch data", error);
      }
    };
    fetchData();
  }, []);

  // Responsive view
  // Responsive view
  useEffect(() => {
    const updateCardsPerView = () => {
      const width = window.innerWidth;
      if (width >= 1024) setCardsPerView(3); // desktop
      else if (width >= 768) setCardsPerView(2); // tablet
      else setCardsPerView(1); // mobile
    };

    updateCardsPerView();
    window.addEventListener("resize", updateCardsPerView);
    return () => window.removeEventListener("resize", updateCardsPerView);
  }, []);

  const totalSlides = Math.max(
    0,
    finalSortedSpecializations.length - cardsPerView
  );

  // Auto slide
  // Auto slide
  useEffect(() => {
    startAutoSlide();
    return stopAutoSlide;
  }, [currentIndex, cardsPerView, finalSortedSpecializations]);

  const startAutoSlide = () => {
    stopAutoSlide();
    autoSlideRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1 > totalSlides ? 0 : prev + 1));
    }, 5000);
  };

  const stopAutoSlide = () => {
    if (autoSlideRef.current) clearInterval(autoSlideRef.current);
  };

  const pauseAndResumeAutoSlide = () => {
    stopAutoSlide();
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => startAutoSlide(), 6000);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 < 0 ? totalSlides : prev - 1));
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1 > totalSlides ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current !== null && touchEndX.current !== null) {
      const diff = touchStartX.current - touchEndX.current;
      if (diff > 50) nextSlide();
      else if (diff < -50) prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleCardClick = (index: number) => {
    if (index !== activeCardIndex) {
      setActiveCardIndex(index);
      pauseAndResumeAutoSlide();
    }
  };

  const handleMouseEnter = (index: number) => {
    if (activeCardIndex === null) {
      setActiveCardIndex(index);
      pauseAndResumeAutoSlide();
    }
  };

  const handleMouseLeave = (index: number) => {
    if (activeCardIndex === index) {
      setActiveCardIndex(null);
      pauseAndResumeAutoSlide();
    }
  };

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-SeaGrean/20 to-cream dark:from-Blue/30 dark:to-Black transition-all duration-500">
      <div className="relative max-w-7xl mx-auto">
        <h2 className="text-5xl font-[400] text-center mb-12 bg-gradient-to-r from-Black to-SeaGrean dark:from-SeaGrean dark:to-cream bg-clip-text text-transparent">
          Our Specializations
        </h2>

        <div className="relative">
          {/* Carousel container */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseEnter={stopAutoSlide} // Pause on hover
            onMouseLeave={startAutoSlide} // Resume on leave
            className="overflow-hidden"
          >
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{
                transform: `translateX(-${(100 / cardsPerView) * currentIndex
                  }%)`,
              }}
            >
              {specializations.map((spec: any, index: number) => (
                <div
                  key={spec.id}
                  className="w-full px-4"
                  style={{ flex: `0 0 ${100 / cardsPerView}%` }}
                >
                  <div
                    className={`bg-cream dark:bg-Blue rounded-2xl overflow-hidden shadow-lg transition-all duration-500 ease-out ${spec.active
                      ? "hover:shadow-2xl hover:shadow-SeaGrean/20 dark:hover:shadow-Orange/20"
                      : "border border-gray-300 dark:border-gray-600"
                      }`}
                    onMouseEnter={() => handleMouseEnter(index)}
                    onMouseLeave={() => handleMouseLeave(index)}
                  >
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={fallbackImage}
                        alt={spec.name}
                        width={1000}
                        height={600}
                        className="object-cover w-full h-full transform transition-transform duration-700 hover:scale-110"
                      />
                    </div>
                    <div className="p-6 bg-gradient-to-b from-cream to-SeaGrean/5 dark:from-SeaGrean dark:to-Orange/5">
                      <h3
                        className={`text-2xl font-[300] mb-3 ${spec.active
                          ? "text-SeaGrean dark:text-cream"
                          : "text-gray-500 dark:text-gray-400"
                          }`}
                      >
                        {spec.name}
                      </h3>
                      <p
                        className={`text-gray-600 dark:text-gray-300 transition-all duration-300 ${activeCardIndex === index
                          ? ""
                          : "line-clamp-1 overflow-hidden max-h-[4.5em]"
                          } ${spec.active
                            ? "text-gray-600 dark:text-gray-300"
                            : "text-gray-500 dark:text-gray-400"
                          }`}
                      >
                        {spec.description}
                      </p>
                      <div className="mt-4 text-center">
                        <Link
                          href={spec.active ? "/courses" : "#"}
                          className={`inline-flex items-center px-4 py-2 rounded-full transition-all duration-300 transform ${spec.active
                            ? "bg-SeaGrean/10 dark:bg-Orange/10 text-SeaGrean dark:text-Orange hover:bg-SeaGrean hover:text-cream dark:hover:bg-Orange dark:hover:text-cream hover:scale-105"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                            }`}
                          onClick={(e) => {
                            if (!spec.active) e.preventDefault();
                            handleCardClick(index);
                          }}
                        >
                          Learn more
                          <FiArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation controls */}
        {/* Navigation controls */}
        <div className="absolute bottom left-1/2 mt-4 -translate-x-1/2 flex items-center gap-4 z-20">
          <button
            onClick={prevSlide}
            className="bg-SeaGrean/30 hover:bg-SeaGrean p-3 sm:p-4 rounded-full shadow-lg"
          >
            <FiChevronLeft className="h-4 w-4 sm:h-6 sm:w-6 text-cream" />
          </button>

          <button
            onClick={nextSlide}
            className="bg-SeaGrean/30 hover:bg-SeaGrean p-3 sm:p-4 rounded-full shadow-lg"
          >
            <FiChevronRight className="h-4 w-4 sm:h-6 sm:w-6 text-cream" />
          </button>
        </div>


      </div>
    </section>
  );
}
