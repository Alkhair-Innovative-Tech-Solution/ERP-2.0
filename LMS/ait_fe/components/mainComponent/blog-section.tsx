'use client'
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import Link from "next/link"

export function BlogSection() {
  const posts = [
    {
      id: 1,
      title: "Advanced Frontend Development",
      date: "Feb 20, 2025",
      category: "Web Development",
      image: "/images/frontend.jpg",
      href: "#",
    },
    {
      id: 2,
      title: "Cybersecurity Essentials",
      date: "Feb 25, 2025",
      category: "Cybersecurity",
      image: "/images/cybersecurity.jpg",
      href: "#",
    },
    {
      id: 3,
      title: "Mobile App Development",
      date: "Mar 05, 2025",
      category: "App Development",
      image: "/images/mobile-dev.jpg",
      href: "#",
    },
    {
      id: 4,
      title: "Data Science & AI",
      date: "Mar 10, 2025",
      category: "Artificial Intelligence",
      image: "/images/data-science.jpg",
      href: "#",
    },
  ]

  return (
    <section className="py-12 bg-[#F8F8F8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Tabs defaultValue="blogs" className="mb-8">
          <TabsList className="border-b w-full justify-start rounded-none p-0 h-auto">
            <TabsTrigger
              value="blogs"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#01b7c5] data-[state=active]:shadow-none px-4 py-2 text-[#101016]"
            >
              Courses
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {posts.map((post) => (
            <Link key={post.id} href={post.href}>
              <Card className="overflow-hidden hover:shadow-lg transition-shadow bg-white border border-gray-200">
                <div className="aspect-[16/9] relative overflow-hidden">
                  <Image src={post.image || ""} alt={post.title} fill className="object-cover" />
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <time className="text-sm text-gray-600">{post.date}</time>
                    <Badge variant="secondary" className="font-normal text-[#01b7c5] bg-[#E0F7FA]">
                      {post.category}
                    </Badge>
                  </div>
                  <h3 className="font-[300] text-lg leading-tight text-[#101016]">{post.title}</h3>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default BlogSection;
