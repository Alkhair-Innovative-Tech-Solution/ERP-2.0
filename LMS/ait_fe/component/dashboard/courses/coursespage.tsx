"use client";

import Image from "next/image";
import { FaGoogleDrive, FaWhatsapp } from "react-icons/fa";
import { useUser } from "../../../../hooks/useUser";
import { useEffect, useState } from "react";
import useHandleLogout from "@/lib/logout";

export default function CoursePage() {
  const user = useUser((state) => state.user);
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [status, setStatus] = useState<number>(0);
  const handleLogout = useHandleLogout();

  useEffect(() => {
    const getDashboardCourses = async () => {
      try {
        const res = await fetch("/backend/api/getDashboardCourses", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (res.ok) {
          setCoursesList(data?.course_data);
          setStatus(data?.status);
        } else {
          setStatus(res.status); // Set status for non-200 responses
        }
      } catch (error) {
        console.error("Error fetching courses:", error);
        setStatus(500); // Default to 500 on failure
      }
    };
    getDashboardCourses();
  }, []);

  useEffect(() => {
    if (status === 401) {
      handleLogout();
    }
  }, [status, user, handleLogout]);

  return (
    <div className="flex-1 md:p-6 p-4 lg:py-7 py-4 bg-gray-100 md:mr-0 mx-auto">
      <h1 className="md:text-3xl text-xs w-full md:w-auto font-semibold mb-4 md:mb-0 md:pb-9">
        Jump right in, {user?.full_name} 👋
      </h1>
      {coursesList && coursesList.length > 0 ? (
        <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
          {coursesList.map((course) => (
            <CourseCard
              key={course?.id}
              title={course?.name}
              description={course?.description}
              validation={course?.validity}
              btnText="Join Meeting"
              Resources="Resources"
              imageUrl={course?.image ? `${process.env.NEXT_PUBLIC_API_URL}${course.image}` : `${process.env.NEXT_PUBLIC_API_URL}${`/uploads/images/1.jpg`}`}
              whatsappLink={course?.whatsapp_link}
              resourceLink={course?.resource_link}
            />
          ))}
        </div>
      ) : (
        <p>You haven&apos;t bought any courses yet.</p>
      )}

    </div>
  );
}

const CourseCard = ({
  title,
  description,
  btnText,
  validation,
  Resources,
  imageUrl,
  whatsappLink,
  resourceLink,
}: {
  title: string;
  description: string;
  btnText: string;
  validation: string;
  Resources: string;
  imageUrl: string;
  whatsappLink: string;
  resourceLink: string;
}) => (
  <div className="p-4 bg-white shadow-md rounded-lg max-h-[400px] h-[400px] flex flex-col">
    <div className="w-full aspect-[3/1] relative rounded-md overflow-hidden">
      <Image
        src={imageUrl || '/default-placeholder.jpg'}
        alt="Course"
        fill
        className="object-contain"
        quality={100}
        sizes="100vw"
      />
    </div>
    <div className="mr-2 ml-2">
      <h3 className="mt-2 text-lg md:text-xl font-bold truncate">{title}</h3>
      <p className="mt-2 text-sm md:text-md mt-2 text-gray-500 overflow-y-auto max-h-[80px] md:max-h-[100px]">
        {description}
      </p>
      <p className="mt-2 text-md mt-4 text-gray-500">
        <span className="font-bold text-base text-red-500">Validity </span>
        {validation}
      </p>
      <div className="flex flex-col items-center justify-center w-full mt-auto">
        {whatsappLink && (
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="w-full">
            <button className="mt-2 bg-green-500 text-white px-6 py-2 rounded-2xl flex items-center justify-center space-x-2 w-full">
              <FaWhatsapp />
              <span>{btnText}</span>
            </button>
          </a>
        )}
        {resourceLink && (
          <a href={resourceLink} target="_blank" rel="noopener noreferrer" className="w-full">
            <button className="mt-2 bg-[#F2b301] text-white px-6 py-2 rounded-2xl flex items-center justify-center space-x-2 w-full">
              <FaGoogleDrive />
              <span>{Resources}</span>
            </button>
          </a>
        )}
      </div>
    </div>
  </div>
);
