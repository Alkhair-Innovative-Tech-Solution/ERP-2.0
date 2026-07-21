'use client'
import React from 'react';
import { Target, Eye, Lightbulb, Star, Sparkles } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { useTheme } from 'next-themes';

const MissionVision = () => {
  const { theme } = useTheme();
  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut"  // Fixed easing
      }
    }
  };

  const cards = [
    {
      icon: <Target className="w-8 h-8" />,
      title: "Our Mission",
      description: "To empower individuals through cutting-edge technological education, fostering innovation and ethical leadership that addresses the challenges of tomorrow's digital landscape while serving humanity with compassion and excellence.",
      lightGradient: "from-teal-100 to-teal-200",
      darkGradient: "dark:from-SeaGrean/30 dark:to-teal-800/30"
    },
    {
      icon: <Eye className="w-8 h-8" />,
      title: "Our Vision",
      description: "To be a globally recognized institute that transforms lives through technology education, creating a community of innovative thinkers and ethical leaders who drive positive change in society and contribute to sustainable technological advancement.",
      lightGradient: "from-orange-100 to-orange-200",
      darkGradient: "dark:from-Orange/30 dark:to-orange-800/30"
    },
  ];

  const values = [
    { title: "Excellence", description: "Striving for the highest standards in education and student success." },
    { title: "Innovation", description: "Embracing creativity and cutting-edge technology to drive progress." },
    { title: "Integrity", description: "Upholding honesty, transparency, and ethical behavior in all aspects." },
    { title: "Compassion", description: "Supporting students with care, understanding, and empathy." },
    { title: "Inclusivity", description: "Ensuring equal opportunities and access for all, regardless of background." },
    { title: "Holistic Development", description: "Focusing on the overall growth of students, beyond just technical skills, to prepare them for responsible citizenship in a digital world." }
  ];

  return (
    <section className="relative py-24 bg-gradient-to-br from-SeaGrean/20 via-cream to-SeaGrean/20 dark:from-Blue/30 dark:via-Black dark:to-Blue/30 overflow-hidden transition-colors duration-500">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-20">
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-bold mb-6 text-SeaGrean tracking-wider"
          >
            Mission <span className='text-Orange'>&</span> Vision
            <div className="w-24 h-1 bg-Orange mb-2 mt-2 mx-auto"></div>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-700 dark:text-gray-400 text-lg max-w-3xl mx-auto"
          >
            We envision being a leading force in the industry, driven by innovation, integrity, and inclusivity, creating a brighter technological future for individuals and communities while maintaining a strong commitment to excellence and social development.
          </motion.p>
        </div>

        {/* Mission Section (Image Left, Text Right) */}
        <div className="flex flex-col lg:flex-row items-center gap-12 mb-32">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/2 relative group"
          >
            <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl">
              <img
                src="/assets/mainPics/banner2.jpg"
                alt="Our Mission"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            {/* Decorative dots */}
            <div className="absolute -top-6 -left-6 w-24 h-24 opacity-10 bg-[radial-gradient(#SeaGrean_2px,transparent_2px)] [background-size:12px_12px]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/2 lg:pl-12 border-l-4 border-Orange"
          >
            <h3 className="text-4xl font-bold mb-6 text-SeaGrean uppercase tracking-wider">Mission</h3>
            <p className="text-gray-700 dark:text-gray-300 text-xl leading-relaxed">
              To empower individuals through cutting-edge technological education, fostering innovation and ethical leadership that addresses the challenges of tomorrow&apos;s digital landscape while serving humanity with compassion and excellence.
            </p>
          </motion.div>
        </div>

        {/* Vision Section (Text Left, Image Right) */}
        <div className="flex flex-col-reverse lg:flex-row items-center gap-12 mb-32">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/2 lg:pr-12 text-right border-r-4 border-Orange"
          >
            <h3 className="text-4xl font-bold mb-6 text-SeaGrean uppercase tracking-wider">Vision</h3>
            <p className="text-gray-700 dark:text-gray-300 text-xl leading-relaxed">
              To be a globally recognized institute that transforms lives through technology education, creating a community of innovative thinkers and ethical leaders who drive positive change in society and contribute to sustainable technological advancement.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full lg:w-1/2 relative group"
          >
            <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl">
              <img
                src="/assets/mainPics/banner3.jpg"
                alt="Our Vision"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            {/* Decorative dots */}
            <div className="absolute -bottom-6 -right-6 w-24 h-24 opacity-10 bg-[radial-gradient(#Orange_2px,transparent_2px)] [background-size:12px_12px]" />
          </motion.div>
        </div>

        {/* Core Values Section */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-20"
        >
          <div className="p-12 rounded-[3rem] bg-gradient-to-br from-cream to-SeaGrean/10 dark:from-[#1C1C1D] dark:to-black border border-Black/10 dark:border-white/5 shadow-2xl">
            <div className="flex items-center mb-12 space-x-4 justify-center">
              <Sparkles className="w-10 h-10 text-SeaGrean" />
              <h3 className="text-5xl md:text-6xl font-bold mb-6 text-Black dark:text-white tracking-wider">Core Values That Define Us</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {values.map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-8 rounded-2xl border transition-all duration-500 group ${theme === 'dark'
                    ? 'bg-black/40 border-white/5 hover:border-SeaGrean/50'
                    : 'bg-cream/40 border-Black/5 hover:border-SeaGrean/50 shadow-sm'
                    }`}
                >
                  <h4 className="text-2xl font-bold mb-4 text-SeaGrean group-hover:text-Orange transition-colors">
                    {value.title}
                  </h4>
                  <p className="text-gray-700 dark:text-gray-400 leading-relaxed group-hover:text-Black dark:group-hover:text-gray-200 transition-colors">
                    {value.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default MissionVision;
