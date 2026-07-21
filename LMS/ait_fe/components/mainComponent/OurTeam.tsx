'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Users, Briefcase, GraduationCap, Heart, Star, ChevronDown, Coffee, Facebook, Twitter, Linkedin, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface TeamMember {
  id: number;
  name: string;
  role: string;
  specialty: string;
  image: string;
  message: string;
  skills: string[];
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    facebook?: string;
  };
}

const teamMembers: TeamMember[] = [
  {
    id: 2,
    name: "Abdul Mateen",
    role: "Head of Academic & Digital Innovation",
    specialty: "Curriculum Development/Full Stack Developer",
    image: "/assets/mainPics/am.jpg",
    message: "Abdul Mateen leads curriculum development, student assessment, and digital learning initiatives. With expertise in educational technology, media integration, and software development, they focus on creating engaging, tech-driven learning experiences to bridge education with industry trends.",
    skills: ["Next.JS", "React", "Python", "JavaScript/TypeScript", "Teaching"],
    socialLinks: {
      linkedin: "https://pk.linkedin.com/in/neetamludba",
      github: "https://github.com/neetamludba"
    }
  },
  {
    id: 3,
    name: "Zia-Ul-Haq",
    role: "Educator",
    specialty: "English Language",
    image: "/assets/mainPics/Sir_zia.png",
    message: "Transforming education through technology to make learning accessible, engaging, and effective for all.",
    skills: ["English Language", "Communication Skills", "IELTS"],
    socialLinks: {
      linkedin: "https://linkedin.com/in/ziaulhaq",
      facebook: "https://facebook.com/ziaulhaq",
      twitter: "https://twitter.com/ziaulhaq"
    }
  },
];

const OurTeam = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(5); // Changed to show all 5 members
  const containerRef = useRef<HTMLDivElement>(null);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const cardVariants = {
    hidden: { y: 50, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  return (
    <section className="relative py-24 bg-gradient-to-br from-SeaGrean/20 via-cream to-SeaGrean/20 dark:from-Black dark:via-Black dark:to-Blue/20 transition-all duration-500">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 -top-48 -left-48 bg-SeaGrean/10 dark:bg-Orange/20 rounded-full blur-3xl" />
        <div className="absolute w-96 h-96 -bottom-48 -right-48 bg-Blue/10 dark:bg-SeaGrean/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-center mb-20"
        >
          <div className="flex items-center justify-center mb-6">
            <Users className="w-12 h-12 text-SeaGrean dark:text-Orange mr-4 animate-pulse" />
            <h2 className="text-6xl font-[300] text-SeaGrean dark:text-cream">
              <span className='text-Black/60 dark:text-cream'>Our </span>Expert Team
            </h2>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto font-[300] leading-relaxed">
            Meet our passionate team of experts dedicated to pushing the boundaries of technology and innovation
          </p>
        </motion.div>

        <motion.div
          ref={containerRef}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-8 "
        >
          {teamMembers.map((member, index) => (
            <motion.div
              key={member.id}
              variants={cardVariants}
              whileHover={{ scale: 1.02 }}
              className="relative group"
            >
              <div className={`
                w-[430px]
                relative overflow-hidden rounded-2xl backdrop-blur-lg
                bg-gradient-to-br from-cream to-SeaGrean/10 
                dark:from-Blue/90 dark:to-Black/90
                border border-SeaGrean/20 dark:border-Orange/20
                shadow-lg hover:shadow-2xl hover:shadow-SeaGrean/20 dark:hover:shadow-Orange/20
                transition-all duration-500`}>

                <div className="relative p-8">
                  <div className="flex items-start space-x-6">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="relative"
                    >
                      <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-SeaGrean dark:border-Orange">
                        <Image
                          src={member.image}
                          alt={member.name}
                          width={90}
                          height={90}
                          className="w-full h-full object-cover transform transition-transform duration-700 hover:scale-110"
                        />
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-SeaGrean dark:bg-Orange rounded-full p-2 border border-white dark:border-Black">
                        <Star className="w-4 h-4 text-white dark:text-cream animate-spin-slow" />
                      </div>
                    </motion.div>

                    <div>
                      <h3 className="text-xl font-[400] text-Black dark:text-cream">
                        {member.name}
                      </h3>
                      <p className="text-SeaGrean dark:text-Orange font-[300]">
                        {member.role}
                      </p>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">
                        {member.specialty}
                      </p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {activeIndex === index && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 space-y-4"
                      >
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                          {member.message}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {member.skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 rounded-full text-sm font-[300]
                                bg-SeaGrean/10 text-SeaGrean
                                dark:bg-Orange/10 dark:text-Orange
                                hover:bg-SeaGrean hover:text-white
                                dark:hover:bg-Orange dark:hover:text-white
                                transition-all duration-300"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>

                        <div className="flex space-x-3 pt-4 rounded-2xl">
                          {member.socialLinks.linkedin && (
                            <a href={member.socialLinks.linkedin} target="_blank" rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-SeaGrean/10 hover:bg-[#0077B5] text-[#0077B5] hover:text-white dark:bg-Orange/10 dark:hover:bg-[#0077B5] dark:text-Orange dark:hover:text-white transition-all duration-300"
                            >
                              <Linkedin className="w-5 h-5" />
                            </a>
                          )}
                          {member.socialLinks.github && (
                            <a href={member.socialLinks.github} target="_blank" rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-SeaGrean/10 hover:bg-[#333] text-[#333] hover:text-white dark:bg-Orange/10 dark:hover:bg-[#333] dark:text-Orange dark:hover:text-white transition-all duration-300"
                            >
                              <Github className="w-5 h-5" />
                            </a>
                          )}
                          {member.socialLinks.facebook && (
                            <a href={member.socialLinks.facebook} target="_blank" rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-SeaGrean/10 hover:bg-[#1877F2] text-[#1877F2] hover:text-white dark:bg-Orange/10 dark:hover:bg-[#1877F2] dark:text-Orange dark:hover:text-white transition-all duration-300"
                            >
                              <Facebook className="w-5 h-5" />
                            </a>
                          )}
                          {member.socialLinks.twitter && (
                            <a href={member.socialLinks.twitter} target="_blank" rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-SeaGrean/10 hover:bg-[#1DA1F2] text-[#1DA1F2] hover:text-white dark:bg-Orange/10 dark:hover:bg-[#1DA1F2] dark:text-Orange dark:hover:text-white transition-all duration-300"
                            >
                              <Twitter className="w-5 h-5" />
                            </a>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={() => setActiveIndex(activeIndex === index ? null : index)}
                    className="mt-6 w-full px-4 py-2 rounded-xl
                      bg-SeaGrean/10 hover:bg-SeaGrean 
                      dark:bg-Orange/10 dark:hover:bg-Orange
                      text-SeaGrean hover:text-white
                      dark:text-Orange dark:hover:text-white
                      transition-all duration-300
                      flex items-center justify-center space-x-2"
                  >
                    <span>{activeIndex === index ? 'Show Less' : 'View Profile'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${activeIndex === index ? 'rotate-180' : ''
                      }`} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default OurTeam;
