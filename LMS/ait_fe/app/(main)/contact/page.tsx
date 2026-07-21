"use client";

import { useState, useRef, useEffect } from "react";
import { Mail, Phone, MapPin, Send, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Footer from "@/components/mainComponent/Footer";
import Navbar from "@/components/mainComponent/Navbar";
import Link from "next/link";
import Image from "next/image";

export default function Contact() {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess(true);
        setFormData({ name: "", email: "", subject: "", message: "" }); // Clear form
      } else {
        console.error("Error sending message");
      }
    } catch (error) {
      console.error("Network error:", error);
    }

    setLoading(false);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100");
            entry.target.classList.remove("opacity-0", "translate-y-10");
          }
        });
      },
      { threshold: 0.1 }
    );

    const currentBanner = bannerRef.current;
    if (currentBanner) {
      observer.observe(currentBanner);

      return () => {
        observer.unobserve(currentBanner);
      };
    }
  }, []);

  return (
    <div className="">
      <Navbar />
      <div className="min-h-screen relative">
        <div className="relative h-[450px] overflow-hidden bg-Black">
          <div className="absolute inset-0 bg-tech-pattern bg-cover bg-center opacity-20"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-Black/80 via-Black/60 to-Black"></div>

          <div
            ref={bannerRef}
            className="relative z-10 flex flex-col items-center justify-center h-full px-4 transition-all duration-1000 transform opacity-0 translate-y-10"
          >
            <Sparkles className="w-16 h-16 mb-6 text-SeaGrean animate-float" />
            <h1 className="text-4xl sm:text-5xl md:text-6xl px-4 text-center font-[400] text-cream mb-6 bg-gradient-to-r from-SeaGrean to-cream bg-clip-text text-transparent animate-pulse">
              Get in Touch
            </h1>
            <div className="w-24 h-1 bg-Orange mb-8"></div>
            <p className="text-xl md:text-2xl text-cream/80 max-w-3xl text-center">
              Have questions? We&apos;d love to hear from you and assist you
              further
            </p>
          </div>
        </div>

        <section className="relative -mt-20 pb-16 bg-transparent z-10">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-8 items-stretch">
              {/* Contact Form */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-Blue/20 p-8 rounded-3xl shadow-lg 
                transition-all duration-500 group hover:shadow-2xl 
                border-2 border-transparent hover:border-SeaGrean dark:hover:border-Orange
                backdrop-blur-lg"
              >
                <motion.h2
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-[400] mb-8 text-SeaGrean dark:text-cream hover:text-Blue dark:hover:text-Orange transition-colors duration-300"
                >
                  Send us a Message
                  {success && (
                    <p className="text-green-500">Message sent successfully!</p>
                  )}
                </motion.h2>

                <form onSubmit={handleSubmit} className="space-y-4 h-full">
                  <div>
                    <label className="block text-sm font-medium text-Black dark:text-cream mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                      dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                      transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                      value={formData.name}
                      onChange={handleChange}
                      name="name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-Black dark:text-cream mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                      dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                      transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                      value={formData.email}
                      onChange={handleChange}
                      name="email"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-Black dark:text-cream mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                      dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                      transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange"
                      value={formData.subject}
                      onChange={handleChange}
                      name="subject"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-Black dark:text-cream mb-2">
                      Message
                    </label>
                    <textarea
                      className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-Blue/40 
                      dark:bg-Black/50 focus:ring-2 focus:ring-SeaGrean focus:border-transparent 
                      transition-all duration-300 hover:border-SeaGrean dark:hover:border-Orange h-28"
                      value={formData.message}
                      onChange={handleChange}
                      name="message"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-6 py-3 rounded-2xl relative overflow-hidden group
                    transform hover:scale-[1.02] active:scale-95 transition-all duration-300"
                    disabled={loading}
                  >
                    <span
                      className="absolute inset-0 bg-SeaGrean dark:bg-Orange transition-all duration-300 
                    transform origin-left group-hover:scale-x-100 scale-x-0"
                    ></span>
                    <span className="relative flex items-center justify-center  text-SeaGrean group-hover:text-cream dark:text-cream font-medium">
                      <Send className="mr-2 h-5 w-5" />
                      {loading ? "Sending..." : "Send Message"}
                    </span>
                  </button>
                </form>
              </motion.div>

              {/* Contact Information */}
              <div className="space-y-6 h-full flex flex-col justify-between">
                {["Visit Us", "Call Us", "Email Us"].map((title, index) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.2 }}
                    className="bg-white dark:bg-Blue/20 p-6 rounded-3xl shadow-lg
                    hover:shadow-xl hover:scale-105 transition-all duration-500
                    backdrop-blur-lg border-2 border-transparent
                    hover:border-SeaGrean dark:hover:border-Orange flex-1"
                  >
                    <div className="flex items-center mb-3">
                      {title === "Visit Us" && (
                        <MapPin className="h-5 w-5 text-SeaGrean dark:text-Orange mr-2" />
                      )}
                      {title === "Call Us" && (
                        <Phone className="h-5 w-5 text-SeaGrean dark:text-Orange mr-2" />
                      )}
                      {title === "Email Us" && (
                        <Mail className="h-5 w-5 text-SeaGrean dark:text-Orange mr-2" />
                      )}
                      <h3 className="text-lg font-[300] text-Black dark:text-cream">
                        {title}
                      </h3>
                    </div>
                    {title === "Visit Us" && (
                      <div className="text-gray-600 dark:text-cream/80 grid grid-cols-2 gap-4">
                        <div>
                          <Link
                            href="https://maps.app.goo.gl/bo9eCtUqNXh6CKxb7"
                            target="_blank" // Open in new tab
                            rel="noopener noreferrer" // Security improvement for links opened in new tab
                          >
                            <p>
                              A 507, Sector 11-A ,Near Power House Chorangi,
                              North Karachi, <br />
                              Karachi, Pakistan
                            </p>
                          </Link>
                        </div>

                        <div className="flex justify-center items-center">
                          <Image
                            src="/assets/mainPics/QR Scan.png"
                            alt="QR Scan"
                            width={100}
                            height={100}
                          />
                        </div>
                      </div>
                    )}

                    {title === "Call Us" && (
                      <p className="text-gray-600 dark:text-cream/80">
                        Main: +92 333 2336203
                        <br />
                        Support: 021 36950309
                      </p>
                    )}
                    {title === "Email Us" && (
                      <p className="text-gray-600 dark:text-cream/80">
                        ait.info@iak.ngo
                        <br />
                        contact.ait@iak.ngo
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
