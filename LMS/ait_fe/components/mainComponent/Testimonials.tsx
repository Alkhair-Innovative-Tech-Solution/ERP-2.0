"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Quote } from "lucide-react"
import { useEffect, useRef } from "react"
import useEmblaCarousel from 'embla-carousel-react' // @ts-ignore
import Autoplay from 'embla-carousel-autoplay' // @ts-ignore
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Testimonial {
  quote: string
  author: string
  organization: string
  role?: string
}

const testimonials: Testimonial[] = [
  {
    quote:
      "Mind boggling initiative to educate ... only if we had more schools like this, the country would look a whole lot different.",
    author: "Omar Javaid",
    organization: "IOBM",
    role: "Education Director"
  },
  {
    quote: "The innovative approach to learning has transformed how we think about education.",
    author: "Sarah Chen",
    organization: "EdTech Solutions",
    role: "Technology Lead"
  },
  {
    quote: "A revolutionary step forward in making quality education accessible to all.",
    author: "Michael Rodriguez",
    organization: "Future Learning Institute",
    role: "Principal Consultant"
  },
  {
    quote: "The quality of education and dedication to student success is truly remarkable.",
    author: "Ayesha Khan",
    organization: "Digital Learning Academy",
    role: "Program Manager"
  },
  {
    quote: "I recently completed the one-year programming course at Idara Alkhair, and it was an excellent experience. The instructors were knowledgeable and supportive, making complex topics easy to understand. The course covered essential skills like HTML, CSS, WordPress, Canva, Bootstrap, and JavaScript, providing a strong foundation in web development. The practical projects were particularly helpful in building my portfolio. I highly recommend this course to anyone looking to start a career in web development. Thank you, Idara Alkhair, for a fantastic learning experience!",
    author: "Noor-Ul-Ain",
    organization: "Digital Learning Academy",
    role: "Program Manager"
  },
]

export default function TestimonialCarousel() {
  const autoplayRef = useRef(Autoplay({ delay: 2000, stopOnInteraction: true }))
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center", duration: 20 },
    [autoplayRef.current]
  )

  useEffect(() => {
    if (emblaApi) {
      emblaApi.reInit()
    }
  }, [emblaApi])

  return (
    <section className="bg-gradient-to-br from-SeaGrean/20 via-cream to-SeaGrean/20 dark:from-Blue/30 dark:via-Black dark:to-Blue/30 transition-all duration-500 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="space-y-4 text-center mb-10">
          <p className="text-SeaGrean dark:text-Orange font-medium tracking-wide uppercase">Testimonials</p>
          <h2 className="text-3xl font-semibold text-Black dark:text-cream bg-clip-text text-transparent bg-gradient-to-r from-Black to-SeaGrean dark:from-SeaGrean dark:to-cream">What Our Community Says</h2>
        </div>

        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="flex-[0_0_100%] px-4 sm:w-2/3 md:w-1/2 lg:w-1/3 mx-auto">
                <Card className="border border-SeaGrean/20 dark:border-Orange/30 hover:border-SeaGrean/50 dark:hover:border-Orange/50 bg-cream dark:bg-Blue/80 shadow-lg hover:shadow-xl transition-all duration-500 rounded-3xl">
                  <CardContent className="flex flex-col items-center p-6 sm:p-8">
                    <div className="relative mb-6">
                      <Quote className="h-12 w-12 text-SeaGrean dark:text-Orange" />
                    </div>
                    <p className="text-lg text-gray-600 dark:text-gray-300 text-center leading-relaxed italic">{testimonial.quote}</p>
                    <div className="text-center mt-4">
                      <p className="font-semibold text-Black dark:text-cream">{testimonial.author}</p>
                      <p className="text-SeaGrean dark:text-Orange font-medium">{testimonial.organization}</p>
                      {testimonial.role && (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{testimonial.role}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-6">
          <button 
            onClick={() => emblaApi?.scrollPrev()}
            className="bg-SeaGrean/10 dark:bg-Orange/20 border border-SeaGrean/20 dark:border-Orange/30 hover:bg-SeaGrean/20 dark:hover:bg-Orange/30 text-Black dark:text-cream rounded-full p-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button 
            onClick={() => emblaApi?.scrollNext()}
            className="bg-SeaGrean/10 dark:bg-Orange/20 border border-SeaGrean/20 dark:border-Orange/30 hover:bg-SeaGrean/20 dark:hover:bg-Orange/30 text-Black dark:text-cream rounded-full p-2">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  )
}
