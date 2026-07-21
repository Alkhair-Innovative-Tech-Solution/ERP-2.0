'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Quote } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const CeoMessage = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
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
    <div
      ref={sectionRef}
      className="py-20 bg-gradient-to-br from-SeaGrean/20 via-cream to-SeaGrean/20 dark:from-Blue dark:via-Black dark:to-Black relative overflow-hidden transition-all duration-1000"
    >
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-0 left-0 w-full h-full bg-tech-pattern bg-cover bg-center opacity-5"></div>
      </div>

      <div className="container mx-auto  relative z-10">
        <div className="flex flex-col md:flex-row items-center ">
          <div
            ref={imageRef}
            className={`w-full md:w-2/5 transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-20'
              }`}
          >
            <div className="relative max-w-xs mx-auto">
              <div className="absolute -inset-3 bg-gradient-to-tr from-SeaGrean/30 to-cream/30 dark:from-Blue/30 dark:to-Orange/30 rounded-full blur-lg opacity-60 animate-float"></div>
              <div className="relative aspect-square overflow-hidden rounded-xl border-2 border-SeaGrean/20 dark:border-cream/10">
                <Image
                  src="/assets/mainPics/Saad Bhai.jpg"
                  alt="CEO of AIT"
                  width={400}
                  height={400}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 bg-SeaGrean dark:bg-Orange text-cream px-4 py-2 rounded-full text-sm font-semibold shadow-md">
                Mohammad Saad Sheikh
              </div>
            </div>
          </div>

          <div
            ref={textRef}
            className={`w-full md:w-3/5 transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-20'
              }`}
          >
            <div className="flex items-center mb-6 ">
              <Quote className="w-10 h-10 text-SeaGrean dark:text-Orange mr-3" />
              <h2 className="text-3xl md:text-4xl font-[400] bg-gradient-to-r from-Black to-Black dark:from-SeaGrean dark:to-cream bg-clip-text text-transparent dark:text-cream pb-[5px]">Message from our CEO</h2>
            </div>

            <div className="bg-cream/80 dark:bg-Blue/30 backdrop-blur-sm rounded-2xl p-8 border border-Black/10 dark:border-cream/10 transition duration-500 delay-200 transform hover:scale-[1.02] shadow-lg hover:shadow-SeaGrean/20 dark:hover:shadow-Orange/20">
              <p className="text-gray-700 dark:text-cream/90 text-lg leading-relaxed mb-6">
                A year ago, I had a vision—to create a space where students from underserved backgrounds could break barriers, equip themselves with digital skills, and turn their dreams into reality. Today, that vision stands as a reality: Al-Khair Institute of Technology (AIT).
              </p>
              <p className="text-gray-700 dark:text-cream/90 text-lg leading-relaxed mb-6">
                With over 10 years of experience in the social sector, I have always been inspired by the raw talent and resilience of students who, despite hardships, achieve remarkable things. However, I have also witnessed many talented students put their dreams on hold due to financial struggles and lack of family support.
              </p>
              <p className="text-gray-700 dark:text-cream/90 text-lg leading-relaxed">
                AIT was born to change that. We aim to provide quick, effective, and high-quality digital skills training, ensuring that every student has an equal opportunity to succeed in the global digital workforce. The digital space is one of the few fields where background does not define success—skills do.
                <br />
                Through AIT, I dream of Pakistanis providing world-class digital services and one day becoming leaders in the global digital economy. This is just the beginning. Together, we will build futures, transform lives, and create lasting change.

                Welcome to AIT—where dreams meet opportunity.
              </p>

              <div className="mt-8 flex items-center">
                {/* <div className="mr-4">
                  <Image
                    src="/assets/Saad Bhai.jpg"
                    alt="CEO Signature"
                    width={60}
                    height={60}
                    className="w-16 h-16 rounded-full object-cover border-2 border-SeaGrean"
                  />
                </div> */}
                <div>
                  <Link rel="stylesheet" href="https://www.linkedin.com/in/msaadsheikh/" >
                    <h4 className="text-xl font-[300] tracking-wide text-Black dark:text-cream">Mohammad Saad Sheikh</h4>
                    <p className="text-SeaGrean">Founder & CEO, AIT</p></Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CeoMessage;
