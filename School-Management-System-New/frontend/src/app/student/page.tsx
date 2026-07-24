"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function StudentRoot() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/student/dashboard")
  }, [router])
  return null
}
