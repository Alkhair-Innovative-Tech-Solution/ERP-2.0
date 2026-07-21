import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import Animationbg from './Animationbg';

const AboutBanner = () => {
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
          }
        });
      },
      { threshold: 0.1 }
    );

    const currentBanner = bannerRef.current;
    if (currentBanner) {
      observer.observe(currentBanner);
    }

    return () => {
      if (currentBanner) {
        observer.unobserve(currentBanner);
      }
    };
  }, []);

  return (
    <div className="relative h-[100vh] sm:h-[100vh] overflow-hidden">
      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
        style={{ backgroundImage: "url('/assets/mainPics/banner1.jpg')" }}
      ></div>
      <div className="absolute inset-0 bg-black/50 pointer-events-none"></div>

      <Animationbg />

      <div
        ref={bannerRef}
        className="relative z-10 flex flex-col items-center justify-center h-full px-4 transition-all duration-1000 transform opacity-0 translate-y-10"
      >
        <Sparkles className="w-16 h-16 mb-6 text-SeaGrean animate-float" />
        <h1 className="text-4xl sm:text-5xl md:text-6xl px-4 text-center font-[400] text-cream mb-4 bg-gradient-to-r from-SeaGrean to-cream bg-clip-text text-transparent animate-pulse pb-2 h-fit overflow-visible">
          AL-Khair Institute of Technology
        </h1>

        <div className="w-24 h-1 bg-Orange mb-2 mt-2"></div>
        <div className="relative z-10 flex justify-center items-center text-xl sm:text-3xl font-medium tracking-wide mt-2 px-4 py-2 rounded-lg bg-gradient-to-r from-SeaGrean to-cream bg-clip-text animate-pulse mb-4 h-fit overflow-visible">
          <h4 className="relative cursor-pointer hover:text-Orange text-SeaGrean hover:scale-105 transition-all duration-300 ">
            We Are Here For Excellence
          </h4>
        </div>

        <p className="text-[clamp(1rem,2.5vw,1.5rem)] text-gray-300 max-w-4xl text-center mb-8">
          AIT is committed to empowering underserved communities by providing high-quality tech education, driven by innovation and technology.
        </p>
        {/* <button className="group relative overflow-hidden rounded-full bg-SeaGrean px-8 py-3 text-cream transition-all duration-300 hover:bg-SeaGrean/90">
          <span className="relative z-10">Discover Our Vision</span>
          <span className="absolute inset-0 bg-Orange scale-x-0 origin-left transition-transform duration-500 group-hover:scale-x-100"></span>
        </button> */}
      </div>


      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-12 h-20 rounded-full border-2 border-white flex justify-center items-start p-1">
          <div className="w-1 h-3 bg-white rounded-full animate-float"></div>
        </div>
      </div>
    </div>
  );
};

export default AboutBanner;
