'use client'
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Layout, Code, Cpu, ShoppingCart, Search, Smartphone } from "lucide-react"
import Service from "./Features"

export function ServicesSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-cream dark:bg-Black">
        <div className="absolute inset-0 bg-gradient-to-br from-SeaGrean/10 dark:from-Blue/20 to-transparent"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          {/* Left Column */}
          <div className="space-y-10">
            <h2 className="text-5xl font-[400] leading-tight transition-colors duration-200 
          bg-gradient-to-r from-Black to-SeaGrean dark:from-SeaGrean dark:to-cream
          bg-clip-text text-transparent text-">
              Empower Your Future with Our IT Training Courses.
            </h2>
            <p className="text-Black dark:text-gray-300 text-xl leading-relaxed">
              Join our cutting-edge courses designed to equip you with the latest skills in web development, AI, cybersecurity, and more. Start your journey towards a successful IT career with us.
            </p>
            <div className="pt-4">
              <Link href="/courses">
                <button className="relative h-12 w-44 overflow-hidden border-2 border-SeaGrean dark:border- text-Black dark:text-white font-[300] rounded-full transition-all duration-300 before:absolute before:left-0 before:-ml-2 before:h-48 before:w-48 before:origin-top-right before:-translate-x-full before:translate-y-12 before:-rotate-90 before:bg-SeaGrean dark:before:bg-Orange before:transition-all before:duration-300 hover:text-white dark:hover:text-cream hover:border-SeaGrean dark:hover:border-Orange hover:before:-rotate-180 shadow-lg hover:shadow-SeaGrean/20 dark:hover:shadow-Orange/20">
                  <span className="relative z-10">Enroll Now →</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Right Column */}
          <div className="grid gap-8">
            <div className="grid sm:grid-cols-2 gap-8">
              {/* Services grid items */}
              {[
                {
                  icon: <Layout />,
                  title: "Web Development Training",
                  desc: "Master front-end and back-end technologies to build modern web applications."
                },
                {
                  icon: <Code />,
                  title: "Full Stack Development",
                  desc: "Learn to develop complete web applications with hands-on projects."
                },
                {
                  icon: <Cpu />,
                  title: "AI & Machine Learning",
                  desc: "Explore AI-driven solutions and machine learning applications."
                },
                {
                  icon: <ShoppingCart />,
                  title: "E-Commerce Development",
                  desc: "Learn how to build and manage successful online stores."
                },
              ].map((service, index) => (
                <div key={index} className="space-y-4 p-6 rounded-xl shadow-md bg-white/5 dark:bg-Blue/5 backdrop-blur-sm hover:bg-SeaGrean/5 dark:hover:bg-Blue/10 transition-all duration-300 transform hover:scale-105 hover:shadow-xl">
                  <div className="bg-SeaGrean/10 dark:bg-Blue/10 w-12 h-12 rounded-lg flex items-center justify-center">
                    <div className="w-6 h-6 text-SeaGrean dark:text-Orange">
                      {service.icon}
                    </div>
                  </div>
                  <h3 className="text-Black dark:text-white font-[300] text-xl">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {service.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
    </section>
  )
}
