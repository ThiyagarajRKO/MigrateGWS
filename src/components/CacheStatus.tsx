'use client'

import { useState, useEffect } from 'react'
import { Database, Clock, Users, Globe, Trash2, RefreshCw } from 'lucide-react'
import cacheManager from '@/lib/cache-manager'

interface CacheStatusProps {
  className?: string
  showDetails?: boolean
}

export default function CacheStatus({ className = '', showDetails = false }: CacheStatusProps) {
  const [stats, setStats] = useState<{
    domains: { count: number; keys: string[] }
    users: { count: number; keys: string[] }
    loading: { count: number; keys: string[] }
  } | null>(null)

  const [expanded, setExpanded] = useState(false)

  const refreshStats = () => {
    setStats(cacheManager.getStats())
  }

  const clearAllCaches = () => {
    cacheManager.clearAll()
    refreshStats()
  }

  useEffect(() => {
    refreshStats()
    
    // Auto refresh every 5 seconds when expanded
    let interval: NodeJS.Timeout | null = null
    if (expanded) {
      interval = setInterval(refreshStats, 5000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [expanded])

  if (!stats && !showDetails) return null

  const totalCacheEntries = (stats?.domains.count || 0) + (stats?.users.count || 0)
  const hasActiveLoading = (stats?.loading.count || 0) > 0

  return (
    <div className={`bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div 
        className={`p-3 flex items-center justify-between ${showDetails || expanded ? 'border-b border-gray-200' : ''} ${!showDetails ? 'cursor-pointer hover:bg-gray-50' : ''}`}
        onClick={!showDetails ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">
            Cache Status
          </span>
          {totalCacheEntries > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
              {totalCacheEntries} entries
            </span>
          )}
          {hasActiveLoading && (
            <div className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
              <span className="text-xs text-blue-600 font-medium">Loading...</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              refreshStats()
            }}
            className="p-1 hover:bg-gray-200 rounded text-slate-500 hover:text-slate-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          
          {totalCacheEntries > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearAllCaches()
              }}
              className="p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700 transition-colors"
              title="Clear All Caches"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Details */}
      {(showDetails || expanded) && stats && (
        <div className="p-3 space-y-3">
          {/* Domains Cache */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-700">Domains</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {stats.domains.count}
              </span>
              {stats.domains.count > 0 && (
                <button
                  onClick={() => {
                    cacheManager.invalidateDomains()
                    refreshStats()
                  }}
                  className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600 transition-colors"
                  title="Clear domain caches"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Users Cache */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-700">Users</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {stats.users.count}
              </span>
              {stats.users.count > 0 && (
                <button
                  onClick={() => {
                    cacheManager.invalidateUsers()
                    refreshStats()
                  }}
                  className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600 transition-colors"
                  title="Clear user caches"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Loading States */}
          {stats.loading.count > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-gray-700">Loading</span>
              </div>
              <span className="text-sm font-medium text-amber-600">
                {stats.loading.count}
              </span>
            </div>
          )}

          {/* Cache Keys (for debugging) */}
          {showDetails && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Cache Keys
              </h4>
              
              {stats.domains.keys.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-blue-600 font-medium mb-1">Domains:</div>
                  <div className="space-y-1">
                    {stats.domains.keys.map(key => (
                      <div key={key} className="text-xs text-gray-600 font-mono bg-blue-50 px-2 py-1 rounded">
                        {key}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {stats.users.keys.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-green-600 font-medium mb-1">Users:</div>
                  <div className="space-y-1">
                    {stats.users.keys.map(key => (
                      <div key={key} className="text-xs text-gray-600 font-mono bg-green-50 px-2 py-1 rounded">
                        {key}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {stats.loading.keys.length > 0 && (
                <div>
                  <div className="text-xs text-amber-600 font-medium mb-1">Loading:</div>
                  <div className="space-y-1">
                    {stats.loading.keys.map(key => (
                      <div key={key} className="text-xs text-gray-600 font-mono bg-amber-50 px-2 py-1 rounded">
                        {key}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No Cache Message */}
          {totalCacheEntries === 0 && (
            <div className="text-center py-2">
              <div className="text-sm text-gray-500">No cached data</div>
              <div className="text-xs text-gray-400 mt-1">
                Data will be cached after first load
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
