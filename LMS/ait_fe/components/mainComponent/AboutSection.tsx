"use client"

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

const AboutSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    const currentSection = sectionRef.current;
    if (currentSection) {
      observer.observe(currentSection);
    }

    return () => {
      if (currentSection) {
        observer.unobserve(currentSection);
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`bg-gradient-to-br from-SeaGrean/20 via-cream to-SeaGrean/20 dark:from-Black dark:to-Blue/20 py-16 md:py-24 relative overflow-hidden flex items-center justify-center transition-all duration-1000 ${isVisible ? "opacity-100" : "opacity-0"
        }`}
    >

      <div
        ref={containerRef}
        className={`w-full max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col lg:flex-row items-center transition-all duration-[1500ms] ${isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
      >
        {/* Left Content Card */}
        <div className="bg-cream/50 dark:bg-black w-full lg:w-[60%] rounded-3xl lg:rounded-br-[8rem] p-8 md:p-12 lg:p-16 z-20 flex flex-col justify-center shadow-2xl relative border border-Black/10 dark:border-white/5 lg:border-r-0 transform lg:-translate-r-12">
          <h4 className="text-orange-500 text-sm md:text-base font-medium mb-3 tracking-wide">
            Welcome to AIT
          </h4>

          <h2 className="text-4xl md:text-5xl lg:text-5xl font-bold text-SeaGrean mb-4 leading-[1.15] tracking-widest">
            Where Technology Meets
            <span className="text-orange-500"> Excellence!</span>
          </h2>

          <p className="text-Black/80 dark:text-white text-sm md:text-base leading-relaxed mb-10">
            At Al-Khair Institute of Technology, we believe that education should be more than just learning. It should be an experience that empowers individuals and communities to thrive and reach their goals. As a respected NGO project, we are committed to delivering exceptional tech education. These free courses are fully backed and accredited, aiming to empower underserved communities in Pakistan with modern tech skills. With years of excellence in vocational and digital education, we strive to provide the best learning experience. Join us on this exciting journey and discover a new level of technology excellence.
          </p>

          {/* Logos */}
          <div className="flex items-center gap-6 mt-4">
            <div className="bg-cream/50 dark:bg-[#2a2a2c] rounded-xl p-3 border border-Black/10 dark:border-white/10 hover:border-SeaGrean/50 transition-colors">
              <img
                src={theme === 'dark' ? "/assets/mainPics/AIT_Logo_Night.png" : "/assets/mainPics/AIT_Logo_Day.png"}
                alt="AIT Logo"
                className="h-10 sm:h-12 object-contain"
              />
            </div>
            <div className="bg-cream/50 dark:bg-[#2a2a2c] rounded-xl p-3 border border-Black/10 dark:border-white/10 hover:border-SeaGrean/50 transition-colors">
              <img
                src="/assets/mainPics/Remove background project.png"
                alt="Idara Logo"
                className="h-10 sm:h-12 object-contain"
              />
            </div>
          </div>
        </div>

        {/* Right Image Container (Overlapped) */}
        <div className="w-full lg:w-[50%] lg:-ml-24 relative overflow-hidden rounded-3xl shadow-2xl z-10 min-h-[400px] mt-8 lg:mt-0 lg:h-[600px]">
          <img
            src="/assets/mainPics/banner1.jpg"
            alt="AIT Excellence"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Subtle dots pattern overlay to match the image */}
          <div className="absolute top-4 right-4 w-20 h-20 opacity-20 bg-[radial-gradient(#SeaGrean_2px,transparent_2px)] [background-size:12px_12px]" />
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
