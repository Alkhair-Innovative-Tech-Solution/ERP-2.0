"use client"

import { motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

const CertificationSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const logosRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
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
      className="py-16 md:py-24 bg-gradient-to-br from-SeaGrean/20 via-cream to-SeaGrean/20 dark:from-Blue/30 dark:via-Black dark:to-Blue/30 relative overflow-hidden flex items-center justify-center transition-all duration-1000 tracking-wider"
    >
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-SeaGrean/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-Orange/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-bold mb-6 text-Black dark:text-white tracking-wider"
          >
            What You’ll <span className="text-SeaGrean">Get</span>
          </motion.h2>
          <div className="w-24 h-1.5 bg-Orange mx-auto rounded-full" />
        </div>

        <div
          className={`max-w-5xl mx-auto transition-all duration-1000 transform ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
        >
          <div className="bg-cream/50 dark:bg-[#1C1C1D]/80 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-14 border border-Black/10 dark:border-white/5 shadow-2xl relative overflow-hidden group">
            {/* Inner background pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-5 bg-[radial-gradient(var(--SeaGrean)_2px,transparent_2px)] [background-size:16px_16px]" />

            <p className="text-center text-xl md:text-2xl text-gray-700 dark:text-gray-300 leading-relaxed mb-12 font-medium max-w-3xl mx-auto">
              Upon successful completion, students receive a{" "}
              <span className="text-Orange font-bold">Verified Certificate</span> from the Al-Khair Institute of Technology—recognized within Pakistan’s tech community.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left Column */}
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-2 h-8 bg-SeaGrean rounded-full shrink-0" />
                  <div>
                    <h4 className="text-orange text-xl font-bold mb-2 tracking-widest uppercase">Certificate Format</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">Printable PDF + QR code + digital seal</p>
                  </div>
                </div>

                <div className="bg-cream/50 dark:bg-[#2a2a2c]/50 rounded-2xl p-6 border border-Black/5 dark:border-white/5 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-500">
                  <img
                    src={theme === 'dark' ? "/assets/mainPics/AIT_Logo_Night.png" : "/assets/mainPics/AIT_Logo_Day.png"}
                    alt="AIT Logo"
                    className="h-16 md:h-20 object-contain"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="bg-cream/30 dark:bg-[#2a2a2c]/30 rounded-3xl p-8 border border-Black/5 dark:border-white/5">
                <h4 className="text-Black dark:text-white text-xl font-bold mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-SeaGrean/10 flex items-center justify-center text-orange text-sm">
                    ✓
                  </span>
                  Use Your Certification
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">Showcase it on LinkedIn or resumes to highlight:</p>
                <ul className="space-y-4">
                  {[
                    "Course title and specialization",
                    "Official completion date",
                    "Industry-recognized verification by AIT",
                    "Accredited by Al-Khair Institute"
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-SeaGrean" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CertificationSection;
