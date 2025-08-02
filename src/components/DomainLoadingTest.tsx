'use client'

import { useState } from 'react'

export default function DomainLoadingTest() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadTime, setLoadTime] = useState<number | null>(null)

  const testDomainLoading = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setLoadTime(null)

    const startTime = performance.now()

    try {
      const response = await fetch('/api/google-workspace?action=domains&adminEmail=test@example.com')
      const data = await response.json()
      
      const endTime = performance.now()
      setLoadTime(endTime - startTime)
      
      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Unknown error')
      }
    } catch (err) {
      const endTime = performance.now()
      setLoadTime(endTime - startTime)
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">Domain Loading Performance Test</h3>
      
      <button 
        onClick={testDomainLoading} 
        disabled={loading}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Domain Loading'}
      </button>
      
      {loadTime && (
        <div className="mb-2">
          <strong>Load Time:</strong> {loadTime.toFixed(2)}ms
        </div>
      )}
      
      {error && (
        <div className="text-red-600 mb-2">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {result && (
        <div className="text-green-600">
          <strong>Success:</strong> Domains fetched successfully
          <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
