import React from 'react'
import UserMappingVisualizer, { UserMapping } from '@/components/UserMappingVisualizer'

export default function UserMappingDemo() {
  // Sample data based on the JSON structure provided
  const sampleMappings: UserMapping[] = [
    {
      sourceUsers: ["alice@company-a.com", "alice@company-b.com"],
      targetUser: "alice@newcorp.com",
      targetUserExists: true,
      mappingType: "merge",
      scenario: "Multi-source ➝ Single Target (Target Exists)",
      notes: "Merging identities from different domains. Consolidating email, calendar, and drive data."
    },
    {
      sourceUsers: ["john@company-a.com"],
      targetUser: ["john.sales@newcorp.com", "john.marketing@newcorp.com"],
      targetUserExists: false,
      mappingType: "split",
      scenario: "Single Source ➝ Multi Target (Target Not Exists)",
      notes: "Splitting one source user into multiple target identities based on departmental roles."
    },
    {
      sourceUsers: ["sarah@company-a.com"],
      targetUser: "sarah.jones@newcorp.com",
      targetUserExists: true,
      mappingType: "direct",
      scenario: "Direct Migration (1:1)",
      notes: "Simple one-to-one migration with email address change."
    },
    {
      sourceUsers: ["admin@legacy-system.com"],
      targetUser: "", // Will be auto-generated
      targetUserExists: false,
      mappingType: "create",
      scenario: "Create New User",
      notes: "Creating new user account based on source user information."
    },
    {
      sourceUsers: ["sales-team@company-a.com", "marketing@company-b.com"],
      targetUser: "unified-comms@newcorp.com",
      targetUserExists: false,
      mappingType: "merge",
      scenario: "Multi-source ➝ Single Target (Functional Account)",
      notes: "Merging multiple functional accounts into a single unified communications account."
    },
    {
      sourceUsers: ["ceo@company-a.com"],
      targetUser: ["ceo@newcorp.com", "ceo.public@newcorp.com", "leadership@newcorp.com"],
      targetUserExists: true,
      mappingType: "split",
      scenario: "Executive Account Split",
      notes: "Splitting executive account into public, private, and leadership communication channels."
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            User Mapping Visualization Demo
          </h1>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="text-blue-800 mb-3">
              This component visualizes user mappings for Google Workspace migration scenarios. 
              It supports various mapping types including merge, split, direct, and create operations.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
              <div>
                <h3 className="font-semibold mb-2">Key Features:</h3>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Visual representation of source to target mappings</li>
                  <li>Color-coded badges for user existence status</li>
                  <li>Mapping type indicators (merge, split, direct, create)</li>
                  <li>Scenario descriptions and detailed notes</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Mapping Types:</h3>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Merge:</strong> Multiple sources → Single target</li>
                  <li><strong>Split:</strong> Single source → Multiple targets</li>
                  <li><strong>Direct:</strong> One-to-one migration</li>
                  <li><strong>Create:</strong> Generate new target users</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* User Mapping Visualizer */}
        <UserMappingVisualizer mappings={sampleMappings} />

        {/* Technical Details */}
        <div className="mt-12 bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Technical Implementation
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">Component Features</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Responsive grid layout with Tailwind CSS</li>
                <li>• Interactive tooltips for additional information</li>
                <li>• Automatic target user generation from source names</li>
                <li>• Statistical summary with mapping distribution</li>
                <li>• Color-coded visual indicators for user status</li>
                <li>• Support for complex mapping scenarios</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">JSON Data Structure</h3>
              <div className="bg-gray-50 rounded-md p-4 text-xs font-mono">
                <pre className="text-gray-700">
{`{
  "sourceUsers": ["user@source.com"],
  "targetUser": "user@target.com",
  "targetUserExists": true,
  "mappingType": "direct",
  "scenario": "Description",
  "notes": "Optional details"
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
