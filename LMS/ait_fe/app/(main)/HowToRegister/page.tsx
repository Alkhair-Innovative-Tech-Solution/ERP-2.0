"use client";

import React from "react";
import Navbar from "@/components/mainComponent/Navbar";
import Footer from "@/components/mainComponent/Footer";
import Image from "next/image";
import { BookOpen, ClipboardList } from "lucide-react";

const HowToRegister = () => {
  return (
    <div>
      <Navbar />

      <div className="max-w-6xl mt-10 mx-auto px-4 py-10 bg-cream dark:bg-Black">

        <h1 className="text-4xl tracking-wide mb-6 text-center text-SeaGrean dark:text-cream">
          How to Register
        </h1>

        <p className="text-gray-600 dark:text-gray-300 mb-10 text-center">
          You can register for courses at our institute in two easy ways. Choose the method that works best for you.
        </p>

        {/* Option 1 */}
        <div className="border p-6 rounded-2xl shadow-lg hover:shadow-xl transition bg-white dark:bg-[#1c1c1c] mb-10">
          <div className="flex items-center gap-3 mb-4">
            <ClipboardList className="text-SeaGrean dark:text-Orange" />
            <h2 className="text-2xl tracking-wide text-SeaGrean dark:text-cream">
              Option 1: Register via Registration Page
            </h2>
          </div>

          <ol className="list-decimal ml-6 text-gray-700 dark:text-gray-300 space-y-3">
            <li>
              Go to the <strong>Register</strong> page from the main menu.
              <Image
                // src="/guide line 0.png"
                width={30}
                height={10}
                src="/assets/mainPics/ait-1.png"
                alt="Step 1: Go to Register page"
                className="w-full mt-2 rounded-lg object-cover"
              />
            </li>

            <li>
              Fill out the form with:
              <ul className="list-disc ml-5 mt-1">
                <li>Full Name</li>
                <li>Email</li>
                <li>Phone</li>
                <li>CNIC</li>
                <li>Date of Birth</li>
                <li>Select Specialization</li>
                <li>Select Course Level in the chosen specialization</li>
              </ul>
            </li>

            <li>
              Click <strong>Register</strong> to complete the process.
              <Image
                  src="/assets/mainPics/ait-2.png"
                alt="Step 3: Submit the form"
                width={30}
                height={10}

               
                className="w-full mt-2 rounded-lg object-cover"
              />
            </li>
          </ol>
        </div>

        {/* Option 2 */}
        <div className="border p-6 rounded-2xl shadow-lg hover:shadow-xl transition bg-white dark:bg-[#1c1c1c]">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="text-SeaGrean dark:text-Orange" />
            <h2 className="text-2xl tracking-wide text-SeaGrean dark:text-cream">
              Option 2: Register via Course Page
            </h2>
          </div>

          <ol className="list-decimal ml-6 text-gray-700 dark:text-gray-300 space-y-3">
            <li>
              Visit the <strong>Courses</strong> page.
              <Image
                              width={30}
                              height={10}

                // src="/guide line 4.png"
                              // width={30}
                              // height={10}

                src="/assets/mainPics/ait-3.png"
                alt="Step 1: Visit Courses page"
                className="w-full mt-2 rounded-lg object-cover"
              />
            </li>

            <li>Select the course you are interested in within your specialization.</li>

            <li>
              Click the <strong>Register</strong> button on the course detail page.
              <Image
                              width={30}
                              height={10}

                src="/assets/mainPics/ait-4.png"
                alt="Step 2: Course detail register"
                className="w-full mt-2 rounded-lg object-cover"
              />
            </li>

            <li>
              You will be redirected to the Register page with Specialization and Course pre-filled.
              <Image
                height={10}
                width={30}
                src="/assets/mainPics/ait-5.png"
                alt="Step 3: Redirected to register"
                className="w-full mt-2 rounded-lg object-cover"
              />
            </li>

            <li>
              Fill in the remaining fields and click <strong>Register</strong>.
              <Image
                src="/assets/mainPics/ait-2.png"
                width={30}
                height={10}
                alt="Step 4: Complete registration"
                className="w-full mt-2 rounded-lg object-cover"
              />
            </li>
          </ol>
        </div>

      </div>
      <Footer />
    </div>);
};

export default HowToRegister;
