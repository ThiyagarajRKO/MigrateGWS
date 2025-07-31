'use client';

import Link from 'next/link'
import { Users, Database, Settings, BarChart3, Shield, FileText } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">GWS Migration Platform</h1>
            </div>
            <nav className="flex space-x-8">
              <Link href="/dashboard" className="text-gray-600 hover:text-blue-600">Dashboard</Link>
              <Link href="/migrations" className="text-gray-600 hover:text-blue-600">Migrations</Link>
              <Link href="/settings" className="text-gray-600 hover:text-blue-600">Settings</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            DIY Google Workspace Migration Platform
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Secure, scalable, and user-friendly platform for GWS-to-GWS data migration. 
            Support for Gmail, Drive, Calendar, Contacts, and more with advanced domain mapping.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/migrations/new" className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-semibold">
              Start Migration
            </Link>
            <Link href="/dashboard" className="bg-white text-blue-600 border border-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 font-semibold">
              View Dashboard
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <Users className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Domain & User Mapping</h3>
            <p className="text-gray-600">
              Advanced mapping tools with one-to-one, one-to-many, and many-to-one user transformations
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <Shield className="h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Secure Authentication</h3>
            <p className="text-gray-600">
              Domain-wide delegation and cross-tenant OAuth setup for secure data access
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <BarChart3 className="h-12 w-12 text-purple-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Real-time Monitoring</h3>
            <p className="text-gray-600">
              Track migration progress with detailed analytics and audit trails
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <Settings className="h-12 w-12 text-orange-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Visual Mapping Tools</h3>
            <p className="text-gray-600">
              Drag-and-drop interface for defining complex domain and user mappings
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <Database className="h-12 w-12 text-indigo-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Multi-Service Support</h3>
            <p className="text-gray-600">
              Migrate Gmail, Drive, Calendar, Contacts, Photos, and Google Chat
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <FileText className="h-12 w-12 text-red-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Comprehensive Reporting</h3>
            <p className="text-gray-600">
              Detailed migration reports with verification and audit capabilities
            </p>
          </div>
        </div>

        {/* Migration Types */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Supported Migration Scenarios</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border-l-4 border-blue-500 pl-6">
              <h3 className="text-lg font-semibold mb-2">Same Super Admin Migration</h3>
              <p className="text-gray-600">
                Migrate users between domains within the same Google Workspace organization
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-6">
              <h3 className="text-lg font-semibold mb-2">Cross-Tenant Migration</h3>
              <p className="text-gray-600">
                Secure migration between different Google Workspace tenants
              </p>
            </div>
            <div className="border-l-4 border-purple-500 pl-6">
              <h3 className="text-lg font-semibold mb-2">Domain Consolidation</h3>
              <p className="text-gray-600">
                Merge multiple domains into a single Google Workspace environment
              </p>
            </div>
            <div className="border-l-4 border-orange-500 pl-6">
              <h3 className="text-lg font-semibold mb-2">Domain Splitting</h3>
              <p className="text-gray-600">
                Split users from one domain across multiple target domains
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
