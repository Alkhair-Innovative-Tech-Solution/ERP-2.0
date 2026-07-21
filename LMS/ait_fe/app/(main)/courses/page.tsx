"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  AlertTriangle,
  GraduationCap,
  Info,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MapPin,
  Calendar,
} from "lucide-react";
import Footer from "@/components/mainComponent/Footer";
import Navbar from "@/components/mainComponent/Navbar";
import { ChevronDown } from "lucide-react";
import { debounce } from "lodash";

interface Branch {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface Specialization {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

interface Course {
  id: string;
  name: string;
  description: string;
  image: string | null;
  specialization: string;
  specialization_id: string;
  duration: number;
  level: number;
  admission_status: 'open' | 'closed' | 'coming_soon';
  admission_open_date?: string;
  course_start_date?: string;
  course_end_date?: string;
  branches: Branch[];
  sessions?: any[];
  sessions_count?: number;
}

const CoursesPage = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [hoveredSpecialization, setHoveredSpecialization] = useState<string | null>(null);
  const [courseIndices, setCourseIndices] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const specializationRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevCourseIndices = useRef<Record<string, number>>({});
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const defaultImage = "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800";

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "visible", "scale-100");
            entry.target.classList.remove("opacity-0", "translate-y-10", "scale-95");
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll(".animate-on-scroll");
    elements.forEach((element) => observer.observe(element));
    if (bannerRef.current) observer.observe(bannerRef.current);

