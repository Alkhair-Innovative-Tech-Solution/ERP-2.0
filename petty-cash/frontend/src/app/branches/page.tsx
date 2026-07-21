'use client'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getBranches, getDashboard } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Building2, School, Stethoscope, Microscope, Monitor, MapPin, Phone, ChevronRight } from 'lucide-react'

const typeIcons: Record<string, any> = {
  head_office: Building2,
  school: School,
  college: Building2,
  hospital: Stethoscope,
  medical_center: Microscope,
  it_institute: Monitor,
}

const typeColors: Record<string, string> = {
  head_office: 'bg-purple-50 text-purple-600 border-purple-200',
  school: 'bg-blue-50 text-blue-600 border-blue-200',
  college: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  hospital: 'bg-red-50 text-red-600 border-red-200',
  medical_center: 'bg-amber-50 text-amber-600 border-amber-200',
  it_institute: 'bg-cyan-50 text-cyan-600 border-cyan-200',
}

export default function BranchesPage() {
  const { isAccountsHead } = useAuth()
  const [branches, setBranches] = useState<any[]>([])
  const [branchStats, setBranchStats] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getBranches().then(r => setBranches(r.data.results || r.data)),
      getDashboard().then(r => {
        const stats: Record<string, any> = {}
        ;(r.data.branch_wise_spent || []).forEach((b: any) => {
          stats[b.branch_code] = b
        })
        setBranchStats(stats)
      }),
    ]).finally(() => setLoading(false))
  }, [])

  if (!isAccountsHead) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <Building2 size={48} className="mx-auto text-navy-300 mb-4" />
          <h2 className="text-lg font-semibold text-navy-700">Access Restricted</h2>
          <p className="text-sm text-navy-400 mt-1">Only Accounts Head can view this page.</p>
        </div>
      </AppLayout>
    )
  }

  const grouped = branches.reduce((acc: any, b: any) => {
    if (!acc[b.type]) acc[b.type] = []
    acc[b.type].push(b)
    return acc
  }, {})

  const typeLabels: Record<string, string> = {
    head_office: 'Head Office',
    school: 'School Campuses',
    college: 'Colleges',
    hospital: 'Hospitals',
    medical_center: 'Medical Centers',
    it_institute: 'IT Institutes',
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900">Branches & Campuses</h1>
          <p className="text-xs sm:text-sm text-navy-400 mt-0.5">Overview of all NGO branches and their spending</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 bg-navy-100 rounded w-24 mb-3" />
                <div className="h-6 bg-navy-100 rounded w-32 mb-2" />
                <div className="h-3 bg-navy-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : (
          Object.entries(grouped).map(([type, typeBranches]: [string, any]) => (
            <div key={type}>
              <h2 className="text-sm font-semibold text-navy-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                {typeLabels[type] || type}
                <span className="text-navy-300 font-normal">({typeBranches.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(typeBranches as any[]).map((branch: any) => {
                  const Icon = typeIcons[branch.type] || Building2
                  const colorClass = typeColors[branch.type] || 'bg-navy-50 text-navy-600 border-navy-200'
                  const stats = branchStats[branch.code]
                  return (
                    <div key={branch.id} className="card p-5 card-hover">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-2.5 rounded-xl ${colorClass}`}>
                          <Icon size={18} />
                        </div>
                        <span className="text-[10px] font-mono font-semibold text-navy-400 bg-navy-50 px-2 py-0.5 rounded-md">
                          {branch.code}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-navy-900">{branch.name}</h3>
                      <div className="mt-2 space-y-1">
                        {branch.location && (
                          <p className="text-xs text-navy-400 flex items-center gap-1.5">
                            <MapPin size={11} /> {branch.location}
                          </p>
                        )}
                        {branch.contact && (
                          <p className="text-xs text-navy-400 flex items-center gap-1.5">
                            <Phone size={11} /> {branch.contact}
                          </p>
                        )}
                      </div>
                      {stats && (
                        <div className="mt-3 pt-3 border-t border-navy-100">
                          <div className="flex justify-between text-xs">
                            <span className="text-navy-400">This Month</span>
                            <span className="font-bold text-navy-900">PKR {Number(stats.total).toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] text-navy-400 mt-0.5">{stats.count} transactions</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  )
}
