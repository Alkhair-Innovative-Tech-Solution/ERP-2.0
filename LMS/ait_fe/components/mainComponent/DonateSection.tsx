'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Heart, Mail, User, DollarSign, Send, Gift, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DonateSection = () => {
  const [isBoxOpen, setIsBoxOpen] = useState(false);
  const giftBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (giftBoxRef.current && !isBoxOpen) {
        giftBoxRef.current.classList.add('animate-bounce');
        setTimeout(() => {
          if (giftBoxRef.current) {
            giftBoxRef.current.classList.remove('animate-bounce');
          }
        }, 1500);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isBoxOpen]);

  return (
    <div className="py-24 bg-gradient-to-br from-SeaGrean/20 via-cream to-SeaGrean/20 dark:from-Black dark:via-Black dark:to-Blue/20 relative overflow-hidden transition-all duration-500">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 -top-48 -left-48 bg-SeaGrean/20 dark:bg-Orange/20 rounded-full blur-3xl" />
        <div className="absolute w-96 h-96 -bottom-48 -right-48 bg-Blue/20 dark:bg-SeaGrean/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center mb-16"
        >
          {/* <Heart className="w-12 h-12 text-SeaGrean dark:text-Orange mb-6 animate-pulse" /> */}
          <h2 className="text-6xl font-[300] text-center bg-gradient-to-r from-Black via-SeaGrean to-Black dark:from-SeaGrean dark:via-cream dark:to-SeaGrean bg-clip-text text-transparent mb-6">
            Support Our Mission
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 text-center max-w-3xl mx-auto font-[300] leading-relaxed">
            Your generous contribution empowers us to provide cutting-edge technology education and develop innovative solutions for a brighter tomorrow.
          </p>
        </motion.div>

        <div className="flex justify-center">
          <AnimatePresence>
            {!isBoxOpen ? (
              <motion.div
                ref={giftBoxRef}
                onClick={() => setIsBoxOpen(true)}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                whileHover={{ scale: 1.05 }}
                className="relative w-64 h-64 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-SeaGrean to-Blue dark:from-Orange dark:to-SeaGrean rounded-2xl shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-tech-pattern opacity-10" />
                  <div className="h-full flex flex-col items-center justify-center p-6">
                    <Gift className="w-20 h-20 text-cream mb-4 animate-float" />
                    <h3 className="text-2xl font-[400] text-cream text-center tracking-wide mb-2">Open Gift Box</h3>
                    <p className="text-cream/80 text-center font-[300]">Click to make a difference</p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="w-full max-w-md"
              >
                <div className="relative bg-gradient-to-br from-cream to-SeaGrean/20 dark:from-Blue/90 dark:to-Black/90 rounded-2xl p-8 shadow-2xl border border-SeaGrean/20 dark:border-Orange/20">
                  <button
                    onClick={() => setIsBoxOpen(false)}
                    className="absolute top-4 left-4 p-2 text-SeaGrean dark:text-Orange hover:bg-SeaGrean/10 dark:hover:bg-Orange/10 rounded-full transition-all duration-300"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <h3 className="text-3xl font-[400] text-SeaGrean dark:text-cream text-center mb-8 tracking-wide">Make a Donation</h3>

                  <form className="space-y-6">
                    {[
                      { id: 'name', icon: User, placeholder: 'John Doe', label: 'Full Name' },
                      { id: 'email', icon: Mail, placeholder: 'john@example.com', label: 'Email Address' },
                      { id: 'amount', icon: DollarSign, placeholder: '100', label: 'Donation Amount', type: 'number' }
                    ].map((field) => (
                      <div key={field.id}>
                        <label htmlFor={field.id} className="block text-sm font-[400] text-Black/80 dark:text-cream/80 mb-2 tracking-wide">
                          {field.label}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <field.icon className="h-5 w-5 text-SeaGrean dark:text-Orange" />
                          </div>
                          <input
                            type={field.type || 'text'}
                            id={field.id}
                            className="w-full pl-10 p-3 bg-SeaGrean/5 dark:bg-Orange/5 border-2 border-SeaGrean/20 dark:border-Orange/20 
                              text-Black dark:text-cream rounded-xl focus:ring-2 focus:ring-SeaGrean dark:focus:ring-Orange 
                              focus:border-SeaGrean dark:focus:border-Orange transition-all duration-300
                              placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            placeholder={field.placeholder}
                          />
                        </div>
                      </div>
                    ))}

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      className="w-full py-4 px-6 mt-6 bg-gradient-to-r from-SeaGrean to-Blue dark:from-Orange dark:to-SeaGrean 
                        text-cream rounded-xl font-[400] tracking-wide text-lg shadow-lg 
                        hover:shadow-SeaGrean/20 dark:hover:shadow-Orange/20 transition-all duration-300
                        flex items-center justify-center space-x-2"
                    >
                      <Heart className="w-5 h-5 animate-pulse" />
                      <span>Donate Now</span>
                    </motion.button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default DonateSection;
