'use client'
import React, { useEffect } from 'react';
import AboutBanner from '@/components/mainComponent/AboutBanner';
import MissionVision from '@/components/mainComponent/MissionVision';
import CeoMessage from '@/components/mainComponent/CeoMessage';
import OurTeam from '@/components/mainComponent/OurTeam';
import Partners from '@/components/mainComponent/Partners';
import DonateSection from '@/components/mainComponent/DonateSection';
import ContactLink from '@/components/mainComponent/ContactLink';
import Navbar from '@/components/mainComponent/Navbar';
import Footer from '@/components/mainComponent/Footer';
import AboutSection from '@/components/mainComponent/AboutSection';
import CertificationSection from '@/components/mainComponent/CertificationSection';
const About = () => {
  useEffect(() => {
    // Change page title
    document.title = "About AIT - Institute of Technology";
  }, []);

  return (
    <div className="">
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-cream to-SeaGrean/10 dark:from-Black dark:to-Blue/20 text-Black dark:text-cream transition-colors duration-500">
        <AboutBanner />
        <AboutSection />
        <MissionVision />
        <CertificationSection />
        <CeoMessage />
        <Partners />
        <OurTeam />
        <DonateSection />
        <ContactLink />
      </div>
      <Footer />
    </div>
  );
}

export default About;
