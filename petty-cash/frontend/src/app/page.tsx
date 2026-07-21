'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

export default function RootPage() {
  const router = useRouter()
  useEffect(() => {
    const token = Cookies.get('access_token')
    router.push(token ? '/dashboard' : '/login')
  }, [router])
  return null
}
