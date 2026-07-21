'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, ChevronDown, X, User, Bell, LogOut, Settings, Phone, Mail, BookOpen, UserCircle, Home, BookOpenCheck } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { Button } from '../ui/button';
import Image from 'next/image';
import Logo from '@/public/assets/mainPics/AIT_Logo_Day.png';
import logoNight from '@/public/assets/mainPics/AIT_Logo_Night.png';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import useHandldeLogout from '@/lib/logout';
import { FaChevronLeft } from 'react-icons/fa';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const [userlayout, setUserLayout] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [userData, setUserData] = useState<any>({});
  const [mounted, setMounted] = useState(false);

  const { theme } = useTheme();
  const router = useRouter();
  const logout = useHandldeLogout();

  useEffect(() => {
    setMounted(true);
  }, []);

  const menuItems = [
    { icon: <Home className="w-6 h-6" />, label: "Home", href: "/" },
    { icon: <BookOpen className="w-6 h-6" />, label: "About us", href: "/about" },
    { icon: <Phone className="w-6 h-6" />, label: "Contact", href: "/contact" },
    { icon: <BookOpenCheck className="w-6 h-6" />, label: "Courses", href: "/courses" },
    {
      icon: <Settings className="w-6 h-6" />, label: "How To",
      submenu: [
        { label: "Take Test", href: "/how-to-apply" },
        { label: "Register", href: "/HowToRegister" }
      ]
    }
  ];

  const handleLogout = async () => {
    try {
      const isLoggedOut = await logout();
      if (isLoggedOut) {
        setUserLayout(false);
        setIsUserDropdownOpen(false);
        setIsOpen(false);
        router.push('/');
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const userLogin = localStorage.getItem("is-Login");
    const userStorage = localStorage.getItem("user-storage");



    if (userLogin && userStorage) {
      const userLoginData = JSON.parse(userLogin);
      const userStorageData = JSON.parse(userStorage);

      if (userLoginData.state?.signedIn === true) {
        setUserLayout(userLoginData.state.signedIn);
        setUserData(userStorageData.state.user);
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdown = document.getElementById('user-dropdown');
      if (dropdown && !dropdown.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const initialScroll = window.scrollY || document.documentElement.scrollTop;
    if (initialScroll <= 0) {
      setIsScrollingUp(true);
    }
  }, []);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      const diff = scrollPosition - lastScrollY;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (Math.abs(diff) > 5) {
            setIsScrollingUp(diff < 0);
            setLastScrollY(scrollPosition);
          }
          if (scrollPosition <= 0) {
            setIsScrollingUp(true);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const navLinks = [
    { href: '/about', label: 'About us', color: 'hover:text-SeaGrean dark:hover:text-Orange' },
    { href: '/contact', label: 'Contact', color: 'hover:text-SeaGrean dark:hover:text-Orange' },
    { href: '/courses', label: 'Courses', color: 'hover:text-SeaGrean dark:hover:text-Orange' },
    {
      label: 'How To',
      color: 'hover:text-SeaGrean dark:hover:text-Orange',
      dropdown: [
        { href: '/how-to-apply', label: 'Take Test' },
        { href: '/HowToRegister', label: 'Register' },
      ],
    },
  ];

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/80 dark:bg-Black/80 backdrop-blur-sm shadow-lg translate-y-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/">
              <div className="relative w-32 h-10">
                <Image
                  src={!mounted ? Logo : (theme === 'dark' ? logoNight : Logo)}
                  alt="Idara Al-Khair"
                  fill
                  sizes="(max-width: 768px) 100vw, 128px"
                  className="object-contain"
                  priority
                />
              </div>
            </Link>

            <div className="hidden lg:flex items-center space-x-8">
              {navLinks.map((link, index) => (
                'dropdown' in link ? (
                  <div key={index} className="relative group">
                    <button className={`flex items-center space-x-1 ${link.color} transition-colors duration-300`}>
                      <span>{link.label}</span>
                      <ChevronDown size={16} className="transform group-hover:rotate-180 transition-transform duration-300" />
                    </button>
                    <div className="absolute top-full left-0 mt-2 w-48 bg-cream dark:bg-Blue rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 border border-SeaGrean/20 dark:border-Orange/20">
                      {link.dropdown?.map((item, idx) => (
                        <Link
                          key={idx}
                          href={item.href}
                          className="block px-4 py-2 text-Black dark:text-cream hover:bg-SeaGrean/10 dark:hover:bg-Orange/10 transition-colors duration-300 first:rounded-t-xl last:rounded-b-xl"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={index}
                    href={link.href}
                    className={`flex items-center space-x-2 ${link.color} transition-colors duration-300`}
                  >
                    <span>{link.label}</span>
                  </Link>
                )
              ))}
            </div>

            <div className="flex items-center space-x-4">
              <ThemeToggle />
              {!userlayout ? (
                <Link href="/register" className="hidden md:block">
                  <Button className="text-SeaGrean dark:text-cream border-2 border-SeaGrean dark:border-SeaGrean dark:hover:border-Orange rounded-full px-6 py-2 hover:bg-SeaGrean dark:hover:bg-Orange hover:text-white transition-all">
                    Register
                  </Button>
                </Link>
              ) : (
                <div className="flex items-center space-x-4">

                  <div className="relative hidden md:block" id="user-dropdown">
                    <Button
                      onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                      className="text-SeaGrean dark:text-Orange bg-SeaGrean/10 dark:bg-Orange/10 border-SeaGrean dark:border-SeaGrean dark:hover:border-Orange rounded-full p-2 hover:bg-SeaGrean/20 transform hover:scale-105 transition-all shadow-sm"
                    >
                      <User size={24} />
                    </Button>

                    <AnimatePresence>
                      {isUserDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 mt-2 w-72 bg-white dark:bg-Blue rounded-xl shadow-lg py-2 backdrop-blur-sm"
                        >
                          <div className="px-4 py-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-16 h-16 rounded-full bg-SeaGrean/20 dark:bg-Orange/20 flex items-center justify-center">
                                <User className="h-8 w-8 text-SeaGrean dark:text-Orange" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-cream">
                                  {userData.full_name || "User"}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-cream/70">
                                  {userData.email || "email@example.com"}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 space-y-2">
                              <div className="px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-Blue/40">
                                <p className="text-xs text-gray-500 dark:text-cream/70">Role</p>
                                <p className="text-sm text-gray-700 dark:text-cream">{userData.role || "Student"}</p>
                              </div>
                              <div className="px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-Blue/40">
                                <p className="text-xs text-gray-500 dark:text-cream/70">Course</p>
                                <p className="text-sm text-gray-700 dark:text-cream">{userData.course || "Not enrolled"}</p>
                              </div>
                            </div>

                            <button
                              onClick={handleLogout}
                              className="mt-4 w-full flex items-center justify-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <LogOut size={18} />
                              <span>Logout</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden text-Black dark:text-cream"
                aria-label="Toggle menu"
              >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Fixed Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[998] lg:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 20 }}
              className="fixed left-0 top-0 h-full w-[280px] bg-white dark:bg-Black/90 z-[999] lg:hidden overflow-y-auto shadow-2xl"
            >
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
                  <Link href="/" onClick={() => setIsOpen(false)}>
                    <div className="relative w-32 h-10">
                      <Image
                        src={!mounted ? Logo : (theme === 'dark' ? logoNight : Logo)}
                        alt="Idara Al-Khair"
                        fill
                        sizes="128px"
                        className="object-contain"
                      />
                    </div>
                  </Link>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                  >
                    <FaChevronLeft size={24} className="text-gray-600 dark:text-gray-400" />
                  </button>
                </div>

                {userlayout && (
                  <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-SeaGrean/20 dark:bg-Orange/20 flex items-center justify-center">
                        <User className="h-6 w-6 text-SeaGrean dark:text-Orange" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {userData.full_name || "User"}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {userData.email || "email@example.com"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto py-4">
                  <div className="px-4 space-y-1">
                    {menuItems.map((item, index) => (
                      <div key={index}>
                        {'submenu' in item ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2 p-3 rounded-lg text-gray-700 dark:text-gray-200">
                              {item.icon}
                              <span>{item.label}</span>
                            </div>
                            <div className="ml-10 space-y-1">
                              {item.submenu?.map((subItem, subIndex) => (
                                <Link
                                  key={subIndex}
                                  href={subItem.href}
                                  onClick={() => setIsOpen(false)}
                                  className="block p-2 text-gray-600 dark:text-gray-400 hover:bg-SeaGrean/10 dark:hover:bg-Orange/10 rounded-lg"
                                >
                                  {subItem.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center space-x-2 p-3 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-SeaGrean/10 dark:hover:bg-Orange/10"
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                  {userlayout ? (
                    <>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-2 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/70 rounded-xl  "
                      >
                        <LogOut size={18} />
                        <span>Logout</span>
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/register"
                      onClick={() => setIsOpen(false)}
                      className="block w-full"
                    >
                      <Button className="w-full bg-SeaGrean hover:bg-SeaGrean/90 dark:bg-cream dark:hover:bg-Orange/90 text-cream dark:text-Orange rounded-xl">
                        Register
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
