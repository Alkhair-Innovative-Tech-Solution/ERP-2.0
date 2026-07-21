'use client';
import React, { useEffect, useRef } from 'react';
import { MessageSquare, ArrowRight } from 'lucide-react';

const ContactLink = () => {
  const linkRef = useRef<HTMLDivElement>(null);

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

    const currentLink = linkRef.current;
    if (currentLink) {
      observer.observe(currentLink);

      return () => {
        observer.unobserve(currentLink);
      };
    }
  }, []);

  return (
    <div className="py-16 bg-gradient-to-br from-SeaGrean/20 via-cream to-SeaGrean/20 dark:from-Black dark:via-Black dark:to-Blue/20 transition-colors duration-500">
      <div className="container mx-auto px-4">
        <div
          ref={linkRef}
          className="bg-gradient-to-br from-white to-cream dark:from-SeaGrean/95 dark:to-SeaGrean/80 rounded-2xl p-10 border border-Black/5 dark:border-SeaGrean/30 shadow-lg transition-all duration-1000 transform opacity-0 translate-y-10 hover:shadow-2xl hover:shadow-SeaGrean/30"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1">
              <div className="flex items-center mb-4">
                <MessageSquare className="w-8 h-8 text-SeaGrean dark:text-cream animate-pulse mr-3" />
                <h2 className="text-3xl font-[400] text-Black dark:text-cream tracking-wide">Let&apos;s Connect</h2>
              </div>
              <p className="text-Black/70 dark:text-cream/90 text-lg leading-relaxed font-[300]">
                Have questions about our programs, partnerships, or how you can contribute? Our team is ready to assist you. Reach out to us today.
              </p>
            </div>

            <div>
              <a
                href="/contact"
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-SeaGrean dark:bg-cream/90 px-8 py-4 text-white dark:text-SeaGrean transition-all duration-500 hover:opacity-90"
              >
                <span className="relative z-10 flex items-center font-[400] tracking-wide">
                  Contact Us
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-2" />
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-SeaGrean to-teal-600 dark:from-cream dark:to-white scale-x-0 origin-left transition-transform duration-500 group-hover:scale-x-100"></span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactLink;
