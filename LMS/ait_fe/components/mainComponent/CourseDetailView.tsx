// 'use client';

// import { useState, useEffect } from 'react';
// import Image from 'next/image';
// import Link from 'next/link';
// import { motion, AnimatePresence } from 'framer-motion';
// import { ArrowLeft } from 'lucide-react';
// import { Button } from '@/components/ui/button';

// interface CourseDetailViewProps {
//   course: [];
//   specialization: [];
//   prerequisites: [];
// }

// const CourseDetailView = ({ 
//   course, 
//   specialization, 
//   prerequisites 
// }: CourseDetailViewProps) => {
//   const [showPopup, setShowPopup] = useState(false);
//   const [isLoading, setIsLoading] = useState(true);

//   useEffect(() => {
//     setIsLoading(false);
//   }, []);

//   const bannerImage = getUpdatedImageUrl(specialization?.name || '', course.level);

//   const handleEnroll = () => {
//     setShowPopup(true);
//     setTimeout(() => {
//       setShowPopup(false);
//       window.location.href = '/courses';
//     }, 5000);
//   };

//   return (
//     <>
//       <AnimatePresence>
//         {showPopup && (
//           <motion.div
//             initial={{ opacity: 0, y: -50 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: -50 }}
//             className="fixed inset-0 z-50 flex items-center justify-center bg-Black/50 backdrop-blur-sm"
//           >
//             <div className="bg-cream dark:bg-Blue p-8 rounded-2xl shadow-2xl max-w-md mx-4 text-center transform hover:scale-105 transition-transform duration-300">
//               <h3 className="text-2xl font-[400] text-SeaGrean dark:text-Orange mb-4">
//                 Coming Soon!
//               </h3>
//               <p className="text-gray-600 dark:text-gray-300 mb-4">
//                 We&apos;re working hard to bring you this feature. Stay tuned for updates!
//               </p>
//               <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
//                 <motion.div
//                   initial={{ width: "0%" }}
//                   animate={{ width: "100%" }}
//                   transition={{ duration: 5 }}
//                   className="h-full bg-SeaGrean dark:bg-Orange"
//                 />
//               </div>
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       <div className="min-h-screen bg-gradient-to-b from-cream to-SeaGrean/10 dark:from-Black dark:to-Blue/20">
//         <div className="container mx-auto px-4 py-8 rounded-2xl">
//           <Link 
//             href="/courses"
//             className="inline-flex items-center px-4 py-2 bg-SeaGrean/10 dark:bg-Orange/10 
//               text-SeaGrean dark:text-Orange hover:bg-SeaGrean hover:text-cream
//               dark:hover:bg-Orange dark:hover:text-cream
//               transition-all duration-300 transform hover:scale-105 mb-6 group rounded-full"
//           >
//             <ArrowLeft className="mr-2 h-4 w-4 transform group-hover:-translate-x-1 transition-transform duration-300 rounded-full" />
//             Back to Courses
//           </Link>

//           <motion.div
//             initial={{ opacity: 0, height: 0 }}
//             animate={{ opacity: 1, height: "auto" }}
//             transition={{ duration: 0.5, ease: "easeOut" }}
//             className="relative bg-cream dark:bg-Blue rounded-2xl overflow-hidden shadow-lg
//               before:absolute before:inset-0 before:border-[3px] before:border-SeaGrean/70 dark:before:border-Orange/70
//               before:rounded-2xl before:content-[''] before:animate-border-beam
//               before:bg-gradient-to-r before:from-SeaGrean/20 before:via-transparent before:to-Orange/20
//               before:animate-gradient-x"
//           >
//             <div className="relative h-[300px] overflow-hidden">
//               <Image
//                 src={bannerImage}
//                 alt={course.title}
//                 fill
//                 className="object-cover transition-transform duration-700 hover:scale-110"
//                 priority
//               />
//               <div className="absolute inset-0 bg-gradient-to-t from-Black/90 via-Black/50 to-transparent" />
              
//               <div className="absolute bottom-0 left-0 right-0 p-6 transform group-hover:translate-y-[-5px] transition-transform duration-500">
//                 <motion.h1 
//                   initial={{ opacity: 0, y: 20 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   className="mb-3 text-6xl font-[400] animate-pulse bg-gradient-to-r from-cream to-SeaGrean dark:from-SeaGrean dark:to-cream bg-clip-text text-transparent"
//                 >
//                   {course.title}
//                 </motion.h1>
//                 <motion.p 
//                   initial={{ opacity: 0, y: 20 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   transition={{ delay: 0.2 }}
//                   className="text-lg text-gray-200"
//                 >
//                   {course.description}
//                 </motion.p>
//               </div>
//             </div>

