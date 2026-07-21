"use client";

import Navbar from "@/components/mainComponent/Navbar";
import { useState, useEffect } from "react";
import Footer from "@/components/mainComponent/Footer";

export default function HowToRegister() {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.title = "How to Register - AIT Institute";
  }, []);

  return (
    <div >
      <Navbar/>
    <div className="min-h-screen bg-Black text-cream flex items-center justify-center px-4">
      <section className="text-center max-w-2xl">
        {/* <h1 className="text-3xl md:text-4xl font-medium text-black dark:text-cream bg-gradient-to-r from-black to-seaGreen dark:from-seaGreen dark:to-cream bg-clip-text text-transparent">
          Registration is Coming Soon{dots}
        </h1> */} <h1 className="text-4xl sm:text-5xl md:text-6xl px-4 text-center font-[400] text-cream mb-6 bg-gradient-to-r from-SeaGrean to-cream bg-clip-text text-transparent animate-pulse">
        Coming Soon
          </h1>
        <p className="mt-4 text-gray-700 dark:text-gray-300 text-3xl font-[400] text-center mb-12 animate-on-scroll visible bg-gradient-to-r from-Black to-SeaGrean dark:from-SeaGrean dark:to-cream
         bg-clip-text text-transparent transform hover:scale-105 transition-transform duration-300">
          We are working on the Applying  process. Stay tuned for updates!
        </p>
        <div className= "mt-8 animate-bounce text-seaGreen dark:text-orange text-3xl">
          ⏳
        </div>
       
      </section>
    </div>
    <Footer/>
    </div>
  );
}
