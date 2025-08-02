import React from 'react'
import AutomatedUserEnumeration from '@/components/AutomatedUserEnumeration'
import { GWSUser } from '@/types'

export default function UserEnumerationDemo() {
  const handleUsersEnumerated = (users: GWSUser[]) => {
    console.log(`Successfully enumerated ${users.length} users:`, users)
    
    // Here you could trigger additional automation steps:
    // - Validate user data
    // - Create user mappings
    // - Start migration planning
    // - Generate reports
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Automated User Enumeration Demo
          </h1>
          <p className="text-gray-600">
            Demonstrate automated user discovery and enumeration using the Google Workspace Admin SDK.
            This automation approach uses the Users.list() API to get actual user data from the source domain.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              Automation Approach
            </h2>
            <p className="text-blue-800 text-sm mb-3">
              Use Admin SDK to enumerate users in 1-3 minutes
            </p>
            <div className="text-blue-700 text-sm space-y-1">
              <p><strong>APIs Used:</strong></p>
              <p>• AdminSDK &gt; Users.list() - Get actual user data</p>
              <p>• Supports pagination for large user sets</p>
              <p>• Includes filtering options (suspended, archived, org units)</p>
              <p>• Provides progress tracking and batch processing</p>
            </div>
          </div>

          <AutomatedUserEnumeration
            domain="testgokuldham.com"
            adminEmail="admin@testgokuldham.com"
            onUsersEnumerated={handleUsersEnumerated}
          />

          <div className="bg-gray-100 border rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Integration Points
            </h3>
            <div className="text-gray-700 text-sm space-y-2">
              <p><strong>After enumeration completes, you can:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Automatically create user mappings for migration</li>
                <li>Validate user data and identify issues</li>
                <li>Generate migration planning reports</li>
                <li>Start automated migration workflows</li>
                <li>Export user lists for manual review</li>
                <li>Trigger notification systems</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
