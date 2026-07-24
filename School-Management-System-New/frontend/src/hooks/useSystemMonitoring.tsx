"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { getApiBaseUrl } from "@/lib/api"

export interface ServiceStat {
  latency: string
  status: string
  uptime: string
}

export interface SystemStats {
  cpu: number
  memory: number
  disk: number
  network: number
  services: Record<string, ServiceStat>
  timestamp: string
}

export interface ChartPoint {
  t: string
  v: number
}

function parseMs(latency: string | undefined): number {
  if (!latency) return 0
  const m = latency.match(/^(\d+)/)
  return m ? parseInt(m[1]) : 0
}

const MAX_POINTS = 60

export function useSystemMonitoring() {
  const [stats, setStats]                   = useState<SystemStats | null>(null)
  const [history, setHistory]               = useState<Array<{ timestamp: string; cpu: number; memory: number }>>([])
  const [serviceHistory, setServiceHistory] = useState<Record<string, ChartPoint[]>>({})
  const [logs, setLogs]                     = useState<any[]>([])
  const [isConnected, setIsConnected]       = useState(false)
  const wsRef              = useRef<WebSocket | null>(null)
  const reconnectRef       = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return

    const base = getApiBaseUrl()
    const wsUrl = `${(base.startsWith('https') ? base.replace(/^https/, 'wss') : base.replace(/^http/, 'ws')).replace(/\/$/, '')}/ws/monitoring/`
    const token = typeof window !== 'undefined' ? localStorage.getItem('sis_access_token') : null

    try {
      const ws = new WebSocket(token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'system_stats') {
            const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            const newStats: SystemStats = { ...data.data, timestamp: ts }
            setStats(newStats)

            setHistory(prev => {
              const next = [...prev, { timestamp: ts, cpu: data.data.cpu ?? 0, memory: data.data.memory ?? 0 }]
              return next.length > MAX_POINTS ? next.slice(1) : next
            })

            if (data.data.services) {
              setServiceHistory(prev => {
                const next = { ...prev }
                for (const [id, svc] of Object.entries(data.data.services as Record<string, ServiceStat>)) {
                  const val = parseMs((svc as ServiceStat).latency)
                  const arr = prev[id] ?? []
                  next[id] = [...arr.slice(-(MAX_POINTS - 1)), { t: ts, v: val }]
                }
                return next
              })
            }
          } else if (data.type === 'system_log') {
            setLogs(prev => {
              const next = [data.data, ...prev]
              return next.length > 100 ? next.slice(0, 100) : next
            })
          }
        } catch { /* silent */ }
      }

      ws.onclose = (e) => {
        setIsConnected(false)
        if (e.code !== 1000 && !reconnectRef.current) {
          reconnectRef.current = setTimeout(() => { reconnectRef.current = null; connect() }, 5000)
        }
      }
      ws.onerror = () => setIsConnected(false)
    } catch { setIsConnected(false) }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close(1000)
      wsRef.current = null
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  return { stats, history, serviceHistory, logs, isConnected }
}