    return () => {
      elements.forEach((element) => observer.unobserve(element));
      if (bannerRef.current) observer.unobserve(bannerRef.current);
    };
  }, [specializations, courses, branches]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 🔹 Multi-Tenancy: Get org_id from localStorage
        const orgId = localStorage.getItem('selected_org_id') || '';
        const orgParam = orgId ? `&org_id=${orgId}` : '';
        const [branchRes, specRes, courseRes] = await Promise.all([
          fetch(`/proxy/get?url=/api/courses/branches/${orgParam ? '?' + orgParam.slice(1) : ''}`),
          fetch(`/proxy/get?url=/api/courses/specialization/all${orgParam}`),
          fetch(`/proxy/get?url=/api/courses/courses/${orgParam}`),
        ]);

        if (!branchRes.ok || !specRes.ok || !courseRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const branchData = await branchRes.json();
        const specData = await specRes.json();
        const courseData = await courseRes.json();

        const branchList = Array.isArray(branchData) ? branchData : (branchData.data || []);
        const specList = Array.isArray(specData) ? specData : (specData.data || []);
        const courseList = Array.isArray(courseData) ? courseData : (courseData.data || []);

        setBranches(branchList);
        setSpecializations(specList);

        const normalizedCourses = courseList.map((c: any) => ({
          ...c,
          specialization_id: c.specialization_id || (typeof c.specialization === 'object' && c.specialization !== null ? c.specialization.id : c.specialization),
          specialization: typeof c.specialization === 'object' && c.specialization !== null ? c.specialization.id : c.specialization,
          branches: Array.isArray(c.branches) ? c.branches : [],
        }));
        setCourses(normalizedCourses);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Unable to load courses.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const debouncedSetSearchQuery = useMemo(
    () => debounce((value: string) => setSearchQuery(value), 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearchQuery(e.target.value);
  };

  const handleNext = (specId: string) => {
    const relatedCourses = filteredCoursesByBranch.filter((c) => (c.specialization_id || c.specialization) === specId);
    const nextIndex = ((courseIndices[specId] || 0) + 1) % relatedCourses.length;
    prevCourseIndices.current[specId] = courseIndices[specId] || 0;
    setCourseIndices((prev) => ({ ...prev, [specId]: nextIndex }));

    const carousel = carouselRefs.current[specId];
    if (carousel) {
      const cardWidth = Math.min(480, carousel.offsetWidth - 48);
      carousel.scrollTo({
        left: carousel.scrollLeft + cardWidth + 16,
        behavior: 'smooth'
      });
    }
  };

  const handlePrev = (specId: string) => {
    const relatedCourses = filteredCoursesByBranch.filter((c) => (c.specialization_id || c.specialization) === specId);
    const prevIndex = ((courseIndices[specId] || 0) - 1 + relatedCourses.length) % relatedCourses.length;
    prevCourseIndices.current[specId] = courseIndices[specId] || 0;
    setCourseIndices((prev) => ({ ...prev, [specId]: prevIndex }));

    const carousel = carouselRefs.current[specId];
    if (carousel) {
      const cardWidth = Math.min(480, carousel.offsetWidth - 48);
      carousel.scrollTo({
        left: carousel.scrollLeft - cardWidth - 16,
        behavior: 'smooth'
      });
    }
  };

  const scrollToSpecialization = (specId: string) => {
    const element = specializationRefs.current[specId];
    if (element) {
      const header = document.querySelector("header");
      const headerHeight = header?.offsetHeight || 0;
      const isMobileDevice = window.innerWidth < 768;
      const offset = isMobileDevice ? headerHeight + 20 : headerHeight;

      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth",
      });
      setIsMobileFilterOpen(false);
    }
  };

  const filteredCoursesByBranch = useMemo(() => {
    if (selectedBranchId === "all") return courses;
    return courses.filter((c) =>
      c.branches?.some((b) => b.id === selectedBranchId)
    );
  }, [courses, selectedBranchId]);

  const filteredSpecializations = useMemo(
    () =>
      specializations.filter(
        (spec) =>
          spec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (spec.description && spec.description.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [specializations, searchQuery]
  );

  const sortedSpecializations = useMemo(
    () =>
      [...filteredSpecializations].sort((a, b) => {
        const aHasOpen = filteredCoursesByBranch.some(c => (c.specialization_id === a.id || c.specialization === a.id) && c.admission_status?.toLowerCase() === 'open');
        const bHasOpen = filteredCoursesByBranch.some(c => (c.specialization_id === b.id || c.specialization === b.id) && c.admission_status?.toLowerCase() === 'open');

        if (aHasOpen && !bHasOpen) return -1;
        if (!aHasOpen && bHasOpen) return 1;

        if (a.active !== b.active) return a.active ? -1 : 1;

        return a.name.localeCompare(b.name);
      }),
    [filteredSpecializations, filteredCoursesByBranch]
  );

  const activeSpecializations = sortedSpecializations.filter((spec) => spec.active);
  const inactiveSpecializations = sortedSpecializations.filter((spec) => !spec.active);

  useEffect(() => {
    const handleScroll = (specId: string) => {
      const carousel = carouselRefs.current[specId];
      if (!carousel) return;

      const cardWidth = Math.min(480, carousel.offsetWidth - 48);
      const scrollLeft = carousel.scrollLeft;
      const index = Math.round(scrollLeft / (cardWidth + 16));

      setCourseIndices((prev) => {
        const relatedCourses = filteredCoursesByBranch.filter((c) => (c.specialization_id || c.specialization) === specId);
        if (prev[specId] !== index && index >= 0 && index < relatedCourses.length) {
          return { ...prev, [specId]: index };
        }
        return prev;
      });
    };

    Object.entries(carouselRefs.current).forEach(([specId, carousel]) => {
      if (carousel) {
        carousel.addEventListener('scroll', () => handleScroll(specId), { passive: true });
      }
    });

    return () => {
      Object.values(carouselRefs.current).forEach((carousel) => {
        if (carousel) {
          carousel.removeEventListener('scroll', () => {});
        }
      });
    };
  }, [filteredCoursesByBranch]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-Black">
        <div className="text-center p-6 bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-500 text-xl mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-SeaGrean text-cream rounded-full hover:bg-SeaGrean/80 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-cream to-SeaGrean/10 dark:from-Black dark:to-Blue/20">
        <div className="relative h-fit py-16 overflow-hidden bg-Black">
          <div className="absolute inset-0 bg-tech-pattern bg-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-Black/80 via-Black/60 to-Black" />
          <div
            ref={bannerRef}
            className="relative z-10 flex flex-col items-center justify-center px-4 transition-all duration-1000 transform opacity-0 translate-y-10"
          >
            <Sparkles
              className="w-16 h-16 mb-6 text-SeaGrean animate-float"
              aria-label="Sparkles icon"
            />
            <h1 className="text-4xl md:text-6xl text-center font-[400] text-cream mb-6 bg-gradient-to-r from-SeaGrean to-cream bg-clip-text text-transparent animate-pulse">
              Discover Your Path to Success
            </h1>
            <div className="w-24 h-1 bg-Orange mb-8"></div>
            <p className="text-xl md:text-2xl text-cream/80 max-w-3xl text-center">
              Explore our comprehensive range of tech courses designed to transform your career
            </p>
          </div>
        </div>

        {/* Branch Tabs */}
        {branches.length > 0 && (
          <div className="sticky top-16 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-SeaGrean/20 dark:border-Orange/20">
            <div className="container mx-auto px-4">
              <div className="flex overflow-x-auto gap-1 py-3 scrollbar-hide">
                <button
                  onClick={() => setSelectedBranchId("all")}
                  className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                    selectedBranchId === "all"
                      ? "bg-SeaGrean text-white shadow-lg shadow-SeaGrean/30"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-SeaGrean/20 dark:hover:bg-Orange/20"
                  }`}
                >
                  All Branches
                </button>
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 flex items-center gap-2 ${
                      selectedBranchId === branch.id
                        ? "bg-SeaGrean text-white shadow-lg shadow-SeaGrean/30"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-SeaGrean/20 dark:hover:bg-Orange/20"
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {branch.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 lg:w-80 flex-shrink-0">
            <div className="md:hidden sticky top-20 z-50 bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/20">
              <button
                onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                className="w-full py-4 px-6 flex items-center justify-between text-Black dark:text-cream hover:text-SeaGrean dark:hover:text-Orange transition-colors duration-300"
                aria-label="Toggle filter menu"
              >
                <span className="font-[500] flex items-center gap-2 text-SeaGrean dark:text-Orange">
                  <Search className="w-5 h-5 animate-pulse" />
                  Filter Courses
                </span>
                <ChevronDown
                  className={`w-5 h-5 transition-transform duration-500 text-SeaGrean dark:text-Orange ${isMobileFilterOpen ? "rotate-180" : ""
                    }`}
                />
              </button>
              <div
                className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${isMobileFilterOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                onClick={() => setIsMobileFilterOpen(false)}
              />
              <div
                className={`overflow-hidden transition-all duration-700 ease-in-out ${isMobileFilterOpen ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
                  }`}
              >
                <div className="p-6 space-y-6 bg-white/20 dark:bg-gray-900/20 backdrop-blur-xl rounded-b-2xl">
                  <div className="relative group">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-SeaGrean dark:group-hover:text-Orange transition-colors duration-300"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      placeholder="Search specializations..."
                      className="w-full pl-12 pr-4 py-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md rounded-full border border-transparent focus:border-SeaGrean dark:focus:border-Orange focus:ring-2 focus:ring-SeaGrean/30 dark:focus:ring-Orange/30 focus:outline-none transition-all duration-300 text-Black dark:text-cream placeholder-gray-400"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      aria-label="Search specializations"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-tighter text-gray-400 font-bold px-2">Specializations</p>
                      {activeSpecializations.map((spec) => (
                        <button
                          key={spec.id}
                          onClick={() => {
                            scrollToSpecialization(spec.id);
                            setIsMobileFilterOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 rounded-xl group relative overflow-hidden bg-white/10 dark:bg-gray-800/10 hover:bg-SeaGrean/20 dark:hover:bg-Orange/20 transition-all duration-300 transform hover:scale-105"
                          role="listitem"
                          aria-label={`View ${spec.name}`}
                        >
                          <span className="relative flex items-center gap-2 text-Black dark:text-cream text-sm">
                            <span className="w-2 h-2 rounded-full bg-SeaGrean dark:bg-Orange animate-pulse"></span>
                            {spec.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden md:block sticky top-24 space-y-6 p-4 bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/20">
              <div className="relative group animate-fadeIn">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-SeaGrean dark:group-hover:text-Orange transition-colors duration-300 animate-pulse"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder="Search specializations..."
                  className="w-full pl-12 pr-4 py-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md rounded-full border border-transparent focus:border-SeaGrean dark:focus:border-Orange focus:ring-2 focus:ring-SeaGrean/30 dark:focus:ring-Orange/30 focus:outline-none transition-all duration-300 text-Black dark:text-cream placeholder-gray-400"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  aria-label="Search specializations"
                />
              </div>
              <div
                className="space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto custom-scrollbar pr-2"
                role="list"
                aria-label="Specializations"
              >
                <div className="space-y-2">
                  <h4 className="text-lg font-[600] text-SeaGrean dark:text-Orange flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-SeaGrean dark:bg-Orange animate-ping"></span>
                    Available Now
                  </h4>
                  <div role="list" aria-label="Available specializations" className="space-y-2">
                    {activeSpecializations.map((spec) => (
                      <button
                        key={spec.id}
                        onClick={() => scrollToSpecialization(spec.id)}
                        className="w-full text-left px-4 py-3 rounded-xl group relative overflow-hidden bg-white/10 dark:bg-gray-800/10 hover:bg-SeaGrean/20 dark:hover:bg-Orange/20 transition-all duration-300 transform hover:scale-105"
                        role="listitem"
                        aria-label={`View ${spec.name}`}
                      >
                        <span className="relative flex items-center gap-2 text-Black dark:text-cream">
                          <span className="w-2 h-2 rounded-full bg-SeaGrean dark:bg-Orange animate-pulse"></span>
                          {spec.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-24">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-t-2xl"></div>
                    <div className="p-6 space-y-4 bg-white/50 dark:bg-gray-800/50 rounded-b-2xl">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : specializations.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-500 dark:text-gray-400">No specializations found.</p>
              </div>
            ) : (
              <div className="space-y-32">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                  {activeSpecializations.map((specialization) => {
                    const relatedCourses = filteredCoursesByBranch
                      .filter((c) => {
                        const cSpecId = typeof c.specialization === 'object' && c.specialization !== null
                          ? (c.specialization as any).id
                          : (c.specialization_id || c.specialization);
                        return String(cSpecId) === String(specialization.id);
                      })
                      .sort((a, b) => {
                        if (a.admission_status === 'open' && b.admission_status !== 'open') return -1;
                        if (a.admission_status !== 'open' && b.admission_status === 'open') return 1;
                        return 0;
                      });
                    const currentIndex = courseIndices[specialization.id] || 0;

                    return (
                      <div
                        key={specialization.id}
                        ref={(el) => (specializationRefs.current[specialization.id] = el)}
                        className={`animate-on-scroll opacity-0 translate-y-10 scale-95 transition-all duration-1000 ${specialization.active ? "" : "opacity-75"}`}
                        onMouseEnter={() => {
                          setHoveredSpecialization(specialization.id);
                          if (courseIndices[specialization.id] === undefined) {
                            setCourseIndices((prev) => ({
                              ...prev,
                              [specialization.id]: 0,
                            }));
                          }
                        }}
                        onMouseLeave={() => setHoveredSpecialization(null)}
                      >
                        <div className="text-center mb-6 space-y-4">
                          <h2 className="text-2xl font-[300] text-Black dark:text-cream transform hover:scale-105 transition-all duration-500">
                            <span
                              className={`bg-gradient-to-r ${specialization.active
                                ? "from-SeaGrean to-Blue"
                                : "from-gray-400 to-gray-600"
                                } bg-clip-text line-clamp-1 hover:line-clamp-none text-transparent pb-[5px]`}
                            >
                              {specialization.name}
                            </span>
                          </h2>
                          <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 hover:line-clamp-none transition-all duration-300">
                            {specialization.description}
                          </p>
                        </div>
                        {specialization.active && relatedCourses.length > 0 ? (
                          <div className="relative group">
                            <div 
                              ref={(el) => (carouselRefs.current[specialization.id] = el)}
                              className="flex gap-4 overflow-x-auto scrollbar-hide pb-8 snap-x snap-mandatory px-4 md:px-8"
                              style={{ 
                                scrollSnapType: 'x mandatory',
                                WebkitOverflowScrolling: 'touch'
                              }}
                            >
                              {relatedCourses.map((course, courseIdx) => {
                                const isActive = courseIdx === currentIndex;
                                return (
                                  <div
                                    key={course.id}
                                    className={`flex-shrink-0 snap-center transition-all duration-500 ${isActive 
                                      ? 'w-[calc(100%-2rem)] sm:w-[calc(50%-1rem)] md:w-[calc(100%-4rem)] lg:w-[calc(80%-2rem)]' 
                                      : 'w-[calc(100%-2rem)] sm:w-[calc(50%-1rem)] md:w-[calc(100%-4rem)] lg:w-[calc(80%-2rem)] opacity-80'
                                      }`}
                                    style={{
                                      minWidth: '280px',
                                      maxWidth: '480px',
                                    }}
                                    >
                                      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl overflow-hidden shadow-2xl hover:shadow-[0_10px_30px_rgba(0,160,140,0.4)] dark:hover:shadow-[0_10px_30px_rgba(255,120,0,0.4)] transition-all duration-500 transform hover:scale-[1.03] hover:-translate-y-3 border border-SeaGrean/30 dark:border-Orange/30 flex flex-col h-full">
                                        <div className="relative h-48 w-full overflow-hidden rounded-t-2xl flex-shrink-0">
                                          <img
                                            src={course.image ? `${process.env.NEXT_PUBLIC_API_URL || ""}${course.image}` : defaultImage}
                                            alt={course.name}
                                            className="object-cover w-full h-full rounded-t-2xl transition-transform duration-500 group-hover:scale-105"
                                            loading={isActive ? "eager" : "lazy"}
                                            onError={(e) => { e.currentTarget.src = defaultImage; }}
                                          />
                                          <div className="absolute inset-0 bg-gradient-to-t from-Black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        </div>
                                        <div className="p-5 bg-gradient-to-b from-white/95 to-SeaGrean/20 dark:from-gray-800/95 dark:to-Orange/20 flex flex-col flex-1">
                                        <h3 className="text-xl font-[300] mb-3 line-clamp-1 hover:line-clamp-none text-Black dark:text-cream group-hover:text-SeaGrean dark:group-hover:text-Orange transition-colors duration-300">
                                          {course.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mb-2">
                                          <Clock className="w-3 h-3 text-SeaGrean" />
                                          <span className="text-xs font-bold text-SeaGrean">{course.duration} Months</span>
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm line-clamp-2 hover:line-clamp-none group-hover:text-Black dark:group-hover:text-cream transition-colors duration-300">
                                          {course.description}
                                        </p>

                                        {/* Branch Locations */}
                                        {course.branches && course.branches.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5 mb-3">
                                            {course.branches.map((b) => (
                                              <span key={b.id} className="flex items-center gap-1 bg-SeaGrean/5 dark:bg-Orange/5 text-SeaGrean/70 dark:text-Orange/70 px-2 py-0.5 rounded-full text-[10px] font-medium">
                                                <MapPin className="w-2.5 h-2.5" />
                                                <code className="bg-SeaGrean/10 dark:bg-Orange/10 px-1 rounded text-[8px] font-mono font-bold">{b.code}</code>
                                                {b.name}
                                              </span>
                                            ))}
                                          </div>
                                        )}

                                        <div className="flex flex-wrap items-center gap-2 mb-4">
                                          <span className="flex items-center gap-1.5 bg-SeaGrean/10 dark:bg-Orange/10 text-SeaGrean dark:text-Orange px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm border border-SeaGrean/20 dark:border-Orange/20">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            {course.level == 1 ? "Beginner" : course.level == 2 ? "Advanced" : `Level ${course.level}`}
                                          </span>
                                          {course.admission_status?.toLowerCase() === 'open' && (
                                            <div className="flex flex-col gap-1">
                                              <span className="flex items-center gap-1.5 bg-green-100/80 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider w-fit backdrop-blur-sm border border-green-200 dark:border-green-800">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Admission Open
                                              </span>
                                              <div className="flex flex-col text-[10px] text-gray-500 dark:text-gray-400 font-medium pl-1">
                                                <span>Adm. Open: {course.admission_open_date || 'N/A'}</span>
                                                <span className="text-SeaGrean dark:text-Orange">Start: {course.course_start_date || 'N/A'}</span>
                                              </div>
                                            </div>
                                          )}
                                          {course.admission_status?.toLowerCase() === 'coming_soon' && (
                                            <div className="flex flex-col gap-1">
                                              <span className="flex items-center gap-1.5 bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider w-fit backdrop-blur-sm border border-blue-200 dark:border-blue-800">
                                                <Clock className="w-3 h-3" />
                                                Opening Soon
                                              </span>
                                              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium pl-1">Opens: {course.admission_open_date || 'N/A'}</span>
                                            </div>
                                          )}
                                          {course.admission_status?.toLowerCase() === 'closed' && (
                                            <span className="flex items-center gap-2 bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider w-fit backdrop-blur-sm border border-red-200 dark:border-red-800">
                                              <XCircle className="w-3 h-3" />
                                              Admission Closed
                                            </span>
                                          )}

                                          {/* Session Summary */}
                                          {course.sessions_count != null && course.sessions_count > 0 && (
                                            <span className="flex items-center gap-1.5 bg-purple-100/80 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider w-fit backdrop-blur-sm border border-purple-200 dark:border-purple-800">
                                              <Calendar className="w-3 h-3" />
                                              {course.sessions_count} Session{course.sessions_count > 1 ? 's' : ''} Available
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-3 text-sm mt-auto">
                                          {course.admission_status?.toLowerCase() === 'open' ? (
                                            <div className="flex-1">
                                              <Link
                                                href={{
                                                  pathname: "/register",
                                                  query: {
                                                    course_id: course.id,
                                                    specialization_id: specialization.id,
                                                    branch_id: selectedBranchId !== "all" ? selectedBranchId : course.branches?.[0]?.id || "",
                                                  },
                                                }}
                                                className="group/btn relative flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-SeaGrean to-Blue text-white rounded-full font-bold shadow-[0_4px_15px_rgba(0,160,140,0.3)] transition-all duration-300 hover:scale-105 active:scale-95 text-xs uppercase"
                                              >
                                                <GraduationCap className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
                                                Enroll Now
                                              </Link>
                                            </div>
                                          ) : (
                                            <div className="flex-1">
                                              <button
                                                disabled
                                                className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed rounded-full font-bold text-xs uppercase"
                                              >
                                                <XCircle className="w-4 h-4" />
                                                Enroll Now
                                              </button>
                                            </div>
                                          )}

                                          <Link
                                            href={{
                                              pathname: "/courses/details",
                                              query: {
                                                id: course.id,
                                                name: course.name,
                                                description: course.description,
                                                image: course.image,
                                                duration: course.duration,
                                                level: course.level,
                                                specialization_id: specialization.id,
                                                specialization_name: specialization.name,
                                                admission_status: course.admission_status,
                                                admission_open_date: course.admission_open_date,
                                                course_start_date: course.course_start_date,
                                                course_end_date: course.course_end_date,
                                                branches: JSON.stringify(course.branches?.map(b => b.name) || []),
                                                prerequisite: JSON.stringify([]),
                                                next_level: JSON.stringify([]),
                                              },
                                            }}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-SeaGrean/10 dark:bg-Orange/10 text-SeaGrean dark:text-Orange hover:bg-SeaGrean hover:text-white dark:hover:bg-Orange dark:hover:text-white transition-all duration-300 rounded-full font-bold text-xs uppercase border border-SeaGrean/20 dark:border-Orange/20 shadow-sm"
                                          >
                                            <Info className="w-4 h-4" />
                                            Details
                                          </Link>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  );
                              })}
                            </div>
                            {relatedCourses.length > 1 && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePrev(specialization.id); }}
                                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-SeaGrean/95 dark:bg-Orange/95 text-cream p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-125 hover:shadow-[0_8px_20px_rgba(0,160,140,0.5)] dark:hover:shadow-[0_8px_20px_rgba(255,120,0,0.5)] z-40 focus:outline-none focus:ring-2 focus:ring-SeaGrean dark:focus:ring-Orange"
                                  aria-label={`Previous course in ${specialization.name}`}
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleNext(specialization.id); }}
                                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-SeaGrean/95 dark:bg-Orange/95 text-cream p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-125 hover:shadow-[0_8px_20px_rgba(0,160,140,0.5)] dark:hover:shadow-[0_8px_20px_rgba(255,120,0,0.5)] z-40 focus:outline-none focus:ring-2 focus:ring-SeaGrean dark:focus:ring-Orange"
                                  aria-label={`Next course in ${specialization.name}`}
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>
                                <div className="flex justify-center space-x-2 mt-4 relative z-10">
                              {relatedCourses.map((_, courseIdx) => (
                                <button
                                  key={courseIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    prevCourseIndices.current[specialization.id] = currentIndex;
                                    setCourseIndices((prev) => ({ ...prev, [specialization.id]: courseIdx }));
                                    
                                    // Scroll to the selected card
                                    const carousel = carouselRefs.current[specialization.id];
                                    if (carousel) {
                                      const cardWidth = Math.min(480, carousel.offsetWidth - 48);
                                      carousel.scrollTo({
                                        left: courseIdx * (cardWidth + 16),
                                        behavior: 'smooth'
                                      });
                                    }
                                  }}
                                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${currentIndex === courseIdx
                                      ? "bg-SeaGrean dark:bg-Orange w-6 scale-125 shadow-[0_0_10px_rgba(0,160,140,0.6)] dark:shadow-[0_0_10px_rgba(255,120,0,0.6)] animate-pulse"
                                      : "bg-gray-300/80 dark:bg-gray-600/80 hover:bg-gray-400 dark:hover:bg-gray-500"
                                      }`}
                                    aria-label={`Go to course ${courseIdx + 1}`}
                                  />
                                ))}
                              </div>
                            </>
                            )}
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl overflow-hidden shadow-2xl border border-gray-300/50 dark:border-gray-600/50">
                              <div className="relative h-64 w-full bg-gray-100/50 dark:bg-gray-800/50 flex items-center justify-center">
                                <div className="text-center p-6">
                                  <Clock className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 animate-pulse" aria-hidden="true" />
                                  <p className="mt-4 text-gray-500 dark:text-gray-400">Coming Soon</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default CoursesPage;
