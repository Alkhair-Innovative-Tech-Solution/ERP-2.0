"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, ChevronDown, LogOut, User2 } from 'lucide-react';
import useHandldeLogout from "@/lib/logout";
import { useRouter } from "next/navigation";

interface UserData {
    full_name?: string;
    email?: string;
    phone?: string;
    role?: string;
    course?: string;
}

const Navbar = () => {
    const [userData, setUserData] = useState<UserData>({});
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [notifications, setNotifications] = useState([
        { id: 1, message: "Welcome to AIT Dashboard!" },
        { id: 2, message: "Your course starts tomorrow" }
    ]);
    const logout = useHandldeLogout();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await logout();
            setIsDropdownOpen(false);
            router.push('/login');
        } catch (error) {
            console.error("Logout failed:", error);
            // You can show a toast notification here if you have one
        }
    };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown && !dropdown.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem("user-storage");
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUserData(parsedUser.state.user || {});
            } catch (error) {
                console.error("Error parsing user data:", error);
            }
        }
    }, []);

    return (
        <nav className="fixed top-0 left-0 w-full z-10 ">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4 flex justify-end items-center">
                <div className="flex justify-between items-center h-16">

                    {/* Right Section */}
                    <div className="flex items-center space-x-4">
                        {/* Notifications */}
                        <div className="relative">
                            <button className="p-2 rounded-full hover:bg-gray-100 dar:hover:bg-Blue/40 transition-colors">
                                <Bell className="h-5 w-5 text-gray-600 dar:text-cream" />
                                <span className="absolute -top-1 -right-1 bg-Orange text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                                    {notifications.length}
                                </span>
                            </button>
                        </div>

                        {/* User Menu */}
                        <div className="relative" id="user-dropdown">
                            <button 
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="flex items-center space-x-3 px-2 py-1 rounded-full bg-cream/50 dar:bg-Orange/10 dar:hover:bg-Orange/20 transition-colors"
                            >
                                <div className="relative w-8 h-8 rounded-full bg-SeaGrean/20 dar:bg-Orange/20 flex items-center justify-center">
                                    <User2 className="h-5 w-5 text-SeaGrean dar:text-Orange" />
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-sm font-medium text-gray-700 dar:text-SeaGrean">
                                        {userData.full_name || "User"}
                                    </p>
                                    <p className="text-xs text-gray-500 dar:text-SeaGrean/70">
                                        {userData.role || "Student"}
                                    </p>
                                </div>
                                <ChevronDown className={`h-6 w-6 text-gray-500 dar:text-cream/90 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {isDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-0 mt-2 w-72 bg-white dar:bg-Blue rounded-xl shadow-lg py-2 ring-1 ring-black ring-opacity-5"
                                    >
                                        <div className="px-4 py-3">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-16 h-16 rounded-full bg-SeaGrean/20 dar:bg-Orange/20 flex items-center justify-center">
                                                    <User2 className="h-8 w-8 text-SeaGrean dar:text-Orange" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700 dar:text-cream">
                                                        {userData.full_name || "User"}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dar:text-cream/70">
                                                        {userData.email || "email@example.com"}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="mt-4 space-y-2">
                                                <div className="px-2 py-1.5 rounded-lg bg-gray-50 dar:bg-Blue/40">
                                                    <p className="text-xs text-gray-500 dar:text-cream/70">Phone</p>
                                                    <p className="text-sm text-gray-700 dar:text-cream">{userData.phone || "Not provided"}</p>
                                                </div>
                                                <div className="px-2 py-1.5 rounded-lg bg-gray-50 dar:bg-Blue/40">
                                                    <p className="text-xs text-gray-500 dar:text-cream/70">Course</p>
                                                    <p className="text-sm text-gray-700 dar:text-cream">{userData.course || "Not enrolled"}</p>
                                                </div>
                                                
                                                <button
                                                    onClick={handleLogout}
                                                    className="mt-4 w-full flex items-center justify-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                >
                                                    <LogOut size={18} />
                                                    <span>Logout</span>
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
