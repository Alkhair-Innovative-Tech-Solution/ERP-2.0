
'use client';
import React, { useEffect, useRef } from 'react';
import { FaRegHandshake } from "react-icons/fa6";

interface Partner {
  id: number;
  name: string;
  description: string;
  // logo: string;
}

const partners: Partner[] = [
  {
    id: 1,
    name: "Ali and Ayeza",
    description:
      // "The Ali and Ayeza Impact Fund has brought this facility to life. The fund is dedicated to driving transformational change in communities across Pakistan impacted by chronic poverty. Through its partnership with Idara Al-Khair and our strategic partner, Thaakat Foundation, the fund supports initiatives that improve access to education and healthcare. Every investment is rooted in the belief that sustainable development begins with opportunity—helping each person not just survive, but thrive independently and with dignity.",
      // logo: "/assets/mainPics/Thakat.png"
      "The Ali and Ayeza Impact Fund is the heart behind this remarkable transformation. With a bold vision to break the cycle of poverty, this fund is changing lives across Pakistan by turning hope into lasting opportunity. In collaboration with Idara Al-Khair and our esteemed partner, Thaakat Foundation, the fund champions projects that bring quality education and essential healthcare to underserved communities.          Every initiative they support is a step toward a brighter future—one where people are empowered not just to survive, but to flourish with dignity, independence, and pride. The fund believes that true progress begins when every individual is given the tools to unlock their full potential. Their unwavering commitment is not just creating change — it's creating generational impact."
  },
];

const Partners = () => {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={sectionRef}
      className="relative min-h-[500px] overflow-hidden py-24 tracking-wider bg-gradient-to-br from-SeaGrean/20 via-cream to-SeaGrean/20 dark:from-Black dark:via-Black dark:to-Black transition-colors duration-500"
    >
      {/* Subtle Background Elements */}
      <div className="absolute top-0 left-0 w-full z-0">
        <div
          className="absolute bottom-0 left-0 w-full h-32"
          style={{ clipPath: 'polygon(0 100%, 100% 100%, 100% 0)' }}
        ></div>
      </div>

      <div className="container mx-auto px-4 relative z-10 w-full ">
        {/* Header Content - Restored to Original Style but Professional */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="bg-SeaGrean/10 p-5 rounded-full mb-6">
            <FaRegHandshake className="w-12 h-12 text-orange-500" />
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-Black dark:text-white mb-4 tracking-widest">
            Our <span className="text-SeaGrean">Partners</span>
          </h2>
          <div className="w-20 h-1.5 bg-orange-500 rounded-full" />
        </div>

        {/* Professional Typography Layout for Partner Description */}
        <div className="max-w-5xl mx-auto mt-20">
          <div className="bg-gradient-to-br from-cream/80 to-SeaGrean/10 dark:from-black dark:to-SeaGrean/20 rounded-[3rem] p-10 md:p-20 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-Black/10 dark:border-gray-100 relative group transition-all duration-500 hover:shadow-2xl">
            {/* Decorative Quotation Mark */}
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row gap-8 items-start mb-10">
                <div className="shrink-0">
                  <h3 className="text-3xl font-black text-Black  dark:text-white border-l-8 border-orange-500 pl-6 uppercase tracking-widest">
                    Ali <span className="text-orange-500">&</span> Ayeza
                  </h3>
                  <p className="text-orange-500 font-bold mt-2 ml-8 tracking-widest uppercase text-sm">Impact Fund</p>
                </div>
              </div>

              <p className="text-Black/80 dark:text-white text-xl md:text-2xl leading-[1.8] font-medium italic text-justify md:text-left">
                {partners[0].description}
              </p>

              <div className="mt-12 flex justify-end">
                <div className="w-32 h-1 bg-gradient-to-r from-transparent to-SeaGrean/30 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern accent for the bottom corner */}
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-SeaGrean/5 rounded-full blur-3xl pointer-events-none -mr-32 -mb-32" />
    </div>
  );
};

export default Partners;
