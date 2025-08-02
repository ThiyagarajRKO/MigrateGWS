'use client'

import { useState } from 'react'

export default function DelegationAPITester() {
  const [setupLoading, setSetupLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [setupResult, setSetupResult] = useState<any>(null)
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [adminEmail, setAdminEmail] = useState('admin@test.com')

  const testSetupAPI = async () => {
    setSetupLoading(true)
    setSetupResult(null)

    try {
      const response = await fetch('/api/v1/delegation/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminEmail: adminEmail,
          migrationScenario: 'single-super-admin'
        }),
      })

      const data = await response.json()
      setSetupResult({
        status: response.status,
        ok: response.ok,
        data: data
      })
    } catch (error) {
      setSetupResult({
        status: 'ERROR',
        ok: false,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    } finally {
      setSetupLoading(false)
    }
  }

  const testVerifyAPI = async () => {
    setVerifyLoading(true)
    setVerifyResult(null)

    try {
      const response = await fetch('/api/v1/delegation/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminEmail: adminEmail,
          migrationScenario: 'single-super-admin'
        }),
      })

      const data = await response.json()
      setVerifyResult({
        status: response.status,
        ok: response.ok,
        data: data
      })
    } catch (error) {
      setVerifyResult({
        status: 'ERROR',
        ok: false,
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    } finally {
      setVerifyLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Delegation API Tester</h2>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Admin Email:
        </label>
        <input
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="admin@test.com"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Setup API Test */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Setup API Test</h3>
          <button
            onClick={testSetupAPI}
            disabled={setupLoading}
            className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {setupLoading ? 'Testing Setup...' : 'Test Setup API'}
          </button>

          {setupResult && (
            <div className={`p-3 rounded text-sm ${
              setupResult.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="font-medium mb-2">
                Status: {setupResult.status} ({setupResult.ok ? 'SUCCESS' : 'ERROR'})
              </div>
              <pre className="overflow-auto text-xs">
                {JSON.stringify(setupResult.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Verify API Test */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Verify API Test</h3>
          <button
            onClick={testVerifyAPI}
            disabled={verifyLoading}
            className="mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {verifyLoading ? 'Testing Verify...' : 'Test Verify API'}
          </button>

          {verifyResult && (
            <div className={`p-3 rounded text-sm ${
              verifyResult.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="font-medium mb-2">
                Status: {verifyResult.status} ({verifyResult.ok ? 'SUCCESS' : 'ERROR'})
              </div>
              <pre className="overflow-auto text-xs">
                {JSON.stringify(verifyResult.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
