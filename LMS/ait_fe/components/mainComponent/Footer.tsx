'use client';

import React from 'react';
import { FaMapMarkerAlt, FaPhoneAlt, FaEnvelope, FaPhoneSlash, FaWhatsapp } from 'react-icons/fa';
import Link from 'next/link';
import Image from 'next/image';
import AIT_Logo_Night from '@/public/assets/mainPics/AIT_Logo_Night.png';
import { FaSquarePhone } from 'react-icons/fa6';
import { useTheme } from 'next-themes';

const Footer = () => {
  const { theme } = useTheme();
  const quickLinks = ['Home', 'About Us', 'Schools That Rock', 'Our Projects', 'Gallery of Wonders', 'Get in Touch!'];
  const news = ['Exciting News: The IAK IT Institute is Here! 🚀', 'Join Our Newsletter and Stay Updated! 📰'];

  return (
    <footer className="bg-Black text-cream pt-12 pb-6 px-10 tracking-wide relative border-t  border-white">
      <div className="max-w-screen-xl mx-auto">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* About Section */}
          <div>
            <Link
              href="/"
              className="text-SeaGrean font-[400] text-2xl gradient-text"
            >
              <div className="relative w-32 h-10 mb-4 mt-4">
                <Image
                  src={ '/assets/mainPics/AIT_Logo_Night.png'}
                  alt="Idara Al-Khair"
                  fill
                  sizes="(max-height: 110px) 100vw, 128px"
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
            <p className="text-gray-300 text-sm mb-4">
              Serving humanity since 1987 – we&apos;re here to help and make the world a better place, one step at a time!
            </p>
            <Link
              href="/contact"
              className="text-SeaGrean hover:text-Orange 
                flex items-center space-x-2 text-sm transition-all duration-500 ease-in-out transform hover:scale-105"
            >
              <span>Find Us on the Map</span> <FaMapMarkerAlt />
            </Link>
            <div className="flex justify-start items-center mt-4">
              <Image
                src="/assets/mainPics/QR scan.png"
                alt="QR Scan"
                width={100}
                height={100}
              />
            </div>
          </div>


          {/* Contact Section */}
          <div>
            <h2 className="text-SeaGrean text-sm uppercase font-[300] mb-4">Let&apos;s Talk!</h2>
            <ul className="space-y-3">
              {[
                { icon: <FaMapMarkerAlt />, text: 'A 507, Sector 11-A ,Near Power House Chorangi, North Karachi, \n Karachi, Pakistan' },
                { icon: <FaPhoneAlt />, text: '02136950309' },
                { icon: <FaEnvelope />, text: 'AIT.info@iak.ngo' },
                { icon: <FaWhatsapp />, text: '+92 333 2336203' }

              ].map((item, idx) => (
                <li key={idx} className="flex items-center space-x-2 group">
                  <span className="text-SeaGrean group-hover:text-Orange transition-all duration-500">
                    {item.icon}
                  </span>
                  <span className="text-gray-300">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links Section */}
          <div>
            <h2 className="text-SeaGrean text-sm uppercase font-[300] mb-4">Quick Links</h2>
            <ul className="space-y-3">
              {quickLinks.map((link, idx) => (
                <li key={idx}>
                  <Link
                    href="#"
                    className="text-gray-300 hover:text-Orange 
                      text-sm transition-all duration-500 ease-in-out transform hover:scale-105 inline-block"
                  >
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* News Section */}
          <div>
            <h2 className="text-SeaGrean text-sm uppercase font-[300] mb-4">Fresh News! 🍞</h2>
            <ul className="space-y-3">
              {news.map((item, idx) => (
                <li key={idx}
                  className="text-gray-300 text-sm hover:text-Orange 
                      transition-all duration-500 ease-in-out transform hover:scale-105 cursor-pointer">
                  {item}
                </li>
              ))}
            </ul>

          </div>
        </div>

        <hr className="mt-12 mb-6 border-gray-700" />

        <div className="text-center">
          <p className="text-gray-300 text-sm">
            © 1987 - 2025 All rights reserved | Idara Al-Khair – Your welfare, our priority!
          </p>

        </div>

      </div>
    </footer>
  );
};

export default Footer;