//             <div className="p-6 space-y-6">
//               <motion.div 
//                 initial={{ opacity: 0, y: 20 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ delay: 0.3 }}
//                 whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
//                 className="bg-SeaGrean/10 dark:bg-Orange/10 rounded-xl p-6 shadow-md 
//                   hover:bg-SeaGrean/20 dark:hover:bg-Orange/20 transition-all duration-300
//                   hover:border-SeaGrean/50 dark:hover:border-Orange/50 border-2 border-transparent"
//               >
//                 <h2 className="text-xl font-[400] text-Black dark:text-cream mb-4">Course Overview</h2>
//                 <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed">
//                   {course.fullDescription}
//                 </p>
//               </motion.div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 <motion.div 
//                   initial={{ opacity: 0, x: -20 }}
//                   animate={{ opacity: 1, x: 0 }}
//                   transition={{ delay: 0.4 }}
//                   whileHover={{ 
//                     scale: 1.03, 
//                     boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
//                     background: "linear-gradient(45deg, rgba(0,128,128,0.15), rgba(255,165,0,0.15))"
//                   }}
//                   className="bg-SeaGrean/10 dark:bg-Orange/10 rounded-xl p-6 shadow-md
//                     transition-all duration-300 transform hover:rotate-1"
//                 >
//                   <h2 className="text-lg font-[400] text-Black dark:text-cream mb-4">Course Details</h2>
//                   <div className="space-y-3">
//                     <div className="flex items-center space-x-3 text-base">
//                       <span className="text-SeaGrean dark:text-Orange">Duration:</span>
//                       <span className="text-gray-600 dark:text-gray-300">{course.duration}</span>
//                     </div>
//                     <div className="flex items-center space-x-3 text-base">
//                       <span className="text-SeaGrean dark:text-Orange">Level:</span>
//                       <span className="text-gray-600 dark:text-gray-300">{course.level}</span>
//                     </div>
//                     <div className="flex items-center space-x-3 text-base">
//                       <span className="text-SeaGrean dark:text-Orange">Specialization:</span>
//                       <span className="text-gray-600 dark:text-gray-300">{specialization?.name}</span>
//                     </div>
//                   </div>
//                 </motion.div>

//                 <motion.div 
//                   initial={{ opacity: 0, x: 20 }}
//                   animate={{ opacity: 1, x: 0 }}
//                   transition={{ delay: 0.5 }}
//                   whileHover={{ 
//                     scale: 1.03, 
//                     boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
//                     background: "linear-gradient(-45deg, rgba(0,128,128,0.15), rgba(255,165,0,0.15))"
//                   }}
//                   className="bg-SeaGrean/10 dark:bg-Orange/10 rounded-xl p-6 shadow-md
//                     transition-all duration-300 transform hover:rotate-[-1deg]"
//                 >
//                   <h2 className="text-lg font-[400] text-Black dark:text-cream mb-4">Prerequisites</h2>
//                   {prerequisites.length > 0 ? (
//                     <ul className="space-y-2">
//                       {prerequisites.map(pre => (
//                         <li key={pre.id} className="flex items-center text-base text-gray-600 dark:text-gray-300 hover:translate-x-2 transition-transform duration-300">
//                           <span className="mr-2">•</span>
//                           {pre.title}
//                         </li>
//                       ))}
//                     </ul>
//                   ) : (
//                     <p className="text-base text-gray-600 dark:text-gray-300">No prerequisites required</p>
//                   )}
//                 </motion.div>
//               </div>

//               <motion.div 
//                 initial={{ opacity: 0, y: 20 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ delay: 0.6 }}
//                 className="flex justify-center pt-4"
//               >
//                 <Button
//                   onClick={handleEnroll}
//                   className="relative h-12 px-8 overflow-hidden
//                     text-SeaGrean dark:text-Orange text-base font-[400]
//                     border-2 border-SeaGrean dark:border-Orange
//                     shadow-md hover:shadow-lg transition-all duration-500
//                     before:absolute before:inset-0
//                     before:bg-gradient-to-r before:from-SeaGrean before:to-Blue dark:before:from-Orange dark:before:to-Blue
//                     before:scale-x-0 hover:before:scale-x-100
//                     before:transition-transform before:duration-500
//                     hover:text-cream dark:hover:text-cream
//                     transform hover:scale-105 rounded-full"
//                 >
//                   <span className="relative z-10">Enroll Now</span>
//                 </Button>
//               </motion.div>
//             </div>
//           </motion.div>
//         </div>
//       </div>
//     </>
//   );
// };

// export default CourseDetailView;

// function getUpdatedImageUrl(specialization: string, level: number): string {
//   const imageMap = {
//     'web-dev': [
//       'https://images.unsplash.com/photo-1547658719-da2b51169166?q=80&w=800',
//       'https://images.unsplash.com/photo-1593720213428-28a5b9e94613?q=80&w=800', 
//       'https://images.unsplash.com/photo-1627398242454-45a1465c2479?q=80&w=800'
//     ],
//     'python': [
//       'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?q=80&w=800',
//       'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=800',
//       'https://images.unsplash.com/photo-1516116216624-53e697fedbea?q=80&w=800'
//     ],
//     'data-science': [
//       'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800',
//       'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?q=80&w=800',
//       'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800'
//     ]
//   }

//   const defaultImage = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800'
  
//   return imageMap[specialization as keyof typeof imageMap]?.[level - 1] || defaultImage
// } 
