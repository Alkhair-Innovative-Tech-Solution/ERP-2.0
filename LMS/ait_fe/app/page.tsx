'use client';

import { useEffect, useRef } from 'react';
import { ArrowRight, Award, Users, BookOpen, GraduationCap } from 'lucide-react';
import Carousel from '@/components/mainComponent/Carousel';
import { ServicesSection } from '@/components/mainComponent/OurServices';
import Service from '@/components/mainComponent/Features';
import TestimonialCarousel from '@/components/mainComponent/Testimonials';
import Navbar from '@/components/mainComponent/Navbar';
import Footer from '@/components/mainComponent/Footer';
import Specialization from '@/components/mainComponent/Specialization';

const Home = () => {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fadeIn');
        }
      });
    });

    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 bg-gradient-to-b from-cream to-SeaGrean/10 dark:from-Black dark:to-Blue/20 transition-colors duration-500">
        {/* Hero Section */}
        <Carousel />

        {/* Specializations Section */}
        <Specialization />

        {/* Our Services Section */}
        <ServicesSection />

        {/* Why Choose AIT Section */}
        <section className="py-16 md:py-20 bg-gradient-to-br from-SeaGrean/20 via-cream to-SeaGrean/20 dark:from-Blue/30 dark:via-Black dark:to-Blue/30 transition-all duration-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* <h2 className="text-3xl  "> */}
            <h1 className='text-center text-3xl  sm:text-4xl md:text-5xl font-semibold mb-10 sm:mb-12 animate-pulse bg-gradient-to-r  to-SeaGrean dark:from-SeaGrean dark:to-cream bg-clip-text'>     Why Choose AIT?
            </h1>
            {/* </h2> */}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {[{ icon: <Award className="h-10 w-10 sm:h-12 sm:w-12 text-SeaGrean dark:text-Orange" />, title: 'Expert Faculty', description: 'Learn from industry professionals' },
              { icon: <Users className="h-10 w-10 sm:h-12 sm:w-12 text-SeaGrean dark:text-Orange" />, title: 'Small Class Size', description: 'Personalized attention and support' },
              { icon: <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 text-SeaGrean dark:text-Orange" />, title: 'Modern Curriculum', description: 'Updated with industry demands' },
              { icon: <GraduationCap className="h-10 w-10 sm:h-12 sm:w-12 text-SeaGrean dark:text-Orange" />, title: 'Career Support', description: 'Placement assistance and guidance' }
              ].map((feature, index) => (
                <div
                  key={index}
                  className="group p-6 sm:p-8 rounded-2xl bg-cream dark:bg-Blue hover:bg-SeaGrean/5 dark:hover:bg-Orange/5 transform hover:-translate-y-2 transition-all duration-500 hover:shadow-lg hover:shadow-SeaGrean/20 dark:hover:shadow-Orange/20"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <div className="flex justify-center mb-4 sm:mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-light text-center mb-2 sm:mb-4 text-Black dark:text-cream group-hover:text-SeaGrean dark:group-hover:text-Orange transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-center text-sm sm:text-base group-hover:text-Black dark:group-hover:text-cream transition-colors duration-300">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <Service />

        {/* Testimonials Section */}
        <TestimonialCarousel />
      </main>
      <Footer />
    </div>
  );
};

export default Home;
