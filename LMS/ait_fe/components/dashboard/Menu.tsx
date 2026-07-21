"use client";

import Image from "next/image";
import Link from "next/link";
import { role } from "@/lib/data";
import useHandleLogout from "@/lib/logout";

const menuItems = [
  {
    title: "MENU",
    items: [
      {
        icon: "/assets/dashboardpics/home.png",
        label: "Home",
        href: "/dashboard",
        visible: ["admin", "teacher", "student", "parent"],
      },
      // {
      //   icon: "/assets/dashboardpics/teacher.png",
      //   label: "Teachers",
      //   href: "/list/teachers",
      //   visible: ["admin", "teacher"],
      // },
      // {
      //   icon: "/assets/dashboardpics/student.png",
      //   label: "Students",
      //   href: "/dashboard",
      //   visible: ["admin", "teacher"],
      // },
      // {
      //   icon: "/assets/dashboardpics/parent.png",
      //   label: "Parents",
      //   href: "/list/parents",
      //   visible: ["admin", "teacher"],
      // },
      {
        icon: "/assets/dashboardpics/subject.png",
        label: "Courses",
        href: "/dashboard",
        visible: ["admin"],
      },
      {
        icon: "/assets/dashboardpics/assignment.png",
        label: "Deposit Slips",
        href: "/admin/receipt-codes",
        visible: ["admin"],
      },
      // {
      //   icon: "/assets/dashboardpics/class.png",
      //   label: "Classes",
      //   href: "/list/classes",
      //   visible: ["admin", "teacher"],
      // },
      // {
      //   icon: "/assets/dashboardpics/lesson.png",
      //   label: "Lessons",
      //   href: "/list/lessons",
      //   visible: ["admin", "teacher"],
      // },
      {
        icon: "/assets/dashboardpics/exam.png",
        label: "Test",
        href: "/dashboard",
        visible: ["admin", "teacher", "student", "parent"],
      },
      // {
      //   icon: "/assets/dashboardpics/assignment.png",
      //   label: "Assignments",
      //   href: "/list/assignments",
      //   visible: ["admin", "teacher", "student", "parent"],
      // },
      {
        icon: "/assets/dashboardpics/result.png",
        label: "Results",
        href: "/dashboard",
        visible: ["admin", "teacher", "student", "parent"],
      },
      // {
      //   icon: "/assets/dashboardpics/attendance.png",
      //   label: "Attendance",
      //   href: "/list/attendance",
      //   visible: ["admin", "teacher", "student", "parent"],
      // },
      // {
      //   icon: "/assets/dashboardpics/events.png",
      //   label: "Events",
      //   href: "/list/events",
      //   visible: ["admin", "teacher", "student", "parent"],
      // },
      // {
      //   icon: "/assets/dashboardpics/message.png",
      //   label: "Messages",
      //   href: "/list/messages",
      //   visible: ["admin", "teacher", "student", "parent"],
      // },
      // {
      //   icon: "/assets/dashboardpics/announcement.png",
      //   label: "Announcements",
      //   href: "/list/announcements",
      //   visible: ["admin", "teacher", "student", "parent"],
      // },
    ],
  },
  {
    title: "OTHER",
    items: [
      {
        icon: "/assets/dashboardpics/profile.png",
        label: "Profile",
        href: "/dashboard",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/assets/dashboardpics/setting.png",
        label: "Settings",
        href: "/dashboard",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/assets/dashboardpics/logout.png",
        label: "Logout",
        href: "/dashboard", // This will be ignored in the loop
        visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
];

const Menu = () => {
  const handleLogout = useHandleLogout();

  return (
    <div className="mt-4 text-sm z-50 bg-cream dak:bg-black">
      {menuItems.map((i) => (
        <div className="flex flex-col gap-2" key={i.title}>
          <span className="hidden lg:block text-gray-400 font-normal my-4">
            {i.title}
          </span>
          {i.items.map((item) => {
            if (item.visible.includes(role)) {
              if (item.label === "Logout") {
                return (
                  <div
                    key={item.label}
                    onClick={() => handleLogout()}
                    className="cursor-pointer flex items-center justify-center lg:justify-start gap-4 text-gray-500 py-2 md:px-2 rounded-md hover:bg-lamaSkyLight"
                  >
                    <Image src={item.icon} alt="" width={20} height={20} />
                    <span className="hidden lg:block">{item.label}</span>
                  </div>
                );
              }

              return (
                <Link
                  href={item.href}
                  key={item.label}
                  className="flex items-center justify-center lg:justify-start gap-4 text-gray-500 py-2 md:px-2 rounded-md hover:bg-lamaSkyLight"
                >
                  <Image src={item.icon} alt="" width={20} height={20} />
                  <span className="hidden lg:block">{item.label}</span>
                </Link>
              );
            }
          })}
        </div>
      ))}
    </div>
  );
};

export default Menu;
