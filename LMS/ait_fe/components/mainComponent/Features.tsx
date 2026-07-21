'use client'
import React from "react";
import { FlaskConical, HelpCircle, BarChart } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";

const features = [
  {
    icon: <FlaskConical size={30} className="text-SeaGrean dark:text-Orange" />,
    title: "Live Test",
    description: "Experience real-time testing environments that simulate actual exam conditions. Practice with industry-standard questions to build confidence."
  },
  {
    icon: <HelpCircle size={30} className="text-SeaGrean dark:text-Orange" />,
    title: "High Yield Questions",
    description: "Access our curated collection of high-impact questions designed by industry experts to maximize your learning potential."
  },
  {
    icon: <BarChart size={30} className="text-SeaGrean dark:text-Orange" />,
    title: "Insightful Analytics",
    description: "Track your progress with detailed performance metrics and personalized insights to identify areas for improvement."
  }
];

const Service = () => {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-cream dark:bg-Black">
        <div className="absolute inset-0 bg-gradient-to-br from-SeaGrean/10 dark:from-Blue/20 to-transparent"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-[400] leading-tight transition-colors duration-200 
            bg-gradient-to-r from-Black to-SeaGrean dark:from-SeaGrean dark:to-cream
            bg-clip-text text-transparent ">
            Empowering Your Learning Journey
          </h2>
          <p className="text-Black dark:text-gray-300 text-xl leading-relaxed">
            Discover our comprehensive suite of learning tools and resources
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-8">
          {features.map(({ icon, title, description }, index) => (
            <div
              key={index}
              className="space-y-4 p-6 rounded-xl shadow-md bg-white/5 dark:bg-Blue/5 
                backdrop-blur-sm hover:bg-SeaGrean/5 dark:hover:bg-Blue/10 
                transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
            >
              <div className="bg-SeaGrean/10 dark:bg-Blue/10 w-12 h-12 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 text-SeaGrean dark:text-Orange">
                  {icon}
                </div>
              </div>
              <div className="flex flex-col justify-between gap-4">
              <div className="">
                <h3 className="text-Black dark:text-white font-[300] text-xl">
                  {title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {description}
                </p>
              </div>
              <Link href="/about">
                <button className="relative h-12 w-44 overflow-hidden border-2 border-SeaGrean dark:border-Orange 
                  text-Black dark:text-white font-[300] rounded-full transition-all duration-300 
                  before:absolute before:left-0 before:-ml-2 before:h-48 before:w-48 before:origin-top-right 
                  before:-translate-x-full before:translate-y-12 before:-rotate-90 before:bg-SeaGrean 
                  dark:before:bg-Orange before:transition-all before:duration-300 hover:text-white 
                  dark:hover:text-Black hover:border-SeaGrean dark:hover:border-Orange hover:before:-rotate-180 
                  shadow-lg hover:shadow-SeaGrean/20 dark:hover:shadow-Orange/20">
                  <span className="relative z-10">Explore More →</span>
                </button>
              </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Service;
